/**
 * Structured Logger
 * 
 * This module provides a standardized logging interface to replace
 * console.log statements throughout the application.
 */

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// Current environment log level - can be set via environment variable
// Only logs at this level or higher will be output
const currentLogLevel: LogLevel = 
  (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 
  (process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO);

type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error' | 'log';

const baseConsole: Record<ConsoleMethod, (...args: any[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  log: console.log.bind(console),
};

// Log level numerical values for comparison
const logLevelValues = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

/**
 * Formats the current time as HH:MM:SS
 */
function getFormattedTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Determine if a given log level should be output
 * based on the current environment configuration
 */
function shouldLog(level: LogLevel): boolean {
  return logLevelValues[level] >= logLevelValues[currentLogLevel];
}

/**
 * Base logging function
 */
function log(level: LogLevel, module: string, message: any, ...args: any[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = getFormattedTime();
  const logPrefix = `${timestamp} [${level.toUpperCase()}] [${module}]`;
  const consoleMethod: ConsoleMethod = level === LogLevel.INFO ? 'info' : level;
  
  // Handle different types of messages
  if (typeof message === 'string') {
    if (args.length > 0) {
      baseConsole[consoleMethod](logPrefix, message, ...args);
    } else {
      baseConsole[consoleMethod](logPrefix, message);
    }
  } else {
    // For objects, arrays, etc.
    baseConsole[consoleMethod](logPrefix, message, ...args);
  }
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(moduleName: string) {
  return {
    debug: (message: any, ...args: any[]) => 
      log(LogLevel.DEBUG, moduleName, message, ...args),
    
    info: (message: any, ...args: any[]) => 
      log(LogLevel.INFO, moduleName, message, ...args),
    
    warn: (message: any, ...args: any[]) => 
      log(LogLevel.WARN, moduleName, message, ...args),
    
    error: (message: any, ...args: any[]) => 
      log(LogLevel.ERROR, moduleName, message, ...args)
  };
}

/**
 * Expose the configured log level for status messages
 */
export function getCurrentLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Replace console logging with a filtered, timestamped version so that
 * stray console.log/debug statements respect LOG_LEVEL as well.
 */
export function applyConsoleLogLevelFilter(prefix = 'console') {
  const methodLevels: Record<ConsoleMethod, LogLevel> = {
    debug: LogLevel.DEBUG,
    log: LogLevel.INFO,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
  };

  (Object.keys(methodLevels) as ConsoleMethod[]).forEach((method) => {
    const level = methodLevels[method];
    const original = baseConsole[method];

    console[method] = (...args: any[]) => {
      if (!shouldLog(level)) {
        return;
      }

      const timestamp = getFormattedTime();
      original(`${timestamp} [${level.toUpperCase()}] [${prefix}]`, ...args);
    };
  });
}

// Create a default logger instance
export const logger = createLogger('app');

// Example usage:
// const logger = createLogger('DocumentService');
// logger.info('Processing document', { id: 123 });
// logger.error('Failed to generate document', error);
