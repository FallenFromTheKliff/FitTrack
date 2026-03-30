declare module 'passport-jwt' {
  import type { Request } from 'express';
  import type { Strategy as PassportStrategy } from 'passport-strategy';

  export type JwtFromRequestFunction<T = Request> = (req: T) => string | null;

  export interface StrategyOptionsWithoutRequest {
    jwtFromRequest: JwtFromRequestFunction<Request>;
    secretOrKey: string;
    ignoreExpiration?: boolean;
    passReqToCallback?: false;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptionsWithoutRequest);
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): JwtFromRequestFunction<Request>;
  };
}
