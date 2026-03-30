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

export interface FilesStorageAdapter {
  uploadObject(input: StorageUploadInput): Promise<string>;
}
