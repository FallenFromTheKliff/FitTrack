import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PAYMONGO_CURRENCY = 'PHP';
const PAYMONGO_REQUEST_TIMEOUT_MS = 10_000;

interface PaymongoCheckoutSessionResponse {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      checkout_url?: string;
      line_items?: Array<{
        amount?: number;
        currency?: string;
        quantity?: number;
      }>;
      metadata?: Record<string, unknown> | null;
      paid_at?: number | null;
      payment_method_used?: string | null;
      payments?: Array<{
        id?: string;
        type?: string;
        attributes?: {
          amount?: number;
          currency?: string;
          paid_at?: number | null;
          status?: string;
        };
      }>;
      payment_intent?: {
        attributes?: {
          status?: string | null;
        } | null;
      } | null;
      reference_number?: string;
      status?: string;
      payment_method_types?: string[];
    };
  };
}

export type PaymongoRetrievedCheckoutSession = {
  attributes: NonNullable<
    NonNullable<PaymongoCheckoutSessionResponse['data']>['attributes']
  >;
  id: string;
  type: string;
};

export type PaymongoCheckoutExpiryResult = {
  id: string;
  paymentIntentStatus: string | null;
  status: string;
  type: string;
};
export interface CreatePaymongoCheckoutInput {
  amount: number;
  cancelQuery?: Record<string, string>;
  description: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
  successQuery?: Record<string, string>;
}

export interface PaymongoCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
  gatewayMetadata: Record<string, unknown>;
}

@Injectable()
export class PaymongoCheckoutService {
  constructor(private readonly config: ConfigService) {}

  async createCheckoutSession(
    input: CreatePaymongoCheckoutInput,
  ): Promise<PaymongoCheckoutResult> {
    const settings = this.getRequiredSettings();
    const cancelUrl = this.buildReturnUrl(
      settings.cancelUrl,
      input.cancelQuery,
    );
    const successUrl = this.buildReturnUrl(
      settings.successUrl,
      input.successQuery,
    );
    const endpoint = `${settings.apiBaseUrl.replace(/\/+$/, '')}/checkout_sessions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: this.buildAuthorizationHeader(settings.secretKey),
        'content-type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {},
            cancel_url: cancelUrl,
            description: input.description,
            line_items: [
              {
                amount: input.amount,
                currency: PAYMONGO_CURRENCY,
                description: input.description,
                name: input.description,
                quantity: 1,
              },
            ],
            metadata: input.metadata,
            payment_method_types: settings.paymentMethodTypes,
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            success_url: successUrl,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Checkout Session Creation Failed',
          status: 502,
          detail: 'PayMongo rejected the checkout session request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as PaymongoCheckoutSessionResponse;
    const providerRef = payload.data?.id;
    const checkoutUrl = payload.data?.attributes?.checkout_url;

    if (!providerRef || !checkoutUrl) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Checkout Session Response',
          status: 502,
          detail: 'PayMongo did not return the expected checkout details.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      providerRef,
      checkoutUrl,
      gatewayMetadata: {
        checkout_url: checkoutUrl,
        checkout_status: payload.data?.attributes?.status ?? null,
        payment_method_types:
          payload.data?.attributes?.payment_method_types ??
          settings.paymentMethodTypes,
        reference_number: payload.data?.attributes?.reference_number ?? null,
      },
    };
  }

  async retrieveCheckoutSession(
    providerRef: string,
  ): Promise<PaymongoRetrievedCheckoutSession> {
    const settings = this.getRequiredSettings();
    const normalizedProviderRef = providerRef.trim();
    const endpoint = `${settings.apiBaseUrl.replace(/\/+$/, '')}/checkout_sessions/${encodeURIComponent(normalizedProviderRef)}`;

    let response: Response;
    try {
      response = await this.fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: this.buildAuthorizationHeader(settings.secretKey),
        },
      });
    } catch {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Checkout Verification Unavailable',
          status: 502,
          detail: 'FitTrack could not verify the PayMongo checkout right now.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Checkout Verification Unavailable',
          status: 502,
          detail: 'PayMongo could not verify this checkout right now.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    let payload: PaymongoCheckoutSessionResponse;
    try {
      payload = (await response.json()) as PaymongoCheckoutSessionResponse;
    } catch {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Checkout Verification Response',
          status: 502,
          detail:
            'PayMongo returned an invalid checkout verification response.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const id = payload.data?.id;
    if (!id || !payload.data?.attributes) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Checkout Verification Response',
          status: 502,
          detail: 'PayMongo returned incomplete checkout verification details.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      attributes: payload.data.attributes,
      id,
      type: payload.data.type ?? 'checkout_session',
    };
  }

  async expireCheckoutSession(
    providerRef: string,
  ): Promise<PaymongoCheckoutExpiryResult> {
    const settings = this.getRequiredSettings();
    const normalizedProviderRef = providerRef.trim();
    if (!normalizedProviderRef) {
      throw this.expiryUnavailable('PayMongo checkout reference is missing.');
    }

    const endpoint =
      settings.apiBaseUrl.replace(/\/+$/, '') +
      '/checkout_sessions/' +
      encodeURIComponent(normalizedProviderRef) +
      '/expire';

    let response: Response;
    try {
      response = await this.fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: this.buildAuthorizationHeader(settings.secretKey),
        },
      });
    } catch {
      throw this.expiryUnavailable(
        'FitTrack could not close the PayMongo checkout right now.',
      );
    }

    if (!response.ok) {
      throw this.expiryUnavailable(
        'PayMongo could not close this checkout right now.',
      );
    }

    let payload: PaymongoCheckoutSessionResponse;
    try {
      payload = (await response.json()) as PaymongoCheckoutSessionResponse;
    } catch {
      throw this.expiryUnavailable(
        'PayMongo returned an invalid checkout closure response.',
      );
    }

    const id = payload.data?.id;
    const type = payload.data?.type ?? 'checkout_session';
    const status = payload.data?.attributes?.status?.trim().toLowerCase();
    const paymentIntentStatus =
      payload.data?.attributes?.payment_intent?.attributes?.status;

    if (
      id !== normalizedProviderRef ||
      type !== 'checkout_session' ||
      status !== 'expired' ||
      (paymentIntentStatus !== undefined &&
        paymentIntentStatus !== null &&
        typeof paymentIntentStatus !== 'string')
    ) {
      throw this.expiryUnavailable(
        'PayMongo did not confirm that this checkout was closed.',
      );
    }

    return {
      id,
      paymentIntentStatus:
        typeof paymentIntentStatus === 'string'
          ? paymentIntentStatus.trim().toLowerCase() || null
          : null,
      status,
      type,
    };
  }
  private async fetchWithTimeout(
    endpoint: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      PAYMONGO_REQUEST_TIMEOUT_MS,
    );
    try {
      return await fetch(endpoint, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private expiryUnavailable(detail: string): HttpException {
    return new HttpException(
      {
        type: 'BAD_GATEWAY',
        title: 'Checkout Closure Unavailable',
        status: 502,
        detail,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
  private getRequiredSettings(): {
    secretKey: string;
    apiBaseUrl: string;
    successUrl: string;
    cancelUrl: string;
    paymentMethodTypes: string[];
  } {
    const secretKey = this.config.get<string>('paymongo.secretKey', '');
    const apiBaseUrl = this.config.get<string>('paymongo.apiBaseUrl', '');
    const successUrl = this.config.get<string>('paymongo.successUrl', '');
    const cancelUrl = this.config.get<string>('paymongo.cancelUrl', '');
    const paymentMethodTypes = this.parsePaymentMethodTypes(
      this.config.get<string>('paymongo.paymentMethodTypes', ''),
    );

    if (
      !secretKey ||
      !apiBaseUrl ||
      !successUrl ||
      !cancelUrl ||
      paymentMethodTypes.length === 0
    ) {
      throw new ServiceUnavailableException({
        type: 'SERVICE_UNAVAILABLE',
        title: 'PayMongo Not Configured',
        status: 503,
        detail: 'PayMongo checkout settings are not configured.',
      });
    }

    return {
      secretKey,
      apiBaseUrl,
      successUrl,
      cancelUrl,
      paymentMethodTypes,
    };
  }

  private parsePaymentMethodTypes(value: string): string[] {
    return value
      .split(',')
      .map((methodType) => methodType.trim())
      .filter((methodType) => methodType.length > 0);
  }

  private buildReturnUrl(baseUrl: string, query?: Record<string, string>) {
    if (!query || Object.keys(query).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(query)) {
      const normalizedValue = value.trim();
      if (!normalizedValue) {
        continue;
      }

      url.searchParams.set(key, normalizedValue);
    }

    return url.toString();
  }

  private buildAuthorizationHeader(secretKey: string): string {
    return `Basic ${Buffer.from(`${secretKey}:`, 'utf8').toString('base64')}`;
  }
}
