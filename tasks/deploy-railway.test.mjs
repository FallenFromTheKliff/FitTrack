import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyDeploymentStatus,
  identifyUploadedDeployment,
  isPostUploadGraphqlTimeout,
  parseDeploymentList,
} from './deploy-railway.mjs';

const POST_UPLOAD_TIMEOUT = [
  'Failed to fetch: error sending request for url',
  '(https://backboard.railway.com/graphql/v2)',
  'Caused by:',
  'operation timed out',
].join('\n');

test('recognizes the Railway post-upload GraphQL timeout only', () => {
  assert.equal(isPostUploadGraphqlTimeout(POST_UPLOAD_TIMEOUT), true);
  assert.equal(
    isPostUploadGraphqlTimeout('Build failed: GraphQL validation returned 400.'),
    false,
  );
});

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
