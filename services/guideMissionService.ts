import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { normalizeGuideMission } from '@/services/guideMissionNormalize';
import type { GuideMissionItem } from '@/types/guide';
import { devError, devLog } from '@/utils/devLog';

export { normalizeGuideMission } from '@/services/guideMissionNormalize';

export function buildGuideMissionsQuery(guideUid: string): Query {
  const normalizedUid = guideUid.trim();
  if (!normalizedUid) {
    throw new Error('Guide uid required for missions query.');
  }

  return query(
    collection(db, 'tourBookings'),
    where('assignedGuideId', '==', normalizedUid),
    orderBy('createdAt', 'desc'),
  );
}

export function subscribeGuideMissions(
  guideUid: string,
  onData: (missions: GuideMissionItem[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const normalizedUid = guideUid.trim();

  devLog('[GUIDE MISSIONS] subscribe', { guideUid: normalizedUid });

  return onSnapshot(
    buildGuideMissionsQuery(normalizedUid),
    (snapshot) => {
      const missions = snapshot.docs.map((docSnap) =>
        normalizeGuideMission(docSnap.id, docSnap.data() as Record<string, unknown>),
      );
      onData(missions);
    },
    (error) => {
      devError('[GUIDE MISSIONS] snapshot failed', error);
      onError?.(error);
    },
  );
}
