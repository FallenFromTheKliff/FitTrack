import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  AssignTrainingPlanDTO,
  CreateTrainingPlanDTO,
} from './training-plan.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('TrainingPlan DTO validation', () => {
  it('requires a title for training plan creation', async () => {
    const dto = plainToInstance(CreateTrainingPlanDTO, {
      goal: 'bulking',
      duration_weeks: 8,
      days_per_week: 4,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          exercises: [
            {
              exercise_id: '11111111-1111-4111-8111-111111111111',
              sets: 4,
            },
          ],
        },
      ],
    });

    expect(extractMessages(await validate(dto))).toContain('title is required');
  });

  it('rejects invalid nested exercise ids', async () => {
    const dto = plainToInstance(CreateTrainingPlanDTO, {
      title: 'Upper / Lower Strength Builder',
      goal: 'bulking',
      duration_weeks: 8,
      days_per_week: 4,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          exercises: [{ exercise_id: 'bad-id', sets: 4 }],
        },
      ],
    });

    expect(extractMessages(await validate(dto))).toContain(
      'exercise_id must be a valid UUID',
    );
  });

  it('accepts valid nested training plan input', async () => {
    const dto = plainToInstance(CreateTrainingPlanDTO, {
      title: 'Upper / Lower Strength Builder',
      goal: 'bulking',
      duration_weeks: 8,
      days_per_week: 4,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          focus_label: 'Push Day',
          exercises: [
            {
              exercise_id: '11111111-1111-4111-8111-111111111111',
              sets: 4,
              reps: 10,
            },
          ],
        },
      ],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('requires a valid member id for coach plan assignment', async () => {
    const dto = plainToInstance(AssignTrainingPlanDTO, {
      member_id: 'not-a-uuid',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'member_id must be a valid UUID',
    );
  });
});
