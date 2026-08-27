import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_RESEED_USERS = 180;
export const RAILWAY_RESET_CONFIRMATION = "RESET_RAILWAY_DATABASE";
export const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/fittrackdb";
export const DEFAULT_LOCAL_POSTGRES_CONTAINER = "fittrack-db-local";
export const PUBLIC_DATABASE_RUNNER =
  "tasks/run-with-railway-public-database.mjs";
export const SNAPSHOT_TASK = "tasks/reseed-railway-snapshot.mjs";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const REMOTE_HOSTNAME_PATTERN = /^[a-z0-9-]+\.proxy\.rlwy\.net$/i;
export const DEFAULT_LOCAL_CONTAINER_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/fittrackdb";

const ATOMIC_RESTORE_CONSTRAINTS = [
  {
    table: "public.exercise_catalog",
    name: "exercise_catalog_movement_family_id_fkey",
  },
  {
    table: "public.exercise_movement_families",
    name: "exercise_movement_families_canonical_exercise_id_fkey",
  },
  {
    table: "public.refresh_tokens",
    name: "refresh_tokens_rotated_from_fkey",
  },
];

function runtimeDockerCommand() {
  return process.platform === "win32" ? "docker.exe" : "docker";
}

function optionValue(args, names, fallback) {
  for (const name of names) {
    const prefixes = [`--${name}=`, `--${name}:`];
    const inline = args.find((arg) =>
      prefixes.some((prefix) => arg.startsWith(prefix)),
    );
    if (inline) {
      const prefix = prefixes.find((candidate) => inline.startsWith(candidate));
      return inline.slice(prefix.length);
    }

    const index = args.indexOf(`--${name}`);
    if (index >= 0 && args[index + 1] !== undefined) {
      return args[index + 1];
    }
  }

  return fallback;
}

function hasFlag(args, ...names) {
  return names.some((name) => args.includes(`--${name}`));
}

export function parseSnapshotOptions(args = process.argv.slice(2)) {
  const environment = optionValue(
    args,
    ["environment", "environment-name"],
    "production",
  );
  const usersValue = optionValue(
    args,
    ["users", "seed-users", "seed_users"],
    `${DEFAULT_RESEED_USERS}`,
  );
  const users = Number.parseInt(usersValue, 10);
  const localDatabaseUrl = optionValue(
    args,
    ["local-database-url"],
    process.env.FITTRACK_LOCAL_DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL,
  );
  const containerDatabaseUrl = optionValue(
    args,
    ["local-container-database-url"],
    process.env.FITTRACK_LOCAL_CONTAINER_DATABASE_URL ??
      DEFAULT_LOCAL_CONTAINER_DATABASE_URL,
  );
  const container = optionValue(
    args,
    ["local-postgres-container"],
    process.env.FITTRACK_LOCAL_POSTGRES_CONTAINER ??
      DEFAULT_LOCAL_POSTGRES_CONTAINER,
  );
  const dumpPath = optionValue(args, ["dump-path"], undefined);

  return {
    confirm: optionValue(args, ["confirm"], undefined),
    container,
    containerDatabaseUrl,
    dumpPath,
    environment,
    help: hasFlag(args, "help", "h"),
    localDatabaseUrl,
    preflightOnly: hasFlag(args, "preflight-only"),
    restoreOnly: hasFlag(args, "restore-only"),
    users,
  };
}

export function validateSnapshotOptions(options) {
  if (options.help) {
    return;
  }

  if (options.preflightOnly && options.restoreOnly) {
    throw new Error(
      "--preflight-only and --restore-only cannot be used together.",
    );
  }

  if (options.confirm !== RAILWAY_RESET_CONFIRMATION) {
    throw new Error(
      `Destructive reseed requires --confirm:${RAILWAY_RESET_CONFIRMATION}.`,
    );
  }

  if (
    !Number.isSafeInteger(options.users) ||
    options.users < 11 ||
    options.users > 10_000
  ) {
    throw new Error("--users must be an integer from 11 to 10000.");
  }

  if (!options.environment || /[\s/\\]/.test(options.environment)) {
    throw new Error(
      "--environment must be a non-empty Railway environment name.",
    );
  }

  if (!options.container || /[\s/\\]/.test(options.container)) {
    throw new Error(
      "--local-postgres-container must be a simple container name.",
    );
  }

  assertLocalDatabaseUrl(options.localDatabaseUrl);
  assertLocalDatabaseUrl(options.containerDatabaseUrl);

  if (options.restoreOnly && !options.dumpPath) {
    throw new Error("--restore-only requires --dump-path.");
  }
}

export function assertLocalDatabaseUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("The local database URL is invalid.");
  }

  if (!LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      "The local database URL must use localhost, 127.0.0.1, or ::1.",
    );
  }
}

export function assertPublicDatabaseUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("The Railway public database URL is invalid.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !REMOTE_HOSTNAME_PATTERN.test(hostname)
  ) {
    throw new Error(
      "The restore target must be Railway's public Postgres proxy URL.",
    );
  }
}

export function buildLocalSeedCommand({
  nodeExecutable = process.execPath,
  users,
}) {
  return {
    args: [
      "tasks/seed-realistic.mjs",
      "--target=local",
      "--mode=reset",
      `--users=${users}`,
    ],
    command: nodeExecutable,
  };
}

export function buildDumpCommand({
  container = DEFAULT_LOCAL_POSTGRES_CONTAINER,
  containerDatabaseUrl = DEFAULT_LOCAL_CONTAINER_DATABASE_URL,
  dockerCommand = "docker",
}) {
  return {
    args: [
      "exec",
      container,
      "pg_dump",
      "--format=custom",
      "--data-only",
      "--no-owner",
      "--no-privileges",
      "--exclude-table=public._prisma_migrations",
      `--dbname=${containerDatabaseUrl}`,
    ],
    command: dockerCommand,
  };
}

export function buildDumpValidationCommand({
  container = DEFAULT_LOCAL_POSTGRES_CONTAINER,
  dockerCommand = "docker",
}) {
  return {
    args: ["exec", "-i", container, "pg_restore", "--list"],
    command: dockerCommand,
  };
}

export function buildPlainSqlCommand({
  container = DEFAULT_LOCAL_POSTGRES_CONTAINER,
  dockerCommand = "docker",
}) {
  return {
    args: [
      "exec",
      "-i",
      container,
      "pg_restore",
      "--data-only",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--file=-",
    ],
    command: dockerCommand,
  };
}

export function buildRemoteRestoreCommand({
  dumpPath,
  environment = "production",
  railwayCommand = "railway",
}) {
  return {
    args: [
      "run",
      "--service",
      "Postgres",
      "--environment",
      environment,
      "--no-local",
      "node",
      PUBLIC_DATABASE_RUNNER,
      "node",
      SNAPSHOT_TASK,
      "--restore-only",
      "--dump-path",
      dumpPath,
      `--confirm=${RAILWAY_RESET_CONFIRMATION}`,
    ],
    command: railwayCommand,
  };
}

export function buildAtomicRestoreCommand({
  container = DEFAULT_LOCAL_POSTGRES_CONTAINER,
  databaseUrl,
  dockerCommand = "docker",
}) {
  return {
    args: [
      "exec",
      "-i",
      container,
      "psql",
      "--single-transaction",
      "--set=ON_ERROR_STOP=1",
      "--dbname",
      databaseUrl,
    ],
    command: dockerCommand,
  };
}

export function buildTruncateSql() {
  return `
DO $$
DECLARE
  table_list text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO table_list
    FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename <> '_prisma_migrations';

  IF table_list IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;
`;
}

function commandLabel(command, args) {
  return [command, ...args]
    .map((arg, index, values) => {
      const previous = values[index - 1];
      if (
        previous === "--dbname" ||
        String(arg).startsWith("--dbname=") ||
        String(arg).includes("DATABASE_URL")
      ) {
        return "<database-url>";
      }
      return String(arg);
    })
    .join(" ");
}

function runChecked({
  command,
  args,
  env,
  inputFd,
  outputFd,
  label,
  prefixArgs = [],
}) {
  console.log(`[seed-snapshot] ${label ?? commandLabel(command, args)}`);
  const result = spawnSync(command, [...prefixArgs, ...args], {
    cwd: process.cwd(),
    env,
    shell: false,
    stdio:
      inputFd === undefined && outputFd === undefined
        ? "inherit"
        : [inputFd ?? "ignore", outputFd ?? "inherit", "inherit"],
  });

  if (result.error) {
    throw new Error(
      `${label ?? command} could not start: ${result.error.message}`,
    );
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `${label ?? command} failed with exit code ${result.status ?? 1}.`,
    );
  }
}

export function resolveRailwayInvocation({
  appData = process.env.APPDATA,
  exists = existsSync,
  executablePath = process.execPath,
  pathValue = process.env.PATH,
  platform = process.platform,
} = {}) {
  if (platform !== "win32") {
    return { command: "railway", prefixArgs: [], shell: false };
  }

  const searchDirectories = [
    ...(pathValue ?? "").split(platform === "win32" ? ";" : path.delimiter),
    appData ? path.join(appData, "npm") : undefined,
  ].filter(Boolean);
  const executable = searchDirectories
    .map((directory) => path.join(directory, "railway.exe"))
    .find((candidate) => exists(candidate));
  if (executable) {
    return { command: executable, prefixArgs: [], shell: false };
  }

  const commandShim = searchDirectories
    .map((directory) => path.join(directory, "railway.cmd"))
    .find((candidate) => exists(candidate));
  if (commandShim) {
    const cliEntry = path.join(
      path.dirname(commandShim),
      "node_modules",
      "@railway",
      "cli",
      "bin",
      "railway.js",
    );
    if (exists(cliEntry)) {
      return {
        command: executablePath,
        prefixArgs: [cliEntry],
        shell: false,
      };
    }
  }

  throw new Error(
    "Could not resolve a shell-free Railway CLI executable on Windows.",
  );
}

export function buildLocalSeedEnvironment(databaseUrl) {
  const env = { ...process.env };
  delete env.DATABASE_PUBLIC_URL;
  delete env.DATABASE_PRIVATE_URL;
  delete env.PGHOST;
  delete env.PGPORT;
  delete env.PGDATABASE;
  delete env.PGUSER;
  delete env.PGPASSWORD;
  env.DATABASE_URL = databaseUrl;
  return env;
}

function printHelp() {
  console.log(`
Create a local realistic seed snapshot and restore it to Railway Postgres.

Usage:
  node tasks/reseed-railway-snapshot.mjs --confirm:${RAILWAY_RESET_CONFIRMATION}

Options:
  --environment:<name>             Railway environment (default: production)
  --users:<count>                  Seed users (default: ${DEFAULT_RESEED_USERS})
  --local-database-url:<url>       Local Postgres URL (localhost only)
  --local-container-database-url:<url>
                                   In-container Postgres URL (default: localhost:5432)
  --local-postgres-container:<id>  Existing PostgreSQL 16 Docker container
  --preflight-only                 Run the local restore preflight without Railway
  --restore-only --dump-path:<p>   Internal public-proxy SQL restore script
  --confirm:${RAILWAY_RESET_CONFIRMATION}
`);
}

function assertSnapshotFile(dumpPath) {
  if (!dumpPath || !existsSync(dumpPath)) {
    throw new Error(
      `Seed snapshot does not exist: ${dumpPath ?? "<missing>"}.`,
    );
  }

  const file = openSync(dumpPath, "r");
  let size;
  try {
    size = fstatSync(file).size;
  } finally {
    closeSync(file);
  }
  if (size <= 0) {
    throw new Error("Seed snapshot is empty.");
  }
}

function validateSnapshotLocally({ container, dumpPath }) {
  const inputFd = openSync(dumpPath, "r");
  try {
    const command = buildDumpValidationCommand({
      container,
      dockerCommand: runtimeDockerCommand(),
    });
    runChecked({
      args: command.args,
      command: command.command,
      inputFd,
      label: "validate PostgreSQL 16 seed snapshot",
    });
  } finally {
    closeSync(inputFd);
  }
}

function createDumpWithRedirect({ container, containerDatabaseUrl, dumpPath }) {
  const outputFd = openSync(dumpPath, "w");
  try {
    const command = buildDumpCommand({
      container,
      containerDatabaseUrl,
      dockerCommand: runtimeDockerCommand(),
    });
    console.log("[seed-snapshot] create PostgreSQL 16 data-only snapshot");
    const result = spawnSync(command.command, command.args, {
      cwd: process.cwd(),
      shell: false,
      stdio: ["ignore", outputFd, "inherit"],
    });
    if (result.error) {
      throw new Error(`pg_dump could not start: ${result.error.message}`);
    }
    if ((result.status ?? 1) !== 0) {
      throw new Error(`pg_dump failed with exit code ${result.status ?? 1}.`);
    }
  } finally {
    closeSync(outputFd);
  }
}

function normalizeDataSql(dataSql) {
  const lines = dataSql.split(/\r?\n/);
  const beginIndex = lines.findIndex((line) => line.trim() === "BEGIN;");
  if (beginIndex >= 0) {
    lines.splice(beginIndex, 1);
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() === "COMMIT;") {
      lines.splice(index, 1);
      break;
    }
  }
  return lines
    .join("\n")
    .trim()
    .replaceAll(
      "SELECT pg_catalog.set_config('search_path', '', false);",
      "SELECT pg_catalog.set_config('search_path', 'pg_catalog, public', false);",
    );
}

function buildAtomicRestoreConstraintSql(modifier) {
  return ATOMIC_RESTORE_CONSTRAINTS.map(
    ({ table, name }) =>
      `ALTER TABLE ${table} ALTER CONSTRAINT ${name} ${modifier};`,
  ).join("\n");
}

export function buildAtomicRestoreScript(dataSql) {
  return [
    buildAtomicRestoreConstraintSql("DEFERRABLE INITIALLY DEFERRED"),
    "SET CONSTRAINTS ALL DEFERRED;",
    "ALTER TABLE public.coach_profiles DISABLE TRIGGER coach_profiles_specialization_sync;",
    buildTruncateSql().trim(),
    normalizeDataSql(dataSql),
    "SET CONSTRAINTS ALL IMMEDIATE;",
    "ALTER TABLE public.coach_profiles ENABLE TRIGGER coach_profiles_specialization_sync;",
    buildAtomicRestoreConstraintSql("NOT DEFERRABLE"),
    "",
  ].join("\n");
}

function createPlainDataSql({ container, dumpPath, dataSqlPath }) {
  const inputFd = openSync(dumpPath, "r");
  const outputFd = openSync(dataSqlPath, "w");
  try {
    const command = buildPlainSqlCommand({
      container,
      dockerCommand: runtimeDockerCommand(),
    });
    runChecked({
      args: command.args,
      command: command.command,
      inputFd,
      outputFd,
      label: "convert validated snapshot to plain data SQL",
    });
  } finally {
    closeSync(inputFd);
    closeSync(outputFd);
  }
}

function createAtomicRestoreScriptFile({ dataSqlPath, restoreScriptPath }) {
  const dataSql = readFileSync(dataSqlPath, "utf8");
  writeFileSync(restoreScriptPath, buildAtomicRestoreScript(dataSql), "utf8");
}

function restoreSnapshot({
  container,
  databaseUrl,
  restoreScriptPath,
  label = "restore Railway snapshot atomically through public proxy",
}) {
  const restore = buildAtomicRestoreCommand({
    container,
    databaseUrl,
    dockerCommand: runtimeDockerCommand(),
  });
  const inputFd = openSync(restoreScriptPath, "r");
  try {
    runChecked({
      args: restore.args,
      command: restore.command,
      inputFd,
      label,
    });
  } finally {
    closeSync(inputFd);
  }
}

function runRestoreOnly(options) {
  validateSnapshotOptions(options);
  assertPublicDatabaseUrl(process.env.DATABASE_URL);
  assertSnapshotFile(options.dumpPath);
  restoreSnapshot({
    container: options.container,
    databaseUrl: process.env.DATABASE_URL,
    restoreScriptPath: options.dumpPath,
  });
}

function runLocalSnapshot(options) {
  validateSnapshotOptions(options);
  const tempDirectory = mkdtempSync(
    path.join(os.tmpdir(), "fittrack-railway-reseed-"),
  );
  const dumpPath = path.join(tempDirectory, "fittrack-data.dump");
  const dataSqlPath = path.join(tempDirectory, "fittrack-data.sql");
  const restoreScriptPath = path.join(tempDirectory, "fittrack-restore.sql");
  try {
    const seed = buildLocalSeedCommand({ users: options.users });
    runChecked({
      args: seed.args,
      command: seed.command,
      env: buildLocalSeedEnvironment(options.localDatabaseUrl),
      label: `seed local Postgres with ${options.users} users`,
    });

    createDumpWithRedirect({
      container: options.container,
      containerDatabaseUrl: options.containerDatabaseUrl,
      dumpPath,
    });
    assertSnapshotFile(dumpPath);
    validateSnapshotLocally({ container: options.container, dumpPath });
    createPlainDataSql({
      container: options.container,
      dataSqlPath,
      dumpPath,
    });
    assertSnapshotFile(dataSqlPath);
    createAtomicRestoreScriptFile({ dataSqlPath, restoreScriptPath });
    restoreSnapshot({
      container: options.container,
      databaseUrl: options.containerDatabaseUrl,
      restoreScriptPath,
      label: "preflight restore atomic snapshot into local PostgreSQL 16",
    });
    if (options.preflightOnly) {
      console.log(
        "[seed-snapshot] preflight-only mode: Railway restore skipped",
      );
      return;
    }

    const remote = buildRemoteRestoreCommand({
      dumpPath: restoreScriptPath,
      environment: options.environment,
    });
    const railway = resolveRailwayInvocation();
    runChecked({
      args: remote.args,
      command: railway.command,
      prefixArgs: railway.prefixArgs,
      label: "restore snapshot through Railway public Postgres proxy",
    });
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
}

export function runSnapshot(args = process.argv.slice(2)) {
  const options = parseSnapshotOptions(args);
  if (options.help) {
    printHelp();
    return;
  }
  if (options.restoreOnly) {
    runRestoreOnly(options);
    return;
  }
  runLocalSnapshot(options);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    runSnapshot();
  } catch (error) {
    console.error(
      `[seed-snapshot] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
