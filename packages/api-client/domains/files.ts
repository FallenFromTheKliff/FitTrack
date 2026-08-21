import type { UploadedFileRecord } from "@fittrack/types";
import { unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type { UploadedFileRecord } from "@fittrack/types";

type UploadedFileApiRecord = {
  file_key?: string;
  mime_type?: string;
  original_filename?: string;
  size_bytes?: number;
  url: string;
};

function mapUploadedFile(record: UploadedFileApiRecord): UploadedFileRecord {
  return {
    fileKey: record.file_key,
    mimeType: record.mime_type,
    originalFilename: record.original_filename,
    sizeBytes: record.size_bytes,
    url: record.url,
  };
}

export function createFilesApi(transport: ApiTransport) {
  return {
    async uploadImage(payload: FormData) {
      return mapUploadedFile(
        await unwrapResponse<UploadedFileApiRecord>(
          transport.post("/files/upload", payload),
          "Unable to upload image."
        )
      );
    },
    async uploadMilestoneEvidence(payload: FormData) {
      return mapUploadedFile(
        await unwrapResponse<UploadedFileApiRecord>(
          transport.post("/files/milestone-evidence", payload),
          "Unable to upload milestone evidence."
        )
      );
    },
  };
}
