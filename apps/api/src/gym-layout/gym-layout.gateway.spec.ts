import type { Socket } from 'socket.io';

import {
  GYM_LAYOUT_DELTA_EVENT,
  GYM_LAYOUT_SNAPSHOT_EVENT,
} from './gym-layout.realtime';
import { GymLayoutGateway } from './gym-layout.gateway';

type TestSocket = Socket & {
  disconnect: jest.Mock;
  emit: jest.Mock;
};

describe('GymLayoutGateway', () => {
  const gymLayoutService = {
    authenticateSocket: jest.fn(),
    getRealtimeSnapshot: jest.fn(),
  };

  const subscriber = {
    on: jest.fn(),
    quit: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const redis = {
    duplicate: jest.fn(() => subscriber),
  };

  let gateway: GymLayoutGateway;
  let server: { emit: jest.Mock };

  beforeEach(() => {
    gateway = new GymLayoutGateway(gymLayoutService as never, redis as never);
    server = { emit: jest.fn() };
    gateway.server = server as never;
    jest.clearAllMocks();
  });

  function makeSocket(): TestSocket {
    return {
      id: 'socket-1',
      handshake: {
        auth: { token: 'token-1' },
        headers: {},
        query: {},
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as TestSocket;
  }

  it('subscribes to the gym-layout Redis channel on module init', async () => {
    await gateway.onModuleInit();

    expect(redis.duplicate).toHaveBeenCalled();
    expect(subscriber.subscribe).toHaveBeenCalledWith('equipment:status');
    expect(subscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('authenticates clients and emits the initial snapshot on connect', async () => {
    const client = makeSocket();
    gymLayoutService.authenticateSocket.mockResolvedValue({ sub: 'user-1' });
    gymLayoutService.getRealtimeSnapshot.mockResolvedValue([
      { id: 'equipment-1', status: 'available' },
    ]);

    await gateway.handleConnection(client);

    expect(gymLayoutService.authenticateSocket).toHaveBeenCalledWith(client);
    expect(client.emit).toHaveBeenCalledWith(GYM_LAYOUT_SNAPSHOT_EVENT, {
      equipment: [{ id: 'equipment-1', status: 'available' }],
    });
  });

  it('disconnects clients that fail socket authentication', async () => {
    const client = makeSocket();
    gymLayoutService.authenticateSocket.mockRejectedValue({
      detail: 'Invalid or missing authentication token.',
    });

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith('gym-layout.error', {
      detail: 'Invalid or missing authentication token.',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('broadcasts Redis delta payloads to connected clients', () => {
    gateway.handleStatusMessage(
      JSON.stringify({
        equipment: { id: 'equipment-1', status: 'maintenance' },
        operation: 'upsert',
      }),
    );

    expect(server.emit).toHaveBeenCalledWith(GYM_LAYOUT_DELTA_EVENT, {
      equipment: { id: 'equipment-1', status: 'maintenance' },
      operation: 'upsert',
    });
  });
});
