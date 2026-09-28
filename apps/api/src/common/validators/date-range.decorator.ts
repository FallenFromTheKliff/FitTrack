import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

function parseDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

@ValidatorConstraint({ name: 'isOnOrAfter', async: false })
export class IsOnOrAfterConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    const [relatedPropertyName] = args.constraints as [string];
    const relatedValue = (args.object as Record<string, unknown>)[
      relatedPropertyName
    ];

    if (
      relatedValue === undefined ||
      relatedValue === null ||
      relatedValue === ''
    ) {
      return true;
    }

    const currentDate = parseDateInput(value);
    const relatedDate = parseDateInput(relatedValue);

    if (
      !currentDate ||
      !relatedDate ||
      Number.isNaN(currentDate.getTime()) ||
      Number.isNaN(relatedDate.getTime())
    ) {
      return true;
    }

    return currentDate.getTime() >= relatedDate.getTime();
  }

  defaultMessage(args: ValidationArguments): string {
    const [, relatedLabel] = args.constraints as [string, string];
    return `${args.property} must be on or after ${relatedLabel}`;
  }
}

export function IsOnOrAfter(
  relatedPropertyName: string,
  relatedLabel: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isOnOrAfter',
      target: target.constructor,
      propertyName: propertyName.toString(),
      constraints: [relatedPropertyName, relatedLabel],
      options: validationOptions,
      validator: IsOnOrAfterConstraint,
    });
  };
}
