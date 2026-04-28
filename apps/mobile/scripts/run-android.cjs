#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(appRoot, 'android');
const expoCliPath = path.join(appRoot, 'node_modules', 'expo', 'bin', 'cli');
const localPropertiesPath = path.join(androidRoot, 'local.properties');
const repoRoot = path.resolve(appRoot, '..', '..');

const generatedTargets = [
  path.join(androidRoot, 'build', 'generated', 'autolinking'),
  path.join(androidRoot, 'app', 'build', 'generated', 'autolinking'),
  path.join(androidRoot, 'app', 'build', 'intermediates', 'source_set_path_map'),
];

function pathExists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function detectAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
      : null,
    process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk')
      : null,
  ].filter(Boolean);

  return candidates.find((candidate) =>
    pathExists(path.join(candidate, 'platform-tools')),
  );
}

function ensureAndroidSdkConfig() {
  const sdkPath = detectAndroidSdk();
  if (!sdkPath) {
    return process.env;
  }

  const normalizedSdkPath = sdkPath.replace(/\\/g, '/');
  const localPropertiesContent = `sdk.dir=${normalizedSdkPath}\n`;

  if (
    !pathExists(localPropertiesPath) ||
    fs.readFileSync(localPropertiesPath, 'utf8') !== localPropertiesContent
  ) {
    fs.writeFileSync(localPropertiesPath, localPropertiesContent, 'utf8');
  }

  return {
    ...process.env,
    ANDROID_HOME: process.env.ANDROID_HOME || sdkPath,
    ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || sdkPath,
  };
}

function findPackageDir(packageName) {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [appRoot],
    });
    return path.dirname(packageJsonPath);
  } catch {
    return null;
  }
}

function warnAboutLongWindowsPaths() {
  if (process.platform !== 'win32') {
    return;
  }

  if (repoRoot.length < 40) {
    return;
  }

  console.warn(
    [
      '[fittrack-mobile] Long Windows path detected for native Android build.',
      `Current repo path: ${repoRoot}`,
      'If native builds still fail, map the repo to a short drive first.',
      'If SUBST is blocked with "Access denied", create a short junction path instead:',
      `  New-Item -ItemType Junction -Path C:\\FitTrackShort -Target "${repoRoot}"`,
      '  Set-Location C:\\FitTrackShort',
      '  pnpm --dir apps/mobile run android --device',
      'Fallback with SUBST:',
      `  subst X: "${repoRoot}"`,
      '  X:',
      '  pnpm --dir apps/mobile run android --device',
    ].join('\n'),
  );
}

function maybeRerunFromShortDrive() {
  if (
    process.platform !== 'win32' ||
    process.env.FITTRACK_ANDROID_SHORTPATH === '1' ||
    repoRoot.length < 40
  ) {
    return null;
  }

  const candidateDrives = ['Z', 'Y', 'X', 'W', 'V'];
  for (const driveLetter of candidateDrives) {
    const mountResult = spawnSync(
      'cmd.exe',
      ['/d', '/s', '/c', `subst ${driveLetter}: "${repoRoot}"`],
      {
        stdio: 'ignore',
        windowsHide: true,
      },
    );

    if (mountResult.status !== 0) {
      continue;
    }

    const mappedAppRoot = `${driveLetter}:\\${path.relative(repoRoot, appRoot)}`;
    const mappedScriptPath = path.join(mappedAppRoot, 'scripts', 'run-android.cjs');

    console.warn(
      `[fittrack-mobile] Re-running Android build from short drive ${driveLetter}: to avoid Windows native path-length issues.`,
    );

    try {
      const rerunResult = spawnSync(
        process.execPath,
        [mappedScriptPath, ...process.argv.slice(2)],
        {
          cwd: mappedAppRoot,
          stdio: 'inherit',
          env: {
            ...process.env,
            FITTRACK_ANDROID_SHORTPATH: '1',
          },
          windowsHide: true,
        },
      );
      return rerunResult.status ?? 1;
    } finally {
      spawnSync('cmd.exe', ['/d', '/s', '/c', `subst ${driveLetter}: /d`], {
        stdio: 'ignore',
        windowsHide: true,
      });
    }
  }

  console.warn(
    '[fittrack-mobile] Automatic short-drive remap failed. Use the junction or SUBST fallback printed above before retrying the Android build.',
  );

  return null;
}

const shortDriveStatus = maybeRerunFromShortDrive();
if (shortDriveStatus !== null) {
  process.exit(shortDriveStatus);
}

for (const target of generatedTargets) {
  fs.rmSync(target, { recursive: true, force: true });
}

for (const nativePackageName of ['react-native-worklets']) {
  const packageDir = findPackageDir(nativePackageName);
  if (!packageDir) {
    continue;
  }

  for (const target of [
    path.join(packageDir, 'android', '.cxx'),
    path.join(packageDir, 'android', 'build'),
    path.join(packageDir, 'android', 'build', 'intermediates', 'cxx'),
  ]) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

const androidEnv = ensureAndroidSdkConfig();
warnAboutLongWindowsPaths();

const result = spawnSync(
  process.execPath,
  [
    '--max-old-space-size=8192',
    expoCliPath,
    'run:android',
    '--no-install',
    '--no-bundler',
    '--no-build-cache',
    ...process.argv.slice(2),
  ],
  {
    cwd: appRoot,
    stdio: 'inherit',
    env: androidEnv,
    windowsHide: true,
  },
);

process.exit(result.status ?? 1);
