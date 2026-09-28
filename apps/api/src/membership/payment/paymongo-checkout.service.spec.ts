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

    const createRequest = fetchMock.mock.calls.at(0) as
      | [RequestInfo | URL, RequestInit?]
      | undefined;
    const createBody = createRequest?.[1]?.body;
    if (typeof createBody !== 'string') {
      throw new Error('Expected the checkout request body to be JSON text.');
    }
    const requestBody = JSON.parse(createBody) as {
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

  it('retrieves the exact checkout session using server-side PayMongo authorization', async () => {
    const configValues: Record<string, string> = {
      'paymongo.secretKey': 'sk_test_123',
      'paymongo.apiBaseUrl': 'https://api.paymongo.com/v1',
      'paymongo.successUrl': 'https://fittrack.test/payments/success',
      'paymongo.cancelUrl': 'https://fittrack.test/payments/cancel',
      'paymongo.paymentMethodTypes': 'card',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'cs_test_paid',
            type: 'checkout_session',
            attributes: {
              metadata: { hold_id: 'hold-1', payment_id: 'payment-1' },
              payments: [
                {
                  id: 'pay_test_paid',
                  type: 'payment',
                  attributes: {
                    amount: 7500,
                    currency: 'PHP',
                    paid_at: 1786676400,
                    status: 'paid',
                  },
                },
              ],
              status: 'paid',
            },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new PaymongoCheckoutService(config as ConfigService);
    await expect(
      service.retrieveCheckoutSession('cs_test_paid'),
    ).resolves.toMatchObject({ id: 'cs_test_paid', type: 'checkout_session' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/checkout_sessions/cs_test_paid',
      expect.objectContaining({ method: 'GET' }),
    );
    const retrieveRequest = fetchMock.mock.calls.at(0) as
      | [RequestInfo | URL, RequestInit?]
      | undefined;
    const requestHeaders = retrieveRequest?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(requestHeaders?.authorization).toContain('Basic ');
  });

  it('expires a checkout session and validates provider closure', async () => {
    const configValues: Record<string, string> = {
      'paymongo.secretKey': 'sk_test_123',
      'paymongo.apiBaseUrl': 'https://api.paymongo.com/v1',
      'paymongo.successUrl': 'https://fittrack.test/payments/success',
      'paymongo.cancelUrl': 'https://fittrack.test/payments/cancel',
      'paymongo.paymentMethodTypes': 'card',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'cs_test_cancel',
            type: 'checkout_session',
            attributes: {
              payment_intent: {
                attributes: { status: 'requires_payment_method' },
              },
              status: 'expired',
            },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new PaymongoCheckoutService(config as ConfigService);
    await expect(
      service.expireCheckoutSession('cs_test_cancel'),
    ).resolves.toEqual({
      id: 'cs_test_cancel',
      paymentIntentStatus: 'requires_payment_method',
      status: 'expired',
      type: 'checkout_session',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/checkout_sessions/cs_test_cancel/expire',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: expect.stringContaining('Basic ') }),
      }),
    );
  });

  it('rejects an unconfirmed checkout closure without exposing provider details', async () => {
    const configValues: Record<string, string> = {
      'paymongo.secretKey': 'sk_test_123',
      'paymongo.apiBaseUrl': 'https://api.paymongo.com/v1',
      'paymongo.successUrl': 'https://fittrack.test/payments/success',
      'paymongo.cancelUrl': 'https://fittrack.test/payments/cancel',
      'paymongo.paymentMethodTypes': 'card',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'cs_other',
            type: 'checkout_session',
            attributes: { status: 'active' },
          },
        }),
        { status: 200 },
      ),
    );

    const service = new PaymongoCheckoutService(config as ConfigService);
    const error = await service
      .expireCheckoutSession('cs_test_cancel')
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 502 });
    expect(JSON.stringify(error)).not.toContain('sk_test_123');
  });
  it('redacts PayMongo provider errors from checkout verification failures', async () => {
    const configValues: Record<string, string> = {
      'paymongo.secretKey': 'sk_test_123',
      'paymongo.apiBaseUrl': 'https://api.paymongo.com/v1',
      'paymongo.successUrl': 'https://fittrack.test/payments/success',
      'paymongo.cancelUrl': 'https://fittrack.test/payments/cancel',
      'paymongo.paymentMethodTypes': 'card',
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback = '') => configValues[key] ?? fallback,
      ),
    };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              detail: 'provider-internal-secret-detail',
              source: { pointer: '/private/provider/path' },
            },
          ],
        }),
        { status: 500 },
      ),
    );

    const service = new PaymongoCheckoutService(config as ConfigService);
    const error = await service
      .retrieveCheckoutSession('cs_test_paid')
      .catch((caught: unknown) => caught);
    const serialized = JSON.stringify(error);

    expect(error).toMatchObject({ status: 502 });
    expect(serialized).not.toContain('provider-internal-secret-detail');
    expect(serialized).not.toContain('/private/provider/path');
    expect(serialized).not.toContain('sk_test_123');
  });
});
