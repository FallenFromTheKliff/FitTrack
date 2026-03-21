import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard/jwt-auth.guard';
import { Public } from './public.decorator/public.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RequestOtpDto,
  AddPhoneDto,
  ChangePasswordDto,
} from './dtos/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-current-password-then-otp')
  async verifyCurrentPasswordThenOtp(
    @Request() req,
    @Body() dto: { currentPassword: string },
  ) {
    return this.authService.verifyCurrentPasswordThenOtp(
      req.user.id,
      dto.currentPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-current-password')
  async verifyCurrentPassword(
    @Request() req,
    @Body() dto: { currentPassword: string },
  ) {
    return this.authService.verifyCurrentPassword(
      req.user.id,
      dto.currentPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refresh_token);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('add-phone')
  async addPhone(@Request() req, @Body() dto: AddPhoneDto) {
    return this.authService.addPhone(req.user.id, dto.phone_no);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-phone')
  async verifyPhone(@Request() req, @Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(req.user.id, dto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(dto.email, dto.password);
  }

  // OTP re-verification check (called during login)
  @UseGuards(JwtAuthGuard)
  @Get('check-otp-status')
  async checkOtpStatus(@Request() req) {
    return this.authService.checkOtpRequired(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('request-otp')
  async requestOtp(@Request() req, @Body() dto: RequestOtpDto) {
    return this.authService.requestOtpForReVerification(req.user.id);
  }
}
