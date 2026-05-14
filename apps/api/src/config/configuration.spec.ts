import { mailConfig } from './configuration';

describe('mailConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MAIL_USER;
    delete process.env.MAIL_APP_PASSWORD;
    delete process.env.MAIL_PASSWORD;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws during startup when MAIL_USER is missing', () => {
    process.env.MAIL_APP_PASSWORD = 'app-password';

    expect(() => mailConfig()).toThrow(/MAIL_USER/);
  });

  it('throws during startup when no mail password env var is set', () => {
    process.env.MAIL_USER = 'fittrack@example.com';

    expect(() => mailConfig()).toThrow(/MAIL_APP_PASSWORD or MAIL_PASSWORD/);
  });

  it('accepts MAIL_PASSWORD as the app password alias', () => {
    process.env.MAIL_USER = 'fittrack@example.com';
    process.env.MAIL_PASSWORD = 'mail-password';

    expect(mailConfig()).toMatchObject({
      user: 'fittrack@example.com',
      appPassword: 'mail-password',
    });
  });
});
