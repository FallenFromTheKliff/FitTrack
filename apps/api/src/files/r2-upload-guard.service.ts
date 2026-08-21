import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';

type R2StorageGroupsResponse = {
  data?: {
    viewer?: {
      accounts?: Array<{
        r2StorageAdaptiveGroups?: Array<{
          max?: {
            payloadSize?: number | string | null;
          } | null;
        }>;
      }>;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

type R2GuardSettings = {
  accountId: string;
  bucket: string;
  analyticsApiToken: string;
  enforceGuard: boolean;
  storageLimitBytes: number;
  minFreeBytes: number;
};

const CLOUDFLARE_GRAPHQL_ENDPOINT =
  'https://api.cloudflare.com/client/v4/graphql';
const USAGE_CACHE_TTL_MS = 60_000;

@Injectable()
export class R2UploadGuardService {
  private readonly logger = new Logger(R2UploadGuardService.name);
  private cacheExpiresAt = 0;
  private cachedUsageBytes: number | null = null;
  private pendingUsageRequest: Promise<number> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly r2Storage: R2StorageService,
  ) {}

  async assertUploadAllowed(uploadSizeBytes: number): Promise<void> {
    const settings = this.getGuardSettings();
    if (!settings) {
      return;
    }

    let currentUsageBytes: number;

    try {
      currentUsageBytes = await this.getCurrentUsageBytes(settings);
    } catch (error) {
      if (settings.enforceGuard) {
        throw error;
      }

      this.logger.warn(
        'Skipping Cloudflare R2 quota verification because storage telemetry is unavailable.',
      );
      return;
    }

    const projectedUsageBytes = currentUsageBytes + uploadSizeBytes;
    const remainingBytes = settings.storageLimitBytes - projectedUsageBytes;

    if (remainingBytes < settings.minFreeBytes) {
      throw new HttpException(
        {
          type: 'INSUFFICIENT_STORAGE',
          title: 'Storage Safety Limit Reached',
          status: HttpStatus.INSUFFICIENT_STORAGE,
          detail:
            'Cloudflare R2 uploads are blocked because the configured safety buffer would be exceeded.',
        },
        HttpStatus.INSUFFICIENT_STORAGE,
      );
    }
  }

  private async getCurrentUsageBytes(
    settings: R2GuardSettings,
  ): Promise<number> {
    const now = Date.now();
    if (this.cachedUsageBytes !== null && now < this.cacheExpiresAt) {
      return this.cachedUsageBytes;
    }

    if (!this.pendingUsageRequest) {
      this.pendingUsageRequest = this.fetchCurrentUsageBytes(settings);
    }

    try {
      const usageBytes = await this.pendingUsageRequest;
      this.cachedUsageBytes = usageBytes;
      this.cacheExpiresAt = now + USAGE_CACHE_TTL_MS;
      return usageBytes;
    } finally {
      this.pendingUsageRequest = null;
    }
  }

  private async fetchCurrentUsageBytes(
    settings: R2GuardSettings,
  ): Promise<number> {
    const analyticsError = await this.tryFetchUsageBytesFromAnalytics(settings);
    if (typeof analyticsError === 'number') {
      return analyticsError;
    }

    try {
      return await this.r2Storage.getBucketUsageBytes();
    } catch (storageError) {
      this.logger.warn(
        'Cloudflare R2 analytics telemetry is unavailable, and bucket usage fallback failed.',
      );

      if (storageError instanceof HttpException) {
        throw storageError;
      }

      if (analyticsError instanceof HttpException) {
        throw analyticsError;
      }

      throw this.createGuardUnavailableException(
        'Cloudflare R2 storage usage could not be verified.',
      );
    }
  }

  private getGuardSettings(): R2GuardSettings | null {
    const settings = {
      accountId: this.config.get<string>('r2.accountId', ''),
      bucket: this.config.get<string>('r2.bucket', ''),
      analyticsApiToken: this.config.get<string>('r2.analyticsApiToken', ''),
      enforceGuard: this.config.get<boolean>('r2.enforceGuard', false),
      storageLimitBytes: this.config.get<number>('r2.storageLimitBytes', 0),
      minFreeBytes: this.config.get<number>('r2.minFreeBytes', 0),
    };

    if (!settings.accountId || !settings.bucket) {
      if (settings.enforceGuard) {
        throw this.createGuardUnavailableException(
          'Cloudflare R2 storage guard is not configured.',
        );
      }

      this.logger.warn('Cloudflare R2 storage guard is not configured.');
      return null;
    }

    return settings;
  }

  private async tryFetchUsageBytesFromAnalytics(
    settings: R2GuardSettings,
  ): Promise<number | HttpException> {
    if (!settings.analyticsApiToken) {
      return this.createGuardUnavailableException(
        'Cloudflare R2 analytics token is not configured.',
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${settings.analyticsApiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: this.buildStorageQuery(
            settings.accountId,
            settings.bucket,
            since,
          ),
        }),
      });

      if (!response.ok) {
        return this.createGuardUnavailableException(
          'Cloudflare R2 storage usage could not be verified.',
        );
      }

      const payload = (await response.json()) as R2StorageGroupsResponse;
      if ((payload.errors?.length ?? 0) > 0) {
        return this.createGuardUnavailableException(
          'Cloudflare R2 storage usage could not be verified.',
        );
      }

      const groups =
        payload.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups ?? [];

      return groups.reduce((maxBytes, group) => {
        const payloadSize = Number(group.max?.payloadSize ?? 0);
        return Number.isFinite(payloadSize)
          ? Math.max(maxBytes, payloadSize)
          : maxBytes;
      }, 0);
    } catch (error) {
      if (error instanceof HttpException) {
        return error;
      }

      return this.createGuardUnavailableException(
        'Cloudflare R2 storage usage could not be verified.',
      );
    }
  }

  private buildStorageQuery(
    accountId: string,
    bucket: string,
    since: string,
  ): string {
    return `{
  viewer {
    accounts(filter: { accountTag: "${this.escapeGraphQl(accountId)}" }) {
      r2StorageAdaptiveGroups(
        limit: 100
        filter: {
          bucketName: "${this.escapeGraphQl(bucket)}"
          datetime_geq: "${this.escapeGraphQl(since)}"
        }
      ) {
        max {
          payloadSize
        }
      }
    }
  }
}`;
  }

  private escapeGraphQl(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private createGuardUnavailableException(
    detail: string,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException({
      type: 'STORAGE_GUARD_UNAVAILABLE',
      title: 'Storage Guard Unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      detail,
    });
  }
}
