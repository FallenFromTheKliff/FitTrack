import {
  CanActivate,
  ExecutionContext,
  Injectable,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PoseController } from '../src/fitness/pose/pose.controller';
import { PoseService } from '../src/fitness/pose/pose.service';

type PoseServiceMethods =
  | 'getPoseSessionById'
  | 'finalizePoseSessionById'
  | 'listPoseProfiles';

type PoseServiceMock = jest.Mocked<Pick<PoseService, PoseServiceMethods>>;

const USERS: Record<'admin' | 'member', JwtPayload> = {
  admin: {
    sub: '11111111-1111-4111-8111-111111111111',
    role: UserRole.admin,
    status: UserStatus.active,
    jti: 'admin-jti',
    iat: 1,
    exp: 9999999999,
  },
  member: {
    sub: '22222222-2222-4222-8222-222222222222',
    role: UserRole.member,
    status: UserStatus.active,
    jti: 'member-jti',
    iat: 1,
    exp: 9999999999,
  },
};

const FINALIZED_POSE_SESSION_RESPONSE = {
  id: '33333333-3333-4333-8333-333333333333',
  user_id: USERS.member.sub,
  exercise_log_id: null,
  exercise_hint: 'Barbell Back Squat',
  rep_count_ai: 12,
  confidence_avg: '0.925',
  detected_exercise_name: 'squat',
  detected_profile_id: '55555555-5555-4555-8555-555555555555',
  classification_confidence: '0.944',
  subject_lock_confidence: '0.887',
  analysis_summary: {
    reps_detected: 12,
    form_feedback: ['Keep your chest up.'],
  },
  started_at: '2026-03-27T08:00:00.000Z',
  ended_at: '2026-03-27T08:03:00.000Z',
  created_at: '2026-03-27T08:00:00.000Z',
  updated_at: '2026-03-27T08:03:00.000Z',
};

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

    const actor = authorization.slice('Bearer '.length).trim() as
      | 'admin'
      | 'member';
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

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

function getProblemDetail(response: request.Response): string {
  const payload = response.body as { detail?: unknown };

  return typeof payload.detail === 'string' ? payload.detail : '';
}

describe('PoseController (integration)', () => {
  let app: INestApplication;
  let poseService: PoseServiceMock;

  beforeAll(async () => {
    poseService = {
      getPoseSessionById: jest.fn(),
      finalizePoseSessionById: jest.fn(),
      listPoseProfiles: jest.fn(),
    };

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [PoseController],
      providers: [
        Reflector,
        { provide: PoseService, useValue: poseService },
        JwtAuthGuard,
        RolesGuard,
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

  it('returns 200 and the finalized session envelope on successful finalize', async () => {
    poseService.finalizePoseSessionById.mockResolvedValue(
      FINALIZED_POSE_SESSION_RESPONSE,
    );

    const response = await request(getHttpServer(app))
      .post('/v1/pose/sessions/33333333-3333-4333-8333-333333333333/finalize')
      .set('Authorization', 'Bearer member')
      .send({
        ended_reason: 'manual_stop',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: FINALIZED_POSE_SESSION_RESPONSE,
    });
    expect(poseService.finalizePoseSessionById).toHaveBeenCalledWith(
      USERS.member.sub,
      '33333333-3333-4333-8333-333333333333',
      { ended_reason: 'manual_stop' },
    );
  });

  it('rejects invalid finalize reasons before reaching the pose service', async () => {
    const response = await request(getHttpServer(app))
      .post('/v1/pose/sessions/33333333-3333-4333-8333-333333333333/finalize')
      .set('Authorization', 'Bearer member')
      .send({
        ended_reason: 'timeout_stop',
      })
      .expect(400);

    expect(poseService.finalizePoseSessionById).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      type: 'BAD_REQUEST',
      status: 400,
    });
    expect(getProblemDetail(response)).toContain('ended_reason must be one of');
  });

  it('forbids member access to pose profile listing', async () => {
    await request(getHttpServer(app))
      .get('/v1/pose/profiles')
      .set('Authorization', 'Bearer member')
      .expect(403);

    expect(poseService.listPoseProfiles).not.toHaveBeenCalled();
  });

  it('rejects invalid pose profile filters before reaching the service', async () => {
    const response = await request(getHttpServer(app))
      .get('/v1/pose/profiles?profile_kind=invalid-kind&page=1&limit=20')
      .set('Authorization', 'Bearer admin')
      .expect(400);

    expect(poseService.listPoseProfiles).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      type: 'BAD_REQUEST',
      status: 400,
    });
    expect(getProblemDetail(response)).toContain('profile_kind must be one of');
  });
});
