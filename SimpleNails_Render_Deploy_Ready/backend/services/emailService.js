async function sendBrevoEmail({ to, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.warn('Email not sent: BREVO_API_KEY / BREVO_SENDER_EMAIL not configured.');
    return { sent: false, reason: 'Email service is not configured.' };
  }
  try {
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
  } catch (error) {
    // Never turn a successfully stored paid project/contact into a 500 due to notification failure.
    console.error('Email delivery exception:', error.message);
    return { sent: false, reason: 'Email service is temporarily unavailable.' };
  }
}
module.exports = { sendBrevoEmail };
