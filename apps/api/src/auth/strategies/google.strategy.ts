import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

// Exported so AuthService can use it as a typed parameter
export interface GoogleProfile {
  google_id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('google.clientId') || '',
      clientSecret: config.get<string>('google.clientSecret') || '',
      callbackURL: config.get<string>('google.callbackUrl') || '',
      scope: ['email', 'profile'],
    });
  }

  /**
   * Called by Passport after Google redirects back with the user profile.
   * We pull only what we need and attach it to request.user.
   * All account resolution logic lives in AuthService.googleLogin().
   */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const googleProfile: GoogleProfile = {
      google_id: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      first_name: profile.name?.givenName ?? '',
      last_name: profile.name?.familyName ?? '',
      avatar_url: profile.photos?.[0]?.value ?? null,
    };
    done(null, googleProfile);
  }
}
