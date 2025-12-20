import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

import { ApiErrorBody } from '../errors/api.exception';

const STATUS_CODE_FALLBACK: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * Shapes *every* error leaving the app into the Section 5 contract:
 *   { "error": { "code", "message", "details": {} } }
 * Nothing else is allowed to reach the client — unknown failures are logged
 * with their stack and reported as an opaque INTERNAL_ERROR.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${body.error.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${request.method} ${request.url} -> ${status} ${body.error.code}`);
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // Already in contract shape (thrown via ApiException).
      if (this.isApiErrorBody(payload)) {
        return {
          status,
          body: {
            error: {
              code: payload.error.code,
              message: payload.error.message,
              details: payload.error.details ?? {},
            },
          },
        };
      }

      // Nest's built-in exceptions (incl. ValidationPipe) — map to a code and
      // preserve the validation messages as details rather than dropping them.
      const { message, details } = this.describeNestException(payload, exception.message);
      return {
        status,
        body: {
          error: {
            code: STATUS_CODE_FALLBACK[status] ?? 'HTTP_ERROR',
            message,
            details,
          },
        },
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: `Malformed value for '${exception.path}'`,
            details: { path: exception.path },
          },
        },
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Document failed schema validation',
            details: { fields: Object.keys(exception.errors) },
          },
        },
      };
    }

    if (this.isDuplicateKeyError(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          error: {
            code: 'DUPLICATE_KEY',
            message: 'A record with these values already exists',
            details: { keys: Object.keys(exception.keyPattern ?? {}) },
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {},
        },
      },
    };
  }

  private describeNestException(
    payload: unknown,
    fallbackMessage: string,
  ): { message: string; details: Record<string, unknown> } {
    if (typeof payload === 'string') {
      return { message: payload, details: {} };
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const raw = (payload as { message: unknown }).message;
      if (Array.isArray(raw)) {
        return {
          message: 'Request validation failed',
          details: { issues: raw.map(String) },
        };
      }
      if (typeof raw === 'string') {
        return { message: raw, details: {} };
      }
    }

    return { message: fallbackMessage, details: {} };
  }

  private isApiErrorBody(payload: unknown): payload is ApiErrorBody {
    return (
      !!payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      !!(payload as ApiErrorBody).error &&
      typeof (payload as ApiErrorBody).error.code === 'string'
    );
  }

  private isDuplicateKeyError(
    exception: unknown,
  ): exception is MongoServerError & { keyPattern?: Record<string, unknown> } {
    return exception instanceof MongoServerError && exception.code === 11000;
  }
}
