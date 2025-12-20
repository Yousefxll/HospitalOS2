import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import ExcelJS from 'exceljs';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as any;

    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const collection = searchParams.get('collection');

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection is required' },
        { status: 400 }
      );
    }

    // Fetch data from MongoDB
    const targetCollection = await getCollection(collection);
    const documents = await targetCollection.find({}).limit(1000).toArray();

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    if (documents.length > 0) {
      // Get all unique keys from documents
      const allKeys = new Set<string>();
      documents.forEach(doc => {
        Object.keys(doc).forEach(key => {
          if (key !== '_id') allKeys.add(key);
        });
      });

      const columns = Array.from(allKeys);
      worksheet.columns = columns.map(key => ({ header: key, key, width: 15 }));

      // Add data rows
      documents.forEach(doc => {
        const row: any = {};
        columns.forEach(key => {
          const value = (doc as any)[key];
          if (value instanceof Date) {
            row[key] = value.toISOString().split('T')[0];
          } else if (typeof value === 'object' && value !== null) {
            row[key] = JSON.stringify(value);
          } else {
            row[key] = value;
          }
        });
        worksheet.addRow(row);
      });
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${collection}_export.xlsx`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
