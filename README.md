# Poultry Management System

A complete web-based poultry management system with user and supervisor dashboards, Firebase authentication, and data visualization.

## Features

- **Authentication**: Mobile number OTP verification + Password
- **User Dashboard**: Add daily batch data (eggs, mortality, feed, vaccination, medicine, photos)
- **Supervisor Dashboard**: View data from multiple users with graphs and filters
- **Profile Management**: Manage farm details and contact information
- **Reports**: Generate PDF reports (daily, weekly, monthly)
- **Data Visualization**: Charts for egg production and mortality trends

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Configure Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Phone and Email/Password)
   - Enable Firestore Database
   - Enable Storage (for photos)
   - Copy your Firebase configuration

3. Create `public/js/firebase-config.js` with your Firebase credentials:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_AUTH_DOMAIN",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_STORAGE_BUCKET",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```

4. Start the server:
   ```
   npm start
   ```

5. Open http://localhost:3000 in your browser

## Firebase Security Rules

### Firestore Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /dailyData/{dataId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Storage Rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```
