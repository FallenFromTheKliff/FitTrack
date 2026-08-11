import { HttpException, UnsupportedMediaTypeException } from '@nestjs/common';

import { FilesService } from './files.service';
import type {
  FilesStorageAdapter,
  StorageObjectResult,
  StorageUploadInput,
} from './files.types';

describe('FilesService', () => {
  let service: FilesService;

  const getObjectMock = jest.fn<Promise<StorageObjectResult>, [string]>();
  const uploadObjectMock = jest.fn<Promise<string>, [StorageUploadInput]>();
  const storage: FilesStorageAdapter = {
    getObject: getObjectMock,
    uploadObject: uploadObjectMock,
  };
  const quotaGuard = {
    assertUploadAllowed: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: number) =>
      key === 'files.uploadMaxFileSizeBytes' ? 25 * 1024 * 1024 : fallback,
    ),
  };
  const validRasterFixtures = [
    {
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      contentType: 'image/png',
      key: 'uploads/user-1/2026/08/icon.png',
      label: 'PNG',
    },
    {
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: 'image/jpeg',
      key: 'uploads/user-1/2026/08/icon.jpeg',
      label: 'JPEG',
    },
    {
      body: Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'ascii'),
      contentType: 'image/webp',
      key: 'uploads/user-1/2026/08/icon.webp',
      label: 'WebP',
    },
  ] as const;

  beforeEach(() => {
    service = new FilesService(storage, quotaGuard as never, config as never);
    jest.clearAllMocks();
  });

  it('uploads a valid image through the storage adapter', async () => {
    uploadObjectMock.mockResolvedValue(
      'https://cdn.fittrack.test/uploads/a.png',
    );

    const result = await service.uploadImage({
      originalname: 'receipt.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('image-data'),
    });

    const calls = uploadObjectMock.mock.calls;
    const args = calls[0]?.[0];

    expect(args).toBeDefined();
    expect(args?.contentType).toBe('image/png');
    expect(args?.body).toEqual(Buffer.from('image-data'));
    expect(quotaGuard.assertUploadAllowed).toHaveBeenCalledWith(1024);
    expect(result).toMatchObject({
      url: 'https://cdn.fittrack.test/uploads/a.png',
    });
  });

  it('rejects unsupported file types', async () => {
    await expect(
      service.uploadImage({
        originalname: 'receipt.gif',
        mimetype: 'image/gif',
        size: 1024,
        buffer: Buffer.from('image-data'),
      }),
    ).rejects.toThrow(UnsupportedMediaTypeException);
  });

  it('rejects files larger than 25 MiB', async () => {
    await expect(
      service.uploadImage({
        originalname: 'receipt.png',
        mimetype: 'image/png',
        size: 25 * 1024 * 1024 + 1,
        buffer: Buffer.from('image-data'),
      }),
    ).rejects.toThrow(HttpException);
  });

  it('requires a file payload', async () => {
    await expect(service.uploadImage(undefined)).rejects.toThrow(HttpException);
  });

  it('uses the requested folder when building the object key', async () => {
    uploadObjectMock.mockResolvedValue(
      'https://cdn.fittrack.test/avatars/a.png',
    );

    await service.uploadImage(
      {
        originalname: 'Avatar.JPG',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('image-data'),
      },
      'avatars',
    );

    const calls = uploadObjectMock.mock.calls;
    const args = calls[0]?.[0];

    expect(args).toBeDefined();
    expect(args?.key).toMatch(/^avatars\/\d{4}\/\d{2}\/.+-avatar\.jpeg$/);
  });

  it('returns image bytes for a valid render key', async () => {
    getObjectMock.mockResolvedValue({
      body: Buffer.from('image-data'),
      contentLength: 10,
      contentType: 'image/png',
    });

    const result = await service.renderImage('uploads/2026/04/avatar.png');

    expect(getObjectMock).toHaveBeenCalledWith('uploads/2026/04/avatar.png');
    expect(result).toEqual({
      body: Buffer.from('image-data'),
      contentLength: 10,
      contentType: 'image/png',
      key: 'uploads/2026/04/avatar.png',
    });
  });

  it.each(validRasterFixtures)(
    'accepts an existing user-owned $label raster meal icon asset',
    async ({ body, contentType, key }) => {
      getObjectMock.mockResolvedValue({
        body,
        contentLength: body.length,
        contentType,
      });

      await expect(
        service.assertUserOwnedRasterImage(key, 'user-1'),
      ).resolves.toBeUndefined();
      expect(getObjectMock).toHaveBeenCalledWith(key);
    },
  );

  it('rejects a user-owned raster icon when the stored size is unknown', async () => {
    const [png] = validRasterFixtures;
    getObjectMock.mockResolvedValue({
      body: png.body,
      contentLength: null,
      contentType: png.contentType,
    });

    await expect(
      service.assertUserOwnedRasterImage(png.key, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        status: 413,
        type: 'PAYLOAD_TOO_LARGE',
      },
    });
  });

  it('rejects cross-user meal icon assets', async () => {
    await expect(
      service.assertUserOwnedRasterImage(
        'uploads/user-2/2026/08/icon.png',
        'user-1',
      ),
    ).rejects.toMatchObject({
      response: { status: 403, title: 'Forbidden' },
    });
    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('rejects SVG meal icon assets', async () => {
    getObjectMock.mockResolvedValue({
      body: Buffer.from('<svg />'),
      contentLength: 7,
      contentType: 'image/svg+xml',
    });

    await expect(
      service.assertUserOwnedRasterImage(
        'uploads/user-1/2026/08/icon.png',
        'user-1',
      ),
    ).rejects.toMatchObject({
      response: { status: 415, title: 'Unsupported File Type' },
    });
  });

  it('rejects invalid render keys', async () => {
    await expect(service.renderImage('../avatars/a.png')).rejects.toThrow(
      HttpException,
    );
  });
});
