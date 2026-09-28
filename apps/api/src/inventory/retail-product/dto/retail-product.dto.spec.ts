import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateRetailProductDTO,
  ProductFilterDTO,
  RestockProductDTO,
  UpdateRetailProductDTO,
} from './retail-product.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('RetailProduct DTO validation', () => {
  it('requires a name for retail product creation', async () => {
    const dto = plainToInstance(CreateRetailProductDTO, {
      price: 1499,
    });

    expect(extractMessages(await validate(dto))).toContain('name is required');
  });

  it('accepts retail product creation without an image URL', async () => {
    const dto = plainToInstance(CreateRetailProductDTO, {
      name: 'Whey Protein Isolate',
      price: 1499,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects non-positive retail product prices', async () => {
    const dto = plainToInstance(CreateRetailProductDTO, {
      name: 'Whey Protein Isolate',
      price: 0,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'price must be a positive number',
    );
  });

  it('accepts partial product updates', async () => {
    const dto = plainToInstance(UpdateRetailProductDTO, {
      category: 'recovery',
      is_active: false,
      image_url: 'https://cdn.fittrack.test/images/whey.png',
      stock_quantity: 4,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unsupported retail product categories', async () => {
    const dto = plainToInstance(CreateRetailProductDTO, {
      name: 'Whey Protein Isolate',
      price: 1499,
      category: 'fuel',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'category must be a supported inventory category',
    );
  });

  it('validates product browse filters and boolean coercion', async () => {
    const dto = plainToInstance(ProductFilterDTO, {
      page: 2,
      limit: 10,
      search: 'whey',
      in_stock_only: 'true',
    });

    expect(dto.in_stock_only).toBe(true);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects restock quantities below one', async () => {
    const dto = plainToInstance(RestockProductDTO, {
      quantity: 0,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'quantity must be at least 1',
    );
  });
});
