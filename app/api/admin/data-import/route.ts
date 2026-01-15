import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getTenantCollection } from '@/lib/db-tenant';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Authorization: Only admin or supervisor can import data
    if (!['admin', 'supervisor'].includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admin or supervisor can import data' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
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
          tenantId, // CRITICAL: Always include tenantId for tenant isolation
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

    // Insert into MongoDB with tenant isolation
    const targetCollection = await getTenantCollection(collection, tenantId, 'admin/data-import');
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
      { error: 'Failed to import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.data.import' });
