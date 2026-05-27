import type { PushPayload } from '@/types/pushV2';
import { logger } from '@/services/logger';

/** Mobile push delivery is handled by Cloud Functions only. */
export async function logPushV2Ready(payload: PushPayload): Promise<void> {
  logger.info('[PUSH] deferred to Cloud Function', {
    eventType: payload.eventType,
    title: payload.title,
    targetRoles: payload.targetRoles,
  });
}
