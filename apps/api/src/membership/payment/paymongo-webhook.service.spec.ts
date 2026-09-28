import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import { PaymongoWebhookService } from './paymongo-webhook.service';

function signPayload(
  secret: string,
  timestamp: string,
  payload: Buffer,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest('hex');
}

describe('PaymongoWebhookService', () => {
  it('throws when webhook verification is not configured', () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) =>
        key === 'paymongo.webhookSecretKey' ? '' : fallback,
      ),
    };
    const service = new PaymongoWebhookService(config as ConfigService);

    expect(() =>
      service.parseAndVerify(
        Buffer.from('{}'),
        't=1700000000,te=signature,li=signature',
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects webhook payloads with an invalid signature', () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'paymongo.webhookSecretKey') return 'whsec_test_123';
        if (key === 'paymongo.webhookToleranceSeconds') return 300;
        return fallback;
      }),
    };
    const service = new PaymongoWebhookService(config as ConfigService);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = Buffer.from(
      JSON.stringify({
        data: {
          id: 'evt_1',
          type: 'event',
          attributes: {
            type: 'checkout_session.payment.paid',
            livemode: false,
            data: {
              id: 'cs_1',
              type: 'checkout_session',
              attributes: {},
            },
            previous_data: {},
          },
        },
      }),
    );

    expect(() =>
      service.parseAndVerify(payload, `t=${timestamp},te=invalid-signature`),
    ).toThrow(ForbiddenException);
  });

  it('parses and verifies a valid test-mode signature', () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'paymongo.webhookSecretKey') return 'whsec_test_123';
        if (key === 'paymongo.webhookToleranceSeconds') return 300;
        return fallback;
      }),
    };
    const service = new PaymongoWebhookService(config as ConfigService);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = Buffer.from(
      JSON.stringify({
        data: {
          id: 'evt_1',
          type: 'event',
          attributes: {
            type: 'checkout_session.payment.paid',
            livemode: false,
            data: {
              id: 'cs_1',
              type: 'checkout_session',
              attributes: {
                checkout_url: 'https://checkout.paymongo.com/cs_1',
              },
            },
            previous_data: {},
          },
        },
      }),
    );
    const signature = signPayload('whsec_test_123', timestamp, payload);

    const event = service.parseAndVerify(
      payload,
      `t=${timestamp},te=${signature}`,
    );

    expect(event.data.id).toBe('evt_1');
    expect(event.data.attributes.data.id).toBe('cs_1');
  });
});
