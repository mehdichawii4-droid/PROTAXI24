import { logger } from '@/services/logger';

function isFirebasePermissionDenied(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object') {
    const firebaseError = error as { code?: string; message?: string };
    if (firebaseError.code === 'permission-denied') return true;

    const message = String(firebaseError.message || '');
    if (message.includes('Missing or insufficient permissions')) return true;
  }

  return String(error).includes('Missing or insufficient permissions');
}

export function installProductionStabilityHandlers() {
  const globalScope = globalThis as {
    onunhandledrejection?: (event: { reason?: unknown }) => void;
    onerror?: (message: unknown, source?: unknown, lineno?: unknown, colno?: unknown, error?: unknown) => boolean;
  };

  const previousRejection = globalScope.onunhandledrejection;
  globalScope.onunhandledrejection = (event) => {
    const reason = event?.reason;
    if (!isFirebasePermissionDenied(reason)) {
      logger.error('[GLOBAL] unhandled promise rejection', reason);
    }
    previousRejection?.(event);
  };

  const previousError = globalScope.onerror;
  globalScope.onerror = (message, source, lineno, colno, error) => {
    logger.error('[GLOBAL] uncaught error', {
      message,
      source,
      lineno,
      colno,
      error,
    });
    return previousError?.(message, source, lineno, colno, error) ?? false;
  };
}

installProductionStabilityHandlers();
