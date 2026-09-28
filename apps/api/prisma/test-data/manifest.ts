import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ManualTestPath, TestAccount, TestDataSeedMode } from './constants';
import { TEST_DATA_MANIFEST_PATH } from './constants';

export type TestDataManifest = {
  counts: Record<string, Record<string, number>>;
  credentials: Array<{
    email: string;
    label: string;
    password: string;
    role: string;
  }>;
  manifestPath: string;
  mode: TestDataSeedMode;
  notableIds: Record<string, string>;
  runAt: string;
  suggestedManualTestPaths: ManualTestPath[];
};

export async function writeTestDataManifest(
  manifest: Omit<TestDataManifest, 'manifestPath'>,
) {
  await mkdir(dirname(TEST_DATA_MANIFEST_PATH), { recursive: true });
  const payload: TestDataManifest = {
    ...manifest,
    manifestPath: TEST_DATA_MANIFEST_PATH,
  };

  await writeFile(
    TEST_DATA_MANIFEST_PATH,
    JSON.stringify(payload, null, 2) + '\n',
    'utf8',
  );

  return payload;
}

export async function readTestDataManifest() {
  const raw = await readFile(TEST_DATA_MANIFEST_PATH, 'utf8');
  return JSON.parse(raw) as TestDataManifest;
}

export function toManifestCredentials(accounts: readonly TestAccount[]) {
  return accounts.map((account) => ({
    email: account.email,
    label: account.label,
    password: account.password,
    role: account.role,
  }));
}

export function formatTestDataManifest(manifest: TestDataManifest) {
  const lines = [
    `Manifest: ${manifest.manifestPath}`,
    `Mode: ${manifest.mode}`,
    `Run At: ${manifest.runAt}`,
    '',
    'Credentials:',
    ...manifest.credentials.map(
      (credential) =>
        `- ${credential.label}: ${credential.email} / ${credential.password} (${credential.role})`,
    ),
    '',
    'Counts:',
    ...Object.entries(manifest.counts).flatMap(([area, values]) => [
      `- ${area}:`,
      ...Object.entries(values).map(([label, value]) => `  ${label}: ${value}`),
    ]),
    '',
    'Suggested Manual Test Paths:',
    ...manifest.suggestedManualTestPaths.map(
      (path) =>
        `- ${path.area}: ${path.route} using ${path.credentialKey} -> ${path.expected}`,
    ),
    '',
    'Notable IDs:',
    ...Object.entries(manifest.notableIds).map(([key, value]) => `- ${key}: ${value}`),
  ];

  return lines.join('\n');
}
