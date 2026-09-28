import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { RequestWithCookies } from '../common/types/request.types';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    login: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('throws UnauthorizedException when refresh cookie is missing', async () => {
    const req: RequestWithCookies = {
      cookies: {},
    } as RequestWithCookies;
    const res = {} as Response;

    await expect(controller.refresh(req, undefined, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('falls back to the refresh token provided in the request body', async () => {
    const req: RequestWithCookies = {
      cookies: {},
    } as RequestWithCookies;
    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    authService.refresh.mockResolvedValue({
      access_token: 'next-access',
      _refresh_token: 'next-refresh',
      user: {
        id: 'user-1',
        role: 'member',
        status: 'active',
        email_verified_at: null,
        profile: {
          first_name: 'Ava',
          last_name: 'Rivera',
          avatar_url: null,
        },
      },
    });

    const result = await controller.refresh(
      req,
      { refresh_token: 'body-refresh-token' },
      res,
    );

    expect(authService.refresh).toHaveBeenCalledWith('body-refresh-token');
    expect(result).toEqual(
      expect.objectContaining({
        access_token: 'next-access',
        refresh_token: 'next-refresh',
      }),
    );
  });

  it('returns login OTP challenges without setting a refresh cookie', async () => {
    const req = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as Request;
    const res = {
      cookie: jest.fn(),
    } as unknown as Response;
    const challenge = {
      otpRequired: true,
      user_id: 'staff-1',
      email: 'staff@example.com',
      role: 'staff',
    };

    authService.login.mockResolvedValue(challenge);

    await expect(
      controller.login(
        {
          email: 'staff@example.com',
          password: 'Password1!',
          portal: 'team',
        },
        req,
        res,
      ),
    ).resolves.toEqual(challenge);
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
