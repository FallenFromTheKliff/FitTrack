import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

function hasPaginationMeta(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return 'data' in candidate && 'meta' in candidate;
}

/**
 * ResponseInterceptor
 * Wraps every successful controller response into the standard envelope:
 *   { data: T, meta?: { page, limit, total, total_pages } }
 *
 * If the controller already returns { data, meta } (paginated), it is passed
 * through as-is. Otherwise the return value is wrapped under data.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  ApiResponse<unknown>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (hasPaginationMeta(result)) {
          return result;
        }

        return { data: result };
      }),
    );
  }
}
