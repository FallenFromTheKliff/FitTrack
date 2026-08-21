#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const artifactRoot = path.join(repoRoot, '.artifacts', 'IOS-IPA');
const defaultProfile = 'release';

function pathExists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(
    [
      'Build a FitTrack iOS IPA using EAS.',
      'Defaults to remote cloud EAS build.',
      '',
      'Usage:',
      '  pnpm --dir apps/mobile run ios:ipa',
      '  pnpm --dir apps/mobile run ios:ipa -- --profile development',
      '  pnpm --dir apps/mobile run ios:ipa -- --install',
      '  pnpm --dir apps/mobile run ios:ipa -- --local',
      '  pnpm run install:mobile:ipa',
      '  pnpm --dir apps/mobile run ios:ipa -- --install-only',
      '',
      'Commands:',
      '  --local                                    Force local iOS build (macOS + Xcode required).',
      '  --remote                                   Force remote cloud iOS build.',
      '  --install                                  Install the IPA after a successful build (macOS + USB device required).',
      '  --install-only                             Install the latest/selected IPA without rebuilding.',
      '  --file <path>                              IPA file to install when using --install-only.',
      '  --profile <release|development|preview>     EAS profile for IPA build. Default: release.',
      '  --device <udid>                            Target iOS device UDID for automatic install.',
      '  --output-dir <path>                        Override IPA artifact directory. Default: .artifacts/IOS-IPA',
      '  --output <path>                            Override IPA output path for this run.',
      '  --dry-run                                  Show the computed build/install command without executing.',
      '  --help                                     Show this help.',
      '',
      'Any arguments after `--` are forwarded to `eas build`.',
    ].join('\n'),
  );
}

function parseOptions(argv) {
  const options = {
    build: true,
    buildMode: 'remote',
    profile: defaultProfile,
    outputDir: artifactRoot,
    output: null,
    file: null,
    device: null,
    install: false,
    installOnly: false,
    dryRun: false,
    help: false,
    extraArgs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--local') {
      options.buildMode = 'local';
      continue;
    }

    if (arg === '--remote') {
      options.buildMode = 'remote';
      continue;
    }

    if (arg === '--install') {
      options.install = true;
      continue;
    }

    if (arg === '--install-only') {
      options.build = false;
      options.installOnly = true;
      options.install = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--profile') {
      const profile = argv[index + 1];
      if (!profile) {
        throw new Error('Missing value for --profile');
      }
      options.profile = profile;
      index += 1;
      continue;
    }

    if (arg === '--output-dir') {
      const outputDir = argv[index + 1];
      if (!outputDir) {
        throw new Error('Missing value for --output-dir');
      }
      options.outputDir = outputDir;
      index += 1;
      continue;
    }

    if (arg === '--output') {
      const output = argv[index + 1];
      if (!output) {
        throw new Error('Missing value for --output');
      }
      options.output = output;
      index += 1;
      continue;
    }

    if (arg === '--file') {
      const file = argv[index + 1];
      if (!file) {
        throw new Error('Missing value for --file');
      }
      options.file = file;
      index += 1;
      continue;
    }

    if (arg === '--device') {
      const device = argv[index + 1];
      if (!device) {
        throw new Error('Missing value for --device');
      }
      options.device = device;
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      const profile = arg.slice('--profile='.length).trim();
      if (!profile) {
        throw new Error('Missing value for --profile');
      }
      options.profile = profile;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      const outputDir = arg.slice('--output-dir='.length).trim();
      if (!outputDir) {
        throw new Error('Missing value for --output-dir');
      }
      options.outputDir = outputDir;
      continue;
    }

    if (arg.startsWith('--output=')) {
      const output = arg.slice('--output='.length).trim();
      if (!output) {
        throw new Error('Missing value for --output');
      }
      options.output = output;
      continue;
    }

    if (arg.startsWith('--file=')) {
      const file = arg.slice('--file='.length).trim();
      if (!file) {
        throw new Error('Missing value for --file');
      }
      options.file = file;
      continue;
    }

    if (arg.startsWith('--device=')) {
      const device = arg.slice('--device='.length).trim();
      if (!device) {
        throw new Error('Missing value for --device');
      }
      options.device = device;
      continue;
    }

    if (arg === '--') {
      continue;
    }

    options.extraArgs.push(arg);
  }

  return options;
}

function getDefaultOutputPath(outputDir, profile) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(outputDir, `FitTrack-${profile}-${stamp}.ipa`);
}

function listDirectoryFiles(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function findLatestIpa(directory) {
  const entries = listDirectoryFiles(directory).filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.ipa'),
  );

  if (!entries.length) {
    return null;
  }

  const withStats = entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return {
      path: fullPath,
      modifiedAt: fs.statSync(fullPath).mtimeMs,
    };
  });

  withStats.sort((left, right) => right.modifiedAt - left.modifiedAt);
  return withStats[0].path;
}

function resolveEasCommand() {
  const localCmd = path.join(
    appRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'eas.cmd' : 'eas',
  );
  if (pathExists(localCmd)) {
    return {
      command: localCmd,
      args: [],
      fallback: false,
      usesNpx: false,
    };
  }

  if (process.platform === 'win32') {
    return {
      command: 'cmd',
      args: ['/d', '/s', '/c', 'npx', '--yes', 'eas'],
      fallback: true,
      usesNpx: true,
    };
  }

  return {
    command: 'npx',
    args: ['--yes', 'eas'],
    fallback: true,
    usesNpx: true,
  };
}

function runCommand(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: 'inherit',
    env,
    windowsHide: true,
  });

  if (result.error) {
    return {
      status: result.status ?? 1,
      error: result.error,
      signal: result.signal,
    };
  }

  if (result.status !== 0) {
    return {
      status: result.status ?? 1,
      signal: result.signal,
    };
  }

  return { status: 0, signal: result.signal };
}

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function getBuildEnv(runner) {
  if (runner.usesNpx && process.env.NPM_CONFIG_OFFLINE === 'true') {
    console.log(
      '[fittrack-mobile-ipa] npm is configured as offline; overriding to allow EAS bootstrap on first run.',
    );
  }

  return {
    ...process.env,
    EXPO_NO_METRO_WORKSPACE_ROOT: process.env.EXPO_NO_METRO_WORKSPACE_ROOT || '1',
    ...(runner.usesNpx && process.env.NPM_CONFIG_OFFLINE === 'true'
      ? { NPM_CONFIG_OFFLINE: 'false' }
      : {}),
  };
}

function runCommandCaptureJson(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env,
    windowsHide: true,
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout ?? '';
}

function findDefaultDeviceId() {
  const xcrun = runCommandCaptureJson('xcrun', ['devicectl', 'list', 'devices', '--json']);
  if (!xcrun) {
    return null;
  }

  try {
    const payload = JSON.parse(xcrun);
    const flatDevices = [];

    const walk = (obj) => {
      if (!obj) {
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((entry) => walk(entry));
        return;
      }
      if (typeof obj === 'object') {
        if (obj.udid || obj.deviceId || obj.identifier || obj.udidHex) {
          const possibleId = obj.udid || obj.deviceId || obj.identifier || obj.udidHex;
          flatDevices.push(String(possibleId));
        }
        if (obj.devices && Array.isArray(obj.devices)) {
          walk(obj.devices);
          return;
        }
        if (obj.result) {
          walk(obj.result);
        }
        if (obj.info) {
          walk(obj.info);
        }
        Object.values(obj).forEach((value) => {
          if (typeof value === 'object') {
            walk(value);
          }
        });
      }
    };

    walk(payload);
    const candidate = flatDevices.find(Boolean);
    return candidate ?? null;
  } catch {
    return null;
  }
}

function installWithDevicectl(ipaPath, deviceId) {
  const args = ['devicectl', 'install', 'app'];

  if (deviceId) {
    args.push('--device', deviceId);
  }

  args.push('--path', ipaPath);

  const result = spawnSync('xcrun', args, {
    cwd: appRoot,
    stdio: 'inherit',
    windowsHide: true,
  });

  return result.status === 0;
}

function ensureInstallOniOSOnly() {
  if (process.platform !== 'darwin') {
    throw new Error('iOS install requires macOS (Apple APIs to install IPA are not available on this host).');
  }

  const whichResult = spawnSync('xcrun', ['--find', 'devicectl'], {
    stdio: 'ignore',
    windowsHide: true,
  });

  if (whichResult.status !== 0) {
    throw new Error(
      'Apple tooling is not available: xcrun/devicectl not found. Install Xcode and Xcode Command Line Tools, then retry.',
    );
  }
}

function resolveIpaToInstall(options, explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(appRoot, explicitPath);
    if (!pathExists(resolved)) {
      throw new Error(`IPA not found at --file path: ${resolved}`);
    }
    return resolved;
  }

  const outputDir = path.resolve(appRoot, options.outputDir);
  const latest = findLatestIpa(outputDir);
  if (!latest) {
    throw new Error(`No IPA found in ${outputDir}. Build one first or pass --file.`);
  }
  return latest;
}

function getBuildArtifactPath(options) {
  return options.output
    ? path.resolve(appRoot, options.output)
    : getDefaultOutputPath(options.outputDir, options.profile);
}

function runInstall(ipaPath, options) {
  ensureInstallOniOSOnly();
  const resolvedDevice = options.device || findDefaultDeviceId();
  const success = installWithDevicectl(ipaPath, resolvedDevice);

  if (!success) {
    const target = resolvedDevice ? ` --device ${resolvedDevice}` : '';
    throw new Error(
      [
        'Install via xcrun devicectl failed or could not run.',
        `Try: xcrun devicectl install app --path "${ipaPath}"${target}`,
        'If no device is attached, connect one via USB and unlock it.',
      ].join('\n'),
    );
  }

  console.log(`[fittrack-mobile-ipa] Installed ${ipaPath}`);
}

function runBuild(options, outputPath) {
  const useLocalBuild = options.buildMode === 'local';
  const outputDirectory = path.dirname(outputPath);

  const runner = resolveEasCommand();
  const buildArgs = [
    ...runner.args,
    'build',
    '--platform',
    'ios',
    '--profile',
    options.profile,
    ...(useLocalBuild ? ['--local'] : []),
    '--non-interactive',
    '--output',
    outputPath,
    ...options.extraArgs,
  ];

  if (options.buildMode === 'local' && process.platform !== 'darwin') {
    throw new Error('Local iOS build requires macOS because local iOS builds depend on Xcode.');
  }

  if (options.buildMode !== 'local' && options.buildMode !== 'remote') {
    throw new Error('Unknown build mode. Use --local or --remote.');
  }

  if (options.dryRun) {
    console.log('[fittrack-mobile-ipa] Dry run build command:');
    console.log(`  ${runner.command} ${buildArgs.join(' ')}`);
    return { outputPath, status: 0, built: false };
  }

  fs.mkdirSync(outputDirectory, { recursive: true });

  const result = runCommand(runner.command, buildArgs, {
    ...getBuildEnv(runner),
  });

  if (result.status !== 0) {
    const reason = result.error ? ` ${result.error.message}` : '';
    const signal = result.signal ? ` Signal: ${result.signal}.` : '';
    const command = formatCommand(runner.command, buildArgs);
    const hint = runner.usesNpx
      ? ' If this failed before any remote build started, this usually means EAS CLI could not be downloaded.'
      : '';
    throw new Error(
      `eas build command failed with exit code ${result.status}.${reason} Command: ${command}.${signal}${hint}`,
    );
  }

  return { outputPath, status: 0, built: true };
}

let options;

try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  console.error(`[fittrack-mobile-ipa] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

const runBuildAndMaybeInstall = async () => {
  let ipaPath = options.file ? path.resolve(appRoot, options.file) : null;
  const outputPath = getBuildArtifactPath(options);

  if (options.build) {
    const buildResult = await runBuild(options, outputPath);

    if (buildResult.built === false) {
      if (options.install || options.installOnly) {
        const target = options.device ? ` --device ${options.device}` : '';
        console.log('[fittrack-mobile-ipa] Dry run install command:');
        console.log(`  xcrun devicectl install app${target} --path "${outputPath}"`);
      }
      return;
    }

    if (!pathExists(outputPath)) {
      const latestInOutputDir = findLatestIpa(path.resolve(outputPath, '..')) ??
        findLatestIpa(path.resolve(appRoot, options.outputDir));
      if (!latestInOutputDir) {
        console.error('[fittrack-mobile-ipa] Build finished but output IPA was not found.');
        process.exit(1);
      }
      ipaPath = latestInOutputDir;
    } else {
      ipaPath = outputPath;
    }
    console.log(`[fittrack-mobile-ipa] IPA built: ${ipaPath}`);
  } else {
    if (!ipaPath) {
      ipaPath = resolveIpaToInstall(options);
    }
  }

  if (!ipaPath) {
    console.error('[fittrack-mobile-ipa] No IPA file available to install.');
    process.exit(1);
  }

  if (options.install || options.installOnly) {
    if (options.dryRun) {
      const target = options.device ? ` --device ${options.device}` : '';
      console.log('[fittrack-mobile-ipa] Dry run install command:');
      console.log(`  xcrun devicectl install app${target} --path "${ipaPath}"`);
      process.exit(0);
    }
    runInstall(ipaPath, options);
  }
};

try {
  runBuildAndMaybeInstall().catch((error) => {
    console.error(`[fittrack-mobile-ipa] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
} catch (error) {
  console.error(`[fittrack-mobile-ipa] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
