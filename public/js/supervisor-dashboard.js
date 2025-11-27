import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentSupervisor = null;
let allData = [];
let filteredData = [];
let userCharts = {};

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
                userData = JSON.parse(userData);
                if (userData.userType !== 'supervisor') {
                    window.location.href = '/user-dashboard';
                    resolve(null);
                    return;
                }
                resolve(userData);
            } else {
                // Fetch from Firestore if not in session
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                        if (userData.userType !== 'supervisor') {
                            window.location.href = '/user-dashboard';
                            resolve(null);
                            return;
                        }
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
    currentSupervisor = await checkAuth();
    if (currentSupervisor) {
        console.log('Supervisor logged in:', currentSupervisor.email);
        document.getElementById('supervisorName').textContent = currentSupervisor.fullName;
        loadAllData();
    }
});

// Show alert
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    window.scrollTo(0, 0);
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Refresh data button
document.getElementById('refreshDataBtn')?.addEventListener('click', () => {
    console.log('Refreshing data...');
    loadAllData();
});

// Load all data sent to supervisor
async function loadAllData() {
    try {
        showAlert('Loading data...', 'info');

        // Query ALL daily data (no where clause to avoid any index requirement)
        // Then filter in JavaScript
        console.log('Querying all dailyData for supervisor:', currentSupervisor.email);
        
        const querySnapshot = await getDocs(collection(db, 'dailyData'));
        allData = [];
        
        console.log('Total records in dailyData collection:', querySnapshot.size);
        console.log('Looking for records with supervisorEmail:', currentSupervisor.email);

        // Filter by supervisor email AND sentToSupervisor in JavaScript
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Document', doc.id + ':');
            console.log('  - sentToSupervisor:', data.sentToSupervisor);
            console.log('  - supervisorEmail:', data.supervisorEmail);
            console.log('  - userName:', data.userName);
            console.log('  - batchId:', data.batchId);
            
            // Only show records that are sent to this specific supervisor
            if (data.sentToSupervisor === true && data.supervisorEmail === currentSupervisor.email) {
                console.log('  ✓ MATCH! Adding to allData');
                allData.push({ id: doc.id, ...data });
            } else {
                console.log('  ✗ NO MATCH');
                if (data.sentToSupervisor !== true) {
                    console.log('    Reason: sentToSupervisor is', data.sentToSupervisor, 'expected true');
                }
                if (data.supervisorEmail !== currentSupervisor.email) {
                    console.log('    Reason: supervisorEmail is "' + data.supervisorEmail + '" expected "' + currentSupervisor.email + '"');
                }
            }
        });
        
        console.log('Records for', currentSupervisor.email + ':', allData.length);
        if (allData.length > 0) {
            console.log('Sample data:', allData[0]);
        }
        
        // Sort by date descending (newest first)
        allData.sort((a, b) => b.date.localeCompare(a.date));

        filteredData = [...allData];
        
        if (allData.length === 0) {
            showAlert('No data received yet. Users need to send data to your email: ' + currentSupervisor.email, 'warning');
        } else {
            showAlert(`Loaded ${allData.length} record(s) successfully!`, 'success');
        }
        
        updateStatistics();
        populateUserFilter();
        displayUserBatches();

    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Error loading data: ' + error.message, 'error');
    }
}

// Update statistics
function updateStatistics() {
    const uniqueUsers = new Set(filteredData.map(d => d.userId));
    const uniqueBatches = new Set(filteredData.map(d => d.batchId));
    
    const today = new Date().toISOString().split('T')[0];
    const todayData = filteredData.filter(d => d.date === today);
    
    const todayEggs = todayData.reduce((sum, d) => sum + (d.eggCount || 0), 0);
    const todayMortality = todayData.reduce((sum, d) => sum + (d.mortality || 0), 0);

    document.getElementById('totalUsers').textContent = uniqueUsers.size;
    document.getElementById('totalBatches').textContent = uniqueBatches.size;
    document.getElementById('todayEggs').textContent = todayEggs;
    document.getElementById('todayMortality').textContent = todayMortality;
}

// Populate user filter
function populateUserFilter() {
    const userFilter = document.getElementById('filterUser');
    const uniqueUsers = new Map();
    
    allData.forEach(d => {
        if (!uniqueUsers.has(d.userId)) {
            uniqueUsers.set(d.userId, d.userName);
        }
    });

    userFilter.innerHTML = '<option value="">All Users</option>';
    uniqueUsers.forEach((name, id) => {
        userFilter.innerHTML += `<option value="${id}">${name}</option>`;
    });
}

// Event delegation for view full detail buttons
document.getElementById('userBatchesContainer')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('view-full-detail-btn')) {
        const id = e.target.getAttribute('data-id');
        viewFullDetail(id);
    }
});

// Display user batches
function displayUserBatches() {
    const container = document.getElementById('userBatchesContainer');
    container.innerHTML = '';
    
    console.log('displayUserBatches called with filteredData:', filteredData.length, 'records');

    if (filteredData.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 2rem; color: #666;">No data sent to you yet. Users need to click "Send to Supervisor" with your email: <strong>' + currentSupervisor.email + '</strong></p>';
        return;
    }

    // Group by user and batch
    const groupedData = {};
    
    console.log('Grouping data by user and batch...');
    filteredData.forEach(data => {
        const userKey = data.userId;
        if (!groupedData[userKey]) {
            groupedData[userKey] = {
                userName: data.userName,
                farmName: data.farmName,
                batches: {}
            };
        }
        
        const batchKey = data.batchId;
        if (!groupedData[userKey].batches[batchKey]) {
            groupedData[userKey].batches[batchKey] = [];
        }
        
        groupedData[userKey].batches[batchKey].push(data);
    });

    console.log('Grouped data by users:', Object.keys(groupedData).length, 'users');
    console.log('Grouped data structure:', groupedData);

    // Display each user's data
    Object.keys(groupedData).forEach(userId => {
        const userData = groupedData[userId];
        console.log('Displaying user:', userData.userName, 'with', Object.keys(userData.batches).length, 'batches');
        
        const userCard = document.createElement('div');
        userCard.className = 'card';
        userCard.style.marginBottom = '2rem';
        
        let batchesHtml = '';
        Object.keys(userData.batches).forEach(batchId => {
            const batchData = userData.batches[batchId];
            batchData.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            batchesHtml += `
                <div style="margin-bottom: 2rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                    <h4>Batch ID: ${batchId}</h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Eggs</th>
                                    <th>Mortality</th>
                                    <th>Feed (kg)</th>
                                    <th>Vaccination</th>
                                    <th>Medicine</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${batchData.map(d => `
                                    <tr>
                                        <td>${d.date}</td>
                                        <td>${d.eggCount}</td>
                                        <td>${d.mortality}</td>
                                        <td>${d.feed}</td>
                                        <td>${d.vaccination || 'N/A'}</td>
                                        <td>${d.medicine || 'N/A'}</td>
                                        <td>
                                            <button class="btn btn-primary view-full-detail-btn" data-id="${d.id}">View Full</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="margin-top: 1.5rem;">
                        <h5>Egg Production Trend</h5>
                        <div class="chart-container">
                            <canvas id="eggChart_${userId}_${batchId}"></canvas>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem;">
                        <h5>Mortality Trend</h5>
                        <div class="chart-container">
                            <canvas id="mortalityChart_${userId}_${batchId}"></canvas>
                        </div>
                    </div>
                </div>
            `;
        });

        userCard.innerHTML = `
            <div class="card-header" style="background: linear-gradient(135deg, #2563eb, #1e40af); color: white; margin: -2rem -2rem 2rem -2rem; padding: 1.5rem 2rem;">
                <h3 style="margin: 0; color: white;">${userData.userName}</h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">${userData.farmName}</p>
            </div>
            ${batchesHtml}
        `;
        
        container.appendChild(userCard);

        // Create charts for each batch
        setTimeout(() => {
            Object.keys(userData.batches).forEach(batchId => {
                createBatchCharts(userId, batchId, userData.batches[batchId]);
            });
        }, 100);
    });
}

// Create charts for batch
function createBatchCharts(userId, batchId, batchData) {
    const sortedData = [...batchData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = sortedData.map(d => d.date);
    const eggs = sortedData.map(d => d.eggCount);
    const mortality = sortedData.map(d => d.mortality);

    // Egg chart
    const eggCtx = document.getElementById(`eggChart_${userId}_${batchId}`);
    if (eggCtx) {
        new Chart(eggCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Egg Count',
                    data: eggs,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                }
            }
        });
    }

    // Mortality chart
    const mortalityCtx = document.getElementById(`mortalityChart_${userId}_${batchId}`);
    if (mortalityCtx) {
        new Chart(mortalityCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Mortality',
                    data: mortality,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                }
            }
        });
    }
}

// View full detail
window.viewFullDetail = function(dataId) {
    const data = allData.find(d => d.id === dataId);
    if (!data) {
        showAlert('Data not found', 'error');
        return;
    }

    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div>
                <p><strong>User:</strong> ${data.userName}</p>
                <p><strong>Farm:</strong> ${data.farmName}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Batch ID:</strong> ${data.batchId}</p>
                <p><strong>Batch Number:</strong> ${data.batchNumber}</p>
            </div>
            <div>
                <p><strong>Egg Count:</strong> ${data.eggCount}</p>
                <p><strong>Mortality:</strong> ${data.mortality}</p>
                <p><strong>Feed:</strong> ${data.feed} kg</p>
                <p><strong>Vaccination:</strong> ${data.vaccination || 'N/A'}</p>
                <p><strong>Medicine:</strong> ${data.medicine || 'N/A'}</p>
            </div>
        </div>
        ${data.photoUrl ? `<div style="margin-top: 1rem;"><strong>Photo:</strong><br><img src="${data.photoUrl}" style="max-width: 100%; margin-top: 10px; border-radius: 8px;"></div>` : ''}
    `;

    document.getElementById('detailModal').classList.add('active');
};

window.closeDetailModal = function() {
    document.getElementById('detailModal').classList.remove('active');
};

// Apply filters
document.getElementById('applyFiltersBtn').addEventListener('click', () => {
    const userId = document.getElementById('filterUser').value;
    const batchId = document.getElementById('filterBatchId').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const dataType = document.getElementById('filterDataType').value;

    filteredData = allData.filter(data => {
        if (userId && data.userId !== userId) return false;
        if (batchId && data.batchId !== batchId) return false;
        if (dateFrom && data.date < dateFrom) return false;
        if (dateTo && data.date > dateTo) return false;
        
        if (dataType) {
            switch(dataType) {
                case 'eggs': return data.eggCount > 0;
                case 'mortality': return data.mortality > 0;
                case 'feed': return data.feed > 0;
                case 'vaccination': return data.vaccination && data.vaccination.trim() !== '';
                case 'medicine': return data.medicine && data.medicine.trim() !== '';
            }
        }
        
        return true;
    });

    updateStatistics();
    displayUserBatches();
    showAlert('Filters applied', 'success');
});

// Clear filters
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('filterUser').value = '';
    document.getElementById('filterBatchId').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterDataType').value = '';
    
    filteredData = [...allData];
    updateStatistics();
    displayUserBatches();
    showAlert('Filters cleared', 'info');
});

// Monthly view
document.getElementById('monthlyViewBtn').addEventListener('click', () => {
    const monthlyCard = document.getElementById('monthlyViewCard');
    monthlyCard.classList.toggle('hidden');
    
    if (!monthlyCard.classList.contains('hidden')) {
        createMonthlyCharts();
    }
});

// Create monthly comparison charts
function createMonthlyCharts() {
    // Group data by user and date
    const userDataMap = new Map();
    
    filteredData.forEach(data => {
        if (!userDataMap.has(data.userId)) {
            userDataMap.set(data.userId, {
                userName: data.userName,
                dates: [],
                eggs: [],
                mortality: []
            });
        }
        
        const userData = userDataMap.get(data.userId);
        const dateIndex = userData.dates.indexOf(data.date);
        
        if (dateIndex === -1) {
            userData.dates.push(data.date);
            userData.eggs.push(data.eggCount);
            userData.mortality.push(data.mortality);
        } else {
            userData.eggs[dateIndex] += data.eggCount;
            userData.mortality[dateIndex] += data.mortality;
        }
    });

    // Get all unique dates
    const allDates = new Set();
    userDataMap.forEach(userData => {
        userData.dates.forEach(date => allDates.add(date));
    });
    const sortedDates = Array.from(allDates).sort();

    // Prepare datasets for eggs
    const eggDatasets = [];
    const mortalityDatasets = [];
    const colors = [
        '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];
    
    let colorIndex = 0;
    userDataMap.forEach((userData, userId) => {
        const color = colors[colorIndex % colors.length];
        
        // Align data with all dates
        const alignedEggs = sortedDates.map(date => {
            const index = userData.dates.indexOf(date);
            return index !== -1 ? userData.eggs[index] : 0;
        });
        
        const alignedMortality = sortedDates.map(date => {
            const index = userData.dates.indexOf(date);
            return index !== -1 ? userData.mortality[index] : 0;
        });
        
        eggDatasets.push({
            label: userData.userName,
            data: alignedEggs,
            borderColor: color,
            backgroundColor: color + '20',
            tension: 0.4
        });
        
        mortalityDatasets.push({
            label: userData.userName,
            data: alignedMortality,
            borderColor: color,
            backgroundColor: color + '20',
            tension: 0.4
        });
        
        colorIndex++;
    });

    // Create egg comparison chart
    const eggCtx = document.getElementById('monthlyEggsChart');
    if (eggCtx) {
        if (userCharts.monthlyEggs) {
            userCharts.monthlyEggs.destroy();
        }
        userCharts.monthlyEggs = new Chart(eggCtx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: eggDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Egg Production Comparison - All Users'
                    },
                    legend: { display: true }
                }
            }
        });
    }

    // Create mortality comparison chart
    const mortalityCtx = document.getElementById('monthlyMortalityChart');
    if (mortalityCtx) {
        if (userCharts.monthlyMortality) {
            userCharts.monthlyMortality.destroy();
        }
        userCharts.monthlyMortality = new Chart(mortalityCtx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: mortalityDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Mortality Comparison - All Users'
                    },
                    legend: { display: true }
                }
            }
        });
    }
}

// Generate PDF Report
document.getElementById('generateReportBtn').addEventListener('click', () => {
    import('./pdf-report.js').then(module => {
        module.generatePDFReport(filteredData, currentSupervisor);
    });
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
