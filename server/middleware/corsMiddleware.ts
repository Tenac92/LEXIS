import { Request, Response, NextFunction } from 'express';

/**
 * Custom CORS middleware to handle connections with external domains
 * especially for sdegdaefk.gr
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if the request is from sdegdaefk.gr
  const origin = req.headers.origin;
  
  // Allow sdegdaefk.gr
  if (origin === 'https://sdegdaefk.gr') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
}

export default corsMiddleware;