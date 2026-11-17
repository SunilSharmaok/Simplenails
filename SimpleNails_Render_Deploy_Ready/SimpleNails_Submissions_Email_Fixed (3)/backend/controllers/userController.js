const { db, admin } = require('../config/firebase');

async function upsertMe(req, res) {
  const ref = db.collection('users').doc(req.user.uid);
  const existing = await ref.get();
  const data = {
    uid: req.user.uid,
    email: req.user.email || '',
    displayName: String(req.body.displayName || '').slice(0, 120),
    photoURL: String(req.body.photoURL || '').slice(0, 1000),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  };
  if (!existing.exists) data.created_at = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(data, { merge: true });
  res.json({ success: true });
}
module.exports = { upsertMe };
