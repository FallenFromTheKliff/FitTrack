import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SEED_USERS,
  classifyDeploymentStatus,
  identifyUploadedDeployment,
  isTransientSnapshotFailure,
  parseDeploymentList,
  shouldRetryTransientSnapshotFailure,
} from './deploy-railway.mjs';

test('selects exactly one uploaded deployment outside the prior list', () => {
  const priorDeployments = parseDeploymentList(
    JSON.stringify([{ id: 'old-deployment', status: 'SUCCESS' }]),
  );
  const currentDeployments = parseDeploymentList(
    JSON.stringify([
      {
        id: 'new-deployment',
        status: 'SUCCESS',
        message: 'FitTrack CLI deploy 2026-08-09T00:00:00.000Z',
      },
      { id: 'old-deployment', status: 'SUCCESS' },
    ]),
  );

  assert.equal(
    identifyUploadedDeployment({
      output: '',
      priorDeployments,
      currentDeployments,
      deployMessage: 'FitTrack CLI deploy',
    }),
    'new-deployment',
  );
});

test('does not accept an unrelated sole new deployment', () => {
  assert.equal(
    identifyUploadedDeployment({
      output: '',
      priorDeployments: [{ id: 'old-deployment', status: 'SUCCESS' }],
      currentDeployments: [
        { id: 'old-deployment', status: 'SUCCESS' },
        {
          id: 'other-deployment',
          status: 'BUILDING',
          message: 'Unrelated manual deployment',
        },
      ],
      deployMessage: 'FitTrack CLI deploy 2026-08-09T00:00:00.000Z',
    }),
    undefined,
  );
});

test('uses the unique deploy message when the prior list is unavailable', () => {
  assert.equal(
    identifyUploadedDeployment({
      output: '',
      currentDeployments: [
        {
          id: 'new-deployment',
          status: 'BUILDING',
          message: 'FitTrack CLI deploy 2026-08-09T00:00:00.000Z',
        },
        { id: 'other-deployment', status: 'SUCCESS', message: 'Manual deploy' },
      ],
      deployMessage: 'FitTrack CLI deploy 2026-08-09T00:00:00.000Z',
    }),
    'new-deployment',
  );
});

test('extracts the exact deployment id from the Railway build logs URL', () => {
  assert.equal(
    identifyUploadedDeployment({
      output:
        'Build Logs: https://railway.com/project/11111111-1111-1111-1111-111111111111/service/22222222-2222-2222-2222-222222222222?id=33333333-3333-3333-3333-333333333333&',
      priorDeployments: [],
      currentDeployments: [],
      deployMessage: 'FitTrack CLI deploy',
    }),
    '33333333-3333-3333-3333-333333333333',
  );
});

test('extracts the exact deployment id from detached JSON output', () => {
  assert.equal(
    identifyUploadedDeployment({
      output: JSON.stringify({
        id: '33333333-3333-3333-3333-333333333333',
        status: 'BUILDING',
      }),
      priorDeployments: [],
      currentDeployments: [],
      deployMessage: 'FitTrack CLI deploy',
    }),
    '33333333-3333-3333-3333-333333333333',
  );
});

test('normalizes deployment list JSON and preserves failure classifications', () => {
  const deployments = parseDeploymentList(
    JSON.stringify({
      deployments: [
        { deploymentId: 'queued-deployment', deploymentStatus: 'building' },
      ],
    }),
  );

  assert.deepEqual(deployments[0], {
    deploymentId: 'queued-deployment',
    deploymentStatus: 'building',
    id: 'queued-deployment',
    status: 'BUILDING',
  });
  assert.equal(classifyDeploymentStatus('SUCCESS'), 'success');
  assert.equal(classifyDeploymentStatus('FAILED'), 'failure');
  assert.equal(classifyDeploymentStatus('CRASHED'), 'failure');
  assert.equal(classifyDeploymentStatus('DEPLOYING'), 'pending');
  assert.equal(classifyDeploymentStatus('UNKNOWN_STATUS'), 'unknown');
});

test('defaults reset deployments to 180 seed users', () => {
  assert.equal(DEFAULT_SEED_USERS, 180);
});

test('retries only the exact transient Railway snapshot failure within the upload bound', () => {
  const transientFailure = {
    status: 'FAILED',
    meta: {
      configErrors: [
        'Failed to snapshot repository. Please try again in a few minutes.',
      ],
    },
  };

  assert.equal(isTransientSnapshotFailure(transientFailure), true);
  assert.equal(
    shouldRetryTransientSnapshotFailure({
      deployment: transientFailure,
      uploadAttempt: 1,
      maxUploadAttempts: 3,
    }),
    true,
  );
  assert.equal(
    shouldRetryTransientSnapshotFailure({
      deployment: transientFailure,
      uploadAttempt: 3,
      maxUploadAttempts: 3,
    }),
    false,
  );
});

test('does not retry other failures or snapshot errors with extra config errors', () => {
  const exactError =
    'Failed to snapshot repository. Please try again in a few minutes.';

  for (const deployment of [
    { status: 'CRASHED', meta: { configErrors: ['Build failed.'] } },
    { status: 'SUCCESS', meta: { configErrors: [exactError] } },
    {
      status: 'FAILED',
      meta: { configErrors: [exactError, 'Another configuration error.'] },
    },
    { status: 'FAILED', meta: { configErrors: `${exactError} ` } },
  ]) {
    assert.equal(
      shouldRetryTransientSnapshotFailure({
        deployment,
        uploadAttempt: 1,
        maxUploadAttempts: 3,
      }),
      false,
    );
  }
});
