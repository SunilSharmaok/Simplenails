# SimpleNails — Original Design + File Upload Fix

This release starts from **SimpleNails_Render_Deploy_Ready(3).zip** and preserves the original website design (original navigation, homepage, project wizard, CSS, colors, cards, popups, and submission listing). It is **not** the v2 UI redesign.

## What changed

- In `frontend/project.html`, the legacy Uploadcare widget input was replaced with a native multiple-file selector in the **same From Device card**. The old widget bundle has been removed.
- Added `frontend/js/upload-fix.js`: directly uploads selected files to Uploadcare Upload API, one at a time, and only marks each file uploaded after Uploadcare returns a valid UUID. Supports additional batches, removing individual files, up to 15 uploads, per-file 10 MB limit, and readable errors.
- The existing **From URL** card retains the Paste URL button, with a manual Add link input as a fallback when browsers reject clipboard permissions.
- The same original three-step form is used. Step 2 blocks continuing during a pending upload and requires at least one uploaded file or link. The review counts both. Payment order draft contains **all attachments**, and the secure backend stores them in `submissions.files` / `submissions.links`.
- Kept the original `frontend/style.css` and added only small uploader-specific styles to its end.
- Original `frontend/script.js` is unchanged except for making ISO submission timestamps readable and showing **all** attached files and links in the original project-details popup.
- Retained the secure v2 backend's payment verification, order ownership checks, idempotency, confirmation email templates, and webhook handling; restored its CSP `script-src-attr` directive to allow the original site's existing inline event handlers.

## Deploy on Render

1. Extract this ZIP and commit **its contents** to the original GitHub repository (keeping the frontend and backend folder structure).
2. Deploy the backend from `backend/`; when using a single Render web service, set `SERVE_FRONTEND=true`. Read `DEPLOY_RENDER.md` for all other backend environment variables, webhook instructions, and production checks.
3. Confirm that `frontend/project.html` loads `js/upload-fix.js`. Make sure browsers receive the latest JS and CSS; do a hard refresh after deploying.
4. Sign in, select Step 1, upload 2 small **image** files under the From Device card, verify each displays in Selected Files, remove one, add another, then continue to Step 3. Use Razorpay **test mode** before attempting a live payment.
5. In the dashboard verify that the project details popup lists all uploaded items.

## Uploadcare configuration

- The existing public key `8665543ec9cdde66b778` is preserved on the file input in `frontend/project.html`. Check it matches the **Public API key** in your Uploadcare project. Never put your private/secret key in frontend files.
- This direct uploader uses `https://upload.uploadcare.com/base/`; make sure your Uploadcare project permits browser uploads from your site's origin. If **signed uploads** are enabled for the account, a backend token endpoint is required; unsigned browser requests will be rejected. In that case configure signed uploads before publishing.
- For older Uploadcare accounts, the CDN host is often `ucarecdn.com`. Newer accounts use a project-specific `*.ucarecd.net` host. If your uploads succeed but the View link does not load, open your Uploadcare project **Settings → Delivery → CDN domain names** and set the hostname at the `SN_CDN_BASE` constant in `frontend/js/upload-fix.js`, e.g. `https://your-project.ucarecd.net/`.
- Uploadcare's Free plan may restrict non-image uploads (PDFs etc.). If image upload succeeds but PDF upload fails, check the Uploadcare account's file-type restrictions and billing/KYC settings. The form will display the error returned by Uploadcare.
- Removing an entry in the form detaches it from this project; it does **not** delete the object from Uploadcare's storage. Server-side deletion requires secret-key authorization and should not be exposed to browsers.

## Tests

Run without external accounts:

```bash
node --test frontend/tests/upload-fix.test.js
cd backend && node --test tests/*.test.js
```

The frontend mock tests cover multiple successful uploads, oversize rejection, removing one file, and cloud-link handling. Backend tests cover payment security, validation, attachments, and confirmation emails. **Real live uploads and payments are not included in these automated tests** and must be verified with your own provider account.
