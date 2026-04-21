import type { UploadedFileRecord } from "@fittrack/types";
import { unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type { UploadedFileRecord } from "@fittrack/types";

export function createFilesApi(transport: ApiTransport) {
  return {
    uploadImage(payload: FormData) {
      return unwrapResponse<UploadedFileRecord>(
        transport.post("/files/upload", payload),
        "Unable to upload image."
      );
    }
  };
}
