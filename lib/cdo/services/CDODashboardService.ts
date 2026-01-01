/**
 * CDO Dashboard Service
 * 
 * Service for generating dashboard data and quality indicators.
 * 
 * Section 15: Governance & Quality Outputs
 * - Unit-level outcome dashboards
 * - Service-level outcome dashboards
 * - Longitudinal trend analysis
 * - Accreditation-ready evidence
 */

import { CDORepository } from '../repositories/CDORepository';
import { QualityIndicator, OutcomeEvent, ResponseTimeMetric, ClinicalDecisionPrompt } from '@/lib/models/cdo';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface DashboardSummary {
  periodStart: Date;
  periodEnd: Date;
  careSetting: 'ED' | 'WARD' | 'ICU' | 'ALL';
  
  // Quality Indicators (Section 15)
  qualityIndicators: QualityIndicator[];
  
  // Outcome summaries
  outcomeSummary: {
    totalOutcomes: number;
    outcomesByType: Record<string, number>;
    negativeOutcomes: number;
    positiveOutcomes: number;
  };
  
  // Response time summaries
  responseTimeSummary: {
    avgTimeToRecognition?: number; // minutes
    avgTimeToEscalation?: number; // minutes
    thresholdViolations: number;
  };
  
  // Prompt/Flag summaries
  promptSummary: {
    totalActivePrompts: number;
    unacknowledgedHighRisk: number;
    promptsBySeverity: Record<string, number>;
  };
}

export class CDODashboardService {
  /**
   * Generate dashboard summary for a period
   */
  static async generateDashboardSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: 'ED' | 'WARD' | 'ICU' | 'ALL' = 'ED'
  ): Promise<DashboardSummary> {
    // Get quality indicators for the period
    const qualityIndicators = await CDORepository.getQualityIndicators(
      undefined,
      periodStart,
      periodEnd,
      careSetting === 'ALL' ? undefined : careSetting
    );

    // Calculate outcome summary
    const outcomeSummary = await this.calculateOutcomeSummary(periodStart, periodEnd, careSetting);

    // Calculate response time summary
    const responseTimeSummary = await this.calculateResponseTimeSummary(
      periodStart,
      periodEnd,
      careSetting
    );

    // Calculate prompt summary
    const promptSummary = await this.calculatePromptSummary(periodStart, periodEnd, careSetting);

    return {
      periodStart,
      periodEnd,
      careSetting,
      qualityIndicators,
      outcomeSummary,
      responseTimeSummary,
      promptSummary,
    };
  }

  /**
   * Calculate quality indicators for a period
   * Section 15: Key Indicators
   */
  static async calculateQualityIndicators(
    periodStart: Date,
    periodEnd: Date,
    careSetting: 'ED' | 'WARD' | 'ICU' | 'ALL' = 'ED'
  ): Promise<QualityIndicator[]> {
    const indicators: QualityIndicator[] = [];

    // Indicator 1: Failure to rescue (Section 15)
    // Defined as: Cardiac arrest or death after delay in escalation
    const failureToRescue = await this.calculateFailureToRescue(
      periodStart,
      periodEnd,
      careSetting
    );
    if (failureToRescue) {
      indicators.push(failureToRescue);
    }

    // Indicator 2: Average time to recognition
    const avgTimeToRecognition = await this.calculateAvgTimeToRecognition(
      periodStart,
      periodEnd,
      careSetting
    );
    if (avgTimeToRecognition) {
      indicators.push(avgTimeToRecognition);
    }

    // Indicator 3: Average time to escalation
    const avgTimeToEscalation = await this.calculateAvgTimeToEscalation(
      periodStart,
      periodEnd,
      careSetting
    );
    if (avgTimeToEscalation) {
      indicators.push(avgTimeToEscalation);
    }

    // Indicator 4: ICU transfer after delay count
    const icuTransferAfterDelay = await this.calculateICUTransferAfterDelay(
      periodStart,
      periodEnd,
      careSetting
    );
    if (icuTransferAfterDelay) {
      indicators.push(icuTransferAfterDelay);
    }

    // Save indicators
    for (const indicator of indicators) {
      await CDORepository.saveQualityIndicator(indicator);
    }

    return indicators;
  }

  /**
   * Calculate failure to rescue indicator
   */
  private static async calculateFailureToRescue(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const outcomesCollection = await getCollection('cdo_outcome_events');
    
    // Count cardiac arrest outcomes that occurred after escalation delays
    const cardiacArrestOutcomes = await outcomesCollection
      .find({
        outcomeType: 'CARDIAC_ARREST',
        eventTimestamp: { $gte: periodStart, $lte: periodEnd },
      })
      .toArray();

    // Count ICU transfers after delay
    const icuTransfersAfterDelay = await outcomesCollection
      .find({
        outcomeType: 'ICU_TRANSFER_AFTER_DELAY',
        eventTimestamp: { $gte: periodStart, $lte: periodEnd },
      })
      .toArray();

    const numerator = cardiacArrestOutcomes.length + icuTransfersAfterDelay.length;
    
    // Denominator: Total number of high-severity visits in period
    // For now, we'll use a simple count. In a full implementation, we'd need to query ER visits.
    const denominator = numerator > 0 ? 100 : 0; // Placeholder - would need ER visit count

    return {
      id: uuidv4(),
      indicatorType: 'FAILURE_TO_RESCUE',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as any,
      numerator,
      denominator: denominator > 0 ? denominator : undefined,
      rate: denominator > 0 ? (numerator / denominator) * 100 : undefined,
      exceedsTarget: false,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Calculate average time to recognition
   */
  private static async calculateAvgTimeToRecognition(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const metricsCollection = await getCollection('cdo_response_time_metrics');
    
    const metrics = await metricsCollection
      .find({
        metricType: 'TIME_TO_RECOGNITION',
        startTimestamp: { $gte: periodStart, $lte: periodEnd },
        durationMinutes: { $exists: true },
      })
      .toArray() as ResponseTimeMetric[];

    if (metrics.length === 0) {
      return null;
    }

    const totalMinutes = metrics.reduce((sum, m) => sum + (m.durationMinutes || 0), 0);
    const avgMinutes = totalMinutes / metrics.length;

    return {
      id: uuidv4(),
      indicatorType: 'TIME_TO_RECOGNITION_AVG',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as any,
      numerator: avgMinutes,
      metricValue: avgMinutes,
      metricUnit: 'minutes',
      exceedsTarget: false,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Calculate average time to escalation
   */
  private static async calculateAvgTimeToEscalation(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const metricsCollection = await getCollection('cdo_response_time_metrics');
    
    const metrics = await metricsCollection
      .find({
        metricType: 'TIME_TO_ESCALATION',
        startTimestamp: { $gte: periodStart, $lte: periodEnd },
        durationMinutes: { $exists: true },
      })
      .toArray() as ResponseTimeMetric[];

    if (metrics.length === 0) {
      return null;
    }

    const totalMinutes = metrics.reduce((sum, m) => sum + (m.durationMinutes || 0), 0);
    const avgMinutes = totalMinutes / metrics.length;
    const thresholdViolations = metrics.filter((m) => m.exceedsThreshold).length;

    return {
      id: uuidv4(),
      indicatorType: 'TIME_TO_ESCALATION_AVG',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as any,
      numerator: avgMinutes,
      metricValue: avgMinutes,
      metricUnit: 'minutes',
      exceedsTarget: thresholdViolations > 0,
      exceedsBenchmark: false,
      metadata: {
        thresholdViolations,
        totalMetrics: metrics.length,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Calculate ICU transfer after delay count
   */
  private static async calculateICUTransferAfterDelay(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const outcomesCollection = await getCollection('cdo_outcome_events');
    
    const outcomes = await outcomesCollection
      .find({
        outcomeType: 'ICU_TRANSFER_AFTER_DELAY',
        eventTimestamp: { $gte: periodStart, $lte: periodEnd },
      })
      .toArray() as OutcomeEvent[];

    return {
      id: uuidv4(),
      indicatorType: 'ICU_TRANSFER_AFTER_DELAY_COUNT',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as any,
      numerator: outcomes.length,
      exceedsTarget: false,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Calculate outcome summary
   */
  private static async calculateOutcomeSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<DashboardSummary['outcomeSummary']> {
    const outcomesCollection = await getCollection('cdo_outcome_events');
    
    const outcomes = await outcomesCollection
      .find({
        eventTimestamp: { $gte: periodStart, $lte: periodEnd },
      })
      .toArray() as OutcomeEvent[];

    const outcomesByType: Record<string, number> = {};
    let negativeOutcomes = 0;
    let positiveOutcomes = 0;

    for (const outcome of outcomes) {
      outcomesByType[outcome.outcomeType] = (outcomesByType[outcome.outcomeType] || 0) + 1;
      
      if (outcome.outcomeCategory === 'NEGATIVE') {
        negativeOutcomes++;
      } else if (outcome.outcomeCategory === 'POSITIVE') {
        positiveOutcomes++;
      }
    }

    return {
      totalOutcomes: outcomes.length,
      outcomesByType,
      negativeOutcomes,
      positiveOutcomes,
    };
  }

  /**
   * Calculate response time summary
   */
  private static async calculateResponseTimeSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<DashboardSummary['responseTimeSummary']> {
    const metricsCollection = await getCollection('cdo_response_time_metrics');
    
    const recognitionMetrics = await metricsCollection
      .find({
        metricType: 'TIME_TO_RECOGNITION',
        startTimestamp: { $gte: periodStart, $lte: periodEnd },
        durationMinutes: { $exists: true },
      })
      .toArray() as ResponseTimeMetric[];

    const escalationMetrics = await metricsCollection
      .find({
        metricType: 'TIME_TO_ESCALATION',
        startTimestamp: { $gte: periodStart, $lte: periodEnd },
        durationMinutes: { $exists: true },
      })
      .toArray() as ResponseTimeMetric[];

    const avgTimeToRecognition =
      recognitionMetrics.length > 0
        ? recognitionMetrics.reduce((sum, m) => sum + (m.durationMinutes || 0), 0) /
          recognitionMetrics.length
        : undefined;

    const avgTimeToEscalation =
      escalationMetrics.length > 0
        ? escalationMetrics.reduce((sum, m) => sum + (m.durationMinutes || 0), 0) /
          escalationMetrics.length
        : undefined;

    const thresholdViolations = escalationMetrics.filter((m) => m.exceedsThreshold).length;

    return {
      avgTimeToRecognition,
      avgTimeToEscalation,
      thresholdViolations,
    };
  }

  /**
   * Calculate prompt summary
   */
  private static async calculatePromptSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<DashboardSummary['promptSummary']> {
    const promptsCollection = await getCollection('clinical_decision_prompts');
    const prompts = await promptsCollection
      .find({
        createdAt: { $gte: periodStart, $lte: periodEnd },
        status: 'ACTIVE',
      })
      .toArray() as ClinicalDecisionPrompt[];

    const promptsBySeverity: Record<string, number> = {};
    let unacknowledgedHighRisk = 0;

    for (const prompt of prompts) {
      promptsBySeverity[prompt.severity] = (promptsBySeverity[prompt.severity] || 0) + 1;
      
      if (!prompt.acknowledgedAt && (prompt.severity === 'HIGH' || prompt.severity === 'CRITICAL')) {
        unacknowledgedHighRisk++;
      }
    }

    return {
      totalActivePrompts: prompts.length,
      unacknowledgedHighRisk,
      promptsBySeverity,
    };
  }
}

