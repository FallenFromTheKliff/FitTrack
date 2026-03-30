import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

type LoggerInfo = {
  level: string;
  message: unknown;
  timestamp?: string;
  context?: string;
};

function serializeLogMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  return JSON.stringify(message);
}

async function bootstrap(): Promise<void> {
  const winstonLogger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, context } = info as LoggerInfo;

            return `[${timestamp ?? 'unknown-time'}] [${level}] [${context ?? 'App'}] ${serializeLogMessage(message)}`;
          }),
        ),
      }),
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('app.apiPrefix', 'v1');

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FitTrack API')
    .setDescription('FitTrack REST API - Byte Bros · INF234')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addCookieAuth('refresh_token')
    .addTag('Auth')
    .addTag('Admin - Users')
    .addTag('Membership')
    .addTag('Payments')
    .addTag('Files')
    .addTag('Users')
    .addTag('Attendance')
    .addTag('Notifications')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);

  const nodeEnv = config.get<string>('app.nodeEnv');
  console.log(`FitTrack API running on http://localhost:${port}/${prefix}`);
  console.log(`Swagger docs: http://localhost:${port}/${prefix}/docs`);
  console.log(`Health check: http://localhost:${port}/${prefix}/health`);
  console.log(`Environment: ${nodeEnv ?? 'unknown'}`);
}

void bootstrap();
