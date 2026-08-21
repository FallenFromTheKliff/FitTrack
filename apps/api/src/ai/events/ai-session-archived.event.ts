import { ChatContext } from '@prisma/client';

export const AI_SESSION_ARCHIVED_EVENT = 'ai.session-archived';

export interface AiSessionArchivedEvent {
  userId: string;
  sessionId: string;
  contextType: ChatContext;
  archivedAt: string;
}
