import {
  Body,
  Controller,
  GoneException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CoachService } from './coach.service';
import {
  AdminCoachDetailResponseDTO,
  CoachAvailabilitySlotResponseDTO,
  CoachDetailResponseDTO,
  CoachFilterDTO,
  CoachListItemResponseDTO,
  CoachSelfDetailResponseDTO,
  CoachSelfUserResponseDTO,
  CoachSelfUpdateProfileDTO,
  CoachUserProfileResponseDTO,
  UpdateCoachProfileDTO,
} from './dto/coach.dto';

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
  };
}

function paginatedEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: itemSchemaRef },
      },
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

@ApiTags('Coaching')
@ApiExtraModels(
  CoachListItemResponseDTO,
  CoachDetailResponseDTO,
  AdminCoachDetailResponseDTO,
  CoachSelfDetailResponseDTO,
  CoachSelfUserResponseDTO,
  CoachUserProfileResponseDTO,
  CoachAvailabilitySlotResponseDTO,
)
@Controller('coaching')
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  @Get('coaches')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Browse coaches.' })
  @ApiResponse({
    status: 200,
    description: 'Coaches returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(CoachListItemResponseDTO)),
  })
  listCoaches(@Query() dto: CoachFilterDTO) {
    return this.coachService.listCoaches(dto);
  }

  @Get('coaches/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the authenticated coach profile.' })
  @ApiResponse({
    status: 200,
    description: 'Coach profile returned.',
    schema: apiEnvelopeSchema(getSchemaPath(CoachSelfDetailResponseDTO)),
  })
  getMyProfile() {
    throw new GoneException(
      'Coach user accounts are no longer supported. Use staff-managed coach profiles.',
    );
  }

  @Get('coaches/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a coach profile with active availability.' })
  @ApiResponse({
    status: 200,
    description: 'Coach profile returned.',
    schema: apiEnvelopeSchema(getSchemaPath(CoachDetailResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Coach profile not found.' })
  getCoachById(@Param('id', ParseUUIDPipe) id: string) {
    return this.coachService.getCoachById(id);
  }

  @Patch('coaches/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the authenticated coach profile.' })
  @ApiBody({ type: CoachSelfUpdateProfileDTO })
  @ApiResponse({
    status: 200,
    description: 'Coach profile updated.',
    schema: apiEnvelopeSchema(getSchemaPath(CoachDetailResponseDTO)),
  })
  updateMyProfile() {
    throw new GoneException(
      'Coach user accounts are no longer supported. Use staff-managed coach profiles.',
    );
  }

  @Patch('coaches/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a coach profile. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Coach profile updated.',
    schema: apiEnvelopeSchema(getSchemaPath(AdminCoachDetailResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Coach profile not found.' })
  updateCoachById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoachProfileDTO,
  ) {
    return this.coachService.adminUpdateCoach(user.sub, id, dto);
  }
}
