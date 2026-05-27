import * as Notifications from 'expo-notifications';
import type { Href, Router } from 'expo-router';
import { Platform } from 'react-native';
import { logger } from '@/services/logger';

export const DRIVER_RIDE_ASSIGNED_EVENT = 'taxi_ride_assigned';
export const RIDE_CHAT_MESSAGE_EVENT = 'taxi_ride_chat_message';

type PushNotificationData = Record<string, unknown>;

let pendingRideId: string | null = null;
let pendingOpenChat = false;

export function setPendingPushRideId(rideId: string) {
  pendingRideId = rideId.trim() || null;
}

export function consumePendingPushRideId(): string | null {
  const rideId = pendingRideId;
  pendingRideId = null;
  return rideId;
}

export function setPendingOpenChat(open: boolean) {
  pendingOpenChat = open;
}

export function consumePendingOpenChat(): boolean {
  const value = pendingOpenChat;
  pendingOpenChat = false;
  return value;
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

function navigateToRideChat(router: Router, rideId: string, source: 'tap' | 'cold_start') {
  setPendingPushRideId(rideId);
  setPendingOpenChat(true);

  logger.info('[PUSH] notification tapped — open chat', {
    source,
    eventType: RIDE_CHAT_MESSAGE_EVENT,
    rideId,
  });

  router.push({
    pathname: '/course-tracking',
    params: {
      id: rideId,
      rideId,
      openChat: '1',
    },
  } as Href);
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
  logger.info('[PUSH] notification tapped', {
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

export function handleRideChatNotificationTap(
  router: Router,
  data: PushNotificationData,
  source: 'tap' | 'cold_start',
) {
  const eventType = String(data.eventType ?? '').trim();
  if (eventType !== RIDE_CHAT_MESSAGE_EVENT) {
    return;
  }

  const rideId = String(data.rideId ?? '').trim();
  if (!rideId) {
    return;
  }

  navigateToRideChat(router, rideId, source);
}

export function handlePushNotificationTap(
  router: Router,
  data: PushNotificationData,
  source: 'tap' | 'cold_start',
) {
  const eventType = String(data.eventType ?? '').trim();

  if (eventType === RIDE_CHAT_MESSAGE_EVENT) {
    handleRideChatNotificationTap(router, data, source);
    return;
  }

  if (eventType === DRIVER_RIDE_ASSIGNED_EVENT) {
    handleRideAssignedNotificationTap(router, data, source);
  }
}

export async function handleColdStartNotificationTap(router: Router) {
  if (Platform.OS === 'web') {
    return;
  }

  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (!lastResponse) {
    return;
  }

  const data = readPushNotificationData(lastResponse.notification);
  handlePushNotificationTap(router, data, 'cold_start');
}

export function setupPushNotificationRouting(router: Router): () => void {
  if (Platform.OS === 'web') {
    logger.info('[PUSH] routing disabled on web');
    return () => {};
  }

  void handleColdStartNotificationTap(router);

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = readPushNotificationData(response.notification);
      handlePushNotificationTap(router, data, 'tap');
    },
  );

  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = readPushNotificationData(notification);
      const eventType = String(data.eventType ?? '').trim();
      if (
        eventType !== DRIVER_RIDE_ASSIGNED_EVENT
        && eventType !== RIDE_CHAT_MESSAGE_EVENT
      ) {
        return;
      }

      logger.info('[PUSH] remote received', {
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
