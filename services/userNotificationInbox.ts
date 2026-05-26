import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '@/firebase/authInstance';

const LEGACY_INBOX_KEY = 'notifications';
const LEGACY_OWNER_KEY = 'notificationsOwnerUid';

export type UserNotificationItem = {
  id: string;
  title?: string;
  message?: string;
  date?: string;
  read?: boolean;
};

export function getUserNotificationsStorageKey(uid: string): string {
  return `notifications:${uid}`;
}

async function migrateLegacyInboxIfOwned(uid: string): Promise<UserNotificationItem[] | null> {
  const owner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
  if (owner !== uid) {
    return null;
  }

  const legacyRaw = await AsyncStorage.getItem(LEGACY_INBOX_KEY);
  if (!legacyRaw) {
    return null;
  }

  const legacyList = JSON.parse(legacyRaw) as UserNotificationItem[];
  if (!Array.isArray(legacyList) || legacyList.length === 0) {
    return null;
  }

  await AsyncStorage.setItem(getUserNotificationsStorageKey(uid), legacyRaw);
  return legacyList;
}

async function shouldRejectLegacyOwnerClaim(uid: string): Promise<boolean> {
  const authUser = getFirebaseAuth().currentUser;
  if (!authUser || authUser.uid !== uid) {
    return false;
  }

  const createdAt = authUser.metadata?.creationTime;
  if (!createdAt) {
    return false;
  }

  const accountAgeMs = Date.now() - new Date(createdAt).getTime();
  return accountAgeMs < 24 * 60 * 60 * 1000;
}

export async function getUserNotifications(
  uid?: string | null
): Promise<UserNotificationItem[]> {
  if (!uid) {
    return [];
  }

  const owner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
  if (owner && owner !== uid) {
    return [];
  }

  const userKey = getUserNotificationsStorageKey(uid);
  const userRaw = await AsyncStorage.getItem(userKey);
  const legacyRaw = await AsyncStorage.getItem(LEGACY_INBOX_KEY);
  const legacyList = legacyRaw
    ? (JSON.parse(legacyRaw) as UserNotificationItem[])
    : [];
  const hasLegacyInbox = Array.isArray(legacyList) && legacyList.length > 0;

  if (
    userRaw &&
    owner === uid &&
    hasLegacyInbox &&
    (await shouldRejectLegacyOwnerClaim(uid))
  ) {
    await AsyncStorage.removeItem(userKey);
    await AsyncStorage.removeItem(LEGACY_OWNER_KEY);
    return [];
  }

  if (userRaw) {
    const list = JSON.parse(userRaw) as UserNotificationItem[];
    return Array.isArray(list) ? list : [];
  }

  if (owner === uid && hasLegacyInbox && (await shouldRejectLegacyOwnerClaim(uid))) {
    await AsyncStorage.removeItem(LEGACY_OWNER_KEY);
    return [];
  }

  const migrated = await migrateLegacyInboxIfOwned(uid);
  return migrated ?? [];
}

export async function setUserNotifications(
  uid: string,
  notifications: UserNotificationItem[]
): Promise<void> {
  await AsyncStorage.setItem(
    getUserNotificationsStorageKey(uid),
    JSON.stringify(notifications)
  );
}

export async function getUnreadNotificationCount(uid?: string | null): Promise<number> {
  const notifications = await getUserNotifications(uid);
  return notifications.filter((item) => !item.read).length;
}

export async function appendUserNotification(
  uid: string,
  notification: UserNotificationItem
): Promise<void> {
  const notifications = await getUserNotifications(uid);
  await setUserNotifications(uid, [notification, ...notifications]);
}

export async function persistNotificationInboxForCurrentUser(
  title: string,
  message: string
): Promise<void> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) {
    return;
  }

  await AsyncStorage.setItem(LEGACY_OWNER_KEY, uid);
  await appendUserNotification(uid, {
    id: Date.now().toString(),
    title,
    message,
    date: new Date().toLocaleString('fr-FR'),
    read: false,
  });
}
