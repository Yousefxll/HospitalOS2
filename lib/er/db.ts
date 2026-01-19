import type { Db } from 'mongodb';
import { ER_COLLECTIONS } from './constants';

export function getErCollections(db: Db) {
  return {
    patients: db.collection(ER_COLLECTIONS.patients),
    encounters: db.collection(ER_COLLECTIONS.encounters),
    triage: db.collection(ER_COLLECTIONS.triage),
    beds: db.collection(ER_COLLECTIONS.beds),
    bedAssignments: db.collection(ER_COLLECTIONS.bedAssignments),
    staffAssignments: db.collection(ER_COLLECTIONS.staffAssignments),
    notes: db.collection(ER_COLLECTIONS.notes),
    integrationSettings: db.collection(ER_COLLECTIONS.integrationSettings),
    sequences: db.collection(ER_COLLECTIONS.sequences),
  };
}
