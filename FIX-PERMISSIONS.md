# Fix Firestore Permission Denied Error

You're seeing "Missing or insufficient permissions" because Firestore security rules haven't been deployed or are blocking access.

## Quick Fix (Copy-Paste Rules in Firebase Console)

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `poutry-management`
3. **Navigate to**: Firestore Database → Rules tab
4. **Delete all existing rules** and replace with the rules below
5. **Click Publish**

---

## COPY THESE RULES (Simple Version for Development):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
    
    // Daily data collection
    match /dailyData/{dataId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update: if request.auth != null && (resource.data.userId == request.auth.uid || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['sentToSupervisor', 'sentAt']));
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## What These Rules Do:
- ✅ Authenticated users can read all user profiles
- ✅ Users can create and update their own profile
- ✅ Users can create, read, update, and delete their own daily data
- ✅ Supervisors can update the `sentToSupervisor` field on any data
- ❌ No one can delete user accounts

---

## After Publishing Rules:

1. **Hard refresh your browser** (Ctrl + Shift + R)
2. **Try logging in again** at `http://localhost:3000/login`
3. The permission error should be gone

---

## Alternative: Deploy via Firebase CLI (if installed)

If you have Firebase CLI installed:

```bash
firebase login
firebase use poutry-management
firebase deploy --only firestore:rules
```

---

## Storage Rules (Optional - for photo uploads)

If you also see storage permission errors, go to **Storage → Rules** and paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Click **Publish** for storage rules too.
