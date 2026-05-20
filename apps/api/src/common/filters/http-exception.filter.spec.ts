import { HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const originalUploadMaxFileSizeBytes = process.env.UPLOAD_MAX_FILE_SIZE_BYTES;

  beforeEach(() => {
    process.env.UPLOAD_MAX_FILE_SIZE_BYTES = '26214400';
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('keeps other multer errors as invalid file upload responses', () => {
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
    const multerError = Object.assign(new Error('Unexpected field'), {
      code: 'LIMIT_UNEXPECTED_FILE',
    });

    filter.catch(multerError, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      type: 'BAD_REQUEST',
      title: 'Invalid File Upload',
      status: HttpStatus.BAD_REQUEST,
      detail: 'Unexpected field',
    });
  });

  it('does not report generic backend errors as file uploads', () => {
    const filter = new HttpExceptionFilter();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      method: 'PATCH',
      url: '/v1/coaching/coaches/me',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    filter.catch(new Error('Database write failed'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      type: 'INTERNAL_SERVER_ERROR',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
    });
  });

  it('does not treat non-multer coded errors as file uploads', () => {
    const filter = new HttpExceptionFilter();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      method: 'PATCH',
      url: '/v1/coaching/coaches/me',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;
    const prismaError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });

    filter.catch(prismaError, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      type: 'INTERNAL_SERVER_ERROR',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
    });
  });
});
