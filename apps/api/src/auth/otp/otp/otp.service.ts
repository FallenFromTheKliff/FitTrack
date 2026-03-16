import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import twilio from 'twilio';

@Injectable()
export class OtpService {
    private emailTransporter: nodemailer.Transporter;
    private twilioClient: ReturnType<typeof twilio>;

    constructor(private prisma: PrismaService) {
        this.emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false  // ✅ Fix for SSL error
            }
        });

        this.twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
        );
    }

    private generateOtpCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendEmailOtp(email: string, userId: string) {
        console.log('🔵 Starting sendEmailOtp for:', email);

        const code = this.generateOtpCode();
        console.log('🔵 Generated OTP:', code);

        const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        await this.prisma.otp.updateMany({
            where: { userId, type: 'email', verified: false },
            data: { verified: true },
        });

        await this.prisma.otp.create({
            data: { userId, code, type: 'email', expiresAt },
        });

        console.log('🔵 Sending email via Gmail...');

        try {
            const result = await this.emailTransporter.sendMail({
                from: `"${process.env.APP_NAME || 'MyApp'}" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: 'Verify your email address',
                headers: {
                    'X-Priority': '1 (Highest)', // Mark as important
                    'X-MSMail-Priority': 'High',
                    'Importance': 'High'
                },
                html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Email Verification</h1>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block;">
                    <span style="color: #667eea; font-size: 42px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace;">${code}</span>
                </div>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
                ⏱️ This code expires in <strong>${expiryMinutes} minutes</strong>
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #999; font-size: 12px; line-height: 1.5;">
                    If you didn't request this verification code, please ignore this email or contact support if you have concerns.
                </p>
            </div>
        </div>
    `,
                text: `Hi! Your verification code is: ${code}. This code expires in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.`,
            });

            console.log('✅ Email sent:', result.messageId);
        } catch (error) {
            console.error('❌ Email error:', error);
            throw new BadRequestException('Failed to send OTP email');
        }

        return { message: 'OTP sent to email' };
    }

    async sendPasswordResetOtp(email: string, userId: string) {
        console.log('🔵 Sending password reset OTP to:', email);

        const code = this.generateOtpCode();
        const expiryMinutes = 10; // 10 minutes for password reset
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        // Mark old password reset OTPs as verified
        await this.prisma.otp.updateMany({
            where: { userId, type: 'password_reset', verified: false },
            data: { verified: true },
        });

        // Create new OTP
        await this.prisma.otp.create({
            data: {
                userId,
                code,
                type: 'password_reset', // ✅ New type
                expiresAt
            },
        });

        try {
            await this.emailTransporter.sendMail({
                from: `"${process.env.APP_NAME || 'FitTrack'}" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: '🔐 Password Reset Code - FitTrack',
                headers: {
                    'X-Priority': '1 (Highest)',
                    'X-MSMail-Priority': 'High',
                    'Importance': 'High'
                },
                html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">🔐 Password Reset</h1>
        </div>
        
        <div style="background: linear-gradient(135deg, #fc7905 0%, #d66804 100%); padding: 30px; text-align: center; border-radius: 12px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block;">
                <span style="color: #fc7905; font-size: 42px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace;">${code}</span>
            </div>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
            ⏱️ This code expires in <strong>${expiryMinutes} minutes</strong>
        </p>
        
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Use this code to reset your FitTrack password. If you didn't request this, please ignore this email.
        </p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 12px; line-height: 1.5;">
                🛡️ Security tip: Never share this code with anyone. FitTrack support will never ask for your reset code.
            </p>
        </div>
    </div>
            `,
                text: `Your FitTrack password reset code is: ${code}. This code expires in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.`,
            });

            console.log('✅ Password reset OTP sent');
        } catch (error) {
            console.error('❌ Email error:', error);
            throw new BadRequestException('Failed to send password reset email');
        }

        return { message: 'Password reset code sent to email' };
    }


    // Keep your other methods the same...
    async sendPhoneOtp(phone: string, userId: string) {
        const code = this.generateOtpCode();
        const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        await this.prisma.otp.updateMany({
            where: { userId, type: 'phone', verified: false },
            data: { verified: true },
        });

        await this.prisma.otp.create({
            data: { userId, code, type: 'phone', expiresAt },
        });

        await this.twilioClient.messages.create({
            body: `Your OTP code is: ${code}. Valid for ${expiryMinutes} minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        });

        return { message: 'OTP sent to phone' };
    }

    async verifyOtp(userId: string, code: string, type: 'email' | 'phone') {
        const otp = await this.prisma.otp.findFirst({
            where: { userId, code, type, verified: false },
            orderBy: { createdAt: 'desc' },
        });

        if (!otp) {
            throw new BadRequestException('Invalid OTP');
        }

        if (new Date() > otp.expiresAt) {
            throw new BadRequestException('OTP expired');
        }

        await this.prisma.otp.update({
            where: { id: otp.id },
            data: { verified: true },
        });

        return { verified: true };
    }
}