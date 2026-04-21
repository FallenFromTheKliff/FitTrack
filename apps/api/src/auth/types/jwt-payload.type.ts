import {
  MembershipCardSource,
  MembershipCardStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

/**
 * JwtPayload - contents of the signed access token (HS256).
 * Guards read role and status directly from here - no Redis lookup needed.
 */
export interface JwtPayload {
  sub: string; // userId (UUID)
  role: UserRole;
  status: UserStatus;
  jti: string; // unique token ID - used for blacklisting on logout
  iat: number;
  exp: number;
}

/**
 * TokenPairResponse - returned by login, verify-email, and refresh endpoints.
 */
export interface TokenPairResponse {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    role: UserRole;
    status: UserStatus;
    email_verified_at: string | null;
    membership_card?: {
      activated_at?: Date | null;
      purchased_at?: Date | null;
      revoke_reason?: string | null;
      revoked_at?: Date | null;
      source?: MembershipCardSource | null;
      status: MembershipCardStatus;
      updated_at: Date;
      verified_at?: Date | null;
    } | null;
    phone_no?: string | null;
    profile: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
    qr_code_token?: string | null;
    qrCodeReady?: boolean;
    attendanceQrReady?: boolean;
  };
}

export interface InternalTokenPairResponse extends TokenPairResponse {
  _refresh_token: string;
}
