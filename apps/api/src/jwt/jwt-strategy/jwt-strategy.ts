import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import {
  ExtractJwt,
  Strategy,
  type JwtFromRequestFunction,
  type StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // User UUID
  role: string;
  jti: string; // Unique JWT ID — used for blacklist on logout
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const jwtFromRequest: JwtFromRequestFunction<Request> =
      ExtractJwt.fromAuthHeaderAsBearerToken();
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_PUBLIC_KEY'),
    };

    super(options);
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.role || !payload.jti) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Malformed JWT payload.' },
      });
    }
    return payload;
  }
}
