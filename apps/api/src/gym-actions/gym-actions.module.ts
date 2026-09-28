import { Module } from '@nestjs/common';

import { GymActionsReportController } from './gym-actions-report.controller';

@Module({
  controllers: [GymActionsReportController],
})
export class GymActionsModule {}
