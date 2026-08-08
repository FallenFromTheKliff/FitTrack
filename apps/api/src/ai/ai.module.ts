import { forwardRef, Module } from '@nestjs/common';

import { FitnessModule } from '../fitness/fitness.module';
import { MembershipModule } from '../membership/membership.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { UserModule } from '../user/user.module';
import { AiChatMessageRepository } from './ai-chat-message.repository';
import { AiChatSessionRepository } from './ai-chat-session.repository';
import { AiController } from './ai.controller';
import { AiInteractionLogRepository } from './ai-interaction-log.repository';
import { AiPythonClientService } from './ai-python-client.service';
import { AiService } from './ai.service';
import { BrodigyAccessGuard } from './brodigy-access.guard';
import { GymChatController } from './gym-chat.controller';
import { GymChatInteractionLogRepository } from './gym-chat-interaction-log.repository';
import { GymChatMessageRepository } from './gym-chat-message.repository';
import { GymChatService } from './gym-chat.service';
import { GymChatSessionRepository } from './gym-chat-session.repository';
import { GymKnowledgeController } from './gym-knowledge.controller';
import { GymKnowledgeRepository } from './gym-knowledge.repository';
import { GymKnowledgeService } from './gym-knowledge.service';

@Module({
  imports: [
    FitnessModule,
    MembershipModule,
    UserModule,
    forwardRef(() => NutritionModule),
  ],
  controllers: [AiController, GymChatController, GymKnowledgeController],
  providers: [
    AiService,
    BrodigyAccessGuard,
    GymChatService,
    GymKnowledgeService,
    AiPythonClientService,
    AiChatSessionRepository,
    AiChatMessageRepository,
    AiInteractionLogRepository,
    GymChatSessionRepository,
    GymChatMessageRepository,
    GymChatInteractionLogRepository,
    GymKnowledgeRepository,
  ],
  exports: [
    AiPythonClientService,
    AiService,
    GymChatService,
    GymKnowledgeService,
  ],
})
export class AiModule {}
