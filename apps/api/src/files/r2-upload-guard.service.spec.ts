import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { R2UploadGuardService } from './r2-upload-guard.service';
import { R2StorageService } from './r2-storage.service';

function createConfig(
  overrides: Partial<Record<string, string | number | boolean>> = {},
): Pick<ConfigService, 'get'> {
  const values: Record<string, string | number | boolean> = {
    'r2.accountId': 'account-1',
    'r2.bucket': 'fittrack-assets',
    'r2.analyticsApiToken': 'analytics-token',
    'r2.enforceGuard': false,
    'r2.storageLimitBytes': 100,
    'r2.minFreeBytes': 10,
    ...overrides,
  };

  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key in values) {
        return values[key];
      }

      return fallback;
    }),
  };
}

function createUsageResponse(usageBytes: number): Response {
  return new Response(
    JSON.stringify({
      data: {
        viewer: {
          accounts: [
            {
              r2StorageAdaptiveGroups: [
                {
                  max: {
                    payloadSize: usageBytes,
                  },
                },
              ],
            },
          ],
        },
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

function createStorageService(
  usageBytes = 40,
): Pick<R2StorageService, 'getBucketUsageBytes'> {
  return {
    getBucketUsageBytes: jest.fn().mockResolvedValue(usageBytes),
  };
}

describe('R2UploadGuardService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('falls back to bucket usage when the analytics token is missing', async () => {
    const service = new R2UploadGuardService(
      createConfig({ 'r2.analyticsApiToken': '' }) as ConfigService,
      createStorageService() as R2StorageService,
    );

    await expect(service.assertUploadAllowed(1)).resolves.toBeUndefined();
  });

  it('falls back to bucket usage when analytics lookup errors out', async () => {
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockRejectedValue(new Error('network offline'));
    global.fetch = fetchMock;

    const storageService = createStorageService();
    const service = new R2UploadGuardService(
      createConfig() as ConfigService,
      storageService as R2StorageService,
    );

    await expect(service.assertUploadAllowed(1)).resolves.toBeUndefined();
    expect(storageService.getBucketUsageBytes).toHaveBeenCalledTimes(1);
  });

  it('falls back to bucket usage when Cloudflare returns GraphQL errors', async () => {
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'bad query' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    global.fetch = fetchMock;

    const storageService = createStorageService();
    const service = new R2UploadGuardService(
      createConfig() as ConfigService,
      storageService as R2StorageService,
    );

    await expect(service.assertUploadAllowed(1)).resolves.toBeUndefined();
    expect(storageService.getBucketUsageBytes).toHaveBeenCalledTimes(1);
  });

  it('rejects uploads that would cross the configured safety buffer', async () => {
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(createUsageResponse(95));
    global.fetch = fetchMock;

    const service = new R2UploadGuardService(
      createConfig() as ConfigService,
      createStorageService() as R2StorageService,
    );

    let error: unknown;
    try {
      await service.assertUploadAllowed(1);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(HttpStatus.INSUFFICIENT_STORAGE);
    expect(exception.getResponse()).toMatchObject({
      type: 'INSUFFICIENT_STORAGE',
      status: HttpStatus.INSUFFICIENT_STORAGE,
    });
  });

  it('caches successful usage lookups for subsequent uploads', async () => {
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(createUsageResponse(40));
    global.fetch = fetchMock;

    const service = new R2UploadGuardService(
      createConfig() as ConfigService,
      createStorageService() as R2StorageService,
    );

    await expect(service.assertUploadAllowed(10)).resolves.toBeUndefined();
    await expect(service.assertUploadAllowed(5)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still fails closed when analytics and fallback enforcement are unavailable', async () => {
    const service = new R2UploadGuardService(
      createConfig({
        'r2.analyticsApiToken': '',
        'r2.enforceGuard': true,
      }) as ConfigService,
      {
        getBucketUsageBytes: jest
          .fn()
          .mockRejectedValue(new Error('storage listing unavailable')),
      } as unknown as R2StorageService,
    );

    await expect(service.assertUploadAllowed(1)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
