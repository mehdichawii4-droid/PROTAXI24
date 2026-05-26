import type { UserRole } from '@/firebase/types';

export type PushTargetRole = UserRole | 'staff';

export type PushEventType =
  | 'taxi_new_ride_available'
  | 'taxi_ride_accepted'
  | 'taxi_driver_en_route'
  | 'taxi_driver_arrived'
  | 'taxi_ride_finished'
  | 'tour_new_booking_admin'
  | 'tour_booking_confirmed'
  | 'tour_booking_cancelled'
  | 'tour_group_assigned'
  | 'tour_group_announcement';

export type PushPayload = {
  eventType: PushEventType;
  title: string;
  body: string;
  targetRoles: PushTargetRole[];
  targetUids?: string[];
  data: Record<string, string>;
};

/** Expo Push API message — send server-side only (Cloud Function). */
export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default';
};

export type PushTokenRecord = {
  uid: string;
  role: PushTargetRole;
  token: string | null;
};
