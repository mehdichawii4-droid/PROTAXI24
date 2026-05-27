import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '@/firebase/firestore';
import type { UserRole } from '@/firebase/types';
import { collectionForRole } from '@/services/authUtils';
import { logger } from '@/services/logger';

export type PushPermissionStatus = Notifications.PermissionStatus | 'unsupported';

export function isPushSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function resolveExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'PROTAXI24',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8BC53F',
  });
}

export async function getNotificationPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isPushSupportedPlatform()) {
    return 'unsupported';
  }

  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

export async function requestPushNotificationPermissions(): Promise<boolean> {
  if (!isPushSupportedPlatform()) {
    logger.info('[PUSH PERMISSION] skipped — unsupported platform', Platform.OS);
    return false;
  }

  await ensureAndroidNotificationChannel();

  const existing = await Notifications.getPermissionsAsync();
  logger.info('[PUSH PERMISSION]', {
    status: existing.status,
    canAskAgain: existing.canAskAgain,
    platform: Platform.OS,
  });

  if (existing.status === 'granted') {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  logger.info('[PUSH PERMISSION]', {
    status: requested.status,
    granted: requested.status === 'granted',
    platform: Platform.OS,
  });

  return requested.status === 'granted';
}

export async function getCurrentExpoPushToken(): Promise<string | null> {
  if (!isPushSupportedPlatform()) {
    logger.info('[PUSH TOKEN] skipped — web/unsupported platform', Platform.OS);
    return null;
  }

  if (Constants.isDevice === false) {
    devWarn(
      '[PUSH TOKEN] simulator/emulator detected — Expo push token may be unavailable',
    );
  }

  const granted = await requestPushNotificationPermissions();
  if (!granted) {
    devWarn('[PUSH] token missing — permission not granted');
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    devWarn(
      '[PUSH TOKEN] missing EAS projectId — add extra.eas.projectId in app.json after eas init',
    );
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    logger.info('[PUSH] token found', {
      pushTokenPreview: `${tokenResult.data.slice(0, 24)}…`,
      projectId,
      platform: Platform.OS,
    });
    return tokenResult.data;
  } catch (error) {
    logger.error('[PUSH] token missing — getExpoPushTokenAsync failed', error);
    return null;
  }
}

export async function saveUserPushToken(
  uid: string,
  role: UserRole,
  token: string,
  loginStep = 'saveUserPushToken',
): Promise<void> {
  const collectionName = collectionForRole(role);
  const profileRef = doc(db, collectionName, uid);
  const payload = {
    expoPushToken: token,
    expoPushTokenUpdatedAt: serverTimestamp(),
    pushTokenRole: role,
  };

  try {
    await setDoc(profileRef, payload, { merge: true });
  } catch (error) {
    logger.error('[PUSH TOKEN] saveUserPushToken failed', {
      step: loginStep,
      uid,
      role,
      collection: collectionName,
      error,
    });
    throw error;
  }

  logger.info('[PUSH TOKEN] saved', {
    uid,
    role,
    collection: collectionName,
  });
}

export async function registerForPushNotificationsAsync(
  uid: string,
  role: UserRole,
): Promise<string | null> {
  if (!isPushSupportedPlatform()) {
    logger.info('[PUSH TOKEN] register skipped — platform', Platform.OS);
    return null;
  }

  if (!uid.trim()) {
    devWarn('[PUSH TOKEN] register skipped — missing uid');
    return null;
  }

  const token = await getCurrentExpoPushToken();
  if (!token) {
    devWarn('[PUSH] token missing — register aborted', { uid, role });
    return null;
  }

  await saveUserPushToken(uid, role, token, 'registerForPushNotificationsAsync');
  logger.info('[PUSH] token registered', { uid, role });
  return token;
}
