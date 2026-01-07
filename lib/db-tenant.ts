/**
 * Tenant-scoped database collection wrappers
 * 
 * These wrappers automatically inject tenantId into all queries to enforce
 * strict tenant isolation. Use getTenantCollection for tenant-scoped access
 * and getPlatformCollection for platform-only (cross-tenant) access.
 */

import { Collection, Filter, FindOptions, CountOptions, UpdateFilter, Document, AggregateOptions } from 'mongodb';
import { getCollection } from './db';

const PLATFORM_ROLES = ['syra-owner', 'platform', 'owner'];

/**
 * Tenant-scoped collection wrapper
 * Automatically injects tenantId into all queries
 */
class TenantCollection {
  private collection: Collection;
  private tenantId: string;
  private routeName: string;

  constructor(collection: Collection, tenantId: string, routeName: string = 'unknown') {
    this.collection = collection;
    this.tenantId = tenantId;
    this.routeName = routeName;

    // Runtime safety check
    if (!tenantId || tenantId === '' || tenantId === null) {
      throw new Error(`[TENANT] ${routeName}: tenantId is required but was ${tenantId}`);
    }

    console.log(`[TENANT] ${routeName}: Using tenantId=${tenantId}`);
  }

  /**
   * Build tenant filter - merges tenantId with provided filter
   */
  private buildFilter(filter: Filter<Document> = {}): Filter<Document> {
    return {
      ...filter,
      tenantId: this.tenantId,
    };
  }

  /**
   * Find documents with tenant isolation
   */
  find(filter: Filter<Document> = {}, options?: FindOptions) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.find(tenantFilter, options);
  }

  /**
   * Find one document with tenant isolation
   */
  async findOne(filter: Filter<Document> = {}, options?: FindOptions) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.findOne(tenantFilter, options);
  }

  /**
   * Count documents with tenant isolation
   */
  async countDocuments(filter: Filter<Document> = {}, options?: CountOptions) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.countDocuments(tenantFilter, options);
  }

  /**
   * Aggregate with tenant isolation
   * Automatically adds $match stage for tenantId at the beginning
   */
  async aggregate(pipeline: Document[] = [], options?: AggregateOptions) {
    // Ensure first stage is $match for tenantId
    const tenantMatch = { $match: { tenantId: this.tenantId } };
    
    // If pipeline already starts with $match, merge tenantId into it
    if (pipeline.length > 0 && pipeline[0].$match) {
      pipeline[0].$match = {
        ...pipeline[0].$match,
        tenantId: this.tenantId,
      };
      return this.collection.aggregate(pipeline, options);
    } else {
      // Prepend tenant match
      return this.collection.aggregate([tenantMatch, ...pipeline], options);
    }
  }

  /**
   * Update one document - automatically adds tenantId to filter
   */
  async updateOne(
    filter: Filter<Document>,
    update: UpdateFilter<Document>,
    options?: any
  ) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.updateOne(tenantFilter, update, options);
  }

  /**
   * Update many documents - automatically adds tenantId to filter
   */
  async updateMany(
    filter: Filter<Document>,
    update: UpdateFilter<Document>,
    options?: any
  ) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.updateMany(tenantFilter, update, options);
  }

  /**
   * Delete one document - automatically adds tenantId to filter
   */
  async deleteOne(filter: Filter<Document>, options?: any) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.deleteOne(tenantFilter, options);
  }

  /**
   * Delete many documents - automatically adds tenantId to filter
   */
  async deleteMany(filter: Filter<Document>, options?: any) {
    const tenantFilter = this.buildFilter(filter);
    return this.collection.deleteMany(tenantFilter, options);
  }

  /**
   * Insert one document - automatically adds tenantId to document
   */
  async insertOne(doc: Document, options?: any) {
    const docWithTenant = {
      ...doc,
      tenantId: this.tenantId,
    };
    return this.collection.insertOne(docWithTenant, options);
  }

  /**
   * Insert many documents - automatically adds tenantId to each document
   */
  async insertMany(docs: Document[], options?: any) {
    const docsWithTenant = docs.map(doc => ({
      ...doc,
      tenantId: this.tenantId,
    }));
    return this.collection.insertMany(docsWithTenant, options);
  }

  /**
   * Get raw collection (use with caution - bypasses tenant isolation)
   * Only use for operations that explicitly need raw access
   */
  getRawCollection(): Collection {
    console.warn(`[TENANT] ${this.routeName}: Using raw collection - tenant isolation bypassed`);
    return this.collection;
  }
}

/**
 * Platform collection wrapper (no tenant filtering)
 * Only usable by platform roles
 */
class PlatformCollection {
  private collection: Collection;
  private userRole: string;
  private routeName: string;

  constructor(collection: Collection, userRole: string, routeName: string = 'unknown') {
    this.collection = collection;
    this.userRole = userRole;
    this.routeName = routeName;

    // Runtime safety check - only platform roles can use this
    if (!PLATFORM_ROLES.includes(userRole)) {
      throw new Error(
        `[TENANT] ${routeName}: Platform collection access denied for role ${userRole}. ` +
        `Only ${PLATFORM_ROLES.join(', ')} can access platform collections.`
      );
    }

    console.log(`[TENANT] ${routeName}: Using platform collection (role=${userRole})`);
  }

  // Expose all collection methods without tenant filtering
  find(filter: Filter<Document> = {}, options?: FindOptions) {
    return this.collection.find(filter, options);
  }

  findOne(filter: Filter<Document> = {}, options?: FindOptions) {
    return this.collection.findOne(filter, options);
  }

  countDocuments(filter: Filter<Document> = {}, options?: CountOptions) {
    return this.collection.countDocuments(filter, options);
  }

  aggregate(pipeline: Document[] = [], options?: AggregateOptions) {
    return this.collection.aggregate(pipeline, options);
  }

  updateOne(filter: Filter<Document>, update: UpdateFilter<Document>, options?: any) {
    return this.collection.updateOne(filter, update, options);
  }

  updateMany(filter: Filter<Document>, update: UpdateFilter<Document>, options?: any) {
    return this.collection.updateMany(filter, update, options);
  }

  deleteOne(filter: Filter<Document>, options?: any) {
    return this.collection.deleteOne(filter, options);
  }

  deleteMany(filter: Filter<Document>, options?: any) {
    return this.collection.deleteMany(filter, options);
  }

  insertOne(doc: Document, options?: any) {
    return this.collection.insertOne(doc, options);
  }

  insertMany(docs: Document[], options?: any) {
    return this.collection.insertMany(docs, options);
  }

  getRawCollection(): Collection {
    return this.collection;
  }
}

/**
 * Get tenant-scoped collection
 * All queries automatically include tenantId filter
 * 
 * @param collectionName - MongoDB collection name
 * @param tenantId - Tenant ID from session (required)
 * @param routeName - Route name for logging (optional)
 */
export async function getTenantCollection(
  collectionName: string,
  tenantId: string,
  routeName?: string
): Promise<TenantCollection> {
  if (!tenantId || tenantId === '' || tenantId === null) {
    throw new Error(`[TENANT] getTenantCollection: tenantId is required but was ${tenantId}`);
  }

  if (tenantId === 'platform') {
    throw new Error(
      '[TENANT] getTenantCollection: Cannot use "platform" tenantId. Use getPlatformCollection for platform access.'
    );
  }

  const collection = await getCollection(collectionName);
  return new TenantCollection(collection, tenantId, routeName);
}

/**
 * Get platform collection (no tenant filtering)
 * Only usable by platform roles (syra-owner, platform, owner)
 * 
 * @param collectionName - MongoDB collection name
 * @param userRole - User role (must be platform role)
 * @param routeName - Route name for logging (optional)
 */
export async function getPlatformCollection(
  collectionName: string,
  userRole: string,
  routeName?: string
): Promise<PlatformCollection> {
  if (!PLATFORM_ROLES.includes(userRole)) {
    throw new Error(
      `[TENANT] getPlatformCollection: Access denied. Role ${userRole} is not a platform role. ` +
      `Only ${PLATFORM_ROLES.join(', ')} can access platform collections.`
    );
  }

  const collection = await getCollection(collectionName);
  return new PlatformCollection(collection, userRole, routeName);
}

