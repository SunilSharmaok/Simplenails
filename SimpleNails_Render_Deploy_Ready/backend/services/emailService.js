async function sendBrevoEmail({ to, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.warn('Email not sent: BREVO_API_KEY / BREVO_SENDER_EMAIL not configured.');
    return { sent: false, reason: 'Email service is not configured.' };
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || 'SimpleNails', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to }], subject, htmlContent
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Brevo email error:', detail);
    return { sent: false, reason: 'Email provider rejected the message.' };
  }
  return { sent: true };
}
module.exports = { sendBrevoEmail };
