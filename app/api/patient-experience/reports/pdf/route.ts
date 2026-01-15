import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { getPXReportData } from '@/lib/reports/patientExperienceReport';
import { getTenantContextOrThrow } from '@/lib/auth/getTenantIdOrThrow';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/patient-experience/reports/pdf
 * Export Patient Experience report as PDF
 * 
 * Query params:
 * - type: 'executive-summary' | 'sla-breach' | 'top-complaints' | 'visits-log'
 * - from: ISO date string
 * - to: ISO date string
 * - floorKey, departmentKey, severity, status: optional filters
 * 
 * Note: Requires pdfkit package. Install with: npm install pdfkit @types/pdfkit
 */
export async function GET(request: NextRequest) {
  try {
    // Tenant isolation: get tenantId from session
    const tenantContext = await getTenantContextOrThrow(request);
    const { tenantId, userId, userEmail, userRole } = tenantContext;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience/reports/pdf (GET)', 'tenant=', tenantId, 'user=', userEmail, 'role=', userRole, 'collection=patient_experience,px_cases');
    }

    // RBAC: staff, supervisor, admin can export reports (same organization)
    const authResult = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'executive-summary';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'from and to dates are required' },
        { status: 400 }
      );
    }

    // Check if pdfkit is available
    let PDFDocument: any;
    try {
      // Use dynamic import to avoid build-time issues
      const pdfkitModule = await import('pdfkit');
      PDFDocument = pdfkitModule.default || pdfkitModule;
      
      // Note: PDFKit should work with default fonts in Next.js
      // If font errors occur, they're usually non-critical
    } catch (error) {
      console.error('PDFKit import error:', error);
      return NextResponse.json(
        { 
          error: 'PDF generation requires pdfkit package. Please install: npm install pdfkit @types/pdfkit',
          details: 'PDFKit is not installed'
        },
        { status: 500 }
      );
    }

    // Get report data (with tenant isolation)
    const reportData = await getPXReportData({
      tenantId, // TENANT ISOLATION: Pass tenantId from session
      from,
      to,
      floorKey: searchParams.get('floorKey') || undefined,
      departmentKey: searchParams.get('departmentKey') || undefined,
      severity: searchParams.get('severity') || undefined,
      status: searchParams.get('status') || undefined,
    });

    // Create PDF document
    // PDFKit uses built-in fonts, but in Next.js we need to ensure the font data is accessible
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    // Set up event handlers before generating content
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Patient Experience Report', { align: 'center' });
    doc.fontSize(12).text(
      `Date Range: ${format(new Date(from), 'MMM dd, yyyy')} - ${format(new Date(to), 'MMM dd, yyyy')}`,
      { align: 'center' }
    );
    doc.moveDown(2);

    // Section 1: Executive Summary KPIs
    doc.fontSize(16).text('Executive Summary', { underline: true });
    doc.moveDown(0.5);
    
    const summaryData = [
      ['Total Visits', reportData.summaryKPIs.totalVisits.toString()],
      ['Total Complaints', reportData.summaryKPIs.totalComplaints.toString()],
      ['Total Praise', reportData.summaryKPIs.totalPraise.toString()],
      ['Average Satisfaction', `${reportData.summaryKPIs.avgSatisfaction}%`],
      ['Total Cases', reportData.summaryKPIs.totalCases.toString()],
      ['Open Cases', reportData.summaryKPIs.openCases.toString()],
      ['Overdue Cases', reportData.summaryKPIs.overdueCases.toString()],
      ['Average Resolution (minutes)', reportData.summaryKPIs.avgResolutionMinutes.toString()],
      ['SLA Breach Percent', `${reportData.summaryKPIs.slaBreachPercent}%`],
    ];

    // Draw summary table
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 300;
    const rowHeight = 20;

    doc.fontSize(10);
    summaryData.forEach((row, index) => {
      const y = tableTop + (index * rowHeight);
      doc.text(row[0], col1X, y);
      doc.text(row[1], col2X, y);
    });

    doc.moveDown(2);

    // Section 2: SLA Overview
    doc.fontSize(16).text('SLA Overview', { underline: true });
    doc.moveDown(0.5);
    
    const slaData = [
      ['Open Cases', reportData.summaryKPIs.openCases.toString()],
      ['Overdue Cases', reportData.summaryKPIs.overdueCases.toString()],
      ['SLA Breaches', Math.round((reportData.summaryKPIs.slaBreachPercent / 100) * reportData.summaryKPIs.totalCases).toString()],
      ['Average Resolution Time', `${reportData.summaryKPIs.avgResolutionMinutes.toFixed(0)} minutes`],
    ];

    const slaTableTop = doc.y;
    slaData.forEach((row, index) => {
      const y = slaTableTop + (index * rowHeight);
      doc.text(row[0], col1X, y);
      doc.text(row[1], col2X, y);
    });

    doc.moveDown(2);

    // Section 3: Top 10 Complaint Types
    doc.fontSize(16).text('Top 10 Complaint Types', { underline: true });
    doc.moveDown(0.5);
    
    const typesTableTop = doc.y;
    doc.text('Complaint Type', col1X, typesTableTop, { continued: false });
    doc.text('Count', col2X, typesTableTop, { continued: false });
    doc.text('Percentage', 400, typesTableTop);
    
    reportData.breakdownRows.types.slice(0, 10).forEach((type, index) => {
      const y = typesTableTop + ((index + 1) * rowHeight);
      doc.text(type.label_en, col1X, y, { width: 200, ellipsis: true });
      doc.text(type.count.toString(), col2X, y);
      doc.text(`${type.percentage.toFixed(1)}%`, 400, y);
    });

    doc.moveDown(2);

    // Section 4: Top 10 Departments
    doc.fontSize(16).text('Top 10 Departments', { underline: true });
    doc.moveDown(0.5);
    
    const deptTableTop = doc.y;
    doc.text('Department', col1X, deptTableTop, { continued: false });
    doc.text('Count', col2X, deptTableTop, { continued: false });
    doc.text('Percentage', 400, deptTableTop);
    
    reportData.breakdownRows.departments.slice(0, 10).forEach((dept, index) => {
      const y = deptTableTop + ((index + 1) * rowHeight);
      doc.text(dept.label_en, col1X, y, { width: 200, ellipsis: true });
      doc.text(dept.count.toString(), col2X, y);
      doc.text(`${dept.percentage.toFixed(1)}%`, 400, y);
    });

    // Optional: Add visits appendix if small dataset
    if (reportData.visitsRows.length <= 50) {
      doc.addPage();
      doc.fontSize(16).text('Recent Visits (Latest 50)', { underline: true });
      doc.moveDown(0.5);
      
      const visitsTableTop = doc.y;
      doc.fontSize(8);
      doc.text('Date', 50, visitsTableTop);
      doc.text('Staff', 120, visitsTableTop);
      doc.text('Patient', 200, visitsTableTop);
      doc.text('Location', 280, visitsTableTop);
      doc.text('Type', 380, visitsTableTop);
      doc.text('Severity', 450, visitsTableTop);
      
      reportData.visitsRows.slice(0, 50).forEach((visit, index) => {
        if (doc.y > 750) {
          doc.addPage();
        }
        const y = doc.y;
        doc.text(format(new Date(visit.createdAt), 'MM/dd'), 50, y, { width: 60 });
        doc.text(visit.staffName, 120, y, { width: 70, ellipsis: true });
        doc.text(visit.patientName, 200, y, { width: 70, ellipsis: true });
        doc.text(`${visit.floorLabel}/${visit.departmentLabel}`, 280, y, { width: 90, ellipsis: true });
        doc.text(visit.typeLabel, 380, y, { width: 60, ellipsis: true });
        doc.text(visit.severity, 450, y);
        doc.moveDown(0.3);
      });
    } else {
      // Add note about large dataset
      doc.moveDown(1);
      doc.fontSize(10).text(
        `Note: ${reportData.visitsRows.length} visits found. For full details, please use CSV or Excel export.`,
        { align: 'center', italic: true }
      );
    }

    // Footer on each page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
        .text(
          `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')} | Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 30,
          { align: 'center' }
        );
    }

    // Set up end handler and finalize PDF
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks as any);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
      doc.end();
    });

    // Wait for PDF to be generated
    const pdfBuffer = await pdfPromise;

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="patient-experience-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('PDF export error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to export PDF', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

