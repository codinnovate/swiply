import { HttpStatus, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';

import { ApiException } from '../common/errors/api.exception';
import type {
  ContentValidationResult,
  OAuthAuthorizeRequest,
  OAuthExchangeRequest,
  PlatformAdapter,
  PlatformCapabilities,
  PlatformConnection,
  PlatformCredentials,
  ValidatableContent,
} from './platform-adapter.interface';

/**
 * Shared behaviour for every adapter: the capability-driven half of
 * `validateContent`, uniform failure shaping for the OAuth exchange, and loud
 * stubs for the methods later build steps fill in.
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly capabilities: PlatformCapabilities;
  protected readonly logger = new Logger(this.constructor.name);

  abstract isConfigured(): boolean;
  abstract getOAuthUrl(request: OAuthAuthorizeRequest): string;
  abstract handleOAuthCallback(request: OAuthExchangeRequest): Promise<PlatformConnection>;
  abstract refreshAccessToken(refreshToken: string): Promise<PlatformCredentials>;

  /**
   * Section 6: reject unsupported type/platform combinations before anything is
   * uploaded. Every violation is collected rather than short-circuiting on the
   * first, so the dashboard can show the whole problem at once.
   */
  validateContent(content: ValidatableContent): ContentValidationResult {
    const caps = this.capabilities;
    const errors: string[] = [];

    if (content.type === 'slideshow') {
      if (!caps.supportsSlideshow || !caps.slideshowImageRange) {
        errors.push(`${caps.platform} does not support slideshow content`);
      } else {
        const [min, max] = caps.slideshowImageRange;
        if (content.imageCount < min || content.imageCount > max) {
          errors.push(
            `${caps.platform} slideshows take ${min}-${max} images, got ${content.imageCount}`,
          );
        }
      }
    }

    if (content.type === 'video' && !caps.supportsVideo) {
      errors.push(`${caps.platform} does not support video content`);
    }

    if (content.type === 'post') {
      if (!caps.supportsPost) {
        errors.push(`${caps.platform} does not support single-image or text posts`);
      } else if (content.imageCount === 0 && !caps.allowsTextOnlyPost) {
        errors.push(`${caps.platform} requires at least one image on a post`);
      }
    }

    const textLength = content.text?.length ?? 0;
    if (caps.maxTextLength !== null && textLength > caps.maxTextLength) {
      errors.push(
        `${caps.platform} allows ${caps.maxTextLength} characters, got ${textLength}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Platform error bodies routinely echo back the request, which for a token
   * exchange means the client secret and the authorization code. Only the
   * status and the platform's own error slug are kept.
   */
  protected exchangeFailure(error: unknown, stage: string): ApiException {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const status = axiosError.response?.status;
    const body = axiosError.response?.data ?? {};
    const reason =
      (typeof body.error === 'string' && body.error) ||
      (typeof body.error_description === 'string' && body.error_description) ||
      (typeof body.message === 'string' && body.message) ||
      axiosError.code ||
      'unknown_error';

    this.logger.warn(
      `${this.capabilities.platform} ${stage} failed (status ${status ?? 'none'}): ${reason}`,
    );

    return new ApiException(
      stage === 'token refresh' ? 'TOKEN_REFRESH_FAILED' : 'OAUTH_EXCHANGE_FAILED',
      `${this.capabilities.platform} rejected the ${stage}`,
      HttpStatus.BAD_GATEWAY,
      { platform: this.capabilities.platform, reason },
    );
  }

  protected notConfigured(): ApiException {
    return ApiException.unprocessable(
      'PLATFORM_NOT_CONFIGURED',
      `${this.capabilities.platform} is not configured on this deployment`,
      { platform: this.capabilities.platform },
    );
  }

  /** Reached only if a later build step's caller runs ahead of its adapter work. */
  protected notImplemented(capability: string): ApiException {
    return ApiException.unprocessable(
      'PLATFORM_CAPABILITY_UNSUPPORTED',
      `${capability} is not implemented for ${this.capabilities.platform} yet`,
      { platform: this.capabilities.platform, capability },
    );
  }
}
