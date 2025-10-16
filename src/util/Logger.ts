/*
 * Logger: Structured logging with levels and context.
 * Use for debugging and monitoring. Disable in production if needed.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ILogger;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enabled: boolean;
  context?: Record<string, unknown>;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Simple console logger for tests and scripts.
 */
export class ConsoleLogger implements ILogger {
  constructor(private minLevel: LogLevel = 'info') {}

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.log('info', message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, context);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.log('error', message, context);
    }
  }

  child(_context: Record<string, unknown>): ILogger {
    return new ConsoleLogger(this.minLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[this.minLevel];
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    console.error(`[${level.toUpperCase()}] ${message}${contextStr}`);
  }
}

export const makeLogger = (config: Partial<LoggerConfig> = {}): ILogger => {
  const { 
    minLevel = 'info', 
    enabled = true, 
    context: baseContext = {} 
  } = config;

  const shouldLog = (level: LogLevel): boolean => {
    return enabled && levelPriority[level] >= levelPriority[minLevel];
  };

  const log = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    if (!shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const mergedContext = { ...baseContext, ...context };
    const contextStr = Object.keys(mergedContext).length > 0 
      ? ` ${JSON.stringify(mergedContext)}` 
      : '';

    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;

    // Use console methods that ESLint allows
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      default:
        // For info and debug, we'll use console.error since console.log is restricted
        // In production, you might want to use a proper logging library
        console.error(logMessage);
    }
  };

  const debug = (message: string, context?: Record<string, unknown>): void => {
    log('debug', message, context);
  };

  const info = (message: string, context?: Record<string, unknown>): void => {
    log('info', message, context);
  };

  const warn = (message: string, context?: Record<string, unknown>): void => {
    log('warn', message, context);
  };

  const error = (message: string, context?: Record<string, unknown>): void => {
    log('error', message, context);
  };

  const child = (childContext: Record<string, unknown>): ILogger => {
    return makeLogger({ 
      minLevel, 
      enabled, 
      context: { ...baseContext, ...childContext } 
    });
  };

  return { debug, info, warn, error, child };
};

