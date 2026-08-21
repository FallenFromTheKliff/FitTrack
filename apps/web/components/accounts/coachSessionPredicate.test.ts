import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isUpcomingCoachSession } from '@fittrack/utils';

const now = Date.parse('2026-08-12T10:00:00.000Z');

test('coach upcoming predicate keeps canonical statuses and exact boundaries', () => {
  assert.equal(
    isUpcomingCoachSession(
      { status: 'confirmed', scheduledAt: '2026-08-12T10:00:00.000Z' },
      now,
    ),
    true,
  );
  assert.equal(
    isUpcomingCoachSession(
      { status: 'pending_coach', scheduledAt: '2026-08-12T10:00:00.001Z' },
      now,
    ),
    true,
  );
  assert.equal(
    isUpcomingCoachSession(
      { status: 'pending_payment', scheduledAt: '2026-08-12T10:00:00.001Z' },
      now,
    ),
    true,
  );
  assert.equal(
    isUpcomingCoachSession(
      { status: 'cancelled', scheduledAt: '2026-08-12T10:00:00.001Z' },
      now,
    ),
    false,
  );
  assert.equal(
    isUpcomingCoachSession(
      { status: 'confirmed', scheduledAt: '2026-08-12T09:59:59.999Z' },
      now,
    ),
    false,
  );
});
