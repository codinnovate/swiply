import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { ApiException } from '../../../common/errors/api.exception';
import type { XPost, XPostProvider, XProfile } from '../domain/x-post-provider.interface';

type ProviderResponse = XProfile | { profile: XProfile };

@Injectable()
export class HttpXPostProvider implements XPostProvider {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getProfile(username: string): Promise<XProfile> {
    const baseUrl = this.config.get<string>('postingConsistency.providerBaseUrl');
    if (!baseUrl) {
      throw ApiException.unprocessable(
        'VALIDATION_FAILED',
        'X public-data provider is not configured',
      );
    }

    const apiKey = this.config.get<string>('postingConsistency.providerApiKey');
    const timeout = this.config.get<number>('postingConsistency.providerTimeoutMs', 8_000);

    try {
      const response = await firstValueFrom(
        this.http.post<ProviderResponse>(
          baseUrl,
          { username },
          {
            timeout,
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          },
        ),
      );
      const profile = 'profile' in response.data ? response.data.profile : response.data;
      if (!profile?.username || !profile.displayName || typeof profile.isPublic !== 'boolean') {
        throw new Error('Provider response did not contain a normalized X profile');
      }
      return { ...profile, username: profile.username.toLowerCase().replace(/^@/, '') };
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw ApiException.notFound('X profile', { username });
      }
      throw ApiException.unprocessable(
        'X_PROFILE_PROVIDER_FAILED',
        'The X profile provider could not verify this username',
      );
    }
  }


  async listPostsSince(_username: string, _since: Date): Promise<XPost[]> {
    throw ApiException.unprocessable(
      'X_PROFILE_PROVIDER_FAILED',
      'The configured X provider does not support post verification',
    );
  }
}
