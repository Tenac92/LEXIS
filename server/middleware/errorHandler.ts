/**
 * Enhanced Error Handler Middleware
 * Provides comprehensive error handling for database and application errors
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Error types
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  DATABASE = 'DATABASE_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
  SUPABASE = 'SUPABASE_ERROR'
}

export interface AppError extends Error {
  type: ErrorType;
  statusCode: number;
  details?: any;
  timestamp: string;
}

// Create application error
export function createAppError(
  type: ErrorType,
  message: string,
  statusCode: number,
  details?: any
): AppError {
  const error = new Error(message) as AppError;
  error.type = type;
  error.statusCode = statusCode;
  error.details = details;
  error.timestamp = new Date().toISOString();
  return error;
}

// Database error detection
export function isDatabaseError(error: any): boolean {
  return (
    error?.code?.startsWith('P') || // Prisma errors
    error?.code?.startsWith('23') || // PostgreSQL constraint errors
    error?.message?.includes('duplicate key') ||
    error?.message?.includes('violates foreign key constraint') ||
    error?.message?.includes('violates not-null constraint') ||
    error?.message?.includes('violates unique constraint') ||
    error?.message?.includes('Connection terminated') ||
    error?.message?.includes('ECONNREFUSED') ||
    error?.message?.includes('timeout')
  );
}

// Supabase error detection
export function isSupabaseError(error: any): boolean {
  return (
    error?.message?.includes('JWT') ||
    error?.message?.includes('API key') ||
    error?.message?.includes('RLS') ||
    error?.message?.includes('Row Level Security') ||
    error?.details?.includes('permission denied') ||
    error?.code === 'PGRST'
  );
}

// Parse database error details
export function parseDatabaseError(error: any): {
  type: ErrorType;
  message: string;
  statusCode: number;
  details?: any;
} {
  // Handle Supabase specific errors
  if (isSupabaseError(error)) {
    return {
      type: ErrorType.SUPABASE,
      message: 'Database access error',
      statusCode: 403,
      details: {
        supabaseError: error.message,
        code: error.code
      }
    };
  }
  
  // Handle PostgreSQL constraint errors
  if (error?.code?.startsWith('23')) {
    switch (error.code) {
      case '23505': // unique_violation
        return {
          type: ErrorType.CONFLICT,
          message: 'Duplicate entry detected',
          statusCode: 409,
          details: {
            constraint: error.constraint,
            detail: error.detail
          }
        };
      case '23503': // foreign_key_violation
        return {
          type: ErrorType.VALIDATION,
          message: 'Invalid reference to related record',
          statusCode: 400,
          details: {
            constraint: error.constraint,
            detail: error.detail
          }
        };
      case '23502': // not_null_violation
        return {
          type: ErrorType.VALIDATION,
          message: 'Required field missing',
          statusCode: 400,
          details: {
            column: error.column,
            table: error.table
          }
        };
      default:
        return {
          type: ErrorType.DATABASE,
          message: 'Database constraint error',
          statusCode: 400,
          details: {
            code: error.code,
            detail: error.detail
          }
        };
    }
  }
  
  // Handle connection errors
  if (error?.message?.includes('Connection terminated') || 
      error?.message?.includes('ECONNREFUSED')) {
    return {
      type: ErrorType.DATABASE,
      message: 'Database connection failed',
      statusCode: 503,
      details: {
        originalError: error.message
      }
    };
  }
  
  // Generic database error
  return {
    type: ErrorType.DATABASE,
    message: 'Database operation failed',
    statusCode: 500,
    details: {
      originalError: error.message
    }
  };
}

// Main error handler middleware
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[ErrorHandler] Error caught:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
    
    return res.status(400).json({
      status: 'error',
      type: ErrorType.VALIDATION,
      message: 'Validation failed',
      errors: validationErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle application errors
  if (error.type && error.statusCode) {
    return res.status(error.statusCode).json({
      status: 'error',
      type: error.type,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp
    });
  }
  
  // Handle database errors
  if (isDatabaseError(error)) {
    const dbError = parseDatabaseError(error);
    return res.status(dbError.statusCode).json({
      status: 'error',
      type: dbError.type,
      message: dbError.message,
      details: dbError.details,
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle authentication errors
  if (error.message?.includes('Unauthorized') || 
      error.message?.includes('Authentication')) {
    return res.status(401).json({
      status: 'error',
      type: ErrorType.AUTHENTICATION,
      message: 'Authentication required',
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle authorization errors
  if (error.message?.includes('Forbidden') || 
      error.message?.includes('Access denied')) {
    return res.status(403).json({
      status: 'error',
      type: ErrorType.AUTHORIZATION,
      message: 'Access forbidden',
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle not found errors
  if (error.message?.includes('not found') || 
      error.message?.includes('Not found')) {
    return res.status(404).json({
      status: 'error',
      type: ErrorType.NOT_FOUND,
      message: 'Resource not found',
      timestamp: new Date().toISOString()
    });
  }
  
  // Generic internal server error
  res.status(500).json({
    status: 'error',
    type: ErrorType.INTERNAL,
    message: 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      details: {
        originalError: error.message,
        stack: error.stack
      }
    })
  });
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    type: ErrorType.NOT_FOUND,
    message: `Route ${req.originalUrl} not found`,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}