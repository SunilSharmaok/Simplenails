# SimpleNails v2.0 — Improvements and verification

## Form and attachments

- Three-step wizard with validation, Back/Continue, a stable project ID, Review, and a secure Pay button.
- Up to **15 uploaded files**, each up to **10 MB**, with Uploadcare's *multiple* widget. Upload more batches without overwriting earlier selections.
- Up to **15 separate HTTPS links** (up to 20 attachments total), with optional titles, manual add, clipboard paste, duplicate checks and individual removal.
- Clear upload progress and errors. A customer cannot enter the payment step with no assets or unfinished uploads.
- Removable file/link rows, review list and accurate attachment counts. File/link metadata is stored with the submission, and visible in **My Submissions**.
- Removed inline event handlers from site HTML; active UI event handlers are registered in JavaScript, with a stricter `script-src-attr` CSP.

## Payment and account security

- Backend creates order from a fully validated draft, with **server-side** prices of ₹1/₹10/₹20 (100/1000/2000 paise).
- Firestore stores an authenticated, immutable draft against each Razorpay order prior to checkout.
- Checkout signature verified with HMAC; payment is then fetched from Razorpay and must be **captured**, with matching order ID, amount and currency.
- Idempotent Firestore transaction prevents a captured payment being used twice. Users can only recover/read their own orders/submissions.
- `/api/payments/recover` verifies an earlier captured payment without charging again. Client stores only order ID and account ID in sessionStorage (when available) to offer recovery.
- `/api/payments/webhook` verifies a Razorpay webhook HMAC using **RAZORPAY_WEBHOOK_SECRET**, and can finalize a captured payment if the browser closes before the success callback.
- Payment/order routes and contact requests have rate limits; external links are HTTPS-only and reject private/local hosts.
- Email failures no longer cause an already-saved submission to show an erroneous submission failure.

## Visual design

- Modern, accessible white/soft-green form surfaces, simplified three-step navigation, responsive attachments, focused payment disclosure, safer modal rendering, refined policy dialogs, Google login button and modern SweetAlert2 popups.
- Responsive mobile layouts; dashboard cards and detail modal escape untrusted text and use `noopener` for external links.
- Branded mobile-responsive HTML email design for payment confirmations and contact receipts, including server-side HTML escaping.

## What is not automatic

- Uploadcare retains uploaded file objects according to the settings of *your* Uploadcare account. Removing a file from the form **detaches it** from the project; it does **not** delete the remote Uploadcare object. Production sites should configure Uploadcare signed uploads, secure storage/retention and deletion procedures.
- Linked Google Drive/Dropbox files must grant the SimpleNails editor access. A valid URL is not proof it is publicly accessible or downloadable.
- Real Firebase sign-in, Uploadcare uploads, Razorpay captures/webhooks and Brevo delivery cannot be exercised without your configured external accounts and live/test credentials.

## Validation performed

- `npm test`: 8 automated Node tests — **passed** (draft validation, unsafe URLs, pricing, input validation, email escaping, signature verification, captured payment amount/ownership, idempotence, webhook authentication).
- Browser interaction simulation: **passed** (step navigation, two links, individual removal, one multi-uploader file, review counts and pricing, order draft/request, simulated checkout callback).
- JavaScript syntax checked. The external SDKs were mocked in the browser simulation, **not** tested against the real providers.

See `DEPLOY_RENDER.md` for deployment steps and required settings.
