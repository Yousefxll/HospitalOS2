import { ObjectId } from 'mongodb';

export interface Clinic {
  _id?: ObjectId;
  id: string;
  name: string;
  code: string;
  departmentId: string;
  roomIds: string[];
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
