import { Alert, Platform, ToastAndroid } from 'react-native';

import { logger } from '@/services/logger';

export type UserFeedbackVariant = 'info' | 'success' | 'error';

type ToastListener = (message: string, variant: UserFeedbackVariant) => void;

let toastListener: ToastListener | null = null;

export function registerToastListener(listener: ToastListener | null) {
  toastListener = listener;
}

function nativeToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
}

export function showUserToast(message: string, variant: UserFeedbackVariant = 'info') {
  const trimmed = message.trim();
  if (!trimmed) return;

  if (toastListener) {
    toastListener(trimmed, variant);
    return;
  }

  nativeToast(trimmed);

  if (Platform.OS !== 'android' && __DEV__) {
    logger.info(`[TOAST ${variant}] ${trimmed}`);
  }
}

export function showUserError(message: string, title = 'Erreur') {
  const trimmed = message.trim() || 'Une erreur est survenue.';
  logger.warn('[USER ERROR]', { title, message: trimmed });

  if (toastListener) {
    toastListener(trimmed, 'error');
    return;
  }

  if (Platform.OS === 'android') {
    ToastAndroid.show(trimmed, ToastAndroid.LONG);
    return;
  }

  Alert.alert(title, trimmed, [{ text: 'OK' }]);
}

export function showUserSuccess(message: string) {
  showUserToast(message, 'success');
}
