import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { UserCollection } from '@/firebase/types';
import type { PushPayload, PushTargetRole, PushTokenRecord } from '@/types/pushV2';
import { collectionForRole } from '@/services/authUtils';
import { logger } from '@/services/logger';

function roleToCollection(role: PushTargetRole): UserCollection {
  if (role === 'staff') {
    return 'drivers';
  }
  return collectionForRole(role);
}

function readTokenFromProfile(data: Record<string, unknown> | undefined) {
  const token = data?.expoPushToken;
  return typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
}

export async function getPushTokenForUid(
  uid: string,
  role: PushTargetRole,
): Promise<string | null> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) return null;

  try {
    const snapshot = await getDoc(doc(db, roleToCollection(role), normalizedUid));
    if (!snapshot.exists()) {
      return null;
    }

    return readTokenFromProfile(snapshot.data() as Record<string, unknown>);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      logger.info('[PUSH TOKEN LOOKUP] getPushTokenForUid denied', { uid, role });
    } else {
      logger.error('[PUSH TOKEN LOOKUP] getPushTokenForUid failed', { uid, role, error });
    }
    return null;
  }
}

export async function getPushTokensForUids(
  entries: Array<{ uid: string; role: PushTargetRole }>,
): Promise<PushTokenRecord[]> {
  const unique = new Map<string, { uid: string; role: PushTargetRole }>();
  entries.forEach((entry) => {
    const uid = entry.uid.trim();
    if (!uid) return;
    unique.set(`${entry.role}:${uid}`, { uid, role: entry.role });
  });

  const results = await Promise.all(
    [...unique.values()].map(async ({ uid, role }) => ({
      uid,
      role,
      token: await getPushTokenForUid(uid, role),
    })),
  );

  return results;
}

export async function lookupTokensForPayload(payload: PushPayload): Promise<string[]> {
  if (payload.targetUids?.length) {
    const role = payload.targetRoles[0] ?? 'client';
    const records = await getPushTokensForUids(
      payload.targetUids.map((uid) => ({ uid, role })),
    );
    return records.map((record) => record.token).filter((token): token is string => Boolean(token));
  }

  logger.info('[PUSH TOKEN LOOKUP] role-based targets deferred to Cloud Function', {
    eventType: payload.eventType,
    targetRoles: payload.targetRoles,
  });
  return [];
}
