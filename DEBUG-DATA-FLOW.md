# Quick Debug - Check if Data is Being Sent

## Step 1: As User - Send Data with Logging

1. Login as user
2. Open Console (F12)
3. Fill the form completely:
   - Batch ID: `TEST-001`
   - Batch Number: `1`
   - Date: Today
   - Egg Count: `50`
   - Mortality: `1`
   - Feed: `25`
   - **Supervisor Email: (exact email of supervisor)**

4. Click "Save Data"
5. Click "Send to Supervisor"

**Look for these console messages:**
```
Sending X record(s) to supervisor: email@example.com
Updating document: xxx with supervisor email: email@example.com
Document data: {userId: "...", batchId: "TEST-001", ...}
All documents updated successfully
Supervisor should query for: supervisorEmail == email@example.com && sentToSupervisor == true
```

## Step 2: As Supervisor - Check Data Received

1. Login as supervisor (use the EXACT email from Step 1)
2. Open Console (F12)
3. Click "🔄 Refresh Data" button

**Look for these console messages:**
```
Querying all dailyData for supervisor: email@example.com
Total records in dailyData collection: X
✓ Match found! Document: xxx from user: UserName
Records for email@example.com: X
displayUserBatches called with filteredData: X records
Grouping data by user and batch...
Grouped data by users: X users
Displaying user: UserName with X batches
```

## Step 3: Manual Firestore Check (If Still Not Working)

Open Firebase Console manually:
1. Go to: https://console.firebase.google.com/
2. Select: poutry-management
3. Click: Firestore Database
4. Look at the `dailyData` collection
5. Find documents where:
   - `sentToSupervisor` = true
   - `supervisorEmail` = your supervisor email
6. Check if these fields exist and match

## Common Issues:

### Issue: "Records for email: 0"
**Cause:** Email mismatch or data not sent
**Check:**
- User entered correct supervisor email?
- Emails match EXACTLY (case-sensitive)?
- User clicked "Send to Supervisor" after saving?

### Issue: "Total records in dailyData collection: 0"
**Cause:** No data in Firestore at all
**Fix:** User needs to save data first

### Issue: Console shows match but UI shows "No data available"
**Cause:** Display function error
**Check:** Any errors in console after "displayUserBatches called"?

## Quick Test Query

Paste this in browser console as SUPERVISOR:

```javascript
// Check what's in Firestore
const currentEmail = sessionStorage.getItem('currentUser') ? JSON.parse(sessionStorage.getItem('currentUser')).email : 'UNKNOWN';
console.log('My email:', currentEmail);

firebase.firestore().collection('dailyData').get().then(snapshot => {
  console.log('Total docs:', snapshot.size);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('Doc:', doc.id);
    console.log('  - sentToSupervisor:', data.sentToSupervisor);
    console.log('  - supervisorEmail:', data.supervisorEmail);
    console.log('  - matches me:', data.supervisorEmail === currentEmail && data.sentToSupervisor === true);
  });
});
```

This will show you EXACTLY what's in the database and if it matches.
