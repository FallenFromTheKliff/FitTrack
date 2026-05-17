import { registerAs } from '@nestjs/config';
import {
  DEFAULT_R2_MIN_FREE_BYTES,
  DEFAULT_R2_STORAGE_LIMIT_BYTES,
  DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
  parseEnvBoolean,
  parseEnvInteger,
} from './runtime-settings';

type RedisRuntimeConfig = {
  url: string;
  host: string;
  port: number;
  password?: string;
  family: number;
  tlsEnabled: boolean;
};

function buildRedisUrl(config: Omit<RedisRuntimeConfig, 'url'>) {
  const url = new URL(
    `${config.tlsEnabled ? 'rediss' : 'redis'}://${config.host}:${config.port}`,
  );

  if (config.password) {
    url.password = config.password;
  }

  url.searchParams.set('family', String(config.family));
  return url.toString();
}

function resolveRedisConfig(): RedisRuntimeConfig {
  const family = 0;
  const rawRedisUrl = process.env.REDIS_URL?.trim();

  if (rawRedisUrl) {
    let parsed: URL;

    try {
      parsed = new URL(rawRedisUrl);
    } catch {
      throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
    }

    const host = parsed.hostname || 'localhost';
    const tlsEnabled = parsed.protocol === 'rediss:';
    const port = parsed.port
      ? parseEnvInteger(parsed.port, tlsEnabled ? 6380 : 6379)
      : tlsEnabled
        ? 6380
        : 6379;
    const password = parsed.password || undefined;

    return {
      host,
      port,
      password,
      family,
      tlsEnabled,
      url: buildRedisUrl({
        host,
        port,
        password,
        family,
        tlsEnabled,
      }),
    };
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseEnvInteger(process.env.REDIS_PORT, 6379);
  const password = process.env.REDIS_PASSWORD || undefined;
  const tlsEnabled = process.env.REDIS_TLS === 'true';

  return {
    host,
    port,
    password,
    family,
    tlsEnabled,
    url: buildRedisUrl({
      host,
      port,
      password,
      family,
      tlsEnabled,
    }),
  };
}

function requireEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (value?.trim()) {
      return value;
    }
  }

  throw new Error(
    `Missing mail configuration: set ${names.join(
      ' or ',
    )} before starting the API so email OTP delivery can run.`,
  );
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '::',
  apiPrefix: process.env.API_PREFIX || 'v1',
  databaseUrl: process.env.DATABASE_URL || '',
  webAllowedOrigins: process.env.WEB_ALLOWED_ORIGINS || '',
}));

// CORRECT — HS256 config
export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || '',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
}));

export const redisConfig = registerAs('redis', () => resolveRedisConfig());

export const mailConfig = registerAs('mail', () => ({
  resendApiKey: requireEnvValue(
    'RESEND_API_KEY',
    'MAIL_APP_PASSWORD',
    'MAIL_PASSWORD',
  ),
  fromName: process.env.MAIL_FROM_NAME || 'FitTrack',
  fromAddress: process.env.MAIL_FROM_ADDRESS || 'no-reply@fittrack.com',
}));

export const googleConfig = registerAs('google', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
}));

export const r2Config = registerAs('r2', () => ({
  accountId: process.env.R2_ACCOUNT_ID || '',
  bucket: process.env.R2_BUCKET || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
  analyticsApiToken: process.env.R2_ANALYTICS_API_TOKEN || '',
  enforceGuard: parseEnvBoolean(process.env.R2_ENFORCE_UPLOAD_GUARD, false),
  storageLimitBytes: parseEnvInteger(
    process.env.R2_STORAGE_LIMIT_BYTES,
    DEFAULT_R2_STORAGE_LIMIT_BYTES,
  ),
  minFreeBytes: parseEnvInteger(
    process.env.R2_MIN_FREE_BYTES,
    DEFAULT_R2_MIN_FREE_BYTES,
  ),
}));

export const filesConfig = registerAs('files', () => ({
  uploadMaxFileSizeBytes: parseEnvInteger(
    process.env.UPLOAD_MAX_FILE_SIZE_BYTES,
    DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
  ),
}));

export const paymongoConfig = registerAs('paymongo', () => ({
  secretKey: process.env.PAYMONGO_SECRET_KEY || '',
  apiBaseUrl:
    process.env.PAYMONGO_API_BASE_URL || 'https://api.paymongo.com/v1',
  successUrl: process.env.PAYMONGO_SUCCESS_URL || '',
  cancelUrl: process.env.PAYMONGO_CANCEL_URL || '',
  webhookSecretKey: process.env.PAYMONGO_WEBHOOK_SECRET_KEY || '',
  webhookToleranceSeconds: parseInt(
    process.env.PAYMONGO_WEBHOOK_TOLERANCE_SECONDS || '300',
    10,
  ),
  paymentMethodTypes: process.env.PAYMONGO_PAYMENT_METHOD_TYPES || 'gcash,card',
}));

export const aiConfig = registerAs('ai', () => ({
  apiBaseUrl: process.env.AI_API_BASE_URL || '',
  requestTimeoutMs: parseEnvInteger(process.env.AI_REQUEST_TIMEOUT_MS, 60000),
}));

export const equipmentDetectionConfig = registerAs('equipmentDetection', () => ({
  provider: process.env.EQUIPMENT_DETECTION_PROVIDER || '',
  requestTimeoutMs: parseEnvInteger(
    process.env.EQUIPMENT_DETECTION_REQUEST_TIMEOUT_MS,
    5000,
  ),
  roboflowApiBaseUrl:
    process.env.ROBOFLOW_API_BASE_URL || 'https://serverless.roboflow.com',
  roboflowApiKey: process.env.ROBOFLOW_API_KEY || '',
  roboflowModelId: process.env.ROBOFLOW_MODEL_ID || '',
}));
