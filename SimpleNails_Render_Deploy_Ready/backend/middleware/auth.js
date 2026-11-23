const { admin } = require('../config/firebase');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required.' });
    const decoded = await admin.auth().verifyIdToken(header.slice(7));
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired login session.' });
  }
}
module.exports = { requireAuth };
