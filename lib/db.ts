import { MongoClient, Db } from 'mongodb';
import { env } from './env';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  const client = await MongoClient.connect(env.MONGO_URL, {
    maxPoolSize: 10,
  });

  const db = client.db(env.DB_NAME);

  cachedClient = client;
  cachedDb = db;

  console.log('MongoDB connected successfully to', env.DB_NAME);

  return db;
}

export async function getCollection(name: string) {
  const db = await connectDB();
  return db.collection(name);
}
