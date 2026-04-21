declare module 'class-validator' {
  export interface ValidationArguments {
    value: unknown;
    constraints: unknown[];
    targetName: string;
    object: object;
    property: string;
  }

  export interface ValidationOptions {
    each?: boolean;
    always?: boolean;
    groups?: string[];
    message?: string | ((args: ValidationArguments) => string);
    context?: Record<string, unknown>;
  }

  export interface ValidationError {
    target?: object;
    property: string;
    value?: unknown;
    constraints?: Record<string, string>;
    children?: ValidationError[];
    contexts?: Record<string, Record<string, unknown>>;
  }

  export interface ValidatorOptions {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    skipMissingProperties?: boolean;
    skipNullProperties?: boolean;
    skipUndefinedProperties?: boolean;
    stopAtFirstError?: boolean;
    groups?: string[];
    dismissDefaultMessages?: boolean;
    validationError?: {
      target?: boolean;
      value?: boolean;
    };
    forbidUnknownValues?: boolean;
  }

  export interface ValidatorConstraintInterface {
    validate(
      value: unknown,
      validationArguments?: ValidationArguments,
    ): boolean | Promise<boolean>;
    defaultMessage?(validationArguments?: ValidationArguments): string;
  }

  export interface ValidatorConstraintOptions {
    name?: string;
    async?: boolean;
  }

  export interface ValidationDecoratorOptions {
    name: string;
    target: Function;
    propertyName: string;
    options?: ValidationOptions;
    constraints?: unknown[];
    validator: Function | ValidatorConstraintInterface;
    async?: boolean;
  }

  type ValidationDecorator = (...args: readonly unknown[]) => PropertyDecorator;
  type UuidVersion = '3' | '4' | '5' | 'all' | 3 | 4 | 5;

  export function validate(
    object: object,
    validatorOptions?: ValidatorOptions,
  ): Promise<ValidationError[]>;
  export function validateSync(
    object: object,
    validatorOptions?: ValidatorOptions,
  ): ValidationError[];
  export function isUUID(value: unknown, version?: UuidVersion): boolean;
  export function registerDecorator(
    options: ValidationDecoratorOptions,
  ): void;
  export function ValidatorConstraint(
    options?: ValidatorConstraintOptions,
  ): ClassDecorator;

  export const ArrayMaxSize: ValidationDecorator;
  export const ArrayMinSize: ValidationDecorator;
  export const IsArray: ValidationDecorator;
  export const IsBoolean: ValidationDecorator;
  export const IsDateString: ValidationDecorator;
  export const IsEmail: ValidationDecorator;
  export const IsEnum: ValidationDecorator;
  export const IsISO8601: ValidationDecorator;
  export const IsIn: ValidationDecorator;
  export const IsInt: ValidationDecorator;
  export const IsMilitaryTime: ValidationDecorator;
  export const IsNotEmpty: ValidationDecorator;
  export const IsNumber: ValidationDecorator;
  export const IsObject: ValidationDecorator;
  export const IsOptional: ValidationDecorator;
  export const IsPositive: ValidationDecorator;
  export const IsString: ValidationDecorator;
  export const IsUUID: ValidationDecorator;
  export const IsUrl: ValidationDecorator;
  export const Matches: ValidationDecorator;
  export const Max: ValidationDecorator;
  export const MaxLength: ValidationDecorator;
  export const Min: ValidationDecorator;
  export const MinLength: ValidationDecorator;
  export const ValidateIf: ValidationDecorator;
  export const ValidateNested: ValidationDecorator;
}
