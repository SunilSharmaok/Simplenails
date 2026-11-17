# SimpleNails — Render deployment (single service)

This package contains the Firebase/Google-login CSP fix from the previous version and two changes for single-host deployment:
- `frontend/js/api-client.js` uses same-origin `/api` in production (no localhost URL).
- `backend/server.js` skips cross-origin middleware when `SERVE_FRONTEND=true`. Cross-origin access is unnecessary for the frontend hosted by the same Express app.

## 1. GitHub
Create a NEW repository on GitHub (private recommended). Do not upload any `.env`, service-account private JSON, API secrets, or node_modules. Extract the ZIP and upload the CONTENTS of this folder to the repository root. The repository root must contain `frontend/` and `backend/` side by side, NOT an extra wrapper directory.

## 2. Render
Dashboard > New > Web Service > connect the GitHub repo.

- Language: Node
- Branch: main
- Root Directory: [leave empty] (important: frontend/ is next to backend/)
- Build Command: `cd backend && npm ci`
- Start Command: `cd backend && npm start`
- Free instance for demo (subject to sleep after inactivity)
- Health Check Path (if offered): `/api/health`

## 3. Environment (Render dashboard, NEVER GitHub)
Set these keys:

- `SERVE_FRONTEND` = `true`
- `NODE_ENV` = `production`
- `FIREBASE_SERVICE_ACCOUNT_JSON` = the real one-line service account JSON from your existing working backend `.env` (a PRIVATE credential; never commit or share)
- `RAZORPAY_KEY_ID` = test key id initially
- `RAZORPAY_KEY_SECRET` = corresponding test secret initially
- `BREVO_API_KEY` = if emails are used, the rotated key
- `BREVO_SENDER_EMAIL` = verified sender
- `BREVO_SENDER_NAME` = `SimpleNails`
- `CONTACT_RECEIVER_EMAIL` = the recipient

Do not manually set `PORT`; Render supplies it. `FRONTEND_URL` isn't needed when serving frontend and backend from the same origin; set it if you later deploy the frontend separately.

## 4. Deploy and Firebase auth
After Render reports successful deploy, get your URL like `https://your-site.onrender.com`.
Firebase Console > Authentication > Settings > Authorized domains > Add domain: `your-site.onrender.com` (no https://, no slash, no port).
Ensure Authentication > Sign-in method > Google is enabled.
Check `https://your-site.onrender.com/api/health` and then homepage, Google sign-in, contact form, submission and test payment.

## 5. Important
- Firebase Admin credentials must match the project configured in `frontend/script.js`.
- Firestore database must be created and accessible to service account.
- Brevo sender must be verified for emails to send.
- Do NOT use Razorpay live keys until testing is done; verify prices and configure webhooks before taking real payments.
- Render Free may sleep when idle. Use paid hosting for customer-facing production when reliable response times matter.
- If uploaded to a public repo accidentally, rotate exposed secrets immediately. This package deliberately excludes `.env`.
