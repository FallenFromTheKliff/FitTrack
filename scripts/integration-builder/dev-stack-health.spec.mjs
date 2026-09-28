import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HEALTH_CHECK_KINDS,
  isHealthyPayload,
  testHealthUrl,
} from './dev-stack-health.mjs';

const healthyApiPayload = {
  data: {
    status: 'ok',
    services: {
      database: 'ok',
      redis: 'ok',
      jwt_config: 'ok',
    },
  },
};

function fakeResponse(status, payload, { malformedJson = false } = {}) {
  return {
    status,
    json: async () => {
      if (malformedJson) {
        throw new Error('malformed JSON');
      }
      return payload;
    },
  };
}

function fetchReturning(response) {
  return async () => response;
}

test('accepts a valid FitTrack API health payload', async () => {
  assert.equal(
    await testHealthUrl('http://api.test/v1/health', {
      kind: HEALTH_CHECK_KINDS.FITTRACK_API,
      fetchImpl: fetchReturning(fakeResponse(200, healthyApiPayload)),
    }),
    true,
  );
});

test('rejects HTTP 404 and 500 responses', async () => {
  for (const status of [404, 500]) {
    assert.equal(
      await testHealthUrl('http://api.test/v1/health', {
        kind: HEALTH_CHECK_KINDS.FITTRACK_API,
        fetchImpl: fetchReturning(fakeResponse(status, healthyApiPayload)),
      }),
      false,
    );
  }
});

test('rejects malformed and degraded API health payloads even with HTTP 200', async () => {
  assert.equal(
    isHealthyPayload(200, { data: { status: 'degraded', services: { database: 'error' } } }, HEALTH_CHECK_KINDS.FITTRACK_API),
    false,
  );
  assert.equal(
    await testHealthUrl('http://api.test/v1/health', {
      kind: HEALTH_CHECK_KINDS.FITTRACK_API,
      fetchImpl: fetchReturning(fakeResponse(200, null, { malformedJson: true })),
    }),
    false,
  );
});

test('accepts an ordinary successful web 2xx response without requiring JSON', async () => {
  assert.equal(
    await testHealthUrl('http://web.test/login', {
      kind: HEALTH_CHECK_KINDS.HTTP_2XX,
      fetchImpl: fetchReturning(fakeResponse(200, null, { malformedJson: true })),
    }),
    true,
  );
});
