import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { GymLayoutController } from './gym-layout.controller';
import { GymLayoutGateway } from './gym-layout.gateway';
import { GymLayoutRepository } from './gym-layout.repository';
import { GymLayoutService } from './gym-layout.service';

type JwtExpiresIn = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

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
            '15m') as JwtExpiresIn,
        },
      }),
    }),
  ],
  controllers: [GymLayoutController],
  providers: [GymLayoutGateway, GymLayoutService, GymLayoutRepository],
  exports: [GymLayoutService, GymLayoutRepository],
})
export class GymLayoutModule {}
