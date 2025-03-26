import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * Health check endpoint
 * GET /api/healthcheck
 * 
 * This endpoint provides basic health checking functionality
 * and also serves as a test for CORS configuration with external domains
 */
router.get('/', (_req: Request, res: Response) => {
  // Construct a response that contains useful debugging information
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
      'Cross-Origin-Embedder-Policy': res.getHeader('Cross-Origin-Embedder-Policy'),
      'Cross-Origin-Opener-Policy': res.getHeader('Cross-Origin-Opener-Policy'),
      'Cross-Origin-Resource-Policy': res.getHeader('Cross-Origin-Resource-Policy')
    },
    // Include additional information that might be helpful for debugging
    message: 'Server is running and healthy',
    cors: {
      enabled: true,
      domains: ['https://sdegdaefk.gr', 'http://sdegdaefk.gr']
    },
  };
  
  res.status(200).json(response);
});

/**
 * Extended health check endpoint with origin testing
 * GET /api/healthcheck/cors-test
 * 
 * This endpoint specifically tests CORS handling
 */
router.get('/cors-test', (req: Request, res: Response) => {
  const origin = req.headers.origin || 'No origin header';
  const referer = req.headers.referer || 'No referer header';
  
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    requestOrigin: origin,
    requestReferer: referer,
    corsEnabled: true,
    message: 'CORS test endpoint',
    allowedOrigins: ['https://sdegdaefk.gr', 'http://sdegdaefk.gr'],
    allowCredentials: true,
    responseHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  };
  
  res.status(200).json(response);
});

export default router;