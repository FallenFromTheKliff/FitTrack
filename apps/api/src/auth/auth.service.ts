import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { OtpService } from './otp/otp/otp.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    VerifyPhoneDto,
    ResetPasswordDto,
} from './dtos/auth.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private otpService: OtpService,
    ) { }

    generateAccessToken(userId: string, email: string, roleId: number) {
        const payload = { sub: userId, email, roleId };
        return this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: '15m',
        });
    }

    async generateRefreshToken(userId: string) {
        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await this.prisma.refreshToken.create({
            data: { token, userId, expiresAt },
        });

        return token;
    }

    async refreshAccessToken(refreshToken: string) {
        const token = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: { include: { role: true } } },
        });

        if (!token) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (new Date() > token.expiresAt) {
            await this.prisma.refreshToken.delete({ where: { id: token.id } });
            throw new UnauthorizedException('Refresh token expired');
        }

        const user = token.user;
        const newAccessToken = this.generateAccessToken(user.id, user.email, user.roleId);

        return { access_token: newAccessToken };
    }

    async logout(refreshToken: string) {
        await this.prisma.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
        return { message: 'Logged out successfully' };
    }

    async verifyCurrentPasswordThenOtp(userId: string, currentPassword: string) {
        // Get user from database
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify the password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Send password reset OTP after verification
        await this.otpService.sendPasswordResetOtp(user.email, userId);

        return {
            message: 'Password verified. Reset code sent to your email.',
            verified: true,
        };
    }

    async verifyCurrentPassword(userId: string, currentPassword: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify the password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        return {
            message: 'Password verified. Reset code sent to your email.',
            verified: true,
        };
    }

    async register(dto: RegisterDto) {
        // Check if email exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingUser && !existingUser.deletedAt) {
            throw new ConflictException('Email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Get USER role
        const userRole = await this.prisma.role.findUnique({
            where: { name: 'USER' },
        });

        if (!userRole) {
            throw new NotFoundException('USER role not found. Please seed roles first.');
        }

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                phone_no: dto.phone_no || null,
                roleId: userRole.id,
            },
        });

        // Auto-create empty profile
        await this.prisma.userProfile.create({
            data: {
                userId: user.id,
            },
        });

        // Send email OTP
        await this.otpService.sendEmailOtp(user.email, user.id);

        return {
            message: 'Registration successful. Please verify your email with the OTP sent.',
            userId: user.id,
            email: user.email,
        };
    }

    async verifyEmail(dto: VerifyEmailDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify OTP
        await this.otpService.verifyOtp(user.id, dto.otp, 'email');

        // Mark email as verified
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerifiedAt: new Date(),
                lastOtpVerifiedAt: new Date(), // Track for 7-day re-verification
            },
        });

        return {
            message: 'Email verified successfully',
            emailVerified: true,
        };
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { role: true },
        });

        // CHANGED TO BADREQUEST FOR NOW
        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new BadRequestException('Invalid credentials');
        }

        // CHANGED TO BADREQUEST FOR NOW
        // if (!user.emailVerified) {
        //     throw new BadRequestException('Please verify your email first');
        // }

        // Check if 7-day OTP re-verification is needed
        const requiresOtp = await this.checkOtpRequired(user.id);

        if (requiresOtp.otpRequired) {
            // Send OTP automatically
            await this.requestOtpForReVerification(user.email);

            return {
                message: 'OTP verification required',
                otpRequired: true,
                reason: requiresOtp.reason,
            };
        }

        const accessToken = this.generateAccessToken(user.id, user.email, user.roleId);
        const refreshToken = await this.generateRefreshToken(user.id);

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role.name,
                emailVerified: user.emailVerified,
                phoneVerified: user.phoneVerified,
            },
        };
    }

    async addPhone(userId: string, phone_no: string) {
        // Check if phone already exists
        const existingPhone = await this.prisma.user.findFirst({
            where: { phone_no, id: { not: userId } },
        });

        if (existingPhone) {
            throw new ConflictException('Phone number already in use');
        }

        // Update user with phone
        await this.prisma.user.update({
            where: { id: userId },
            data: { phone_no },
        });

        // Send SMS OTP
        await this.otpService.sendPhoneOtp(phone_no, userId);

        return {
            message: 'Phone number added. Please verify with the OTP sent via SMS.',
            phone_no,
        };
    }

    async verifyPhone(userId: string, dto: VerifyPhoneDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.phone_no !== dto.phone_no) {
            throw new BadRequestException('Phone number does not match');
        }

        // Verify OTP
        await this.otpService.verifyOtp(userId, dto.otp, 'phone');

        // Mark phone as verified
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                phoneVerified: true,
                phoneVerifiedAt: new Date(),
                lastOtpVerifiedAt: new Date(), // Track for 7-day re-verification
            },
        });

        return {
            message: 'Phone verified successfully',
            phoneVerified: true,
        };
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return { message: 'If the email exists, a reset code has been sent.' };
        }

        // ✅ SIMPLEST: Just use your existing OTP service!
        // It already handles: code generation, database storage, email sending
        await this.otpService.sendPasswordResetOtp(email, user.id);

        return {
            message: 'If the email exists, a reset code has been sent.',
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        // ✅ Find user by looking up the OTP
        const otp = await this.prisma.otp.findFirst({
            where: {
                code: dto.token,
                type: 'password_reset', // New type
                verified: false
            },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });

        if (!otp) {
            throw new BadRequestException('Invalid or expired reset code');
        }

        if (new Date() > otp.expiresAt) {
            throw new BadRequestException('Reset code expired');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

        // Update password
        await this.prisma.user.update({
            where: { id: otp.userId },
            data: { password: hashedPassword },
        });

        // Mark OTP as verified
        await this.prisma.otp.update({
            where: { id: otp.id },
            data: { verified: true },
        });

        // Invalidate all refresh tokens
        await this.prisma.refreshToken.deleteMany({
            where: { userId: otp.userId },
        });

    }

    async changePassword(email: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: email },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        return { message: 'Password reset successful. Please login with your new password.' };
    }

    // Check if user needs OTP re-verification (7-day rule)
    async checkOtpRequired(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // If never verified, require OTP
        if (!user.lastOtpVerifiedAt) {
            return {
                otpRequired: true,
                reason: 'Initial verification required',
            };
        }

        // Check if 7 days have passed
        const daysSinceLastOtp = Math.floor(
            (new Date().getTime() - user.lastOtpVerifiedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastOtp >= 7) {
            return {
                otpRequired: true,
                reason: '7-day re-verification required',
                daysSinceLastOtp,
            };
        }

        return {
            otpRequired: false,
            daysSinceLastOtp,
        };
    }

    async requestOtpForReVerification(email: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: email, emailVerified: false },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Send OTP via preferred method (email or phone)
        if (user.phoneVerified && user.phone_no) {
            await this.otpService.sendPhoneOtp(user.phone_no, user.id);
            return { message: 'OTP sent via SMS', method: 'phone' };
        } else {
            await this.otpService.sendEmailOtp(user.email, user.id);
            return { message: 'OTP sent via email', method: 'email' };
        }
    }
}