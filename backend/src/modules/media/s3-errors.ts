import { HttpStatus } from '@nestjs/common';

import { ApiException } from '../../common/errors/api.exception';

type S3ErrorShape = {
  name?: string;
  message?: string;
  Code?: string;
  $metadata?: { httpStatusCode?: number };
};

function s3Error(error: unknown): S3ErrorShape {
  return error && typeof error === 'object' ? (error as S3ErrorShape) : {};
}

export function isS3NotFoundError(error: unknown): boolean {
  const record = s3Error(error);
  const status = record.$metadata?.httpStatusCode;
  const code = record.name || record.Code || '';
  return status === 404 || code === 'NotFound' || code === 'NoSuchKey';
}

export function isS3MissingObjectError(error: unknown): boolean {
  const record = s3Error(error);
  const status = record.$metadata?.httpStatusCode;
  const code = record.name || record.Code || '';
  if (isS3NotFoundError(error)) return true;
  return status === 403 || code === 'AccessDenied' || code === 'Forbidden';
}

export function isS3UnknownError(error: unknown): boolean {
  const record = s3Error(error);
  return (
    record.name === 'Unknown' ||
    record.name === 'UnknownError' ||
    record.Code === 'UnknownError' ||
    record.message === 'UnknownError'
  );
}

export function toStorageException(error: unknown): ApiException {
  if (error instanceof ApiException) return error;
  const record = s3Error(error);
  return new ApiException(
    'MEDIA_UPLOAD_FAILED',
    'Could not read or write media in storage',
    HttpStatus.BAD_GATEWAY,
    {
      ...(record.$metadata?.httpStatusCode ? { status: record.$metadata.httpStatusCode } : {}),
      ...(record.name ? { name: record.name } : {}),
    },
  );
}
