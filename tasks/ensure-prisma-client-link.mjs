import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const apiDir = path.join(repoRoot, 'apps', 'api');
const apiNodeModulesDir = path.join(apiDir, 'node_modules');
const targetDir = path.join(apiNodeModulesDir, '.prisma');

function resolveApiPrismaSourceDir() {
  const apiRequire = createRequire(path.join(apiDir, 'package.json'));
  const prismaClientPackagePath = apiRequire.resolve('@prisma/client/package.json');
  const prismaClientDir = fs.realpathSync(path.dirname(prismaClientPackagePath));
  return path.resolve(prismaClientDir, '..', '..', '.prisma');
}

function ensureDirectoryLink(targetPath, sourcePath) {
  const expectedClientEntry = path.join(sourcePath, 'client', 'default.d.ts');

  if (!fs.existsSync(expectedClientEntry)) {
    throw new Error(
      `Prisma generated client is missing at ${expectedClientEntry}. Run prisma generate first.`,
    );
  }

  let targetPathExists = false;
  try {
    fs.lstatSync(targetPath);
    targetPathExists = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if (targetPathExists) {
    try {
      const targetRealPath = fs.realpathSync(targetPath);
      const sourceRealPath = fs.realpathSync(sourcePath);

      if (targetRealPath === sourceRealPath) {
        return 'already-linked';
      }
    } catch {
      // Fall through and recreate the link.
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
  }

  fs.symlinkSync(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir');
  return 'linked';
}

const sourceDir = resolveApiPrismaSourceDir();
const result = ensureDirectoryLink(targetDir, sourceDir);

console.log(
  result === 'linked'
    ? `Linked ${targetDir} -> ${sourceDir}`
    : `Prisma client link already healthy at ${targetDir}`,
);
