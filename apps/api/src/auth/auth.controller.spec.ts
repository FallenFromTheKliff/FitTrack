import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { RequestWithCookies } from '../common/types/request.types';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
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

    await expect(controller.refresh(req, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authService.refresh).not.toHaveBeenCalled();
  });
});
