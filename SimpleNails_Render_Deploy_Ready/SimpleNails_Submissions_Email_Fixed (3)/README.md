# SimpleNails — separated frontend and backend

The original HTML/CSS design and UI interactions are retained. Browser-side JavaScript handles presentation, Google sign-in and Uploadcare's upload widget. All Firestore reads/writes, Firebase token verification, Razorpay order creation/signature verification, and transactional email delivery are handled by the Express API.

## Project layout

- `frontend/` — static website (Netlify-ready)
- `backend/` — Node.js + Express REST API

## 1. Firebase setup

1. In Firebase Console, enable Google as a sign-in provider.
2. Create a Firebase Admin service account: Project settings → Service accounts → Generate new private key.
3. Put the service account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` in the backend environment as a single-line JSON value, or configure `GOOGLE_APPLICATION_CREDENTIALS` on your server.
4. Do not put the Admin SDK key in `frontend/` or commit it.
5. Configure Firestore Security Rules to deny direct client writes/reads to collections now served by the API. The Admin SDK bypasses Firestore rules, so API authorization is enforced by Firebase ID-token verification and per-user ownership checks.

Suggested starting rules (adjust if you intentionally have other client-side Firestore features):

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill `.env` with Firebase Admin credentials, Razorpay keys and the correct frontend origin. For local development:

```bash
npm run dev
```

The API runs at `http://localhost:5000`; check `http://localhost:5000/api/health`.

For a local static frontend, serve `frontend/` with a static server such as VS Code Live Server at `http://localhost:5500` and keep `FRONTEND_URL=http://localhost:5500`.

## 3. Frontend setup

`frontend/js/api-client.js` defaults to `http://localhost:5000/api`. Before deployment, change `window.API_BASE_URL` to your deployed backend URL, for example `https://your-api.onrender.com/api`.

Deploy the contents of `frontend/` to Netlify. Set the backend `FRONTEND_URL` to your exact Netlify domain (comma-separate production and preview origins if needed).

## 4. Razorpay

The backend creates an order using server-side package pricing (currently matching the original UI's values: Basic ₹1, Full ₹10, Custom ₹20). The frontend opens Razorpay Checkout using the public Key ID returned by the backend. The backend verifies the checkout signature before saving a submission. Confirm these prices are intentional in `backend/controllers/paymentController.js` before accepting live payments. Test with Razorpay test keys first.

## 5. Email

Set a newly generated Brevo API key in `BREVO_API_KEY`, a verified sender in `BREVO_SENDER_EMAIL`, and your receiving address in `CONTACT_RECEIVER_EMAIL`. Email delivery is optional and does not undo a verified project submission if the provider is unavailable.

## Important security actions

- Rotate the Brevo API key that was present in the original `script.js` immediately.
- The original Razorpay Key ID was exposed in browser code; Key IDs are public identifiers, but replace it with the key returned by the backend. If a Razorpay Key Secret was ever exposed, rotate it immediately.
- Never commit `.env`, service-account JSON, or private API keys.
- Restrict Uploadcare settings to your account's allowed origins and configure upload limits. This implementation retains the existing Uploadcare browser widget; file URLs are stored with the submission.
- Configure Razorpay webhooks and reconciliation for production-grade payment recovery. Checkout signature verification is implemented, but a webhook is recommended for cases where the browser closes after payment.

## API endpoints

- `POST /api/users/me` — authenticated user profile upsert
- `POST /api/payments/create-order` — authenticated Razorpay order creation
- `POST /api/submissions` — authenticated submission + payment signature verification
- `GET /api/submissions` — list only the signed-in user's submissions
- `GET /api/submissions/:id` — fetch only the signed-in user's submission
- `POST /api/contact` — contact form storage and optional notification email

## 6. Deployment notes

- **Netlify:** connect the repository and use the included `netlify.toml` (publish directory `frontend`). Update `window.API_BASE_URL` in `frontend/js/api-client.js` to the live API URL.
- **Render/Railway/Fly.io:** deploy the `backend/` directory as a Node web service. Build command: `npm install`; start command: `npm start`. Add every variable from `backend/.env.example` in the provider's environment settings. Do not upload `.env` to Git.
- Set `FRONTEND_URL` to the exact production Netlify origin, e.g. `https://your-site.netlify.app` (no trailing slash).
- Keep Razorpay in test mode until a successful test order and captured payment have been confirmed end-to-end.
