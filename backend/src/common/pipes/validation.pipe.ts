import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Section 12: unknown/malformed fields are rejected outright rather than
 * silently stripped, so a typo'd field in an API call fails loudly instead of
 * quietly doing the wrong thing.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  validationError: { target: false, value: false },
};

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe(VALIDATION_PIPE_OPTIONS);
}
