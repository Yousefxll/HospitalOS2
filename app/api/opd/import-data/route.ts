import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { Department } from '@/lib/models/Department';
import type { Doctor } from '@/lib/models/Doctor';
import type { FloorRoom } from '@/lib/models/Floor';
import type { OPDDailyData } from '@/lib/models/OPDDailyData';

// Schema matching the daily data entry form - with more lenient validation

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const dailyDataRowSchema = z.object({
  date: z.string().min(1, 'Date is required'), // Date in YYYY-MM-DD format
  departmentId: z.string().min(1, 'Department ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  employmentType: z.enum(['FT', 'PPT']).default('FT'),
  subspecialty: z.string().min(1).default('General'),
  isPrimarySpecialty: z.boolean().default(true),
  roomIds: z.string().optional().default(''), // Comma-separated room IDs
  slotsPerHour: z.number().min(1).max(6).default(4),
  clinicStartTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
  clinicEndTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).default('16:00'),
  totalPatients: z.number().min(0).default(0),
  booked: z.number().min(0).default(0),
  walkIn: z.number().min(0).default(0),
  noShow: z.number().min(0).default(0),
  timeDistribution_0_6: z.number().min(0).default(0),
  timeDistribution_6_7: z.number().min(0).default(0),
  timeDistribution_7_8: z.number().min(0).default(0),
  timeDistribution_8_12: z.number().min(0).default(0),
  timeDistribution_12_16: z.number().min(0).default(0),
  timeDistribution_16_20: z.number().min(0).default(0),
  timeDistribution_20_24: z.number().min(0).default(0),
  fv: z.number().min(0).default(0),
  fcv: z.number().min(0).default(0),
  fuv: z.number().min(0).default(0),
  rv: z.number().min(0).default(0),
  procedures: z.number().min(0).default(0),
  orSurgeries: z.number().min(0).default(0),
  admissions: z.number().min(0).default(0),
  cath: z.number().min(0).default(0),
  deliveriesNormal: z.number().min(0).default(0),
  deliveriesSC: z.number().min(0).default(0),
  ivf: z.number().min(0).default(0),
});

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin, supervisor, or staff
    if (!['admin', 'supervisor', 'staff'].includes(role) && !permissions.includes('opd.import-data')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: 'Excel file has no worksheets' }, { status: 400 });
    }

    // Convert worksheet to JSON
    const data: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      const rowData: any = {};
      let hasAnyData = false;
      
      row.eachCell((cell, colNumber) => {
        const headerCell = worksheet.getRow(1).getCell(colNumber);
        const header = headerCell?.value?.toString() || `Column${colNumber}`;
        const value = cell.value;
        
        // Check if cell has any meaningful data
        if (value !== null && value !== undefined && value !== '') {
          hasAnyData = true;
          rowData[header] = value;
        } else {
          rowData[header] = null; // Mark as empty
        }
      });
      
      // Only add row if it has at least some data
      if (hasAnyData) {
        data.push(rowData);
      }
    });

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
    }

    const dailyDataCollection = await getCollection('opd_daily_data');
    const departmentsCollection = await getCollection('departments');
    const doctorsCollection = await getCollection('doctors');
    const roomsCollection = await getCollection('rooms');

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    // Helper function to safely parse number (handles empty, null, undefined)
    const safeParseInt = (value: any, defaultValue: number = 0): number => {
      if (value === null || value === undefined || value === '' || value === 'null' || value === 'undefined') {
        return defaultValue;
      }
      const parsed = parseInt(String(value), 10);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Helper function to safely parse string (handles empty, null, undefined, numbers)
    const safeParseString = (value: any, defaultValue: string = ''): string => {
      if (value === null || value === undefined || value === '' || value === 'null' || value === 'undefined') {
        return defaultValue;
      }
      return String(value).trim();
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and we have header

      try {
        // Normalize column names (handle spaces, case differences)
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.trim().replace(/\s+/g, '_').toLowerCase();
          normalizedRow[normalizedKey] = row[key];
        });

        // Skip row if essential fields are empty after parsing
        const parsedDate = safeParseString(normalizedRow.date || normalizedRow.date_);
        const parsedDepartmentId = safeParseString(normalizedRow.departmentid || normalizedRow.department_id);
        const parsedDoctorId = safeParseString(normalizedRow.doctorid || normalizedRow.doctor_id);
        
        // Skip rows with empty essential fields (date, departmentId, doctorId)
        if (!parsedDate || !parsedDepartmentId || !parsedDoctorId) {
          continue;
        }

        // Map normalized keys to schema keys
        // Note: Doctor Name column is optional and for reference only, not used in validation
        const mappedRow: any = {
          date: safeParseString(normalizedRow.date || normalizedRow.date_),
          departmentId: safeParseString(normalizedRow.departmentid || normalizedRow.department_id),
          doctorId: safeParseString(normalizedRow.doctorid || normalizedRow.doctor_id), // Convert number to string
          // Doctor Name is optional - if provided, we can use it for validation/display but still need doctorId
          doctorName: safeParseString(normalizedRow.doctorname || normalizedRow.doctor_name),
          employmentType: safeParseString(normalizedRow.employmenttype || normalizedRow.employment_type, 'FT'),
          subspecialty: safeParseString(normalizedRow.subspecialty || normalizedRow.sub_specialty, 'General'),
          isPrimarySpecialty: normalizedRow.isprimaryspecialty !== undefined && normalizedRow.isprimaryspecialty !== null && normalizedRow.isprimaryspecialty !== ''
            ? (normalizedRow.isprimaryspecialty === true || normalizedRow.isprimaryspecialty === 'TRUE' || normalizedRow.isprimaryspecialty === 'true' || normalizedRow.isprimaryspecialty === 1 || normalizedRow.isprimaryspecialty === '1')
            : true,
          roomIds: safeParseString(normalizedRow.roomids || normalizedRow.room_ids),
          slotsPerHour: safeParseInt(normalizedRow.slotsperhour || normalizedRow.slots_per_hour, 4),
          clinicStartTime: safeParseString(normalizedRow.clinicstarttime || normalizedRow.clinic_start_time, '08:00'),
          clinicEndTime: safeParseString(normalizedRow.clinicendtime || normalizedRow.clinic_end_time, '16:00'),
          totalPatients: safeParseInt(normalizedRow.totalpatients || normalizedRow.total_patients),
          booked: safeParseInt(normalizedRow.booked),
          walkIn: safeParseInt(normalizedRow.walkin || normalizedRow.walk_in),
          noShow: safeParseInt(normalizedRow.noshow || normalizedRow.no_show),
          timeDistribution_0_6: safeParseInt(normalizedRow['time_0_6'] || normalizedRow['time_distribution_0-6'] || normalizedRow['time_distribution_0_6']),
          timeDistribution_6_7: safeParseInt(normalizedRow['time_6_7'] || normalizedRow['time_distribution_6-7'] || normalizedRow['time_distribution_6_7']),
          timeDistribution_7_8: safeParseInt(normalizedRow['time_7_8'] || normalizedRow['time_distribution_7-8'] || normalizedRow['time_distribution_7_8']),
          timeDistribution_8_12: safeParseInt(normalizedRow['time_8_12'] || normalizedRow['time_distribution_8-12'] || normalizedRow['time_distribution_8_12']),
          timeDistribution_12_16: safeParseInt(normalizedRow['time_12_16'] || normalizedRow['time_distribution_12-16'] || normalizedRow['time_distribution_12_16']),
          timeDistribution_16_20: safeParseInt(normalizedRow['time_16_20'] || normalizedRow['time_distribution_16-20'] || normalizedRow['time_distribution_16_20']),
          timeDistribution_20_24: safeParseInt(normalizedRow['time_20_24'] || normalizedRow['time_distribution_20-24'] || normalizedRow['time_distribution_20_24']),
          fv: safeParseInt(normalizedRow.fv || normalizedRow['fv_(first_visit)']),
          fcv: safeParseInt(normalizedRow.fcv || normalizedRow['fcv_(first_consultation_visit)']),
          fuv: safeParseInt(normalizedRow.fuv || normalizedRow['fuv_(follow-up_visit)']),
          rv: safeParseInt(normalizedRow.rv || normalizedRow['rv_(return_visit)']),
          procedures: safeParseInt(normalizedRow.procedures),
          orSurgeries: safeParseInt(normalizedRow.orsurgeries || normalizedRow.or_surgeries || normalizedRow['or_surgeries']),
          admissions: safeParseInt(normalizedRow.admissions),
          cath: safeParseInt(normalizedRow.cath || normalizedRow['cath_(cardiology_only)']),
          deliveriesNormal: safeParseInt(normalizedRow.deliveriesnormal || normalizedRow.deliveries_normal || normalizedRow['deliveries_normal_(ob/gyn_only)']),
          deliveriesSC: safeParseInt(normalizedRow.deliveriessc || normalizedRow.deliveries_sc || normalizedRow['deliveries_sc_(ob/gyn_only)']),
          ivf: safeParseInt(normalizedRow.ivf || normalizedRow['ivf_(ob/gyn_only)']),
        };

        // Validate row data with defaults applied
        // Use safeParse to handle errors gracefully
        const validationResult = dailyDataRowSchema.safeParse(mappedRow);
        
        let validatedData;
        if (!validationResult.success) {
          // If validation fails, try to apply defaults and re-validate
          const withDefaults = {
            ...mappedRow,
            // Apply defaults for missing required fields
            date: mappedRow.date || '',
            departmentId: mappedRow.departmentId || '',
            doctorId: mappedRow.doctorId || '',
            employmentType: (mappedRow.employmentType && ['FT', 'PPT'].includes(mappedRow.employmentType)) ? mappedRow.employmentType : 'FT',
            subspecialty: mappedRow.subspecialty || 'General',
            isPrimarySpecialty: mappedRow.isPrimarySpecialty !== undefined ? mappedRow.isPrimarySpecialty : true,
            roomIds: mappedRow.roomIds || '',
            slotsPerHour: mappedRow.slotsPerHour || 4,
            clinicStartTime: mappedRow.clinicStartTime || '08:00',
            clinicEndTime: mappedRow.clinicEndTime || '16:00',
            totalPatients: mappedRow.totalPatients ?? 0,
            booked: mappedRow.booked ?? 0,
            walkIn: mappedRow.walkIn ?? 0,
            noShow: mappedRow.noShow ?? 0,
            timeDistribution_0_6: mappedRow.timeDistribution_0_6 ?? 0,
            timeDistribution_6_7: mappedRow.timeDistribution_6_7 ?? 0,
            timeDistribution_7_8: mappedRow.timeDistribution_7_8 ?? 0,
            timeDistribution_8_12: mappedRow.timeDistribution_8_12 ?? 0,
            timeDistribution_12_16: mappedRow.timeDistribution_12_16 ?? 0,
            timeDistribution_16_20: mappedRow.timeDistribution_16_20 ?? 0,
            timeDistribution_20_24: mappedRow.timeDistribution_20_24 ?? 0,
            fv: mappedRow.fv ?? 0,
            fcv: mappedRow.fcv ?? 0,
            fuv: mappedRow.fuv ?? 0,
            rv: mappedRow.rv ?? 0,
            procedures: mappedRow.procedures ?? 0,
            orSurgeries: mappedRow.orSurgeries ?? 0,
            admissions: mappedRow.admissions ?? 0,
            cath: mappedRow.cath ?? 0,
            deliveriesNormal: mappedRow.deliveriesNormal ?? 0,
            deliveriesSC: mappedRow.deliveriesSC ?? 0,
            ivf: mappedRow.ivf ?? 0,
          };
          
          const retryValidation = dailyDataRowSchema.safeParse(withDefaults);
          if (!retryValidation.success) {
            errors.push(`Row ${rowNumber}: ${retryValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            continue;
          }
          
          validatedData = retryValidation.data;
        } else {
          validatedData = validationResult.data;
        }

        // Verify department exists with tenant isolation
        const departmentQuery = createTenantQuery({ id: validatedData.departmentId }, tenantId);
        const department = await departmentsCollection.findOne<Department>(departmentQuery);
        if (!department) {
          errors.push(`Row ${rowNumber}: Department ID "${validatedData.departmentId}" not found`);
          continue;
        }

        // Verify doctor exists with tenant isolation
        const doctorQuery = createTenantQuery({ id: validatedData.doctorId }, tenantId);
        const doctor = await doctorsCollection.findOne<Doctor>(doctorQuery);
        if (!doctor) {
          errors.push(`Row ${rowNumber}: Doctor ID "${validatedData.doctorId}" not found`);
          continue;
        }

        // Process rooms with tenant isolation
        const rooms: Array<{ roomId: string; roomName: string; roomNumber: string; departmentId: string }> = [];
        if (validatedData.roomIds) {
          const roomIdArray = validatedData.roomIds.split(',').map(id => id.trim()).filter(id => id);
          for (const roomId of roomIdArray) {
            const roomQuery = createTenantQuery({ id: roomId }, tenantId);
            const room = await roomsCollection.findOne<FloorRoom>(roomQuery);
            if (room) {
              rooms.push({
                roomId: room.id,
                roomName: room.roomName || room.label_en || '',
                roomNumber: room.roomNumber || '',
                departmentId: room.departmentId || validatedData.departmentId,
              });
            }
          }
        }

        // Check if data already exists with tenant isolation
        const dateObj = new Date(validatedData.date);
        dateObj.setHours(0, 0, 0, 0);
        
        const existingQuery = createTenantQuery(
          {
            doctorId: validatedData.doctorId,
            date: dateObj,
          },
          tenantId
        );
        const existing = await dailyDataCollection.findOne<OPDDailyData>(existingQuery);

        const dailyData = {
          id: existing?.id || uuidv4(),
          date: dateObj,
          departmentId: validatedData.departmentId,
          doctorId: validatedData.doctorId,
          employmentType: validatedData.employmentType,
          subspecialty: validatedData.subspecialty,
          isPrimarySpecialty: validatedData.isPrimarySpecialty,
          rooms: rooms,
          slotsPerHour: validatedData.slotsPerHour as 1 | 2 | 3 | 4 | 5 | 6,
          clinicStartTime: validatedData.clinicStartTime,
          clinicEndTime: validatedData.clinicEndTime,
          totalPatients: validatedData.totalPatients,
          booked: validatedData.booked,
          walkIn: validatedData.walkIn,
          noShow: validatedData.noShow,
          timeDistribution: {
            '0-6': validatedData.timeDistribution_0_6,
            '6-7': validatedData.timeDistribution_6_7,
            '7-8': validatedData.timeDistribution_7_8,
            '8-12': validatedData.timeDistribution_8_12,
            '12-16': validatedData.timeDistribution_12_16,
            '16-20': validatedData.timeDistribution_16_20,
            '20-24': validatedData.timeDistribution_20_24,
          },
          fv: validatedData.fv,
          fcv: validatedData.fcv,
          fuv: validatedData.fuv,
          rv: validatedData.rv,
          procedures: validatedData.procedures,
          orSurgeries: validatedData.orSurgeries,
          admissions: validatedData.admissions,
          cath: validatedData.cath,
          deliveriesNormal: validatedData.deliveriesNormal,
          deliveriesSC: validatedData.deliveriesSC,
          ivf: validatedData.ivf,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
          createdBy: existing?.createdBy || userId || 'system',
          updatedBy: userId || 'system',
          tenantId, // CRITICAL: Always include tenantId for tenant isolation
        };

        if (existing) {
          await dailyDataCollection.updateOne(
            existingQuery,
            { $set: dailyData }
          );
          updated++;
        } else {
          await dailyDataCollection.insertOne(dailyData);
          imported++;
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(`Row ${rowNumber}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        } else {
          errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${imported} records, updated ${updated} records${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
      details: {
        imported,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'opd.import-data' });
