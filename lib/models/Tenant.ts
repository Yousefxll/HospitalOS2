import { ObjectId } from 'mongodb';

/**
 * Tenant Model
 * 
 * Represents a tenant (customer/organization) with platform entitlements.
 * Entitlements define what platforms the tenant has purchased/access to.
 */
export interface Tenant {
  _id?: ObjectId;
  tenantId: string; // Unique identifier (e.g., 'default', 'tenant-123') - used as tenantKey
  name?: string; // Optional tenant name
  dbName?: string; // Database name for this tenant (e.g., 'syra_tenant__hmg-whh') - if not set, derived from tenantId using generateTenantDbName()
  
  // Platform entitlements (what the tenant has purchased)
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
  };
  
  // Integration settings (optional)
  integrations?: {
    samHealth?: {
      enabled: boolean;
      autoTriggerEnabled: boolean;
      severityThreshold: 'low' | 'medium' | 'high' | 'critical';
      engineTimeoutMs: number;
    };
  };
  
  // Tenant lifecycle management
  status: 'active' | 'blocked'; // Tenant status
  planType: 'demo' | 'paid'; // Subscription plan type
  subscriptionEndsAt?: Date; // When subscription expires
  maxUsers: number; // Maximum number of users allowed
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

