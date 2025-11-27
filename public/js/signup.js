import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    setDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Show alert message
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Signup form submission
const signupForm = document.getElementById('signupForm');
if (!signupForm) {
    console.error('Signup form not found');
    showAlert('Page loading error. Please refresh the page.', 'error');
}

signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userTypeField = document.getElementById('userType');
    const fullNameField = document.getElementById('fullName');
    const farmNameField = document.getElementById('farmName');
    const locationField = document.getElementById('location');
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirmPassword');
    
    if (!userTypeField || !fullNameField || !farmNameField || !locationField || !emailField || !passwordField || !confirmPasswordField) {
        console.error('Some form fields not found');
        showAlert('Form loading error. Please refresh the page.', 'error');
        return;
    }
    
    const userType = userTypeField.value;
    const fullName = fullNameField.value;
    const farmName = farmNameField.value;
    const location = locationField.value;
    const email = emailField.value;
    const password = passwordField.value;
    const confirmPassword = confirmPasswordField.value;

    // Validation
    if (!userType || !fullName || !farmName || !location || !email || !password) {
        showAlert('Please fill all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        showAlert('Creating account...', 'info');

        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update user profile
        await updateProfile(user, {
            displayName: fullName
        });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            fullName: fullName,
            farmName: farmName,
            location: location,
            email: email,
            userType: userType,
            createdAt: new Date().toISOString()
        });

        showAlert('Registered successfully', 'success');

        // Store user data in session
        sessionStorage.setItem('currentUser', JSON.stringify({
            uid: user.uid,
            fullName: fullName,
            farmName: farmName,
            location: location,
            email: email,
            userType: userType
        }));

        // Redirect based on user type
        setTimeout(() => {
            if (userType === 'supervisor') {
                window.location.href = '/supervisor-dashboard';
            } else {
                window.location.href = '/user-dashboard';
            }
        }, 2000);

    } catch (error) {
        console.error('Error during signup:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Unable to register: ';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Email is already registered. Please login instead.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password must be at least 6 characters';
                break;
            default:
                errorMessage += error.message;
        }
        
        showAlert(errorMessage, 'error');
    }
});

// Google Sign-Up
const googleSignUpBtn = document.getElementById('googleSignUpBtn');
console.log('Google Sign-Up button found:', googleSignUpBtn);
if (googleSignUpBtn) {
    let isSigningUp = false;
    
    googleSignUpBtn.addEventListener('click', async () => {
        if (isSigningUp) {
            console.log('Sign-up already in progress');
            return;
        }
        
        console.log('Google Sign-Up button clicked');
        isSigningUp = true;
        googleSignUpBtn.disabled = true;
        googleSignUpBtn.style.opacity = '0.6';
        googleSignUpBtn.style.cursor = 'not-allowed';
        
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
            
            // Check if user already exists
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // User already exists, redirect to login
                showAlert('Account already exists. Redirecting to login...', 'info');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
                return;
            }
            
            // Create new user document
            const userData = {
                uid: user.uid,
                fullName: user.displayName || 'User',
                email: user.email,
                userType: 'user',
                createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'users', user.uid), userData);
            showAlert('Registered successfully with Google!', 'success');
            
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            
            setTimeout(() => {
                window.location.href = '/user-dashboard';
            }, 2000);
            
        } catch (error) {
            // Only log errors that aren't user-cancelled actions
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Google Sign-Up error:', error);
            }
            
            if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup - just show friendly message, no console error
                showAlert('Sign-Up cancelled. Click the button again to retry.', 'warning');
            } else if (error.code === 'auth/popup-blocked') {
                showAlert('Popup blocked by browser. Please allow popups and try again.', 'error');
            } else if (error.code === 'auth/operation-not-allowed') {
                showAlert('Google Sign-In not enabled in Firebase Console.', 'error');
            } else if (error.code === 'auth/account-exists-with-different-credential') {
                showAlert('Account already exists with this email. Please login instead.', 'error');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // Silent - user opened another popup, don't show anything
                return;
            } else {
                showAlert('Google Sign-Up failed: ' + error.message, 'error');
            }
        } finally {
            isSigningUp = false;
            googleSignUpBtn.disabled = false;
            googleSignUpBtn.style.opacity = '1';
            googleSignUpBtn.style.cursor = 'pointer';
        }
    });
}
