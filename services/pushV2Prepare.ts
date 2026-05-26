import type { PushPayload } from '@/types/pushV2';
import { devLog } from '@/utils/devLog';

/** Mobile push delivery is handled by Cloud Functions only. */
export async function logPushV2Ready(payload: PushPayload): Promise<void> {
  devLog('[PUSH] deferred to Cloud Function', {
    eventType: payload.eventType,
    title: payload.title,
    targetRoles: payload.targetRoles,
  });
}
