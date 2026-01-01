/**
 * Ensure CDO Collection Indexes
 * 
 * Creates necessary indexes for CDO collections to optimize queries.
 * Run this script after initial setup or when indexes need to be recreated.
 * 
 * Usage:
 *   node scripts/ensure-cdo-indexes.js
 * 
 * Or with environment variables:
 *   MONGO_URL=... DB_NAME=... node scripts/ensure-cdo-indexes.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

async function ensureIndexes() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // ClinicalDecisionPrompt indexes
    console.log('\n📊 Creating indexes for clinical_decision_prompts...');
    const promptsCollection = db.collection('clinical_decision_prompts');
    await promptsCollection.createIndex({ id: 1 }, { unique: true });
    await promptsCollection.createIndex({ erVisitId: 1 });
    await promptsCollection.createIndex({ registrationId: 1 });
    await promptsCollection.createIndex({ status: 1, severity: 1 }); // For filtering active high-severity prompts
    await promptsCollection.createIndex({ domain: 1, createdAt: -1 }); // For domain-based queries
    await promptsCollection.createIndex({ requiresAcknowledgment: 1, acknowledgedAt: 1 }); // For unacknowledged prompts
    await promptsCollection.createIndex({ createdAt: -1 }); // For chronological queries
    console.log('✅ clinical_decision_prompts indexes created');

    // OutcomeEvent indexes
    console.log('\n📊 Creating indexes for cdo_outcome_events...');
    const outcomesCollection = db.collection('cdo_outcome_events');
    await outcomesCollection.createIndex({ id: 1 }, { unique: true });
    await outcomesCollection.createIndex({ erVisitId: 1 });
    await outcomesCollection.createIndex({ registrationId: 1 });
    await outcomesCollection.createIndex({ outcomeType: 1, eventTimestamp: -1 });
    await outcomesCollection.createIndex({ domain: 1, eventTimestamp: -1 });
    await outcomesCollection.createIndex({ eventTimestamp: -1 }); // For time-based queries
    console.log('✅ cdo_outcome_events indexes created');

    // RiskFlag indexes
    console.log('\n📊 Creating indexes for cdo_risk_flags...');
    const flagsCollection = db.collection('cdo_risk_flags');
    await flagsCollection.createIndex({ id: 1 }, { unique: true });
    await flagsCollection.createIndex({ erVisitId: 1 });
    await flagsCollection.createIndex({ registrationId: 1 });
    await flagsCollection.createIndex({ status: 1, severity: 1 }); // For active high-severity flags
    await flagsCollection.createIndex({ flagType: 1, createdAt: -1 });
    await flagsCollection.createIndex({ sourceDomain: 1, createdAt: -1 });
    await flagsCollection.createIndex({ createdAt: -1 });
    console.log('✅ cdo_risk_flags indexes created');

    // ResponseTimeMetric indexes
    console.log('\n📊 Creating indexes for cdo_response_time_metrics...');
    const metricsCollection = db.collection('cdo_response_time_metrics');
    await metricsCollection.createIndex({ id: 1 }, { unique: true });
    await metricsCollection.createIndex({ erVisitId: 1 });
    await metricsCollection.createIndex({ registrationId: 1 });
    await metricsCollection.createIndex({ metricType: 1, startTimestamp: -1 });
    await metricsCollection.createIndex({ domain: 1, startTimestamp: -1 });
    await metricsCollection.createIndex({ exceedsThreshold: 1, startTimestamp: -1 }); // For threshold violations
    await metricsCollection.createIndex({ startTimestamp: -1 });
    console.log('✅ cdo_response_time_metrics indexes created');

    // TransitionOutcome indexes
    console.log('\n📊 Creating indexes for cdo_transition_outcomes...');
    const transitionsCollection = db.collection('cdo_transition_outcomes');
    await transitionsCollection.createIndex({ id: 1 }, { unique: true });
    await transitionsCollection.createIndex({ erVisitId: 1 });
    await transitionsCollection.createIndex({ sourceRegistrationId: 1 });
    await transitionsCollection.createIndex({ transitionType: 1, transitionTimestamp: -1 });
    await transitionsCollection.createIndex({ hasDeteriorationWithin48h: 1, transitionTimestamp: -1 });
    await transitionsCollection.createIndex({ transitionTimestamp: -1 });
    console.log('✅ cdo_transition_outcomes indexes created');

    // ReadmissionEvent indexes
    console.log('\n📊 Creating indexes for cdo_readmission_events...');
    const readmissionsCollection = db.collection('cdo_readmission_events');
    await readmissionsCollection.createIndex({ id: 1 }, { unique: true });
    await readmissionsCollection.createIndex({ previousErVisitId: 1 });
    await readmissionsCollection.createIndex({ readmissionErVisitId: 1 });
    await readmissionsCollection.createIndex({ readmissionTimeframe: 1, readmissionTimestamp: -1 });
    await readmissionsCollection.createIndex({ previousDischargeTimestamp: -1 });
    await readmissionsCollection.createIndex({ readmissionTimestamp: -1 });
    await readmissionsCollection.createIndex({ isPotentiallyPreventable: 1, readmissionTimestamp: -1 });
    console.log('✅ cdo_readmission_events indexes created');

    // QualityIndicator indexes
    console.log('\n📊 Creating indexes for cdo_quality_indicators...');
    const qualityCollection = db.collection('cdo_quality_indicators');
    await qualityCollection.createIndex({ id: 1 }, { unique: true });
    await qualityCollection.createIndex({ indicatorType: 1, periodStart: -1, periodEnd: -1 });
    await qualityCollection.createIndex({ periodType: 1, periodStart: -1 });
    await qualityCollection.createIndex({ careSetting: 1, periodStart: -1 });
    await qualityCollection.createIndex({ periodStart: -1, periodEnd: -1 }); // For period queries
    console.log('✅ cdo_quality_indicators indexes created');

    console.log('\n✅ All CDO indexes created successfully!');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

ensureIndexes().catch(console.error);

