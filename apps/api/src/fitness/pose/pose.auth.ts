import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';

export function createUnauthorizedPoseSocketException(): UnauthorizedException {
  return new UnauthorizedException({
    type: 'UNAUTHORIZED',
    title: 'Unauthorized',
    status: 401,
    detail: 'Invalid or missing authentication token.',
  });
}

export function extractSocketToken(client: Socket): string | null {
  const authToken = normalizeTokenValue(
    (client.handshake.auth as { token?: unknown } | undefined)?.token,
  );
  if (authToken) {
    return authToken;
  }

  const headerToken = normalizeTokenValue(
    client.handshake.headers.authorization,
  );
  if (headerToken) {
    return headerToken;
  }

  return normalizeTokenValue(client.handshake.query.token);
}

export function assertActivePoseUser(payload: JwtPayload): void {
  if (payload.status !== UserStatus.active) {
    throw new ForbiddenException({
      type: 'ACCOUNT_SUSPENDED',
      title: 'Account Suspended',
      status: 403,
      detail: `Your account is ${payload.status}. Contact support.`,
    });
  }
}

function normalizeTokenValue(value: unknown): string | null {
  const rawValue: unknown = Array.isArray(value)
    ? (value as unknown[])[0]
    : value;

  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^Bearer\s+/i, '');
}
