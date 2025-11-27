const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let serviceAccount;

try {
    // Try to load service account from file
    serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
    console.warn('Service account key file not found. Using environment variables or default credentials.');
    
    // For production, use environment variables
    if (process.env.FIREBASE_PRIVATE_KEY) {
        serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID || "poutry-management",
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };
    }
}

// Initialize Admin SDK
if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "poutry-management.firebasestorage.app"
    });
    console.log('Firebase Admin SDK initialized successfully');
} else {
    // Use application default credentials (for Google Cloud environments)
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized with default credentials');
}

// Export admin services
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = {
    admin,
    db,
    auth,
    storage
};
