import { Module } from '@nestjs/common';
import { AuthController, AdminAuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigModule } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { QueueModule } from '../queue/queue.module';
import { AuthOtpService } from './otp/auth-otp.service';

type JwtExpiresIn =
  | number
  | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') ?? '',
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: (config.get<string>('jwt.accessExpiresIn') ??
            '15m') as JwtExpiresIn,
        },
      }),
    }),
    QueueModule,
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    AuthOtpService,
    AuthRepository,
    JwtStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
