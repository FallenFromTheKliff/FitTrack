import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { TrimString } from './trim-string.decorator';

export function IsPhilippineMobileNumber(
  fieldLabel = 'phone number',
): PropertyDecorator {
  return applyDecorators(
    TrimString(),
    IsString({ message: `${fieldLabel} must be a string` }),
    IsNotEmpty({ message: `${fieldLabel} is required` }),
    Matches(/^\+639\d{9}$/, {
      message: `${fieldLabel} must be a valid Philippine mobile number in +639XXXXXXXXX format`,
    }),
  );
}
