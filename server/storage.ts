import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project, type BudgetNA853Split, type InsertBudgetHistory, type Employee, type InsertEmployee } from "@shared/schema";
import { integer } from "drizzle-orm/pg-core";
import { supabase } from "./config/db";
import session from 'express-session';
import MemoryStore from 'memorystore';

export interface IStorage {
  sessionStore: session.Store;
  getProjectsByUnit(unit: string): Promise<Project[]>;
  getProjectExpenditureTypes(projectId: string): Promise<string[]>;
  getBudgetData(mis: string): Promise<BudgetNA853Split | null>;
  createBudgetHistoryEntry(entry: InsertBudgetHistory): Promise<void>;
  getBudgetHistory(
    mis?: string, 
    page?: number, 
    limit?: number, 
    changeType?: string
  ): Promise<{
    data: any[], 
    pagination: {
      total: number, 
      page: number, 
      limit: number, 
      pages: number
    }
  }>;
  
  // Employee management operations
  getAllEmployees(): Promise<Employee[]>;
  getEmployeesByUnit(unit: string): Promise<Employee[]>;
  searchEmployeesByAFM(afm: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Create an in-memory session store instead of using PostgreSQL
    const MemoryStoreSession = MemoryStore(session);
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      stale: false
    });
    
    console.log('[Storage] In-memory session store initialized');
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
      
      // Check if MIS is numeric or has a special format (like "2024ΝΑ85300001")
      const isNumericMis = /^\d+$/.test(mis);
      const isProjectCode = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/.test(mis); // Pattern for "2024ΝΑ85300001"
      
      // Case 1: If the MIS is a project code (NA853), try to find it in the budget_na853_split table by na853
      if (isProjectCode) {
        console.log(`[Storage] MIS appears to be a project code: ${mis}, searching by na853`);
        const { data: naData, error: naError } = await supabase
          .from('budget_na853_split')
          .select('*')
          .eq('na853', mis)
          .single();
          
        if (!naError && naData) {
          console.log(`[Storage] Found budget data by NA853 code: ${mis}`);
          return naData as BudgetNA853Split;
        }
      }
      
      // Case 2: Try to get budget data directly using MIS as string (default approach)
      const { data, error } = await supabase
        .from('budget_na853_split')
        .select('*')
        .eq('mis', mis)
        .single();
        
      if (error) {
        console.log(`[Storage] Budget not found directly for MIS: ${mis}, trying project lookup`);
        
        // Case 3: Try to find project by either its ID or MIS field
        const projectQuery = isNumericMis 
          ? supabase.from('Projects').select('id, mis').or(`id.eq.${mis},mis.eq.${mis}`).single()
          : supabase.from('Projects').select('id, mis').eq('na853', mis).single();
          
        const { data: projectData, error: projectError } = await projectQuery;
        
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
        
        console.log(`[Storage] Could not find project for MIS or NA853: ${mis}`);
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
      
      // createdAt is automatically handled by the database
      // Remove any created_at property to avoid type errors
      const { created_at, ...entryData } = entry;
      
      const { error } = await supabase
        .from('budget_history')
        .insert(entryData);
        
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
  
  async getBudgetHistory(mis?: string, page: number = 1, limit: number = 10, changeType?: string): Promise<{data: any[], pagination: {total: number, page: number, limit: number, pages: number}}> {
    try {
      console.log(`[Storage] Fetching budget history${mis ? ` for MIS: ${mis}` : ' for all projects'}, page ${page}, limit ${limit}, changeType: ${changeType || 'all'}`);
      
      const offset = (page - 1) * limit;
      
      // Build the base query with the actual schema columns and join with generated_documents for protocol_number_input
      let query = supabase
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
          updated_at,
          generated_documents!budget_history_document_id_fkey (
            protocol_number_input,
            status
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (mis && mis !== 'all') {
        query = query.eq('mis', mis);
      }
      
      if (changeType && changeType !== 'all') {
        query = query.eq('change_type', changeType);
      }
      
      // Get total count first
      const { count, error: countError } = await supabase
        .from('budget_history')
        .select('id', { count: 'exact', head: true });
      
      if (countError) {
        console.error('[Storage] Error getting count of budget history records:', countError);
        throw countError;
      }
      
      // Now get the paginated data with all columns
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) {
        console.error('[Storage] Error fetching budget history data:', error);
        throw error;
      }
      
      // Get the user information for the created_by fields
      // Get unique user IDs and ensure they're all numbers
      const userIds = data
        .filter(entry => entry.created_by)
        .map(entry => {
          const id = typeof entry.created_by === 'string' 
            ? parseInt(entry.created_by) 
            : entry.created_by;
          return id;
        })
        .filter((id, index, self) => self.indexOf(id) === index); // Get unique IDs
      
      let userMap: Record<string, { id: number, name: string }> = {};
      
      if (userIds.length > 0) {
        // Fetch user names from the users table
        console.log('[Storage] Fetching user data for user IDs:', userIds);
        
        // Use a dynamic OR filter instead of IN to handle type mismatches
        let query = supabase
          .from('users')
          .select('id, name, email, role');
        
        // Add each user ID as a filter condition
        if (userIds.length > 0) {
          query = query.or(userIds.map(id => `id.eq.${id}`).join(','));
        }
        
        const { data: userData, error: userError } = await query;
          
        if (!userError && userData) {
          console.log('[Storage] Found user data:', userData);
          // Create a map of user IDs to user objects
          // Always convert IDs to strings to ensure consistent lookup
          userMap = userData.reduce((acc, user) => {
            const userId = String(user.id); // Convert to string key
            acc[userId] = user;
            return acc;
          }, {} as Record<string, { id: number, name: string }>);
          console.log('[Storage] Created user map:', userMap);
        } else {
          console.error('[Storage] Error fetching user data:', userError);
        }
      }
      
      // Format the response data with default values for missing fields
      // Transform to match the frontend expected format
      const formattedData = data?.map(entry => {
        // Log the raw entry to debug
        console.log('[Storage] Raw budget history entry:', JSON.stringify(entry));
        
        // Get user name if available
        const createdBy = entry.created_by;
        let creatorName = 'Σύστημα';
        
        console.log(`[Storage] Looking up creator name for ID: ${createdBy}, type: ${typeof createdBy}`);
        
        if (createdBy) {
          // Try both as string and as number
          const userId = String(createdBy);
          const userIdInt = parseInt(userId);
          
          if (userMap[userId]) {
            console.log(`[Storage] Found user by string ID: ${userId}`, userMap[userId]);
            creatorName = userMap[userId].name;
          } else if (userMap[userIdInt]) {
            console.log(`[Storage] Found user by numeric ID: ${userIdInt}`, userMap[userIdInt]);
            creatorName = userMap[userIdInt].name;
          } else {
            console.log(`[Storage] No user found for ID: ${createdBy}, using generic name`);
            creatorName = `Χρήστης ${createdBy}`;
          }
        }
        
        // Extract document information from the join
        const documentData = entry.generated_documents?.[0] || null;
        const documentStatus = documentData?.status || null;
        const protocolNumberInput = documentData?.protocol_number_input || null;
        
        console.log(`[Storage] Document data for entry ${entry.id}:`, documentData);
        
        // The columns already match what the frontend expects, so we can use them directly
        return {
          id: entry.id,
          mis: entry.mis || 'Unknown',
          previous_amount: entry.previous_amount || '0',
          new_amount: entry.new_amount || '0',
          change_type: entry.change_type || '',
          change_reason: entry.change_reason || '',
          document_id: entry.document_id,
          document_status: documentStatus, // Now set from the joined documents table
          protocol_number_input: protocolNumberInput, // Add protocol number from documents table
          created_by: creatorName,
          created_by_id: entry.created_by,
          created_at: entry.created_at,
          // Add metadata for detailed view
          metadata: {
            // Since we don't have the new schema fields yet, provide empty objects
            previous_version: {},
            updated_version: {},
            changes: {},
            // Create a simple structure to maintain compatibility
            previous_amount: entry.previous_amount,
            new_amount: entry.new_amount,
            change_reason: entry.change_reason
          }
        };
      }) || [];
      
      // Calculate pagination data
      const totalPages = Math.ceil((count || 0) / limit);
      
      console.log(`[Storage] Successfully fetched ${formattedData.length} of ${count} budget history records (page ${page}/${totalPages})`);
      
      return {
        data: formattedData,
        pagination: {
          total: count || 0,
          page,
          limit,
          pages: totalPages
        }
      };
    } catch (error) {
      console.error('[Storage] Error in getBudgetHistory:', error);
      
      // Return empty data with pagination info on error
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      };
    }
  }

  // Employee management methods
  async getAllEmployees(): Promise<Employee[]> {
    try {
      console.log('[Storage] Fetching all employees');
      
      const { data, error } = await supabase
        .from('Employes')
        .select('*')
        .order('Surname', { ascending: true });
        
      if (error) {
        console.error('[Storage] Error fetching employees:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully fetched ${data?.length || 0} employees`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getAllEmployees:', error);
      throw error;
    }
  }

  async getEmployeesByUnit(unit: string): Promise<Employee[]> {
    try {
      console.log(`[Storage] Fetching employees for unit: ${unit}`);
      
      const { data, error } = await supabase
        .from('Employes')
        .select('*')
        .eq('monada', unit)
        .order('Surname', { ascending: true });
        
      if (error) {
        console.error('[Storage] Error fetching employees by unit:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully fetched ${data?.length || 0} employees for unit: ${unit}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getEmployeesByUnit:', error);
      throw error;
    }
  }

  async searchEmployeesByAFM(afm: string): Promise<Employee[]> {
    try {
      console.log(`[Storage] Searching employees by AFM: ${afm}`);
      
      const { data, error } = await supabase
        .from('Employes')
        .select('*')
        .ilike('AFM', `%${afm}%`)
        .order('Surname', { ascending: true });
        
      if (error) {
        console.error('[Storage] Error searching employees by AFM:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} employees matching AFM: ${afm}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in searchEmployeesByAFM:', error);
      throw error;
    }
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    try {
      console.log('[Storage] Creating new employee:', employee);
      
      const { data, error } = await supabase
        .from('Employes')
        .insert(employee)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating employee:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created employee:', data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in createEmployee:', error);
      throw error;
    }
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    try {
      console.log(`[Storage] Updating employee ${id}:`, employee);
      
      const { data, error } = await supabase
        .from('Employes')
        .update(employee)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating employee:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated employee:', data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in updateEmployee:', error);
      throw error;
    }
  }

  async deleteEmployee(id: number): Promise<void> {
    try {
      console.log(`[Storage] Deleting employee ${id}`);
      
      const { error } = await supabase
        .from('Employes')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('[Storage] Error deleting employee:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully deleted employee ${id}`);
    } catch (error) {
      console.error('[Storage] Error in deleteEmployee:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();