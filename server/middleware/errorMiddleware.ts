import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extract valuable debugging information
  const origin = req.headers.origin || 'unknown';
  const referer = req.headers.referer || 'unknown';
  const host = req.headers.host || 'unknown';
  
  // Check if this is likely a cross-domain request from sdegdaefk.gr
  const isSdegdaefkRequest = 
    (origin && origin.includes('sdegdaefk.gr')) || 
    (referer && referer.includes('sdegdaefk.gr')) || 
    (host && host.includes('sdegdaefk.gr'));
  
  // Additional details for logging
  const errorDetails = {
    message: err.message,
    name: err.name,
    code: err.code || 'UNKNOWN',
    status: err.status || 500,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestOrigin: origin,
    requestReferer: referer,
    requestHost: host,
    isSdegdaefkRequest,
    cookies: req.headers.cookie,
    query: req.query,
    sessionID: (req as any).sessionID,
    userIp: req.ip
  };
  
  // Log with higher visibility for sdegdaefk.gr requests
  if (isSdegdaefkRequest) {
    log(`[SDEGDAEFK ERROR] Cross-domain error: ${JSON.stringify(errorDetails)}`, 'error');
  } else {
    log(`[Error] ${JSON.stringify(errorDetails)}`, 'error');
  }

  // Provide appropriate error details in response
  // More detailed in development, more generic in production
  const responseBody = {
    status: 'error',
    message: process.env.NODE_ENV === 'development' 
      ? `${err.message} (see server logs for details)` 
      : 'An unexpected error occurred',
    code: err.code || 'XX000',
    // Include detailed information in development environment only
    ...(process.env.NODE_ENV === 'development' ? {
      path: req.path,
      method: req.method,
      stack: err.stack,
      origin,
      isCorsError: err.message && err.message.includes('CORS'),
      isAuthError: err.message && err.message.includes('auth')
    } : {})
  };

  // Send error response
  res.status(err.status || 500).json(responseBody);
};

export default errorMiddleware;
