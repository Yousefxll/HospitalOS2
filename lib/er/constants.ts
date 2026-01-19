export const ER_COLLECTIONS = {
  patients: 'patients',
  encounters: 'encounters',
  triage: 'triage_assessments',
  beds: 'er_beds',
  bedAssignments: 'er_bed_assignments',
  staffAssignments: 'staff_assignments',
  notes: 'er_notes',
  auditLogs: 'audit_logs',
  integrationSettings: 'integration_settings',
  sequences: 'er_sequences',
} as const;

export const ER_STATUSES = [
  'ARRIVED',
  'REGISTERED',
  'TRIAGED',
  'WAITING_BED',
  'IN_BED',
  'SEEN_BY_DOCTOR',
  'ORDERS_IN_PROGRESS',
  'RESULTS_PENDING',
  'DECISION',
  'DISCHARGED',
  'ADMITTED',
  'TRANSFERRED',
  'CANCELLED',
] as const;

export const ER_ARRIVAL_METHODS = ['WALKIN', 'AMBULANCE', 'TRANSFER'] as const;
export const ER_PAYMENT_STATUSES = ['INSURANCE', 'CASH', 'PENDING'] as const;
export const ER_GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
export const ER_BED_STATES = ['VACANT', 'OCCUPIED', 'CLEANING', 'RESERVED'] as const;
export const ER_STAFF_ASSIGNMENT_ROLES = ['PRIMARY_DOCTOR', 'PRIMARY_NURSE', 'TRIAGE_NURSE'] as const;

export type ErStatus = (typeof ER_STATUSES)[number];
export type ErArrivalMethod = (typeof ER_ARRIVAL_METHODS)[number];
export type ErPaymentStatus = (typeof ER_PAYMENT_STATUSES)[number];
export type ErGender = (typeof ER_GENDERS)[number];
export type ErBedState = (typeof ER_BED_STATES)[number];
export type ErStaffAssignmentRole = (typeof ER_STAFF_ASSIGNMENT_ROLES)[number];
