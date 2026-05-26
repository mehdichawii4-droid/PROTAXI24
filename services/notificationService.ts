import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { persistNotificationInboxForCurrentUser } from '@/services/userNotificationInbox';

const BRAND_PREFIX = 'PROTAXI';

let handlerConfigured = false;

export type RideNotificationContext = {
  id?: string;
  driverName?: string;
  driverId?: string;
  client?: string;
  departure?: string;
  destination?: string;
  service?: string;
  waitMinutes?: number;
};

export type ClientNotificationEvent =
  | 'driver_assigned'
  | 'driver_accepted'
  | 'driver_arrived'
  | 'ride_finished'
  | 'ride_cancelled';

export type DriverNotificationEvent =
  | 'new_ride'
  | 'ride_cancelled'
  | 'client_waiting'
  | 'urgent_ride';

export type AdminNotificationEvent =
  | 'new_reservation'
  | 'driver_offline'
  | 'high_demand'
  | 'no_car_available';

type NotificationMessage = {
  title: string;
  body: string;
};

const CLIENT_MESSAGES: Record<ClientNotificationEvent, (ride?: RideNotificationContext) => NotificationMessage> = {
  driver_assigned: (ride) => ({
    title: `${BRAND_PREFIX} • Chauffeur attribué 🚖`,
    body: `${ride?.driverName || 'Votre chauffeur'} prend en charge votre course.`,
  }),
  driver_accepted: () => ({
    title: `${BRAND_PREFIX} • Chauffeur accepté ✅`,
    body: 'Votre chauffeur a confirmé la course.',
  }),
  driver_arrived: () => ({
    title: `${BRAND_PREFIX} • Chauffeur arrivé 📍`,
    body: 'Votre chauffeur est au point de prise en charge.',
  }),
  ride_finished: () => ({
    title: `${BRAND_PREFIX} • Course terminée 🎉`,
    body: 'Merci d’avoir voyagé avec PROTAXI24.',
  }),
  ride_cancelled: () => ({
    title: `${BRAND_PREFIX} • Course annulée ❌`,
    body: 'Votre course a été annulée.',
  }),
};

const DRIVER_MESSAGES: Record<DriverNotificationEvent, (ride?: RideNotificationContext) => NotificationMessage> = {
  new_ride: (ride) => ({
    title: `${BRAND_PREFIX} • Nouvelle course 🚖`,
    body: ride?.destination
      ? `Course vers ${ride.destination}.`
      : 'Une nouvelle course vient de vous être attribuée.',
  }),
  ride_cancelled: () => ({
    title: `${BRAND_PREFIX} • Course annulée ❌`,
    body: 'Le client a annulé la course.',
  }),
  client_waiting: (ride) => ({
    title: `${BRAND_PREFIX} • Client en attente ⏳`,
    body: ride?.client
      ? `${ride.client} attend votre confirmation.`
      : 'Un client attend votre confirmation.',
  }),
  urgent_ride: (ride) => ({
    title: `${BRAND_PREFIX} • Course urgente 🔥`,
    body: ride?.departure
      ? `Priorité : ${ride.departure} → ${ride.destination || 'destination'}.`
      : 'Course prioritaire — intervention rapide requise.',
  }),
};

const ADMIN_MESSAGES: Record<
  AdminNotificationEvent,
  (context?: RideNotificationContext & { pendingCount?: number; driverName?: string }) => NotificationMessage
> = {
  new_reservation: (context) => ({
    title: `${BRAND_PREFIX} • Nouvelle réservation`,
    body: `${context?.departure || 'Départ'} → ${context?.destination || 'Destination'}`,
  }),
  driver_offline: (context) => ({
    title: `${BRAND_PREFIX} • Chauffeur hors ligne`,
    body: `${context?.driverName || 'Un chauffeur'} n’est plus connecté au live.`,
  }),
  high_demand: (context) => ({
    title: `${BRAND_PREFIX} • Forte demande`,
    body: `${context?.pendingCount || 3} courses en attente — dispatch requis.`,
  }),
  no_car_available: (context) => ({
    title: `${BRAND_PREFIX} • Aucune voiture disponible`,
    body: `${context?.pendingCount || 1} course(s) en attente sans chauffeur libre.`,
  }),
};

export function configureNotificationHandler() {
  if (handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  handlerConfigured = true;
}

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return;
  await Notifications.requestPermissionsAsync();
}

export async function notifyOnce(
  registry: Set<string>,
  key: string,
  task: () => Promise<void> | void
) {
  if (registry.has(key)) return;

  registry.add(key);
  await task();
}

async function schedulePushNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}

export async function persistNotificationInbox(title: string, message: string) {
  await persistNotificationInboxForCurrentUser(title, message);
}

async function deliverNotification(
  title: string,
  body: string,
  options?: { persist?: boolean }
) {
  await schedulePushNotification(title, body);

  if (options?.persist !== false) {
    await persistNotificationInbox(title, body);
  }
}

const buildRegistryKey = (
  audience: 'client' | 'driver' | 'admin',
  event: string,
  ride?: RideNotificationContext
) => `${audience}:${event}:${ride?.id || 'global'}`;

export async function notifyClient(
  registry: Set<string>,
  event: ClientNotificationEvent,
  ride?: RideNotificationContext
) {
  await notifyOnce(registry, buildRegistryKey('client', event, ride), async () => {
    const message = CLIENT_MESSAGES[event](ride);
    await deliverNotification(message.title, message.body);
  });
}

export async function notifyDriver(
  registry: Set<string>,
  event: DriverNotificationEvent,
  ride?: RideNotificationContext
) {
  await notifyOnce(registry, buildRegistryKey('driver', event, ride), async () => {
    const message = DRIVER_MESSAGES[event](ride);
    await deliverNotification(message.title, message.body);
  });
}

export async function notifyAdmin(
  registry: Set<string>,
  event: AdminNotificationEvent,
  context?: RideNotificationContext & {
    pendingCount?: number;
    driverName?: string;
    driverId?: string;
  }
) {
  const registryKey = buildRegistryKey('admin', event, {
    id: context?.id || context?.driverId,
    driverName: context?.driverName,
  });

  await notifyOnce(registry, registryKey, async () => {
    const message = ADMIN_MESSAGES[event](context);
    await deliverNotification(message.title, message.body);
  });
}

export function getClientEventFromStatus(
  status: string,
  ride?: RideNotificationContext
): ClientNotificationEvent | null {
  switch (status) {
    case 'Attribuée':
      return ride?.driverName ? 'driver_assigned' : null;
    case 'Acceptée':
      return 'driver_accepted';
    case 'Arrivé':
      return 'driver_arrived';
    case 'Terminée':
      return 'ride_finished';
    case 'Annulée':
    case 'Refusée':
      return 'ride_cancelled';
    default:
      return null;
  }
}

export function getRideWaitMinutes(ride: any) {
  const createdAt =
    ride?.createdAt?.toDate?.() ??
    (ride?.createdAt ? new Date(ride.createdAt) : null);

  if (!createdAt) return 0;
  return (Date.now() - createdAt.getTime()) / 1000 / 60;
}

export function mapRideNotificationContext(ride: any): RideNotificationContext {
  return {
    id: ride?.id,
    driverName: ride?.driverName,
    driverId: ride?.driverId,
    client: ride?.client,
    departure: ride?.departure || ride?.address,
    destination: ride?.destination || ride?.airport,
    service: ride?.service,
    waitMinutes: getRideWaitMinutes(ride),
  };
}
