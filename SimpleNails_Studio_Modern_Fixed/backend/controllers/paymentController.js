const Razorpay = require('razorpay');
const { db, admin } = require('../config/firebase');

const priceFor = (editingPreferences) => {
  const value = String(editingPreferences || '').toLowerCase();
  if (value.includes('basic')) return 100;
  if (value.includes('full')) return 1000;
  if (value.includes('custom')) return 2000;
  throw new Error('Choose a valid editing package before payment.');
};
async function createOrder(req, res) {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Payment gateway is not configured on the server.' });
    const { projectId, editingPreferences } = req.body || {};
    if (!projectId || String(projectId).length > 100) return res.status(400).json({ message: 'Invalid project ID.' });
    const amount = priceFor(editingPreferences);
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: String(projectId).slice(0, 40) });
    await db.collection('payment_orders').doc(order.id).set({ uid: req.user.uid, projectId, amount, currency: 'INR', status: 'created', created_at: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) { res.status(400).json({ message: error.message || 'Unable to create payment order.' }); }
}
module.exports = { createOrder };
