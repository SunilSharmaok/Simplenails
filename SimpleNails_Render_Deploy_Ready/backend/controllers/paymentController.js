const Razorpay = require('razorpay');
const { db, admin } = require('../config/firebase');
const { PACKAGE_PRICES, validateProject } = require('../lib/projectValidation');
function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error('Payment gateway is not configured.');
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
async function createOrder(req, res) {
  let draft;
  try { draft = validateProject(req.body); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Payments are temporarily unavailable.' });
  try {
    const amount = PACKAGE_PRICES[draft.editingPreferences];
    const order = await razorpayClient().orders.create({ amount, currency: 'INR', receipt: draft.projectId.slice(0, 40), notes: { service: draft.service } });
    await db.collection('payment_orders').doc(order.id).set({
      uid: req.user.uid, projectId: draft.projectId, amount, currency: 'INR',
      editingPreferences: draft.editingPreferences, draft, status: 'created',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ orderId: order.id, amount, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Payment order error:', error.message);
    res.status(502).json({ message: 'Unable to start checkout. Please try again.' });
  }
}
module.exports = { createOrder, razorpayClient };
