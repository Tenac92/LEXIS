/**
 * Health Check Routes
 * 
 * These routes provide health checks for the application and its dependencies.
 * Useful for monitoring, automated testing, and deployment checks.
 */

import express, { Router, Request, Response } from 'express';
import { testConnection, supabase, markSuccessfulConnection } from '../config/db';
import { log } from '../vite';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router();

// Basic health check that always returns 200 if the server is running
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Comprehensive health check that tests database connectivity
router.get('/db', asyncHandler(async (req: Request, res: Response) => {
  try {
    const dbConnected = await testConnection(1, 5000);
    
    if (!dbConnected) {
      return res.status(503).json({
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log('[Health] Database health check failed: ' + error.message, 'error');
    return res.status(503).json({
      status: 'error',
      message: 'Database health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// Detailed database performance check
router.get('/db/detail', asyncHandler(async (req: Request, res: Response) => {
  let testsPassed = 0;
  let testsFailed = 0;
  const startTime = Date.now();
  const results: any = {};
  
  try {
    // Test 1: Basic connection
    try {
      const connectionResult = await testConnection(1, 5000);
      results.connection = connectionResult ? 'ok' : 'failed';
      connectionResult ? testsPassed++ : testsFailed++;
    } catch (err: any) {
      results.connection = 'error';
      results.connection_error = err.message;
      testsFailed++;
    }
    
    // Test 2: Simple SELECT query
    try {
      const { data, error } = await supabase.from('users').select('id', { count: 'exact', head: true });
      if (error) throw error;
      results.select_query = 'ok';
      testsPassed++;
    } catch (err: any) {
      results.select_query = 'failed';
      results.select_error = err.message;
      testsFailed++;
    }
    
    // Overall assessment
    const totalTime = Date.now() - startTime;
    const status = testsFailed === 0 ? 'ok' : (testsPassed > 0 ? 'degraded' : 'critical');
    
    // If all tests passed, mark the connection as successful
    if (status === 'ok') {
      markSuccessfulConnection();
    }
    
    return res.status(status === 'critical' ? 503 : 200).json({
      status,
      tests_passed: testsPassed,
      tests_failed: testsFailed,
      response_time_ms: totalTime,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to run health checks',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;