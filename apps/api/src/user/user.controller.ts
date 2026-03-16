import { Controller, Get, Post, Body, Patch, UseGuards, Request, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { CreateProfileDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto';
import { CreateDeletionRequestDto } from './dto/deletion-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get('profile')
    async getProfile(@Request() req) {
        return this.userService.getProfile(req.user.id);
    }

    @Patch('profile')
    async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
        return this.userService.updateProfile(req.user.id, dto);
    }

    @Post('profile')
    async createProfile(@Request() req, @Body() dto: CreateProfileDto) {
        return this.userService.createProfile(req.user.id, dto);
    }

    @Patch('account')
    async updateAccount(@Request() req, @Body() dto: UpdateUserDto) {
        return this.userService.updateAccount(req.user.id, dto);
    }

    @Post('request-deletion')
    async requestAccountDeletion(@Request() req, @Body() dto: CreateDeletionRequestDto) {
        return this.userService.requestAccountDeletion(req.user.id, dto);
    }

    @Get('deletion-request')
    async getDeletionRequest(@Request() req) {
        return this.userService.getUserDeletionRequest(req.user.id);
    }

    @Delete('deletion-request')
    async cancelDeletionRequest(@Request() req) {
        return this.userService.cancelDeletionRequest(req.user.id);
    }
}