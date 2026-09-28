#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(scriptDir, '..', '..');
const ignoredNodeModulesEntries = new Set(['.cache', '.pnpm', '.pnpm-workspace-state-v1.json']);

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function compareVersions(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function createJunction(linkPath, targetPath) {
  if (fs.existsSync(linkPath)) {
    return false;
  }

  ensureDirectory(path.dirname(linkPath));
  fs.symlinkSync(targetPath, linkPath, 'junction');
  return true;
}

function writeCmdShim(binPath, targetPath) {
  const cmdPath = `${binPath}.cmd`;
  if (fs.existsSync(cmdPath)) {
    return false;
  }

  const body = [
    '@ECHO off',
    'SETLOCAL',
    `node "${targetPath}" %*`,
    '',
  ].join('\r\n');
  fs.writeFileSync(cmdPath, body, 'utf8');
  return true;
}

function findWorkspacePackageJsons(workspaceRoot) {
  const packageJsonPaths = [];
  const roots = ['apps', 'packages'];

  for (const rootName of roots) {
    const parentDir = path.join(workspaceRoot, rootName);
    if (!fs.existsSync(parentDir)) {
      continue;
    }

    for (const childName of fs.readdirSync(parentDir)) {
      const packageJsonPath = path.join(parentDir, childName, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        packageJsonPaths.push(packageJsonPath);
      }
    }
  }

  return packageJsonPaths;
}

function collectWorkspacePackages(workspaceRoot) {
  const workspacePackages = new Map();

  for (const packageJsonPath of findWorkspacePackageJsons(workspaceRoot)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!packageJson.name) {
      continue;
    }

    workspacePackages.set(packageJson.name, path.dirname(packageJsonPath));
  }

  return workspacePackages;
}

function enumerateStorePackages(virtualStoreDir) {
  const packages = new Map();

  if (!fs.existsSync(virtualStoreDir)) {
    return packages;
  }

  for (const entry of fs.readdirSync(virtualStoreDir)) {
    const nodeModulesDir = path.join(virtualStoreDir, entry, 'node_modules');
    if (!fs.existsSync(nodeModulesDir)) {
      continue;
    }

    const directChildren = fs.readdirSync(nodeModulesDir, {
      withFileTypes: true,
    });

    for (const child of directChildren) {
      if (child.name === '.bin') {
        continue;
      }

      if (child.isDirectory() && child.name.startsWith('@')) {
        const scopeDir = path.join(nodeModulesDir, child.name);
        for (const scopedChild of fs.readdirSync(scopeDir, { withFileTypes: true })) {
          if (!scopedChild.isDirectory()) {
            continue;
          }

          const packageDir = path.join(scopeDir, scopedChild.name);
          const packageJsonPath = path.join(packageDir, 'package.json');
          if (!fs.existsSync(packageJsonPath)) {
            continue;
          }

          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const existing = packages.get(packageJson.name);
          if (!existing || compareVersions(packageJson.version, existing.version) > 0) {
            packages.set(packageJson.name, {
              version: packageJson.version,
              dir: packageDir,
              packageJson,
            });
          }
        }

        continue;
      }

      if (!child.isDirectory()) {
        continue;
      }

      const packageDir = path.join(nodeModulesDir, child.name);
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const existing = packages.get(packageJson.name);
      if (!existing || compareVersions(packageJson.version, existing.version) > 0) {
        packages.set(packageJson.name, {
          version: packageJson.version,
          dir: packageDir,
          packageJson,
        });
      }
    }
  }

  return packages;
}

function ensurePackageLink(nodeModulesRoot, packageName, targetPath) {
  const segments = packageName.split('/');
  const linkPath = path.join(nodeModulesRoot, ...segments);
  return createJunction(linkPath, targetPath);
}

function ensureBinShims(nodeModulesRoot, packageName, packageDir, packageJson) {
  const bin = packageJson.bin;
  if (!bin) {
    return 0;
  }

  const binEntries = typeof bin === 'string'
    ? [[packageName.includes('/') ? packageName.split('/').at(-1) : packageName, bin]]
    : Object.entries(bin);

  const binRoot = path.join(nodeModulesRoot, '.bin');
  ensureDirectory(binRoot);

  let createdCount = 0;
  for (const [binName, relativeTarget] of binEntries) {
    const absoluteTarget = path.join(packageDir, relativeTarget);
    if (!fs.existsSync(absoluteTarget)) {
      continue;
    }

    const baseBinPath = path.join(binRoot, binName);
    if (writeCmdShim(baseBinPath, absoluteTarget)) {
      createdCount += 1;
    }
  }

  return createdCount;
}

function ensureFile(filePath, body) {
  if (fs.existsSync(filePath)) {
    return false;
  }

  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, body, 'utf8');
  return true;
}

function resolveInstalledPackageDir(nodeModulesRoot, packageName) {
  const packagePath = path.join(nodeModulesRoot, ...packageName.split('/'));
  if (!fs.existsSync(packagePath)) {
    return null;
  }

  return fs.realpathSync(packagePath);
}

function findMissingTypeOnlyRuntimeModules(packageDir) {
  const missingModules = new Set();

  function visit(directoryPath) {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        continue;
      }

      const source = fs.readFileSync(entryPath, 'utf8');
      const matches = source.matchAll(/require\((['"])(\.[^'"]+)\1\)/g);

      for (const match of matches) {
        const targetBasePath = path.resolve(path.dirname(entryPath), match[2]);
        const targetJsPath = `${targetBasePath}.js`;
        const targetDtsPath = `${targetBasePath}.d.ts`;

        if (!fs.existsSync(targetJsPath) && fs.existsSync(targetDtsPath)) {
          missingModules.add(targetJsPath);
        }
      }
    }
  }

  visit(packageDir);
  return missingModules;
}

function needsClassValidatorEntrypointRepair(nodeModulesRoot) {
  const packageDir = resolveInstalledPackageDir(nodeModulesRoot, 'class-validator');
  if (!packageDir) {
    return false;
  }

  const bundlePath = path.join(packageDir, 'bundles', 'class-validator.umd.js');
  const cjsIndexPath = path.join(packageDir, 'cjs', 'index.js');
  return fs.existsSync(bundlePath) && !fs.existsSync(cjsIndexPath);
}

function needsNestSwaggerInterfaceRepair(nodeModulesRoot) {
  const packageDir = resolveInstalledPackageDir(nodeModulesRoot, '@nestjs/swagger');
  if (!packageDir) {
    return false;
  }

  const interfaceNames = [
    'swagger-custom-options.interface.js',
    'swagger-document-options.interface.js',
  ];

  return interfaceNames.some((fileName) => {
    const jsPath = path.join(packageDir, 'dist', 'interfaces', fileName);
    const dtsPath = jsPath.replace(/\.js$/, '.d.ts');
    return fs.existsSync(dtsPath) && !fs.existsSync(jsPath);
  });
}

function needsMappedTypesEntrypointRepair(nodeModulesRoot) {
  const packageDir = resolveInstalledPackageDir(
    nodeModulesRoot,
    '@nestjs/mapped-types',
  );
  if (!packageDir) {
    return false;
  }

  return (
    fs.existsSync(path.join(packageDir, 'dist', 'index.js')) &&
    !fs.existsSync(path.join(packageDir, 'index.js'))
  );
}

function repairKnownPackageEntrypoints(nodeModulesRoot, storePackages) {
  let repairedPackageEntrypoints = 0;

  const classValidatorDir = resolveInstalledPackageDir(
    nodeModulesRoot,
    'class-validator',
  );
  if (classValidatorDir) {
    const bundlePath = path.join(
      classValidatorDir,
      'bundles',
      'class-validator.umd.js',
    );
    const cjsIndexPath = path.join(classValidatorDir, 'cjs', 'index.js');
    const cjsIndexBody = [
      "'use strict';",
      '',
      "module.exports = require('../bundles/class-validator.umd.js');",
      '',
    ].join('\n');

    if (fs.existsSync(bundlePath) && ensureFile(cjsIndexPath, cjsIndexBody)) {
      repairedPackageEntrypoints += 1;
    }
  }

  const nestSwaggerDir = resolveInstalledPackageDir(
    nodeModulesRoot,
    '@nestjs/swagger',
  );
  if (nestSwaggerDir) {
    const interfaceRoot = path.join(nestSwaggerDir, 'dist', 'interfaces');
    const stubNames = [
      'swagger-custom-options.interface.js',
      'swagger-document-options.interface.js',
    ];
    const stubBody = [
      "'use strict';",
      "Object.defineProperty(exports, '__esModule', { value: true });",
      '',
    ].join('\n');

    for (const fileName of stubNames) {
      const jsPath = path.join(interfaceRoot, fileName);
      const dtsPath = jsPath.replace(/\.js$/, '.d.ts');
      if (fs.existsSync(dtsPath) && ensureFile(jsPath, stubBody)) {
        repairedPackageEntrypoints += 1;
      }
    }
  }

  const mappedTypesDir = resolveInstalledPackageDir(
    nodeModulesRoot,
    '@nestjs/mapped-types',
  );
  if (mappedTypesDir) {
    const topLevelIndexJs = path.join(mappedTypesDir, 'index.js');
    const topLevelIndexDts = path.join(mappedTypesDir, 'index.d.ts');
    const distIndexJs = path.join(mappedTypesDir, 'dist', 'index.js');
    const distIndexDts = path.join(mappedTypesDir, 'dist', 'index.d.ts');
    const mappedTypeInterfaceJs = path.join(
      mappedTypesDir,
      'dist',
      'mapped-type.interface.js',
    );
    const mappedTypeInterfaceDts = path.join(
      mappedTypesDir,
      'dist',
      'mapped-type.interface.d.ts',
    );
    const jsShimBody = [
      "'use strict';",
      '',
      "module.exports = require('./dist/index.js');",
      '',
    ].join('\n');
    const dtsShimBody = "export * from './dist/index';\n";
    const interfaceStubBody = [
      "'use strict';",
      "Object.defineProperty(exports, '__esModule', { value: true });",
      '',
    ].join('\n');

    if (fs.existsSync(distIndexJs) && ensureFile(topLevelIndexJs, jsShimBody)) {
      repairedPackageEntrypoints += 1;
    }

    if (
      fs.existsSync(distIndexDts) &&
      ensureFile(topLevelIndexDts, dtsShimBody)
    ) {
      repairedPackageEntrypoints += 1;
    }

    if (
      fs.existsSync(mappedTypeInterfaceDts) &&
      ensureFile(mappedTypeInterfaceJs, interfaceStubBody)
    ) {
      repairedPackageEntrypoints += 1;
    }
  }

  const typeOnlyShimBody = [
    "'use strict';",
    "Object.defineProperty(exports, '__esModule', { value: true });",
    '',
  ].join('\n');
  const scannedPackageDirs = new Set(
    [...storePackages.values()].map((entry) => entry.dir),
  );

  for (const packageDir of scannedPackageDirs) {
    for (const missingModulePath of findMissingTypeOnlyRuntimeModules(packageDir)) {
      if (ensureFile(missingModulePath, typeOnlyShimBody)) {
        repairedPackageEntrypoints += 1;
      }
    }
  }

  return repairedPackageEntrypoints;
}

export function needsNodeLinkRepair(workspaceRoot) {
  const nodeModulesRoot = path.join(workspaceRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesRoot)) {
    return true;
  }

  const entries = fs
    .readdirSync(nodeModulesRoot)
    .filter((entry) => !ignoredNodeModulesEntries.has(entry));

  return (
    entries.length === 0 ||
    needsClassValidatorEntrypointRepair(nodeModulesRoot) ||
    needsNestSwaggerInterfaceRepair(nodeModulesRoot) ||
    needsMappedTypesEntrypointRepair(nodeModulesRoot)
  );
}

export function repairNodeLinks(workspaceRoot) {
  const nodeModulesRoot = path.join(workspaceRoot, 'node_modules');
  const virtualStoreDir = path.join(nodeModulesRoot, '.pnpm');

  ensureDirectory(nodeModulesRoot);

  const workspacePackages = collectWorkspacePackages(workspaceRoot);
  const storePackages = enumerateStorePackages(virtualStoreDir);

  let linkedPackages = 0;
  let linkedWorkspacePackages = 0;
  let createdBinShims = 0;

  for (const [packageName, packageDir] of workspacePackages) {
    if (ensurePackageLink(nodeModulesRoot, packageName, packageDir)) {
      linkedWorkspacePackages += 1;
    }
  }

  for (const [packageName, entry] of storePackages) {
    if (workspacePackages.has(packageName)) {
      continue;
    }

    if (ensurePackageLink(nodeModulesRoot, packageName, entry.dir)) {
      linkedPackages += 1;
    }

    createdBinShims += ensureBinShims(
      nodeModulesRoot,
      packageName,
      entry.dir,
      entry.packageJson,
    );
  }

  const repairedPackageEntrypoints = repairKnownPackageEntrypoints(
    nodeModulesRoot,
    storePackages,
  );

  return {
    linkedPackages,
    linkedWorkspacePackages,
    createdBinShims,
    repairedPackageEntrypoints,
  };
}

function main() {
  const workspaceRoot = path.resolve(process.argv[2] ?? defaultWorkspaceRoot);
  const result = repairNodeLinks(workspaceRoot);
  console.log(
    JSON.stringify(
      {
        workspaceRoot,
        ...result,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
