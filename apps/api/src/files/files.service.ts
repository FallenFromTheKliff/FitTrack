import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

import { FILES_STORAGE } from './files.constants';
import { R2UploadGuardService } from './r2-upload-guard.service';
import type {
  FilesStorageAdapter,
  StorageUploadInput,
  UploadedImageFile,
} from './files.types';
import { DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES } from '../config/runtime-settings';

@Injectable()
export class FilesService {
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
  ]);

  constructor(
    @Inject(FILES_STORAGE)
    private readonly storage: FilesStorageAdapter,
    private readonly quotaGuard: R2UploadGuardService,
    private readonly config: ConfigService,
  ) {}

  async uploadImage(
    file: UploadedImageFile | undefined,
    folder = 'uploads',
  ): Promise<{ url: string }> {
    this.assertFilePresent(file);
    this.assertValidImage(file);
    await this.quotaGuard.assertUploadAllowed(file.size);

    const uploadInput: StorageUploadInput = {
      key: this.buildObjectKey(folder, file),
      body: file.buffer,
      contentType: file.mimetype,
    };
    const url = await this.storage.uploadObject(uploadInput);

    return { url };
  }

  async renderImage(key: string) {
    const sanitizedKey = this.sanitizeObjectKey(key);
    const object = await this.storage.getObject(sanitizedKey);

    if (!object.contentType?.startsWith('image/')) {
      throw new NotFoundException({
        type: 'RESOURCE_NOT_FOUND',
        title: 'Image Not Found',
        status: 404,
        detail: 'The requested image could not be found.',
      });
    }

    return {
      body: object.body,
      contentLength: object.contentLength,
      contentType: object.contentType,
      key: sanitizedKey,
    };
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

    const maxFileSizeBytes = this.config.get<number>(
      'files.uploadMaxFileSizeBytes',
      DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
    );

    if (file.size > maxFileSizeBytes) {
      const maxSizeMiB = Math.floor(maxFileSizeBytes / (1024 * 1024));
      throw new HttpException(
        {
          type: 'PAYLOAD_TOO_LARGE',
          title: 'File Too Large',
          status: 413,
          detail: `Files must be ${maxSizeMiB} MiB or smaller.`,
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

  private sanitizeObjectKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Image Key Required',
        status: 400,
        detail: 'An image key is required.',
      });
    }

    const decoded = this.safeDecode(trimmed).replace(/\\/g, '/');
    const normalized = decoded.replace(/^\/+/, '');
    if (
      !normalized ||
      normalized.includes('..') ||
      normalized.split('/').some((segment) => segment.trim() === '')
    ) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Image Key',
        status: 400,
        detail: 'The requested image key is invalid.',
      });
    }

    return normalized;
  }

  private safeDecode(value: string) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}
