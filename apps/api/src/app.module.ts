import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { QUEUE_MAIL, QUEUE_SMS } from './queue/queue.constants';

import {
  aiConfig,
  appConfig,
  jwtConfig,
  redisConfig,
  mailConfig,
  googleConfig,
  twilioConfig,
  r2Config,
  paymongoConfig,
} from './config/configuration';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './common/health/health.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CoachingModule } from './coaching/coaching.module';
import { FilesModule } from './files/files.module';
import { FitnessModule } from './fitness/fitness.module';
import { MembershipModule } from './membership/membership.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { InventoryModule } from './inventory/inventory.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GymLayoutModule } from './gym-layout/gym-layout.module';
import { UserModule } from './user/user.module';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    // ── Config ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        aiConfig,
        appConfig,
        jwtConfig,
        redisConfig,
        mailConfig,
        googleConfig,
        twilioConfig,
        r2Config,
        paymongoConfig,
      ],
      envFilePath: '.env',
    }),

    // ── Bull ──────────────────────────────────────────────────────────────────
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),

    // ── Redis ─────────────────────────────────────────────────────────────────
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: `redis://${
          config.get('redis.password')
            ? `:${config.get('redis.password')}@`
            : ''
        }${config.get('redis.host')}:${config.get('redis.port')}`,
      }),
    }),

    // ── Rate Limiting ─────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // ── Metrics ───────────────────────────────────────────────────────────────
    // Exposes GET /metrics — Prometheus scrapes this every 15s
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),

    // ── Bull Board ────────────────────────────────────────────────────────────
    // Visual job queue UI at GET /queues
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_MAIL,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_SMS,
      adapter: BullAdapter,
    }),

    // ── Event Bus ─────────────────────────────────────────────────────────────
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),

    // ── Core ──────────────────────────────────────────────────────────────────
    PrismaModule,
    MailModule,
    QueueModule,
    HealthModule,
    AuditModule,
    FilesModule,
    FitnessModule,
    AiModule,

    // ── Domains ───────────────────────────────────────────────────────────────
    AuthModule,
    MembershipModule,
    BookingsModule,
    CoachingModule,
    NutritionModule,
    InventoryModule,
    AnalyticsModule,
    GymLayoutModule,
    NotificationsModule,
    UserModule,
  ],
})
export class AppModule {}
