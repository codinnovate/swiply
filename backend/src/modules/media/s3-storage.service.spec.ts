import { ConfigService } from '@nestjs/config';

import { S3StorageService } from './s3-storage.service';

describe('S3StorageService', () => {
  it('builds immutable workspace-scoped keys with sanitized filenames', () => {
    const service = new S3StorageService(new ConfigService());
    const key = service.buildObjectKey('workspace-1', '../../My photo (final).png');

    expect(key).toMatch(/^workspaces\/workspace-1\/[0-9a-f-]+\/My-photo-final-.png$/);
    expect(key).not.toContain('..');
  });

  it('builds a CloudFront URL without duplicating the protocol', () => {
    const service = new S3StorageService(
      new ConfigService({
        storage: {
          region: 'us-east-1',
          bucket: 'bucket',
          cloudFrontDomain: 'https://cdn.example.com/',
          cloudFrontDistributionId: 'DISTRIBUTION',
        },
      }),
    );

    expect(service.publicUrl('workspaces/one/file.png')).toBe(
      'https://cdn.example.com/workspaces/one/file.png',
    );
  });

  it('fails explicitly when storage is not configured', () => {
    const service = new S3StorageService(new ConfigService());

    expect(() => service.assertConfigured()).toThrow(
      expect.objectContaining({ code: 'STORAGE_NOT_CONFIGURED', status: 503 }),
    );
  });
});
