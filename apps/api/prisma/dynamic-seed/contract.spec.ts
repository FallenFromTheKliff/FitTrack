import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSeedAccounts,
  DEMO_ACCOUNTS,
  DYNAMIC_SEED_PASSWORD,
} from './accounts';
import {
  BRODIGY_QUESTION_POOL,
  buildBrodigyHistoryKeys,
  pickBrodigyQuestion,
} from './brodigy';
import { parseDynamicSeedConfig } from './config';
import { SeedRandom } from './random';

test('dynamic seed preserves local and railway CLI options', () => {
  const local = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--target=local',
    '--mode=reset',
    '--users=100',
    '--exercise-history=100',
  ]);
  const railway = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--target=railway',
    '--mode=reset',
    '--users=100',
    '--exercise-history=100',
    '--allow-remote-reset',
    '--confirm=RESET_REMOTE_DYNAMIC_SEED',
  ]);

  assert.equal(local.target, 'local');
  assert.equal(local.mode, 'reset');
  assert.equal(local.users, 100);
  assert.equal(local.exerciseHistory, 100);
  assert.equal(railway.target, 'railway');
  assert.equal(railway.mode, 'reset');
  assert.equal(railway.users, 100);
  assert.equal(railway.exerciseHistory, 100);
  assert.equal(railway.allowRemoteReset, true);
  assert.equal(railway.confirmRemoteReset, 'RESET_REMOTE_DYNAMIC_SEED');
});

test('all realistic seed accounts share the documented password and stable keys', () => {
  const config = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--users=40',
  ]);
  const accounts = buildSeedAccounts(config);
  const accountKeys = accounts.map((account) => account.key);

  assert.equal(accounts.length, 40);
  assert.ok(
    accounts.every((account) => account.password === DYNAMIC_SEED_PASSWORD),
  );
  assert.equal(new Set(accountKeys).size, accountKeys.length);
  assert.deepEqual(
    accountKeys.slice(0, DEMO_ACCOUNTS.length),
    DEMO_ACCOUNTS.map((account) => account.key),
  );
  assert.deepEqual(
    new Set(
      buildBrodigyHistoryKeys(accountKeys, [
        'member-active',
        'member-premium',
      ]),
    ),
    new Set(accountKeys),
  );
});

test('Brodigy question selection is curated and deterministic', () => {
  assert.ok(BRODIGY_QUESTION_POOL.length >= 15);
  assert.deepEqual(
    new Set(BRODIGY_QUESTION_POOL.map((question) => question.category)),
    new Set(['trivia', 'fitness', 'gym', 'sertfit']),
  );

  const first = new SeedRandom(2026);
  const second = new SeedRandom(2026);
  const firstSelection = Array.from({ length: 40 }, () =>
    pickBrodigyQuestion(first).prompt,
  );
  const secondSelection = Array.from({ length: 40 }, () =>
    pickBrodigyQuestion(second).prompt,
  );

  assert.deepEqual(firstSelection, secondSelection);
  assert.ok(new Set(firstSelection).size > 1);
});
