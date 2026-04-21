import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getUploadMaxFileSizeBytes } from '../../config/runtime-settings';

interface ProblemDetailsBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  [key: string]: unknown;
}

function isProblemDetailsBody(value: unknown): value is ProblemDetailsBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>).type === 'string'
  );
}

function extractExceptionDetail(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw;
  }

  if (typeof raw === 'object' && raw !== null) {
    const message = (raw as Record<string, unknown>).message;
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message
        .filter((item): item is string => typeof item === 'string')
        .join(', ');
    }
  }

  return 'An error occurred';
}

type MulterLikeError = Error & {
  code?: string;
};

function isMulterLikeError(value: unknown): value is MulterLikeError {
  return value instanceof Error && 'code' in value;
}

/**
 * HttpExceptionFilter
 * Converts all thrown HttpExceptions into RFC 7807 Problem Details format:
 *   { type, title, status, detail }
 *
 * If the exception response is already shaped as RFC 7807
 * (has a `type` field), it passes through untouched.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { body, status } = this.normalizeException(exception);

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${status}`,
        exception instanceof HttpException
          ? exception.stack
          : isMulterLikeError(exception)
            ? exception.message
            : 'Unknown error',
      );
    }

    response.status(status).json(body);
  }

  private normalizeException(exception: unknown): {
    body: ProblemDetailsBody;
    status: number;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: ProblemDetailsBody = isProblemDetailsBody(raw)
        ? raw
        : {
            type: this.statusToType(status),
            title: this.statusToTitle(status),
            status,
            detail: extractExceptionDetail(raw),
          };

      return { body, status };
    }

    if (isMulterLikeError(exception) && exception.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMiB = Math.floor(
        getUploadMaxFileSizeBytes() / (1024 * 1024),
      );
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        body: {
          type: 'PAYLOAD_TOO_LARGE',
          title: 'File Too Large',
          status: HttpStatus.PAYLOAD_TOO_LARGE,
          detail: `Files must be ${maxSizeMiB} MiB or smaller.`,
        },
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        type: 'BAD_REQUEST',
        title: 'Invalid File Upload',
        status: HttpStatus.BAD_REQUEST,
        detail: isMulterLikeError(exception)
          ? exception.message
          : 'Invalid file upload.',
      },
    };
  }

  private statusToType(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      410: 'GONE',
      422: 'UNPROCESSABLE_ENTITY',
      423: 'LOCKED',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }

  private statusToTitle(status: number): string {
    return HttpStatus[status]?.replace(/_/g, ' ') ?? 'Error';
  }
}
