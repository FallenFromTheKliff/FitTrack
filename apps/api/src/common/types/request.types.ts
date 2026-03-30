import type { Request } from 'express';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

export type CookieMap = Record<string, string | undefined>;

export interface RequestWithCookies extends Request {
  cookies: CookieMap;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

export interface AuthenticatedRequest extends RequestWithUser {
  cookies: CookieMap;
}
