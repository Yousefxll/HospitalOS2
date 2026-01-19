import type { ErStatus } from './constants';

export interface TriageVitalsInput {
  systolic?: number | null;
  diastolic?: number | null;
  hr?: number | null;
  rr?: number | null;
  temp?: number | null;
  spo2?: number | null;
}

export interface TriageCalcResult {
  triageLevel: number;
  critical: boolean;
  reasons: string[];
  statusAfterSave: ErStatus;
}

export function calculateTriageLevel(
  vitals: TriageVitalsInput,
  painScore?: number | null
): TriageCalcResult {
  const reasons: string[] = [];
  let critical = false;
  let level = 5;

  const hr = vitals.hr ?? null;
  const rr = vitals.rr ?? null;
  const temp = vitals.temp ?? null;
  const spo2 = vitals.spo2 ?? null;
  const systolic = vitals.systolic ?? null;

  if (spo2 !== null && spo2 < 80) {
    critical = true;
    reasons.push('SpO2 < 80');
    level = Math.min(level, 1);
  }
  if (systolic !== null && systolic < 80) {
    critical = true;
    reasons.push('Systolic < 80');
    level = Math.min(level, 1);
  }
  if (hr !== null && (hr < 40 || hr > 160)) {
    critical = true;
    reasons.push('HR extreme');
    level = Math.min(level, 1);
  }
  if (rr !== null && rr > 35) {
    critical = true;
    reasons.push('RR extreme');
    level = Math.min(level, 1);
  }

  if (!critical) {
    if (spo2 !== null && spo2 < 90) {
      reasons.push('SpO2 < 90');
      level = Math.min(level, 2);
    }
    if (temp !== null && temp >= 39) {
      reasons.push('Temp >= 39');
      level = Math.min(level, 2);
    }
    if (hr !== null && hr > 130) {
      reasons.push('HR > 130');
      level = Math.min(level, 2);
    }
    if (rr !== null && rr >= 30) {
      reasons.push('RR >= 30');
      level = Math.min(level, 2);
    }
  }

  if (level > 2) {
    if (painScore !== null && painScore !== undefined) {
      if (painScore >= 7) {
        level = Math.min(level, 3);
        reasons.push('Pain >= 7');
      } else if (painScore >= 4) {
        level = Math.min(level, 4);
        reasons.push('Pain 4-6');
      }
    }
  }

  return {
    triageLevel: level,
    critical,
    reasons,
    statusAfterSave: 'TRIAGED',
  };
}
