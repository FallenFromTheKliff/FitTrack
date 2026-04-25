import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAmenityDTO, UpdateAmenityDTO } from './dto/amenity.dto';
import { AmenityService } from './amenity.service';

@ApiTags('Bookings')
@Controller('bookings')
export class AmenityController {
  constructor(private readonly amenityService: AmenityService) {}

  @Get('amenities')
  @ApiOperation({ summary: 'List active amenities.' })
  listAmenities() {
    return this.amenityService.listAmenities();
  }

  @Get('amenities/archived')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List archived amenities. Admin only.' })
  listArchivedAmenities() {
    return this.amenityService.listArchivedAmenities();
  }

  @Get('amenities/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single active amenity.' })
  @ApiResponse({ status: 404, description: 'Amenity not found.' })
  getAmenityById(@Param('id', ParseUUIDPipe) id: string) {
    return this.amenityService.getAmenityById(id);
  }

  @Post('amenities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an amenity. Admin only.' })
  @ApiResponse({ status: 201, description: 'Amenity created.' })
  createAmenity(@Body() dto: CreateAmenityDTO) {
    return this.amenityService.createAmenity(dto);
  }

  @Patch('amenities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an amenity. Admin only.' })
  @ApiResponse({ status: 200, description: 'Amenity updated.' })
  @ApiResponse({ status: 404, description: 'Amenity not found.' })
  updateAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAmenityDTO,
  ) {
    return this.amenityService.updateAmenity(id, dto);
  }

  @Patch('amenities/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore an archived amenity. Admin only.' })
  @ApiResponse({ status: 200, description: 'Amenity restored.' })
  @ApiResponse({ status: 404, description: 'Amenity not found.' })
  restoreAmenity(@Param('id', ParseUUIDPipe) id: string) {
    return this.amenityService.restoreAmenity(id);
  }

  @Delete('amenities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete an amenity. Admin only.' })
  @ApiResponse({ status: 200, description: 'Amenity deleted.' })
  async deleteAmenity(@Param('id', ParseUUIDPipe) id: string) {
    await this.amenityService.deleteAmenity(id);
    return { message: 'Amenity deleted.' };
  }
}
