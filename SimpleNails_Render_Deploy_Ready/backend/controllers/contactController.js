const { db, admin } = require('../config/firebase');
const { sendBrevoEmail } = require('../services/emailService');
async function createContact(req, res) {
  const { name, email, subject, message } = req.body || {};
  if (![name, email, subject, message].every(v => typeof v === 'string' && v.trim()) || name.length > 120 || email.length > 254 || subject.length > 200 || message.length > 5000) return res.status(400).json({ message: 'Please complete all contact fields.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  await db.collection('contact_messages').add({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), status: 'new', timestamp: admin.firestore.FieldValue.serverTimestamp() });
  const recipient = process.env.CONTACT_RECEIVER_EMAIL;
  const emailResult = recipient
    ? await sendBrevoEmail({ to: recipient, subject: `SimpleNails contact: ${subject}`, htmlContent: `<p><b>From:</b> ${escapeHtml(name)} (${escapeHtml(email)})</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` })
    : { sent: false, reason: 'CONTACT_RECEIVER_EMAIL is not configured on the server.' };
  res.status(201).json({ success: true, messageSaved: true, emailSent: emailResult.sent, emailReason: emailResult.sent ? null : emailResult.reason });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
module.exports = { createContact };
