// PDF Report Generation using jsPDF
import { jsPDF } from 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

export function generatePDFReport(data, supervisor) {
    if (data.length === 0) {
        alert('No data available to generate report');
        return;
    }

    // Create new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Add header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Poultry Management Report', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Supervisor: ${supervisor.fullName}`, 20, yPosition);
    
    yPosition += 7;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
    
    yPosition += 10;
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;

    // Summary statistics
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 20, yPosition);
    yPosition += 8;

    const uniqueUsers = new Set(data.map(d => d.userId)).size;
    const uniqueBatches = new Set(data.map(d => d.batchId)).size;
    const totalEggs = data.reduce((sum, d) => sum + (d.eggCount || 0), 0);
    const totalMortality = data.reduce((sum, d) => sum + (d.mortality || 0), 0);
    const totalFeed = data.reduce((sum, d) => sum + (d.feed || 0), 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Total Users: ${uniqueUsers}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Total Batches: ${uniqueBatches}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Total Eggs: ${totalEggs}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Total Mortality: ${totalMortality}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Total Feed Used: ${totalFeed.toFixed(2)} kg`, 20, yPosition);
    yPosition += 10;

    // Group data by user
    const userGroups = {};
    data.forEach(d => {
        if (!userGroups[d.userId]) {
            userGroups[d.userId] = {
                userName: d.userName,
                farmName: d.farmName,
                data: []
            };
        }
        userGroups[d.userId].data.push(d);
    });

    // Add data for each user
    Object.values(userGroups).forEach(userGroup => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`User: ${userGroup.userName} - ${userGroup.farmName}`, 20, yPosition);
        yPosition += 8;

        // Sort by date
        userGroup.data.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Add table header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const colX = [20, 50, 75, 95, 115, 140];
        doc.text('Date', colX[0], yPosition);
        doc.text('Batch', colX[1], yPosition);
        doc.text('Eggs', colX[2], yPosition);
        doc.text('Mortality', colX[3], yPosition);
        doc.text('Feed', colX[4], yPosition);
        doc.text('Vacc/Med', colX[5], yPosition);
        yPosition += 5;

        // Add line under header
        doc.setLineWidth(0.3);
        doc.line(20, yPosition, pageWidth - 20, yPosition);
        yPosition += 5;

        // Add data rows
        doc.setFont('helvetica', 'normal');
        userGroup.data.forEach(d => {
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = 20;
            }

            doc.text(d.date, colX[0], yPosition);
            doc.text(d.batchId.substring(0, 8), colX[1], yPosition);
            doc.text(d.eggCount.toString(), colX[2], yPosition);
            doc.text(d.mortality.toString(), colX[3], yPosition);
            doc.text(d.feed.toFixed(1), colX[4], yPosition);
            
            const hasVacc = d.vaccination && d.vaccination.trim() !== '';
            const hasMed = d.medicine && d.medicine.trim() !== '';
            let vaccMed = '';
            if (hasVacc && hasMed) vaccMed = 'Both';
            else if (hasVacc) vaccMed = 'Vacc';
            else if (hasMed) vaccMed = 'Med';
            else vaccMed = '-';
            
            doc.text(vaccMed, colX[5], yPosition);
            yPosition += 5;
        });

        yPosition += 5;
    });

    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    // Save PDF
    const filename = `Poultry_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

// Generate report for specific date range
export function generateDateRangeReport(data, supervisor, dateFrom, dateTo) {
    const filteredData = data.filter(d => {
        return d.date >= dateFrom && d.date <= dateTo;
    });

    generatePDFReport(filteredData, supervisor);
}

// Generate weekly report
export function generateWeeklyReport(data, supervisor) {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateFrom = weekAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    generateDateRangeReport(data, supervisor, dateFrom, dateTo);
}

// Generate monthly report
export function generateMonthlyReport(data, supervisor) {
    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateFrom = monthAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    generateDateRangeReport(data, supervisor, dateFrom, dateTo);
}
