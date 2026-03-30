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
    const fetchMock = jest.fn<typeof fetch>();
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
});
