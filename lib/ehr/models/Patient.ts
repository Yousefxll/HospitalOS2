import { ObjectId } from 'mongodb';

/**
 * EHR Patient Model
 * 
 * Core patient entity for EHR system.
 */

export interface Patient {
  _id?: ObjectId;
  id: string; // UUID
  
  // Demographics
  mrn: string; // Medical Record Number (unique)
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // ISO date string (YYYY-MM-DD)
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  
  // Contact
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  
  // Medical identifiers
  nationalId?: string;
  insuranceId?: string;
  insuranceProvider?: string;
  
  // Status
  isActive: boolean;
  deceasedDate?: string; // ISO date string (YYYY-MM-DD)
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

