require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5500').split(',').map(v => v.trim());
// Allow only the external services that this frontend actually loads.
// Inline event handlers are still used by the current frontend HTML/JS;
// remove them and scriptSrcAttr's unsafe-inline before production deployment.
app.use(helmet({
  // Firebase signInWithPopup needs popups to keep their opener relationship.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://www.gstatic.com',
        'https://apis.google.com', // Firebase popup auth loads Google's API script from this host
        'https://cdn.jsdelivr.net',
        'https://ucarecdn.com',
        'https://checkout.razorpay.com'
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // existing HTML onclick handlers
      styleSrc: [
        "'self'", "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net',
        'https://ucarecdn.com'
      ],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      connectSrc: [
        "'self'",
        'http://localhost:5000',
        'https://apis.google.com',
        'https://www.gstatic.com', // Allow Firebase source maps; not required for sign-in
        'https://*.googleapis.com',
        'https://*.firebaseapp.com',
        'https://*.firebaseio.com',
        'https://*.uploadcare.com',
        'https://*.ucarecdn.com',
        'https://*.razorpay.com'
      ],
      frameSrc: [
        "'self'",
        'https://*.firebaseapp.com',
        'https://accounts.google.com',
        'https://*.google.com',
        'https://*.razorpay.com',
        'https://*.uploadcare.com'
      ],
      workerSrc: ["'self'", 'blob:']
    }
  }
}));
// A single Render web service serves the frontend and API on the same origin.
// Such requests do not need CORS; avoid rejecting same-origin POSTs that include
// an Origin header. Keep restricted CORS for separate local/remote frontends.
if (process.env.SERVE_FRONTEND !== 'true') {
  app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin not allowed by CORS')); }, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
}
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: 'draft-7', legacyHeaders: false }), require('./routes'));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'SimpleNails API' }));
// Convenient local development: serve the frontend from the same Express process.
if (process.env.SERVE_FRONTEND === 'true') app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ message: 'Internal server error.' }); });
app.listen(port, () => console.log(`SimpleNails API listening on port ${port}`));
