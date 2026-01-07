import { ObjectId } from 'mongodb';

/**
 * Policy Alert Model
 * 
 * Represents a policy alert generated from checking a clinical event
 * against SAM policy-engine.
 */
export interface PolicyAlert {
  _id?: ObjectId;
  id: string; // UUID
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Link to source event
  eventId: string; // Reference to ClinicalEvent.id
  
  // Alert details
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string; // Brief summary of the alert
  recommendations: string[]; // Array of recommendation strings
  
  // Policy IDs that matched (for quick reference)
  policyIds?: string[];
  
  // Detailed evidence (extended structure)
  evidence?: {
    policyId?: string;
    policyTitle?: string; // More descriptive than policyName
    policyName?: string; // Filename (backward compatibility)
    snippet?: string;
    pageNumber?: number;
    score?: number; // Relevance score
    relevanceScore?: number; // Alias for backward compatibility
    source?: string; // e.g. "CBAHI", "JCI", "Internal"
    lineStart?: number;
    lineEnd?: number;
  }[];
  
  // Traceability information
  trace?: {
    eventId: string;
    engineCallId?: string; // If available from policy-engine
    checkedAt: Date;
    processingTimeMs?: number;
  };
  
  // Timestamps
  createdAt: Date;
}

