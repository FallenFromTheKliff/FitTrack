import { BadRequestException, Injectable } from '@nestjs/common';
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import {
  assertWithinEffectiveGymHours,
  checkWithinEffectiveGymHours,
  resolveEffectiveGymHours,
} from './coach-availability.service';
import { PrismaService } from '../../prisma/prisma.service';

type AvailabilitySlotLike = {
  starts_at: string;
  ends_at: string;
  available: boolean;
  status?: 'available' | 'full' | 'unavailable';
};

type AvailabilityResponseEnvelope = {
  data: AvailabilitySlotLike[];
  [key: string]: unknown;
};

type NormalizedAvailabilityResponse = {
  envelope?: AvailabilityResponseEnvelope;
  slots: AvailabilitySlotLike[];
};

type BookingRequest = {
  body?: {
    starts_at?: string;
    ends_at?: string;
  };
  query?: {
    date?: string;
  };
  user?: {
    role?: UserRole;
  };
};

/**
 * Keeps venue-hour policy at the HTTP boundary while the legacy booking
 * service remains unchanged for protected-file compatibility.
 */
@Injectable()
export class BookingHoursInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler() as { name?: string };
    if (context.getClass()?.name !== 'BookingController') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<BookingRequest>();
    if (handler.name === 'createBooking') {
      if (request.user?.role !== UserRole.member) {
        return next.handle();
      }

      return from(this.assertMemberBookingWindow(request.body)).pipe(
        switchMap(() => next.handle()),
      );
    }

    if (handler.name === 'getAvailability') {
      return next.handle().pipe(
        switchMap((response: unknown) => {
          const normalized = normalizeAvailabilityResponse(response);
          return from(
            this.decorateAvailability(request.query?.date, normalized.slots),
          ).pipe(
            map((slots) =>
              normalized.envelope
                ? { ...normalized.envelope, data: slots }
                : slots,
            ),
          );
        }),
      );
    }

    return next.handle();
  }

  private async assertMemberBookingWindow(
    body: BookingRequest['body'],
  ): Promise<void> {
    const startsAt = new Date(body?.starts_at ?? '');
    const endsAt = new Date(body?.ends_at ?? '');
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException({
        type: 'INVALID_BOOKING_WINDOW',
        title: 'Invalid Booking Window',
        status: 400,
        detail: 'starts_at and ends_at must be valid and ordered dates.',
      });
    }

    await assertWithinEffectiveGymHours(
      this.prisma,
      startsAt,
      endsAt,
      'venue booking',
    );
  }

  private async decorateAvailability(
    date: string | undefined,
    slots: AvailabilitySlotLike[],
  ): Promise<AvailabilitySlotLike[]> {
    if (!date) return slots;
    const hours = await resolveEffectiveGymHours(this.prisma, date);

    return slots.map((slot) => {
      const startsAt = new Date(slot.starts_at);
      const endsAt = new Date(slot.ends_at);
      const withinHours =
        !Number.isNaN(startsAt.getTime()) &&
        !Number.isNaN(endsAt.getTime()) &&
        checkWithinEffectiveGymHours(hours, startsAt, endsAt).valid;

      return {
        ...slot,
        available: withinHours && slot.available,
        status: !withinHours
          ? 'unavailable'
          : slot.available
            ? 'available'
            : 'full',
      };
    });
  }
}

function normalizeAvailabilityResponse(
  response: unknown,
): NormalizedAvailabilityResponse {
  if (Array.isArray(response)) {
    return { slots: response as AvailabilitySlotLike[] };
  }

  if (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    Array.isArray((response as { data?: unknown }).data)
  ) {
    return {
      envelope: response as AvailabilityResponseEnvelope,
      slots: (response as { data: AvailabilitySlotLike[] }).data,
    };
  }

  throw new TypeError(
    'Booking availability response must be an array or an envelope containing an array.',
  );
}
