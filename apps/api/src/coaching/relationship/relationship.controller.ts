import {
  Body,
  Controller,
  GoneException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
  CoachingReviewResponseDTO,
  CreateReviewDTO,
  RelationshipCoachSummaryResponseDTO,
  RelationshipMemberSummaryResponseDTO,
  RelationshipResponseDTO,
  RelationshipUserProfileResponseDTO,
  RequestRelationshipDTO,
} from './dto/relationship.dto';
import { RelationshipService } from './relationship.service';

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
  RelationshipResponseDTO,
  RelationshipCoachSummaryResponseDTO,
  RelationshipMemberSummaryResponseDTO,
  RelationshipUserProfileResponseDTO,
  CoachingReviewResponseDTO,
)
@Controller('coaching')
export class RelationshipController {
  constructor(private readonly relationshipService: RelationshipService) {}

  @Post('relationships')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Request a formal coaching relationship.' })
  @ApiResponse({
    status: 201,
    description: 'Relationship request created.',
    schema: apiEnvelopeSchema(getSchemaPath(RelationshipResponseDTO)),
  })
  requestRelationship(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestRelationshipDTO,
  ) {
    return this.relationshipService.requestRelationship(user.sub, dto);
  }

  @Get('relationships/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the authenticated members coaching relationships.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relationships returned.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(RelationshipResponseDTO) },
        },
      },
    },
  })
  getMyRelationships(@CurrentUser() user: JwtPayload) {
    return this.relationshipService.getMyRelationships(user.sub);
  }

  @Get('clients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Deprecated coach-user client relationship endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Coach client relationships returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(RelationshipResponseDTO)),
  })
  getMyClients() {
    throw new GoneException(
      'Coach user relationship endpoints are no longer supported.',
    );
  }

  @Patch('relationships/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Deprecated coach-user relationship update endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relationship updated.',
    schema: apiEnvelopeSchema(getSchemaPath(RelationshipResponseDTO)),
  })
  updateRelationship(@Param('id', ParseUUIDPipe) id: string) {
    throw new GoneException(
      `Coach user relationship updates are no longer supported for relationship ${id}.`,
    );
  }

  @Post('coaches/:id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit a review for a completed coaching appointment.',
  })
  @ApiResponse({
    status: 201,
    description: 'Review submitted.',
    schema: apiEnvelopeSchema(getSchemaPath(CoachingReviewResponseDTO)),
  })
  submitReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewDTO,
  ) {
    return this.relationshipService.submitReview(user.sub, id, dto);
  }

  @Get('coaches/me/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.coach)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List feedback submitted for the authenticated coach.',
  })
  @ApiResponse({
    status: 200,
    description: 'Coach reviews returned.',
  })
  getMyReceivedReviews(@CurrentUser() user: JwtPayload) {
    return this.relationshipService.getMyReceivedReviews(user.sub);
  }
}
