/**
 * Internal policy check processor
 * Extracted from policy-check route to allow direct calls from auto-trigger
 */

import { getCollection } from '@/lib/db';
import { ClinicalEvent } from '@/lib/models/ClinicalEvent';
import { PolicyAlert } from '@/lib/models/PolicyAlert';
import { env } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import { getSeverityThreshold, meetsSeverityThreshold } from './settings';

/**
 * Process a policy check for a clinical event
 * This is the core logic extracted from the API route
 */
export async function processPolicyCheck(
  eventId: string,
  tenantId: string,
  userId: string
): Promise<void> {
  // Load event
  const eventsCollection = await getCollection('clinical_events');
  const event = await eventsCollection.findOne<ClinicalEvent>({
    id: eventId,
    tenantId, // Tenant isolation
  });

  if (!event) {
    throw new Error('Event not found');
  }

  // Extract text from event payload
  const eventText = event.payload.text || event.payload.content || JSON.stringify(event.payload);

  if (!eventText || eventText.trim().length === 0) {
    throw new Error('Event text/content is required');
  }

  // Call policy-engine search endpoint
  const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/search`;
  
  const searchStartTime = Date.now();
  const searchResponse = await fetch(policyEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tenantId, // From session (not env)
      query: eventText,
      topK: 10, // Get top 10 relevant policies
    }),
  });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Policy engine error: ${errorText}`);
  }

  const searchData = await searchResponse.json();
  const results = searchData.results || [];
  const searchEndTime = Date.now();

  // Get severity threshold from settings
  const severityThreshold = await getSeverityThreshold(tenantId);

  // Process results and create policy alerts
  const alertsCollection = await getCollection('policy_alerts');
  const alertIds: string[] = [];
  const now = new Date();
  const processingTimeMs = searchEndTime - searchStartTime;

  // Collect all policy IDs for traceability
  const matchedPolicyIds: string[] = [];
  const evidenceItems: PolicyAlert['evidence'] = [];

  // Create alerts for high-relevance results (score > 0.7)
  for (const result of results) {
    const score = result.score || 0;
    
    // Only create alerts for highly relevant policies (threshold: 0.7)
    if (score > 0.7) {
      const alertId = uuidv4();
      
      // Determine severity based on relevance score
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (score > 0.9) {
        severity = 'critical';
      } else if (score > 0.85) {
        severity = 'high';
      } else if (score > 0.75) {
        severity = 'medium';
      }

      // Extract policy title from filename (remove extension)
      const policyTitle = result.filename 
        ? result.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
        : result.policyId;

      // Determine source (heuristic: check filename for common standards)
      let source = 'Internal';
      const filenameLower = (result.filename || '').toLowerCase();
      if (filenameLower.includes('cbahi') || filenameLower.includes('cbahi')) {
        source = 'CBAHI';
      } else if (filenameLower.includes('jci')) {
        source = 'JCI';
      } else if (filenameLower.includes('iso')) {
        source = 'ISO';
      }

      // Build evidence item with extended structure
      const evidenceItem = {
        policyId: result.policyId,
        policyTitle,
        policyName: result.filename, // Backward compatibility
        snippet: result.snippet,
        pageNumber: result.pageNumber,
        score,
        relevanceScore: score, // Backward compatibility
        source,
        lineStart: result.lineStart,
        lineEnd: result.lineEnd,
      };

      evidenceItems.push(evidenceItem);
      if (result.policyId && !matchedPolicyIds.includes(result.policyId)) {
        matchedPolicyIds.push(result.policyId);
      }

      // Check if alert severity meets threshold
      if (!meetsSeverityThreshold(severity, severityThreshold)) {
        continue; // Skip this alert - doesn't meet threshold
      }

      const alert: PolicyAlert = {
        id: alertId,
        tenantId,
        eventId: event.id,
        severity,
        summary: `Relevant policy found: ${policyTitle} (relevance: ${(score * 100).toFixed(1)}%)`,
        recommendations: [
          `Review policy: ${policyTitle}`,
          result.snippet ? `Relevant section: "${result.snippet.substring(0, 200)}..."` : 'See policy document for details',
        ],
        policyIds: [result.policyId].filter(Boolean),
        evidence: [evidenceItem],
        trace: {
          eventId: event.id,
          engineCallId: searchData.tenantId ? `${searchData.tenantId}-${Date.now()}` : undefined,
          checkedAt: now,
          processingTimeMs,
        },
        createdAt: now,
      };

      await alertsCollection.insertOne(alert);
      alertIds.push(alertId);
    }
  }
}

