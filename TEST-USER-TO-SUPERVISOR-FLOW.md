# Testing User to Supervisor Data Flow

## Prerequisites
1. Server running at `http://localhost:3000`
2. Firestore rules deployed (allow authenticated users to read/write)
3. Two accounts created:
   - User account (regular user)
   - Supervisor account (userType: 'supervisor')

---

## Step-by-Step Test Process

### PART 1: User Sends Data

1. **Login as User**
   - Go to `http://localhost:3000/login`
   - Login with user account
   - You should be redirected to `/user-dashboard`

2. **Fill the Form**
   - Batch ID: `BATCH-001`
   - Batch Number: `1`
   - Date: Select today's date
   - Egg Count: `100`
   - Mortality: `2`
   - Feed (kg): `50`
   - Vaccination: `Optional`
   - Medicine: `Optional`
   - **Supervisor Email: `supervisor@example.com`** (use actual supervisor's email)

3. **Save Data**
   - Click **"Save Data"** button
   - You should see: "Data saved successfully! Check Your Data History below."
   - Page scrolls down to show the saved data in the table

4. **Send to Supervisor**
   - Make sure the Batch ID and Date fields still have the values you just saved
   - Make sure Supervisor Email field has the supervisor's email
   - Click **"Send to Supervisor"** button
   - You should see: "Data sent to supervisor (email) successfully!"

5. **Check Console (F12)**
   - Look for messages like:
     - "Data saved with ID: xxx"
     - "Sending 1 record(s) to supervisor: email"
     - "Updating document: xxx with supervisor email: email"
     - "All documents updated successfully"

6. **Check Your Data History**
   - The sent data should show: **"✓ Sent"** in green

---

### PART 2: Supervisor Receives Data

1. **Login as Supervisor**
   - Open a new incognito/private window (or logout first)
   - Go to `http://localhost:3000/login`
   - Login with supervisor account (same email used in Step 4 above)
   - You should be redirected to `/supervisor-dashboard`

2. **Check Dashboard**
   - Look at the statistics cards:
     - Total Users: Should show at least 1
     - Total Batches: Should show at least 1
   - You should see "Loaded X record(s) successfully!"

3. **Check Console (F12)**
   - Look for messages like:
     - "Supervisor logged in: email"
     - "Total records with sentToSupervisor=true: X"
     - "Checking document: xxx supervisorEmail: email sentToSupervisor: true"
     - "✓ Match! Adding to allData"
     - "Records for email: X"

4. **View User Data by Batches**
   - Scroll down to "User Data by Batches" section
   - You should see a card for each user
   - Click on a batch to expand and see details
   - You should see the data the user sent:
     - Date, Egg Count, Mortality, Feed, etc.

5. **Test Refresh**
   - Click the **"🔄 Refresh Data"** button at the top
   - Data should reload

---

## Troubleshooting

### Issue: "Permission denied" error
**Solution:** Update Firestore rules in Firebase Console:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Issue: No data appears in supervisor dashboard
**Check:**
1. Are you logged in as supervisor? (userType must be 'supervisor')
2. Did you use the supervisor's actual email when sending data?
3. Open console (F12) and check for errors
4. Look for "Records for [email]: 0" - means no match found
5. Click "🔄 Refresh Data" button

### Issue: User can't send data
**Check:**
1. Did you save the data first? (Click "Save Data" before "Send to Supervisor")
2. Is the Batch ID and Date filled in?
3. Is the Supervisor Email valid?
4. Check console for error messages

### Issue: Data saved but shows "Not Sent"
**Reason:** You need to click "Send to Supervisor" button after saving

---

## Console Debugging Commands

### As User (after sending):
```javascript
// Check if data was marked as sent
firebase.firestore().collection('dailyData')
  .where('userId', '==', firebase.auth().currentUser.uid)
  .where('sentToSupervisor', '==', true)
  .get()
  .then(snap => console.log('Sent records:', snap.size))
```

### As Supervisor:
```javascript
// Check all records sent to you
firebase.firestore().collection('dailyData')
  .where('sentToSupervisor', '==', true)
  .get()
  .then(snap => {
    console.log('Total sent records:', snap.size);
    snap.forEach(doc => {
      const data = doc.data();
      console.log('Document:', doc.id, 'Supervisor:', data.supervisorEmail);
    });
  })
```

---

## Expected Results

✅ User sees "Data sent to supervisor successfully!"
✅ User's data shows "✓ Sent" in green
✅ Supervisor sees data in "User Data by Batches"
✅ Statistics update (Total Users, Total Batches)
✅ Can filter and view detailed data
✅ Graphs display for each batch

---

## Important Notes

- Supervisor email MUST match exactly (case-sensitive)
- User must have userType: 'user'
- Supervisor must have userType: 'supervisor'
- Data is filtered by supervisor email in real-time
- Click "🔄 Refresh Data" to reload after users send new data
