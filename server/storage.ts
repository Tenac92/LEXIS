import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project } from "@shared/schema";
import { supabase } from "./config/db";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
const { Pool } = pg;

export interface IStorage {
  sessionStore: session.Store;
  getProjectsByUnit(unit: string): Promise<Project[]>;
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
}

export const storage = new DatabaseStorage();