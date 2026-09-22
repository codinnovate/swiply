import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

import { ApiException } from '../../common/errors/api.exception';
import {
  isS3MissingObjectError,
  isS3NotFoundError,
  isS3UnknownError,
  toStorageException,
} from './s3-errors';

export const UPLOAD_PART_SIZE = 16 * 1024 * 1024;
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly region?: string;
  private readonly bucket?: string;
  private readonly cloudFrontDomain?: string;
  private readonly distributionId?: string;
  private readonly s3: S3Client;
  private readonly cloudFront: CloudFrontClient;

  constructor(config: ConfigService) {
    this.region = config.get<string>('storage.region');
    this.bucket = config.get<string>('storage.bucket');
    this.cloudFrontDomain = config.get<string>('storage.cloudFrontDomain');
    this.distributionId = config.get<string>('storage.cloudFrontDistributionId');
    const endpoint = config.get<string>('storage.endpoint');
    this.s3 = new S3Client({
      region: this.region ?? 'us-east-1',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    this.cloudFront = new CloudFrontClient({ region: this.region ?? 'us-east-1' });
  }

  assertConfigured(): void {
    if (!this.region || !this.bucket || !this.cloudFrontDomain || !this.distributionId) {
      throw new ApiException(
        'STORAGE_NOT_CONFIGURED',
        'AWS S3 storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  buildObjectKey(workspaceId: string, fileName: string): string {
    const safeName =
      fileName
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^[.-]+|-+$/g, '')
        .slice(0, 180) || 'media';
    return `workspaces/${workspaceId}/${randomUUID()}/${safeName}`;
  }

  async createMultipartUpload(key: string, mimeType: string, workspaceId: string): Promise<string> {
    this.assertConfigured();
    const response = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
        Metadata: { workspaceId },
      }),
    );
    if (!response.UploadId) {
      throw new ApiException(
        'MEDIA_UPLOAD_FAILED',
        'S3 did not create an upload session',
        HttpStatus.BAD_GATEWAY,
      );
    }
    return response.UploadId;
  }

  async signPart(key: string, uploadId: string, partNumber: number): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(
      this.s3,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
  }

  async listParts(
    key: string,
    uploadId: string,
  ): Promise<Array<{ partNumber: number; eTag: string }>> {
    this.assertConfigured();
    const parts: Array<{ partNumber: number; eTag: string }> = [];
    let marker: string | undefined;
    do {
      const response = await this.s3.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of response.Parts ?? []) {
        if (part.PartNumber && part.ETag) {
          parts.push({ partNumber: part.PartNumber, eTag: part.ETag });
        }
      }
      marker = response.IsTruncated ? response.NextPartNumberMarker : undefined;
    } while (marker);
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; eTag: string }>,
  ): Promise<void> {
    this.assertConfigured();
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({ ETag: part.eTag, PartNumber: part.partNumber })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.assertConfigured();
    await this.s3.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async putObject(
    key: string,
    body: Buffer,
    mimeType: string,
    workspaceId: string,
  ): Promise<void> {
    this.assertConfigured();
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          ServerSideEncryption: 'AES256',
          Metadata: { workspaceId },
        }),
      );
    } catch (error) {
      throw toStorageException(error);
    }
  }

  async getObject(key: string): Promise<Buffer> {
    this.assertConfigured();
    try {
      const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes?.length) {
        throw new ApiException(
          'MEDIA_UPLOAD_FAILED',
          'S3 returned an empty object',
          HttpStatus.BAD_GATEWAY,
        );
      }
      return Buffer.from(bytes);
    } catch (error) {
      throw toStorageException(error);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    this.assertConfigured();
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isS3MissingObjectError(error) || isS3UnknownError(error)) return false;
      throw toStorageException(error);
    }
  }

  async headObject(key: string): Promise<{ sizeBytes: number; mimeType: string }> {
    this.assertConfigured();
    try {
      const response = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        sizeBytes: response.ContentLength ?? -1,
        mimeType: response.ContentType?.split(';', 1)[0]?.toLowerCase() ?? '',
      };
    } catch (error) {
      throw toStorageException(error);
    }
  }

  publicUrl(key: string): string {
    this.assertConfigured();
    const domain = this.cloudFrontDomain!.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${domain}/${key}`;
  }

  async deleteObjectAndInvalidate(key: string): Promise<void> {
    this.assertConfigured();
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      if (!isS3NotFoundError(error)) throw toStorageException(error);
    }
    try {
      await this.cloudFront.send(
        new CreateInvalidationCommand({
          DistributionId: this.distributionId,
          InvalidationBatch: {
            CallerReference: randomUUID(),
            Paths: { Quantity: 1, Items: [`/${key}`] },
          },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `CloudFront invalidation failed for ${key}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
