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
const currentLogLevel = 
  process.env.LOG_LEVEL?.toLowerCase() as LogLevel || 
  (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);

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
  
  // Handle different types of messages
  if (typeof message === 'string') {
    if (args.length > 0) {
      console[level](logPrefix, message, ...args);
    } else {
      console[level](logPrefix, message);
    }
  } else {
    // For objects, arrays, etc.
    console[level](logPrefix, message, ...args);
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

// Create a default logger instance
export const logger = createLogger('app');

// Example usage:
// const logger = createLogger('DocumentService');
// logger.info('Processing document', { id: 123 });
// logger.error('Failed to generate document', error);