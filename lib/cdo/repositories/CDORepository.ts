/**
 * CDO Repository
 * 
 * Repository for CDO entities (the 7 entities from Section 16).
 * Provides read/write operations for CDO collections.
 */

import { getCollection } from '@/lib/db';
import {
  ClinicalDecisionPrompt,
  OutcomeEvent,
  RiskFlag,
  ResponseTimeMetric,
  TransitionOutcome,
  ReadmissionEvent,
  QualityIndicator,
} from '@/lib/models/cdo';

export class CDORepository {
  // ClinicalDecisionPrompt operations
  static async savePrompt(prompt: ClinicalDecisionPrompt): Promise<void> {
    const collection = await getCollection('clinical_decision_prompts');
    await collection.insertOne(prompt);
  }

  static async getPromptById(id: string): Promise<ClinicalDecisionPrompt | null> {
    const collection = await getCollection('clinical_decision_prompts');
    const prompt = await collection.findOne({ id });
    return prompt as ClinicalDecisionPrompt | null;
  }

  static async getPromptsByVisitId(erVisitId: string): Promise<ClinicalDecisionPrompt[]> {
    const collection = await getCollection('clinical_decision_prompts');
    const prompts = await collection
      .find({ erVisitId })
      .sort({ createdAt: -1 })
      .toArray();
    return prompts as ClinicalDecisionPrompt[];
  }

  static async getActivePrompts(
    erVisitId?: string,
    requiresAcknowledgment?: boolean
  ): Promise<ClinicalDecisionPrompt[]> {
    const collection = await getCollection('clinical_decision_prompts');
    const query: any = { status: 'ACTIVE' };
    
    if (erVisitId) {
      query.erVisitId = erVisitId;
    }
    
    if (requiresAcknowledgment !== undefined) {
      query.requiresAcknowledgment = requiresAcknowledgment;
    }
    
    const prompts = await collection
      .find(query)
      .sort({ severity: -1, createdAt: -1 }) // Sort by severity (CRITICAL first), then date
      .toArray();
    return prompts as ClinicalDecisionPrompt[];
  }

  static async acknowledgePrompt(
    id: string,
    acknowledgedBy: string,
    acknowledgmentNotes?: string
  ): Promise<void> {
    const collection = await getCollection('clinical_decision_prompts');
    await collection.updateOne(
      { id },
      {
        $set: {
          acknowledgedAt: new Date(),
          acknowledgedBy,
          acknowledgmentNotes,
          status: 'ACKNOWLEDGED',
          updatedAt: new Date(),
          updatedBy: acknowledgedBy,
        },
      }
    );
  }

  static async updatePromptStatus(
    id: string,
    status: ClinicalDecisionPrompt['status'],
    updatedBy: string
  ): Promise<void> {
    const collection = await getCollection('clinical_decision_prompts');
    const update: any = {
      status,
      updatedAt: new Date(),
      updatedBy,
    };
    
    if (status === 'RESOLVED') {
      update.resolvedAt = new Date();
      update.resolvedBy = updatedBy;
    }
    
    await collection.updateOne({ id }, { $set: update });
  }

  // RiskFlag operations
  static async saveRiskFlag(flag: RiskFlag): Promise<void> {
    const collection = await getCollection('cdo_risk_flags');
    await collection.insertOne(flag);
  }

  static async getRiskFlagsByVisitId(erVisitId: string): Promise<RiskFlag[]> {
    const collection = await getCollection('cdo_risk_flags');
    const flags = await collection
      .find({ erVisitId })
      .sort({ severity: -1, createdAt: -1 })
      .toArray();
    return flags as RiskFlag[];
  }

  static async getActiveRiskFlags(erVisitId?: string): Promise<RiskFlag[]> {
    const collection = await getCollection('cdo_risk_flags');
    const query: any = { status: 'ACTIVE' };
    
    if (erVisitId) {
      query.erVisitId = erVisitId;
    }
    
    const flags = await collection
      .find(query)
      .sort({ severity: -1, createdAt: -1 })
      .toArray();
    return flags as RiskFlag[];
  }

  static async updateRiskFlagStatus(
    id: string,
    status: RiskFlag['status'],
    updatedBy: string
  ): Promise<void> {
    const collection = await getCollection('cdo_risk_flags');
    const update: any = {
      status,
      updatedAt: new Date(),
      updatedBy,
    };
    
    if (status === 'RESOLVED') {
      update.resolvedAt = new Date();
      update.resolvedBy = updatedBy;
    }
    
    await collection.updateOne({ id }, { $set: update });
  }

  // OutcomeEvent operations
  static async saveOutcomeEvent(event: OutcomeEvent): Promise<void> {
    const collection = await getCollection('cdo_outcome_events');
    await collection.insertOne(event);
  }

  static async getOutcomeEventsByVisitId(erVisitId: string): Promise<OutcomeEvent[]> {
    const collection = await getCollection('cdo_outcome_events');
    const events = await collection
      .find({ erVisitId })
      .sort({ eventTimestamp: -1 })
      .toArray();
    return events as OutcomeEvent[];
  }

  // ResponseTimeMetric operations
  static async saveResponseTimeMetric(metric: ResponseTimeMetric): Promise<void> {
    const collection = await getCollection('cdo_response_time_metrics');
    await collection.insertOne(metric);
  }

  static async getResponseTimeMetricsByVisitId(erVisitId: string): Promise<ResponseTimeMetric[]> {
    const collection = await getCollection('cdo_response_time_metrics');
    const metrics = await collection
      .find({ erVisitId })
      .sort({ startTimestamp: -1 })
      .toArray();
    return metrics as ResponseTimeMetric[];
  }

  // TransitionOutcome operations
  static async saveTransitionOutcome(outcome: TransitionOutcome): Promise<void> {
    const collection = await getCollection('cdo_transition_outcomes');
    await collection.insertOne(outcome);
  }

  static async getTransitionOutcomesByVisitId(erVisitId: string): Promise<TransitionOutcome[]> {
    const collection = await getCollection('cdo_transition_outcomes');
    const outcomes = await collection
      .find({ erVisitId })
      .sort({ transitionTimestamp: -1 })
      .toArray();
    return outcomes as TransitionOutcome[];
  }

  // ReadmissionEvent operations
  static async saveReadmissionEvent(event: ReadmissionEvent): Promise<void> {
    const collection = await getCollection('cdo_readmission_events');
    await collection.insertOne(event);
  }

  static async getReadmissionEventsByVisitId(erVisitId: string): Promise<ReadmissionEvent[]> {
    const collection = await getCollection('cdo_readmission_events');
    const events = await collection
      .find({ $or: [{ previousErVisitId: erVisitId }, { readmissionErVisitId: erVisitId }] })
      .sort({ readmissionTimestamp: -1 })
      .toArray();
    return events as ReadmissionEvent[];
  }

  // QualityIndicator operations
  static async saveQualityIndicator(indicator: QualityIndicator): Promise<void> {
    const collection = await getCollection('cdo_quality_indicators');
    await collection.insertOne(indicator);
  }

  static async getQualityIndicators(
    indicatorType?: QualityIndicator['indicatorType'],
    periodStart?: Date,
    periodEnd?: Date,
    careSetting?: QualityIndicator['careSetting']
  ): Promise<QualityIndicator[]> {
    const collection = await getCollection('cdo_quality_indicators');
    const query: any = {};
    
    if (indicatorType) {
      query.indicatorType = indicatorType;
    }
    
    if (periodStart || periodEnd) {
      query.periodStart = {};
      if (periodStart) {
        query.periodStart.$gte = periodStart;
      }
      if (periodEnd) {
        query.periodEnd = { ...query.periodEnd, $lte: periodEnd };
      }
    }
    
    if (careSetting) {
      query.careSetting = careSetting;
    }
    
    const indicators = await collection
      .find(query)
      .sort({ periodStart: -1 })
      .toArray();
    return indicators as QualityIndicator[];
  }
}

