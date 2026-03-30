import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

import type { FilesStorageAdapter, StorageUploadInput } from './files.types';

@Injectable()
export class R2StorageService implements FilesStorageAdapter {
  constructor(private readonly config: ConfigService) {}

  async uploadObject(input: StorageUploadInput): Promise<string> {
    const settings = this.getRequiredSettings();
    const endpoint = this.buildEndpoint(
      settings.accountId,
      settings.bucket,
      input.key,
    );
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = this.sha256Hex(input.body);
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const headers = {
      'content-type': input.contentType,
      host: endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    } as const;
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const canonicalRequest = [
      'PUT',
      endpoint.pathname,
      '',
      this.buildCanonicalHeaders(headers),
      signedHeaders,
      payloadHash,
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n');
    const signature = this.createSignature(
      settings.secretAccessKey,
      dateStamp,
      stringToSign,
    );

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        ...headers,
        authorization: [
          'AWS4-HMAC-SHA256 Credential=',
          `${settings.accessKeyId}/${credentialScope}, `,
          `SignedHeaders=${signedHeaders}, `,
          `Signature=${signature}`,
        ].join(''),
      },
      body: new Uint8Array(input.body),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'File Upload Failed',
          status: 502,
          detail: 'Cloudflare R2 rejected the upload request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return this.buildPublicUrl(
      settings.publicBaseUrl,
      settings.accountId,
      settings.bucket,
      input.key,
    );
  }

  private getRequiredSettings(): {
    accountId: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl: string;
  } {
    const settings = {
      accountId: this.config.get<string>('r2.accountId', ''),
      bucket: this.config.get<string>('r2.bucket', ''),
      accessKeyId: this.config.get<string>('r2.accessKeyId', ''),
      secretAccessKey: this.config.get<string>('r2.secretAccessKey', ''),
      publicBaseUrl: this.config.get<string>('r2.publicBaseUrl', ''),
    };

    if (
      !settings.accountId ||
      !settings.bucket ||
      !settings.accessKeyId ||
      !settings.secretAccessKey
    ) {
      throw new ServiceUnavailableException({
        type: 'SERVICE_UNAVAILABLE',
        title: 'Storage Not Configured',
        status: 503,
        detail: 'Cloudflare R2 storage is not configured.',
      });
    }

    return settings;
  }

  private buildEndpoint(accountId: string, bucket: string, key: string): URL {
    const encodedKey = this.encodeKey(key);
    return new URL(
      `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${encodedKey}`,
    );
  }

  private buildPublicUrl(
    publicBaseUrl: string,
    accountId: string,
    bucket: string,
    key: string,
  ): string {
    const encodedKey = this.encodeKey(key);

    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/+$/, '')}/${encodedKey}`;
    }

    return `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${encodedKey}`;
  }

  private buildCanonicalHeaders(headers: Record<string, string>): string {
    return Object.entries(headers)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value.trim()}`)
      .join('\n')
      .concat('\n');
  }

  private formatAmzDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  private createSignature(
    secretAccessKey: string,
    dateStamp: string,
    stringToSign: string,
  ): string {
    const dateKey = this.hmac(`AWS4${secretAccessKey}`, dateStamp);
    const regionKey = this.hmac(dateKey, 'auto');
    const serviceKey = this.hmac(regionKey, 's3');
    const signingKey = this.hmac(serviceKey, 'aws4_request');
    return this.hmac(signingKey, stringToSign).toString('hex');
  }

  private hmac(key: string | Buffer, value: string): Buffer {
    return createHmac('sha256', key).update(value, 'utf8').digest();
  }

  private sha256Hex(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private encodeKey(key: string): string {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }
}
