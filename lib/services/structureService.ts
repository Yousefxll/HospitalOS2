/**
 * Structure Service - Patient Experience
 * 
 * Unified service layer for Floors, Departments, and Rooms (Patient Experience module)
 * This replaces direct MongoDB access in API routes.
 */

import { getCollection } from '@/lib/db';
import { Floor, FloorDepartment, FloorRoom } from '@/lib/models/Floor';

// ============================================================================
// Floor Operations
// ============================================================================

export async function getAllFloors(): Promise<Floor[]> {
  const floorsCollection = await getCollection('floors');
  const floors = await floorsCollection
    .find({ active: true })
    .sort({ number: 1 })
    .toArray();
  
  return floors.map((floor: any) => ({
    _id: floor._id,
    id: floor.id,
    number: floor.number,
    name: floor.name,
    key: floor.key,
    label_en: floor.label_en || floor.labelEn,
    label_ar: floor.label_ar || floor.labelAr,
    active: floor.active !== false, // Default to true
    createdAt: floor.createdAt,
    updatedAt: floor.updatedAt,
    createdBy: floor.createdBy,
    updatedBy: floor.updatedBy,
  })) as Floor[];
}

export async function getFloorById(id: string): Promise<Floor | null> {
  const floorsCollection = await getCollection('floors');
  const floor = await floorsCollection.findOne({ id, active: true });
  
  if (!floor) return null;
  
  return {
    _id: floor._id,
    id: floor.id,
    number: floor.number,
    name: floor.name,
    key: floor.key,
    label_en: floor.label_en || floor.labelEn,
    label_ar: floor.label_ar || floor.labelAr,
    active: floor.active !== false,
    createdAt: floor.createdAt,
    updatedAt: floor.updatedAt,
    createdBy: floor.createdBy,
    updatedBy: floor.updatedBy,
  } as Floor;
}

export async function createFloor(data: {
  number: string;
  name?: string;
  label_en: string;
  label_ar: string;
  key?: string;
  createdBy: string;
}): Promise<Floor> {
  const floorsCollection = await getCollection('floors');
  const { v4: uuidv4 } = await import('uuid');
  
  const floorId = uuidv4();
  const floorKey = data.key || `FLOOR_${data.number}`;
  
  const floor: Floor = {
    id: floorId,
    number: data.number,
    name: data.name,
    key: floorKey,
    label_en: data.label_en,
    label_ar: data.label_ar,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
  };
  
  await floorsCollection.insertOne(floor as any);
  return floor;
}

export async function updateFloor(
  id: string,
  data: Partial<{
    number: string;
    name: string;
    label_en: string;
    label_ar: string;
    updatedBy: string;
  }>
): Promise<Floor | null> {
  const floorsCollection = await getCollection('floors');
  
  const updateData: any = {
    ...data,
    updatedAt: new Date(),
  };
  
  if (data.updatedBy) {
    updateData.updatedBy = data.updatedBy;
  }
  
  const result = await floorsCollection.findOneAndUpdate(
    { id, active: true },
    { $set: updateData },
    { returnDocument: 'after' }
  );
  
  if (!result) return null;
  
  return {
    _id: result._id,
    id: result.id,
    number: result.number,
    name: result.name,
    key: result.key,
    label_en: result.label_en || result.labelEn,
    label_ar: result.label_ar || result.labelAr,
    active: result.active !== false,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    createdBy: result.createdBy,
    updatedBy: result.updatedBy,
  } as Floor;
}

export async function deleteFloor(id: string, updatedBy: string): Promise<boolean> {
  const floorsCollection = await getCollection('floors');
  
  const result = await floorsCollection.updateOne(
    { id, active: true },
    {
      $set: {
        active: false,
        updatedAt: new Date(),
        updatedBy,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

// ============================================================================
// Department Operations
// ============================================================================

export async function getAllDepartments(): Promise<FloorDepartment[]> {
  const departmentsCollection = await getCollection('floor_departments');
  const departments = await departmentsCollection
    .find({ active: true })
    .sort({ label_en: 1 })
    .toArray();
  
  return departments.map((dept: any) => ({
    _id: dept._id,
    id: dept.id,
    floorId: dept.floorId,
    floorKey: dept.floorKey,
    departmentId: dept.departmentId,
    departmentKey: dept.departmentKey,
    departmentName: dept.departmentName,
    key: dept.key,
    label_en: dept.label_en || dept.labelEn,
    label_ar: dept.label_ar || dept.labelAr,
    active: dept.active !== false,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
    createdBy: dept.createdBy,
    updatedBy: dept.updatedBy,
  })) as FloorDepartment[];
}

export async function getDepartmentsByFloor(floorKey: string): Promise<FloorDepartment[]> {
  const departmentsCollection = await getCollection('floor_departments');
  const departments = await departmentsCollection
    .find({ floorKey, active: true })
    .sort({ label_en: 1 })
    .toArray();
  
  return departments.map((dept: any) => ({
    _id: dept._id,
    id: dept.id,
    floorId: dept.floorId,
    floorKey: dept.floorKey,
    departmentId: dept.departmentId,
    departmentKey: dept.departmentKey,
    departmentName: dept.departmentName,
    key: dept.key,
    label_en: dept.label_en || dept.labelEn,
    label_ar: dept.label_ar || dept.labelAr,
    active: dept.active !== false,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
    createdBy: dept.createdBy,
    updatedBy: dept.updatedBy,
  })) as FloorDepartment[];
}

export async function createDepartment(data: {
  floorId: string;
  floorKey: string;
  departmentId?: string;
  departmentKey: string;
  departmentName?: string;
  label_en: string;
  label_ar: string;
  key?: string;
  createdBy: string;
}): Promise<FloorDepartment> {
  const departmentsCollection = await getCollection('floor_departments');
  const { v4: uuidv4 } = await import('uuid');
  
  const deptId = uuidv4();
  const deptKey = data.key || data.departmentKey || `DEPT_${deptId.slice(0, 8).toUpperCase()}`;
  
  const department: FloorDepartment = {
    id: deptId,
    floorId: data.floorId,
    floorKey: data.floorKey,
    departmentId: data.departmentId || deptId,
    departmentKey: data.departmentKey,
    departmentName: data.departmentName,
    key: deptKey,
    label_en: data.label_en,
    label_ar: data.label_ar,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
  };
  
  await departmentsCollection.insertOne(department as any);
  return department;
}

export async function updateDepartment(
  id: string,
  data: Partial<{
    floorKey: string;
    departmentKey: string;
    departmentName: string;
    label_en: string;
    label_ar: string;
    updatedBy: string;
  }>
): Promise<FloorDepartment | null> {
  const departmentsCollection = await getCollection('floor_departments');
  
  const updateData: any = {
    ...data,
    updatedAt: new Date(),
  };
  
  if (data.updatedBy) {
    updateData.updatedBy = data.updatedBy;
  }
  
  const result = await departmentsCollection.findOneAndUpdate(
    { id, active: true },
    { $set: updateData },
    { returnDocument: 'after' }
  );
  
  if (!result) return null;
  
  return {
    _id: result._id,
    id: result.id,
    floorId: result.floorId,
    floorKey: result.floorKey,
    departmentId: result.departmentId,
    departmentKey: result.departmentKey,
    departmentName: result.departmentName,
    key: result.key,
    label_en: result.label_en || result.labelEn,
    label_ar: result.label_ar || result.labelAr,
    active: result.active !== false,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    createdBy: result.createdBy,
    updatedBy: result.updatedBy,
  } as FloorDepartment;
}

export async function deleteDepartment(id: string, updatedBy: string): Promise<boolean> {
  const departmentsCollection = await getCollection('floor_departments');
  
  const result = await departmentsCollection.updateOne(
    { id, active: true },
    {
      $set: {
        active: false,
        updatedAt: new Date(),
        updatedBy,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

// ============================================================================
// Room Operations
// ============================================================================

export async function getAllRooms(): Promise<FloorRoom[]> {
  const roomsCollection = await getCollection('floor_rooms');
  const rooms = await roomsCollection
    .find({ active: true })
    .sort({ roomNumber: 1 })
    .toArray();
  
  return rooms.map((room: any) => ({
    _id: room._id,
    id: room.id,
    floorId: room.floorId,
    floorKey: room.floorKey,
    departmentId: room.departmentId,
    departmentKey: room.departmentKey,
    roomNumber: room.roomNumber,
    roomName: room.roomName,
    key: room.key,
    label_en: room.label_en || room.labelEn,
    label_ar: room.label_ar || room.labelAr,
    active: room.active !== false,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    createdBy: room.createdBy,
    updatedBy: room.updatedBy,
  })) as FloorRoom[];
}

export async function getRoomsByFloorAndDepartment(
  floorKey: string,
  departmentKey: string
): Promise<FloorRoom[]> {
  const roomsCollection = await getCollection('floor_rooms');
  const rooms = await roomsCollection
    .find({ floorKey, departmentKey, active: true })
    .sort({ roomNumber: 1 })
    .toArray();
  
  return rooms.map((room: any) => ({
    _id: room._id,
    id: room.id,
    floorId: room.floorId,
    floorKey: room.floorKey,
    departmentId: room.departmentId,
    departmentKey: room.departmentKey,
    roomNumber: room.roomNumber,
    roomName: room.roomName,
    key: room.key,
    label_en: room.label_en || room.labelEn,
    label_ar: room.label_ar || room.labelAr,
    active: room.active !== false,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    createdBy: room.createdBy,
    updatedBy: room.updatedBy,
  })) as FloorRoom[];
}

export async function createRoom(data: {
  floorId: string;
  floorKey: string;
  departmentId: string;
  departmentKey: string;
  roomNumber: string;
  roomName?: string;
  label_en: string;
  label_ar: string;
  key?: string;
  createdBy: string;
}): Promise<FloorRoom> {
  const roomsCollection = await getCollection('floor_rooms');
  const { v4: uuidv4 } = await import('uuid');
  
  const roomId = uuidv4();
  const roomKey = data.key || `ROOM_${data.roomNumber.replace(/\s+/g, '_').toUpperCase()}`;
  
  const room: FloorRoom = {
    id: roomId,
    floorId: data.floorId,
    floorKey: data.floorKey,
    departmentId: data.departmentId,
    departmentKey: data.departmentKey,
    roomNumber: data.roomNumber,
    roomName: data.roomName,
    key: roomKey,
    label_en: data.label_en,
    label_ar: data.label_ar,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: data.createdBy,
    updatedBy: data.createdBy,
  };
  
  await roomsCollection.insertOne(room as any);
  return room;
}

export async function updateRoom(
  id: string,
  data: Partial<{
    floorKey: string;
    departmentKey: string;
    roomNumber: string;
    roomName: string;
    label_en: string;
    label_ar: string;
    updatedBy: string;
  }>
): Promise<FloorRoom | null> {
  const roomsCollection = await getCollection('floor_rooms');
  
  const updateData: any = {
    ...data,
    updatedAt: new Date(),
  };
  
  if (data.updatedBy) {
    updateData.updatedBy = data.updatedBy;
  }
  
  const result = await roomsCollection.findOneAndUpdate(
    { id, active: true },
    { $set: updateData },
    { returnDocument: 'after' }
  );
  
  if (!result) return null;
  
  return {
    _id: result._id,
    id: result.id,
    floorId: result.floorId,
    floorKey: result.floorKey,
    departmentId: result.departmentId,
    departmentKey: result.departmentKey,
    roomNumber: result.roomNumber,
    roomName: result.roomName,
    key: result.key,
    label_en: result.label_en || result.labelEn,
    label_ar: result.label_ar || result.labelAr,
    active: result.active !== false,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    createdBy: result.createdBy,
    updatedBy: result.updatedBy,
  } as FloorRoom;
}

export async function deleteRoom(id: string, updatedBy: string): Promise<boolean> {
  const roomsCollection = await getCollection('floor_rooms');
  
  const result = await roomsCollection.updateOne(
    { id, active: true },
    {
      $set: {
        active: false,
        updatedAt: new Date(),
        updatedBy,
      },
    }
  );
  
  return result.modifiedCount > 0;
}


