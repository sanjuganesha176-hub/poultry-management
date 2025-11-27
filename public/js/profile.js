import { auth, db } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    getDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;

// Check authentication
function checkAuth() {
    const userData = sessionStorage.getItem('currentUser');
    if (!userData) {
        window.location.href = '/login';
        return null;
    }
    return JSON.parse(userData);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    currentUser = checkAuth();
    if (currentUser) {
        loadProfile();
        
        // Set dashboard link based on user type
        const dashboardLink = document.getElementById('dashboardLink');
        if (currentUser.userType === 'supervisor') {
            dashboardLink.href = '/supervisor-dashboard';
        } else {
            dashboardLink.href = '/user-dashboard';
        }
    }
});

// Show alert
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Load profile
async function loadProfile() {
    try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            document.getElementById('fullName').value = data.fullName || '';
            document.getElementById('userType').value = data.userType || '';
            document.getElementById('farmName').value = data.farmName || '';
            document.getElementById('location').value = data.location || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('userId').textContent = data.uid || '';
            document.getElementById('createdAt').textContent = data.createdAt 
                ? new Date(data.createdAt).toLocaleDateString() 
                : '-';
        } else {
            // Use session data if Firestore document doesn't exist
            document.getElementById('fullName').value = currentUser.fullName || '';
            document.getElementById('userType').value = currentUser.userType || '';
            document.getElementById('farmName').value = currentUser.farmName || '';
            document.getElementById('location').value = currentUser.location || '';
            document.getElementById('email').value = currentUser.email || '';
            document.getElementById('userId').textContent = currentUser.uid || '';
        }

    } catch (error) {
        console.error('Error loading profile:', error);
        showAlert('Error loading profile: ' + error.message, 'error');
    }
}

// Update profile
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value;
    const farmName = document.getElementById('farmName').value;
    const location = document.getElementById('location').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate password if changing
    if (newPassword) {
        if (newPassword !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showAlert('Password must be at least 6 characters', 'error');
            return;
        }
    }

    try {
        showAlert('Updating profile...', 'info');

        const updateData = {
            fullName,
            farmName,
            location,
            updatedAt: new Date().toISOString()
        };

        // Add password to update if changed
        if (newPassword) {
            updateData.password = newPassword;
        }

        // Update in Firestore
        const docRef = doc(db, 'users', currentUser.uid);
        await updateDoc(docRef, updateData);

        // Update session storage
        currentUser.fullName = fullName;
        currentUser.farmName = farmName;
        currentUser.location = location;
        if (newPassword) {
            currentUser.password = newPassword;
        }
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

        showAlert('Profile updated successfully!', 'success');
        
        // Clear password fields
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Error updating profile: ' + error.message, 'error');
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        sessionStorage.clear();
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
    }
});
