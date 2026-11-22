const { db, admin } = require('../config/firebase');
const { sendBrevoEmail, contactReceipt, escapeHtml, layout } = require('../services/emailService');
async function createContact(req, res) {
  const { name, email, subject, message } = req.body || {};
  if (![name, email, subject, message].every(v => typeof v === 'string' && v.trim()) || name.length > 120 || email.length > 254 || subject.length > 200 || message.length > 5000) return res.status(400).json({ message: 'Please complete all contact fields.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  try {
    await db.collection('contact_messages').add({ name: name.trim(), email: email.trim().toLowerCase(), subject: subject.trim(), message: message.trim(), status: 'new', timestamp: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) { console.error('Contact save error:', error.message); return res.status(503).json({ message: 'Unable to save your message. Please retry.' }); }
  const result = await sendBrevoEmail({ to: email.trim(), subject: `We received your message | SimpleNails`, htmlContent: contactReceipt({ name: name.trim(), subject: subject.trim() }) });
  if (process.env.CONTACT_RECEIVER_EMAIL) {
    await sendBrevoEmail({ to: process.env.CONTACT_RECEIVER_EMAIL, subject: `New SimpleNails enquiry: ${subject.slice(0, 120)}`,
      htmlContent: layout({ eyebrow: 'NEW CONTACT ENQUIRY', title: 'New message received', intro: `${name} · ${email}`,
        content: `<div style="white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fb;padding:18px;border-radius:12px;color:#38465e;">${escapeHtml(subject)}\n\n${escapeHtml(message)}</div>` }) });
  }
  res.status(201).json({ success: true, emailSent: result.sent });
}
module.exports = { createContact };
