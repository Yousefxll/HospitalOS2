import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { ClinicalEvent } from '@/lib/models/ClinicalEvent';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const createEventSchema = z.object({
  type: z.enum(['NOTE', 'ORDER', 'PROCEDURE', 'OTHER']),
  subject: z.string().optional(),
  payload: z.object({
    text: z.string().optional(),
    content: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }).passthrough(), // Allow additional fields
});

/**
 * POST /api/integrations/clinical-events
 * Submit a clinical event for policy checking
 * 
 * Body: { type, subject?, payload }
 * Response: { ok: true, eventId }
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {

    // Validate request body
    const body = await req.json();
    const validation = createEventSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { type, subject, payload } = validation.data;

    // Create clinical event
    const eventId = uuidv4();
    const now = new Date();
    
    const event: ClinicalEvent = {
      id: eventId,
      tenantId, // From session
      userId, // From auth
      platform: 'health',
      type,
      subject,
      payload,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    // Insert into database
    const eventsCollection = await getCollection('clinical_events');
    await eventsCollection.insertOne(event);

    return NextResponse.json({
      ok: true,
      eventId,
    });
  } catch (error) {
    console.error('Create clinical event error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'integrations.clinical-events' });

