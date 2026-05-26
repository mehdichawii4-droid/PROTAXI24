import { addDoc, serverTimestamp } from 'firebase/firestore';
import { devError } from '@/utils/devLog';
import { getTourGroupMemoriesCollectionRef } from '@/firebase/firestore';
import { DEFAULT_ADMIN_SENDER_NAME, DEFAULT_PARTICIPANT_SENDER_NAME } from '@/services/tourGroupChat';

export type TourGroupMemorySenderType = 'participant' | 'guide' | 'admin';

export type TourGroupMemory = {
  id: string;
  imageUrl: string;
  senderName: string;
  caption: string;
  senderType: TourGroupMemorySenderType;
  createdAt?: unknown;
};

export type SendTourGroupMemoryInput = {
  imageUrl: string;
  senderName: string;
  caption?: string;
  senderType: TourGroupMemorySenderType;
};

export const MOCK_GROUP_MEMORY_IMAGES = [
  'https://images.unsplash.com/photo-1469854523086-cc02afe5c880?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4eae5f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
] as const;

export function normalizeTourGroupMemorySenderType(
  value: unknown,
): TourGroupMemorySenderType {
  if (value === 'guide' || value === 'admin') return value;
  return 'participant';
}

export function normalizeTourGroupMemory(
  id: string,
  raw: Record<string, unknown>,
): TourGroupMemory {
  const senderType = normalizeTourGroupMemorySenderType(raw.senderType);

  return {
    id,
    imageUrl: String(raw.imageUrl || MOCK_GROUP_MEMORY_IMAGES[0]),
    senderName: String(
      raw.senderName ||
        (senderType === 'admin'
          ? DEFAULT_ADMIN_SENDER_NAME
          : senderType === 'guide'
            ? 'Guide PROTAXI'
            : DEFAULT_PARTICIPANT_SENDER_NAME),
    ),
    caption: String(raw.caption || ''),
    senderType,
    createdAt: raw.createdAt,
  };
}

export function getMockGroupMemoryImage(seed: number) {
  const index = Math.abs(seed) % MOCK_GROUP_MEMORY_IMAGES.length;
  return MOCK_GROUP_MEMORY_IMAGES[index];
}

export function isOfficialGroupMemory(memory: TourGroupMemory) {
  return memory.senderType === 'admin';
}

export function getMemorySenderBadgeLabel(senderType: TourGroupMemorySenderType) {
  switch (senderType) {
    case 'admin':
      return 'ADMIN';
    case 'guide':
      return 'GUIDE';
    default:
      return 'PARTICIPANT';
  }
}

export async function sendTourGroupMemory(
  groupId: string,
  input: SendTourGroupMemoryInput,
) {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error('groupId is required to send a tour group memory.');
  }

  if (!input.imageUrl.trim()) {
    throw new Error('imageUrl is required');
  }

  try {
    await addDoc(getTourGroupMemoriesCollectionRef(normalizedGroupId), {
      imageUrl: input.imageUrl,
      senderName: input.senderName.trim() || DEFAULT_PARTICIPANT_SENDER_NAME,
      caption: input.caption?.trim() || '',
      senderType: input.senderType,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    devError('[PROMISE DENIED - tourGroupMemories - sendMemory]', error);
    throw error;
  }
}

export function getLatestTourGroupMemories(
  memories: TourGroupMemory[],
  limit = 6,
) {
  const getTimestamp = (value: unknown) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const timestamp = value as { toDate?: () => Date };
      return timestamp.toDate?.()?.getTime() ?? 0;
    }
    return 0;
  };

  return [...memories]
    .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
    .slice(0, limit);
}
