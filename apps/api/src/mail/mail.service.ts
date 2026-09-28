import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    this.fromName = config.get<string>('mail.fromName')!;
    this.fromAddress = config.get<string>('mail.fromAddress')!;
    this.resend = new Resend(config.get<string>('mail.resendApiKey')!);
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(
        `Email sent -> ${options.to} | "${options.subject}" | ${data?.id ?? 'queued'}`,
      );
    } catch (error) {
      this.logger.error(`Email failed -> ${options.to}`, error);
      throw error;
    }
  }

  async sendOtpEmail(to: string, otp: string, purpose: string): Promise<void> {
    const labels: Record<string, string> = {
      registration: 'Verify Your Email',
      password_reset: 'Reset Your Password',
      phone_verify: 'Phone Verification',
    };

    const subject = labels[purpose] ?? 'Your OTP Code';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">${subject}</h2>
        <p style="color:#555">Use the code below. It expires in <strong>10 minutes</strong>.</p>
        <div style="
          font-size:36px;font-weight:bold;letter-spacing:10px;
          background:#f4f4f4;padding:20px;text-align:center;
          border-radius:8px;color:#1a1a1a;margin:24px 0
        ">${otp}</div>
        <p style="color:#888;font-size:13px">
          If you did not request this, ignore this email.
          Never share this code with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;

    await this.send({ to, subject, html });
  }
}
