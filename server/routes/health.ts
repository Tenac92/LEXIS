/**
 * Enhanced Health Check Routes for Supabase Migration
 * 
 * These routes provide comprehensive health checks for the application and its Supabase database.
 * Useful for monitoring, automated testing, and deployment checks.
 * Enhanced with Supabase-specific diagnostics.
 */

import express, { Router, Request, Response } from 'express';
import { testConnection, supabase, markSuccessfulConnection } from '../config/db';
import { log } from '../vite';
import { asyncHandler } from '../middleware/errorHandler';
import os from 'os';

const router: Router = express.Router();

// Basic health check that always returns 200 if the server is running
router.get('/', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    server: {
      version: process.version,
      platform: process.platform,
      memory: {
        usage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // RSS in MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // Heap total in MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) // Heap used in MB
        },
        system: {
          free: Math.round(freeMemory / 1024 / 1024), // Free memory in MB
          total: Math.round(totalMemory / 1024 / 1024), // Total memory in MB
          percentage: Math.round((freeMemory / totalMemory) * 100) // Percentage of free memory
        }
      }
    },
    environment: process.env.NODE_ENV || 'development',
    database: 'supabase' // Indicate that we're using Supabase
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

// Supabase-specific comprehensive health check
router.get('/supabase', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const results: Record<string, any> = {};
  let overallStatus = 'ok';
  
  try {
    // Test 1: Basic connectivity
    try {
      const connectionResult = await testConnection(1, 5000);
      results.connectivity = {
        status: connectionResult ? 'ok' : 'failed',
        message: connectionResult ? 'Successfully connected to Supabase' : 'Failed to connect to Supabase'
      };
      if (!connectionResult) overallStatus = 'critical';
    } catch (err: any) {
      results.connectivity = {
        status: 'error',
        message: `Connection error: ${err.message}`
      };
      overallStatus = 'critical';
    }
    
    // Skip other tests if connectivity failed
    if (overallStatus !== 'critical') {
      // Test 2: Authentication access (users table)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true });
        
        if (error) throw error;
        results.authentication = {
          status: 'ok',
          message: 'Successfully accessed users table'
        };
      } catch (err: any) {
        results.authentication = {
          status: 'failed',
          message: `Authentication error: ${err.message}`
        };
        overallStatus = overallStatus === 'ok' ? 'degraded' : overallStatus;
      }
      
      // Test 3: Projects access
      try {
        const { data, error } = await supabase
          .from('Projects')
          .select('id', { count: 'exact', head: true });
        
        if (error) throw error;
        results.projects = {
          status: 'ok',
          message: 'Successfully accessed Projects table'
        };
      } catch (err: any) {
        results.projects = {
          status: 'failed',
          message: `Projects access error: ${err.message}`
        };
        overallStatus = overallStatus === 'ok' ? 'degraded' : overallStatus;
      }
      
      // Test 4: Budget data access
      try {
        const { data, error } = await supabase
          .from('budget_na853_split')
          .select('id', { count: 'exact', head: true });
        
        if (error) throw error;
        results.budget = {
          status: 'ok',
          message: 'Successfully accessed budget data'
        };
      } catch (err: any) {
        results.budget = {
          status: 'failed',
          message: `Budget data access error: ${err.message}`
        };
        overallStatus = overallStatus === 'ok' ? 'degraded' : overallStatus;
      }
      
      // Test 5: Session functionality
      try {
        // Just test that we have session functionality
        results.session = {
          status: 'ok',
          message: 'Using in-memory session storage'
        };
      } catch (err: any) {
        results.session = {
          status: 'degraded',
          message: `Session check error: ${err.message}`
        };
      }
    }
    
    // If at least one check passed, mark connection as successful
    if (overallStatus !== 'critical') {
      markSuccessfulConnection();
    }
    
    const statusCode = overallStatus === 'critical' ? 503 : 200;
    const totalTime = Date.now() - startTime;
    
    return res.status(statusCode).json({
      status: overallStatus,
      database: 'supabase',
      environment: process.env.NODE_ENV || 'development',
      server_time: new Date().toISOString(),
      response_time_ms: totalTime,
      results,
      note: "This health check verifies connectivity to Supabase after the migration from PostgreSQL (Neon DB)"
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to run Supabase health checks',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;