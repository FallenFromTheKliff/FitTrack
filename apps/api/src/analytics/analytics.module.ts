import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { UserModule } from '../user/user.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsPdfExportService } from './analytics-pdf-export.service';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { BusinessAnalyticsController } from './business-analytics.controller';
import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';
import { BusinessAnalyticsInsightPdfExportService } from './business-analytics-insight-pdf-export.service';
import { BusinessInsightRunRepository } from './business-insight-run.repository';
import { BusinessInsightSnapshotService } from './business-insight-snapshot.service';

@Module({
  imports: [AiModule, UserModule],
  controllers: [AnalyticsController, BusinessAnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsPdfExportService,
    AnalyticsRepository,
    BusinessAnalyticsInsightService,
    BusinessAnalyticsInsightPdfExportService,
    BusinessInsightRunRepository,
    BusinessInsightSnapshotService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsPdfExportService,
    AnalyticsRepository,
    BusinessAnalyticsInsightService,
    BusinessAnalyticsInsightPdfExportService,
    BusinessInsightRunRepository,
    BusinessInsightSnapshotService,
  ],
})
export class AnalyticsModule {}
