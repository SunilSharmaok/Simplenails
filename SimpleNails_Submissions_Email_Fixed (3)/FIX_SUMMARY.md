# SimpleNails submissions + email fixes

## Fixed in this build

- Submission details: API `created_at` is an ISO date string; removed incorrect `.toDate()` call. Handles legacy timestamps and missing edited files, and escapes customer text in the details modal.
- Email: Brevo transport catches network failures and timeouts; logs status and provider error code without secrets. A failed email does not undo a saved contact message or a paid submission.
- Contact form: says `Message Saved` if Firestore succeeded but email did not; does not falsely report email delivery.
- Paid submission: success screen distinguishes project saved from confirmation email acceptance. The site owner also gets a notification at CONTACT_RECEIVER_EMAIL when a new paid project is submitted (unless it is the same as the customer email).

## Mandatory Render configuration

- NODE_ENV=production
- SERVE_FRONTEND=true
- FIREBASE_SERVICE_ACCOUNT_JSON=<new valid, secret Firebase Admin JSON>
- BREVO_API_KEY=<new, secret Brevo API key>
- BREVO_SENDER_EMAIL=<verified sender email on Brevo>
- BREVO_SENDER_NAME=SimpleNails
- CONTACT_RECEIVER_EMAIL=<address to receive contact form notifications>
- RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (matching new TEST keys while testing payments)

Never commit `.env` or credentials to GitHub. Previously shared Firebase Admin private keys, Brevo and Razorpay secrets MUST be rotated and revoked.

## Redeploy on Render

1. Replace frontend/script.js, backend/controllers/contactController.js, backend/controllers/submissionController.js, and backend/services/emailService.js in your GitHub repo. You can upload the whole safe project instead if easier. Preserve existing Render Environment settings and your repo folder structure.
2. Render > simplenails-web > Manual Deploy > Deploy latest commit.
3. Open `https://<YOUR-RENDER-HOST>/api/health`, sign in, open My Submissions, click View Details on an existing project.
4. Submit one new contact form. If it says `Message Saved`, the database worked but email was not accepted. Go to Render Logs, find `[Brevo]` lines and inspect Brevo > Transactional > Logs for delivery/bounces.
5. Check Brevo verified sender / domain and transactional service activation. HTTP/API acceptance does not guarantee inbox delivery.

Existing submissions are not deleted or changed; the View Details date parsing bug is in the frontend. Test payments only until prices and payment/webhook handling are verified.
