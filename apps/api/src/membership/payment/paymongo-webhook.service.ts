import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

interface PaymongoSignatureParts {
  timestamp: string;
  liveSignature?: string;
  testSignature?: string;
}

export interface PaymongoWebhookEvent {
  data: {
    id: string;
    type: 'event';
    attributes: {
      type: string;
      livemode: boolean;
      data: {
        id: string;
        type: string;
        attributes: {
          amount?: number;
          checkout_url?: string | null;
          currency?: string;
          external_reference_number?: string | null;
          failed_message?: string | null;
          failure_code?: string | null;
          metadata?: Record<string, unknown> | null;
          paid_at?: number | null;
          payment_method_used?: string | null;
          payments?: Array<{
            id: string;
            type: string;
            attributes: {
              amount?: number;
              currency?: string;
              external_reference_number?: string | null;
              paid_at?: number | null;
              status?: string;
            };
          }>;
          reference_number?: string | null;
          reason?: string | null;
          status?: string | null;
        };
      };
      previous_data: Record<string, unknown>;
    };
  };
}

export const PAYMONGO_CHECKOUT_SESSION_PAID_EVENT =
  'checkout_session.payment.paid';
export const PAYMONGO_PAYMENT_FAILED_EVENT = 'payment.failed';

@Injectable()
export class PaymongoWebhookService {
  constructor(private readonly config: ConfigService) {}

  parseAndVerify(
    rawBody: Buffer | undefined,
    signatureHeader: string | undefined,
  ): PaymongoWebhookEvent {
    if (!rawBody) {
      throw new BadRequestException({
        type: 'BAD_REQUEST',
        title: 'Missing Raw Request Body',
        status: 400,
        detail: 'Webhook signature verification requires the raw request body.',
      });
    }

    if (!signatureHeader) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Missing Webhook Signature',
        status: 403,
        detail: 'PayMongo-Signature header is required.',
      });
    }

    const payload = this.parsePayload(rawBody);
    const signatureParts = this.parseSignatureHeader(signatureHeader);
    const settings = this.getRequiredSettings();
    const expectedSignature = this.createSignature(
      settings.webhookSecretKey,
      signatureParts.timestamp,
      rawBody,
    );
    const providedSignature = this.pickProvidedSignature(
      signatureParts,
      payload.data.attributes.livemode,
    );

    this.assertTimestampWithinTolerance(
      signatureParts.timestamp,
      settings.toleranceSeconds,
    );

    if (!this.safeEquals(expectedSignature, providedSignature)) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Invalid Webhook Signature',
        status: 403,
        detail: 'PayMongo webhook signature verification failed.',
      });
    }

    return payload;
  }

  private parsePayload(rawBody: Buffer): PaymongoWebhookEvent {
    try {
      return JSON.parse(rawBody.toString('utf8')) as PaymongoWebhookEvent;
    } catch {
      throw new BadRequestException({
        type: 'BAD_REQUEST',
        title: 'Invalid Webhook Payload',
        status: 400,
        detail: 'Webhook payload must be valid JSON.',
      });
    }
  }

  private parseSignatureHeader(header: string): PaymongoSignatureParts {
    const parts = header
      .split(',')
      .map((segment) => segment.trim())
      .reduce<Record<string, string>>((accumulator, segment) => {
        const separatorIndex = segment.indexOf('=');
        if (separatorIndex > 0) {
          const key = segment.slice(0, separatorIndex);
          const value = segment.slice(separatorIndex + 1);
          accumulator[key] = value;
        }

        return accumulator;
      }, {});

    if (!parts.t) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Invalid Webhook Signature Header',
        status: 403,
        detail: 'PayMongo-Signature header is missing a timestamp.',
      });
    }

    return {
      timestamp: parts.t,
      liveSignature: parts.li,
      testSignature: parts.te,
    };
  }

  private getRequiredSettings(): {
    webhookSecretKey: string;
    toleranceSeconds: number;
  } {
    const webhookSecretKey = this.config.get<string>(
      'paymongo.webhookSecretKey',
      '',
    );
    const toleranceSeconds = this.config.get<number>(
      'paymongo.webhookToleranceSeconds',
      300,
    );

    if (!webhookSecretKey) {
      throw new ServiceUnavailableException({
        type: 'SERVICE_UNAVAILABLE',
        title: 'PayMongo Webhook Not Configured',
        status: 503,
        detail: 'PayMongo webhook verification is not configured.',
      });
    }

    return { webhookSecretKey, toleranceSeconds };
  }

  private createSignature(
    webhookSecretKey: string,
    timestamp: string,
    rawBody: Buffer,
  ): string {
    return createHmac('sha256', webhookSecretKey)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex');
  }

  private pickProvidedSignature(
    parts: PaymongoSignatureParts,
    livemode: boolean,
  ): string {
    const signature = livemode
      ? (parts.liveSignature ?? parts.testSignature)
      : (parts.testSignature ?? parts.liveSignature);

    if (!signature) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Missing Webhook Signature Digest',
        status: 403,
        detail: 'PayMongo-Signature header is missing a digest value.',
      });
    }

    return signature;
  }

  private assertTimestampWithinTolerance(
    timestamp: string,
    toleranceSeconds: number,
  ): void {
    const parsedTimestamp = Number(timestamp);

    if (!Number.isFinite(parsedTimestamp)) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Invalid Webhook Timestamp',
        status: 403,
        detail: 'PayMongo-Signature timestamp is invalid.',
      });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - parsedTimestamp) > toleranceSeconds) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Expired Webhook Signature',
        status: 403,
        detail: 'PayMongo webhook signature is outside the allowed window.',
      });
    }
  }

  private safeEquals(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
