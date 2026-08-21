import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { TrimString } from './trim-string.decorator';
import { OTP_CODE_REGEX } from './validation.constants';

export function IsOtpCode(fieldLabel = 'code'): PropertyDecorator {
  return applyDecorators(
    TrimString(),
    IsString({ message: `${fieldLabel} must be a string` }),
    IsNotEmpty({ message: `${fieldLabel} is required` }),
    Matches(OTP_CODE_REGEX, {
      message: `${fieldLabel} must be a 6-digit number`,
    }),
  );
}
