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
      console.log(`[Storage] Getting projects for unit: ${unit}`);
      
      // First, fetch all projects
      const { data, error } = await supabase
        .from('Projects')
        .select('*');

      if (error) throw error;
      
      // Normalize the unit name to handle different casing or spacing
      const normalizedUnitName = unit.trim().toLowerCase();
      console.log(`[Storage] Normalized unit name: ${normalizedUnitName}`);
      
      // Search terms based on common abbreviations or partial matches
      const searchTerms = [
        normalizedUnitName,
        // Add common abbreviations or alternative ways the unit could be stored
        'π. αττικησ', // For "Περιφέρεια Αττικής"
        'αττικησ',
        'αττικη',
        // If the unit contains "διευθυνση", also search for just the region part
        ...(normalizedUnitName.includes('διευθυνση') ? 
          [normalizedUnitName.split('διευθυνση')[1]?.trim()] : 
          []),
        // If it's a long name with spaces, try searching for parts
        ...normalizedUnitName.split(' ').filter(part => part.length > 5)
      ].filter(Boolean); // Remove any undefined/empty values
      
      console.log('[Storage] Search terms:', searchTerms);
      
      // Filter projects based on search terms
      const filteredProjects = (data || []).filter(project => {
        if (!project.implementing_agency) return false;
        
        try {
          // Clean up and parse the implementing_agency
          let agencyRaw = project.implementing_agency;
          
          // Handle the complex JSON escaping that occurs in the database 
          // The format looks like {""\""ΣΕΡΡΩΝ\""""}
          if (typeof agencyRaw === 'string') {
            // Try to normalize the string by removing extra escaping
            agencyRaw = agencyRaw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            
            try {
              // Try to parse the JSON
              const parsed = JSON.parse(agencyRaw);
              
              // Handle different possible formats
              if (typeof parsed === 'string') {
                // Single string value
                agencyRaw = parsed;
              } else if (Array.isArray(parsed)) {
                // Array of values
                agencyRaw = parsed;
              }
            } catch (parseError) {
              // If parsing fails, just use the original string
              console.log(`[Storage] Parse error for: ${agencyRaw}`, parseError);
            }
          }
          
          // Convert to array if it's not already
          const agencies = Array.isArray(agencyRaw) ? agencyRaw : [agencyRaw];
          
          // Debug output to see actual values
          console.log(`[Storage] Project ${project.mis} agencies:`, agencies);
          
          // Check if any agency matches any search term
          return agencies.some((agency: any) => {
            if (typeof agency !== 'string') return false;
            
            // Normalize the agency string
            const normalizedAgency = agency.trim().toLowerCase();
            
            // Check against all search terms
            return searchTerms.some(term => 
              normalizedAgency.includes(term) || 
              term.includes(normalizedAgency)
            );
          });
        } catch (e) {
          console.error('[Storage] Error comparing implementing_agency:', e);
          return false;
        }
      });
      
      console.log(`[Storage] Found ${filteredProjects.length} projects for unit: ${unit}`);
      return filteredProjects;
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