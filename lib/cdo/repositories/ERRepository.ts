/**
 * ER Repository
 * 
 * Read-only repository for ER data (er_registrations, er_triage, er_progress_notes, er_dispositions).
 * This repository provides access to existing ER collections without modification.
 * 
 * Section 2: CDO reads from clinical system data (read-only).
 */

import { getCollection } from '@/lib/db';
import { Collection } from 'mongodb';

export interface ERRegistration {
  id: string;
  erVisitId: string;
  nationalId?: string;
  iqama?: string;
  fullName: string;
  dateOfBirth: Date;
  age: number;
  gender: string;
  insuranceCompany?: string;
  policyClass?: string;
  eligibilityStatus?: string;
  paymentType?: string;
  registrationDate: Date;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERTriage {
  id: string;
  erVisitId: string;
  registrationId: string;
  bloodPressure?: string;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  painScore?: number;
  chiefComplaint?: string;
  ctasLevel: number;
  ageGroup?: string;
  severity?: string;
  color?: string;
  routing?: string;
  pregnancyStatus?: string;
  triageDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERProgressNote {
  id: string;
  erVisitId: string;
  registrationId: string;
  physicianName?: string;
  assessment?: string;
  diagnosis?: string;
  managementPlan?: string;
  noteDate: Date;
  isLocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERDisposition {
  id: string;
  erVisitId: string;
  registrationId: string;
  dispositionType: string;
  physicianName?: string;
  notes?: string;
  departmentId?: string;
  bedId?: string;
  dispositionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ERRepository {
  /**
   * Get ER registration by erVisitId
   */
  static async getRegistrationByVisitId(erVisitId: string): Promise<ERRegistration | null> {
    const collection = await getCollection('er_registrations');
    const registration = await collection.findOne({ erVisitId });
    return registration as ERRegistration | null;
  }

  /**
   * Get ER registration by registration ID
   */
  static async getRegistrationById(registrationId: string): Promise<ERRegistration | null> {
    const collection = await getCollection('er_registrations');
    const registration = await collection.findOne({ id: registrationId });
    return registration as ERRegistration | null;
  }

  /**
   * Get all registrations for a date range (for batch processing)
   */
  static async getRegistrationsByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<ERRegistration[]> {
    const collection = await getCollection('er_registrations');
    const query = {
      registrationDate: {
        $gte: startDate,
        $lte: endDate,
      },
      isActive: true,
    };
    
    const cursor = collection.find(query).sort({ registrationDate: -1 });
    if (limit) {
      cursor.limit(limit);
    }
    
    const registrations = await cursor.toArray();
    return registrations as ERRegistration[];
  }

  /**
   * Get triage data for an ER visit
   */
  static async getTriageByVisitId(erVisitId: string): Promise<ERTriage | null> {
    const collection = await getCollection('er_triage');
    const triage = await collection.findOne({ erVisitId });
    return triage as ERTriage | null;
  }

  /**
   * Get all triage records for registrations (for batch processing)
   */
  static async getTriageByRegistrationIds(registrationIds: string[]): Promise<ERTriage[]> {
    if (registrationIds.length === 0) return [];
    
    const collection = await getCollection('er_triage');
    const triages = await collection
      .find({ registrationId: { $in: registrationIds } })
      .toArray();
    return triages as ERTriage[];
  }

  /**
   * Get progress notes for an ER visit (most recent first)
   */
  static async getProgressNotesByVisitId(erVisitId: string): Promise<ERProgressNote[]> {
    const collection = await getCollection('er_progress_notes');
    const notes = await collection
      .find({ erVisitId })
      .sort({ noteDate: -1 })
      .toArray();
    return notes as ERProgressNote[];
  }

  /**
   * Get disposition for an ER visit
   */
  static async getDispositionByVisitId(erVisitId: string): Promise<ERDisposition | null> {
    const collection = await getCollection('er_dispositions');
    const disposition = await collection.findOne({ erVisitId });
    return disposition as ERDisposition | null;
  }

  /**
   * Get complete ER visit data (registration + triage + notes + disposition)
   */
  static async getCompleteVisitData(erVisitId: string): Promise<{
    registration: ERRegistration | null;
    triage: ERTriage | null;
    progressNotes: ERProgressNote[];
    disposition: ERDisposition | null;
  }> {
    const [registration, triage, progressNotes, disposition] = await Promise.all([
      this.getRegistrationByVisitId(erVisitId),
      this.getTriageByVisitId(erVisitId),
      this.getProgressNotesByVisitId(erVisitId),
      this.getDispositionByVisitId(erVisitId),
    ]);

    return {
      registration,
      triage,
      progressNotes,
      disposition,
    };
  }

  /**
   * Get all active ER visits (registered but not yet completed)
   */
  static async getActiveVisits(limit?: number): Promise<ERRegistration[]> {
    const collection = await getCollection('er_registrations');
    const query = {
      isActive: true,
      status: { $in: ['registered', 'triaged', 'in-progress'] },
    };
    
    const cursor = collection.find(query).sort({ registrationDate: -1 });
    if (limit) {
      cursor.limit(limit);
    }
    
    const visits = await cursor.toArray();
    return visits as ERRegistration[];
  }
}

