import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const requireFromApi = createRequire(
  resolve(repositoryRoot, 'apps', 'api', 'package.json'),
);
const { config: loadEnv } = requireFromApi('dotenv');
const Redis = requireFromApi('ioredis');

loadEnv({ path: resolve(repositoryRoot, '.env') });

const REMOTE_RESET_CONFIRMATION = 'RESET_REMOTE_REDIS_CACHE';
const LOCAL_REDIS_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'redis',
  'fittrack-redis',
  'fittrack-redis-local',
]);
const AUTH_CACHE_PATTERNS = [
  'auth:login_attempts:*',
  'auth:login_lock:*',
];

function getFlag(argv, name) {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`
Reset FitTrack Redis state for local development or an explicitly confirmed Railway environment.

Usage:
  node tasks/reset-redis-cache.mjs [options]

Options:
  --target=local|railway  Redis environment to target. Default: local
  --scope=auth|all        auth removes login timers; all flushes the selected database. Default: all
  --allow-remote-reset    Required for Railway
  --confirm=${REMOTE_RESET_CONFIRMATION}
                          Required for Railway
  --help                  Show this help
`.trim());
}

function buildRedisUrl({ host, password, port, username }) {
  const url = new URL(`redis://${host}:${port}`);
  if (username) {
    url.username = username;
  }
  if (password) {
    url.password = password;
  }
  return url.toString();
}

function resolveRedisUrl(target) {
  if (target === 'railway') {
    if (!process.env.REDIS_PUBLIC_URL && !process.env.RAILWAY_ENVIRONMENT_ID) {
      throw new Error(
        'Railway Redis variables are unavailable. Run through `railway run --service Redis` or provide REDIS_PUBLIC_URL.',
      );
    }

    return (
      process.env.REDIS_PUBLIC_URL?.trim() ||
      process.env.REDIS_URL?.trim() ||
      buildRedisUrl({
        host: process.env.REDISHOST || process.env.REDIS_HOST,
        password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD,
        port: process.env.REDISPORT || process.env.REDIS_PORT || '6379',
        username: process.env.REDISUSER,
      })
    );
  }

  return (
    process.env.REDIS_URL?.trim() ||
    buildRedisUrl({
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD,
      port: process.env.REDIS_PORT || '6379',
    })
  );
}

function assertResetAllowed({ argv, redisUrl, target }) {
  const parsed = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
    throw new Error('Redis URL must use redis:// or rediss://.');
  }

  if (target === 'local') {
    if (!LOCAL_REDIS_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error(
        `Refusing local Redis reset for non-local host "${parsed.hostname}".`,
      );
    }
    return parsed;
  }

  if (
    !hasFlag(argv, 'allow-remote-reset') ||
    getFlag(argv, 'confirm') !== REMOTE_RESET_CONFIRMATION
  ) {
    throw new Error(
      `Railway Redis reset requires --allow-remote-reset --confirm=${REMOTE_RESET_CONFIRMATION}.`,
    );
  }

  return parsed;
}

async function deleteMatchingKeys(redis, pattern) {
  let cursor = '0';
  let removed = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      200,
    );
    cursor = nextCursor;

    if (keys.length) {
      removed += await redis.del(...keys);
    }
  } while (cursor !== '0');

  return removed;
}

async function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help')) {
    printHelp();
    return;
  }

  const target = getFlag(argv, 'target') || 'local';
  const scope = getFlag(argv, 'scope') || 'all';

  if (!['local', 'railway'].includes(target)) {
    throw new Error('--target must be local or railway.');
  }
  if (!['auth', 'all'].includes(scope)) {
    throw new Error('--scope must be auth or all.');
  }

  const redisUrl = resolveRedisUrl(target);
  const parsed = assertResetAllowed({ argv, redisUrl, target });
  const database = parsed.pathname.replace(/^\//, '') || '0';
  const redis = new Redis(redisUrl, {
    connectTimeout: 10_000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  console.log(
    `[redis-reset] target=${target} scope=${scope} host=${parsed.hostname} db=${database}`,
  );

  try {
    await redis.connect();

    if (scope === 'all') {
      await redis.flushdb();
      console.log('[redis-reset] selected Redis database cleared');
      return;
    }

    let removed = 0;
    for (const pattern of AUTH_CACHE_PATTERNS) {
      removed += await deleteMatchingKeys(redis, pattern);
    }
    console.log(`[redis-reset] authentication lock keys removed=${removed}`);
  } finally {
    if (redis.status !== 'end') {
      await redis.quit().catch(() => redis.disconnect());
    }
  }
}

main().catch((error) => {
  console.error(`[redis-reset] ${error.message}`);
  process.exitCode = 1;
});
