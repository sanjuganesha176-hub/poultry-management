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
let supervisorIncomeData = [];

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
        loadSupervisorIncomeData();
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
    loadSupervisorIncomeData();
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
    
    if (e.target.classList.contains('monthly-view-btn')) {
        const userId = e.target.getAttribute('data-userid');
        const userName = e.target.getAttribute('data-username');
        showMonthlyViewForUser(userId, userName);
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
                        <h5>📊 Egg Production & Mortality Trend</h5>
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="combinedChart_${userId}_${batchId}"></canvas>
                        </div>
                    </div>
                </div>
            `;
        });

        userCard.innerHTML = `
            <div class="card-header" style="background: linear-gradient(135deg, #2563eb, #1e40af); color: white; margin: -2rem -2rem 2rem -2rem; padding: 1.5rem 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; color: white;">${userData.userName}</h3>
                        <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">${userData.farmName}</p>
                    </div>
                    <button class="btn btn-success monthly-view-btn" data-userid="${userId}" data-username="${userData.userName}" style="background: white; color: #2563eb;">
                        📅 Monthly View
                    </button>
                </div>
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

    // Combined chart with dual y-axes
    const combinedCtx = document.getElementById(`combinedChart_${userId}_${batchId}`);
    if (combinedCtx) {
        new Chart(combinedCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: '🥚 Egg Production',
                        data: eggs,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: '💀 Mortality',
                        data: mortality,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { 
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Egg Count',
                            color: '#10b981'
                        },
                        ticks: {
                            color: '#10b981'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Mortality',
                            color: '#ef4444'
                        },
                        ticks: {
                            color: '#ef4444'
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
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

// Monthly View for Individual User
function showMonthlyViewForUser(userId, userName) {
    const userMonthlyData = filteredData.filter(d => d.userId === userId);
    
    if (userMonthlyData.length === 0) {
        alert('No data available for this user');
        return;
    }
    
    // Group data by month
    const monthlyData = {};
    userMonthlyData.forEach(data => {
        const month = data.date.substring(0, 7); // Get YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = {
                totalEggs: 0,
                totalMortality: 0,
                totalFeed: 0,
                count: 0
            };
        }
        monthlyData[month].totalEggs += data.eggCount;
        monthlyData[month].totalMortality += data.mortality;
        monthlyData[month].totalFeed += data.feed;
        monthlyData[month].count += 1;
    });
    
    const months = Object.keys(monthlyData).sort();
    const eggData = months.map(m => monthlyData[m].totalEggs);
    const mortalityData = months.map(m => monthlyData[m].totalMortality);
    const feedData = months.map(m => monthlyData[m].totalFeed);
    
    // Show modal
    document.getElementById('monthlyViewModal').classList.add('active');
    document.getElementById('monthlyViewTitle').textContent = `Monthly View - ${userName}`;
    
    // Create chart
    const ctx = document.getElementById('monthlyViewChart').getContext('2d');
    
    // Destroy existing chart if any
    if (userCharts.monthlyView) {
        userCharts.monthlyView.destroy();
    }
    
    userCharts.monthlyView = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Total Eggs',
                    data: eggData,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1
                },
                {
                    label: 'Total Mortality',
                    data: mortalityData,
                    backgroundColor: '#ef4444',
                    borderColor: '#dc2626',
                    borderWidth: 1
                },
                {
                    label: 'Total Feed (kg)',
                    data: feedData,
                    backgroundColor: '#f59e0b',
                    borderColor: '#d97706',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Monthly Summary for ${userName}`
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

window.closeMonthlyViewModal = function() {
    document.getElementById('monthlyViewModal').classList.remove('active');
};

// Generate PDF Report
document.getElementById('generateReportBtn').addEventListener('click', () => {
    import('./pdf-report.js').then(module => {
        module.generatePDFReport(filteredData, currentSupervisor);
    });
});

// Generate Income PDF Report
document.getElementById('generateIncomeReportBtn')?.addEventListener('click', () => {
    console.log('Generate Income PDF clicked');
    console.log('Income data:', supervisorIncomeData);
    console.log('Supervisor:', currentSupervisor);
    
    if (!supervisorIncomeData || supervisorIncomeData.length === 0) {
        alert('No income data available. Please make sure income entries have been sent to you.');
        return;
    }
    
    import('./pdf-report.js').then(module => {
        console.log('PDF module loaded, generating report...');
        module.generateIncomePDFReport(supervisorIncomeData, currentSupervisor);
    }).catch(error => {
        console.error('Error loading PDF module:', error);
        alert('Error loading PDF generator: ' + error.message);
    });
});

// ============ INCOME FUNCTIONALITY FOR SUPERVISOR ============

// Load income data sent to supervisor
async function loadSupervisorIncomeData() {
    try {
        console.log('Loading income data for supervisor:', currentSupervisor.email);
        
        const q = query(collection(db, 'income'));
        const querySnapshot = await getDocs(q);
        
        let incomeData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Filter by supervisor email and sentToSupervisor flag
            if (data.sentToSupervisor === true && data.supervisorEmail === currentSupervisor.email) {
                incomeData.push({ id: doc.id, ...data });
            }
        });
        
        // Store in global variable for PDF generation
        supervisorIncomeData = incomeData;
        
        console.log('Found income entries for supervisor:', incomeData.length);
        
        // Sort by date descending
        incomeData.sort((a, b) => b.date.localeCompare(a.date));
        
        // Calculate totals
        let totalIncome = 0;
        let eggSales = 0;
        let meatSales = 0;
        
        incomeData.forEach(item => {
            totalIncome += item.amount;
            if (item.incomeType === 'Egg Sale') {
                eggSales += item.amount;
            } else if (item.incomeType === 'Meat Sale') {
                meatSales += item.amount;
            }
        });
        
        // Update summary cards
        document.getElementById('supervisorTotalIncome').textContent = totalIncome.toFixed(2);
        document.getElementById('supervisorEggSales').textContent = eggSales.toFixed(2);
        document.getElementById('supervisorMeatSales').textContent = meatSales.toFixed(2);
        
        // Display in table
        const tbody = document.getElementById('supervisorIncomeTableBody');
        tbody.innerHTML = '';
        
        if (incomeData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No income data available</td></tr>';
            return;
        }
        
        incomeData.forEach(item => {
            const row = document.createElement('tr');
            const typeIcon = item.incomeType === 'Egg Sale' ? '🥚' : '🍗';
            
            row.innerHTML = `
                <td>${item.date}</td>
                <td>${item.userName}</td>
                <td>${typeIcon} ${item.incomeType}</td>
                <td>${item.batchId}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td style="font-weight: bold; color: #10b981;">₹${item.amount.toFixed(2)}</td>
                <td>
                    <button class="btn btn-info view-supervisor-income-btn" data-id="${item.id}">View</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Add event listeners
        document.querySelectorAll('.view-supervisor-income-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                viewSupervisorIncomeDetail(id);
            });
        });
        
    } catch (error) {
        console.error('Error loading supervisor income data:', error);
        showAlert('Error loading income data: ' + error.message, 'error');
    }
}

// View income detail
async function viewSupervisorIncomeDetail(docId) {
    try {
        const docRef = doc(db, 'income', docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            showAlert('Income entry not found', 'error');
            return;
        }
        
        const data = docSnap.data();
        const typeIcon = data.incomeType === 'Egg Sale' ? '🥚' : '🍗';
        
        const detailContent = document.getElementById('supervisorIncomeDetailContent');
        detailContent.innerHTML = `
            <div style="padding: 1.5rem;">
                <p style="margin: 0.5rem 0;"><strong>User:</strong> ${data.userName}</p>
                <p style="margin: 0.5rem 0;"><strong>Farm:</strong> ${data.farmName}</p>
                <p style="margin: 0.5rem 0;"><strong>Income Type:</strong> ${typeIcon} ${data.incomeType}</p>
                <p style="margin: 0.5rem 0;"><strong>Date:</strong> ${data.date}</p>
                <p style="margin: 0.5rem 0;"><strong>Batch ID:</strong> ${data.batchId}</p>
                <p style="margin: 0.5rem 0;"><strong>Quantity:</strong> ${data.quantity} ${data.unit}</p>
                <p style="margin: 0.5rem 0;"><strong>Amount:</strong> <span style="font-size: 1.5rem; font-weight: bold; color: #10b981;">₹${data.amount.toFixed(2)}</span></p>
                ${data.notes ? `<p style="margin: 0.5rem 0;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
                <p style="margin: 0.5rem 0; color: #666; font-size: 0.9rem;"><strong>Sent At:</strong> ${new Date(data.sentAt).toLocaleString()}</p>
            </div>
        `;
        
        document.getElementById('supervisorIncomeDetailModal').classList.add('active');
    } catch (error) {
        console.error('Error viewing income detail:', error);
        showAlert('Error loading details: ' + error.message, 'error');
    }
}

// Close income detail modal
window.closeSupervisorIncomeDetailModal = function() {
    document.getElementById('supervisorIncomeDetailModal').classList.remove('active');
};

// View income graph
document.getElementById('viewIncomeGraphSupervisorBtn')?.addEventListener('click', async () => {
    await loadSupervisorIncomeGraph();
    document.getElementById('supervisorIncomeGraphModal').classList.add('active');
});

// Close income graph modal
window.closeSupervisorIncomeGraphModal = function() {
    document.getElementById('supervisorIncomeGraphModal').classList.remove('active');
};

// Load income graph
async function loadSupervisorIncomeGraph() {
    try {
        const q = query(collection(db, 'income'));
        const querySnapshot = await getDocs(q);
        
        let incomeData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.sentToSupervisor === true && data.supervisorEmail === currentSupervisor.email) {
                incomeData.push(data);
            }
        });
        
        // Group by month
        const monthlyData = {};
        const userTotals = {};
        
        incomeData.forEach(item => {
            const date = new Date(item.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    eggSales: 0,
                    meatSales: 0
                };
            }
            
            if (item.incomeType === 'Egg Sale') {
                monthlyData[monthKey].eggSales += item.amount;
            } else if (item.incomeType === 'Meat Sale') {
                monthlyData[monthKey].meatSales += item.amount;
            }
            
            // Group by user
            if (!userTotals[item.userName]) {
                userTotals[item.userName] = 0;
            }
            userTotals[item.userName] += item.amount;
        });
        
        // Sort by month
        const sortedMonths = Object.keys(monthlyData).sort();
        const labels = sortedMonths.map(m => {
            const [year, month] = m.split('-');
            const date = new Date(year, month - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });
        
        const eggSalesData = sortedMonths.map(m => monthlyData[m].eggSales);
        const meatSalesData = sortedMonths.map(m => monthlyData[m].meatSales);
        
        // Monthly trend chart
        const existingChart1 = Chart.getChart('supervisorIncomeChart');
        if (existingChart1) {
            existingChart1.destroy();
        }
        
        const ctx1 = document.getElementById('supervisorIncomeChart').getContext('2d');
        new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Egg Sales (₹)',
                        data: eggSalesData,
                        borderColor: 'rgba(59, 130, 246, 1)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Meat Sales (₹)',
                        data: meatSalesData,
                        borderColor: 'rgba(239, 68, 68, 1)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
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
                        font: { size: 18 }
                    },
                    legend: {
                        display: true,
                        position: 'top'
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
        
        // By user chart
        const existingChart2 = Chart.getChart('supervisorIncomeByUserChart');
        if (existingChart2) {
            existingChart2.destroy();
        }
        
        const userNames = Object.keys(userTotals);
        const userAmounts = Object.values(userTotals);
        
        const ctx2 = document.getElementById('supervisorIncomeByUserChart').getContext('2d');
        new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: userNames,
                datasets: [{
                    label: 'Total Income by User (₹)',
                    data: userAmounts,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(16, 185, 129, 0.7)',
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(139, 92, 246, 0.7)'
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(16, 185, 129, 1)',
                        'rgba(239, 68, 68, 1)',
                        'rgba(245, 158, 11, 1)',
                        'rgba(139, 92, 246, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Income by User',
                        font: { size: 18 }
                    },
                    legend: {
                        display: false
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
