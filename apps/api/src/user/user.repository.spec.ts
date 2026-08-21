import type { PrismaService } from '../prisma/prisma.service';

import { UserRepository } from './user.repository';

describe('UserRepository profile updates', () => {
  let repository: UserRepository;
  const prisma = {
    userProfile: {
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    repository = new UserRepository(prisma);
    jest.clearAllMocks();
  });

  it('returns the current profile without writing an empty patch', async () => {
    const currentProfile = { user_id: 'user-1' };
    const findProfile = jest
      .spyOn(repository, 'findUserProfileByUserIdOrThrow')
      .mockResolvedValue(currentProfile as never);

    await expect(repository.updateProfile('user-1', {})).resolves.toBe(
      currentProfile,
    );
    expect(findProfile).toHaveBeenCalledWith('user-1');
    expect(prisma.userProfile.update).not.toHaveBeenCalled();
  });

  it('writes non-empty patches through the profile delegate', async () => {
    const updatedProfile = { user_id: 'user-1', first_name: 'Fit' };
    prisma.userProfile.update.mockResolvedValue(updatedProfile);

    await expect(
      repository.updateProfile('user-1', { first_name: 'Fit' }),
    ).resolves.toBe(updatedProfile);
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      data: { first_name: 'Fit' },
      include: undefined,
    });
  });
});
