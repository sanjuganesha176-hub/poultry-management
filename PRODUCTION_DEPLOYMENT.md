# Production Deployment Guide

## 🚀 Firebase Production Setup

### 1. Deploy Security Rules

#### Firestore Rules:
```bash
firebase deploy --only firestore:rules
```

Or manually in Firebase Console:
1. Go to Firestore Database → Rules
2. Copy content from `firestore.rules`
3. Click "Publish"

#### Storage Rules:
```bash
firebase deploy --only storage
```

Or manually in Firebase Console:
1. Go to Storage → Rules
2. Copy content from `storage.rules`
3. Click "Publish"

### 2. Enable Firebase App Check (Recommended)

App Check helps protect your backend resources from abuse:

1. Go to Firebase Console → App Check
2. Click "Get started"
3. Register your web app
4. Choose reCAPTCHA v3 or reCAPTCHA Enterprise
5. Add your domain to allowed domains

Update your firebase-config.js:
```javascript
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';

const app = initializeApp(firebaseConfig);

// Initialize App Check
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
  isTokenAutoRefreshEnabled: true
});
```

### 3. Configure Authorized Domains

1. Go to Authentication → Settings → Authorized domains
2. Add your production domain(s)
3. Remove unnecessary domains

### 4. Set Up Firestore Indexes

Required composite indexes will be created automatically when you first run queries. Firebase will provide direct links in console errors.

Common indexes needed:
- Collection: `dailyData`, Fields: `userId` ASC, `date` DESC
- Collection: `dailyData`, Fields: `supervisorPhone` ASC, `sentToSupervisor` ASC, `date` DESC
- Collection: `dailyData`, Fields: `userId` ASC, `batchId` ASC, `date` DESC

Create manually:
1. Go to Firestore Database → Indexes
2. Click "Create Index"
3. Add the fields and sorting as needed

### 5. Environment Variables

For production, use environment variables instead of hardcoded values:

Create `.env` file (already in .gitignore):
```env
VITE_FIREBASE_API_KEY=AIzaSyDeImJUCh1j1Azv3Hn9S3sys5V2-NvPGm8
VITE_FIREBASE_AUTH_DOMAIN=poutry-management.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=poutry-management
VITE_FIREBASE_STORAGE_BUCKET=poutry-management.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=309045584840
VITE_FIREBASE_APP_ID=1:309045584840:web:f4f431071c0f81670456fd
VITE_FIREBASE_MEASUREMENT_ID=G-FTV04YHMEB
```

### 6. Security Enhancements

#### Password Hashing:
The current implementation stores passwords in Firestore. For production:

Option 1: Use Firebase Authentication only
- Store user data without passwords
- Use Firebase Auth for all authentication

Option 2: Use Cloud Functions for password hashing
```javascript
// In Cloud Functions
const bcrypt = require('bcrypt');

exports.createUser = functions.https.onCall(async (data, context) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  // Store hashedPassword in Firestore
});
```

#### Rate Limiting:
Enable Firebase Authentication rate limiting:
1. Go to Authentication → Settings
2. Enable "Email enumeration protection"
3. Configure rate limits

### 7. Monitoring & Alerts

1. **Enable Firebase Performance Monitoring:**
```javascript
import { getPerformance } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-performance.js';
const perf = getPerformance(app);
```

2. **Set up Budget Alerts:**
   - Go to Google Cloud Console
   - Set budget alerts for Firebase usage
   - Configure email notifications

3. **Enable Crashlytics (for mobile):**
   - Helps track and fix crashes in production

### 8. HTTPS & Domain Setup

1. **Using Firebase Hosting:**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

2. **Custom Domain:**
   - Go to Hosting → Add custom domain
   - Follow DNS configuration steps
   - SSL certificate is automatic

### 9. Performance Optimization

1. **Enable Compression:**
Add to server.js:
```javascript
const compression = require('compression');
app.use(compression());
```

2. **CDN for Static Assets:**
Use Firebase Hosting CDN (automatic)

3. **Firestore Caching:**
Already implemented in the code with query listeners

4. **Image Optimization:**
Consider adding Cloud Functions to resize images:
```javascript
const sharp = require('sharp');

exports.resizeImage = functions.storage.object().onFinalize(async (object) => {
  // Resize uploaded images
});
```

### 10. Backup & Recovery

1. **Enable Firestore Backups:**
```bash
gcloud firestore export gs://your-bucket/backup-folder
```

2. **Schedule Automated Backups:**
Use Cloud Scheduler + Cloud Functions

3. **Export User Data:**
Implement data export feature for GDPR compliance

### 11. Cost Optimization

1. **Monitor Usage:**
   - Firebase Console → Usage and billing
   - Set up daily/monthly budget alerts

2. **Optimize Queries:**
   - Use pagination (limit queries)
   - Cache frequently accessed data
   - Use indexes efficiently

3. **Storage Management:**
   - Compress images before upload
   - Delete unused files
   - Set lifecycle rules

### 12. Testing in Production Mode

Before going live:

1. **Test Phone Authentication:**
   - Test with real phone numbers
   - Verify OTP delivery in different countries

2. **Load Testing:**
   - Use tools like Apache JMeter
   - Test with concurrent users

3. **Security Audit:**
   - Run Firebase Security Rules simulator
   - Test unauthorized access attempts

4. **Cross-browser Testing:**
   - Test on Chrome, Firefox, Safari, Edge
   - Test on mobile devices

### 13. Launch Checklist

- [ ] Production Firebase rules deployed
- [ ] App Check enabled
- [ ] Authorized domains configured
- [ ] HTTPS enabled
- [ ] Custom domain set up (if applicable)
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented
- [ ] Performance optimization completed
- [ ] Security audit passed
- [ ] Load testing completed
- [ ] User documentation ready
- [ ] Support contact configured

### 14. Post-Launch

1. **Monitor Performance:**
   - Check Firebase Console daily
   - Review error logs
   - Monitor user feedback

2. **Regular Updates:**
   - Update Firebase SDK regularly
   - Apply security patches
   - Review and update security rules

3. **Scale as Needed:**
   - Upgrade Firebase plan if needed
   - Optimize queries based on usage patterns
   - Add Cloud Functions for heavy operations

### 15. Compliance

**GDPR/Data Privacy:**
- Implement user data export
- Add data deletion feature
- Create privacy policy
- Add cookie consent banner

**Terms of Service:**
- Create and display terms
- Require acceptance during signup

### Support Resources

- Firebase Documentation: https://firebase.google.com/docs
- Firebase Status: https://status.firebase.google.com
- Stack Overflow: Tag questions with [firebase]
- Firebase Support: https://firebase.google.com/support

## Emergency Contacts

Set up emergency procedures for:
- Data breaches
- Service outages
- Security incidents
- Critical bugs

Keep Firebase project owner credentials secure and accessible to authorized personnel only.
