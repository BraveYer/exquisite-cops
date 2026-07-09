import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const dbName = process.env.MONGODB_DB || 'test';

if (!uri) {
  throw new Error('Missing MONGODB_URI in environment variables.');
}

let clientPromise: Promise<MongoClient>;

// Cache the client across hot-reloads in development (avoids exhausting connections).
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (process.env.NODE_ENV === 'development') {
  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

// All API routes use this helper to get the (pinned) database.
export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export default clientPromise;
