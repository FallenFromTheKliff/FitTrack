import {
  HttpCode,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CancelSubscriptionDTO,
  CreateSubscriptionDTO,
  CreatePlanDTO,
  CurrentSubscriptionResponseDTO,
  FreeDayPassLifecycleResponseDTO,
  FreeDayPassEligibilityResponseDTO,
  GrantFreeDayPassDTO,
  MembershipAccessCandidatesQueryDTO,
  MembershipAccessCandidateResponseDTO,
  MembershipOperationsDashboardResponseDTO,
  MembershipPlanResponseDTO,
  MembershipCatalogSettingsResponseDTO,
  OnsiteMembershipCandidateFilterDTO,
  OnsiteMembershipCandidateResponseDTO,
  PaginationDTO,
  RecordCashMembershipDTO,
  RecordCashMembershipResponseDTO,
  RevokeMembershipSubscriptionDTO,
  RevokeMembershipSubscriptionResponseDTO,
  RevokeFreeDayPassDTO,
  SubscriptionCheckoutResponseDTO,
  UpdateMembershipCatalogSettingsDTO,
  UpdatePlanDTO,
} from './dto/subscription.dto';
import { SubscriptionService } from './subscription.service';

const paginationMetaSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', example: 1 },
    limit: { type: 'number', example: 20 },
    total: { type: 'number', example: 1 },
    total_pages: { type: 'number', example: 1 },
  },
  required: ['page', 'limit', 'total', 'total_pages'],
};

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
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
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Membership')
@ApiExtraModels(
  MembershipPlanResponseDTO,
  MembershipCatalogSettingsResponseDTO,
  CurrentSubscriptionResponseDTO,
  FreeDayPassEligibilityResponseDTO,
  MembershipOperationsDashboardResponseDTO,
  SubscriptionCheckoutResponseDTO,
  RecordCashMembershipResponseDTO,
  MembershipAccessCandidateResponseDTO,
  FreeDayPassLifecycleResponseDTO,
  OnsiteMembershipCandidateResponseDTO,
  RevokeMembershipSubscriptionResponseDTO,
)
@Controller('membership')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active membership plans.' })
  @ApiResponse({
    status: 200,
    description: 'Membership plans returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(MembershipPlanResponseDTO)),
  })
  listPlans(@Query() dto: PaginationDTO) {
    return this.subscriptionService.listPlans(dto);
  }

  @Get('plans/management')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active and inactive plans for staff.' })
  @ApiResponse({
    status: 200,
    description: 'Membership plan management catalog returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(MembershipPlanResponseDTO)),
  })
  listManagementPlans(@Query() dto: PaginationDTO) {
    return this.subscriptionService.listManagementPlans(dto);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a single active membership plan.' })
  @ApiResponse({
    status: 200,
    description: 'Membership plan returned.',
    schema: apiEnvelopeSchema(getSchemaPath(MembershipPlanResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Membership plan not found.' })
  getPlanById(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionService.getPlanById(id);
  }

  @Get('catalog-settings')
  @ApiOperation({
    summary: 'Get live membership catalog settings for plan and card pricing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Membership catalog settings returned.',
    schema: apiEnvelopeSchema(
      getSchemaPath(MembershipCatalogSettingsResponseDTO),
    ),
  })
  getCatalogSettings() {
    return this.subscriptionService.getCatalogSettings();
  }

  @Get('operations-dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get memberships operations dashboard metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Membership operations dashboard returned.',
    schema: apiEnvelopeSchema(
      getSchemaPath(MembershipOperationsDashboardResponseDTO),
    ),
  })
  getOperationsDashboard() {
    return this.subscriptionService.getOperationsDashboard();
  }

  @Get('my-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the authenticated users current subscription.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current subscription returned, or null when none exists.',
    schema: {
      type: 'object',
      properties: {
        data: {
          anyOf: [
            { $ref: getSchemaPath(CurrentSubscriptionResponseDTO) },
            { type: 'null' },
          ],
        },
      },
      required: ['data'],
    },
  })
  getMySubscription(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.getMySubscription(user.sub);
  }

  @Get('free-day-pass-eligibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the authenticated members free one-day pass eligibility.',
  })
  @ApiResponse({
    status: 200,
    description: 'Free one-day pass eligibility returned.',
    type: FreeDayPassEligibilityResponseDTO,
  })
  getFreeDayPassEligibility(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.getFreeDayPassEligibility(user.sub);
  }

  @Post('cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cancel the authenticated users current subscription.',
  })
  @ApiResponse({ status: 200, description: 'Subscription cancelled.' })
  cancelSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelSubscriptionDTO,
  ) {
    return this.subscriptionService.cancelSubscription(user.sub, dto);
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 generated by the client and reused on retries.',
  })
  @ApiOperation({
    summary: 'Create a pending subscription and start PayMongo checkout.',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created or resumed.',
    type: SubscriptionCheckoutResponseDTO,
  })
  @ApiResponse({
    status: 409,
    description: 'Member already has an active or pending subscription.',
  })
  subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubscriptionDTO,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.subscriptionService.subscribe(user.sub, dto, idempotencyKey);
  }

  @Post('onsite-sale')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 generated by the staff client and reused on retries.',
  })
  @ApiOperation({
    summary: 'Record an atomic onsite cash membership sale. Admin/Staff only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cash membership sale recorded.',
    type: RecordCashMembershipResponseDTO,
  })
  recordCashMembership(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordCashMembershipDTO,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.subscriptionService.recordCashMembership(
      user.sub,
      dto,
      idempotencyKey,
    );
  }

  @Get('access-management/candidates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List server-filtered membership access grant or revoke candidates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligible membership access candidates returned.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(MembershipAccessCandidateResponseDTO) },
        },
      },
      required: ['data'],
    },
  })
  listMembershipAccessCandidates(
    @Query() dto: MembershipAccessCandidatesQueryDTO,
  ) {
    return this.subscriptionService.listMembershipAccessCandidates(dto);
  }

  @Post('access-management/free-day-pass/grant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Grant an explicit free one-day pass.' })
  @ApiResponse({
    status: 201,
    description: 'Free one-day pass granted.',
    type: FreeDayPassLifecycleResponseDTO,
  })
  grantFreeDayPass(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GrantFreeDayPassDTO,
  ) {
    return this.subscriptionService.grantFreeDayPass(user.sub, dto);
  }

  @Patch('access-management/free-day-pass/:memberId/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a current unused free one-day pass.' })
  @ApiResponse({
    status: 200,
    description: 'Free one-day pass revoked.',
    type: FreeDayPassLifecycleResponseDTO,
  })
  revokeFreeDayPass(
    @CurrentUser() user: JwtPayload,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: RevokeFreeDayPassDTO,
  ) {
    return this.subscriptionService.revokeFreeDayPass(user.sub, memberId, dto);
  }

  @Get('onsite-sale/candidates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List eligible onsite membership grant or revoke candidates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligible onsite membership candidates returned.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(OnsiteMembershipCandidateResponseDTO) },
        },
      },
      required: ['data'],
    },
  })
  listOnsiteSaleCandidates(@Query() dto: OnsiteMembershipCandidateFilterDTO) {
    return this.subscriptionService.listOnsiteSaleCandidates(dto);
  }

  @Patch('subscriptions/:id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke current Gym Membership access. Admin/Staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym Membership access revoked.',
    type: RevokeMembershipSubscriptionResponseDTO,
  })
  @ApiResponse({
    status: 409,
    description: 'Subscription is not a current Gym Membership grant.',
  })
  revokeMembershipSubscription(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeMembershipSubscriptionDTO,
  ) {
    return this.subscriptionService.revokeMembershipSubscription(
      user.sub,
      id,
      dto,
    );
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a membership plan. Admin/Staff only.' })
  @ApiResponse({ status: 201, description: 'Membership plan created.' })
  createPlan(@Body() dto: CreatePlanDTO) {
    return this.subscriptionService.createPlan(dto);
  }

  @Patch('plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a membership plan. Admin/Staff only.' })
  @ApiResponse({ status: 200, description: 'Membership plan updated.' })
  @ApiResponse({ status: 404, description: 'Membership plan not found.' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDTO,
  ) {
    return this.subscriptionService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete an unreferenced membership plan. Admin/Staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Membership plan deleted.',
  })
  @ApiResponse({
    status: 409,
    description: 'Membership plan has membership history and cannot be deleted.',
  })
  deletePlan(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.subscriptionService.deletePlan(id);
  }

  @Patch('catalog-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Update shared membership catalog settings such as the membership-card price. Admin/Staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Membership catalog settings updated.',
    schema: apiEnvelopeSchema(
      getSchemaPath(MembershipCatalogSettingsResponseDTO),
    ),
  })
  updateCatalogSettings(@Body() dto: UpdateMembershipCatalogSettingsDTO) {
    return this.subscriptionService.updateCatalogSettings(dto);
  }
}
