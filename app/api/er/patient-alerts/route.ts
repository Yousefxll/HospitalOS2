import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const erVisitId = searchParams.get('erVisitId');
    const nationalId = searchParams.get('nationalId');
    const iqama = searchParams.get('iqama');

    if (!erVisitId && !nationalId && !iqama) {
      return NextResponse.json(
        { error: 'ER Visit ID, National ID, or Iqama is required' },
        { status: 400 }
      );
    }

    // Get patient registration
    const erRegistrationsCollection = await getCollection('er_registrations');
    let registration;

    if (erVisitId) {
      registration = await erRegistrationsCollection.findOne({ erVisitId });
    } else if (nationalId) {
      registration = await erRegistrationsCollection.findOne({ 
        nationalId,
        isActive: true,
      });
    } else if (iqama) {
      registration = await erRegistrationsCollection.findOne({ 
        iqama,
        isActive: true,
      });
    }

    if (!registration) {
      return NextResponse.json({
        alerts: [],
        message: 'No patient record found',
      });
    }

    // Get patient alerts from patient_alerts collection
    const patientAlertsCollection = await getCollection('patient_alerts');
    const alerts = await patientAlertsCollection
      .find({
        $or: [
          { nationalId: registration.nationalId },
          { iqama: registration.iqama },
        ],
        isActive: true,
      })
      .toArray();

    // Format alerts
    const formattedAlerts = alerts.map((alert: any) => ({
      id: alert.id,
      type: alert.type, // 'allergy', 'dnr', 'cognitive-impairment', 'critical-history'
      title: alert.title,
      description: alert.description,
      severity: alert.severity || 'medium', // 'high', 'medium', 'low'
    }));

    return NextResponse.json({
      alerts: formattedAlerts,
      patientName: registration.fullName,
    });
  } catch (error: any) {
    console.error('ER patient alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patient alerts', details: error.message },
      { status: 500 }
    );
  }
}

