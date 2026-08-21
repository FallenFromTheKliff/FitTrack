import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IsAllowedEmail,
  IsOnOrAfter,
  IsOtpCode,
  IsPersonName,
  IsPhilippineMobileNumber,
  IsStrongPasswordField,
} from './index';

class AllowedEmailTestDto {
  @IsAllowedEmail('email')
  email!: string;
}

class StrongPasswordTestDto {
  @IsStrongPasswordField('password')
  password!: string;
}

class OtpCodeTestDto {
  @IsOtpCode('code')
  code!: string;
}

class PhoneTestDto {
  @IsPhilippineMobileNumber('phone')
  phone!: string;
}

class PersonNameTestDto {
  @IsPersonName('name')
  name!: string;
}

class DateRangeTestDto {
  @IsOnOrAfter('start_date', 'start_date', {
    message: 'end_date must be on or after start_date',
  })
  end_date?: string;

  start_date?: string;
}

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('shared validators', () => {
  it('accepts allowed email domains and rejects unsupported domains', async () => {
    const valid = plainToInstance(AllowedEmailTestDto, {
      email: 'member@gmail.com',
    });
    const invalid = plainToInstance(AllowedEmailTestDto, {
      email: 'member@example.org',
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(extractMessages(await validate(invalid))).toContain(
      'email must use an allowed provider domain',
    );
  });

  it('enforces the shared strong password policy', async () => {
    const valid = plainToInstance(StrongPasswordTestDto, {
      password: 'Password1!',
    });
    const invalid = plainToInstance(StrongPasswordTestDto, {
      password: 'Password1',
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(extractMessages(await validate(invalid))).toContain(
      'password must contain at least one symbol',
    );
  });

  it('requires OTP codes to be six digits', async () => {
    const valid = plainToInstance(OtpCodeTestDto, { code: '123456' });
    const invalid = plainToInstance(OtpCodeTestDto, { code: '12ab56' });

    expect(await validate(valid)).toHaveLength(0);
    expect(extractMessages(await validate(invalid))).toContain(
      'code must be a 6-digit number',
    );
  });

  it('requires a valid Philippine mobile number', async () => {
    const valid = plainToInstance(PhoneTestDto, { phone: '+639171234567' });
    const invalid = plainToInstance(PhoneTestDto, { phone: '09171234567' });

    expect(await validate(valid)).toHaveLength(0);
    expect(extractMessages(await validate(invalid))).toContain(
      'phone must be a valid Philippine mobile number in +639XXXXXXXXX format',
    );
  });

  it('allows Unicode letter names but rejects digits and symbols', async () => {
    const unicodeName = plainToInstance(PersonNameTestDto, {
      name: 'Élodie 张三',
    });
    const digitName = plainToInstance(PersonNameTestDto, {
      name: 'Maria2',
    });
    const symbolName = plainToInstance(PersonNameTestDto, {
      name: "O'Neil",
    });

    expect(await validate(unicodeName)).toHaveLength(0);
    expect(extractMessages(await validate(digitName))).toContain(
      'name may contain only Unicode letters and spaces',
    );
    expect(extractMessages(await validate(symbolName))).toContain(
      'name may contain only Unicode letters and spaces',
    );
  });

  it('rejects end dates earlier than start dates', async () => {
    const dto = plainToInstance(DateRangeTestDto, {
      start_date: '2026-03-20',
      end_date: '2026-03-19',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'end_date must be on or after start_date',
    );
  });
});
