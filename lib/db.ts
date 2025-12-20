import { MongoClient, Db } from 'mongodb';

const DB_NAME = process.env.DB_NAME || 'hospital_ops';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  // Read MONGO_URL at runtime, not at module load time
  const MONGO_URL = process.env.MONGO_URL;
  if (!MONGO_URL) {
    console.error('MONGO_URL environment variable is missing');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
    throw new Error('MONGO_URL is not defined in environment variables');
  }

  const client = await MongoClient.connect(MONGO_URL, {
    maxPoolSize: 10,
  });

  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  console.log('MongoDB connected successfully to', DB_NAME);

  return db;
}

export async function getCollection(name: string) {
  const db = await connectDB();
  return db.collection(name);
}
