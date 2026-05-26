import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error available in the React Native Firebase Auth bundle at runtime
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { app } from './app';

function createFirebaseAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createFirebaseAuth();

export function getFirebaseAuth(): Auth {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized.');
  }
  return auth;
}
