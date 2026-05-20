import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UserRole } from '@prisma/client';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import type {
  InternalLoginResponse,
  InternalTokenPairResponse,
  JwtPayload,
  LoginOtpChallengeResponse,
} from './types/jwt-payload.type';
import { GoogleProfile } from './strategies/google.strategy';
import type {
  RequestWithCookies,
  RequestWithUser,
} from '../common/types/request.types';
import {
  RegisterDTO,
  VerifyEmailDTO,
  LoginDTO,
  ForgotPasswordDTO,
  VerifyCurrentPasswordDTO,
  VerifyResetOtpDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  AdminCreateUserDTO,
  ResendOtpDTO,
  AuthPortalSummaryDTO,
} from './dto/auth.dto';

// =============================================================================
// Cookie Helpers
// =============================================================================

const COOKIE_NAME = 'refresh_token';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    ...COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
}

function stripRefreshToken(result: InternalTokenPairResponse) {
  return {
    access_token: result.access_token,
    refresh_token: result._refresh_token,
    user: result.user,
  };
}

function isLoginOtpChallenge(
  result: InternalLoginResponse,
): result is LoginOtpChallengeResponse {
  return 'otpRequired' in result && result.otpRequired === true;
}

function getHeaderValue(
  headers: Request['headers'],
  name: string,
): string | undefined {
  const value = headers[name];
  if (typeof value === 'string') {
    return value;
  }

  return value?.[0];
}

function extractDeviceAndIp(req: Request): { deviceInfo: string; ip: string } {
  const forwardedFor = getHeaderValue(req.headers, 'x-forwarded-for');

  return {
    deviceInfo: getHeaderValue(req.headers, 'user-agent') ?? '',
    ip: forwardedFor?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '',
  };
}

// =============================================================================
// Auth Controller — /v1/auth
// =============================================================================

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Self-register a member account. Sends email OTP.' })
  @ApiResponse({ status: 201, description: '{ user_id }' })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  register(@Body() dto: RegisterDTO) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit OTP → activate account → return token pair.',
  })
  @ApiResponse({
    status: 200,
    description: 'TokenPairResponse + HttpOnly cookie.',
  })
  @ApiResponse({ status: 422, description: 'Invalid / expired / used OTP.' })
  @ApiResponse({ status: 423, description: 'OTP locked.' })
  async verifyEmail(
    @Body() dto: VerifyEmailDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto);
    setRefreshCookie(res, result._refresh_token);
    return stripRefreshToken(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password.' })
  @ApiResponse({
    status: 200,
    description: 'TokenPairResponse + HttpOnly cookie, or OTP challenge.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 423, description: 'Account locked.' })
  @ApiResponse({ status: 403, description: 'Account suspended or banned.' })
  @ApiResponse({ status: 410, description: 'Account archived.' })
  async login(
    @Body() dto: LoginDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { deviceInfo, ip } = extractDeviceAndIp(req);
    const result = await this.authService.login(dto, deviceInfo, ip);
    if (isLoginOtpChallenge(result)) {
      return result;
    }

    setRefreshCookie(res, result._refresh_token);
    return stripRefreshToken(result);
  }

  @Get('portal-summary')
  @ApiOperation({
    summary:
      'Get the public login portal summary grounded in the live database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active members, sessions today, and all-time revenue.',
    type: AuthPortalSummaryDTO,
  })
  getPortalSummary() {
    return this.authService.getPortalSummary();
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google consent screen.' })
  googleRedirect() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback. Returns token pair.' })
  @ApiResponse({
    status: 200,
    description: 'TokenPairResponse + HttpOnly cookie.',
  })
  async googleCallback(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { deviceInfo, ip } = extractDeviceAndIp(req);
    const result = await this.authService.googleLogin(
      req.user as unknown as GoogleProfile,
      deviceInfo,
      ip,
    );
    setRefreshCookie(res, result._refresh_token);
    return stripRefreshToken(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rotate refresh token. Returns new token pair.' })
  @ApiResponse({
    status: 200,
    description: 'New TokenPairResponse + new cookie.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, expired, or reused token.',
  })
  @ApiResponse({ status: 410, description: 'Account archived.' })
  async refresh(
    @Req() req: RequestWithCookies,
    @Body() body: { refresh_token?: string } | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[COOKIE_NAME] ?? body?.refresh_token?.trim();
    if (!rawToken) {
      throw new UnauthorizedException({
        type: 'MISSING_REFRESH_TOKEN',
        title: 'Missing Refresh Token',
        status: 401,
        detail: 'No refresh token cookie found.',
      });
    }
    const result = await this.authService.refresh(rawToken);
    setRefreshCookie(res, result._refresh_token);
    return stripRefreshToken(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Blacklist JWT + revoke refresh token + clear cookie.',
  })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithCookies,
    @Body() body: { refresh_token?: string } | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken =
      req.cookies?.[COOKIE_NAME] ?? body?.refresh_token?.trim() ?? '';
    await this.authService.logout(user.jti, rawToken);
    clearRefreshCookie(res);
    return { message: 'Logged out successfully.' };
  }

  @Post('verify-current-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify the current password for the authenticated account.',
  })
  @ApiResponse({ status: 200, description: '{ verified: true }' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect.' })
  async verifyCurrentPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyCurrentPasswordDTO,
  ) {
    const verified = await this.authService.verifyCurrentPassword(
      user.sub,
      dto,
    );
    return { verified };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change the current password for the authenticated account.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password changed successfully. Existing sessions are revoked.',
  })
  @ApiResponse({ status: 401, description: 'Current password is incorrect.' })
  @ApiResponse({
    status: 422,
    description: 'New password is invalid or matches the current password.',
  })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDTO,
  ) {
    await this.authService.changePassword(user.sub, dto);
    return {
      message: 'Password changed successfully. Please log in again.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @ApiOperation({
    summary: 'Send password reset OTP. Always 200 — enumeration-safe.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDTO) {
    await this.authService.forgotPassword(dto);
    return { message: 'If that email exists, a reset code has been sent.' };
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a password reset OTP without consuming it.',
  })
  @ApiResponse({ status: 200, description: '{ verified: true }' })
  @ApiResponse({
    status: 404,
    description: 'No account found with this email.',
  })
  @ApiResponse({ status: 422, description: 'Invalid or expired OTP.' })
  @ApiResponse({ status: 423, description: 'OTP locked.' })
  async verifyResetOtp(@Body() dto: VerifyResetOtpDTO) {
    const verified = await this.authService.verifyResetOtp(dto);
    return { verified };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP + set new password. Revokes all sessions.',
  })
  @ApiResponse({ status: 200, description: 'Password reset.' })
  @ApiResponse({ status: 422, description: 'Invalid or expired OTP.' })
  async resetPassword(@Body() dto: ResetPasswordDTO) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully. Please log in.' };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @ApiOperation({
    summary: 'Resend registration OTP. Always 200 — enumeration-safe.',
  })
  async resendOtp(@Body() dto: ResendOtpDTO) {
    await this.authService.resendOtp(dto);
    return {
      message:
        'If that account exists and is pending, a new OTP has been sent.',
    };
  }
}

// =============================================================================
// Admin Auth Controller — /v1/admin/users
// =============================================================================

@ApiTags('Admin — Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.staff)
@Controller('admin/users')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create an admin, staff, or member account. Staff may only create staff or member accounts.',
  })
  @ApiResponse({ status: 201, description: '{ user_id, email, role }' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  createUser(
    @Body() dto: AdminCreateUserDTO,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ip =
      getHeaderValue(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      '';
    return this.authService.adminCreateUser(dto, user.sub, user.role, ip);
  }
}
