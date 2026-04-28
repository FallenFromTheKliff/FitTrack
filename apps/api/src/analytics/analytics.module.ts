import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsPdfExportService } from './analytics-pdf-export.service';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { BusinessAnalyticsController } from './business-analytics.controller';
import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';
import { BusinessInsightRunRepository } from './business-insight-run.repository';

@Module({
  imports: [AiModule],
  controllers: [AnalyticsController, BusinessAnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsPdfExportService,
    AnalyticsRepository,
    BusinessAnalyticsInsightService,
    BusinessInsightRunRepository,
  ],
  exports: [
    AnalyticsService,
    AnalyticsPdfExportService,
    AnalyticsRepository,
    BusinessAnalyticsInsightService,
    BusinessInsightRunRepository,
  ],
})
export class AnalyticsModule {}
