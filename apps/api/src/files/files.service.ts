import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';

import { FILES_STORAGE } from './files.constants';
import type {
  FilesStorageAdapter,
  StorageUploadInput,
  UploadedImageFile,
} from './files.types';

@Injectable()
export class FilesService {
  private static readonly MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
  ]);

  constructor(
    @Inject(FILES_STORAGE)
    private readonly storage: FilesStorageAdapter,
  ) {}

  async uploadImage(
    file: UploadedImageFile | undefined,
    folder = 'uploads',
  ): Promise<{ url: string }> {
    this.assertFilePresent(file);
    this.assertValidImage(file);

    const uploadInput: StorageUploadInput = {
      key: this.buildObjectKey(folder, file),
      body: file.buffer,
      contentType: file.mimetype,
    };
    const url = await this.storage.uploadObject(uploadInput);

    return { url };
  }

  private assertFilePresent(
    file: UploadedImageFile | undefined,
  ): asserts file is UploadedImageFile {
    if (!file) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'File Required',
          status: 400,
          detail: 'An image file is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertValidImage(file: UploadedImageFile): void {
    if (!FilesService.ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        type: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported File Type',
        status: 415,
        detail: 'Only image/jpeg and image/png files are allowed.',
      });
    }

    if (file.size > FilesService.MAX_FILE_SIZE_BYTES) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'File Too Large',
          status: 413,
          detail: 'Files must be 5 MB or smaller.',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  private buildObjectKey(folder: string, file: UploadedImageFile): string {
    const now = new Date();
    const year = `${now.getUTCFullYear()}`;
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
    const extension = this.resolveExtension(file);
    const baseName = this.sanitizeBaseName(file.originalname);

    return `${folder}/${year}/${month}/${randomUUID()}-${baseName}${extension}`;
  }

  private resolveExtension(file: UploadedImageFile): string {
    const detected = extname(file.originalname).toLowerCase();
    if (detected === '.jpg' || detected === '.jpeg' || detected === '.png') {
      return detected === '.jpg' ? '.jpeg' : detected;
    }

    return file.mimetype === 'image/png' ? '.png' : '.jpeg';
  }

  private sanitizeBaseName(originalname: string): string {
    const baseName = originalname.replace(/\.[^.]+$/, '').toLowerCase();
    const cleaned = baseName
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    return cleaned || 'file';
  }
}
