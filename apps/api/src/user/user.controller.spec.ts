import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  const userService = {
    updateMyProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the authenticated user and partial profile DTO to the service', () => {
    const dto = { height_cm: 180 };
    userService.updateMyProfile.mockReturnValue({ ok: true });

    expect(
      controller.updateMyProfile({ sub: 'user-1' } as never, dto as never),
    ).toEqual({ ok: true });
    expect(userService.updateMyProfile).toHaveBeenCalledWith('user-1', dto);
  });
});
