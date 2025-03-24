import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project, type BudgetNA853Split, type InsertBudgetHistory } from "@shared/schema";
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
  getBudgetData(mis: string): Promise<BudgetNA853Split | null>;
  createBudgetHistoryEntry(entry: InsertBudgetHistory): Promise<void>;
  getBudgetHistory(mis: string): Promise<any[]>;
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
      
      // Map specific full unit names to their abbreviated forms as stored in the database
      const unitAbbreviationMap: Record<string, string[]> = {
        'διευθυνση αποκαταστασης επιπτωσεων φυσικων καταστροφων κεντρικης ελλαδος': ['δαεφκ-κε', 'δαεφκ κε'],
        'διευθυνση αποκαταστασης επιπτωσεων φυσικων καταστροφων βορειου ελλαδος': ['δαεφκ-βε', 'δαεφκ βε'],
        'διευθυνση αποκαταστασης επιπτωσεων φυσικων καταστροφων δυτικης ελλαδος': ['δαεφκ-δε', 'δαεφκ δε'],
        'διευθυνση αποκαταστασης επιπτωσεων φυσικων καταστροφων αττικης και κυκλαδων': ['δαεφκ-ακ', 'δαεφκ ακ'],
        'τομεας αποκαταστασης επιπτωσεων φυσικων καταστροφων ανατολικης αττικης': ['ταεφκ-αα', 'ταεφκ αα'],
        'τομεας αποκαταστασης επιπτωσεων φυσικων καταστροφων δυτικης αττικης': ['ταεφκ-δα', 'ταεφκ δα'],
        'τομεας αποκαταστασης επιπτωσεων φυσικων καταστροφων χανιων': ['ταεφκ χανιων'],
        'τομεας αποκαταστασης επιπτωσεων φυσικων καταστροφων ηρακλειου': ['ταεφκ ηρακλειου'],
        'περιφερεια αττικης': ['π. αττικησ', 'αττικησ', 'αττικη']
      };
      
      // Get abbreviations for this unit if they exist
      const specificAbbreviations = unitAbbreviationMap[normalizedUnitName] || [];
      
      // Search terms based on common abbreviations or partial matches
      const searchTerms = [
        normalizedUnitName,
        ...specificAbbreviations,
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

  async getBudgetData(mis: string): Promise<BudgetNA853Split | null> {
    try {
      console.log(`[Storage] Fetching budget data for MIS: ${mis}`);
      
      // Try to get budget data directly using MIS
      const { data, error } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', mis)
        .single();
        
      if (error) {
        console.log(`[Storage] Budget not found directly for MIS: ${mis}, trying project lookup`);
        
        // Try to find project by either its ID or MIS field
        const { data: projectData } = await supabase
          .from('Projects')
          .select('id, mis')
          .or(`id.eq.${mis},mis.eq.${mis}`)
          .single();
        
        if (projectData?.mis) {
          console.log(`[Storage] Found project with MIS: ${projectData.mis}`);
          
          // Try again with the project's MIS value
          const retryResult = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('mis', projectData.mis)
            .single();
            
          if (retryResult.error) {
            console.log(`[Storage] Budget still not found for MIS: ${projectData.mis}`);
            return null;
          }
          
          return retryResult.data as BudgetNA853Split;
        }
        
        console.log(`[Storage] Could not find project for MIS: ${mis}`);
        return null;
      }
      
      return data as BudgetNA853Split;
    } catch (error) {
      console.error('[Storage] Error fetching budget data:', error);
      return null;
    }
  }
  
  async createBudgetHistoryEntry(entry: InsertBudgetHistory): Promise<void> {
    try {
      console.log(`[Storage] Creating budget history entry for MIS: ${entry.mis}`);
      
      // Make sure createdAt is set if not provided
      if (!entry.created_at) {
        entry.created_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('budget_history')
        .insert(entry);
        
      if (error) {
        console.error('[Storage] Error creating budget history entry:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created budget history entry');
    } catch (error) {
      console.error('[Storage] Error in createBudgetHistoryEntry:', error);
      throw error;
    }
  }
  
  async getBudgetHistory(mis: string): Promise<any[]> {
    try {
      console.log(`[Storage] Fetching budget history for MIS: ${mis}`);
      
      const { data, error } = await supabase
        .from('budget_history')
        .select(`
          id,
          mis,
          previous_amount,
          new_amount,
          change_type,
          change_reason,
          document_id,
          created_by,
          created_at,
          metadata
        `)
        .eq('mis', mis)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[Storage] Error fetching budget history:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getBudgetHistory:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();