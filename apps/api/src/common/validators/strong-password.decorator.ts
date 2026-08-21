import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { TrimString } from './trim-string.decorator';
import { STRONG_PASSWORD_REGEX } from './validation.constants';

export function IsStrongPasswordField(
  fieldLabel = 'password',
): PropertyDecorator {
  return applyDecorators(
    TrimString(),
    IsString({ message: `${fieldLabel} must be a string` }),
    IsNotEmpty({ message: `${fieldLabel} is required` }),
    MinLength(8, {
      message: `${fieldLabel} must be at least 8 characters long`,
    }),
    Matches(/[A-Z]/, {
      message: `${fieldLabel} must contain at least one uppercase letter`,
    }),
    Matches(/[a-z]/, {
      message: `${fieldLabel} must contain at least one lowercase letter`,
    }),
    Matches(/\d/, {
      message: `${fieldLabel} must contain at least one number`,
    }),
    Matches(STRONG_PASSWORD_REGEX, {
      message: `${fieldLabel} must contain at least one symbol`,
    }),
  );
}
