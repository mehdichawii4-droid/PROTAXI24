import { addDoc, serverTimestamp } from 'firebase/firestore';
import { devError } from '@/utils/devLog';
import { getTourGroupMessagesCollectionRef } from '@/firebase/firestore';

export type TourGroupMessageSenderType = 'participant' | 'guide' | 'admin';

export const DEFAULT_PARTICIPANT_SENDER_NAME = 'Voyageur PROTAXI';
export const DEFAULT_ADMIN_SENDER_NAME = 'Admin PROTAXI';
export const DEFAULT_GUIDE_SENDER_NAME = 'Guide PROTAXI';

export type TourGroupMessage = {
  id: string;
  senderType: TourGroupMessageSenderType;
  senderName: string;
  text: string;
  createdAt?: unknown;
};

export type SendTourGroupMessageInput = {
  senderType: TourGroupMessageSenderType;
  senderName: string;
  text: string;
};

export const TOUR_GROUP_ADMIN_ANNOUNCEMENTS = [
  {
    label: 'Départ imminent',
    text: 'Le départ collectif est imminent. Merci de rejoindre le point de rendez-vous.',
  },
  {
    label: 'Retard',
    text: 'Un léger retard est signalé. L\'équipe PROTAXI vous informera dès l\'arrivée du véhicule.',
  },
  {
    label: 'Changement RDV',
    text: 'Le point de rendez-vous a été mis à jour. Consultez votre résumé pour les détails.',
  },
  {
    label: 'Groupe complet',
    text: 'Le groupe est complet. Préparez-vous pour une expérience partagée premium.',
  },
] as const;

export const TOUR_GROUP_GUIDE_ANNOUNCEMENTS = [
  {
    label: 'Bienvenue groupe',
    text: 'Bienvenue à bord. Votre guide PROTAXI vous accompagne pour cette expérience.',
  },
  {
    label: 'Point de rendez-vous',
    text: 'Le point de rendez-vous est confirmé. Merci d\'être présents 10 minutes avant le départ.',
  },
  {
    label: 'Départ imminent',
    text: 'Le départ collectif est imminent. Rejoignez le véhicule au point de rendez-vous.',
  },
  {
    label: 'Pause circuit',
    text: 'Pause prévue sur le circuit. Restez proches du groupe pour la reprise.',
  },
] as const;

export function normalizeTourGroupMessageSenderType(
  value: unknown,
): TourGroupMessageSenderType {
  if (value === 'guide' || value === 'admin') return value;
  return 'participant';
}

export function normalizeTourGroupMessage(
  id: string,
  raw: Record<string, unknown>,
): TourGroupMessage {
  const senderType = normalizeTourGroupMessageSenderType(raw.senderType);

  return {
    id,
    senderType,
    senderName: String(
      raw.senderName ||
        (senderType === 'admin'
          ? DEFAULT_ADMIN_SENDER_NAME
          : senderType === 'guide'
            ? DEFAULT_GUIDE_SENDER_NAME
            : DEFAULT_PARTICIPANT_SENDER_NAME),
    ),
    text: String(raw.text || ''),
    createdAt: raw.createdAt,
  };
}

export async function sendTourGroupMessage(
  groupId: string,
  input: SendTourGroupMessageInput,
) {
  const trimmed = input.text.trim();
  if (!trimmed) return;

  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error('groupId is required to send a tour group message.');
  }

  try {
    await addDoc(getTourGroupMessagesCollectionRef(normalizedGroupId), {
      senderType: input.senderType,
      senderName: input.senderName.trim() || DEFAULT_PARTICIPANT_SENDER_NAME,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    devError('[PROMISE DENIED - tourGroupChat - sendMessage]', error);
    throw error;
  }
}

export function formatTourGroupMessageTime(value: unknown) {
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

export function isParticipantMessage(message: TourGroupMessage) {
  return message.senderType === 'participant';
}
