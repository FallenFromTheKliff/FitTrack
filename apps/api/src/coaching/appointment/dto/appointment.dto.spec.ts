import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CancelAppointmentDTO,
  CreateAppointmentDTO,
  CreateCoachManagedAppointmentDTO,
  RespondAppointmentDTO,
  SetAvailabilityDTO,
} from './appointment.dto';

describe('Appointment DTOs', () => {
  it('rejects invalid time strings in coach availability payloads', async () => {
    const dto = plainToInstance(SetAvailabilityDTO, {
      slots: [{ day_of_week: 1, start_time: '8:00', end_time: '10:00' }],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid appointment identifiers and short durations', async () => {
    const dto = plainToInstance(CreateAppointmentDTO, {
      coach_id: 'not-a-uuid',
      scheduled_at: '2026-04-01T08:00:00.000Z',
      duration_minutes: 15,
    });

    const errors = await validate(dto);
    const nestedConstraints = errors.flatMap(
      (error) =>
        error.children?.flatMap((child) =>
          Object.values(child.constraints ?? {}),
        ) ?? [],
    );
    const constraints = [
      ...errors.flatMap((error) => Object.values(error.constraints ?? {})),
      ...nestedConstraints,
    ];

    expect(constraints).toEqual(
      expect.arrayContaining([
        'coach_id must be a valid UUID',
        'duration_minutes must be at least 30',
      ]),
    );
  });

  it('accepts deterministic member UUIDs for coach-managed appointments', async () => {
    const dto = plainToInstance(CreateCoachManagedAppointmentDTO, {
      member_id: '145595c3-d3a8-5d41-b1a2-ca29ba0d78a2',
      scheduled_at: '2026-04-01T08:00:00.000Z',
      duration_minutes: 60,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('validates coach response and cancellation note payloads', async () => {
    const respondDto = plainToInstance(RespondAppointmentDTO, {
      accepted: 'yes',
      rejection_reason: 'x'.repeat(501),
    });
    const cancelDto = plainToInstance(CancelAppointmentDTO, {
      reason: 'x'.repeat(501),
    });

    const respondErrors = await validate(respondDto);
    const cancelErrors = await validate(cancelDto);
    const respondConstraints = respondErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    const cancelConstraints = cancelErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(respondConstraints).toEqual(
      expect.arrayContaining([
        'accepted must be a boolean value',
        'rejection_reason must not exceed 500 characters',
      ]),
    );
    expect(cancelConstraints).toContain(
      'reason must not exceed 500 characters',
    );
  });
});
