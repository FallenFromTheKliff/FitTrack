import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export type CommerceCheckoutReturnTarget = 'web' | 'expo_web' | 'mobile';

export type CommerceCheckoutFlow =
  | 'membership-card'
  | 'membership-subscription'
  | 'coach-single'
  | 'coach-monthly'
  | 'venue-booking';

export type CommerceCheckoutReturnInput = {
  returnTarget?: CommerceCheckoutReturnTarget;
  returnUrl?: string;
};

export class CommerceCheckoutReturnInputDTO {
  @ApiPropertyOptional({
    enum: ['web', 'expo_web', 'mobile'],
    default: 'web',
  })
  @Transform(({ value }) => (value === undefined ? 'web' : value))
  @IsOptional()
  @IsIn(['web', 'expo_web', 'mobile'], {
    message: 'return_target must be one of: web, expo_web, mobile',
  })
  return_target?: CommerceCheckoutReturnTarget;

  @ApiPropertyOptional({
    example:
      'http://localhost:19006/checkout/return?checkoutId=cs_123&session=abc',
    description:
      'Required when return_target is expo_web; must be an absolute HTTP/HTTPS URL.',
  })
  @ValidateIf(
    (dto: CommerceCheckoutReturnInputDTO) =>
      dto.return_target === 'expo_web',
  )
  @IsString({ message: 'return_url must be a string' })
  @IsNotEmpty({
    message: 'return_url is required when return_target is expo_web',
  })
  @MaxLength(2048, {
    message: 'return_url must not exceed 2048 characters',
  })
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    {
      message:
        'return_url must be a valid absolute URL with an http or https protocol',
    },
  )
  return_url?: string;
}
