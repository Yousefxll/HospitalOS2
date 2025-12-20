import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { getPXReportData } from '@/lib/reports/patientExperienceReport';
import { format } from 'date-fns';

/**
 * GET /api/patient-experience/reports/csv
 * Export Patient Experience report as CSV
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

    let csvContent = '';

    // Generate CSV based on report type
    switch (reportType) {
      case 'executive-summary':
        // Key-value rows
        csvContent = 'Metric,Value\n';
        csvContent += `Total Visits,${reportData.summaryKPIs.totalVisits}\n`;
        csvContent += `Total Complaints,${reportData.summaryKPIs.totalComplaints}\n`;
        csvContent += `Total Praise,${reportData.summaryKPIs.totalPraise}\n`;
        csvContent += `Average Satisfaction,${reportData.summaryKPIs.avgSatisfaction}%\n`;
        csvContent += `Total Cases,${reportData.summaryKPIs.totalCases}\n`;
        csvContent += `Open Cases,${reportData.summaryKPIs.openCases}\n`;
        csvContent += `Overdue Cases,${reportData.summaryKPIs.overdueCases}\n`;
        csvContent += `Average Resolution Minutes,${reportData.summaryKPIs.avgResolutionMinutes}\n`;
        csvContent += `SLA Breach Percent,${reportData.summaryKPIs.slaBreachPercent}%\n`;
        break;

      case 'sla-breach':
        // Cases with SLA breach info
        csvContent = 'Case ID,Visit ID,Status,Severity,Assigned Department,Due Date,Overdue,Escalation Level,Resolved At,Resolution Minutes,Complaint Details (English)\n';
        const breachedCases = reportData.casesRows.filter(c => 
          c.overdue || c.status === 'ESCALATED' || 
          (c.resolvedAt && c.dueAt && new Date(c.resolvedAt) > new Date(c.dueAt))
        );
        for (const caseRow of breachedCases) {
          csvContent += [
            caseRow.caseId,
            caseRow.visitId,
            caseRow.status,
            caseRow.severity,
            escapeCSV(caseRow.assignedDeptLabel),
            format(new Date(caseRow.dueAt), 'yyyy-MM-dd HH:mm'),
            caseRow.overdue ? 'Yes' : 'No',
            caseRow.escalationLevel,
            caseRow.resolvedAt ? format(new Date(caseRow.resolvedAt), 'yyyy-MM-dd HH:mm') : '',
            caseRow.resolutionMinutes || '',
            escapeCSV(caseRow.detailsEn),
          ].join(',') + '\n';
        }
        break;

      case 'top-complaints':
        // Pareto: Top complaint types
        csvContent = 'Complaint Type,Count,Percentage\n';
        for (const typeRow of reportData.breakdownRows.types.slice(0, 20)) {
          csvContent += [
            escapeCSV(typeRow.label_en),
            typeRow.count,
            `${typeRow.percentage}%`,
          ].join(',') + '\n';
        }
        break;

      case 'visits-log':
        // Full visits log
        csvContent = 'Created At,Staff ID,Staff Name,Patient Name,MRN,Floor,Department,Room,Type,Domain,Complaint Type,Severity,Status,Details (English)\n';
        // Limit to 10000 rows for performance
        const visitsToExport = reportData.visitsRows.slice(0, 10000);
        for (const visitRow of visitsToExport) {
          csvContent += [
            format(new Date(visitRow.createdAt), 'yyyy-MM-dd HH:mm'),
            escapeCSV(visitRow.staffId),
            escapeCSV(visitRow.staffName),
            escapeCSV(visitRow.patientName),
            escapeCSV(visitRow.patientFileNumber),
            escapeCSV(visitRow.floorLabel),
            escapeCSV(visitRow.departmentLabel),
            escapeCSV(visitRow.roomLabel),
            escapeCSV(visitRow.typeLabel),
            escapeCSV(visitRow.domainLabel),
            escapeCSV(visitRow.typeLabel), // Complaint type same as type
            visitRow.severity,
            visitRow.status,
            escapeCSV(visitRow.detailsEn),
          ].join(',') + '\n';
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="patient-experience-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('CSV export error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to export CSV', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

function escapeCSV(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

