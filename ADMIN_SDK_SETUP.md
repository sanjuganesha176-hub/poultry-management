# Firebase Admin SDK Setup Guide

## 📘 Overview

Firebase Admin SDK allows you to perform privileged operations on the server-side, such as:
- User management
- Token verification
- Direct database access with elevated privileges
- Secure backend operations

## 🔑 Getting Your Service Account Key

### Step 1: Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/project/poutry-management/settings/serviceaccounts/adminsdk)
2. Click on **Service accounts** tab
3. Click **Generate new private key**
4. Confirm by clicking **Generate key**
5. A JSON file will be downloaded

### Step 2: Save the Service Account Key

**Option A: Using File (Development)**
```powershell
# Save the downloaded file as serviceAccountKey.json in project root
# DO NOT commit this file to version control!
```

**Option B: Using Environment Variables (Production)**

Add to your `.env` file:
```env
FIREBASE_PRIVATE_KEY_ID=abc123...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@poutry-management.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
```

## 📁 File Structure

```
c:\vs\poutry management\
├── firebase-admin.js              # Admin SDK initialization
├── serviceAccountKey.json         # Your actual key (DO NOT COMMIT)
├── serviceAccountKey.json.example # Template file
└── server.js                      # Server with Admin SDK integration
```

## 🚀 Usage

The Admin SDK is already integrated in your server. It provides:

### 1. Token Verification API
```javascript
POST /api/verify-token
Body: { "token": "user-firebase-token" }
```

### 2. User Data API
```javascript
GET /api/user/:uid
Headers: { "Authorization": "Bearer user-token" }
```

### 3. Data Export API (for supervisors)
```javascript
POST /api/export-data
Headers: { "Authorization": "Bearer supervisor-token" }
Body: {
  "supervisorUid": "uid",
  "dateFrom": "2025-01-01",
  "dateTo": "2025-12-31"
}
```

## 🔒 Security Best Practices

### For Development:
1. Use `serviceAccountKey.json` file
2. Keep it in project root
3. Never commit to Git (already in .gitignore)

### For Production:
1. **Use environment variables** instead of JSON file
2. Store in secure secret management:
   - Google Cloud Secret Manager
   - AWS Secrets Manager
   - Azure Key Vault
   - Environment variables in hosting platform

### Example: Setting Environment Variables

**Windows PowerShell:**
```powershell
$env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Linux/Mac:**
```bash
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Heroku:**
```bash
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Google Cloud Run:**
```bash
gcloud run services update SERVICE_NAME \
  --set-env-vars FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 🛠️ Server-Side Operations

You can now perform server-side operations:

### User Management
```javascript
const { auth } = require('./firebase-admin');

// Create user
await auth.createUser({
  email: 'user@example.com',
  password: 'password123'
});

// Get user
const user = await auth.getUser(uid);

// Delete user
await auth.deleteUser(uid);
```

### Database Operations
```javascript
const { db } = require('./firebase-admin');

// Read data (bypasses security rules)
const snapshot = await db.collection('dailyData').get();

// Write data
await db.collection('users').doc(uid).set(data);
```

### Storage Operations
```javascript
const { storage } = require('./firebase-admin');

// Get bucket
const bucket = storage.bucket();

// Upload file
await bucket.upload(filePath);
```

## ⚠️ Important Notes

1. **Admin SDK bypasses security rules** - Use with caution
2. **Keep credentials secure** - Never expose in client-side code
3. **Use for backend operations only** - Not for browser code
4. **Rate limiting** - Implement rate limiting for API endpoints
5. **Logging** - Log all admin operations for audit trail

## 🧪 Testing

Test the Admin SDK is working:

```powershell
npm start
```

Check console for:
```
Firebase Admin SDK initialized successfully
```

## 🔄 Migration from serviceAccountKey.json to Environment Variables

1. Extract values from JSON file
2. Add to `.env`:
```env
FIREBASE_PROJECT_ID=poutry-management
FIREBASE_PRIVATE_KEY_ID=abc123...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@poutry-management.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/...
```
3. Remove `serviceAccountKey.json` file
4. Restart server

## 📚 Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Service Account Keys Best Practices](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
- [Firebase Admin Node.js Reference](https://firebase.google.com/docs/reference/admin/node)

## 🆘 Troubleshooting

**Error: ENOENT: no such file or directory, open 'serviceAccountKey.json'**
- Download service account key from Firebase Console
- Save as `serviceAccountKey.json` in project root

**Error: Credential implementation provided to initializeApp() via "credential" property failed**
- Check JSON file format
- Verify all fields are present
- Check for extra spaces or newlines

**Error: insufficient_permissions**
- Ensure service account has required roles
- Grant "Firebase Admin" role in Google Cloud Console

**Cannot find module './serviceAccountKey.json'**
- File doesn't exist or wrong location
- Use environment variables instead
- Check file path is correct
