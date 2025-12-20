import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { getPXReportData } from '@/lib/reports/patientExperienceReport';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

/**
 * GET /api/patient-experience/reports/xlsx
 * Export Patient Experience report as XLSX (multi-sheet)
 * 
 * Query params:
 * - type: 'executive-summary' | 'sla-breach' | 'top-complaints' | 'visits-log'
 * - from: ISO date string
 * - to: ISO date string
 * - floorKey, departmentKey, severity, status: optional filters
 */
export async function GET(request: NextRequest) {
  try {
    // RBAC: supervisor, admin only (staff forbidden)
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
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

    // Get report data
    const reportData = await getPXReportData({
      from,
      to,
      floorKey: searchParams.get('floorKey') || undefined,
      departmentKey: searchParams.get('departmentKey') || undefined,
      severity: searchParams.get('severity') || undefined,
      status: searchParams.get('status') || undefined,
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HospitalOS';
    workbook.created = new Date();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    summarySheet.addRow({ metric: 'Total Visits', value: reportData.summaryKPIs.totalVisits });
    summarySheet.addRow({ metric: 'Total Complaints', value: reportData.summaryKPIs.totalComplaints });
    summarySheet.addRow({ metric: 'Total Praise', value: reportData.summaryKPIs.totalPraise });
    summarySheet.addRow({ metric: 'Average Satisfaction (%)', value: `${reportData.summaryKPIs.avgSatisfaction}%` });
    summarySheet.addRow({ metric: 'Total Cases', value: reportData.summaryKPIs.totalCases });
    summarySheet.addRow({ metric: 'Open Cases', value: reportData.summaryKPIs.openCases });
    summarySheet.addRow({ metric: 'Overdue Cases', value: reportData.summaryKPIs.overdueCases });
    summarySheet.addRow({ metric: 'Average Resolution (minutes)', value: reportData.summaryKPIs.avgResolutionMinutes });
    summarySheet.addRow({ metric: 'SLA Breach Percent (%)', value: `${reportData.summaryKPIs.slaBreachPercent}%` });

    // Sheet 2: Cases
    const casesSheet = workbook.addWorksheet('Cases');
    casesSheet.columns = [
      { header: 'Case ID', key: 'caseId', width: 15 },
      { header: 'Visit ID', key: 'visitId', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Assigned Department', key: 'assignedDept', width: 25 },
      { header: 'Due Date', key: 'dueAt', width: 20 },
      { header: 'Overdue', key: 'overdue', width: 10 },
      { header: 'Escalation Level', key: 'escalationLevel', width: 15 },
      { header: 'Resolved At', key: 'resolvedAt', width: 20 },
      { header: 'Resolution Minutes', key: 'resolutionMinutes', width: 18 },
      { header: 'Complaint Details (English)', key: 'detailsEn', width: 50 },
    ];
    // Limit to 10000 rows
    const casesToExport = reportData.casesRows.slice(0, 10000);
    casesToExport.forEach(caseRow => {
      casesSheet.addRow({
        caseId: caseRow.caseId,
        visitId: caseRow.visitId,
        status: caseRow.status,
        severity: caseRow.severity,
        assignedDept: caseRow.assignedDeptLabel,
        dueAt: caseRow.dueAt ? format(new Date(caseRow.dueAt), 'yyyy-MM-dd HH:mm') : '',
        overdue: caseRow.overdue ? 'Yes' : 'No',
        escalationLevel: caseRow.escalationLevel,
        resolvedAt: caseRow.resolvedAt ? format(new Date(caseRow.resolvedAt), 'yyyy-MM-dd HH:mm') : '',
        resolutionMinutes: caseRow.resolutionMinutes || '',
        detailsEn: caseRow.detailsEn,
      });
    });

    // Sheet 3: Visits
    const visitsSheet = workbook.addWorksheet('Visits');
    visitsSheet.columns = [
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Staff ID', key: 'staffId', width: 15 },
      { header: 'Staff Name', key: 'staffName', width: 20 },
      { header: 'Patient Name', key: 'patientName', width: 20 },
      { header: 'MRN', key: 'mrn', width: 15 },
      { header: 'Floor', key: 'floor', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Room', key: 'room', width: 15 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Domain', key: 'domain', width: 20 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Details (English)', key: 'detailsEn', width: 50 },
    ];
    // Limit to 10000 rows
    const visitsToExport = reportData.visitsRows.slice(0, 10000);
    visitsToExport.forEach(visitRow => {
      visitsSheet.addRow({
        createdAt: format(new Date(visitRow.createdAt), 'yyyy-MM-dd HH:mm'),
        staffId: visitRow.staffId,
        staffName: visitRow.staffName,
        patientName: visitRow.patientName,
        mrn: visitRow.patientFileNumber,
        floor: visitRow.floorLabel,
        department: visitRow.departmentLabel,
        room: visitRow.roomLabel,
        type: visitRow.typeLabel,
        domain: visitRow.domainLabel,
        severity: visitRow.severity,
        status: visitRow.status,
        detailsEn: visitRow.detailsEn,
      });
    });

    // Sheet 4: Breakdown
    const breakdownSheet = workbook.addWorksheet('Breakdown');
    
    // Top Departments
    breakdownSheet.addRow(['Top Departments']);
    breakdownSheet.addRow(['Department', 'Count', 'Percentage']);
    reportData.breakdownRows.departments.slice(0, 20).forEach(dept => {
      breakdownSheet.addRow([dept.label_en, dept.count, `${dept.percentage}%`]);
    });
    
    breakdownSheet.addRow([]); // Empty row
    
    // Top Complaint Types
    breakdownSheet.addRow(['Top Complaint Types']);
    breakdownSheet.addRow(['Type', 'Count', 'Percentage']);
    reportData.breakdownRows.types.slice(0, 20).forEach(type => {
      breakdownSheet.addRow([type.label_en, type.count, `${type.percentage}%`]);
    });
    
    breakdownSheet.addRow([]); // Empty row
    
    // Severity Mix
    breakdownSheet.addRow(['Severity Distribution']);
    breakdownSheet.addRow(['Severity', 'Count', 'Percentage']);
    reportData.breakdownRows.severity.forEach(sev => {
      breakdownSheet.addRow([sev.label_en, sev.count, `${sev.percentage}%`]);
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="patient-experience-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('XLSX export error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to export XLSX', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

