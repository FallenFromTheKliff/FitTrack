import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { buildGymActionsPdf } from './gym-actions-report.builder';
import { GymActionsReportDTO } from './gym-actions-report.dto';

@ApiTags('Gym Actions')
@ApiBearerAuth('access-token')
@Controller('gym-actions')
export class GymActionsReportController {
  @Post('export/pdf')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiProduces('application/pdf')
  @ApiBody({ type: GymActionsReportDTO })
  @ApiOperation({ summary: 'Export the filtered Gym Actions view as a PDF.' })
  @ApiResponse({
    status: 200,
    description: 'Filtered Gym Actions PDF generated.',
    schema: { format: 'binary', type: 'string' },
  })
  exportPdf(@Body() dto: GymActionsReportDTO, @Res() response: Response) {
    const buffer = buildGymActionsPdf(dto);
    response.setHeader('content-type', 'application/pdf');
    response.setHeader(
      'content-disposition',
      'attachment; filename="fittrack-gym-actions-export.pdf"',
    );
    response.setHeader('content-length', String(buffer.length));
    response.send(buffer);
  }
}
