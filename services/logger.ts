type LogContext = Record<string, unknown> | undefined;

function normalizeArgs(message: string, context?: unknown): [string, unknown?] {
  if (context === undefined) {
    return [message];
  }
  return [message, context];
}

function writeInfo(message: string, context?: unknown) {
  if (!__DEV__) return;
  const args = normalizeArgs(message, context);
  console.log(...args);
}

function writeWarn(message: string, context?: unknown) {
  if (__DEV__) {
    const args = normalizeArgs(message, context);
    console.warn(...args);
    return;
  }
  console.warn(`[PROTAXI] ${message}`);
}

function writeError(message: string, context?: unknown) {
  const args = normalizeArgs(message, context);
  console.error(`[PROTAXI] ${message}`, ...(args.length > 1 ? [args[1]] : []));
}

export const logger = {
  info(message: string, context?: LogContext) {
    writeInfo(message, context);
  },
  warn(message: string, context?: LogContext) {
    writeWarn(message, context);
  },
  error(message: string, context?: LogContext) {
    writeError(message, context);
  },
};

export function logBoundaryError(error: Error, errorInfo?: { componentStack?: string | null }) {
  logger.error('[ERROR BOUNDARY] render crash', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack ?? null,
  });
}
