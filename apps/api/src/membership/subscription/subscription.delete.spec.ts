import { SubscriptionService } from './subscription.service';
import type { SubscriptionRepository } from './subscription.repository';

describe('SubscriptionService.deletePlan', () => {
  const repository = {
    countPlanHistory: jest.fn(),
    deletePlan: jest.fn(),
    findPlanByIdOrThrow: jest.fn(),
  };
  let service: SubscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubscriptionService(
      repository as unknown as SubscriptionRepository,
    );
  });

  it('deletes an unreferenced membership plan', async () => {
    repository.findPlanByIdOrThrow.mockResolvedValue({
      id: 'plan-1',
      name: 'Unused Membership',
    });
    repository.countPlanHistory.mockResolvedValue(0);

    await service.deletePlan('plan-1');

    expect(repository.deletePlan).toHaveBeenCalledWith('plan-1');
  });

  it('blocks deletion when membership history references the plan', async () => {
    repository.findPlanByIdOrThrow.mockResolvedValue({
      id: 'plan-1',
      name: 'Legacy Membership',
    });
    repository.countPlanHistory.mockResolvedValue(2);

    await expect(service.deletePlan('plan-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        detail: expect.stringContaining('Deactivate it instead'),
      }),
    });
    expect(repository.deletePlan).not.toHaveBeenCalled();
  });
});
