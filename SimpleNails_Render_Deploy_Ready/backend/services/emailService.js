const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function layout({ eyebrow = 'SIMPLENAILS STUDIO', title, intro, content, footer = 'Questions? Reply to this email and our team will help.' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f3f5fa;font-family:Arial,Helvetica,sans-serif;color:#1b2540;">
  <div style="display:none;font-size:1px;color:#f3f5fa;line-height:1px;max-height:0;opacity:0;overflow:hidden;">${escapeHtml(intro)}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#f3f5fa;padding:36px 12px;"><tr><td align="center">
  <table role="presentation" cellspacing="0" cellpadding="0" width="560" style="width:100%;max-width:560px;border:1px solid #e6eaf2;background:white;border-radius:20px;overflow:hidden;">
  <tr><td style="background:#121c36;padding:28px 36px;"><span style="font-size:22px;font-weight:800;letter-spacing:-0.8px;color:#fff;">simple<span style="color:#69e2c3;">nails.</span></span><div style="font-size:10px;letter-spacing:2px;color:#b7c2d9;margin-top:8px;">CREATIVE EDITING STUDIO</div></td></tr>
  <tr><td style="padding:36px;"><div style="color:#347d71;font-size:11px;font-weight:800;letter-spacing:1.7px;">${escapeHtml(eyebrow)}</div>
  <h1 style="margin:14px 0;font-size:29px;line-height:1.2;letter-spacing:-1px;color:#16213e;">${escapeHtml(title)}</h1>
  <p style="color:#56617a;font-size:15px;line-height:1.7;margin:0 0 22px;">${escapeHtml(intro)}</p>${content}
  <p style="font-size:13px;line-height:1.7;color:#657087;margin-top:28px;">${escapeHtml(footer)}</p></td></tr>
  <tr><td style="padding:22px 36px;border-top:1px solid #ebedf3;background:#fbfcfe;color:#8790a2;font-size:12px;line-height:1.7;">SimpleNails · Editing made effortless<br>This is an automated project update. Never share payment PINs or OTPs over email.</td></tr>
  </table></td></tr></table></body></html>`;
}
function row(label, value) {
  return `<tr><td style="color:#67748b;padding:10px 0;border-bottom:1px solid #ebeff5;font-size:13px;">${escapeHtml(label)}</td><td style="text-align:right;color:#1b2540;font-weight:700;padding:10px 0;border-bottom:1px solid #ebeff5;font-size:13px;">${escapeHtml(value)}</td></tr>`;
}
function projectConfirmation(project, paymentId, amount) {
  const attachmentCount = project.files.length + project.links.length;
  return layout({ eyebrow: 'PAYMENT CONFIRMED · PROJECT RECEIVED', title: `You're all set, ${project.name.split(/\s+/)[0]}!`,
    intro: 'Your payment was verified and your project is in our queue. We will keep you posted on the next steps.',
    content: `<div style="background:#eefaf6;border:1px solid #c8e9dc;color:#216957;border-radius:12px;padding:14px 17px;font-weight:700;font-size:14px;">✓ Secure payment received</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:21px;">${row('Project ID', project.projectId)}${row('Service', project.service)}${row('Package', project.editingPreferences)}${row('Files and links', String(attachmentCount))}${row('Amount paid', '₹' + (amount / 100).toFixed(2))}${row('Payment reference', paymentId)}</table>
    <p style="font-size:14px;color:#4e5d74;line-height:1.7;margin-top:24px;">Your project will appear under <strong>My Submissions</strong> when you sign in with the same Google account.</p>` });
}
function contactReceipt({ name, subject }) {
  return layout({ eyebrow: 'MESSAGE RECEIVED', title: `Thanks for writing, ${name.split(/\s+/)[0]}!`,
    intro: 'Your message has been saved. Our team will review it and respond when possible.',
    content: `<div style="border:1px solid #e7ebf2;border-radius:12px;padding:18px;"><div style="font-size:12px;color:#738099;">YOUR SUBJECT</div><div style="font-size:16px;color:#22304c;font-weight:700;padding-top:7px;">${escapeHtml(subject)}</div></div>` });
}
async function sendBrevoEmail({ to, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.warn('Transactional email skipped: Brevo credentials or verified sender not configured.');
    return { sent: false, reason: 'Email service not configured.' };
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { name: process.env.BREVO_SENDER_NAME || 'SimpleNails', email: process.env.BREVO_SENDER_EMAIL }, to: [{ email: to }], subject, htmlContent })
    });
    if (!response.ok) {
      console.error('Brevo delivery rejected:', response.status, (await response.text()).slice(0, 300));
      return { sent: false, reason: 'Email provider rejected the message.' };
    }
    return { sent: true };
  } catch (error) {
    console.error('Brevo delivery unavailable:', error.message);
    return { sent: false, reason: 'Email service temporarily unavailable.' };
  }
}
module.exports = { sendBrevoEmail, projectConfirmation, contactReceipt, layout, escapeHtml };
