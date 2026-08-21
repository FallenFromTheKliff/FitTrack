import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BaseRepository } from './base-repository';
import type { PrismaService } from '../../prisma/prisma.service';

class TestRepository extends BaseRepository {
  findUniqueRecord<T>(
    model: any,
    where: Record<string, unknown>,
    include?: Record<string, unknown>,
  ): Promise<T | null> {
    return this.findUniqueWhere<T>(model, where, include);
  }

  updateRecordOrThrow<T>(
    model: any,
    where: Record<string, unknown>,
    data: Record<string, unknown>,
    entityName: string,
  ): Promise<T> {
    return this.updateOneOrThrow<T>(model, where, data, entityName);
  }

  paginateUserRecords<T>(
    model: any,
    userId: string,
    range: { start_date?: string; end_date?: string; dateField?: string },
    args: {
      additionalWhere?: Record<string, unknown>;
      orderBy?: Record<string, unknown> | Record<string, unknown>[];
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    },
    options: { page?: number; limit?: number },
  ) {
    return this.paginateByUserIdWithDateRange<T>(
      model,
      userId,
      range,
      args,
      options,
    );
  }
}

describe('BaseRepository', () => {
  const prisma: Pick<PrismaService, '$transaction'> = {
    $transaction: jest.fn(),
  };

  let repo: TestRepository;

  beforeEach(() => {
    repo = new TestRepository(prisma as PrismaService);
    jest.clearAllMocks();
  });

  it('uses findUnique for non-id unique lookups', async () => {
    const model = {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    const result = await repo.findUniqueRecord<{ id: string }>(
      model,
      { qr_code_token: 'qr-token' },
      { profile: true },
    );

    expect(result).toEqual({ id: 'user-1' });
    expect(model.findUnique).toHaveBeenCalledWith({
      where: { qr_code_token: 'qr-token' },
      include: { profile: true },
      select: undefined,
    });
  });

  it('paginates by user id with a date range', async () => {
    const model = {
      findMany: jest.fn().mockResolvedValue([{ id: 'attendance-1' }]),
      count: jest.fn().mockResolvedValue(1),
    };

    const result = await repo.paginateUserRecords<{ id: string }>(
      model,
      'user-1',
      {
        start_date: '2026-03-01T00:00:00.000Z',
        end_date: '2026-03-31T23:59:59.999Z',
        dateField: 'check_in_at',
      },
      {
        additionalWhere: { check_out_at: null },
        orderBy: { check_in_at: 'desc' },
      },
      { page: 2, limit: 5 },
    );

    expect(model.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        check_out_at: null,
        check_in_at: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-31T23:59:59.999Z'),
        },
      },
      orderBy: { check_in_at: 'desc' },
      include: undefined,
      select: undefined,
      skip: 5,
      take: 5,
    });
    expect(model.count).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        check_out_at: null,
        check_in_at: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-31T23:59:59.999Z'),
        },
      },
    });
    expect(result).toEqual({
      data: [{ id: 'attendance-1' }],
      meta: {
        page: 2,
        limit: 5,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('converts Prisma P2025 into NotFoundException for updateOneOrThrow', async () => {
    const model = {
      update: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('missing record', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      ),
    };

    await expect(
      repo.updateRecordOrThrow<{ id: string }>(
        model,
        { user_id: 'user-1' },
        { avatar_url: 'avatar.png' },
        'UserProfile',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(model.update).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      data: { avatar_url: 'avatar.png' },
      include: undefined,
    });
  });
});
