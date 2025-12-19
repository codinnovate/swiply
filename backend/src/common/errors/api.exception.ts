import { HttpException, HttpStatus } from '@nestjs/common';

import type { ErrorCodeValue } from './error-codes';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

/**
 * The only exception type application code should throw. It carries the
 * machine-readable `code` that Section 5 requires; `HttpExceptionFilter`
 * serializes it verbatim.
 */
export class ApiException extends HttpException {
  readonly code: ErrorCodeValue;
  readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCodeValue,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details: Record<string, unknown> = {},
  ) {
    super({ error: { code, message, details } } satisfies ApiErrorBody, status);
    this.code = code;
    this.details = details;
  }

  static notFound(resource: string, details: Record<string, unknown> = {}) {
    return new ApiException(
      'NOT_FOUND',
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
      details,
    );
  }

  static forbidden(code: ErrorCodeValue, message: string, details: Record<string, unknown> = {}) {
    return new ApiException(code, message, HttpStatus.FORBIDDEN, details);
  }

  static unauthorized(code: ErrorCodeValue, message: string, details: Record<string, unknown> = {}) {
    return new ApiException(code, message, HttpStatus.UNAUTHORIZED, details);
  }

  static unprocessable(
    code: ErrorCodeValue,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    return new ApiException(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
