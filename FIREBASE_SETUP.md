# Firebase Configuration Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `poultry-management` (or your choice)
4. Follow the setup wizard

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Phone** authentication:
   - Click on "Phone" in Sign-in providers
   - Enable it
   - Add test phone numbers if needed (for development)
4. Enable **Email/Password** authentication (as backup)

## Step 3: Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (for development)
4. Choose a location close to your users

### Firestore Security Rules

Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Daily data collection
    match /dailyData/{dataId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                    (resource.data.userId == request.auth.uid || 
                     request.auth.token.userType == 'supervisor');
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Step 4: Enable Storage

1. Go to **Storage**
2. Click "Get started"
3. Start in **test mode** (for development)

### Storage Security Rules

Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Step 5: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click on Web icon `</>`
4. Register your app with a nickname
5. Copy the `firebaseConfig` object

## Step 6: Configure Your Application

1. Open `public/js/firebase-config-template.js`
2. Copy it to `public/js/firebase-config.js`
3. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "AIza...", // Your API Key
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

## Essential Keys You Need:

1. **apiKey**: Used for authentication and API calls
2. **authDomain**: Domain for authentication
3. **projectId**: Your Firebase project ID
4. **storageBucket**: Storage bucket URL
5. **messagingSenderId**: For push notifications
6. **appId**: Your web app ID

## Step 7: Add Authorized Domains (for Phone Auth)

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your domain (e.g., `localhost` for development)
3. For production, add your production domain

## Step 8: Configure reCAPTCHA (for Phone Auth)

Phone authentication uses reCAPTCHA for bot protection. Make sure:

1. Your domain is in authorized domains
2. Pop-ups are not blocked in your browser
3. For production, consider using [reCAPTCHA v3](https://firebase.google.com/docs/auth/web/phone-auth#use-invisible-recaptcha)

## Important Security Notes:

### For Production:

1. **Update Firestore Rules**: Change from test mode to production rules
2. **Update Storage Rules**: Secure your storage
3. **Enable App Check**: Protect your backend resources
4. **Use Environment Variables**: Don't commit sensitive keys to version control
5. **Hash Passwords Properly**: Use Firebase Auth's password hashing or implement server-side hashing

### Firestore Indexes:

You may need to create composite indexes. Firebase will show error messages with links to create them automatically when needed.

Common indexes needed:
- `dailyData`: userId + date (descending)
- `dailyData`: supervisorPhone + sentToSupervisor + date (descending)
- `dailyData`: userId + batchId + date (descending)

## Testing:

After configuration:

1. Start the server: `npm start`
2. Open `http://localhost:3000`
3. Try signing up with a test phone number
4. Check Firebase Console to see if user is created

## Troubleshooting:

### Phone Auth Not Working:
- Check if phone authentication is enabled
- Verify authorized domains
- Check browser console for errors
- Try with a test phone number first

### Firestore Permission Denied:
- Check security rules
- Verify user is authenticated
- Check if user has proper permissions

### Storage Upload Failed:
- Check storage rules
- Verify user authentication
- Check file size limits

## Cost Considerations:

Firebase free tier (Spark plan) includes:
- **Authentication**: 10K verifications/month
- **Firestore**: 50K reads, 20K writes, 20K deletes per day
- **Storage**: 5GB storage, 1GB/day downloads

For production, consider upgrading to Blaze (pay-as-you-go) plan.
