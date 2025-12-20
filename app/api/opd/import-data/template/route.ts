import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getCollection } from '@/lib/db';

export async function GET() {
  try {
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('OPD Daily Data');

    // Fetch doctors to get names
    const doctorsCollection = await getCollection('doctors');
    const doctors = await doctorsCollection.find({ isActive: true }).toArray();
    const doctorMap = new Map(doctors.map((d: any) => [d.id, d.name]));

    // Define headers
    const headers = [
      'Date (YYYY-MM-DD)',
      'Department ID',
      'Doctor ID',
      'Doctor Name',
      'Employment Type (FT/PPT)',
      'Subspecialty',
      'Is Primary Specialty (TRUE/FALSE)',
      'Room IDs (comma-separated)',
      'Slots Per Hour (1-6)',
      'Clinic Start Time (HH:MM)',
      'Clinic End Time (HH:MM)',
      'Total Patients',
      'Booked',
      'Walk-in',
      'No Show',
      'Time Distribution 0-6',
      'Time Distribution 6-7',
      'Time Distribution 7-8',
      'Time Distribution 8-12',
      'Time Distribution 12-16',
      'Time Distribution 16-20',
      'Time Distribution 20-24',
      'FV (First Visit)',
      'FCV (First Consultation Visit)',
      'FUV (Follow-up Visit)',
      'RV (Return Visit)',
      'Procedures',
      'OR Surgeries',
      'Admissions',
      'Cath (Cardiology only)',
      'Deliveries Normal (OB/GYN only)',
      'Deliveries SC (OB/GYN only)',
      'IVF (OB/GYN only)',
    ];

    // Add headers
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Create sample data rows
    const sampleData: any[] = [
      // Example row 1
      {
        'Date (YYYY-MM-DD)': '2025-01-15',
        'Department ID': 'DEPT001',
        'Doctor ID': 'DOC001',
        'Doctor Name': 'Dr. Example Name',
        'Employment Type (FT/PPT)': 'FT',
        'Subspecialty': 'Cardiology',
        'Is Primary Specialty (TRUE/FALSE)': 'TRUE',
        'Room IDs (comma-separated)': 'ROOM001,ROOM002',
        'Slots Per Hour (1-6)': 4,
        'Clinic Start Time (HH:MM)': '08:00',
        'Clinic End Time (HH:MM)': '16:00',
        'Total Patients': 25,
        'Booked': 20,
        'Walk-in': 3,
        'No Show': 2,
        'Time Distribution 0-6': 0,
        'Time Distribution 6-7': 0,
        'Time Distribution 7-8': 2,
        'Time Distribution 8-12': 15,
        'Time Distribution 12-16': 8,
        'Time Distribution 16-20': 0,
        'Time Distribution 20-24': 0,
        'FV (First Visit)': 5,
        'FCV (First Consultation Visit)': 8,
        'FUV (Follow-up Visit)': 10,
        'RV (Return Visit)': 2,
        'Procedures': 3,
        'OR Surgeries': 1,
        'Admissions': 2,
        'Cath (Cardiology only)': 1,
        'Deliveries Normal (OB/GYN only)': 0,
        'Deliveries SC (OB/GYN only)': 0,
        'IVF (OB/GYN only)': 0,
      },
      // Example row 2
      {
        'Date (YYYY-MM-DD)': '2025-01-16',
        'Department ID': 'DEPT001',
        'Doctor ID': 'DOC001',
        'Doctor Name': 'Dr. Example Name',
        'Employment Type (FT/PPT)': 'FT',
        'Subspecialty': 'Cardiology',
        'Is Primary Specialty (TRUE/FALSE)': 'TRUE',
        'Room IDs (comma-separated)': 'ROOM001',
        'Slots Per Hour (1-6)': 4,
        'Clinic Start Time (HH:MM)': '08:00',
        'Clinic End Time (HH:MM)': '16:00',
        'Total Patients': 30,
        'Booked': 25,
        'Walk-in': 4,
        'No Show': 1,
        'Time Distribution 0-6': 0,
        'Time Distribution 6-7': 0,
        'Time Distribution 7-8': 3,
        'Time Distribution 8-12': 18,
        'Time Distribution 12-16': 9,
        'Time Distribution 16-20': 0,
        'Time Distribution 20-24': 0,
        'FV (First Visit)': 6,
        'FCV (First Consultation Visit)': 10,
        'FUV (Follow-up Visit)': 12,
        'RV (Return Visit)': 2,
        'Procedures': 4,
        'OR Surgeries': 2,
        'Admissions': 1,
        'Cath (Cardiology only)': 2,
        'Deliveries Normal (OB/GYN only)': 0,
        'Deliveries SC (OB/GYN only)': 0,
        'IVF (OB/GYN only)': 0,
      },
    ];

    // Add sample data rows
    sampleData.forEach(row => {
      const rowData = headers.map(header => {
        const value = row[header];
        // Convert boolean to string for Excel
        if (typeof value === 'boolean') {
          return value ? 'TRUE' : 'FALSE';
        }
        return value || '';
      });
      worksheet.addRow(rowData);
    });

    // Set column widths
    const columnWidths = [
      15, // Date
      15, // Department ID
      15, // Doctor ID
      25, // Doctor Name
      20, // Employment Type
      20, // Subspecialty
      25, // Is Primary Specialty
      25, // Room IDs
      15, // Slots Per Hour
      18, // Clinic Start Time
      18, // Clinic End Time
      15, // Total Patients
      10, // Booked
      10, // Walk-in
      10, // No Show
      20, // Time Distribution 0-6
      20, // Time Distribution 6-7
      20, // Time Distribution 7-8
      20, // Time Distribution 8-12
      20, // Time Distribution 12-16
      20, // Time Distribution 16-20
      20, // Time Distribution 20-24
      20, // FV
      30, // FCV
      25, // FUV
      20, // RV
      15, // Procedures
      15, // OR Surgeries
      15, // Admissions
      25, // Cath
      30, // Deliveries Normal
      30, // Deliveries SC
      20, // IVF
    ];
    
    // Apply column widths
    columnWidths.forEach((width, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = width;
    });

    // Generate Excel file buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Return file as response
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="OPD_Daily_Data_Template_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
