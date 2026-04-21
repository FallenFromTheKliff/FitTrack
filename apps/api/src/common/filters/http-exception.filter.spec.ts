import { HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const originalUploadMaxFileSizeBytes = process.env.UPLOAD_MAX_FILE_SIZE_BYTES;

  beforeEach(() => {
    process.env.UPLOAD_MAX_FILE_SIZE_BYTES = '26214400';
  });

  afterAll(() => {
    if (originalUploadMaxFileSizeBytes === undefined) {
      delete process.env.UPLOAD_MAX_FILE_SIZE_BYTES;
      return;
    }

    process.env.UPLOAD_MAX_FILE_SIZE_BYTES = originalUploadMaxFileSizeBytes;
  });

  it('maps multer file size errors into RFC 7807 payload-too-large responses', () => {
    const filter = new HttpExceptionFilter();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      method: 'POST',
      url: '/v1/files/upload',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;
    const multerError = Object.assign(new Error('File too large'), {
      code: 'LIMIT_FILE_SIZE',
    });

    filter.catch(multerError, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(response.json).toHaveBeenCalledWith({
      type: 'PAYLOAD_TOO_LARGE',
      title: 'File Too Large',
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      detail: 'Files must be 25 MiB or smaller.',
    });
  });
});
