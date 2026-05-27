import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/services/logger';

export function useIsMountedRef() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}

type RunSafeAsyncOptions = {
  label?: string;
  isMounted?: () => boolean;
  onError?: (error: unknown) => void;
};

export function runSafeAsync<T>(
  task: () => Promise<T>,
  options: RunSafeAsyncOptions = {},
): void {
  void task().catch((error) => {
    if (options.isMounted && !options.isMounted()) {
      return;
    }

    logger.error(options.label ?? '[SAFE ASYNC] unhandled rejection', error);
    options.onError?.(error);
  });
}

export async function safeAsync<T>(
  task: () => Promise<T>,
  fallback: T,
  label = '[SAFE ASYNC]',
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    logger.error(label, error);
    return fallback;
  }
}

export function useSafeAsyncRunner(isMountedRef: { current: boolean }) {
  return useCallback(
    <T>(task: () => Promise<T>, options: Omit<RunSafeAsyncOptions, 'isMounted'> = {}) => {
      runSafeAsync(task, {
        ...options,
        isMounted: () => isMountedRef.current,
      });
    },
    [isMountedRef],
  );
}

export function guardMounted<T>(
  isMountedRef: { current: boolean },
  updater: () => T,
): T | undefined {
  if (!isMountedRef.current) {
    return undefined;
  }
  return updater();
}
