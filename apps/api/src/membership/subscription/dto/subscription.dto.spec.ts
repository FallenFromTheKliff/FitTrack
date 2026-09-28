import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateSubscriptionDTO,
  GrantFreeDayPassDTO,
  MembershipAccessCandidatesQueryDTO,
  CreatePlanDTO,
  OnsiteMembershipCandidateFilterDTO,
  PaginationDTO,
  RecordCashMembershipDTO,
  RevokeMembershipSubscriptionDTO,
  RevokeFreeDayPassDTO,
  UpdatePlanDTO,
} from './subscription.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Subscription DTO validation', () => {
  it('rejects non-positive plan prices on create', async () => {
    const dto = plainToInstance(CreatePlanDTO, {
      name: 'Monthly Membership',
      price: 0,
      duration_days: 30,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'price must be a positive number',
    );
  });

  it('rejects non-object features payloads on update', async () => {
    const dto = plainToInstance(UpdatePlanDTO, {
      features: 'locker access',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'features must be an object',
    );
  });

  it('transforms pagination query values into numbers', async () => {
    const dto = plainToInstance(PaginationDTO, {
      page: '2',
      limit: '10',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('requires a valid UUID plan id for subscription creation', async () => {
    const dto = plainToInstance(CreateSubscriptionDTO, {
      plan_id: 'not-a-uuid',
      provider: 'paymongo',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'plan_id must be a valid UUID',
    );
  });

  it('accepts deterministic UUIDv5 plan ids for subscription creation', async () => {
    const dto = plainToInstance(CreateSubscriptionDTO, {
      plan_id: 'd1e2f3a4-b5c6-5d78-9e01-234567890abc',
      provider: 'paymongo',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts deterministic UUIDv5 and UUIDv4 membership identifiers', async () => {
    const uuidValues = [
      'd1e2f3a4-b5c6-5d78-9e01-234567890abc',
      '33333333-3333-4333-8333-333333333333',
    ];

    for (const uuid of uuidValues) {
      const dto = plainToInstance(RecordCashMembershipDTO, {
        member_id: uuid,
        purchase_type: 'gym_membership',
        plan_id: uuid,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('rejects malformed cash membership identifiers', async () => {
    const dto = plainToInstance(RecordCashMembershipDTO, {
      member_id: 'not-a-uuid',
      purchase_type: 'membership_card',
      plan_id: 'also-not-a-uuid',
    });

    const messages = extractMessages(await validate(dto));
    expect(messages).toContain('member_id must be a valid UUID');
    expect(messages).toContain('plan_id must be a valid UUID');
  });

  it('requires a valid action and purchase type for onsite candidate queries', async () => {
    const dto = plainToInstance(OnsiteMembershipCandidateFilterDTO, {
      action: 'inspect',
      purchase_type: 'coaching',
    });

    const messages = extractMessages(await validate(dto));
    expect(messages).toContain('action must be grant or revoke');
    expect(messages).toContain(
      'purchase_type must be membership_card or gym_membership',
    );
  });

  it('bounds onsite candidate search and revoke reasons', async () => {
    const candidateDto = plainToInstance(OnsiteMembershipCandidateFilterDTO, {
      action: 'grant',
      purchase_type: 'gym_membership',
      search: 'x'.repeat(101),
    });
    const revokeDto = plainToInstance(RevokeMembershipSubscriptionDTO, {
      reason: 'x'.repeat(501),
    });

    expect(extractMessages(await validate(candidateDto))).toContain(
      'search must not exceed 100 characters',
    );
    expect(extractMessages(await validate(revokeDto))).toContain(
      'reason must not exceed 500 characters',
    );
  });

  it('validates generalized access products including free day passes', async () => {
    const valid = plainToInstance(MembershipAccessCandidatesQueryDTO, {
      action: 'grant',
      product: 'free_day_pass',
      search: '  Maria Santos  ',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.search).toBe('Maria Santos');

    const invalid = plainToInstance(MembershipAccessCandidatesQueryDTO, {
      action: 'grant',
      product: 'coaching',
    });
    expect(extractMessages(await validate(invalid))).toContain(
      'product must be membership_card, gym_membership, or free_day_pass',
    );
  });

  it('requires a UUID for free-pass grants and a trimmed reason for revokes', async () => {
    const grant = plainToInstance(GrantFreeDayPassDTO, {
      member_id: 'not-a-uuid',
    });
    expect(extractMessages(await validate(grant))).toContain(
      'member_id must be a valid UUID',
    );

    const revoke = plainToInstance(RevokeFreeDayPassDTO, { reason: '   ' });
    expect(extractMessages(await validate(revoke))).toContain(
      'reason is required',
    );
  });
});
