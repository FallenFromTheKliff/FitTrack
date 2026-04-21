export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
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
