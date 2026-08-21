import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TrimString } from '../../../common/validators/trim-string.decorator';
import { PaginationDTO } from '../../../user/dto/user-dto';

function transformBooleanInput(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return value;
}

const RETAIL_PRODUCT_CATEGORY_VALUES = [
  'supplements',
  'beverages',
  'snacks',
  'accessories',
  'recovery',
  'merchandise',
  'other',
] as const;

function retailProductCategoryEnum() {
  return [...RETAIL_PRODUCT_CATEGORY_VALUES];
}

export class CreateRetailProductDTO {
  @ApiProperty({ example: 'Whey Protein Isolate' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({
    example: 'Vanilla whey isolate tub with 30 servings.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example: 'supplements',
    enum: retailProductCategoryEnum(),
    default: 'other',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'category must be a string' })
  @IsIn(retailProductCategoryEnum(), {
    message: 'category must be a supported inventory category',
  })
  category?: (typeof RETAIL_PRODUCT_CATEGORY_VALUES)[number];

  @ApiProperty({ example: 1499 })
  @Type(() => Number)
  @IsPositive({ message: 'price must be a positive number' })
  price: number;

  @ApiPropertyOptional({ example: 899, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'cost must be at least 0' })
  cost?: number;

  @ApiPropertyOptional({ example: 25, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'stock_quantity must be an integer' })
  @Min(0, { message: 'stock_quantity must be at least 0' })
  stock_quantity?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reorder_threshold must be an integer' })
  @Min(0, { message: 'reorder_threshold must be at least 0' })
  reorder_threshold?: number;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/whey-isolate.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url?: string;
}

export class UpdateRetailProductDTO {
  @ApiPropertyOptional({ example: 'Whey Protein Isolate' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Vanilla whey isolate tub with 30 servings.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example: 'supplements',
    enum: retailProductCategoryEnum(),
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'category must be a string' })
  @IsIn(retailProductCategoryEnum(), {
    message: 'category must be a supported inventory category',
  })
  category?: (typeof RETAIL_PRODUCT_CATEGORY_VALUES)[number];

  @ApiPropertyOptional({ example: 1499 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'price must be a positive number' })
  price?: number;

  @ApiPropertyOptional({ example: 899 })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'cost must be at least 0' })
  cost?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reorder_threshold must be an integer' })
  @Min(0, { message: 'reorder_threshold must be at least 0' })
  reorder_threshold?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'stock_quantity must be an integer' })
  @Min(0, { message: 'stock_quantity must be at least 0' })
  stock_quantity?: number;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/whey-isolate.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}

export class RestockProductDTO {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;

  @ApiPropertyOptional({ example: 'Delivered from supplier.', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}

export class ProductFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({
    example: 'whey',
    description: 'Searches active product names and descriptions.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => transformBooleanInput(value))
  @IsBoolean({ message: 'in_stock_only must be a boolean value' })
  in_stock_only?: boolean;
}

export class RetailProductResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Whey Protein Isolate' })
  name: string;

  @ApiProperty({
    example: 'supplements',
    enum: retailProductCategoryEnum(),
  })
  category: string;

  @ApiPropertyOptional({
    example: 'Vanilla whey isolate tub with 30 servings.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: '1499.00' })
  price: string;

  @ApiProperty({ example: '899.00' })
  cost: string;

  @ApiProperty({ example: 25 })
  stock_quantity: number;

  @ApiProperty({ example: 10 })
  reorder_threshold: number;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/whey-isolate.png',
    nullable: true,
  })
  image_url: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T03:00:00.000Z' })
  updated_at: string;
}
