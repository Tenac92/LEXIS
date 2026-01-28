/**
 * SQL Execution API Route
 * Provides safe SQL execution through Supabase
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function executeSQLQuery(req: Request, res: Response) {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    const startTime = Date.now();
    const queryLower = query.toLowerCase().trim();
    
    // Determine query type and route appropriately
    let result;
    
    if (queryLower.includes('select count(')) {
      // Handle COUNT queries
      const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        result = {
          success: true,
          data: [{ count }],
          queryType: 'count',
          executionTime: Date.now() - startTime,
          rowCount: 1
        };
      }
    } else if (queryLower.startsWith('select')) {
      // Handle SELECT queries
      const tableMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        
        // Parse SELECT fields
        const selectMatch = query.match(/select\s+(.*?)\s+from/i);
        const fields = selectMatch ? selectMatch[1].trim() : '*';
        
        // Parse LIMIT
        const limitMatch = query.match(/limit\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
        
        let supabaseQuery: any = supabase.from(tableName);
        
        if (fields === '*') {
          supabaseQuery = supabaseQuery.select('*');
        } else {
          supabaseQuery = supabaseQuery.select(fields);
        }
        
        supabaseQuery = supabaseQuery.limit(limit);
        
        const { data, error } = await supabaseQuery;
        
        if (error) throw error;
        
        result = {
          success: true,
          data,
          queryType: 'select',
          executionTime: Date.now() - startTime,
          rowCount: data?.length || 0
        };
      }
    } else if (queryLower.includes('information_schema') || queryLower.includes('current_database')) {
      // System queries
      if (queryLower.includes('current_database') || queryLower.includes('version')) {
        result = {
          success: true,
          data: [{
            current_database: 'Supabase PostgreSQL',
            version: 'PostgreSQL via Supabase',
            connection_status: 'Active',
            timestamp: new Date().toISOString()
          }],
          queryType: 'system',
          executionTime: Date.now() - startTime,
          rowCount: 1
        };
      } else if (queryLower.includes('table_name')) {
        // Table listing
        const knownTables = [
          'Projects', 'project_index', 'project_history', 'budget_na853_split',
          'budget_history', 'event_types', 'expenditure_types', 'kallikratis',
          'Monada', 'users', 'beneficiaries', 'employees', 'documents'
        ];
        
        const tableData = knownTables.map(table => ({
          table_name: table,
          table_type: 'BASE TABLE',
          table_schema: 'public'
        }));
        
        result = {
          success: true,
          data: tableData,
          queryType: 'system',
          executionTime: Date.now() - startTime,
          rowCount: tableData.length
        };
      }
    } else {
      // Unsupported query type
      result = {
        success: false,
        error: 'Query type not supported. Use SELECT, COUNT, or system queries.',
        queryType: 'unsupported',
        executionTime: Date.now() - startTime
      };
    }
    
    res.json(result);
    
  } catch (error: any) {
    console.error('SQL execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'SQL execution failed',
      executionTime: Date.now() - Date.now()
    });
  }
}