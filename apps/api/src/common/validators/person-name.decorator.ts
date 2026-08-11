import { applyDecorators } from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TrimString } from './trim-string.decorator';

export function IsPersonName(fieldLabel: string): PropertyDecorator {
  return applyDecorators(
    TrimString(),
    IsString({ message: `${fieldLabel} must be a string` }),
    IsNotEmpty({ message: `${fieldLabel} is required` }),
    MinLength(2, {
      message: `${fieldLabel} must be at least 2 characters long`,
    }),
    Matches(/^[\p{L}]+(?:[ \p{L}]*[\p{L}])?$/u, {
      message: `${fieldLabel} may contain only Unicode letters and spaces`,
    }),
    MaxLength(100, {
      message: `${fieldLabel} must not exceed 100 characters`,
    }),
  );
}
