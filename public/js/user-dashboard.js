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
    getDoc,
    deleteDoc
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
    console.log('DOM Content Loaded');
    try {
        currentUser = await checkAuth();
        console.log('Current user:', currentUser);
        
        if (currentUser) {
            console.log('User logged in:', currentUser.email);
            document.getElementById('userName').textContent = currentUser.fullName || 'User';
            document.getElementById('farmName').textContent = currentUser.farmName || 'N/A';
            loadUserData();
            
            // Initialize tabs
            initializeTabs();
        } else {
            console.log('No user logged in');
        }
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
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
        // Check file size (limit to 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (file.size > maxSize) {
            showAlert('❌ Photo size too large! Please upload a photo smaller than 5MB.', 'error');
            e.target.value = ''; // Clear the input
            document.getElementById('photoPreview').classList.add('hidden');
            uploadedPhotoFile = null;
            return;
        }
        
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
            console.log('Uploading photo:', uploadedPhotoFile.name, 'Size:', uploadedPhotoFile.size);
            try {
                const photoRef = ref(storage, `photos/${currentUser.uid}/${Date.now()}_${uploadedPhotoFile.name}`);
                console.log('Photo ref created, uploading...');
                await uploadBytes(photoRef, uploadedPhotoFile);
                console.log('Photo uploaded, getting URL...');
                formData.photoUrl = await getDownloadURL(photoRef);
                console.log('Photo URL obtained:', formData.photoUrl);
            } catch (photoError) {
                console.error('Photo upload error:', photoError);
                showAlert('❌ Error uploading photo: ' + photoError.message + '\n\nSaving data without photo...', 'warning');
                // Continue without photo
            }
        }

        // Save to Firestore
        console.log('Saving to Firestore...', formData);
        const docRef = await addDoc(collection(db, 'dailyData'), formData);
        console.log('Data saved with ID:', docRef.id);

        showAlert('✅ Data saved successfully!\n\n💡 You can now click "📤 Send to Supervisor" to share this data.', 'success');
        
        // Don't reset the form - keep it filled so user can directly send to supervisor
        // Just add the new entry to the table without reloading
        const tbody = document.getElementById('dataTableBody');
        
        // Remove "No data" message if it exists
        const noDataRow = tbody.querySelector('tr td[colspan="7"]');
        if (noDataRow) {
            tbody.innerHTML = '';
        }
        
        // Add new row at the top
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formData.date}</td>
            <td>${formData.batchId}</td>
            <td>${formData.batchNumber}</td>
            <td>${formData.eggCount}</td>
            <td>${formData.mortality}</td>
            <td>${formData.feed}</td>
            <td>
                <button class="btn btn-primary view-detail-btn" data-id="${docRef.id}" style="margin-right: 5px;">View</button>
                <button class="btn btn-danger delete-data-btn" data-id="${docRef.id}" style="margin-right: 5px;">Delete</button>
                <br>
                <span style="color: orange;">Not Sent</span>
            </td>
        `;
        tbody.insertBefore(row, tbody.firstChild);

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

// Event delegation for view detail, send, and delete buttons
document.getElementById('dataTableBody')?.addEventListener('click', async (e) => {
    if (e.target.classList.contains('view-detail-btn')) {
        const id = e.target.getAttribute('data-id');
        viewDetail(id);
    }
    if (e.target.classList.contains('send-single-btn')) {
        const id = e.target.getAttribute('data-id');
        const batchId = e.target.getAttribute('data-batchid');
        const date = e.target.getAttribute('data-date');
        await sendSingleDataToSupervisor(id, batchId, date);
    }
    if (e.target.classList.contains('delete-data-btn')) {
        const id = e.target.getAttribute('data-id');
        deleteDailyData(id);
    }
});

// Load user data
async function loadUserData(filterBatchId = '', filterBatchNumber = '', filterDate = '') {
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
            if (filterBatchNumber && data.batchNumber !== parseInt(filterBatchNumber)) return;
            if (filterDate && data.date !== filterDate) return;

            const row = document.createElement('tr');
            
            // Create action buttons based on sent status
            let actionButtons = `
                <button class="btn btn-info view-detail-btn" data-id="${item.id}" style="margin: 2px;">👁️ View</button>
            `;
            
            // Show "Send to Supervisor" button only if NOT sent yet
            if (!data.sentToSupervisor) {
                actionButtons += `
                    <button class="btn btn-success send-single-btn" data-id="${item.id}" data-batchid="${data.batchId}" data-date="${data.date}" style="margin: 2px;">📤 Send</button>
                `;
            }
            
            // Always show Delete button
            actionButtons += `
                <button class="btn btn-danger delete-data-btn" data-id="${item.id}" style="margin: 2px;">🗑️ Delete</button>
            `;
            
            // Status badge
            const statusBadge = data.sentToSupervisor 
                ? '<br><span style="color: green; font-weight: bold;">✓ Sent to Supervisor</span>' 
                : '<br><span style="color: orange;">⏳ Not Sent</span>';
            
            row.innerHTML = `
                <td>${data.date}</td>
                <td>${data.batchId}</td>
                <td>${data.batchNumber}</td>
                <td>${data.eggCount}</td>
                <td>${data.mortality}</td>
                <td>${data.feed}</td>
                <td>
                    ${actionButtons}
                    ${statusBadge}
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

// Send single data entry to supervisor
async function sendSingleDataToSupervisor(docId, batchId, date) {
    const supervisorEmail = prompt(`Send data for Batch ${batchId} (${date}) to supervisor?\n\nEnter supervisor email:`);
    
    if (!supervisorEmail) {
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supervisorEmail)) {
        alert('⚠️ Please enter a valid email address');
        return;
    }
    
    try {
        showAlert('Sending to supervisor...', 'info');
        
        // Update this specific document
        await updateDoc(doc(db, 'dailyData', docId), {
            sentToSupervisor: true,
            supervisorEmail: supervisorEmail,
            sentAt: new Date().toISOString()
        });
        
        console.log('✅ Data sent to supervisor:', docId);
        alert(`✅ Data sent successfully to ${supervisorEmail}!`);
        
        // Reload the table to update the button
        await loadUserData();
        
    } catch (error) {
        console.error('❌ Error sending to supervisor:', error);
        alert('❌ Error sending data: ' + error.message);
    }
}

// Delete daily data entry
async function deleteDailyData(docId) {
    if (!confirm('⚠️ Are you sure you want to delete this daily data entry?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete the document from Firestore
        await deleteDoc(doc(db, 'dailyData', docId));
        
        // Remove the row from the table without refreshing
        const deleteBtn = document.querySelector(`button.delete-data-btn[data-id="${docId}"]`);
        if (deleteBtn) {
            const row = deleteBtn.closest('tr');
            if (row) {
                row.remove();
            }
        }
        
        showAlert('✅ Daily data entry deleted successfully!', 'success');
        
        // Check if table is empty after deletion
        const tbody = document.getElementById('dataTableBody');
        if (tbody.querySelectorAll('tr').length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No data saved yet. Add your first entry above!</td></tr>';
        }
        
    } catch (error) {
        console.error('Error deleting daily data:', error);
        showAlert('❌ Error deleting daily data: ' + error.message, 'error');
    }
}

// Apply filters
document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const filterBatchId = document.getElementById('filterBatchId').value;
    const filterBatchNumber = document.getElementById('filterBatchNumber').value;
    const filterDate = document.getElementById('filterDate').value;
    loadUserData(filterBatchId, filterBatchNumber, filterDate);
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

// ============ TAB FUNCTIONALITY ============
function initializeTabs() {
    console.log('Initializing tabs...');
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            console.log('Switching to tab:', tabName);
            
            // Remove active class from all
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active to clicked
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load income data when switching to income tab
            if (tabName === 'income') {
                loadIncomeData();
            }
        });
    });
    
    // Set today's date as default for income form
    const incomeDateField = document.getElementById('incomeDate');
    if (incomeDateField) {
        incomeDateField.valueAsDate = new Date();
    }
    
    // Initialize income form submission
    const incomeForm = document.getElementById('incomeForm');
    if (incomeForm) {
        incomeForm.addEventListener('submit', handleIncomeFormSubmit);
    }
    
    // Initialize income filter button
    const applyIncomeFilterBtn = document.getElementById('applyIncomeFilterBtn');
    if (applyIncomeFilterBtn) {
        applyIncomeFilterBtn.addEventListener('click', () => {
            const filterType = document.getElementById('filterIncomeType').value;
            const filterFromDate = document.getElementById('filterIncomeFromDate').value;
            const filterToDate = document.getElementById('filterIncomeToDate').value;
            loadIncomeData(filterType, filterFromDate, filterToDate);
        });
    }
    
    // Initialize view graph button
    const viewIncomeGraphBtn = document.getElementById('viewIncomeGraphBtn');
    if (viewIncomeGraphBtn) {
        viewIncomeGraphBtn.addEventListener('click', async () => {
            await loadIncomeGraph();
            document.getElementById('incomeGraphModal').classList.add('active');
        });
    }
    
    // Initialize send income to supervisor button
    const sendIncomeToSupervisorBtn = document.getElementById('sendIncomeToSupervisorBtn');
    if (sendIncomeToSupervisorBtn) {
        sendIncomeToSupervisorBtn.addEventListener('click', handleSendIncomeToSupervisor);
    }
    
    console.log('Tabs initialized successfully');
}

// ============ INCOME FUNCTIONALITY ============

// Save income entry
async function handleIncomeFormSubmit(e) {
    e.preventDefault();
    console.log('Income form submitted');
    
    try {
        console.log('Current user:', currentUser);
        if (!currentUser) {
            alert('User not logged in. Please refresh the page.');
            return;
        }
        
        showAlert('Saving income entry...', 'info');
        
        const incomeData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.fullName || currentUser.email,
            farmName: currentUser.farmName || 'N/A',
            incomeType: document.getElementById('incomeType').value,
            date: document.getElementById('incomeDate').value,
            batchId: document.getElementById('incomeBatchId').value || 'N/A',
            quantity: parseFloat(document.getElementById('incomeQuantity').value || 0),
            unit: document.getElementById('incomeUnit').value || 'eggs',
            amount: parseFloat(document.getElementById('incomeAmount').value),
            notes: document.getElementById('incomeNotes').value || '',
            createdAt: new Date().toISOString()
        };
        
        console.log('Income data to save:', incomeData);
        
        const docRef = await addDoc(collection(db, 'income'), incomeData);
        console.log('Income saved with ID:', docRef.id);
        
        showAlert('✅ Income saved successfully!\n\n💡 You can now click "📤 Send to Supervisor" to share this data.', 'success');
        
        // Add new entry to the table without full reload
        const tbody = document.getElementById('incomeTableBody');
        
        // Remove "No income entries" message if it exists
        const noDataRow = tbody.querySelector('tr td[colspan="7"]');
        if (noDataRow) {
            tbody.innerHTML = '';
        }
        
        const newRow = createIncomeTableRow({
            id: docRef.id,
            ...incomeData,
            sentToSupervisor: false
        });
        tbody.insertBefore(newRow, tbody.firstChild);
        
        // Recalculate totals
        recalculateIncomeTotals();
        
        // Don't reset the form - keep it filled so user can directly send to supervisor
        
    } catch (error) {
        console.error('❌ Error saving income:', error);
        console.error('Error details:', error.message);
        alert('❌ Error saving income: ' + error.message + '\n\nPlease check the console for details.');
    }
}

// Send income to supervisor
async function handleSendIncomeToSupervisor() {
    const supervisorEmailInput = document.getElementById('incomeSupervisorEmail').value.trim();
    const incomeType = document.getElementById('incomeType').value;
    const dateInput = document.getElementById('incomeDate').value;

    console.log('=== SEND INCOME TO SUPERVISOR CLICKED ===');
    console.log('Supervisor Email:', supervisorEmailInput);
    console.log('Income Type:', incomeType);
    console.log('Date:', dateInput);
    console.log('User ID:', currentUser.uid);

    if (!supervisorEmailInput) {
        alert('⚠️ Please enter supervisor email first!\n\nThe supervisor email field is required to send income data.');
        document.getElementById('incomeSupervisorEmail').focus();
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supervisorEmailInput)) {
        alert('⚠️ Please enter a valid email address');
        document.getElementById('incomeSupervisorEmail').focus();
        return;
    }

    if (!incomeType || !dateInput) {
        alert('⚠️ Please select income type and date first, then save the income entry before sending.');
        return;
    }

    if (!confirm(`Send income data for ${incomeType} (${dateInput}) to ${supervisorEmailInput}?`)) {
        return;
    }

    try {
        showAlert('Sending income data to supervisor...', 'info');

        // Find income entries for this type and date
        const q = query(
            collection(db, 'income'),
            where('userId', '==', currentUser.uid),
            where('incomeType', '==', incomeType),
            where('date', '==', dateInput)
        );

        const querySnapshot = await getDocs(q);
        console.log('Found income entries to send:', querySnapshot.size);

        if (querySnapshot.empty) {
            alert('❌ No saved income data found for this type and date.\n\nPlease:\n1. Fill in the form\n2. Click "💾 Save Income Entry" first\n3. Then click "📤 Send to Supervisor"');
            return;
        }

        const updatePromises = [];
        querySnapshot.forEach((docSnapshot) => {
            console.log('📤 Updating income document:', docSnapshot.id);
            console.log('   Setting sentToSupervisor: true');
            console.log('   Setting supervisorEmail:', supervisorEmailInput);
            
            updatePromises.push(
                updateDoc(doc(db, 'income', docSnapshot.id), {
                    sentToSupervisor: true,
                    supervisorEmail: supervisorEmailInput,
                    sentAt: new Date().toISOString()
                })
            );
        });

        await Promise.all(updatePromises);
        console.log('✅ All income documents updated successfully');
        alert(`✅ Income data sent successfully!\n\nSent ${querySnapshot.size} entry(s) to ${supervisorEmailInput}`);
        // Don't reload income data - keep the table as is

    } catch (error) {
        console.error('❌ Error sending income to supervisor:', error);
        alert('❌ Error sending data: ' + error.message);
    }
}

// Helper function to create income table row
function createIncomeTableRow(item) {
    const row = document.createElement('tr');
    
    const typeIcon = item.incomeType === 'Egg Sale' ? '🥚' : '🍗';
    const sentStatus = item.sentToSupervisor 
        ? '<span class="badge badge-success">✓ Sent</span>' 
        : '<span class="badge badge-secondary">Not Sent</span>';
    
    row.innerHTML = `
        <td>${item.date}</td>
        <td>${typeIcon} ${item.incomeType}</td>
        <td>${item.batchId}</td>
        <td>${item.quantity} ${item.unit}</td>
        <td style="font-weight: bold; color: #10b981;">₹${item.amount.toFixed(2)}</td>
        <td>${sentStatus}</td>
        <td>
            <button class="btn btn-info view-income-btn" data-id="${item.id}" style="margin-right: 5px;">View</button>
            <button class="btn btn-danger delete-income-btn" data-id="${item.id}">Delete</button>
        </td>
    `;
    
    // Add event listeners
    row.querySelector('.view-income-btn').addEventListener('click', () => {
        viewIncomeDetail(item.id);
    });
    
    row.querySelector('.delete-income-btn').addEventListener('click', async () => {
        await deleteIncomeEntry(item.id);
    });
    
    return row;
}

// Load income data
async function loadIncomeData(filterType = '', filterFromDate = '', filterToDate = '') {
    try {
        let q = query(
            collection(db, 'income'),
            where('userId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('incomeTableBody');
        tbody.innerHTML = '';
        
        let allIncomeData = [];
        querySnapshot.forEach((doc) => {
            allIncomeData.push({ id: doc.id, ...doc.data() });
        });
        
        // Apply filters
        let filteredData = allIncomeData;
        
        if (filterType) {
            filteredData = filteredData.filter(item => item.incomeType === filterType);
        }
        
        if (filterFromDate) {
            filteredData = filteredData.filter(item => item.date >= filterFromDate);
        }
        
        if (filterToDate) {
            filteredData = filteredData.filter(item => item.date <= filterToDate);
        }
        
        // Sort by date descending
        filteredData.sort((a, b) => b.date.localeCompare(a.date));
        
        // Calculate totals
        let totalIncome = 0;
        let totalEggSales = 0;
        let totalMeatSales = 0;
        
        filteredData.forEach(item => {
            totalIncome += item.amount;
            if (item.incomeType === 'Egg Sale') {
                totalEggSales += item.amount;
            } else if (item.incomeType === 'Meat Sale') {
                totalMeatSales += item.amount;
            }
        });
        
        // Update summary
        document.getElementById('totalIncome').textContent = totalIncome.toFixed(2);
        document.getElementById('totalEggSales').textContent = totalEggSales.toFixed(2);
        document.getElementById('totalMeatSales').textContent = totalMeatSales.toFixed(2);
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No income entries available</td></tr>';
            return;
        }
        
        filteredData.forEach(item => {
            const row = createIncomeTableRow(item);
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading income data:', error);
        showAlert('Error loading income data: ' + error.message, 'error');
    }
}

// View income detail
async function viewIncomeDetail(docId) {
    try {
        const docRef = doc(db, 'income', docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            showAlert('Income entry not found', 'error');
            return;
        }
        
        const data = docSnap.data();
        const typeIcon = data.incomeType === 'Egg Sale' ? '🥚' : '🍗';
        
        const detailContent = document.getElementById('incomeDetailContent');
        detailContent.innerHTML = `
            <div style="padding: 1.5rem;">
                <p style="margin: 0.5rem 0;"><strong>Income Type:</strong> ${typeIcon} ${data.incomeType}</p>
                <p style="margin: 0.5rem 0;"><strong>Date:</strong> ${data.date}</p>
                <p style="margin: 0.5rem 0;"><strong>Batch ID:</strong> ${data.batchId}</p>
                <p style="margin: 0.5rem 0;"><strong>Quantity:</strong> ${data.quantity} ${data.unit}</p>
                <p style="margin: 0.5rem 0;"><strong>Amount:</strong> <span style="font-size: 1.5rem; font-weight: bold; color: #10b981;">₹${data.amount.toFixed(2)}</span></p>
                ${data.notes ? `<p style="margin: 0.5rem 0;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
                <p style="margin: 0.5rem 0; color: #666; font-size: 0.9rem;"><strong>Created:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
            </div>
        `;
        
        document.getElementById('incomeDetailModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing income detail:', error);
        showAlert('Error loading details: ' + error.message, 'error');
    }
}

// Close income detail modal
window.closeIncomeDetailModal = function() {
    document.getElementById('incomeDetailModal').classList.remove('active');
};

// Delete income entry
async function deleteIncomeEntry(docId) {
    if (!confirm('⚠️ Are you sure you want to delete this income entry?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete the document from Firestore
        await deleteDoc(doc(db, 'income', docId));
        
        // Remove the row from the table without refreshing
        const deleteBtn = document.querySelector(`button.delete-income-btn[data-id="${docId}"]`);
        if (deleteBtn) {
            const row = deleteBtn.closest('tr');
            if (row) {
                row.remove();
            }
        }
        
        showAlert('✅ Income entry deleted successfully!', 'success');
        
        // Recalculate totals
        recalculateIncomeTotals();
        
    } catch (error) {
        console.error('Error deleting income entry:', error);
        showAlert('❌ Error deleting income entry: ' + error.message, 'error');
    }
}

// Recalculate income totals from visible table rows
function recalculateIncomeTotals() {
    const tbody = document.getElementById('incomeTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    let totalIncome = 0;
    let totalEggSales = 0;
    let totalMeatSales = 0;
    
    rows.forEach(row => {
        const cells = row.cells;
        if (cells.length > 1) {
            const typeCell = cells[1].textContent;
            const amountCell = cells[4].textContent;
            const amount = parseFloat(amountCell.replace('₹', '').replace(',', ''));
            
            if (!isNaN(amount)) {
                totalIncome += amount;
                if (typeCell.includes('Egg Sale')) {
                    totalEggSales += amount;
                } else if (typeCell.includes('Meat Sale')) {
                    totalMeatSales += amount;
                }
            }
        }
    });
    
    document.getElementById('totalIncome').textContent = totalIncome.toFixed(2);
    document.getElementById('totalEggSales').textContent = totalEggSales.toFixed(2);
    document.getElementById('totalMeatSales').textContent = totalMeatSales.toFixed(2);
}

// Close income graph modal
window.closeIncomeGraphModal = function() {
    document.getElementById('incomeGraphModal').classList.remove('active');
};

// Load income graph
async function loadIncomeGraph() {
    try {
        const q = query(
            collection(db, 'income'),
            where('userId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        // Group by month
        const monthlyData = {};
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = new Date(data.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    total: 0,
                    eggSales: 0,
                    meatSales: 0
                };
            }
            
            monthlyData[monthKey].total += data.amount;
            
            if (data.incomeType === 'Egg Sale') {
                monthlyData[monthKey].eggSales += data.amount;
            } else if (data.incomeType === 'Meat Sale') {
                monthlyData[monthKey].meatSales += data.amount;
            }
        });
        
        // Sort by month
        const sortedMonths = Object.keys(monthlyData).sort();
        
        const labels = sortedMonths.map(m => {
            const [year, month] = m.split('-');
            const date = new Date(year, month - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });
        
        const totalData = sortedMonths.map(m => monthlyData[m].total);
        const eggSalesData = sortedMonths.map(m => monthlyData[m].eggSales);
        const meatSalesData = sortedMonths.map(m => monthlyData[m].meatSales);
        
        // Destroy existing chart if it exists
        const existingChart = Chart.getChart('incomeChart');
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Create chart
        const ctx = document.getElementById('incomeChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Egg Sales (₹)',
                        data: eggSalesData,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Meat Sales (₹)',
                        data: meatSalesData,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Income Trend',
                        font: {
                            size: 18
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ₹' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value;
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading income graph:', error);
        showAlert('Error loading graph: ' + error.message, 'error');
    }
}
