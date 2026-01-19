import type { ErStatus } from './constants';

const ER_TRANSITIONS: Record<ErStatus, ErStatus[]> = {
  ARRIVED: ['REGISTERED', 'CANCELLED'],
  REGISTERED: ['TRIAGED', 'WAITING_BED', 'CANCELLED'],
  TRIAGED: ['WAITING_BED', 'IN_BED', 'SEEN_BY_DOCTOR', 'CANCELLED'],
  WAITING_BED: ['IN_BED', 'SEEN_BY_DOCTOR', 'CANCELLED'],
  IN_BED: ['SEEN_BY_DOCTOR', 'ORDERS_IN_PROGRESS', 'RESULTS_PENDING', 'DECISION', 'CANCELLED'],
  SEEN_BY_DOCTOR: ['ORDERS_IN_PROGRESS', 'RESULTS_PENDING', 'DECISION', 'CANCELLED'],
  ORDERS_IN_PROGRESS: ['RESULTS_PENDING', 'DECISION', 'CANCELLED'],
  RESULTS_PENDING: ['DECISION', 'CANCELLED'],
  DECISION: ['DISCHARGED', 'ADMITTED', 'TRANSFERRED'],
  DISCHARGED: [],
  ADMITTED: [],
  TRANSFERRED: [],
  CANCELLED: [],
};

export function canTransitionStatus(current: ErStatus, next: ErStatus): boolean {
  if (current === next) {
    return true;
  }
  const allowed = ER_TRANSITIONS[current] || [];
  return allowed.includes(next);
}
