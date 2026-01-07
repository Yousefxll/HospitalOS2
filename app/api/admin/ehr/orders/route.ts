/**
 * Admin EHR Orders API
 * POST /api/admin/ehr/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Order } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { emitAutoTriggerEvent } from '@/lib/integrations/auto-trigger';
import { canAutoTrigger } from '@/lib/integrations/check-entitlements';
import { isAutoTriggerEnabled } from '@/lib/integrations/settings';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user;
    const body = await request.json();

    // Validation
    const requiredFields = ['patientId', 'mrn', 'orderType', 'description', 'orderedBy'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (!['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'CONSULT', 'OTHER'].includes(body.orderType)) {
      validationErrors.push({ field: 'orderType', message: 'Invalid order type' });
    }
    
    if (body.priority && !['ROUTINE', 'URGENT', 'STAT', 'ASAP'].includes(body.priority)) {
      validationErrors.push({ field: 'priority', message: 'Invalid priority' });
    }
    
    if (body.startDate && !validateISOTimestamp(body.startDate)) {
      validationErrors.push({ field: 'startDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }
    
    if (body.scheduledTime && !validateISOTimestamp(body.scheduledTime)) {
      validationErrors.push({ field: 'scheduledTime', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Verify patient exists
    const patientsCollection = await getCollection('ehr_patients');
    const patient = await patientsCollection.findOne({ id: body.patientId, mrn: body.mrn });
    
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create order
    const now = getISOTimestamp();
    const order: Order = {
      id: uuidv4(),
      patientId: body.patientId,
      encounterId: body.encounterId,
      mrn: body.mrn,
      orderNumber,
      orderType: body.orderType,
      description: body.description,
      code: body.code,
      codeSystem: body.codeSystem,
      orderedBy: body.orderedBy,
      orderingProviderName: body.orderingProviderName,
      status: body.status || 'SUBMITTED',
      orderedAt: body.orderedAt || now,
      startDate: body.startDate,
      endDate: body.endDate,
      scheduledTime: body.scheduledTime,
      priority: body.priority || 'ROUTINE',
      instructions: body.instructions,
      frequency: body.frequency,
      quantity: body.quantity,
      route: body.route,
      duration: body.duration,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    };

    const ordersCollection = await getCollection('ehr_orders');
    await ordersCollection.insertOne(order);

    // Audit log
    await createAuditLog({
      action: 'CREATE_ORDER',
      resourceType: 'order',
      resourceId: order.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      patientId: order.patientId,
      mrn: order.mrn,
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Auto-trigger policy check (fire-and-forget, non-blocking)
    // Only if user has both SAM and Health entitlements AND auto-trigger is enabled
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      const hasEntitlements = await canAutoTrigger(token);
      const autoTriggerEnabled = await isAutoTriggerEnabled(authResult.tenantId);
      if (hasEntitlements && autoTriggerEnabled) {
        // Extract order description for policy checking
        const orderText = order.description || order.instructions || '';
        
        // Emit auto-trigger event (non-blocking)
        emitAutoTriggerEvent({
          tenantId: authResult.tenantId,
          userId: user.id,
          type: 'ORDER',
          source: 'order_submit',
          subject: order.mrn, // Use MRN as subject (not full patient info)
          payload: {
            text: orderText,
            metadata: {
              orderId: order.id,
              orderType: order.orderType,
              orderNumber: order.orderNumber,
              // Do NOT include PHI in metadata
            },
          },
        }).catch((error) => {
          // Silent failure - already logged in emitAutoTriggerEvent
          console.error('[Auto-Trigger] Failed to emit order event:', error);
        });
      }
    }

    return NextResponse.json(
      { success: true, order },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create order error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'CREATE_ORDER',
          resourceType: 'order',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create order', details: error.message },
      { status: 500 }
    );
  }
}

