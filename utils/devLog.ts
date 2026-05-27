import { logger } from '@/services/logger';

/** @deprecated Prefer `logger` from `@/services/logger` for new code. */
export function devLog(...args: unknown[]) {
  if (args.length === 0) return;
  const [first, ...rest] = args;
  if (typeof first === 'string') {
    logger.info(first, rest.length > 0 ? rest : undefined);
    return;
  }
  logger.info('[DEV]', { args });
}

/** @deprecated Prefer `logger` from `@/services/logger` for new code. */
export function devWarn(...args: unknown[]) {
  if (args.length === 0) return;
  const [first, ...rest] = args;
  if (typeof first === 'string') {
    logger.warn(first, rest.length > 0 ? rest : undefined);
    return;
  }
  logger.warn('[DEV]', { args });
}

/** @deprecated Prefer `logger` from `@/services/logger` for new code. */
export function devError(...args: unknown[]) {
  if (args.length === 0) return;
  const [first, ...rest] = args;
  if (typeof first === 'string') {
    logger.error(first, rest.length > 0 ? rest : undefined);
    return;
  }
  logger.error('[DEV]', { args });
}
