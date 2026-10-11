import { generateKeyPairSync, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as http2 from 'node:http2';

import { ApnsService, type ApnsAlert } from './apns.service';

jest.mock('node:http2', () => ({
  ...jest.requireActual<typeof import('node:http2')>('node:http2'),
  connect: jest.fn(),
}));

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const token = 'ab'.repeat(32);

const alert: ApnsAlert = {
  title: '@bob took the lead',
  body: "You're down 3–4 with 6h left.",
  threadId: 'duel-1',
  collapseId: 'duel-1',
  interruptionLevel: 'time-sensitive',
  relevanceScore: 1,
  category: 'postlock.duel',
  expiresAt: new Date('2026-09-26T18:00:00.000Z'),
  data: { challengeId: '1', kind: 'lead_taken' },
};

interface Sent {
  headers: http2.OutgoingHttpHeaders;
  payload: string;
}

/** A fake HTTP/2 session answering every request with `status` and `body`. */
function fakeSession(status: number, body = '') {
  const sent: Sent[] = [];
  const session = Object.assign(new EventEmitter(), {
    closed: false,
    destroyed: false,
    unref: jest.fn(),
    close: jest.fn(),
    request: jest.fn((headers: http2.OutgoingHttpHeaders) => {
      const stream = Object.assign(new EventEmitter(), {
        setEncoding: jest.fn(),
        setTimeout: jest.fn(),
        close: jest.fn(),
        end: (payload: string) => {
          sent.push({ headers, payload });
          setImmediate(() => {
            stream.emit('response', { ':status': status });
            if (body) stream.emit('data', body);
            stream.emit('end');
          });
        },
      });
      return stream;
    }),
  });
  (http2.connect as jest.Mock).mockReturnValue(session);
  return { session, sent };
}

function makeService(values: Record<string, string | undefined> = {}) {
  const config = {
    get: (key: string) =>
      ({
        'apns.keyId': 'KEY123',
        'apns.teamId': 'TEAM456',
        'apns.privateKey': pem,
        'apns.bundleId': 'com.swiply.postlock',
        ...values,
      })[key],
  };
  return new ApnsService(config as never);
}

describe('ApnsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a signed alert with collapse, thread, and interruption settings', async () => {
    const { sent } = fakeSession(200);
    const service = makeService();

    await expect(service.send({ token, environment: 'production' }, alert)).resolves.toBe('sent');

    expect(http2.connect).toHaveBeenCalledWith('https://api.push.apple.com');
    const [{ headers, payload }] = sent;
    expect(headers).toMatchObject({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      'apns-push-type': 'alert',
      'apns-topic': 'com.swiply.postlock',
      'apns-collapse-id': 'duel-1',
      'apns-expiration': String(Date.parse('2026-09-26T18:00:00.000Z') / 1000),
    });
    expect(JSON.parse(payload)).toEqual({
      aps: {
        alert: { title: alert.title, body: alert.body },
        sound: 'default',
        'thread-id': 'duel-1',
        category: 'postlock.duel',
        'interruption-level': 'time-sensitive',
        'relevance-score': 1,
      },
      challengeId: '1',
      kind: 'lead_taken',
    });

    const jwt = String(headers.authorization).replace('bearer ', '');
    const [header, claims, signature] = jwt.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'ES256',
      kid: 'KEY123',
    });
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({
      iss: 'TEAM456',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${claims}`),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });

  it('reuses the provider token and connection across sends', async () => {
    const { sent } = fakeSession(200);
    const service = makeService();

    await service.send({ token, environment: 'sandbox' }, alert);
    await service.send({ token, environment: 'sandbox' }, alert);

    expect(http2.connect).toHaveBeenCalledTimes(1);
    expect(http2.connect).toHaveBeenCalledWith('https://api.sandbox.push.apple.com');
    expect(sent[0].headers.authorization).toBe(sent[1].headers.authorization);
  });

  it('reports dead tokens so they can be forgotten', async () => {
    fakeSession(410, JSON.stringify({ reason: 'Unregistered' }));
    await expect(makeService().send({ token, environment: 'production' }, alert)).resolves.toBe(
      'unregistered',
    );

    fakeSession(400, JSON.stringify({ reason: 'BadDeviceToken' }));
    await expect(makeService().send({ token, environment: 'production' }, alert)).resolves.toBe(
      'unregistered',
    );
  });

  it('treats other rejections as transient failures', async () => {
    fakeSession(429, JSON.stringify({ reason: 'TooManyRequests' }));

    await expect(makeService().send({ token, environment: 'production' }, alert)).resolves.toBe(
      'failed',
    );
  });

  it('skips sending when credentials are missing', async () => {
    const service = makeService({ 'apns.privateKey': undefined });

    expect(service.isConfigured).toBe(false);
    await expect(service.send({ token, environment: 'production' }, alert)).resolves.toBe(
      'skipped',
    );
    expect(http2.connect).not.toHaveBeenCalled();
  });
});
