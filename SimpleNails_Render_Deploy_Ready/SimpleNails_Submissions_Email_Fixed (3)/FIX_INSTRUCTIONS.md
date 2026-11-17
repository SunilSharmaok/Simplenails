# CSP Fix Added — 16 November 2026

The browser console showed that Firebase popup authentication was unable to load
`https://apis.google.com/js/api.js` because Helmet's `script-src` blocked it.
In `backend/server.js`, added `https://apis.google.com` to the `scriptSrc`
allowlist. Also allowed it and `https://www.gstatic.com` under `connectSrc`
(the latter quiets optional Firebase source-map debugging warnings).

**Fastest way to fix your currently running project:** copy just the `backend/server.js`
file from this ZIP over the `backend/server.js` file in your current working
project. Since you are running nodemon, saving `server.js` should restart it.
You do NOT need to reinstall packages, recopy `.env`, or extract the full project.
Open `http://localhost:5000`, press Ctrl+Shift+R, and retry Google sign-in.

If Google login still fails after CSP stops blocking the API script, check
Firebase Console > Authentication > Sign-in method > Google (Enabled), and
Authentication > Settings > Authorized domains (`localhost`). The browser's
Tracking Prevention messages, blocked source maps, and missing favicon are
not necessarily the cause of Google authentication failure.

---

# SimpleNails Google Login Fix — Windows Steps

## What's changed
- Firebase's Google sign-in errors are now shown with their real error codes.
- A backend `/api/users/me` request failing no longer incorrectly displays "Failed to sign in with Google."
- Backend Helmet now sets `Cross-Origin-Opener-Policy: same-origin-allow-popups`, compatible with Firebase popup login.
- **No private keys are included** in this ZIP. The original `.env` file was deliberately excluded.

## Run locally (PowerShell)
1. Extract this ZIP.
2. Copy `backend/.env` from YOUR ORIGINAL `SimpleNails_configured_with_keys` folder into the NEW `SimpleNails_Google_Login_Fix/backend` folder. Do not share your `.env` or any service-account private key.
3. Open PowerShell in `SimpleNails_Google_Login_Fix/backend` and run:

   ```powershell
   npm install
   npm run dev
   ```

4. Visit **http://localhost:5000**. Use this exact address for testing. Don't open `frontend/contact.html` as a `file:///` URL.
5. Visit **http://localhost:5000/api/health** to test backend: it should return JSON containing `"ok":true`.
6. In Firebase Console, open your project `simplenails-editingweb` > Authentication > Sign-in method > Google (must be Enabled).
7. In Authentication > Settings > Authorized domains, add `localhost` (without port) if missing. If testing from `127.0.0.1`, authorize that domain if applicable or use `localhost` instead. For deployment, add the real site hostname.
8. If login fails, press F12 > Console and read the new **Google Sign-In Failed** popup. It now includes a specific Firebase error code (e.g., `auth/unauthorized-domain`).

## Important
- A browser console error stating `script-src 'self'` for `https://www.gstatic.com/firebasejs/...` means Firebase scripts are being blocked by a Content Security Policy. The `backend/server.js` in this ZIP explicitly allows `https://www.gstatic.com`. If you still see an only-`'self'` script policy, you may be viewing the website using a different server or proxy, or an old/cached response. Reload at `http://localhost:5000` and inspect the Network tab response headers for the actual Content-Security-Policy.
- When using Live Server at `http://localhost:5500`, backend API still needs to be running at `http://localhost:5000`.
- Google Auth provider settings, authorized domains and a live connection to Google must be configured in Firebase Console. These cannot be verified from the ZIP alone.
- Please rotate your Firebase Admin service-account private key, Razorpay secret, and Brevo API key if the original ZIP has been shared publicly.
