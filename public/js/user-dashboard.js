import { auth, db, storage } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    updateDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

let currentUser = null;
let uploadedPhotoFile = null;

// Check authentication
async function checkAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = '/login';
                resolve(null);
                return;
            }
            
            // Get user data from session or Firestore
            let userData = sessionStorage.getItem('currentUser');
            if (userData) {
                resolve(JSON.parse(userData));
            } else {
                // Fetch from Firestore if not in session
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                        sessionStorage.setItem('currentUser', JSON.stringify(userData));
                        resolve(userData);
                    } else {
                        window.location.href = '/login';
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    window.location.href = '/login';
                    resolve(null);
                }
            }
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (currentUser) {
        console.log('User logged in:', currentUser.email);
        document.getElementById('userName').textContent = currentUser.fullName || 'User';
        document.getElementById('farmName').textContent = currentUser.farmName || 'N/A';
        loadUserData();
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

// Photo preview
document.getElementById('photoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadedPhotoFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('photoPreview');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Set today's date as default
document.getElementById('entryDate').valueAsDate = new Date();

// Save daily data
document.getElementById('dailyDataForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        userId: currentUser.uid,
        userName: currentUser.fullName || 'User',
        farmName: currentUser.farmName || 'N/A',
        userEmail: currentUser.email,
        batchId: document.getElementById('batchId').value,
        batchNumber: parseInt(document.getElementById('batchNumber').value),
        date: document.getElementById('entryDate').value,
        eggCount: parseInt(document.getElementById('eggCount').value),
        mortality: parseInt(document.getElementById('mortality').value),
        feed: parseFloat(document.getElementById('feed').value),
        vaccination: document.getElementById('vaccination').value || '',
        medicine: document.getElementById('medicine').value || '',
        supervisorEmail: document.getElementById('supervisorEmail').value || '',
        sentToSupervisor: false,
        createdAt: new Date().toISOString()
    };

    try {
        showAlert('Saving data...', 'info');

        // Upload photo if exists
        if (uploadedPhotoFile) {
            const photoRef = ref(storage, `photos/${currentUser.uid}/${Date.now()}_${uploadedPhotoFile.name}`);
            await uploadBytes(photoRef, uploadedPhotoFile);
            formData.photoUrl = await getDownloadURL(photoRef);
        }

        // Save to Firestore
        const docRef = await addDoc(collection(db, 'dailyData'), formData);
        console.log('Data saved with ID:', docRef.id);

        showAlert('Data saved successfully! Check Your Data History below.', 'success');
        
        // Reset form
        document.getElementById('dailyDataForm').reset();
        document.getElementById('photoPreview').classList.add('hidden');
        document.getElementById('entryDate').valueAsDate = new Date();
        uploadedPhotoFile = null;

        // Reload data table to show the new entry
        await loadUserData();
        
        // Scroll to data history section
        document.getElementById('dataHistory')?.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Error saving data:', error);
        console.error('Error code:', error.code);
        console.error('Error details:', error);
        
        if (error.code === 'permission-denied') {
            showAlert('Permission denied. Please check Firestore rules in Firebase Console.', 'error');
        } else {
            showAlert('Error saving data: ' + error.message, 'error');
        }
    }
});

// Send to supervisor
document.getElementById('sendToSupervisorBtn').addEventListener('click', async () => {
    const supervisorEmail = document.getElementById('supervisorEmail').value;
    
    if (!supervisorEmail) {
        showAlert('Please enter supervisor email address', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supervisorEmail)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }

    const batchId = document.getElementById('batchId').value;
    const date = document.getElementById('entryDate').value;

    if (!batchId || !date) {
        showAlert('Please enter Batch ID and Date, then save the data first', 'error');
        return;
    }

    try {
        showAlert('Sending to supervisor...', 'info');

        // Find entries for this batch and date
        const q = query(
            collection(db, 'dailyData'),
            where('userId', '==', currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        
        // Filter by batchId and date
        const matchingDocs = [];
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            if (data.batchId === batchId && data.date === date) {
                matchingDocs.push(docSnapshot);
            }
        });
        
        if (matchingDocs.length === 0) {
            showAlert('No saved data found for this Batch ID and Date. Please save the data first.', 'error');
            return;
        }

        console.log('Sending', matchingDocs.length, 'record(s) to supervisor:', supervisorEmail);

        // Update all matching documents
        const updatePromises = [];
        matchingDocs.forEach((docSnapshot) => {
            const docRef = doc(db, 'dailyData', docSnapshot.id);
            const data = docSnapshot.data();
            console.log('Updating document:', docSnapshot.id, 'with supervisor email:', supervisorEmail);
            console.log('Document data:', data);
            updatePromises.push(updateDoc(docRef, {
                sentToSupervisor: true,
                supervisorEmail: supervisorEmail,
                sentAt: new Date().toISOString()
            }));
        });

        await Promise.all(updatePromises);
        
        console.log('All documents updated successfully');
        console.log('Supervisor should query for: supervisorEmail ==', supervisorEmail, '&& sentToSupervisor == true');

        showAlert(`Data sent to supervisor (${supervisorEmail}) successfully!`, 'success');
        await loadUserData();

    } catch (error) {
        console.error('Error sending to supervisor:', error);
        if (error.code === 'permission-denied') {
            showAlert('Permission denied. Please check Firestore rules.', 'error');
        } else {
            showAlert('Error sending data: ' + error.message, 'error');
        }
    }
});

// Event delegation for view detail buttons
document.getElementById('dataTableBody')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('view-detail-btn')) {
        const id = e.target.getAttribute('data-id');
        viewDetail(id);
    }
});

// Load user data
async function loadUserData(filterBatchId = '', filterDate = '') {
    try {
        const tbody = document.getElementById('dataTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
        
        let q = query(
            collection(db, 'dailyData'),
            where('userId', '==', currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';
        
        // Convert to array and sort by date descending
        const dataArray = [];
        querySnapshot.forEach((doc) => {
            dataArray.push({ id: doc.id, ...doc.data() });
        });
        dataArray.sort((a, b) => b.date.localeCompare(a.date));

        if (dataArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No data saved yet. Add your first entry above!</td></tr>';
            return;
        }
        
        console.log('Loaded', dataArray.length, 'records');

        dataArray.forEach((item) => {
            const data = item;
            
            // Apply filters
            if (filterBatchId && data.batchId !== filterBatchId) return;
            if (filterDate && data.date !== filterDate) return;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.date}</td>
                <td>${data.batchId}</td>
                <td>${data.batchNumber}</td>
                <td>${data.eggCount}</td>
                <td>${data.mortality}</td>
                <td>${data.feed}</td>
                <td>
                    <button class="btn btn-primary view-detail-btn" data-id="${item.id}">View</button>
                    ${data.sentToSupervisor ? '<span style="color: green;">✓ Sent</span>' : '<span style="color: orange;">Not Sent</span>'}
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Error loading data: ' + error.message, 'error');
    }
}

// View detail
window.viewDetail = async function(docId) {
    try {
        const docRef = doc(db, 'dailyData', docId);
        const querySnapshot = await getDocs(query(collection(db, 'dailyData'), where('__name__', '==', docId)));
        
        let data = null;
        querySnapshot.forEach((doc) => {
            data = doc.data();
        });

        if (!data) {
            showAlert('Data not found', 'error');
            return;
        }

        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
            <p><strong>Date:</strong> ${data.date}</p>
            <p><strong>Batch ID:</strong> ${data.batchId}</p>
            <p><strong>Batch Number:</strong> ${data.batchNumber}</p>
            <p><strong>Egg Count:</strong> ${data.eggCount}</p>
            <p><strong>Mortality:</strong> ${data.mortality}</p>
            <p><strong>Feed:</strong> ${data.feed} kg</p>
            <p><strong>Vaccination:</strong> ${data.vaccination || 'N/A'}</p>
            <p><strong>Medicine:</strong> ${data.medicine || 'N/A'}</p>
            ${data.photoUrl ? `<p><strong>Photo:</strong><br><img src="${data.photoUrl}" style="max-width: 100%; margin-top: 10px;"></p>` : ''}
            <p><strong>Sent to Supervisor:</strong> ${data.sentToSupervisor ? 'Yes' : 'No'}</p>
        `;

        document.getElementById('detailModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing detail:', error);
        showAlert('Error loading details: ' + error.message, 'error');
    }
};

window.closeDetailModal = function() {
    document.getElementById('detailModal').classList.remove('active');
};

// Apply filters
document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const filterBatchId = document.getElementById('filterBatchId').value;
    const filterDate = document.getElementById('filterDate').value;
    loadUserData(filterBatchId, filterDate);
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
