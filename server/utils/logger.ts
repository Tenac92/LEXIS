/**
 * Unified Logger
 * 
 * Centralized logging for the application.
 * Provides consistent log formatting and categorization.
 */

// Define log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Interface for logger
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Format a log message with timestamp and additional data
 */
function formatLogMessage(level: LogLevel, message: string, args: any[]): string {
  const timestamp = new Date().toISOString();
  const formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  if (args.length > 0) {
    try {
      const argsString = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      return `${formattedMessage} ${argsString}`;
    } catch (e) {
      return `${formattedMessage} [Error formatting args: ${e.message}]`;
    }
  }
  
  return formattedMessage;
}

/**
 * Create a logger that logs to the console
 */
export const logger: Logger = {
  debug(message: string, ...args: any[]) {
    console.debug(formatLogMessage('debug', message, args));
  },
  
  info(message: string, ...args: any[]) {
    console.log(formatLogMessage('info', message, args));
  },
  
  warn(message: string, ...args: any[]) {
    console.warn(formatLogMessage('warn', message, args));
  },
  
  error(message: string, ...args: any[]) {
    console.error(formatLogMessage('error', message, args));
  }
};