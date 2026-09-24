import {
  isS3MissingObjectError,
  isS3NotFoundError,
  isS3UnknownError,
  toStorageException,
} from './s3-errors';

describe('s3-errors', () => {
  it('treats hidden missing keys as absent', () => {
    expect(isS3MissingObjectError({ name: 'NoSuchKey' })).toBe(true);
    expect(isS3MissingObjectError({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } })).toBe(
      true,
    );
    expect(isS3MissingObjectError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(isS3MissingObjectError({ name: 'TimeoutError' })).toBe(false);
  });

  it('does not treat AccessDenied as a true missing object', () => {
    expect(isS3NotFoundError({ name: 'NoSuchKey' })).toBe(true);
    expect(isS3NotFoundError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(isS3NotFoundError({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } })).toBe(
      false,
    );
  });

  it('recognizes the AWS SDK UnknownError from HeadObject', () => {
    expect(isS3UnknownError({ name: 'Unknown', message: 'UnknownError' })).toBe(true);
    expect(isS3UnknownError({ name: 'TimeoutError' })).toBe(false);
  });

  it('maps leftover S3 failures to MEDIA_UPLOAD_FAILED', () => {
    const mapped = toStorageException({ name: 'Unknown', $metadata: { httpStatusCode: 400 } });
    expect(mapped.code).toBe('MEDIA_UPLOAD_FAILED');
    expect(mapped.getStatus()).toBe(502);
  });
});
