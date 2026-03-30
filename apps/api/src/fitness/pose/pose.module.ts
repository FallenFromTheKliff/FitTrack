import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';

import { AiPythonClientService } from '../../ai/ai-python-client.service';
import { PoseController } from './pose.controller';
import { PoseGateway } from './pose.gateway';
import { PoseRepository } from './pose.repository';
import { PoseService } from './pose.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') ?? '',
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: (config.get<string>('jwt.accessExpiresIn') ??
            '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [PoseController],
  providers: [PoseGateway, PoseService, PoseRepository, AiPythonClientService],
})
export class PoseModule {}
