import { HttpException, UnsupportedMediaTypeException } from '@nestjs/common';

import { FilesService } from './files.service';
import type { FilesStorageAdapter, StorageUploadInput } from './files.types';

describe('FilesService', () => {
  let service: FilesService;

  const uploadObjectMock = jest.fn<Promise<string>, [StorageUploadInput]>();
  const storage: FilesStorageAdapter = { uploadObject: uploadObjectMock };

  beforeEach(() => {
    service = new FilesService(storage);
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
    expect(result).toEqual({
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

  it('rejects files larger than 5 MB', async () => {
    await expect(
      service.uploadImage({
        originalname: 'receipt.png',
        mimetype: 'image/png',
        size: 5 * 1024 * 1024 + 1,
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
});
