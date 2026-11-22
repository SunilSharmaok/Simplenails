# SimpleNails Studio — Modern UI and Functional Fixes

This upgrade was made from the ZIP `SimpleNails_Render_Deploy_Ready(2).zip`. It preserves the existing Firebase project, Uploadcare public key, Razorpay checkout and the separate Express / Firestore backend.

## Modern interface

- New studio-style homepage with responsive hero, interactive before/after *visual demo*, creative service cards, guided workflow, modern feature/pricing/FAQ sections and a prominent call-to-action.
- Shared refreshed navigation, consistent controls, modern dark styling and a persistently selectable light mode.
- Quick price estimator matching backend checkout prices: Basic ₹1, Full ₹10 and Custom ₹20 **per submitted project**. Selecting a plan or service on the homepage pre-fills the corresponding form selection.
- Better form spacing, mobile layout, accessible focus states, skip links, keyboard-accessible FAQ and navigation, offline notice, favicon and responsive WhatsApp help button.
- Project form remembers only package and service selections in browser **sessionStorage**. It does NOT save names, emails, personal contact details, file links or payment data across sessions.
- Project dashboard adds search, status filters, sort order, pagination, clearer project details and safer direct file links.
- Removed unsupported homepage success statistics, fragile software-logo marquee and obsolete FormSubmit branding.

The before/after slider is a color-adjustment **demo**, not an automatic editor and not a promise that this same photo was created by SimpleNails.

## Fixes and backend behavior

- Contact form: validates inputs, shows a submit state, displays readable errors, and clearly distinguishes a message stored in Firestore from an email notification successfully sent through Brevo.
- Email delivery exceptions no longer cause a contact request or completed paid project save to be reported as failed after storage.
- Submission details no longer call `.toDate()` on ISO dates, safely handle missing `edited_files`, and HTML-escape user/project text.
- Submission page hides previous account data after logout and displays a login prompt.
- An already-captured Razorpay payment can be retried to save a project **without starting a second payment** while the page remains open. The server recognizes repeat verified submissions for the same previously stored payment order.
- Express 4 async route errors are passed to the JSON error handler instead of becoming rejected unhandled promises.
- HTTPS-only file links are accepted by the project submission endpoint. Paste-URL now provides a manual fallback when clipboard permission is denied.
- Existing Firebase, Razorpay and Firestore security checks remain intact.

**Production note:** Razorpay webhooks, reconciliation and refund handling are still required for more complete payment recovery if the customer closes/reloads the browser after a successful charge but before storage. Do not launch live payments without end-to-end tests.

## Recommended deployment: one service on Render

1. Unzip. Upload the **contents** (not a parent wrapper folder) to GitHub. Keep `.env`, service-account JSON and private credentials OUT of Git.
2. Render → New Web Service → use repository root. Build command: `cd backend && npm ci`; Start command: `cd backend && npm start`.
3. In Render environment variables, set `SERVE_FRONTEND=true` and `NODE_ENV=production`.
4. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the matching Firebase Admin service account JSON in one line.
5. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` using **test keys first**.
6. For emails: set a valid `BREVO_API_KEY`, a *verified* `BREVO_SENDER_EMAIL`, and the intended `CONTACT_RECEIVER_EMAIL`. Optional: `BREVO_SENDER_NAME=SimpleNails`.
7. Firebase Console → Authentication → Settings → Authorized domains → add your Render domain, and ensure Google login is enabled.
8. Deploy and test `https://<your-render-domain>/api/health` (must return `{ "ok": true, ... }`), then visit the site and test the flows below.

**Deploying frontend separately to Netlify:** publish the `frontend` folder. Because the frontend and API are now on different origins, set `window.API_BASE_URL` to your live Render API URL in `frontend/js/api-client.js` (or inject it before that file), and set `FRONTEND_URL` in Render to your exact Netlify origin. The default is same-origin `/api` for single-host Render deployment.

## Browser test checklist after environment setup

- Home: service cards, interactive slider, package estimator, light/dark toggle, mobile navigation and WhatsApp help work.
- Sign in using Google on the hosted domain. If login fails, check the Firebase authorized domain.
- Choose a plan: project form pre-selects it; fill out name/email/mobile/service/instructions; upload a file using Uploadcare or provide a secure HTTPS link.
- Use Razorpay **test mode** to pay, then verify it appears under My Submissions. Refresh the page and check filters, sorting, details and logout privacy.
- Test the contact form and verify the message is in `contact_messages` in Firestore. Confirm notifications only if Brevo is configured with a valid key and verified sender.
- Test failed network/provider cases and make sure that payments are not charged again during save retries.

## Checks executed in the supplied archive

- `node --check` on all frontend/backend JavaScript — passed.
- `tinycss2` stylesheet parsing of both CSS files — no top-level parse errors.
- HTML parsing, duplicate-ID checks and internal resource link checks — passed for all 4 HTML pages.
- `node tests/smoke.js` — passed (page assets, package prices, contact email-unavailable case, duplicate paid-project recovery and network-failed email provider).

**Limits:** Firebase login, database persistence, Uploadcare, live/test Razorpay checkout and Brevo delivery cannot be verified without the owner's credentials and hosted services. A browser screenshot run also could not complete in the current container (Chromium stalls even on a blank test page). Review the live site visually on desktop and mobile before production rollout.

## Developer structure

- `frontend/style.css` = original site stylesheet.
- `frontend/modern.css` = later-loaded modern design overrides, responsive styles and light theme.
- `frontend/script.js` = original app with relevant integration fixes.
- `frontend/js/modern.js` = progressive UI functions, dashboard and accessibility.
- `backend/` = Express API, Firebase Admin, Razorpay and Brevo email.
- `tests/smoke.js` = no-dependencies smoke test. Run `node tests/smoke.js` from the root.
