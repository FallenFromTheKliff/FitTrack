export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type UploadedStorageFile = UploadedImageFile;

export interface UploadedFileResult {
  file_key: string;
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  url: string;
}

export interface StorageUploadInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageObjectResult {
  body: Buffer;
  contentLength: number | null;
  contentType: string | null;
}

export interface FilesStorageAdapter {
  getObject(key: string): Promise<StorageObjectResult>;
  uploadObject(input: StorageUploadInput): Promise<string>;
}
