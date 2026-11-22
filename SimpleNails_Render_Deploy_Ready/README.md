# SimpleNails v2 — Modern project studio (Express + Firebase + Razorpay + Uploadcare + Brevo)

This is the updated full-stack SimpleNails project, with a redesigned, responsive three-step submission flow, multiple removable uploads and links, safer Razorpay verification, recovery and webhook reconciliation, refreshed dialogs, and transactional email templates.

## Folder layout

- `frontend/` — static HTML/CSS/JS frontend; uses Firebase Auth, Uploadcare widget and Razorpay Checkout
- `backend/` — Express API with Firebase Admin, order tracking, payment reconciliation and Brevo emails
- `WHATS_NEW.md` — detailed change log and limitations
- `DEPLOY_RENDER.md` — one-host Render deployment walkthrough

## Local run

1. Extract this ZIP. In `backend/`, run `npm ci`.
2. Copy `backend/.env.example` to `backend/.env` and fill real Firebase Admin, Razorpay and Brevo details. **Never commit `.env`.**
3. Set `SERVE_FRONTEND=true` and `NODE_ENV=development` for a single local server.
4. Run `npm start` in `backend/` and open **http://localhost:5000**. `/api/health` should respond with `{ "ok": true }`.
5. In Firebase Console, enable Google sign-in and add `localhost` and your production hostname to the approved domains. In Firestore, create a database and grant your server account access.
6. Check the Uploadcare public key in `frontend/project.html` belongs to your verified project and supports the necessary file types and sizes.
7. Use Razorpay **test keys** and a **test payment**. Confirm the record appears in My Submissions, then check Brevo delivery using a verified sender.

In `backend/`, run `npm test` for automated offline logic tests.

## Deployment

**Recommended:** Render single web service; see `DEPLOY_RENDER.md`. Build `cd backend && npm ci`; start `cd backend && npm start`; environment `SERVE_FRONTEND=true`. This keeps the UI and `/api` on the same origin.

**Separate Netlify frontend:** Set `window.API_BASE_URL = 'https://YOUR-RENDER-DOMAIN.onrender.com/api'` before loading `js/api-client.js` (e.g. via a small frontend configuration script), set `FRONTEND_URL` to your Netlify site hostname in Render, and update CSP `connectSrc` to allow the API domain. The included default only works automatically for same-origin hosting or VS Code Live Server at localhost:5500.

## Firestore security

The browser uses Firebase **Auth only**, with data access through the backend. Firestore rules should normally deny direct client access to `users`, `payment_orders`, `submissions` and `contact_messages` — the backend Admin SDK authenticates and authorizes these requests:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Important safety and operational notes

- Prices are **₹1 Basic**, **₹10 Full**, **₹20 Custom** as shown in the UI. These are demo amounts; review them before taking real orders.
- Set `RAZORPAY_WEBHOOK_SECRET` in Render and configure a `payment.captured` webhook in Razorpay for `https://YOUR-DOMAIN/api/payments/webhook`.
- Set `BREVO_API_KEY`, verified `BREVO_SENDER_EMAIL`, and optionally `CONTACT_RECEIVER_EMAIL`; email errors never undo an otherwise successful payment or submission.
- Uploadcare file selection is *not* equivalent to remote deletion. Removing a file from a draft does not delete an already uploaded remote copy. Configure provider retention/deletion and signed uploads before production use.
- Cloud links must have appropriate sharing permissions. Sensitive documents require your own access controls, retention, and privacy review.
- Keep all server secrets in hosting environment variables; rotate any keys previously shared publicly.

See `WHATS_NEW.md` for test coverage and external-service limitations.
