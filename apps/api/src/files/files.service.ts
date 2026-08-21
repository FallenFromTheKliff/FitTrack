import {
  BadRequestException,
  ForbiddenException,
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
  UploadedFileResult,
  UploadedImageFile,
  UploadedStorageFile,
} from './files.types';
import {
  DEFAULT_MILESTONE_EVIDENCE_VIDEO_MAX_FILE_SIZE_BYTES,
  DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
} from '../config/runtime-settings';

@Injectable()
export class FilesService {
  private static readonly ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  private static readonly ALLOWED_RASTER_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  private static readonly ALLOWED_MILESTONE_EVIDENCE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'video/mp4',
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
  ): Promise<UploadedFileResult> {
    this.assertFilePresent(file);
    this.assertValidImage(file);
    return this.uploadValidatedFile(file, folder);
  }

  async uploadMilestoneEvidence(
    file: UploadedStorageFile | undefined,
  ): Promise<UploadedFileResult> {
    this.assertFilePresent(file);
    this.assertValidMilestoneEvidence(file);
    return this.uploadValidatedFile(file, 'milestone-evidence');
  }

  private async uploadValidatedFile(
    file: UploadedStorageFile,
    folder: string,
  ): Promise<UploadedFileResult> {
    await this.quotaGuard.assertUploadAllowed(file.size);
    const key = this.buildObjectKey(folder, file);

    const uploadInput: StorageUploadInput = {
      key,
      body: file.buffer,
      contentType: file.mimetype,
    };
    const url = await this.storage.uploadObject(uploadInput);

    return {
      file_key: key,
      mime_type: file.mimetype,
      original_filename: file.originalname,
      size_bytes: file.size,
      url,
    };
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

  isUserOwnedUploadKey(key: string, userId: string): boolean {
    const segments = key.split('/');
    return (
      segments.length === 5 &&
      segments[0] === 'uploads' &&
      segments[1] === userId &&
      /^\d{4}$/.test(segments[2]) &&
      /^\d{2}$/.test(segments[3]) &&
      /^[a-z0-9-]+\.(?:jpeg|png|webp)$/i.test(segments[4])
    );
  }

  async assertUserOwnedRasterImage(
    key: string,
    userId: string,
  ): Promise<void> {
    if (!this.isUserOwnedUploadKey(key, userId)) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'The requested meal icon asset is not owned by the user.',
      });
    }

    const image = await this.renderImage(key);
    this.assertManagedRasterImage(image);
  }

  private assertManagedRasterImage(image: {
    body: Buffer;
    contentLength: number | null | undefined;
    contentType: string | undefined;
    key: string;
  }): void {
    const contentType = image.contentType ?? '';
    if (!FilesService.ALLOWED_RASTER_IMAGE_MIME_TYPES.has(contentType)) {
      throw new UnsupportedMediaTypeException({
        type: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported File Type',
        status: 415,
        detail:
          'Progression icons must use managed JPEG, PNG, or WebP raster assets. SVG is not supported.',
      });
    }

    const extension = extname(image.key).toLowerCase();
    const expectedContentType =
      extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : extension === '.jpeg' || extension === '.jpg'
            ? 'image/jpeg'
            : null;
    if (expectedContentType !== contentType || !this.matchesImageSignature(image.body, contentType)) {
      throw new UnsupportedMediaTypeException({
        type: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported File Type',
        status: 415,
        detail:
          'Progression icon content does not match its managed raster type. SVG is not supported.',
      });
    }

    const maxFileSizeBytes = this.config.get<number>(
      'files.uploadMaxFileSizeBytes',
      DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
    );
    if (image.contentLength === null || image.contentLength === undefined) {
      throw new HttpException(
        {
          type: 'PAYLOAD_TOO_LARGE',
          title: 'File Too Large',
          status: 413,
          detail: 'The stored progression icon size could not be verified.',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    if (image.contentLength > maxFileSizeBytes) {
      const maxSizeMiB = Math.ceil(maxFileSizeBytes / (1024 * 1024));
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

  private matchesImageSignature(body: Buffer, contentType: string): boolean {
    if (contentType === 'image/jpeg') {
      return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    }
    if (contentType === 'image/png') {
      return (
        body.length >= 8 &&
        body.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )
      );
    }
    return (
      body.length >= 12 &&
      body.subarray(0, 4).toString('ascii') === 'RIFF' &&
      body.subarray(8, 12).toString('ascii') === 'WEBP'
    );
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
          detail: 'A file is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertValidImage(file: UploadedImageFile): void {
    if (!FilesService.ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        type: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported File Type',
        status: 415,
        detail: 'Only image/jpeg, image/png, and image/webp files are allowed.',
      });
    }

    this.assertMaxSize(
      file,
      this.config.get<number>(
        'files.uploadMaxFileSizeBytes',
        DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
      ),
    );
  }

  private assertValidMilestoneEvidence(file: UploadedStorageFile): void {
    if (!FilesService.ALLOWED_MILESTONE_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        type: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported File Type',
        status: 415,
        detail: 'Only image/jpeg, image/png, and video/mp4 files are allowed.',
      });
    }

    const maxFileSizeBytes =
      file.mimetype === 'video/mp4'
        ? this.config.get<number>(
            'files.milestoneEvidenceVideoMaxFileSizeBytes',
            DEFAULT_MILESTONE_EVIDENCE_VIDEO_MAX_FILE_SIZE_BYTES,
          )
        : this.config.get<number>(
            'files.uploadMaxFileSizeBytes',
            DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
          );

    this.assertMaxSize(file, maxFileSizeBytes);
  }

  private assertMaxSize(
    file: UploadedStorageFile,
    maxFileSizeBytes: number,
  ): void {
    const normalizedMaxFileSizeBytes =
      maxFileSizeBytes > 0
        ? maxFileSizeBytes
        : this.config.get<number>(
            'files.uploadMaxFileSizeBytes',
            DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
          );

    if (file.size > normalizedMaxFileSizeBytes) {
      const maxSizeMiB = Math.ceil(
        normalizedMaxFileSizeBytes / (1024 * 1024),
      );
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

  private buildObjectKey(folder: string, file: UploadedStorageFile): string {
    const now = new Date();
    const year = `${now.getUTCFullYear()}`;
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
    const extension = this.resolveExtension(file);
    const baseName = this.sanitizeBaseName(file.originalname);

    return `${folder}/${year}/${month}/${randomUUID()}-${baseName}${extension}`;
  }

  private resolveExtension(file: UploadedStorageFile): string {
    const detected = extname(file.originalname).toLowerCase();
    if (
      detected === '.jpg' ||
      detected === '.jpeg' ||
      detected === '.png' ||
      detected === '.webp' ||
      detected === '.mp4'
    ) {
      return detected === '.jpg' ? '.jpeg' : detected;
    }

    if (file.mimetype === 'video/mp4') {
      return '.mp4';
    }

    if (file.mimetype === 'image/webp') {
      return '.webp';
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
