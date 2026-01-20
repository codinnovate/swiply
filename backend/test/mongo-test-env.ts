import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server: MongoMemoryServer | null = null;

/**
 * Spins up an in-memory MongoDB so e2e specs run with real Mongoose behaviour
 * (unique indexes, casting, populate) without needing an Atlas connection.
 */
export async function startInMemoryMongo(): Promise<string> {
  server = await MongoMemoryServer.create();
  return server.getUri('swiply-test');
}

export async function stopInMemoryMongo(): Promise<void> {
  await server?.stop();
  server = null;
}

/**
 * Truncates every collection between tests. Reads the connection out of the Nest
 * container rather than mongoose's default global connection — @nestjs/mongoose
 * uses its own `createConnection`, so the global one is always empty here.
 */
export async function clearDatabase(app: INestApplication): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  const collections = await connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
