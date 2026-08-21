import { readTestDataManifest, formatTestDataManifest } from './test-data/manifest';

async function main() {
  const manifest = await readTestDataManifest();
  console.log(formatTestDataManifest(manifest));
}

main().catch((error) => {
  console.error('[test-data] failed to read manifest');
  console.error(error);
  process.exitCode = 1;
});
