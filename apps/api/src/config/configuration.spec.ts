import { mailConfig } from './configuration';

describe('mailConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_APP_PASSWORD;
    delete process.env.MAIL_PASSWORD;
    delete process.env.MAIL_FROM_NAME;
    delete process.env.MAIL_FROM_ADDRESS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws during startup when no Resend API key env var is set', () => {
    expect(() => mailConfig()).toThrow(
      /RESEND_API_KEY or MAIL_APP_PASSWORD or MAIL_PASSWORD/,
    );
  });

  it('uses RESEND_API_KEY for Resend HTTP delivery', () => {
    process.env.RESEND_API_KEY = 're_test_key';

    expect(mailConfig()).toMatchObject({
      resendApiKey: 're_test_key',
      fromName: 'FitTrack',
      fromAddress: 'no-reply@fittrack.com',
    });
  });

  it('accepts the legacy mail password env var as a deployment-compatible alias', () => {
    process.env.MAIL_APP_PASSWORD = 're_legacy_key';
    process.env.MAIL_FROM_NAME = 'SertFit';
    process.env.MAIL_FROM_ADDRESS = 'no-reply@sertfit-fittrack.live';

    expect(mailConfig()).toMatchObject({
      resendApiKey: 're_legacy_key',
      fromName: 'SertFit',
      fromAddress: 'no-reply@sertfit-fittrack.live',
    });
  });
});
