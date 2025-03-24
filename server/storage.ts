import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project } from "@shared/schema";
import { integer } from "drizzle-orm/pg-core";
import { supabase } from "./config/db";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
const { Pool } = pg;

export interface IStorage {
  sessionStore: session.Store;
  getProjectsByUnit(unit: string): Promise<Project[]>;
  getProjectExpenditureTypes(projectId: string): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Set up PostgreSQL session store
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    // Create session store
    const PgStore = connectPgSimple(session);
    this.sessionStore = new PgStore({
      pool: pgPool,
      tableName: 'user_sessions', // You may need to create this table
      createTableIfMissing: true,
    });
    
    console.log('[Storage] Session store initialized');
  }

  async getProjectsByUnit(unit: string): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('Projects')
        .select('*');

      if (error) throw error;

      // Filter in JavaScript since PostgREST JSONB filtering is problematic
      return (data || []).filter(project => {
        if (!project.implementing_agency) return false;
        try {
          const agencies = Array.isArray(project.implementing_agency) ? 
            project.implementing_agency : 
            JSON.parse(project.implementing_agency);
          return agencies.includes(unit);
        } catch (e) {
          console.error('[Storage] Error parsing implementing_agency:', e);
          return false;
        }
      });
    } catch (error) {
      console.error('[Storage] Error fetching projects by unit:', error);
      throw error;
    }
  }
  
  async getProjectExpenditureTypes(projectId: string): Promise<string[]> {
    try {
      console.log(`[Storage] Fetching expenditure types for project: ${projectId}`);
      
      const { data, error } = await supabase
        .from('Projects')
        .select('expenditure_type')
        .eq('mis', projectId)
        .single();
        
      if (error) {
        console.error('[Storage] Error fetching project expenditure types:', error);
        throw error;
      }
      
      if (!data || !data.expenditure_type) {
        console.log(`[Storage] No expenditure types found for project: ${projectId}`);
        return [];
      }
      
      // Handle expenditure_type which could be a JSONB array
      try {
        if (Array.isArray(data.expenditure_type)) {
          return data.expenditure_type;
        } else {
          return JSON.parse(data.expenditure_type);
        }
      } catch (e) {
        console.error('[Storage] Error parsing expenditure_type:', e);
        return [];
      }
    } catch (error) {
      console.error('[Storage] Error in getProjectExpenditureTypes:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();