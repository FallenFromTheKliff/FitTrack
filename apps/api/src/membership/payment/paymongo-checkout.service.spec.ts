import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaymongoCheckoutService } from './paymongo-checkout.service';

describe('PaymongoCheckoutService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws when required PayMongo config is missing', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn().mockReturnValue(''),
    };
    const service = new PaymongoCheckoutService(config as ConfigService);

    await expect(
      service.createCheckoutSession({
        amount: 149900,
        description: 'Monthly Membership',
        idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        metadata: { payment_id: 'payment-1', subscription_id: 'sub-1' },
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('creates a checkout session and returns the provider reference plus checkout url', async () => {
    const configValues: Record<string, string> = {
      'paymongo.secretKey': 'sk_test_123',
      'paymongo.apiBaseUrl': 'https://api.paymongo.com/v1',
      'paymongo.successUrl': 'https://fittrack.test/payments/success',
      'paymongo.cancelUrl': 'https://fittrack.test/payments/cancel',
      'paymongo.paymentMethodTypes': 'gcash,card',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'cs_test_123',
            attributes: {
              checkout_url: 'https://checkout.paymongo.com/cs_test_123',
              payment_method_types: ['gcash', 'card'],
              reference_number: 'ref_123',
              status: 'active',
            },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new PaymongoCheckoutService(config as ConfigService);
    const result = await service.createCheckoutSession({
      amount: 149900,
      description: 'Monthly Membership',
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      metadata: { payment_id: 'payment-1', subscription_id: 'sub-1' },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const headers = init?.headers as Record<string, string> | undefined;
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      data: {
        attributes: {
          cancel_url: string;
          payment_method_types: string[];
          success_url: string;
        };
      };
    };

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(url).toBe('https://api.paymongo.com/v1/checkout_sessions');
    expect(init?.method).toBe('POST');
    expect(headers?.authorization).toContain('Basic ');
    expect(headers?.['Idempotency-Key']).toBe(
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );
    expect(body.data.attributes.success_url).toBe(
      'https://fittrack.test/payments/success',
    );
    expect(body.data.attributes.cancel_url).toBe(
      'https://fittrack.test/payments/cancel',
    );
    expect(body.data.attributes.payment_method_types).toEqual([
      'gcash',
      'card',
    ]);
    expect(result).toEqual({
      providerRef: 'cs_test_123',
      checkoutUrl: 'https://checkout.paymongo.com/cs_test_123',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_test_123',
        checkout_status: 'active',
        payment_method_types: ['gcash', 'card'],
        reference_number: 'ref_123',
      },
    });
  });

  it('appends caller-provided return context to the configured success and cancel urls', async () => {
    const configValues: Record<string, string> = {
      'paymongo.secretKey': 'sk_test_123',
      'paymongo.apiBaseUrl': 'https://api.paymongo.com/v1',
      'paymongo.successUrl': 'https://fittrack.test/payments/success',
      'paymongo.cancelUrl': 'https://fittrack.test/payments/cancel',
      'paymongo.paymentMethodTypes': 'gcash,card',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'cs_test_123',
            attributes: {
              checkout_url: 'https://checkout.paymongo.com/cs_test_123',
              payment_method_types: ['gcash', 'card'],
              reference_number: 'ref_123',
              status: 'active',
            },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new PaymongoCheckoutService(config as ConfigService);
    await service.createCheckoutSession({
      amount: 149900,
      cancelQuery: { flow: 'membership-card', portal: 'member' },
      description: 'Membership Card',
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      metadata: { membership_card_id: 'card-1', payment_id: 'payment-1' },
      successQuery: { flow: 'membership-card', portal: 'member' },
    });

    const requestBody = JSON.parse(
      String((fetchMock.mock.calls[0] ?? [])[1]?.body ?? '{}'),
    ) as {
      data: {
        attributes: {
          cancel_url: string;
          success_url: string;
        };
      };
    };

    expect(requestBody.data.attributes.success_url).toBe(
      'https://fittrack.test/payments/success?flow=membership-card&portal=member',
    );
    expect(requestBody.data.attributes.cancel_url).toBe(
      'https://fittrack.test/payments/cancel?flow=membership-card&portal=member',
    );
  });
});
