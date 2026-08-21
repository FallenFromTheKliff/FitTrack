import { StreamableFile } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';

import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const context = {} as never;

  it('wraps ordinary success payloads in the standard envelope', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ ok: true }),
      }),
    );

    expect(result).toEqual({
      data: { ok: true },
    });
  });

  it('passes StreamableFile responses through unchanged', async () => {
    const stream = new StreamableFile(Buffer.from('image-bytes'));

    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of(stream),
      }),
    );

    expect(result).toBe(stream);
  });
});
