// A successful Brevo API call means accepted for sending, not inbox delivery.
// Keep provider credentials only on the server; never expose them in responses.
async function sendBrevoEmail({ to, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.warn('[Brevo] Email not attempted: BREVO_API_KEY or BREVO_SENDER_EMAIL is missing.');
    return { sent: false, reason: 'Email service is not configured on the server.' };
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'SimpleNails', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: to }], subject, htmlContent
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      // Logging only HTTP status and the provider's error code avoids printing
      // message body, API keys, and customer-provided message content.
      const responseBody = await response.json().catch(() => ({}));
      const providerCode = typeof responseBody.code === 'string' ? responseBody.code.slice(0, 80) : 'unknown';
      console.error(`[Brevo] Rejected email: HTTP ${response.status}, code: ${providerCode}`);
      return { sent: false, reason: 'Email provider rejected the request. Verify the Brevo API key, verified sender, and transactional account status.' };
    }
    console.info('[Brevo] Email accepted for sending. Check Brevo transactional logs for actual delivery.');
    return { sent: true };
  } catch (err) {
    console.error(`[Brevo] Email request failed: ${err.name === 'TimeoutError' ? 'timeout' : 'network error'}`);
    return { sent: false, reason: 'Email provider could not be reached. Check the Render service logs.' };
  }
}
module.exports = { sendBrevoEmail };
