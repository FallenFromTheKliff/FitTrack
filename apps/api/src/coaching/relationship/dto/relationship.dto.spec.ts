import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateReviewDTO,
  RequestRelationshipDTO,
  UpdateRelationshipDTO,
} from './relationship.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Relationship DTOs', () => {
  it('rejects invalid coach ids in relationship requests', async () => {
    const dto = plainToInstance(RequestRelationshipDTO, {
      coach_id: 'not-a-uuid',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'coach_id must be a valid UUID',
    );
  });

  it('rejects unsupported relationship status updates', async () => {
    const dto = plainToInstance(UpdateRelationshipDTO, {
      status: 'pending',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'status must be one of: active, paused, terminated',
    );
  });

  it('validates review rating range and comment length', async () => {
    const dto = plainToInstance(CreateReviewDTO, {
      appointment_id: '33333333-3333-4333-8333-333333333333',
      rating: 6,
      comment: 'x'.repeat(1001),
    });

    expect(extractMessages(await validate(dto))).toEqual(
      expect.arrayContaining([
        'rating must not exceed 5',
        'comment must not exceed 1000 characters',
      ]),
    );
  });
});
