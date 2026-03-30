import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'v1',
  databaseUrl: process.env.DATABASE_URL || '',
}));

// CORRECT — HS256 config
export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || '',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  user: process.env.MAIL_USER || '',
  appPassword: process.env.MAIL_APP_PASSWORD || '',
  fromName: process.env.MAIL_FROM_NAME || 'FitTrack',
  fromAddress: process.env.MAIL_FROM_ADDRESS || 'no-reply@fittrack.com',
}));

export const googleConfig = registerAs('google', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
}));

export const twilioConfig = registerAs('twilio', () => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
}));

export const r2Config = registerAs('r2', () => ({
  accountId: process.env.R2_ACCOUNT_ID || '',
  bucket: process.env.R2_BUCKET || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
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
  requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '10000', 10),
}));
