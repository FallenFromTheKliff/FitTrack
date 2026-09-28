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
Reset FitTrack Redis state for local development.

Usage:
  node scripts/reset-redis-cache.mjs [options]

Options:
  --scope=auth|all        auth removes login timers; all flushes the selected database. Default: all
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

function resolveRedisUrl() {
  return (
    process.env.REDIS_URL?.trim() ||
    buildRedisUrl({
      host: process.env.REDIS_HOST || '127.0.0.1',
      password: process.env.REDIS_PASSWORD,
      port: process.env.REDIS_PORT || '6379',
    })
  );
}

function assertResetAllowed(redisUrl) {
  const parsed = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
    throw new Error('Redis URL must use redis:// or rediss://.');
  }

  if (!LOCAL_REDIS_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `Refusing local Redis reset for non-local host "${parsed.hostname}".`,
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

  const scope = getFlag(argv, 'scope') || 'all';

  if (!['auth', 'all'].includes(scope)) {
    throw new Error('--scope must be auth or all.');
  }

  const redisUrl = resolveRedisUrl();
  const parsed = assertResetAllowed(redisUrl);
  const database = parsed.pathname.replace(/^\//, '') || '0';
  const redis = new Redis(redisUrl, {
    connectTimeout: 10_000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  console.log(
    `[redis-reset] target=local scope=${scope} host=${parsed.hostname} db=${database}`,
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
