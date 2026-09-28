import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AmenityFeedbackHistoryQueryDTO } from './dto/amenity.dto';
import { AmenityRepository } from './amenity.repository';
import { AmenityService } from './amenity.service';

const feedbackRecord = {
  amenity: {
    id: 'amenity-1',
    name: 'Main Court',
    type: 'basketball_court',
  },
  comment: null,
  created_at: new Date('2026-01-02T03:04:05.000Z'),
  id: 'feedback-2',
  rating: 5,
  submitted_by: undefined,
  updated_at: new Date('2026-01-02T03:04:05.000Z'),
  user: {
    id: 'member-1',
    profile: {
      first_name: 'Ada',
      last_name: 'Lovelace',
    },
    role: 'member',
  },
};

describe('Amenity feedback history', () => {
  it('validates positive bounded page parameters', async () => {
    const dto = plainToInstance(AmenityFeedbackHistoryQueryDTO, {
      page: 0,
      limit: 51,
    });
    const errors = await validate(dto);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toContain('page must be at least 1');
    expect(messages).toContain('limit must not exceed 50');
  });

  it('reads a stable scoped page and aggregate summary', async () => {
    const amenityFeedback = {
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 } }),
      count: jest.fn().mockResolvedValue(12),
      findMany: jest.fn().mockResolvedValue([feedbackRecord]),
    };
    const repository = new AmenityRepository({
      amenityFeedback,
    } as never);

    await expect(
      repository.listAmenityFeedbackHistoryForAmenity('amenity-1', 2, 10),
    ).resolves.toEqual({
      items: [feedbackRecord],
      total: 12,
      averageRating: 4.5,
    });
    expect(amenityFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { amenity_id: 'amenity-1' },
        skip: 10,
        take: 10,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(amenityFeedback.count).toHaveBeenCalledWith({
      where: { amenity_id: 'amenity-1' },
    });
    expect(amenityFeedback.aggregate).toHaveBeenCalledWith({
      where: { amenity_id: 'amenity-1' },
      _avg: { rating: true },
    });
  });

  it('returns the mapped page with overall totals while preserving legacy shape', async () => {
    const repository = {
      findActiveAmenityByIdOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'amenity-1' }),
      listAmenityFeedbackHistoryForAmenity: jest.fn().mockResolvedValue({
        averageRating: 4.5,
        items: [feedbackRecord],
        total: 12,
      }),
    };
    const service = new AmenityService(
      repository as unknown as AmenityRepository,
    );

    await expect(
      service.listFeedbackHistoryForAmenity('amenity-1', {
        page: 2,
        limit: 10,
      }),
    ).resolves.toEqual({
      average_rating: 4.5,
      has_more: false,
      items: [
        {
          amenity: feedbackRecord.amenity,
          comment: null,
          created_at: '2026-01-02T03:04:05.000Z',
          id: 'feedback-2',
          rating: 5,
          submitted_by: {
            id: 'member-1',
            name: 'Ada Lovelace',
            role: 'member',
          },
          updated_at: '2026-01-02T03:04:05.000Z',
        },
      ],
      limit: 10,
      page: 2,
      total: 12,
    });
    expect(repository.findActiveAmenityByIdOrThrow).toHaveBeenCalledWith(
      'amenity-1',
    );
    expect(
      repository.listAmenityFeedbackHistoryForAmenity,
    ).toHaveBeenCalledWith('amenity-1', 2, 10);
  });
});
