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

  // Log extra debug information for sdegdaefk.gr errors
  if (isSdegdaefkRequest) {
    log(`[SDEGDAEFK DEBUG] Request URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`, 'info');
    log(`[SDEGDAEFK DEBUG] Request Method: ${req.method}`, 'info');
    log(`[SDEGDAEFK DEBUG] Error Status: ${err.status || 500}`, 'info');
    log(`[SDEGDAEFK DEBUG] Error Message: ${err.message}`, 'info');
    log(`[SDEGDAEFK DEBUG] Accept Header: ${req.headers.accept || 'none'}`, 'info');
  }

  // Special handling for sdegdaefk.gr domain errors with browser requests
  if (isSdegdaefkRequest) {
    // For browser requests from sdegdaefk.gr domain, send a friendly HTML error page with a redirect
    log('[SDEGDAEFK ERROR] Responding with HTML error page for browser request', 'info');
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="5;url=/">
          <title>ΣΔΕΓΔΑΕΦΚ - Σφάλμα Συστήματος</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #cc0000; }
            .error-box { background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
            .btn { display: inline-block; background: #0066cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Σφάλμα Συστήματος</h1>
          <div class="error-box">
            <p>Παρουσιάστηκε ένα σφάλμα κατά την επεξεργασία του αιτήματός σας.</p>
            <p>Το σύστημα θα σας ανακατευθύνει αυτόματα στην αρχική σελίδα σε 5 δευτερόλεπτα.</p>
            <p><a class="btn" href="/">Επιστροφή στην αρχική σελίδα</a></p>
          </div>
          <p><small>Κωδικός σφάλματος: ${err.code || 'XX000'}</small></p>
        </body>
      </html>
    `;
    
    return res
      .status(err.status || 500)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      })
      .send(errorHtml);
  }
  
  // For API requests or other domains, send a JSON response
  res.status(err.status || 500).json(responseBody);
};

export default errorMiddleware;
