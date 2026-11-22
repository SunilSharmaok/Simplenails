const router = require('express').Router();
// Express 4 does not automatically forward rejected async handlers to error middleware.
const safe = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const { requireAuth } = require('../middleware/auth');
const { upsertMe } = require('../controllers/userController');
const submissions = require('../controllers/submissionController');
const payments = require('../controllers/paymentController');
const contact = require('../controllers/contactController');
router.post('/users/me', requireAuth, safe(upsertMe));
router.post('/payments/create-order', requireAuth, safe(payments.createOrder));
router.post('/submissions', requireAuth, safe(submissions.create));
router.get('/submissions', requireAuth, safe(submissions.listMine));
router.get('/submissions/:id', requireAuth, safe(submissions.getMine));
router.post('/contact', safe(contact.createContact));
module.exports = router;
