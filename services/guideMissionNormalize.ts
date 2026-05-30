import type { GuideMissionItem } from '@/types/guide';

function getMissionStatusConfig(status?: string) {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmée',
        color: '#8BC53F',
        bg: 'rgba(139,197,63,0.18)',
        border: 'rgba(139,197,63,0.35)',
      };
    case 'cancelled':
      return {
        label: 'Annulée',
        color: '#EF4444',
        bg: 'rgba(239,68,68,0.18)',
        border: 'rgba(239,68,68,0.35)',
      };
    case 'pending':
    default:
      return {
        label: 'En attente',
        color: '#F59E0B',
        bg: 'rgba(245,158,11,0.18)',
        border: 'rgba(245,158,11,0.35)',
      };
  }
}

function toCreatedAtMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function normalizeGuideMission(id: string, raw: Record<string, unknown>): GuideMissionItem {
  const status = String(raw.status || 'pending');
  const statusConfig = getMissionStatusConfig(status);

  return {
    id,
    experience: String(raw.experience || raw.circuitName || 'Expérience PROTAXI'),
    date: String(raw.date || 'À confirmer'),
    meetingPoint: String(raw.meetingPoint || '—'),
    clientName: String(raw.clientName ?? '').trim() || 'Client PROTAXI',
    travelers: String(raw.travelers || '1'),
    status,
    statusLabel: statusConfig.label,
    statusColor: statusConfig.color,
    statusBg: statusConfig.bg,
    statusBorder: statusConfig.border,
    createdAtMs: toCreatedAtMs(raw.createdAt),
  };
}

export const GUIDE_MISSION_PUBLIC_FIELD_KEYS = [
  'id',
  'experience',
  'date',
  'meetingPoint',
  'clientName',
  'travelers',
  'status',
  'statusLabel',
  'statusColor',
  'statusBg',
  'statusBorder',
  'createdAtMs',
] as const;
