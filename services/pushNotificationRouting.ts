import * as Notifications from 'expo-notifications';
import type { Href, Router } from 'expo-router';
import { devLog } from '@/utils/devLog';

export const DRIVER_RIDE_ASSIGNED_EVENT = 'taxi_ride_assigned';

type PushNotificationData = Record<string, unknown>;

let pendingRideId: string | null = null;

export function setPendingPushRideId(rideId: string) {
  pendingRideId = rideId.trim() || null;
}

export function consumePendingPushRideId(): string | null {
  const rideId = pendingRideId;
  pendingRideId = null;
  return rideId;
}

export function readPushNotificationData(
  notification: Notifications.Notification,
): PushNotificationData {
  const raw = notification.request.content.data;
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return raw as PushNotificationData;
}

export function handleRideAssignedNotificationTap(
  router: Router,
  data: PushNotificationData,
  source: 'tap' | 'cold_start',
) {
  const eventType = String(data.eventType ?? '').trim();
  if (eventType !== DRIVER_RIDE_ASSIGNED_EVENT) {
    return;
  }

  const rideId = String(data.rideId ?? '').trim();
  devLog('[PUSH] notification tapped', {
    source,
    eventType,
    rideId: rideId || null,
    status: data.status ?? null,
  });

  if (rideId) {
    setPendingPushRideId(rideId);
  }

  if (rideId) {
    router.push({
      pathname: '/drivers-dashboard',
      params: { rideId },
    } as Href);
    return;
  }

  router.push('/drivers-dashboard' as Href);
}

export async function handleColdStartNotificationTap(router: Router) {
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (!lastResponse) {
    return;
  }

  const data = readPushNotificationData(lastResponse.notification);
  handleRideAssignedNotificationTap(router, data, 'cold_start');
}

export function setupPushNotificationRouting(router: Router): () => void {
  void handleColdStartNotificationTap(router);

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = readPushNotificationData(response.notification);
      handleRideAssignedNotificationTap(router, data, 'tap');
    },
  );

  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = readPushNotificationData(notification);
      const eventType = String(data.eventType ?? '').trim();
      if (eventType !== DRIVER_RIDE_ASSIGNED_EVENT) {
        return;
      }

      devLog('[PUSH] remote received', {
        eventType,
        rideId: String(data.rideId ?? '').trim() || null,
        status: data.status ?? null,
      });
    },
  );

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}
