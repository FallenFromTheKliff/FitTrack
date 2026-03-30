import { applyDecorators } from '@nestjs/common';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { TrimString } from './trim-string.decorator';
import { ALLOWED_EMAIL_DOMAINS } from './validation.constants';

@ValidatorConstraint({ name: 'allowedEmailDomain', async: false })
export class AllowedEmailDomainConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const parts = value.trim().toLowerCase().split('@');
    if (parts.length !== 2) {
      return false;
    }

    return ALLOWED_EMAIL_DOMAINS.includes(
      parts[1] as (typeof ALLOWED_EMAIL_DOMAINS)[number],
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must use an allowed provider domain`;
  }
}

export function HasAllowedEmailDomain(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'hasAllowedEmailDomain',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: AllowedEmailDomainConstraint,
    });
  };
}

export function IsAllowedEmail(fieldLabel = 'email'): PropertyDecorator {
  return applyDecorators(
    TrimString(),
    IsString({ message: `${fieldLabel} must be a string` }),
    IsNotEmpty({ message: `${fieldLabel} is required` }),
    MaxLength(255, {
      message: `${fieldLabel} must not exceed 255 characters`,
    }),
    IsEmail({}, { message: `${fieldLabel} must be a valid email address` }),
    HasAllowedEmailDomain({
      message: `${fieldLabel} must use an allowed provider domain`,
    }),
  );
}
