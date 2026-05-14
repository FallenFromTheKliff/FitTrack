import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { UserService, AttendanceService } from './user.service';
import {
  UpdateProfileDTO,
  LogProgressDTO,
  DateRangeDTO,
  UserFilterDTO,
  UpdateUserStatusDTO,
  ScanQrDTO,
  ManualAttendanceCheckInDTO,
  AttendanceFilterDTO,
  UpdatePhoneDTO,
  CreateAppFeedbackDTO,
} from './dto/user-dto';
import { CreateDeletionRequestDto } from './dto/deletion-request.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import type { UploadedImageFile } from '../files/files.types';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own full profile.' })
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile.' })
  updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDTO,
  ) {
    return this.usersService.updateMyProfile(user.sub, dto);
  }

  @Patch('me/privacy-acceptance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept the data privacy policy.' })
  acceptPrivacyPolicy(@CurrentUser() user: JwtPayload) {
    return this.usersService.acceptPrivacyPolicy(user.sub);
  }

  @Post('app-feedback')
  @ApiOperation({ summary: 'Submit authenticated app feedback.' })
  @ApiResponse({ status: 201, description: 'App feedback submitted.' })
  submitAppFeedback(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAppFeedbackDTO,
  ) {
    return this.usersService.submitAppFeedback(user.sub, dto);
  }

  @Get('app-feedback')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'List submitted app feedback for operators.' })
  @ApiResponse({ status: 200, description: 'App feedback returned.' })
  listAppFeedback() {
    return this.usersService.listAppFeedback();
  }

  @Get('deletion-request')
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({ summary: 'Get own account deletion request status.' })
  getDeletionRequestStatus(@CurrentUser() user: JwtPayload) {
    return this.usersService.getDeletionRequestStatus(user.sub);
  }

  @Post('request-deletion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({ summary: 'Create an account deletion request.' })
  requestDeletion(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDeletionRequestDto,
  ) {
    return this.usersService.requestDeletion(user.sub, dto);
  }

  @Delete('deletion-request')
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({ summary: 'Cancel a pending account deletion request.' })
  cancelDeletionRequest(@CurrentUser() user: JwtPayload) {
    return this.usersService.cancelDeletionRequest(user.sub);
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Deprecated convenience avatar upload. Prefer POST /v1/files/upload for new clients.',
    deprecated: true,
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully.' })
  @ApiResponse({
    status: 413,
    description: 'File exceeds the configured upload limit.',
  })
  async uploadAvatar(
    @UploadedFile() file: UploadedImageFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.uploadAvatarFile(user.sub, file);
  }

  @Patch('me/phone')
  @ApiOperation({
    summary: 'Update phone number stored on the user profile.',
  })
  updatePhone(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePhoneDTO) {
    return this.usersService.updatePhone(user.sub, dto);
  }

  @Post('me/progress')
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({ summary: 'Append a body measurement. Member only.' })
  @ApiResponse({ status: 201, description: 'Progress metric logged.' })
  @ApiResponse({ status: 422, description: 'No measurement fields provided.' })
  logProgress(@CurrentUser() user: JwtPayload, @Body() dto: LogProgressDTO) {
    return this.usersService.logProgress(user.sub, dto);
  }

  @Get('me/progress')
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({ summary: 'Get own progress history. Member only.' })
  getProgressHistory(
    @CurrentUser() user: JwtPayload,
    @Query() dto: DateRangeDTO,
  ) {
    return this.usersService.getProgressHistory(user.sub, dto);
  }

  @Get('me/attendance')
  @ApiOperation({ summary: 'Get own attendance history.' })
  getMyAttendance(@CurrentUser() user: JwtPayload, @Query() dto: DateRangeDTO) {
    return this.usersService.getMyAttendance(user.sub, dto);
  }

  @Post('me/refresh-qr')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({
    summary:
      'Issue a fresh attendance QR for the authenticated member, subject to cooldown.',
  })
  refreshQrToken(@CurrentUser() user: JwtPayload) {
    return this.usersService.refreshQrToken(user.sub);
  }

  @Get('me/attendance-qr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.member)
  @ApiOperation({
    summary:
      'Get the current rotating attendance QR payload for the authenticated member.',
  })
  getAttendanceQr(@CurrentUser() user: JwtPayload) {
    return this.usersService.getAttendanceQr(user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'List all users (paginated). Admin/Staff only.' })
  getAllUsers(@Query() dto: UserFilterDTO) {
    return this.usersService.getAllUsers(dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Get a single user full profile. Admin/Staff only.',
  })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'Edit any user profile. Admin/Staff only.' })
  adminUpdateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDTO,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.adminUpdateUser(id, dto, user.sub);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user account status. Admin only.' })
  @ApiResponse({ status: 200, description: 'Status updated.' })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDTO,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      '';
    return this.usersService.updateUserStatus(id, dto, actor.sub, ip);
  }
}

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('scan')
  @Roles(UserRole.staff, UserRole.admin)
  @ApiOperation({
    summary:
      'Scan a member attendance QR value for check-in. Staff/Admin only.',
  })
  @ApiResponse({ status: 201, description: 'Check-in logged.' })
  @ApiResponse({ status: 404, description: 'Invalid or expired QR value.' })
  @ApiResponse({ status: 409, description: 'Already checked in today.' })
  scanQr(@CurrentUser() user: JwtPayload, @Body() dto: ScanQrDTO) {
    return this.attendanceService.scanQr(user.sub, dto);
  }

  @Post('manual')
  @Roles(UserRole.staff, UserRole.admin)
  @ApiOperation({
    summary:
      'Manually create an attendance check-in for an active user. Staff/Admin only.',
  })
  @ApiResponse({ status: 201, description: 'Check-in logged.' })
  @ApiResponse({ status: 404, description: 'User not found or inactive.' })
  @ApiResponse({ status: 409, description: 'Already checked in today.' })
  manualCheckIn(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ManualAttendanceCheckInDTO,
  ) {
    return this.attendanceService.manualCheckIn(user.sub, dto);
  }

  @Patch(':id/checkout')
  @Roles(UserRole.staff, UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set check-out time on an attendance log.' })
  checkout(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.checkout(id);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'Get all attendance logs. Admin/Staff only.' })
  getAllAttendance(@Query() dto: AttendanceFilterDTO) {
    return this.attendanceService.getAttendanceLogs(dto);
  }
}
