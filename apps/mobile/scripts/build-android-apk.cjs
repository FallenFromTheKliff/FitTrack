#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(appRoot, 'android');
const localPropertiesPath = path.join(androidRoot, 'local.properties');
const repoRoot = path.resolve(appRoot, '..', '..');
const artifactRoot = path.join(repoRoot, '.artifacts', 'mobile-apk');

const generatedTargets = [
  path.join(repoRoot, '.cxx', 'expo-core'),
  path.join(repoRoot, '.cxx', 'rnskia'),
  path.join(repoRoot, '.cxx', 'rnr'),
  path.join(repoRoot, '.cxx', 'rnw'),
  path.join(repoRoot, '.cxx', 'rnwc'),
  path.join(androidRoot, 'build', 'generated', 'autolinking'),
  path.join(androidRoot, '.cxx', 'react-native-vision-camera'),
  path.join(androidRoot, '.cxx', 'react-native-worklets'),
  path.join(androidRoot, 'app', '.cxx'),
  path.join(androidRoot, 'app', 'build', 'generated', 'autolinking'),
  path.join(androidRoot, 'app', 'build', 'intermediates', 'cxx'),
  path.join(androidRoot, 'app', 'build', 'intermediates', 'source_set_path_map'),
];

const nativePackagesToClean = [
  '@shopify/react-native-skia',
  'expo-modules-core',
  'react-native-reanimated',
  'react-native-vision-camera',
  'react-native-worklets',
  'react-native-worklets-core',
  'vision-camera-pose-detector',
];

const variantAliases = new Map([
  ['debug', 'Debug'],
  ['local', 'DebugOptimized'],
  ['debugoptimized', 'DebugOptimized'],
  ['debug-optimized', 'DebugOptimized'],
  ['optimized', 'DebugOptimized'],
  ['release', 'Release'],
]);

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
      'Build a FitTrack Android APK without installing it on a device.',
      'This uses Gradle assemble tasks directly instead of expo run:android.',
      '',
      'Usage:',
      '  pnpm --dir apps/mobile run android:apk',
      '  pnpm --dir apps/mobile run android:apk -- --variant debug',
      '  pnpm --dir apps/mobile run android:apk -- --variant release',
      '  pnpm --dir apps/mobile run android:apk -- --install',
      '  pnpm run install:mobile:apk',
      '',
      'Options:',
      '  --variant <debug|debugOptimized|release>  APK variant to build. Default: debugOptimized.',
      '  --debug                                  Shortcut for --variant debug.',
      '  --debug-optimized                       Shortcut for --variant debugOptimized.',
      '  --release                                Shortcut for --variant release.',
      '  --api-url <url>                          API URL to embed in the JS bundle.',
      '  --install                                Install or update the APK on a connected Android device.',
      '  --device <serial>                        Target a specific adb device serial.',
      '  --clean                                  Run Gradle clean before assembling.',
      '  --no-copy                                Do not copy the APK into .artifacts/mobile-apk.',
      '  --dry-run                                Print the Gradle command without running it.',
      '  --help                                   Show this help.',
      '',
      'Any unrecognized arguments are forwarded to Gradle.',
      '',
      'Environment:',
      '  EXPO_PUBLIC_API_URL                      API URL embedded when the variant bundles JS.',
      '  FITTRACK_MOBILE_API_URL                  Convenience alias for EXPO_PUBLIC_API_URL.',
      '  FITTRACK_LOCAL_API_URL                   Existing local API alias; also forwarded.',
      '  ANDROID_SERIAL                           adb device serial used when --device is omitted.',
      '  EXPO_NO_METRO_WORKSPACE_ROOT             Defaults to 1 so release bundling resolves from apps/mobile.',
    ].join('\n'),
  );
}

function normalizeVariant(value) {
  const key = String(value ?? '').trim();
  const normalizedKey = key.replace(/_/g, '-').toLowerCase();
  const compactKey = normalizedKey.replace(/-/g, '');

  return variantAliases.get(normalizedKey) ?? variantAliases.get(compactKey);
}

function parseOptions(argv) {
  const options = {
    clean: false,
    copy: true,
    deviceSerial: null,
    dryRun: false,
    gradleArgs: [],
    help: false,
    install: false,
    apiUrl: null,
    variant: 'DebugOptimized',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--clean') {
      options.clean = true;
      continue;
    }

    if (arg === '--no-copy') {
      options.copy = false;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--debug') {
      options.variant = 'Debug';
      continue;
    }

    if (arg === '--debug-optimized') {
      options.variant = 'DebugOptimized';
      continue;
    }

    if (arg === '--release') {
      options.variant = 'Release';
      continue;
    }

    if (arg === '--install') {
      options.install = true;
      continue;
    }

    if (arg === '--variant') {
      const nextValue = argv[index + 1];
      const variant = normalizeVariant(nextValue);
      if (!variant) {
        throw new Error(`Unknown Android APK variant: ${nextValue ?? '(missing)'}`);
      }
      options.variant = variant;
      index += 1;
      continue;
    }

    if (arg === '--api-url') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --api-url');
      }
      options.apiUrl = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--device') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --device');
      }
      options.deviceSerial = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith('--variant=')) {
      const variant = normalizeVariant(arg.slice('--variant='.length));
      if (!variant) {
        throw new Error(`Unknown Android APK variant: ${arg.slice('--variant='.length)}`);
      }
      options.variant = variant;
      continue;
    }

    if (arg.startsWith('--api-url=')) {
      const apiUrl = arg.slice('--api-url='.length).trim();
      if (!apiUrl) {
        throw new Error('Missing value for --api-url');
      }
      options.apiUrl = apiUrl;
      continue;
    }

    if (arg.startsWith('--device=')) {
      const deviceSerial = arg.slice('--device='.length).trim();
      if (!deviceSerial) {
        throw new Error('Missing value for --device');
      }
      options.deviceSerial = deviceSerial;
      continue;
    }

    if (arg === '--') {
      continue;
    }

    options.gradleArgs.push(arg);
  }

  return options;
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

function detectAdbPath() {
  const sdkPath = detectAndroidSdk();
  const sdkAdbPath = sdkPath
    ? path.join(
        sdkPath,
        'platform-tools',
        process.platform === 'win32' ? 'adb.exe' : 'adb',
      )
    : null;

  for (const candidate of [sdkAdbPath, 'adb'].filter(Boolean)) {
    const result = spawnSync(candidate, ['version'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
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

function removeGeneratedPath(target) {
  try {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: process.platform === 'win32' ? 5 : 0,
      retryDelay: 250,
    });
  } catch (error) {
    if (
      process.platform === 'win32' &&
      error instanceof Error &&
      ['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code)
    ) {
      console.warn(
        `[fittrack-mobile-apk] Skipping locked generated path after retries: ${target}`,
      );
      return;
    }

    throw error;
  }
}

function cleanGeneratedNativeOutputs() {
  for (const target of generatedTargets) {
    removeGeneratedPath(target);
  }

  for (const nativePackageName of nativePackagesToClean) {
    const packageDir = findPackageDir(nativePackageName);
    if (!packageDir) {
      continue;
    }

    for (const target of [
      path.join(packageDir, 'android', '.cxx'),
      path.join(packageDir, 'android', 'build'),
      path.join(packageDir, 'android', 'build', 'intermediates', 'cxx'),
    ]) {
      removeGeneratedPath(target);
    }
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
      '[fittrack-mobile-apk] Long Windows path detected for native Android build.',
      `Current repo path: ${repoRoot}`,
      'If native builds still fail, map the repo to a short drive first.',
      'If SUBST is blocked with "Access denied", create a short junction path instead:',
      `  New-Item -ItemType Junction -Path C:\\FitTrackShort -Target "${repoRoot}"`,
      '  Set-Location C:\\FitTrackShort',
      '  pnpm --dir apps/mobile run android:apk',
      'Fallback with SUBST:',
      `  subst X: "${repoRoot}"`,
      '  X:',
      '  pnpm --dir apps/mobile run android:apk',
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
    const mappedScriptPath = path.join(mappedAppRoot, 'scripts', 'build-android-apk.cjs');

    console.warn(
      `[fittrack-mobile-apk] Re-running Android APK build from short drive ${driveLetter}: to avoid Windows native path-length issues.`,
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
    '[fittrack-mobile-apk] Automatic short-drive remap failed. Use the junction or SUBST fallback printed above before retrying the APK build.',
  );

  return null;
}

function getVariantDirectoryName(variant) {
  return variant.charAt(0).toLowerCase() + variant.slice(1);
}

function getBuildTypeForVariant(variant) {
  return variant === 'Release' ? 'Release' : 'Debug';
}

function getGradleTasks(options) {
  const buildType = getBuildTypeForVariant(options.variant);

  return [
    '--no-parallel',
    ...(options.clean ? ['clean'] : []),
    `:shopify_react-native-skia:prefab${buildType}Package`,
    `:app:assemble${options.variant}`,
    ...options.gradleArgs,
  ];
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_:.=,+@%/\\-]+$/.test(value)) {
    return value;
  }

  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function runGradle(tasks, env) {
  const gradleWrapper = path.join(
    androidRoot,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );

  if (!pathExists(gradleWrapper)) {
    throw new Error(`Gradle wrapper not found: ${gradleWrapper}`);
  }

  if (process.platform === 'win32') {
    const command = ['gradlew.bat', ...tasks].map(quoteCmdArg).join(' ');
    return spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
      cwd: androidRoot,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
  }

  return spawnSync(gradleWrapper, tasks, {
    cwd: androidRoot,
    env,
    stdio: 'inherit',
  });
}

function collectApks(targetDirectory) {
  if (!pathExists(targetDirectory)) {
    return [];
  }

  const entries = fs.readdirSync(targetDirectory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      return collectApks(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.apk') ? [entryPath] : [];
  });
}

function resolveApkFromMetadata(outputDirectory) {
  const metadataPath = path.join(outputDirectory, 'output-metadata.json');
  if (!pathExists(metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const outputFile = metadata?.elements?.[0]?.outputFile;
    if (!outputFile) {
      return null;
    }

    const apkPath = path.join(outputDirectory, outputFile);
    return pathExists(apkPath) ? apkPath : null;
  } catch {
    return null;
  }
}

function findBuiltApk(variant) {
  const variantDirectoryName = getVariantDirectoryName(variant);
  const outputDirectory = path.join(
    androidRoot,
    'app',
    'build',
    'outputs',
    'apk',
    variantDirectoryName,
  );
  const metadataApk = resolveApkFromMetadata(outputDirectory);
  if (metadataApk) {
    return metadataApk;
  }

  const apks = collectApks(outputDirectory)
    .map((apkPath) => ({
      apkPath,
      modifiedAt: fs.statSync(apkPath).mtimeMs,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);

  return apks[0]?.apkPath ?? null;
}

function resolveApiUrlForBuild(options = {}) {
  return (
    options.apiUrl ||
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.FITTRACK_MOBILE_API_URL ||
    process.env.FITTRACK_LOCAL_API_URL ||
    null
  );
}

function buildAndroidEnv(options) {
  const env = { ...ensureAndroidSdkConfig() };
  const apiUrl = resolveApiUrlForBuild(options);

  env.EXPO_NO_METRO_WORKSPACE_ROOT = env.EXPO_NO_METRO_WORKSPACE_ROOT || '1';

  if (apiUrl) {
    env.EXPO_PUBLIC_API_URL = apiUrl;
  }

  return env;
}

function printBuildSummary(options, tasks, env) {
  const variantDirectoryName = getVariantDirectoryName(options.variant);
  const apiUrl = env.EXPO_PUBLIC_API_URL ?? 'app default: https://api-production-388f.up.railway.app/v1';
  const releaseManifestPath = path.join(androidRoot, 'app', 'src', 'release', 'AndroidManifest.xml');
  const releaseCleartextEnabled =
    pathExists(releaseManifestPath) &&
    fs.readFileSync(releaseManifestPath, 'utf8').includes('android:usesCleartextTraffic="true"');

  console.log(`[fittrack-mobile-apk] Variant: ${variantDirectoryName}`);
  console.log(`[fittrack-mobile-apk] Gradle tasks: ${tasks.join(' ')}`);
  console.log(`[fittrack-mobile-apk] API URL: ${apiUrl}`);
  console.log(`[fittrack-mobile-apk] Metro workspace root: ${env.EXPO_NO_METRO_WORKSPACE_ROOT === '1' ? 'disabled' : 'enabled'}`);
  console.log(`[fittrack-mobile-apk] Device install: ${options.install ? 'enabled' : 'skipped'}`);
  if (options.install && (options.deviceSerial || process.env.ANDROID_SERIAL)) {
    console.log(`[fittrack-mobile-apk] Device serial: ${options.deviceSerial || process.env.ANDROID_SERIAL}`);
  }

  if (options.variant === 'Release' && !String(apiUrl).startsWith('https://') && releaseCleartextEnabled) {
    console.warn(
      '[fittrack-mobile-apk] Release local HTTP cleartext is enabled for USB/local API testing.',
    );
  } else if (options.variant === 'Release' && !String(apiUrl).startsWith('https://')) {
    console.warn(
      '[fittrack-mobile-apk] Release APKs should use an HTTPS deployed/staging API unless release cleartext traffic is configured.',
    );
  }
}

function copyApkToArtifacts(apkPath, variant) {
  const variantDirectoryName = getVariantDirectoryName(variant);
  const targetPath = path.join(artifactRoot, `FitTrack-${variantDirectoryName}.apk`);

  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.copyFileSync(apkPath, targetPath);

  return targetPath;
}

function getAdbTargetArgs(options) {
  const serial = options.deviceSerial || process.env.ANDROID_SERIAL;
  return serial ? ['-s', serial] : [];
}

function maybeReverseLocalApiPort(adbPath, options, apiUrl) {
  let parsedApiUrl;

  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    return;
  }

  if (!['127.0.0.1', 'localhost'].includes(parsedApiUrl.hostname) || !parsedApiUrl.port) {
    return;
  }

  const targetArgs = getAdbTargetArgs(options);
  const port = parsedApiUrl.port;
  const result = spawnSync(
    adbPath,
    [...targetArgs, 'reverse', `tcp:${port}`, `tcp:${port}`],
    {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
    },
  );

  if (result.status === 0) {
    console.log(`[fittrack-mobile-apk] adb reverse ready: tcp:${port} -> tcp:${port}`);
    return;
  }

  const details = result.stderr?.trim() || result.stdout?.trim() || 'adb reverse failed';
  console.warn(`[fittrack-mobile-apk] Could not prime adb reverse for local API: ${details}`);
}

function installApkOnDevice(apkPath, options, apiUrl) {
  const adbPath = detectAdbPath();
  if (!adbPath) {
    throw new Error('adb not found. Install Android platform tools or set ANDROID_HOME/ANDROID_SDK_ROOT.');
  }

  maybeReverseLocalApiPort(adbPath, options, apiUrl);

  const targetArgs = getAdbTargetArgs(options);
  const installResult = spawnSync(
    adbPath,
    [...targetArgs, 'install', '-r', '-d', apkPath],
    {
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  if (installResult.status !== 0) {
    throw new Error('adb install failed.');
  }

  console.log('[fittrack-mobile-apk] APK installed on device.');
}

let options;

try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  console.error(`[fittrack-mobile-apk] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

const tasks = getGradleTasks(options);

if (options.dryRun) {
  const env = {
    ...process.env,
    EXPO_NO_METRO_WORKSPACE_ROOT: process.env.EXPO_NO_METRO_WORKSPACE_ROOT || '1',
    ...(resolveApiUrlForBuild(options) ? { EXPO_PUBLIC_API_URL: resolveApiUrlForBuild(options) } : {}),
  };
  printBuildSummary(options, tasks, env);
  process.exit(0);
}

const shortDriveStatus = maybeRerunFromShortDrive();
if (shortDriveStatus !== null) {
  process.exit(shortDriveStatus);
}

cleanGeneratedNativeOutputs();
const androidEnv = buildAndroidEnv(options);
warnAboutLongWindowsPaths();
printBuildSummary(options, tasks, androidEnv);

let result;

try {
  result = runGradle(tasks, androidEnv);
} catch (error) {
  console.error(`[fittrack-mobile-apk] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const apkPath = findBuiltApk(options.variant);
if (!apkPath) {
  console.error('[fittrack-mobile-apk] Gradle finished, but no APK output was found.');
  process.exit(1);
}

console.log(`[fittrack-mobile-apk] APK built: ${apkPath}`);

if (options.copy) {
  const artifactPath = copyApkToArtifacts(apkPath, options.variant);
  console.log(`[fittrack-mobile-apk] Copied APK: ${artifactPath}`);
}

if (options.install) {
  try {
    installApkOnDevice(apkPath, options, androidEnv.EXPO_PUBLIC_API_URL ?? resolveApiUrlForBuild(options));
  } catch (error) {
    console.error(`[fittrack-mobile-apk] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
