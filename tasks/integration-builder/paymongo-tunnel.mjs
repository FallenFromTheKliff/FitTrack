import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const artifactsDir = path.join(repoRoot, '.artifacts');
const artifactPath = path.join(artifactsDir, 'paymongo-tunnel.json');
const apiHealthUrl = 'http://127.0.0.1:3001/v1/health';
const localTunnelVersion = '2.0.2';

loadEnvFile(path.join(repoRoot, '.env'));
loadEnvFile(path.join(repoRoot, '.env.docker'));

const subdomain = process.env.PAYMONGO_TUNNEL_SUBDOMAIN?.trim();

if (!subdomain) {
  fail(
    'Missing PAYMONGO_TUNNEL_SUBDOMAIN. Add it to .env or .env.docker, then rerun `pnpm dev:stack:paymongo:tunnel`.',
  );
}

const apiHealthy = await checkApiHealth(apiHealthUrl);

if (!apiHealthy.ok) {
  fail(
    [
      'API health check failed.',
      `- Checked: ${apiHealthUrl}`,
      `- Reason: ${apiHealthy.reason}`,
      '- Start or fix the API first, then rerun `pnpm dev:stack:paymongo:tunnel`.',
    ].join('\n'),
  );
}

const localTunnelPackage = await loadLocalTunnelPackage();

console.log('PayMongo Tunnel');
console.log(`- Requested subdomain: ${subdomain}`);
console.log(`- Target API health: ${apiHealthUrl}`);
console.log(`- Launch mode: ${localTunnelPackage ? 'repo package' : 'npx fallback'}`);

if (localTunnelPackage) {
  await runPackageTunnel(localTunnelPackage);
} else {
  console.log(
    `- Note: localtunnel is declared in package.json, but no local package is installed yet. Falling back to \`npx --yes localtunnel@${localTunnelVersion} --port 3001 --subdomain ${subdomain}\`. Run \`pnpm install\` later to make this fully repo-managed.`,
  );
  await runNpxFallback();
}

async function checkApiHealth(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadLocalTunnelPackage() {
  try {
    const module = await import('localtunnel');
    return module.default ?? module;
  } catch {
    return null;
  }
}

async function runPackageTunnel(openTunnel) {
  let tunnel;

  try {
    tunnel = await openTunnel({ port: 3001, subdomain });
  } catch (error) {
    fail(`Unable to start LocalTunnel: ${error.message}`);
  }

  announceTunnelUrl(tunnel.url);

  await new Promise((resolve) => {
    tunnel.once('close', resolve);
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        tunnel.close();
      });
    }
  });
}

async function runNpxFallback() {
  const { command, args } = buildSpawnCommand(getNpxCommand(), [
    '--yes',
    `localtunnel@${localTunnelVersion}`,
    '--port',
    '3001',
    '--subdomain',
    subdomain,
  ]);

  let child;

  try {
    child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
  } catch (error) {
    fail(`Unable to start LocalTunnel: ${error.message}`);
  }

  let childExited = false;
  let tunnelUrl = null;
  let stdoutBuffer = '';

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    stdoutBuffer += chunk;
    const match = stdoutBuffer.match(/your url is:\s*(https?:\/\/\S+)/i);
    if (!match) {
      return;
    }

    const resolvedUrl = match[1].trim();
    if (tunnelUrl === resolvedUrl) {
      return;
    }

    tunnelUrl = resolvedUrl;
    announceTunnelUrl(resolvedUrl);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  child.on('error', (error) => {
    childExited = true;
    fail(`Unable to start LocalTunnel: ${error.message}`);
  });

  await new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      childExited = true;

      if (!signal && code !== 0 && !tunnelUrl) {
        console.error('');
        console.error(
          [
            'LocalTunnel exited before providing a public URL.',
            `- Requested subdomain: ${subdomain}`,
            '- If the subdomain is unavailable, choose a new PAYMONGO_TUNNEL_SUBDOMAIN and rerun the command.',
          ].join('\n'),
        );
      }

      process.exitCode = signal ? 1 : code ?? 1;
      resolve();
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        if (!childExited) {
          child.kill(signal);
        }
      });
    }
  });
}

function announceTunnelUrl(resolvedUrl) {
  const webhookUrl = `${resolvedUrl}/v1/payments/webhook`;
  writeArtifact({
    generatedAt: new Date().toISOString(),
    provider: 'localtunnel',
    targetPort: 3001,
    subdomain,
    publicUrl: resolvedUrl,
    paymongoWebhookUrl: webhookUrl,
    healthUrl: apiHealthUrl,
  });

  console.log('');
  console.log('PayMongo Webhook Setup');
  console.log(`- Public tunnel URL: ${resolvedUrl}`);
  console.log(`- Webhook URL to paste into PayMongo: ${webhookUrl}`);
  console.log(`- Artifact written to: ${path.relative(repoRoot, artifactPath)}`);
  console.log('- Keep this process running while PayMongo needs the tunnel.');
}

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function buildSpawnCommand(command, args) {
  if (process.platform !== 'win32') {
    return { command, args };
  }

  const rendered = [quoteWindowsArg(command), ...args.map(quoteWindowsArg)].join(' ');
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', rendered],
  };
}

function quoteWindowsArg(value) {
  if (!value) {
    return '""';
  }

  const escaped = value.replace(/"/g, '\\"');
  return /[\s"]/u.test(value) ? `"${escaped}"` : escaped;
}

function writeArtifact(payload) {
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
