/**
 * Practice and Risk Detector Models
 */
import type { ObjectId } from 'mongodb';

export interface Practice {
  _id?: ObjectId;
  id: string; // UUID
  tenantId: string; // Tenant isolation - from session
  
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  title: string;
  description: string;
  frequency: 'Rare' | 'Occasional' | 'Frequent' | 'Daily';
  ownerRole?: string;
  status: 'active' | 'archived';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskRun {
  _id?: ObjectId;
  id: string; // UUID
  tenantId: string; // Tenant isolation - from session
  
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  createdBy: string; // userId
  inputPracticeIds: string[]; // Array of Practice IDs
  resultsJson: {
    practices: Array<{
      practiceId: string;
      status: 'Covered' | 'Partial' | 'NoPolicy' | 'Conflict';
      relatedPolicies: Array<{
        policyId: string;
        title: string;
        documentId: string;
        citations: Array<{
          pageNumber: number;
          snippet: string;
        }>;
      }>;
      severity: 'Low' | 'Med' | 'High' | 'Critical';
      likelihood: number; // 0-1
      riskScore: number; // 0-100
      recommendations: string[];
    }>;
    metadata?: {
      totalPractices: number;
      policiesAnalyzed: number;
      model?: string;
      analyzedAt: string;
    };
  };
  
  createdAt: Date;
}
