const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const crypto = require('crypto');
const orderId = 'order_demoabc001', paymentId = 'pay_demoabc001';
const draft = {
  projectId: 'SN-DEMO-12345678', name: 'Jane Smith', email: 'jane@example.com', mobile: '9876543210',
  service: 'Photo Editing', editingPreferences: 'Basic - Light edits', message: 'Retouch my photo',
  files: [{ url: 'https://ucarecdn.com/11111111-2222-4333-8444-555555555555/', name: 'photo.png', size: 100 }],
  links: [], nda: false, termsAccepted: true
};
const maps = { payment_orders: new Map(), submissions: new Map() };
maps.payment_orders.set(orderId, { uid: 'uid_jane', projectId: draft.projectId, amount: 100,
  currency: 'INR', status: 'created', draft });
let nextId = 0;
const db = {
  collection(name) {
    const map = maps[name];
    return {
      doc(id = 'sub_' + (++nextId)) {
        const ref = { id,
          async get() { return { exists: map.has(id), data: () => map.get(id), id, ref }; },
          async set(value) { map.set(id, value); },
          async update(value) { map.set(id, { ...map.get(id), ...value }); }
        };
        return ref;
      }
    };
  },
  async runTransaction(fn) {
    return await fn({
      get: ref => ref.get(),
      set: (ref, value) => { maps.submissions.set(ref.id, value); },
      update: (ref, value) => { maps.payment_orders.set(ref.id, { ...maps.payment_orders.get(ref.id), ...value }); }
    });
  }
};
let remoteAmount = 100;
class FakeRazorpay {
  constructor() { this.payments = { fetch: async (id) => ({ id, order_id: orderId, amount: remoteAmount, status: 'captured', currency: 'INR' }) }; }
}
const previousLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'razorpay') return FakeRazorpay;
  if (name === '../config/firebase') return { db, admin: { firestore: { FieldValue: { serverTimestamp: () => new Date() } } } };
  return previousLoad.apply(this, arguments);
};
process.env.RAZORPAY_KEY_ID = 'rzp_test_only';
process.env.RAZORPAY_KEY_SECRET = 'only_test_secret';
const submissionController = require('../controllers/submissionController');
Module._load = previousLoad;
test('payment: ownership and captured amount enforced, then submission is idempotent', async () => {
  await assert.rejects(() => submissionController.finalizeCapturedOrder(orderId, paymentId, 'uid_other'), /does not belong/);
  remoteAmount = 900;
  await assert.rejects(() => submissionController.finalizeCapturedOrder(orderId, paymentId, 'uid_jane'), /not been captured/);
  assert.equal(maps.submissions.size, 0);
  remoteAmount = 100;
  const first = await submissionController.finalizeCapturedOrder(orderId, paymentId, 'uid_jane');
  assert.equal(first.alreadySubmitted, false);
  assert.equal(maps.submissions.size, 1);
  assert.equal(maps.payment_orders.get(orderId).status, 'submitted');
  const again = await submissionController.finalizeCapturedOrder(orderId, paymentId, 'uid_jane');
  assert.equal(again.alreadySubmitted, true);
  assert.equal(again.submissionId, first.submissionId);
  assert.equal(maps.submissions.size, 1);
});
test('webhook: HMAC signature required', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-test-secret';
  const body = Buffer.from(JSON.stringify({ event: 'unrelated.event' }));
  let status = null;
  const makeRes = () => ({ status(n) { status=n; return this; }, send() {return this;}, json() {return this;} });
  await submissionController.razorpayWebhook({ body, get() { return '0'.repeat(64); } }, makeRes());
  assert.equal(status, 401);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  await submissionController.razorpayWebhook({ body, get() { return signature; } }, makeRes());
  assert.equal(status, 200);
});
