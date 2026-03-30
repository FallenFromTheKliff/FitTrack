import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DateRangeDTO, PaginationDTO } from '../user/dto/user-dto';
import {
  ActiveTdeeResponseDTO,
  DailyMacroTotalsResponseDTO,
  DailyNutritionSummaryResponseDTO,
  DailySummaryDateQueryDTO,
  LogNutritionDTO,
  MacroTargetResponseDTO,
  NutritionLogResponseDTO,
  RecalculateTdeeDTO,
  TdeeProfileResponseDTO,
  UpdateNutritionLogDTO,
} from './dto/nutrition.dto';
import { NutritionService } from './nutrition.service';

function objectEnvelopeSchema(dataSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        $ref: dataSchemaRef,
      },
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

@ApiTags('Nutrition')
@ApiExtraModels(
  ActiveTdeeResponseDTO,
  DailyMacroTotalsResponseDTO,
  DailyNutritionSummaryResponseDTO,
  NutritionLogResponseDTO,
  TdeeProfileResponseDTO,
  MacroTargetResponseDTO,
  RecalculateTdeeDTO,
)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('tdee')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Get the authenticated user's active TDEE profile and macros.",
  })
  @ApiResponse({
    status: 200,
    description: 'Active TDEE profile returned.',
    schema: objectEnvelopeSchema(getSchemaPath(ActiveTdeeResponseDTO)),
  })
  getActiveTdee(@CurrentUser() user: JwtPayload) {
    return this.nutritionService.getActiveTdee(user.sub);
  }

  @Get('tdee/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the authenticated user's TDEE history.",
  })
  @ApiResponse({
    status: 200,
    description: 'TDEE history returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(TdeeProfileResponseDTO)),
  })
  listTdeeHistory(
    @CurrentUser() user: JwtPayload,
    @Query() dto: PaginationDTO,
  ) {
    return this.nutritionService.getTdeeHistory(user.sub, dto);
  }

  @Post('tdee/recalculate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: RecalculateTdeeDTO })
  @ApiOperation({
    summary: "Recalculate the authenticated user's active TDEE profile.",
  })
  @ApiResponse({
    status: 200,
    description: 'Active TDEE profile recalculated.',
    schema: objectEnvelopeSchema(getSchemaPath(ActiveTdeeResponseDTO)),
  })
  recalculateTdee(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecalculateTdeeDTO,
  ) {
    return this.nutritionService.recalculateTdee(user.sub, dto);
  }

  @Post('logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: LogNutritionDTO })
  @ApiOperation({
    summary: 'Create a nutrition log for the authenticated user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Nutrition log created.',
    schema: objectEnvelopeSchema(getSchemaPath(NutritionLogResponseDTO)),
  })
  createNutritionLog(
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogNutritionDTO,
  ) {
    return this.nutritionService.logNutrition(user.sub, dto);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the authenticated user's nutrition logs.",
  })
  @ApiResponse({
    status: 200,
    description: 'Nutrition logs returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(NutritionLogResponseDTO)),
  })
  listNutritionLogs(
    @CurrentUser() user: JwtPayload,
    @Query() dto: DateRangeDTO,
  ) {
    return this.nutritionService.getNutritionLogs(user.sub, dto);
  }

  @Patch('logs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateNutritionLogDTO })
  @ApiOperation({
    summary: 'Update an owned nutrition log for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nutrition log updated.',
    schema: objectEnvelopeSchema(getSchemaPath(NutritionLogResponseDTO)),
  })
  updateNutritionLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNutritionLogDTO,
  ) {
    return this.nutritionService.updateNutritionLog(user.sub, id, dto);
  }

  @Delete('logs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete an owned nutrition log for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Nutrition log deleted.' })
  async deleteNutritionLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.nutritionService.deleteNutritionLog(user.sub, id);
    return { message: 'Nutrition log deleted.' };
  }

  @Get('daily-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Get the authenticated user's logged totals and current macro comparison for a day.",
  })
  @ApiResponse({
    status: 200,
    description: 'Daily nutrition summary returned.',
    schema: objectEnvelopeSchema(
      getSchemaPath(DailyNutritionSummaryResponseDTO),
    ),
  })
  getDailySummary(
    @CurrentUser() user: JwtPayload,
    @Query() dto: DailySummaryDateQueryDTO,
  ) {
    return this.nutritionService.getDailySummary(user.sub, dto);
  }
}
