import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword,
    setPersistence,
    browserSessionPersistence,
    GoogleAuthProvider,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc,
    getDoc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Show alert message
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Login form submission
const loginForm = document.getElementById('loginForm');
if (!loginForm) {
    console.error('Login form not found');
    showAlert('Page loading error. Please refresh the page.', 'error');
}

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    
    if (!emailField || !passwordField) {
        console.error('Form fields not found');
        showAlert('Form loading error. Please refresh the page.', 'error');
        return;
    }

    const email = emailField.value;
    const password = passwordField.value;

    try {
        showAlert('Logging in...', 'info');

        // Set persistence
        await setPersistence(auth, browserSessionPersistence);
        
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            // Create user document if it doesn't exist
            const userData = {
                uid: user.uid,
                fullName: user.displayName || 'User',
                email: user.email,
                userType: 'user', // Default to user
                createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'users', user.uid), userData);
            showAlert('Login successful! Setting up your profile...', 'success');
            
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            
            setTimeout(() => {
                window.location.href = '/user-dashboard';
            }, 1500);
            return;
        }

        const userData = userDoc.data();

        // Store user data in session
        sessionStorage.setItem('currentUser', JSON.stringify(userData));

        showAlert('Login successful! Redirecting...', 'success');

        // Redirect based on user type
        setTimeout(() => {
            if (userData.userType === 'supervisor') {
                window.location.href = '/supervisor-dashboard';
            } else {
                window.location.href = '/user-dashboard';
            }
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Login failed: ';
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/invalid-credential':
                errorMessage += 'Invalid email or password. Please check your credentials and try again.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMessage += 'This account has been disabled';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Too many failed attempts. Try again later';
                break;
            default:
                errorMessage += error.message;
        }
        
        showAlert(errorMessage, 'error');
    }
});

// Google Sign-In
const googleSignInBtn = document.getElementById('googleSignInBtn');
console.log('Google Sign-In button found:', googleSignInBtn);
if (googleSignInBtn) {
    let isSigningIn = false;
    
    googleSignInBtn.addEventListener('click', async () => {
        if (isSigningIn) {
            console.log('Sign-in already in progress');
            return;
        }
        
        console.log('Google Sign-In button clicked');
        isSigningIn = true;
        googleSignInBtn.disabled = true;
        googleSignInBtn.style.opacity = '0.6';
        googleSignInBtn.style.cursor = 'not-allowed';
        
        try {
            showAlert('Opening Google Sign-In popup...', 'info');
            
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            console.log('Opening Google Sign-In popup...');
            const result = await signInWithPopup(auth, provider);
            console.log('Google Sign-In successful:', result.user.email);
            const user = result.user;
            
            // Get or create user data in Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            let userData;
            if (!userDoc.exists()) {
                // Create new user document
                userData = {
                    uid: user.uid,
                    fullName: user.displayName || 'User',
                    email: user.email,
                    userType: 'user',
                    createdAt: new Date().toISOString()
                };
                await setDoc(doc(db, 'users', user.uid), userData);
            } else {
                userData = userDoc.data();
            }
            
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            showAlert('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                if (userData.userType === 'supervisor') {
                    window.location.href = '/supervisor-dashboard';
                } else {
                    window.location.href = '/user-dashboard';
                }
            }, 1500);
            
        } catch (error) {
            // Only log errors that aren't user-cancelled actions
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Google Sign-In error:', error);
            }
            
            if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup - just show friendly message, no console error
                showAlert('Sign-In cancelled. Click the button again to retry.', 'warning');
            } else if (error.code === 'auth/popup-blocked') {
                showAlert('Popup blocked by browser. Please allow popups and try again.', 'error');
            } else if (error.code === 'auth/operation-not-allowed') {
                showAlert('Google Sign-In not enabled in Firebase Console.', 'error');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // Silent - user opened another popup, don't show anything
                return;
            } else {
                showAlert('Google Sign-In failed: ' + error.message, 'error');
            }
        } finally {
            isSigningIn = false;
            googleSignInBtn.disabled = false;
            googleSignInBtn.style.opacity = '1';
            googleSignInBtn.style.cursor = 'pointer';
        }
    });
}
