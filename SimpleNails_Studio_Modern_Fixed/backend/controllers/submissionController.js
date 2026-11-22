const crypto = require('crypto');
const { db, admin } = require('../config/firebase');
const { sendBrevoEmail } = require('../services/emailService');
const Razorpay = require('razorpay');

function toIso(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}
function serializeDoc(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, created_at: toIso(data.created_at), completed_at: toIso(data.completed_at) };
}
function validText(value, max = 2000) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }

async function listMine(req, res) {
  const snap = await db.collection('submissions').where('uid', '==', req.user.uid).get();
  const submissions = snap.docs.map(serializeDoc).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  res.json({ submissions });
}
async function getMine(req, res) {
  const doc = await db.collection('submissions').doc(req.params.id).get();
  if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ message: 'Submission not found.' });
  res.json({ submission: serializeDoc(doc) });
}
async function create(req, res) {
  const { projectId, name, email, mobile, service, editingPreferences, message, fileUrl, payment } = req.body || {};
  if (![projectId, name, email, mobile, service, editingPreferences, message, fileUrl].every(v => validText(String(v || ''), 3000))) {
    return res.status(400).json({ message: 'Please provide all required project details and an uploaded file.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{10}$/.test(mobile)) return res.status(400).json({ message: 'Please provide a valid email and 10-digit mobile number.' });
  try { if (new URL(fileUrl).protocol !== 'https:') throw new Error(); } catch { return res.status(400).json({ message: 'Please provide a secure HTTPS file URL.' }); }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payment || {};
  if (!orderId || !paymentId || !signature) return res.status(400).json({ message: 'Payment verification details are missing.' });
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(String(signature));
  if (!process.env.RAZORPAY_KEY_SECRET || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: 'Payment signature verification failed.' });
  const orderSnap = await db.collection('payment_orders').doc(orderId).get();
  if (!orderSnap.exists) return res.status(400).json({ message: 'Payment order was not created by this application.' });
  const order = orderSnap.data();
  if (order.uid !== req.user.uid || order.projectId !== projectId) return res.status(400).json({ message: 'Payment order does not belong to this project.' });
  if (order.status === 'submitted') {
    if (order.paymentId === paymentId && order.submissionId) {
      return res.json({ success: true, submissionId: order.submissionId, projectId, recovered: true, emailSent: false });
    }
    return res.status(400).json({ message: 'Payment order is already used.' });
  }
  // Confirm the payment exists, belongs to this order, and has been captured for the exact server-calculated amount.
  const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const verifiedPayment = await razorpay.payments.fetch(paymentId);
  if (verifiedPayment.order_id !== orderId || verifiedPayment.amount !== order.amount || verifiedPayment.currency !== order.currency || verifiedPayment.status !== 'captured') {
    return res.status(400).json({ message: 'Payment is not captured or does not match the order amount.' });
  }
  const ref = db.collection('submissions').doc();
  const submission = {
    uid: req.user.uid, name: name.trim(), email: email.trim(), mobile: mobile.trim(),
    service: service.trim(), editing_preferences: editingPreferences.trim(), message: message.trim(),
    file: fileUrl.trim(), project_id: projectId.trim(), payment_id: paymentId,
    payment_order_id: orderId, payment_status: 'completed', status: 'submitted',
    editing_status: 'pending', edited_files: [], admin_notes: '', completed_at: null,
    nda: 'Not requested', created_at: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.runTransaction(async transaction => {
    const freshOrder = await transaction.get(orderSnap.ref);
    if (!freshOrder.exists || freshOrder.data().status === 'submitted' || freshOrder.data().uid !== req.user.uid) {
      throw new Error('This payment order has already been used or is invalid.');
    }
    transaction.set(ref, submission);
    transaction.update(orderSnap.ref, { status: 'submitted', paymentId, submissionId: ref.id, updated_at: admin.firestore.FieldValue.serverTimestamp() });
  });
  const emailResult = await sendBrevoEmail({
    to: email.trim(), subject: `Project #${projectId} Confirmation - SimpleNails`,
    htmlContent: `<h2>Thank you for choosing SimpleNails, ${escapeHtml(name)}!</h2><p>Your project and payment have been received.</p><p><b>Project ID:</b> ${escapeHtml(projectId)}</p><p><b>Service:</b> ${escapeHtml(service)}</p><p><b>Editing level:</b> ${escapeHtml(editingPreferences)}</p><p>You can track your project in your SimpleNails submissions dashboard.</p>`
  });
  res.status(201).json({ success: true, submissionId: ref.id, projectId, emailSent: emailResult.sent });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
module.exports = { listMine, getMine, create };
