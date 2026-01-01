import { MongoClient, Db } from 'mongodb';
import { env } from './env';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Helper function to reset connection cache (useful for testing or connection issues)
export function resetConnectionCache(): void {
  cachedClient = null;
  cachedDb = null;
}

export async function connectDB(): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  try {
    // Add connection timeout and better error handling
    const client = await MongoClient.connect(env.MONGO_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      connectTimeoutMS: 10000,
    });

    const db = client.db(env.DB_NAME);

    cachedClient = client;
    cachedDb = db;

    console.log('MongoDB connected successfully to', env.DB_NAME);
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
    
    // Provide helpful error messages for common issues
    if (errorMessage.includes('authentication failed') || errorMessage.includes('bad auth')) {
      throw new Error(`MongoDB authentication failed. Please check your username and password in MONGO_URL.`);
    } else if (errorMessage.includes('getaddrinfo') || errorMessage.includes('ENOTFOUND')) {
      throw new Error(`MongoDB server not found. Please check your cluster URL in MONGO_URL.`);
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new Error(`MongoDB connection timeout. Please check your network connection and MongoDB Atlas Network Access settings.`);
    }
    
    throw new Error(`Failed to connect to MongoDB: ${errorMessage}`);
  }
}

export async function getCollection(name: string) {
  const db = await connectDB();
  return db.collection(name);
}
