const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config();

// Initialize Firebase Admin SDK
const { admin, db, auth, storage } = require('./firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - Relaxed for Firebase compatibility
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "'unsafe-eval'", 
                "https://www.gstatic.com",
                "https://*.gstatic.com", 
                "https://cdn.jsdelivr.net", 
                "https://cdnjs.cloudflare.com",
                "https://www.google.com",
                "https://www.gstatic.cn",
                "https://apis.google.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            scriptSrcElem: [
                "'self'", 
                "'unsafe-inline'",
                "'unsafe-hashes'",
                "https://www.gstatic.com",
                "https://*.gstatic.com",
                "https://cdn.jsdelivr.net", 
                "https://cdnjs.cloudflare.com",
                "https://www.google.com",
                "https://apis.google.com"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'", 
                "https://*.googleapis.com", 
                "https://*.firebaseio.com", 
                "https://*.cloudfunctions.net",
                "https://www.gstatic.com",
                "https://*.gstatic.com",
                "https://*.firebaseapp.com",
                "https://identitytoolkit.googleapis.com",
                "https://securetoken.googleapis.com",
                "https://firestore.googleapis.com",
                "https://firebase.googleapis.com",
                "https://firebasestorage.googleapis.com",
                "https://*.google.com",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "wss://*.firebaseio.com"
            ],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: [
                "'self'", 
                "https://*.firebaseapp.com", 
                "https://*.google.com",
                "https://www.google.com",
                "https://recaptcha.google.com",
                "https://www.recaptcha.net"
            ],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static('public', {
    maxAge: '1d', // Cache static files for 1 day
    etag: true
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/user-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html'));
});

app.get('/supervisor-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'supervisor-dashboard.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// API endpoint to verify user token (optional - for additional security)
app.post('/api/verify-token', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const decodedToken = await auth.verifyIdToken(token);
        res.json({ 
            success: true, 
            uid: decodedToken.uid,
            email: decodedToken.email 
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// API endpoint to get user data (server-side)
app.get('/api/user/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, data: userDoc.data() });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint for bulk data export (for supervisors)
app.post('/api/export-data', async (req, res) => {
    try {
        const { supervisorUid, dateFrom, dateTo } = req.body;
        
        // Verify supervisor token
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decodedToken = await auth.verifyIdToken(token);
        if (decodedToken.uid !== supervisorUid) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Fetch supervisor's email
        const supervisorDoc = await db.collection('users').doc(supervisorUid).get();
        const supervisorEmail = supervisorDoc.data().email;

        // Query data
        let query = db.collection('dailyData')
            .where('supervisorEmail', '==', supervisorEmail)
            .where('sentToSupervisor', '==', true);

        if (dateFrom) {
            query = query.where('date', '>=', dateFrom);
        }
        if (dateTo) {
            query = query.where('date', '<=', dateTo);
        }

        const snapshot = await query.get();
        const data = [];
        snapshot.forEach(doc => {
            data.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, data, count: data.length });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
