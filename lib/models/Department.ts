import { ObjectId } from 'mongodb';

export interface Department {
  _id?: ObjectId;
  id: string;
  name: string;
  code: string;
  type: 'OPD' | 'IPD' | 'BOTH';
  floorId?: string; // Floor ID where the department is located
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
