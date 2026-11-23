const admin = require('firebase-admin');

if (!admin.apps.length) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Supports GOOGLE_APPLICATION_CREDENTIALS or the hosting provider's ADC.
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

module.exports = { admin, db: admin.firestore() };
