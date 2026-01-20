import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { VALIDATION_PIPE_OPTIONS } from '../src/common/pipes/validation.pipe';
import { startInMemoryMongo, stopInMemoryMongo } from './mongo-test-env';

/**
 * Boots the real AppModule against an in-memory Mongo, wired exactly like
 * main.ts (global prefix, validation pipe, exception filter) so e2e specs
 * exercise the same request pipeline production does.
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = await startInMemoryMongo();
  process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
  process.env.JWT_EXPIRES_IN ??= '1h';
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  const { AppModule } = await import('../src/app.module');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  await app.init();
  return app;
}

export async function destroyTestApp(app: INestApplication | undefined): Promise<void> {
  await app?.close();
  await stopInMemoryMongo();
}
