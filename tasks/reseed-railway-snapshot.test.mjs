import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLocalDatabaseUrl,
  assertPublicDatabaseUrl,
  buildDumpCommand,
  buildDumpValidationCommand,
  buildAtomicRestoreCommand,
  buildAtomicRestoreScript,
  buildLocalSeedCommand,
  buildLocalSeedEnvironment,
  buildPlainSqlCommand,
  buildRemoteRestoreCommand,
  buildTruncateSql,
  DEFAULT_LOCAL_DATABASE_URL,
  DEFAULT_LOCAL_CONTAINER_DATABASE_URL,
  DEFAULT_RESEED_USERS,
  parseSnapshotOptions,
  RAILWAY_RESET_CONFIRMATION,
  resolveRailwayInvocation,
  validateSnapshotOptions,
} from "./reseed-railway-snapshot.mjs";

test("snapshot options default to the 180-user local reset contract", () => {
  const options = parseSnapshotOptions([
    `--confirm=${RAILWAY_RESET_CONFIRMATION}`,
  ]);

  validateSnapshotOptions(options);
  assert.equal(options.users, DEFAULT_RESEED_USERS);
  assert.equal(options.localDatabaseUrl, DEFAULT_LOCAL_DATABASE_URL);
  assert.equal(
    options.containerDatabaseUrl,
    DEFAULT_LOCAL_CONTAINER_DATABASE_URL,
  );
  assert.equal(options.restoreOnly, false);
});

test("snapshot reset requires the explicit Railway confirmation", () => {
  assert.throws(
    () => validateSnapshotOptions(parseSnapshotOptions([])),
    /RESET_RAILWAY_DATABASE/,
  );
  assert.throws(
    () =>
      validateSnapshotOptions(
        parseSnapshotOptions(["--confirm=RESET_REMOTE_DYNAMIC_SEED"]),
      ),
    /RESET_RAILWAY_DATABASE/,
  );
});

test("local seed environment cannot inherit Railway database variables", () => {
  const original = process.env.DATABASE_PUBLIC_URL;
  process.env.DATABASE_PUBLIC_URL = "postgresql://public.example/db";
  try {
    const environment = buildLocalSeedEnvironment(DEFAULT_LOCAL_DATABASE_URL);
    assert.equal(environment.DATABASE_URL, DEFAULT_LOCAL_DATABASE_URL);
    assert.equal(environment.DATABASE_PUBLIC_URL, undefined);
    assert.equal(environment.DATABASE_PRIVATE_URL, undefined);
  } finally {
    if (original === undefined) {
      delete process.env.DATABASE_PUBLIC_URL;
    } else {
      process.env.DATABASE_PUBLIC_URL = original;
    }
  }
});

test("local seed and Docker snapshot use separate host/container URLs", () => {
  const seed = buildLocalSeedCommand({ nodeExecutable: "node", users: 180 });
  assert.deepEqual(seed.args, [
    "tasks/seed-realistic.mjs",
    "--target=local",
    "--mode=reset",
    "--users=180",
  ]);

  const dump = buildDumpCommand({
    container: "fittrack-db-local",
    dockerCommand: "docker",
  });
  assert.equal(dump.command, "docker");
  assert.ok(dump.args.includes("pg_dump"));
  assert.ok(dump.args.includes("--format=custom"));
  assert.ok(dump.args.includes("--data-only"));
  assert.ok(dump.args.includes("--exclude-table=public._prisma_migrations"));
  assert.ok(
    dump.args.includes(`--dbname=${DEFAULT_LOCAL_CONTAINER_DATABASE_URL}`),
  );
  assert.equal(
    dump.args.includes(`--dbname=${DEFAULT_LOCAL_DATABASE_URL}`),
    false,
  );

  const validation = buildDumpValidationCommand({
    container: "fittrack-db-local",
  });
  assert.deepEqual(validation.args, [
    "exec",
    "-i",
    "fittrack-db-local",
    "pg_restore",
    "--list",
  ]);
  const plain = buildPlainSqlCommand({ container: "fittrack-db-local" });
  assert.deepEqual(plain.args.slice(0, 4), [
    "exec",
    "-i",
    "fittrack-db-local",
    "pg_restore",
  ]);
  assert.ok(plain.args.includes("--data-only"));
  assert.ok(plain.args.includes("--file=-"));
});

test("remote restore keeps paths as separate shell-free Railway arguments", () => {
  const restore = buildRemoteRestoreCommand({
    dumpPath: "C:\\Temp Folder\\fittrack-restore.sql",
    environment: "production",
    railwayCommand: "railway",
  });
  assert.equal(restore.command, "railway");
  assert.equal(restore.args[0], "run");
  assert.ok(restore.args.includes("--no-local"));
  assert.ok(
    restore.args.includes("tasks/run-with-railway-public-database.mjs"),
  );
  assert.ok(restore.args.includes("tasks/reseed-railway-snapshot.mjs"));
  assert.equal(restore.args.includes("ssh"), false);
  const pathIndex = restore.args.indexOf("--dump-path");
  assert.equal(
    restore.args[pathIndex + 1],
    "C:\\Temp Folder\\fittrack-restore.sql",
  );
});

test("remote restore preserves migrations and combines clear plus data in one transaction", () => {
  const sql = buildTruncateSql();
  assert.match(sql, /TRUNCATE TABLE/);
  assert.match(sql, /RESTART IDENTITY CASCADE/);
  assert.match(sql, /tablename <> '_prisma_migrations'/);

  const restore = buildAtomicRestoreCommand({
    container: "fittrack-db-local",
    databaseUrl: "postgresql://tramway.proxy.rlwy.net:19998/railway",
  });
  assert.ok(restore.args.includes("psql"));
  assert.ok(restore.args.includes("--single-transaction"));
  assert.ok(restore.args.includes("--set=ON_ERROR_STOP=1"));

  const combined = buildAtomicRestoreScript(
    "BEGIN;\nCOPY public.users (id) FROM stdin;\n1\n\\.\nCOMMIT;\n",
  );
  assert.match(combined, /TRUNCATE TABLE/);
  assert.match(combined, /COPY public\.users/);
  assert.equal(combined.includes("BEGIN;"), false);
  assert.equal(combined.includes("COMMIT;"), false);
});

test("database safety guards reject non-local seed and private restore targets", () => {
  assert.doesNotThrow(() => assertLocalDatabaseUrl(DEFAULT_LOCAL_DATABASE_URL));
  assert.throws(
    () => assertLocalDatabaseUrl("postgresql://db.example/fittrack"),
    /localhost/,
  );
  assert.doesNotThrow(() =>
    assertPublicDatabaseUrl(
      "postgresql://tramway.proxy.rlwy.net:19998/railway",
    ),
  );
  assert.throws(
    () =>
      assertPublicDatabaseUrl(
        "postgresql://postgres.railway.internal:5432/railway",
      ),
    /public Postgres proxy/,
  );
  assert.throws(
    () => assertPublicDatabaseUrl("postgresql://db.example/fittrack"),
    /public Postgres proxy/,
  );
});

test("Windows Railway resolution never falls back to shell quoting", () => {
  const invocation = resolveRailwayInvocation({
    appData: "C:\\Users\\Test User\\AppData\\Roaming",
    executablePath: "C:\\Program Files\\node\\node.exe",
    pathValue: "C:\\Program Files\\Railway",
    platform: "win32",
    exists: (candidate) => candidate.endsWith("Railway\\railway.exe"),
  });
  assert.equal(invocation.command, "C:\\Program Files\\Railway\\railway.exe");
  assert.deepEqual(invocation.prefixArgs, []);
  assert.equal(invocation.shell, false);
});
