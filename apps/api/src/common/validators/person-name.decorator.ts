import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from './trim-string.decorator';

export function IsPersonName(fieldLabel: string): PropertyDecorator {
  return applyDecorators(
    TrimString(),
    IsString({ message: `${fieldLabel} must be a string` }),
    IsNotEmpty({ message: `${fieldLabel} is required` }),
    MinLength(2, {
      message: `${fieldLabel} must be at least 2 characters long`,
    }),
    MaxLength(100, {
      message: `${fieldLabel} must not exceed 100 characters`,
    }),
  );
}
