import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { GymChatRole, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

import { GymChatController } from '../src/ai/gym-chat.controller';
import { GymChatService } from '../src/ai/gym-chat.service';
import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

type GymChatServiceMethods =
  | 'sendMessage'
  | 'getMySessions'
  | 'getSessionMessages'
  | 'archiveSession';

type GymChatServiceMock = jest.Mocked<
  Pick<GymChatService, GymChatServiceMethods>
>;

const USERS: Record<string, JwtPayload> = {
  member: {
    sub: '22222222-2222-4222-8222-222222222222',
    role: UserRole.member,
    status: UserStatus.active,
    jti: 'member-jti',
    iat: 1,
    exp: 9999999999,
  },
};

function createGymChatServiceMock(): GymChatServiceMock {
  return {
    sendMessage: jest.fn(),
    getMySessions: jest.fn(),
    getSessionMessages: jest.fn(),
    archiveSession: jest.fn(),
  };
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtPayload;
    }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    const actor = authorization.slice('Bearer '.length).trim();
    const user = USERS[actor];

    if (!user) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    request.user = user;
    return true;
  }
}

describe('GymChatController (e2e)', () => {
  let app: INestApplication;
  let gymChatService: GymChatServiceMock;

  beforeAll(async () => {
    gymChatService = createGymChatServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [GymChatController],
      providers: [
        Reflector,
        { provide: GymChatService, useValue: gymChatService },
        JwtAuthGuard,
      ],
    });

    moduleFixtureBuilder.overrideGuard(JwtAuthGuard).useClass(TestJwtAuthGuard);

    const moduleFixture: TestingModule = await moduleFixtureBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
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

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('supports the member gym chat session HTTP surface', async () => {
    gymChatService.sendMessage.mockResolvedValue({
      session_id: '17171717-1717-4717-8717-171717171717',
      reply: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
      sources: ['membership_plans'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
      out_of_scope: false,
    });
    gymChatService.getMySessions.mockResolvedValue({
      data: [
        {
          id: '17171717-1717-4717-8717-171717171717',
          title: 'Membership plans',
          is_active: true,
          last_activity_at: '2026-03-28T08:00:00.000Z',
          created_at: '2026-03-28T07:00:00.000Z',
          updated_at: '2026-03-28T08:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    gymChatService.getSessionMessages.mockResolvedValue({
      data: [
        {
          id: '18181818-1818-4818-8818-181818181818',
          session_id: '17171717-1717-4717-8717-171717171717',
          role: GymChatRole.assistant,
          content: 'We are open until 10 PM.',
          grounded_sources: ['operating_hours'],
          out_of_scope: false,
          created_at: '2026-03-28T08:01:00.000Z',
          updated_at: '2026-03-28T08:01:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    gymChatService.archiveSession.mockResolvedValue(undefined);

    const sendResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({
        message: 'What membership plans do you offer?',
      })
      .expect(200);

    expect(gymChatService.sendMessage).toHaveBeenCalledWith(USERS.member.sub, {
      message: 'What membership plans do you offer?',
    });
    expect(sendResponse.body).toEqual({
      data: {
        session_id: '17171717-1717-4717-8717-171717171717',
        reply: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
        sources: ['membership_plans'],
        follow_up_suggestions: [
          'Ask which membership plan fits your visit frequency.',
        ],
        out_of_scope: false,
      },
    });

    const sessionsResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/sessions?page=1&limit=20&is_active=true')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(gymChatService.getMySessions).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        page: 1,
        limit: 20,
        is_active: true,
      },
    );
    expect(sessionsResponse.body).toMatchObject({
      data: [
        {
          id: '17171717-1717-4717-8717-171717171717',
          title: 'Membership plans',
          is_active: true,
        },
      ],
      meta: { total: 1 },
    });

    const messagesResponse = await request(getHttpServer(app))
      .get(
        '/v1/gym-chat/sessions/17171717-1717-4717-8717-171717171717/messages',
      )
      .query({ page: 1, limit: 20 })
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(gymChatService.getSessionMessages).toHaveBeenCalledWith(
      USERS.member.sub,
      '17171717-1717-4717-8717-171717171717',
      { page: 1, limit: 20 },
    );
    expect(messagesResponse.body).toMatchObject({
      data: [
        {
          id: '18181818-1818-4818-8818-181818181818',
          grounded_sources: ['operating_hours'],
          out_of_scope: false,
        },
      ],
      meta: { total: 1 },
    });

    const archiveResponse = await request(getHttpServer(app))
      .delete('/v1/gym-chat/sessions/17171717-1717-4717-8717-171717171717')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(gymChatService.archiveSession).toHaveBeenCalledWith(
      USERS.member.sub,
      '17171717-1717-4717-8717-171717171717',
    );
    expect(archiveResponse.body).toEqual({
      data: {
        message: 'Gym chat session archived.',
      },
    });
  });


  it('accepts UUID v5 gym chat sessions for message continuation', async () => {
    const seededSessionId = 'd3f9a4c0-1e2a-5b3d-8d2c-9f4a7b8c1e0a';

    gymChatService.sendMessage
      .mockResolvedValueOnce({
        session_id: seededSessionId,
        reply: 'We can help with a full tour of your membership options.',
        sources: ['membership_plans'],
        follow_up_suggestions: [
          'Tell us what your visit frequency is so we can narrow plans.',
        ],
        out_of_scope: false,
      })
      .mockResolvedValueOnce({
        session_id: seededSessionId,
        reply: 'Our staff can walk you through the active plans anytime.',
        sources: ['membership_plans'],
        follow_up_suggestions: ['Ask which membership plan fits your schedule.'],
        out_of_scope: false,
      });

    gymChatService.getSessionMessages.mockResolvedValue({
      data: [
        {
          id: '18181818-1818-4818-8818-181818181818',
          session_id: seededSessionId,
          role: GymChatRole.assistant,
          content: 'We can help with a full tour of your membership options.',
          grounded_sources: ['membership_plans'],
          out_of_scope: false,
          created_at: '2026-03-28T09:01:00.000Z',
          updated_at: '2026-03-28T09:01:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const firstSendResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({
        session_id: seededSessionId,
        message: 'What are your membership options?',
      })
      .expect(200);

    expect(firstSendResponse.body).toMatchObject({
      data: {
        session_id: seededSessionId,
        reply: 'We can help with a full tour of your membership options.',
      },
    });

    const secondSendResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({
        session_id: seededSessionId,
        message: 'Can you summarize the options?',
      })
      .expect(200);

    expect(secondSendResponse.body).toMatchObject({
      data: {
        session_id: seededSessionId,
        reply: 'Our staff can walk you through the active plans anytime.',
      },
    });

    const messagesResponse = await request(getHttpServer(app))
      .get(`/v1/gym-chat/sessions/${seededSessionId}/messages`)
      .query({ page: 1, limit: 20 })
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(gymChatService.sendMessage).toHaveBeenCalledWith(USERS.member.sub, {
      session_id: seededSessionId,
      message: 'What are your membership options?',
    });
    expect(gymChatService.sendMessage).toHaveBeenCalledWith(USERS.member.sub, {
      session_id: seededSessionId,
      message: 'Can you summarize the options?',
    });
    expect(gymChatService.getSessionMessages).toHaveBeenCalledWith(
      USERS.member.sub,
      seededSessionId,
      { page: 1, limit: 20 },
    );

    expect(messagesResponse.body).toMatchObject({
      data: [
        {
          session_id: seededSessionId,
        },
      ],
      meta: { total: 1 },
    });
  });
  it('rejects unauthenticated callers before hitting the gym-chat service', async () => {
    const response = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .send({ message: 'What membership plans do you offer?' })
      .expect(401);

    expect(response.body).toEqual({
      type: 'UNAUTHORIZED',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid or missing authentication token.',
    });
    expect(gymChatService.sendMessage).not.toHaveBeenCalled();
  });

  it('preserves archived-session and validation failures for send-message requests', async () => {
    gymChatService.sendMessage.mockRejectedValueOnce(
      new HttpException(
        {
          type: 'SESSION_ARCHIVED',
          title: 'Gym Chat Session Archived',
          status: 410,
          detail:
            'This gym chat session was archived after more than 14 days of inactivity.',
        },
        410,
      ),
    );

    const archivedResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({
        session_id: '17171717-1717-4717-8717-171717171717',
        message: 'Resume this chat.',
      })
      .expect(410);

    expect(gymChatService.sendMessage).toHaveBeenCalledWith(USERS.member.sub, {
      session_id: '17171717-1717-4717-8717-171717171717',
      message: 'Resume this chat.',
    });
    expect(archivedResponse.body).toEqual({
      type: 'SESSION_ARCHIVED',
      title: 'Gym Chat Session Archived',
      status: 410,
      detail:
        'This gym chat session was archived after more than 14 days of inactivity.',
    });

    const invalidSessionResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({
        session_id: 'not-a-uuid',
        message: 'Resume this chat.',
      })
      .expect(400);

    expect(invalidSessionResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'session_id must be a valid UUID',
    });

    const invalidMessageResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({ message: '   ' })
      .expect(400);

    expect(invalidMessageResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'message is required',
    });

    const overlongMessageResponse = await request(getHttpServer(app))
      .post('/v1/gym-chat/messages')
      .set('Authorization', 'Bearer member')
      .send({ message: 'x'.repeat(2001) })
      .expect(400);

    expect(overlongMessageResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'message must not exceed 2000 characters',
    });
    expect(gymChatService.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('validates the optional is_active session filter before service delegation', async () => {
    const invalidFilterResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/sessions?is_active=maybe')
      .set('Authorization', 'Bearer member')
      .expect(400);

    expect(gymChatService.getMySessions).not.toHaveBeenCalled();
    expect(invalidFilterResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'is_active must be a boolean value',
    });
  });
});



