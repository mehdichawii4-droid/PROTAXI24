import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, getRideDocRef, getRideMessagesCollectionRef } from '@/firebase/firestore';
import { devError, devLog } from '@/utils/devLog';

export type RideMessageSenderRole = 'client' | 'driver';

export type RideChatSummary = {
  lastMessageAt?: unknown;
  lastMessageText: string;
  lastSenderId: string;
  lastSenderRole: RideMessageSenderRole;
};

export type RideChatUnread = {
  client: number;
  driver: number;
};

export type RideMessage = {
  id: string;
  senderId: string;
  senderRole: RideMessageSenderRole;
  text: string;
  createdAt?: unknown;
  readBy: Record<string, unknown>;
};

export type SendRideMessageInput = {
  senderId: string;
  senderRole: RideMessageSenderRole;
  text: string;
};

export type MarkRideMessagesReadInput = {
  readerId: string;
  readerRole: RideMessageSenderRole;
};

/** Ride statuses where participants may send chat messages. */
export const RIDE_CHAT_OPEN_STATUSES = new Set([
  'Attribuée',
  'Acceptée',
  'En route',
  'Arrivé',
]);

const MAX_MESSAGE_LENGTH = 1000;
const CHAT_PREVIEW_MAX_LENGTH = 120;

export class RideChatError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RideChatError';
    this.code = code;
  }
}

function normalizeRideStatus(status: unknown): string {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'attribuée' || lower === 'attribuee') return 'Attribuée';
  if (lower === 'acceptée' || lower === 'acceptee') return 'Acceptée';
  if (lower === 'en route') return 'En route';
  if (lower === 'arrivé' || lower === 'arrive') return 'Arrivé';

  return raw;
}

export function isRideChatOpen(status: unknown): boolean {
  return RIDE_CHAT_OPEN_STATUSES.has(normalizeRideStatus(status));
}

export function normalizeRideMessageSenderRole(value: unknown): RideMessageSenderRole {
  return value === 'driver' ? 'driver' : 'client';
}

export function normalizeRideChatUnread(value: unknown): RideChatUnread {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const client = Number(raw.client);
  const driver = Number(raw.driver);

  return {
    client: Number.isFinite(client) && client > 0 ? Math.floor(client) : 0,
    driver: Number.isFinite(driver) && driver > 0 ? Math.floor(driver) : 0,
  };
}

export function normalizeRideChatSummary(value: unknown): RideChatSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const lastMessageText = String(raw.lastMessageText ?? '').trim();
  const lastSenderId = String(raw.lastSenderId ?? '').trim();

  if (!lastMessageText || !lastSenderId) {
    return null;
  }

  return {
    lastMessageAt: raw.lastMessageAt,
    lastMessageText,
    lastSenderId,
    lastSenderRole: normalizeRideMessageSenderRole(raw.lastSenderRole),
  };
}

export function getUnreadCountForRole(
  unread: RideChatUnread | null | undefined,
  role: RideMessageSenderRole,
): number {
  if (!unread) return 0;
  return role === 'client' ? unread.client : unread.driver;
}

export function normalizeRideMessage(
  id: string,
  raw: Record<string, unknown>,
): RideMessage {
  const readByRaw = raw.readBy;
  const readBy =
    readByRaw && typeof readByRaw === 'object' && !Array.isArray(readByRaw)
      ? (readByRaw as Record<string, unknown>)
      : {};

  return {
    id,
    senderId: String(raw.senderId ?? ''),
    senderRole: normalizeRideMessageSenderRole(raw.senderRole),
    text: String(raw.text ?? ''),
    createdAt: raw.createdAt,
    readBy,
  };
}

export function mapRideMessageSnapshot(snapshot: QuerySnapshot): RideMessage[] {
  return snapshot.docs.map((docSnap) =>
    normalizeRideMessage(docSnap.id, docSnap.data() as Record<string, unknown>),
  );
}

export function buildRideMessagesQuery(rideId: string) {
  return query(getRideMessagesCollectionRef(rideId), orderBy('createdAt', 'asc'));
}

export function subscribeRideMessages(
  rideId: string,
  onMessages: (messages: RideMessage[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new RideChatError('ride_id_required', 'rideId is required to subscribe to messages.');
  }

  return onSnapshot(
    buildRideMessagesQuery(normalizedRideId),
    (snapshot) => {
      onMessages(mapRideMessageSnapshot(snapshot));
    },
    (error) => {
      devError('[RIDE CHAT] subscribeRideMessages failed', { rideId: normalizedRideId, error });
      onError?.(error);
    },
  );
}

function getRecipientUnreadKey(senderRole: RideMessageSenderRole): keyof RideChatUnread {
  return senderRole === 'client' ? 'driver' : 'client';
}

function buildChatPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= CHAT_PREVIEW_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, CHAT_PREVIEW_MAX_LENGTH - 1)}…`;
}

function assertSendInput(input: SendRideMessageInput) {
  const senderId = String(input.senderId ?? '').trim();
  const text = String(input.text ?? '').trim();

  if (!senderId) {
    throw new RideChatError('sender_required', 'senderId is required.');
  }

  if (!text) {
    throw new RideChatError('message_empty', 'Le message ne peut pas être vide.');
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new RideChatError(
      'message_too_long',
      `Le message dépasse ${MAX_MESSAGE_LENGTH} caractères.`,
    );
  }
}

export async function sendRideMessage(
  rideId: string,
  input: SendRideMessageInput,
): Promise<string> {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new RideChatError('ride_id_required', 'rideId is required to send a message.');
  }

  assertSendInput(input);

  const senderId = input.senderId.trim();
  const senderRole = normalizeRideMessageSenderRole(input.senderRole);
  const text = input.text.trim();

  try {
    const messageId = await runTransaction(db, async (transaction) => {
      const rideRef = getRideDocRef(normalizedRideId);
      const rideSnap = await transaction.get(rideRef);

      if (!rideSnap.exists()) {
        throw new RideChatError('ride_not_found', 'Course introuvable.');
      }

      const ride = rideSnap.data() as Record<string, unknown>;
      const status = normalizeRideStatus(ride.status);

      if (!isRideChatOpen(status)) {
        throw new RideChatError(
          'chat_closed',
          `Le chat n'est pas disponible pour une course au statut ${status}.`,
        );
      }

      const messageRef = doc(getRideMessagesCollectionRef(normalizedRideId));
      transaction.set(messageRef, {
        senderId,
        senderRole,
        text,
        createdAt: serverTimestamp(),
        readBy: {},
      });

      const unread = normalizeRideChatUnread(ride.chatUnread);
      const recipientKey = getRecipientUnreadKey(senderRole);

      transaction.update(rideRef, {
        chatSummary: {
          lastMessageAt: serverTimestamp(),
          lastMessageText: buildChatPreview(text),
          lastSenderId: senderId,
          lastSenderRole: senderRole,
        },
        chatUnread: {
          client: recipientKey === 'client' ? unread.client + 1 : unread.client,
          driver: recipientKey === 'driver' ? unread.driver + 1 : unread.driver,
        },
        updatedAt: serverTimestamp(),
      });

      return messageRef.id;
    });

    devLog('[RIDE CHAT] message sent', {
      rideId: normalizedRideId,
      messageId,
      senderRole,
    });

    return messageId;
  } catch (error) {
    if (error instanceof RideChatError) {
      throw error;
    }

    devError('[RIDE CHAT] sendRideMessage failed', {
      rideId: normalizedRideId,
      senderRole,
      error,
    });
    throw error;
  }
}

function hasReaderSeenMessage(message: RideMessage, readerId: string): boolean {
  return Boolean(message.readBy[readerId]);
}

export async function markRideMessagesRead(
  rideId: string,
  input: MarkRideMessagesReadInput,
): Promise<{ markedCount: number }> {
  const normalizedRideId = rideId.trim();
  const readerId = String(input.readerId ?? '').trim();
  const readerRole = normalizeRideMessageSenderRole(input.readerRole);

  if (!normalizedRideId) {
    throw new RideChatError('ride_id_required', 'rideId is required to mark messages as read.');
  }

  if (!readerId) {
    throw new RideChatError('reader_required', 'readerId is required.');
  }

  try {
    const snapshot = await getDocs(buildRideMessagesQuery(normalizedRideId));
    const messages = mapRideMessageSnapshot(snapshot);
    const unreadMessages = messages.filter(
      (message) => message.senderId !== readerId && !hasReaderSeenMessage(message, readerId),
    );

    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map((message) =>
          updateDoc(doc(getRideMessagesCollectionRef(normalizedRideId), message.id), {
            [`readBy.${readerId}`]: serverTimestamp(),
          }),
        ),
      );
    }

    const rideRef = getRideDocRef(normalizedRideId);
    const rideDoc = await getDoc(rideRef);
    const currentUnread = normalizeRideChatUnread(rideDoc.data()?.chatUnread);

    await updateDoc(rideRef, {
      chatUnread: {
        client: readerRole === 'client' ? 0 : currentUnread.client,
        driver: readerRole === 'driver' ? 0 : currentUnread.driver,
      },
      updatedAt: serverTimestamp(),
    });

    devLog('[RIDE CHAT] messages marked read', {
      rideId: normalizedRideId,
      readerRole,
      markedCount: unreadMessages.length,
    });

    return { markedCount: unreadMessages.length };
  } catch (error) {
    if (error instanceof RideChatError) {
      throw error;
    }

    devError('[RIDE CHAT] markRideMessagesRead failed', {
      rideId: normalizedRideId,
      readerRole,
      error,
    });
    throw error;
  }
}

export function formatRideMessageTime(value: unknown): string {
  if (!value) return '';

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date };
    date = timestamp.toDate?.() ?? null;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
