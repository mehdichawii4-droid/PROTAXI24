import { LogBox } from 'react-native';
import { devError } from '@/utils/devLog';

function isFirebasePermissionDenied(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object') {
    const firebaseError = error as { code?: string; message?: string; name?: string };
    if (firebaseError.code === 'permission-denied') return true;

    const message = String(firebaseError.message || '');
    if (message.includes('Missing or insufficient permissions')) return true;
  }

  return String(error).includes('Missing or insufficient permissions');
}

let installed = false;

export function installFirebaseDevLogBoxSilencing() {
  if (!__DEV__ || installed) return;
  installed = true;

  LogBox.ignoreLogs([
    'FirebaseError: Missing or insufficient permissions',
    'Uncaught (in promise, id:',
    '[firestore/permission-denied]',
  ]);

  try {
    const rejectionTracking = require('promise/setimmediate/rejection-tracking') as {
      enable: (options: {
        allRejections: boolean;
        onUnhandled: (id: number, error: unknown) => void;
        onHandled: (id: number) => void;
      }) => void;
    };

    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (_id, error) => {
        if (isFirebasePermissionDenied(error)) {
          devError('[PROMISE DENIED - bootstrap - globalUnhandledRejection]', error);
        }
      },
      onHandled: () => {},
    });
  } catch {
    // rejection-tracking is optional depending on the runtime.
  }
}

installFirebaseDevLogBoxSilencing();
