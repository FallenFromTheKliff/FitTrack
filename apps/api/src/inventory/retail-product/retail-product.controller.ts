import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateRetailProductDTO,
  ProductFilterDTO,
  RestockProductDTO,
  RetailProductResponseDTO,
  UpdateRetailProductDTO,
} from './dto/retail-product.dto';
import { RetailProductService } from './retail-product.service';

function apiEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: ref },
    },
  };
}

function paginatedEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: { $ref: ref } },
      meta: {
        type: 'object',
        properties: {
          page: { type: 'number', example: 1 },
          limit: { type: 'number', example: 20 },
          total: { type: 'number', example: 1 },
          total_pages: { type: 'number', example: 1 },
        },
      },
    },
  };
}

@ApiTags('Inventory')
@ApiExtraModels(RetailProductResponseDTO)
@Controller('inventory')
export class RetailProductController {
  constructor(private readonly retailProductService: RetailProductService) {}

  @Get('products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active retail products.' })
  @ApiResponse({
    status: 200,
    description: 'Retail products returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(RetailProductResponseDTO)),
  })
  listProducts(@Query() dto: ProductFilterDTO) {
    return this.retailProductService.listProducts(dto);
  }

  @Get('products/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single active retail product.' })
  @ApiResponse({
    status: 200,
    description: 'Retail product returned.',
    schema: apiEnvelopeSchema(getSchemaPath(RetailProductResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Retail product not found.' })
  getProductById(@Param('id', ParseUUIDPipe) id: string) {
    return this.retailProductService.getProductById(id);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateRetailProductDTO })
  @ApiOperation({ summary: 'Create a retail product. Admin only.' })
  @ApiResponse({
    status: 201,
    description: 'Retail product created.',
    schema: apiEnvelopeSchema(getSchemaPath(RetailProductResponseDTO)),
  })
  createProduct(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRetailProductDTO,
  ) {
    return this.retailProductService.createProduct(user.sub, dto);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateRetailProductDTO })
  @ApiOperation({
    summary: 'Update or deactivate a retail product. Admin and staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retail product updated.',
    schema: apiEnvelopeSchema(getSchemaPath(RetailProductResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Retail product not found.' })
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRetailProductDTO,
  ) {
    return this.retailProductService.updateProduct(user.sub, id, dto);
  }

  @Post('products/:id/restock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: RestockProductDTO })
  @ApiOperation({ summary: 'Restock a retail product. Admin and staff only.' })
  @ApiResponse({
    status: 201,
    description: 'Retail product restocked.',
    schema: apiEnvelopeSchema(getSchemaPath(RetailProductResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Retail product not found.' })
  restockProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestockProductDTO,
  ) {
    return this.retailProductService.restockProduct(user.sub, id, dto);
  }
}
