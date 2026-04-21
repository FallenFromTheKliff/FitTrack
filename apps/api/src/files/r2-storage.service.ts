import {
  NotFoundException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

import type {
  FilesStorageAdapter,
  StorageObjectResult,
  StorageUploadInput,
} from './files.types';

@Injectable()
export class R2StorageService implements FilesStorageAdapter {
  constructor(private readonly config: ConfigService) {}

  async uploadObject(input: StorageUploadInput): Promise<string> {
    const settings = this.getRequiredSettings();
    const endpoint = this.buildObjectEndpoint(
      settings.accountId,
      settings.bucket,
      input.key,
    );
    const headers = {
      'content-type': input.contentType,
      host: endpoint.host,
    } as const;
    const response = await this.sendSignedRequest(settings, {
      method: 'PUT',
      url: endpoint,
      headers,
      body: input.body,
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

    return this.buildPublicUrl(settings.publicBaseUrl, input.key);
  }

  async getObject(key: string): Promise<StorageObjectResult> {
    const settings = this.getRequiredSettings();
    const endpoint = this.buildObjectEndpoint(settings.accountId, settings.bucket, key);
    const response = await this.sendSignedRequest(settings, {
      method: 'GET',
      url: endpoint,
      headers: {
        host: endpoint.host,
      },
    });

    if (response.status === 404) {
      throw new NotFoundException({
        type: 'RESOURCE_NOT_FOUND',
        title: 'Image Not Found',
        status: 404,
        detail: 'The requested image could not be found.',
      });
    }

    if (!response.ok) {
      throw new ServiceUnavailableException({
        type: 'SERVICE_UNAVAILABLE',
        title: 'Storage Fetch Failed',
        status: 503,
        detail: 'Cloudflare R2 could not return the requested image.',
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentLengthHeader = response.headers.get('content-length');
    const parsedContentLength = contentLengthHeader ? Number(contentLengthHeader) : Number.NaN;

    return {
      body: Buffer.from(arrayBuffer),
      contentLength: Number.isFinite(parsedContentLength) ? parsedContentLength : null,
      contentType: response.headers.get('content-type'),
    };
  }

  async getBucketUsageBytes(): Promise<number> {
    const settings = this.getRequiredSettings();
    let continuationToken: string | null = null;
    let totalBytes = 0;

    do {
      const endpoint = this.buildBucketListEndpoint(
        settings.accountId,
        settings.bucket,
        continuationToken,
      );
      const response = await this.sendSignedRequest(settings, {
        method: 'GET',
        url: endpoint,
        headers: {
          host: endpoint.host,
        },
      });

      if (!response.ok) {
        throw new ServiceUnavailableException({
          type: 'STORAGE_GUARD_UNAVAILABLE',
          title: 'Storage Guard Unavailable',
          status: HttpStatus.SERVICE_UNAVAILABLE,
          detail: 'Cloudflare R2 bucket usage could not be verified.',
        });
      }

      const payload = await response.text();
      totalBytes += this.sumObjectSizes(payload);

      const isTruncated = this.extractXmlTagValue(payload, 'IsTruncated');
      continuationToken =
        isTruncated === 'true'
          ? this.extractXmlTagValue(payload, 'NextContinuationToken')
          : null;
    } while (continuationToken);

    return totalBytes;
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

  private buildObjectEndpoint(
    accountId: string,
    bucket: string,
    key: string,
  ): URL {
    const encodedKey = this.encodeKey(key);
    return new URL(
      `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${encodedKey}`,
    );
  }

  private buildBucketListEndpoint(
    accountId: string,
    bucket: string,
    continuationToken: string | null,
  ): URL {
    const endpoint = new URL(
      `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}`,
    );
    endpoint.searchParams.set('list-type', '2');
    endpoint.searchParams.set('max-keys', '1000');
    if (continuationToken) {
      endpoint.searchParams.set('continuation-token', continuationToken);
    }
    return endpoint;
  }

  private buildPublicUrl(publicBaseUrl: string, key: string): string {
    if (!publicBaseUrl) {
      throw new ServiceUnavailableException({
        type: 'SERVICE_UNAVAILABLE',
        title: 'Public Storage Not Configured',
        status: 503,
        detail:
          'Cloudflare R2 public delivery is not configured. Set R2_PUBLIC_BASE_URL before uploading avatars.',
      });
    }

    const encodedKey = this.encodeKey(key);
    return `${publicBaseUrl.replace(/\/+$/, '')}/${encodedKey}`;
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

  private async sendSignedRequest(
    settings: {
      accessKeyId: string;
      secretAccessKey: string;
    },
    input: {
      method: 'GET' | 'PUT';
      url: URL;
      headers: Record<string, string>;
      body?: Buffer;
    },
  ): Promise<Response> {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = this.sha256Hex(input.body ?? '');
    const headers = {
      ...input.headers,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(';');
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const canonicalRequest = [
      input.method,
      input.url.pathname,
      this.buildCanonicalQueryString(input.url),
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

    return fetch(input.url, {
      method: input.method,
      headers: {
        ...headers,
        authorization: [
          'AWS4-HMAC-SHA256 Credential=',
          `${settings.accessKeyId}/${credentialScope}, `,
          `SignedHeaders=${signedHeaders}, `,
          `Signature=${signature}`,
        ].join(''),
      },
      body: input.body ? new Uint8Array(input.body) : undefined,
    });
  }

  private buildCanonicalQueryString(url: URL): string {
    return [...url.searchParams.entries()]
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        if (leftKey === rightKey) {
          return leftValue.localeCompare(rightValue);
        }
        return leftKey.localeCompare(rightKey);
      })
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');
  }

  private sumObjectSizes(payload: string): number {
    return [...payload.matchAll(/<Size>(\d+)<\/Size>/g)].reduce(
      (total, match) => total + Number(match[1]),
      0,
    );
  }

  private extractXmlTagValue(payload: string, tagName: string): string | null {
    const pattern = new RegExp(`<${tagName}>([^<]+)</${tagName}>`);
    const match = payload.match(pattern);
    if (!match) {
      return null;
    }

    return this.decodeXmlEntities(match[1]);
  }

  private decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
