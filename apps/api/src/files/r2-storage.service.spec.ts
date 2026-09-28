import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { R2StorageService } from './r2-storage.service';

describe('R2StorageService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws when required R2 config is missing', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn().mockReturnValue(''),
    };
    const service = new R2StorageService(config as ConfigService);

    await expect(
      service.uploadObject({
        key: 'uploads/test.png',
        body: Buffer.from('image-data'),
        contentType: 'image/png',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws when public R2 delivery is not configured', async () => {
    const configValues: Record<string, string> = {
      'r2.accountId': 'account-1',
      'r2.bucket': 'fittrack',
      'r2.accessKeyId': 'key-1',
      'r2.secretAccessKey': 'secret-1',
      'r2.publicBaseUrl': '',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock;

    const service = new R2StorageService(config as ConfigService);

    await expect(
      service.uploadObject({
        key: 'uploads/2026/03/file.png',
        body: Buffer.from('image-data'),
        contentType: 'image/png',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('uploads to R2 and returns the public URL', async () => {
    const configValues: Record<string, string> = {
      'r2.accountId': 'account-1',
      'r2.bucket': 'fittrack',
      'r2.accessKeyId': 'key-1',
      'r2.secretAccessKey': 'secret-1',
      'r2.publicBaseUrl': 'https://cdn.fittrack.test',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock;

    const service = new R2StorageService(config as ConfigService);
    const result = await service.uploadObject({
      key: 'uploads/2026/03/file.png',
      body: Buffer.from('image-data'),
      contentType: 'image/png',
    });

    const calls = fetchMock.mock.calls as Array<
      [URL | RequestInfo, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const headers = init?.headers as Record<string, string> | undefined;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(url).toBeInstanceOf(URL);
    expect(init?.method).toBe('PUT');
    expect(headers?.['content-type']).toBe('image/png');
    expect(headers?.authorization).toContain(
      'AWS4-HMAC-SHA256 Credential=key-1/',
    );
    expect(result).toBe('https://cdn.fittrack.test/uploads/2026/03/file.png');
  });

  it('downloads an object through the signed R2 endpoint', async () => {
    const configValues: Record<string, string> = {
      'r2.accountId': 'account-1',
      'r2.bucket': 'fittrack',
      'r2.accessKeyId': 'key-1',
      'r2.secretAccessKey': 'secret-1',
      'r2.publicBaseUrl': 'https://cdn.fittrack.test',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(
      new Response(Buffer.from('image-data'), {
        status: 200,
        headers: {
          'content-length': '10',
          'content-type': 'image/png',
        },
      }),
    );
    global.fetch = fetchMock;

    const service = new R2StorageService(config as ConfigService);
    const result = await service.getObject('uploads/2026/03/file.png');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.contentType).toBe('image/png');
    expect(result.contentLength).toBe(10);
    expect(result.body).toEqual(Buffer.from('image-data'));
  });

  it('wraps signed request failures as safe 503 errors', async () => {
    const configValues: Record<string, string> = {
      'r2.accountId': 'account-1',
      'r2.bucket': 'fittrack',
      'r2.accessKeyId': 'key-1',
      'r2.secretAccessKey': 'secret-1',
      'r2.publicBaseUrl': 'https://cdn.fittrack.test',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockRejectedValue(new TypeError('certificate details'));
    global.fetch = fetchMock;

    const service = new R2StorageService(config as ConfigService);
    let error: unknown;
    try {
      await service.getObject('uploads/2026/03/file.png');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      detail: 'Cloudflare R2 storage is unavailable.',
    });
  });

  it('uses a bounded timeout signal for signed requests', async () => {
    const configValues: Record<string, string> = {
      'r2.accountId': 'account-1',
      'r2.bucket': 'fittrack',
      'r2.accessKeyId': 'key-1',
      'r2.secretAccessKey': 'secret-1',
      'r2.publicBaseUrl': 'https://cdn.fittrack.test',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(
      new Response(Buffer.from('image-data'), { status: 200 }),
    );
    global.fetch = fetchMock;
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    const service = new R2StorageService(config as ConfigService);
    await service.getObject('uploads/2026/03/file.png');

    expect(timeoutSpy).toHaveBeenCalledWith(60_000);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.signal).toBeDefined();
  });

  it('lists bucket contents and sums object sizes across pages', async () => {
    const configValues: Record<string, string> = {
      'r2.accountId': 'account-1',
      'r2.bucket': 'fittrack',
      'r2.accessKeyId': 'key-1',
      'r2.secretAccessKey': 'secret-1',
      'r2.publicBaseUrl': 'https://cdn.fittrack.test',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
            <ListBucketResult>
              <IsTruncated>true</IsTruncated>
              <NextContinuationToken>page-2-token</NextContinuationToken>
              <Contents><Size>12</Size></Contents>
              <Contents><Size>8</Size></Contents>
            </ListBucketResult>`,
          { status: 200, headers: { 'content-type': 'application/xml' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
            <ListBucketResult>
              <IsTruncated>false</IsTruncated>
              <Contents><Size>20</Size></Contents>
            </ListBucketResult>`,
          { status: 200, headers: { 'content-type': 'application/xml' } },
        ),
      );
    global.fetch = fetchMock;

    const service = new R2StorageService(config as ConfigService);
    const usageBytes = await service.getBucketUsageBytes();

    const calls = fetchMock.mock.calls as Array<
      [URL | RequestInfo, RequestInit | undefined]
    >;
    const [firstUrl, firstInit] = calls[0] ?? [];
    const [secondUrl] = calls[1] ?? [];

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstUrl).toBeInstanceOf(URL);
    expect((firstUrl as URL).searchParams.get('list-type')).toBe('2');
    expect((secondUrl as URL).searchParams.get('continuation-token')).toBe(
      'page-2-token',
    );
    expect(firstInit?.method).toBe('GET');
    expect(usageBytes).toBe(40);
  });
});
