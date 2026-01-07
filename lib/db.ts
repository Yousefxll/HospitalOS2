import type { Db, Collection } from 'mongodb';
import { getHospitalOpsClient, resetAllConnectionCaches } from './db/mongo';
import { env } from './env';

// Optional: cache db promise per runtime (useful in production too)
let _dbPromise: Promise<Db> | null = null;

// Helper function to reset connection cache (useful for testing or connection issues)
export function resetConnectionCache(): void {
  resetAllConnectionCaches();
  _dbPromise = null;
}

/**
 * Connect to Hospital Ops DB and return Db instance.
 * - No top-level connection
 * - Caches Db promise to avoid repeated connects
 */
export async function connectDB(): Promise<Db> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = (async () => {
    try {
      const { db } = await getHospitalOpsClient();
      return db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log connection details (hide password)
      const maskedUrl = env.MONGO_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.error('Connection details:', {
        url: maskedUrl,
        dbName: env.DB_NAME,
        error: errorMessage,
      });

      // Important: clear cache on failure so next call can retry
      _dbPromise = null;

      // Provide helpful error messages for common issues
      if (errorMessage.toLowerCase().includes('authentication failed') || errorMessage.toLowerCase().includes('bad auth')) {
        throw new Error('MongoDB authentication failed. Please check your username and password in MONGO_URL.');
      }

      if (errorMessage.includes('getaddrinfo') || errorMessage.includes('ENOTFOUND')) {
        throw new Error('MongoDB server not found. Please check your cluster URL in MONGO_URL.');
      }

      if (errorMessage.toLowerCase().includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        throw new Error('MongoDB connection timeout. Please check your network and MongoDB Atlas Network Access settings.');
      }

      throw new Error(`Failed to connect to MongoDB: ${errorMessage}`);
    }
  })();

  return _dbPromise;
}

/**
 * Get a collection by name.
 */
export async function getCollection<T = unknown>(name: string): Promise<Collection<T>> {
  const db = await connectDB();
  return db.collection<T>(name);
}