import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

import { ApiException } from '../errors/api.exception';
import { HttpExceptionFilter } from './http-exception.filter';

interface CapturedResponse {
  status: number;
  body: { error: { code: string; message: string; details: Record<string, unknown> } };
}

function capture(exception: unknown): CapturedResponse {
  const captured = {} as CapturedResponse;

  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: CapturedResponse['body']) {
      captured.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/api/content/generate' }),
    }),
  } as unknown as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);
  return captured;
}

describe('HttpExceptionFilter', () => {
  it('passes an ApiException through with its code and details intact', () => {
    const { status, body } = capture(
      ApiException.unprocessable('VALIDATION_FAILED', 'Slide count mismatch', { expected: 7 }),
    );

    expect(status).toBe(422);
    expect(body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Slide count mismatch',
        details: { expected: 7 },
      },
    });
  });

  it('maps a ValidationPipe failure to VALIDATION_FAILED and keeps the messages', () => {
    const { status, body } = capture(
      new BadRequestException({
        message: ['goal must be one of the allowed values', 'topic should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    );

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.issues).toEqual([
      'goal must be one of the allowed values',
      'topic should not be empty',
    ]);
  });

  it('maps Nest built-ins to a code by status', () => {
    expect(capture(new NotFoundException('Nope')).body.error.code).toBe('NOT_FOUND');
  });

  it('turns a Mongo duplicate-key error into a 409 naming the keys', () => {
    const duplicate = new MongoServerError({ message: 'E11000 duplicate key' });
    duplicate.code = 11000;
    Object.assign(duplicate, { keyPattern: { socialAccountId: 1, platformInteractionId: 1 } });

    const { status, body } = capture(duplicate);

    expect(status).toBe(409);
    expect(body.error.code).toBe('DUPLICATE_KEY');
    expect(body.error.details.keys).toEqual(['socialAccountId', 'platformInteractionId']);
  });

  it('maps a Mongoose CastError to a 400', () => {
    const { status, body } = capture(
      new MongooseError.CastError('ObjectId', 'nonsense', 'socialAccountId'),
    );

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual({ path: 'socialAccountId' });
  });

  it('never leaks the internals of an unexpected error', () => {
    const { status, body } = capture(
      new Error('ANTHROPIC_API_KEY=sk-ant-secret rejected by upstream'),
    );

    expect(status).toBe(500);
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
    });
    expect(JSON.stringify(body)).not.toContain('sk-ant-secret');
  });
});
