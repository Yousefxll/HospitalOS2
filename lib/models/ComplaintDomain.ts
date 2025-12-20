import { ObjectId } from 'mongodb';

export interface ComplaintDomain {
  _id?: ObjectId;
  id: string;
  // Canonical English key
  key: string; // e.g., "NURSING", "MAINTENANCE", "DIET", "HOUSEKEEPING", "OTHER"
  // Bilingual labels (snake_case)
  label_en: string;
  label_ar: string;
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}
