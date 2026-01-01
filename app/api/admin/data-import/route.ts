import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as any;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const collection = formData.get('collection') as string;

    if (!file || !collection) {
      return NextResponse.json(
        { error: 'File and collection are required' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const columns: string[] = [];
    const documents: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const rowData = row.values as any[];
      rowData.shift(); // Remove first empty element

      if (rowNumber === 1) {
        columns.push(...rowData.map(String));
      } else {
        const doc: any = {
          id: uuidv4(),
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
        };

        columns.forEach((col, idx) => {
          const value = rowData[idx];
          if (value !== null && value !== undefined) {
            // Handle date columns
            if (col.toLowerCase().includes('date') && value instanceof Date) {
              doc[col] = value;
            } else {
              doc[col] = value;
            }
          }
        });

        documents.push(doc);
      }
    });

    // Insert into MongoDB
    const targetCollection = await getCollection(collection);
    if (documents.length > 0) {
      await targetCollection.insertMany(documents);
    }

    return NextResponse.json({
      success: true,
      imported: documents.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}
