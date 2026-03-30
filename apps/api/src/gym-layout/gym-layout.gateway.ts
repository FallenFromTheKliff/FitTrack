import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type Redis from 'ioredis';
import { Server, Socket } from 'socket.io';

import { GymLayoutService } from './gym-layout.service';
import {
  GYM_LAYOUT_DELTA_EVENT,
  GYM_LAYOUT_NAMESPACE,
  GYM_LAYOUT_SNAPSHOT_EVENT,
  GYM_LAYOUT_STATUS_CHANNEL,
  type GymLayoutRealtimeDelta,
} from './gym-layout.realtime';

@Injectable()
@WebSocketGateway({
  namespace: GYM_LAYOUT_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class GymLayoutGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GymLayoutGateway.name);
  private subscriber: Redis | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gymLayoutService: GymLayoutService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    await this.subscriber.subscribe(GYM_LAYOUT_STATUS_CHANNEL);
    this.subscriber.on('message', (_channel, message) => {
      this.handleStatusMessage(message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    await this.subscriber.unsubscribe(GYM_LAYOUT_STATUS_CHANNEL);
    await this.subscriber.quit();
    this.subscriber = null;
  }

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      await this.gymLayoutService.authenticateSocket(client);
      const snapshot = await this.gymLayoutService.getRealtimeSnapshot();
      client.emit(GYM_LAYOUT_SNAPSHOT_EVENT, {
        equipment: snapshot,
      });
    } catch (error) {
      this.emitError(client, error);
      client.disconnect(true);
    }
  }

  handleStatusMessage(message: string): void {
    try {
      const payload = JSON.parse(message) as GymLayoutRealtimeDelta;
      this.server.emit(GYM_LAYOUT_DELTA_EVENT, payload);
    } catch (error) {
      this.logger.error('Failed to process gym-layout Redis message.', error);
    }
  }

  private emitError(client: Socket, error: unknown): void {
    const detail =
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'detail' in error.response &&
      typeof error.response.detail === 'string'
        ? error.response.detail
        : typeof error === 'object' &&
            error !== null &&
            'detail' in error &&
            typeof error.detail === 'string'
          ? error.detail
          : 'Gym layout connection failed.';

    client.emit('gym-layout.error', { detail });
  }
}
