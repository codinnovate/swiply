import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'node:crypto';
import * as http2 from 'node:http2';

import type { PushEnvironment } from '../schemas/push-device.schema';

const HOSTS: Record<PushEnvironment, string> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
};
/** Apple rejects provider tokens older than an hour and throttles refreshes faster than 20 minutes. */
const TOKEN_TTL_MS = 50 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface ApnsAlert {
  title: string;
  body: string;
  threadId: string;
  /** A newer alert with the same id replaces the older one on the lock screen. */
  collapseId: string;
  interruptionLevel: 'passive' | 'active' | 'time-sensitive';
  relevanceScore: number;
  category: string;
  /** Don't deliver after this moment, e.g. once a duel has ended. */
  expiresAt?: Date;
  data: Record<string, string>;
}

/** `unregistered` means the token is dead and should be forgotten. */
export type ApnsResult = 'sent' | 'unregistered' | 'failed' | 'skipped';

interface ApnsCredentials {
  keyId: string;
  teamId: string;
  privateKey: string;
  bundleId: string;
}

/** Sends alert pushes over APNs HTTP/2 with token-based auth. */
@Injectable()
export class ApnsService implements OnModuleDestroy {
  private readonly logger = new Logger(ApnsService.name);
  private readonly credentials: ApnsCredentials | null;
  private readonly sessions = new Map<PushEnvironment, http2.ClientHttp2Session>();
  private providerToken: { value: string; issuedAt: number } | null = null;
  private warnedUnconfigured = false;

  constructor(config: ConfigService) {
    const keyId = config.get<string>('apns.keyId');
    const teamId = config.get<string>('apns.teamId');
    const privateKey = config.get<string>('apns.privateKey');
    const bundleId = config.get<string>('apns.bundleId') ?? 'com.swiply.postlock';
    this.credentials =
      keyId && teamId && privateKey ? { keyId, teamId, privateKey, bundleId } : null;
  }

  get isConfigured(): boolean {
    return this.credentials !== null;
  }

  async send(
    device: { token: string; environment: PushEnvironment },
    alert: ApnsAlert,
  ): Promise<ApnsResult> {
    if (!this.credentials) {
      if (!this.warnedUnconfigured) {
        this.logger.warn('APNs credentials are not set; skipping push notifications.');
        this.warnedUnconfigured = true;
      }
      return 'skipped';
    }
    const headers: http2.OutgoingHttpHeaders = {
      ':method': 'POST',
      ':path': `/3/device/${device.token}`,
      authorization: `bearer ${this.token(this.credentials)}`,
      'apns-push-type': 'alert',
      'apns-topic': this.credentials.bundleId,
      'apns-priority': '10',
      'apns-collapse-id': alert.collapseId,
      'content-type': 'application/json',
    };
    if (alert.expiresAt) {
      headers['apns-expiration'] = String(Math.floor(alert.expiresAt.getTime() / 1000));
    }
    const payload = JSON.stringify({
      aps: {
        alert: { title: alert.title, body: alert.body },
        sound: 'default',
        'thread-id': alert.threadId,
        category: alert.category,
        'interruption-level': alert.interruptionLevel,
        'relevance-score': alert.relevanceScore,
      },
      ...alert.data,
    });

    try {
      const { status, body } = await this.request(device.environment, headers, payload);
      if (status === 200) return 'sent';
      const reason = this.reason(body);
      if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
        return 'unregistered';
      }
      if (reason === 'ExpiredProviderToken') this.providerToken = null;
      this.logger.warn(`APNs rejected a push (${status} ${reason ?? 'no reason'})`);
      return 'failed';
    } catch (error) {
      this.logger.warn(`APNs push failed: ${String(error)}`);
      return 'failed';
    }
  }

  onModuleDestroy(): void {
    this.sessions.forEach((session) => session.close());
    this.sessions.clear();
  }

  private token(credentials: ApnsCredentials): string {
    const now = Date.now();
    if (this.providerToken && now - this.providerToken.issuedAt < TOKEN_TTL_MS) {
      return this.providerToken.value;
    }
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'ES256', kid: credentials.keyId })}.${encode({
      iss: credentials.teamId,
      iat: Math.floor(now / 1000),
    })}`;
    const signature = sign('sha256', Buffer.from(unsigned), {
      key: credentials.privateKey,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');
    this.providerToken = { value: `${unsigned}.${signature}`, issuedAt: now };
    return this.providerToken.value;
  }

  private session(environment: PushEnvironment): http2.ClientHttp2Session {
    const existing = this.sessions.get(environment);
    if (existing && !existing.closed && !existing.destroyed) return existing;
    const session = http2.connect(HOSTS[environment]);
    const forget = () => {
      if (this.sessions.get(environment) === session) this.sessions.delete(environment);
    };
    session.on('error', forget);
    session.on('close', forget);
    session.on('goaway', forget);
    // An idle connection shouldn't keep the process alive on shutdown.
    session.unref();
    this.sessions.set(environment, session);
    return session;
  }

  private request(
    environment: PushEnvironment,
    headers: http2.OutgoingHttpHeaders,
    payload: string,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const request = this.session(environment).request(headers);
      let status = 0;
      let body = '';
      request.setEncoding('utf8');
      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        request.close(http2.constants.NGHTTP2_CANCEL);
        reject(new Error('APNs request timed out'));
      });
      request.on('response', (responseHeaders) => {
        status = Number(responseHeaders[':status']);
      });
      request.on('data', (chunk: string) => {
        body += chunk;
      });
      request.on('end', () => resolve({ status, body }));
      request.on('error', reject);
      request.end(payload);
    });
  }

  private reason(body: string): string | undefined {
    try {
      const parsed = JSON.parse(body) as { reason?: unknown };
      return typeof parsed.reason === 'string' ? parsed.reason : undefined;
    } catch {
      return undefined;
    }
  }
}
