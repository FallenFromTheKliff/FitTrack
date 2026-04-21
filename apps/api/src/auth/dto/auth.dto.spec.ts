import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminCreateUserDTO,
  LoginDTO,
  RegisterDTO,
  ResetPasswordDTO,
  VerifyResetOtpDTO,
} from './auth.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Auth DTO validation', () => {
  it('rejects unsupported email domains during registration', async () => {
    const dto = plainToInstance(RegisterDTO, {
      email: 'user@example.org',
      password: 'Password1!',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'email must use an allowed provider domain',
    );
  });

  it('rejects weak admin passwords that do not contain a symbol', async () => {
    const dto = plainToInstance(AdminCreateUserDTO, {
      email: 'member@fittrack.com',
      password: 'Password1',
      first_name: 'Maria',
      last_name: 'Santos',
      role: 'member',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'password must contain at least one symbol',
    );
  });

  it('allows login with an allowed email domain without strong-password enforcement', async () => {
    const dto = plainToInstance(LoginDTO, {
      email: 'member@gmail.com',
      password: 'simple-login-password',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects reset-password OTP values that are not six digits', async () => {
    const dto = plainToInstance(ResetPasswordDTO, {
      email: 'member@gmail.com',
      code: '12ab56',
      new_password: 'Password1!',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'code must be a 6-digit number',
    );
  });

  it('rejects verify-reset-otp codes that are not six digits', async () => {
    const dto = plainToInstance(VerifyResetOtpDTO, {
      email: 'member@gmail.com',
      code: 'abc123',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'code must be a 6-digit number',
    );
  });
});
