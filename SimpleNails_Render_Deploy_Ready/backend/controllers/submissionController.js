const crypto = require('crypto');
const { db, admin } = require('../config/firebase');
const { sendBrevoEmail, projectConfirmation } = require('../services/emailService');
const { PACKAGE_PRICES } = require('../lib/projectValidation');
const { razorpayClient } = require('./paymentController');
function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}
function serializeDoc(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, created_at: toIso(data.created_at), completed_at: toIso(data.completed_at) };
}
async function listMine(req, res) {
  const snap = await db.collection('submissions').where('uid', '==', req.user.uid).get();
  res.json({ submissions: snap.docs.map(serializeDoc).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)) });
}
async function getMine(req, res) {
  const doc = await db.collection('submissions').doc(req.params.id).get();
  if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ message: 'Submission not found.' });
  res.json({ submission: serializeDoc(doc) });
}
function validSignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET || ![orderId, paymentId, signature].every(v => typeof v === 'string')) return false;
  if (!/^order_[\w-]+$/.test(orderId) || !/^pay_[\w-]+$/.test(paymentId) || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
async function finalizeCapturedOrder(orderId, paymentId, uid = null, verifiedPayment = null) {
  const orderRef = db.collection('payment_orders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw Object.assign(new Error('Payment order was not found.'), { code: 404 });
  const order = snap.data();
  if (uid && order.uid !== uid) throw Object.assign(new Error('Payment does not belong to this account.'), { code: 403 });
  if (order.status === 'submitted') return { submissionId: order.submissionId, projectId: order.projectId, alreadySubmitted: true, emailSent: null };
  const draft = order.draft;
  if (!draft || PACKAGE_PRICES[draft.editingPreferences] !== order.amount || draft.projectId !== order.projectId) {
    throw Object.assign(new Error('Payment package or order details do not match.'), { code: 400 });
  }
  const payment = verifiedPayment || await razorpayClient().payments.fetch(paymentId);
  if (payment.id !== paymentId || payment.order_id !== orderId || payment.status !== 'captured' ||
    payment.amount !== order.amount || payment.currency !== order.currency || order.currency !== 'INR') {
    throw Object.assign(new Error('Payment has not been captured for the correct amount.'), { code: 409 });
  }
  const ref = db.collection('submissions').doc();
  const submission = {
    uid: order.uid, name: draft.name, email: draft.email, mobile: draft.mobile,
    service: draft.service, editing_preferences: draft.editingPreferences, message: draft.message,
    files: draft.files, links: draft.links, file: draft.files[0]?.url || draft.links[0]?.url || '',
    project_id: draft.projectId, payment_id: paymentId, payment_order_id: orderId,
    amount_paid: order.amount, payment_status: 'completed', status: 'submitted',
    editing_status: 'pending', edited_files: [], admin_notes: '', completed_at: null,
    nda: draft.nda ? 'Requested NDA' : 'Not requested',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  };
  const result = await db.runTransaction(async transaction => {
    const fresh = await transaction.get(orderRef);
    if (!fresh.exists || fresh.data().uid !== order.uid) throw new Error('Payment order changed.');
    if (fresh.data().status === 'submitted') return { submissionId: fresh.data().submissionId, alreadySubmitted: true };
    transaction.set(ref, submission);
    transaction.update(orderRef, { status: 'submitted', paymentId, submissionId: ref.id,
      updated_at: admin.firestore.FieldValue.serverTimestamp() });
    return { submissionId: ref.id, alreadySubmitted: false };
  });
  // Email outages must never turn an already-saved, paid submission into an HTTP 500.
  const email = result.alreadySubmitted ? { sent: null } : await sendBrevoEmail({
    to: draft.email, subject: `Payment confirmed · ${draft.projectId} | SimpleNails`,
    htmlContent: projectConfirmation(draft, paymentId, order.amount)
  });
  return { ...result, projectId: order.projectId, emailSent: email.sent };
}
async function create(req, res) {
  const payment = req.body?.payment || {};
  const orderId = payment.razorpay_order_id;
  const paymentId = payment.razorpay_payment_id;
  if (!validSignature(orderId, paymentId, payment.razorpay_signature)) return res.status(400).json({ message: 'Payment signature verification failed.' });
  try {
    const result = await finalizeCapturedOrder(orderId, paymentId, req.user.uid);
    res.status(result.alreadySubmitted ? 200 : 201).json({ success: true, ...result });
  } catch (error) {
    console.error('Submission verification error:', error.message);
    res.status(error.code || 502).json({ message: error.code ? error.message : 'Unable to verify payment. Use Recover Payment instead of paying again.' });
  }
}
async function recover(req, res) {
  const orderId = req.body?.orderId;
  if (typeof orderId !== 'string' || !/^order_[\w-]{5,80}$/.test(orderId)) return res.status(400).json({ message: 'Invalid order reference.' });
  try {
    const doc = await db.collection('payment_orders').doc(orderId).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ message: 'No payment found for this account.' });
    if (doc.data().status === 'submitted') return res.json({ success: true, submissionId: doc.data().submissionId, projectId: doc.data().projectId, alreadySubmitted: true });
    const result = await razorpayClient().orders.fetchPayments(orderId);
    const captured = (result.items || []).find(p => p.order_id === orderId && p.status === 'captured' && p.amount === doc.data().amount && p.currency === 'INR');
    if (!captured) return res.status(409).json({ message: 'No captured payment is available for this order yet. Do not pay again if money was debited; check again shortly.' });
    const outcome = await finalizeCapturedOrder(orderId, captured.id, req.user.uid, captured);
    res.json({ success: true, ...outcome });
  } catch (error) {
    console.error('Payment recovery error:', error.message);
    res.status(error.code || 502).json({ message: error.code ? error.message : 'Payment status temporarily unavailable. Please retry recovery.' });
  }
}
async function razorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send('Webhook not configured');
  const signature = req.get('x-razorpay-signature') || '';
  const digest = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if (!/^[0-9a-f]{64}$/i.test(signature) || !crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'))) return res.status(401).send('Bad signature');
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) {
        try { await finalizeCapturedOrder(payment.order_id, payment.id, null, payment); }
        catch (error) { console.error('Webhook payment reconciliation:', error.message); return res.status(503).send('Retry later'); }
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) { console.error('Webhook parse error:', error.message); return res.status(400).send('Invalid event'); }
}
module.exports = { listMine, getMine, create, recover, razorpayWebhook, validSignature, finalizeCapturedOrder };
