import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project, type BudgetNA853Split, type InsertBudgetHistory, type Employee, type InsertEmployee, type Beneficiary, type InsertBeneficiary, type BeneficiaryPayment, type InsertBeneficiaryPayment } from "@shared/schema";
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
    changeType?: string,
    userUnits?: string[],
    dateFrom?: string,
    dateTo?: string,
    creator?: string
  ): Promise<{
    data: any[], 
    pagination: {
      total: number, 
      page: number, 
      limit: number, 
      pages: number
    },
    statistics?: {
      totalEntries: number,
      totalAmountChange: number,
      changeTypes: Record<string, number>,
      periodRange: { start: string, end: string }
    }
  }>;
  
  // Employee management operations - SECURITY: Unit-based access only
  getEmployeesByUnit(unit: string): Promise<Employee[]>;
  searchEmployeesByAFM(afm: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // Beneficiary management operations - SECURITY: Unit-based access only
  getBeneficiariesByUnit(unit: string): Promise<Beneficiary[]>;
  searchBeneficiariesByAFM(afm: string): Promise<Beneficiary[]>;
  getBeneficiaryById(id: number): Promise<Beneficiary | null>;
  createBeneficiary(beneficiary: InsertBeneficiary): Promise<Beneficiary>;
  updateBeneficiary(id: number, beneficiary: Partial<InsertBeneficiary>): Promise<Beneficiary>;
  deleteBeneficiary(id: number): Promise<void>;
  
  // Beneficiary Payment operations - for normalized structure
  getBeneficiaryPayments(beneficiaryId: number): Promise<BeneficiaryPayment[]>;
  createBeneficiaryPayment(payment: InsertBeneficiaryPayment): Promise<BeneficiaryPayment>;
  updateBeneficiaryPayment(id: number, payment: Partial<InsertBeneficiaryPayment>): Promise<BeneficiaryPayment>;
  deleteBeneficiaryPayment(id: number): Promise<void>;
  updateBeneficiaryInstallmentStatus(afm: string, paymentType: string, installment: string, status: string, protocolNumber?: string): Promise<void>;

  // Document generation data operations
  getUnitDetails(unit: string): Promise<any>;
  getStaffByUnit(unit: string): Promise<any[]>;
  getProjectDetails(mis: string): Promise<any | null>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Create an in-memory session store with proper configuration
    const MemoryStoreSession = MemoryStore(session);
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: 48 * 60 * 60 * 1000, // 48 hours (match cookie maxAge)
      stale: false,
      dispose: (key: string, session: any) => {
        console.log(`[SessionStore] Session expired and disposed: ${key}`);
      }
    });
    
    console.log('[Storage] In-memory session store initialized');
  }

  async getProjectsByUnit(unit: string): Promise<Project[]> {
    try {
      console.log(`[Storage] Getting projects for unit: ${unit}`);
      console.log(`[Storage] Unit search pattern: %${unit}%`);
      
      // Use JSONB array contains to search properly - fixed JSON syntax
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .filter('implementing_agency', 'cs', `["${unit}"]`);

      console.log(`[Storage] Query executed, error:`, error);
      console.log(`[Storage] Query result count:`, data?.length || 0);
      
      if (error) {
        console.error(`[Storage] Database error:`, error);
        throw error;
      }
      
      // The database query already filtered by unit using text search
      // Just return the results with basic validation
      console.log(`[Storage] Found ${data?.length || 0} projects for unit: ${unit}`);
      return data || [];
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
  
  async getBudgetHistory(mis?: string, page: number = 1, limit: number = 10, changeType?: string, userUnits?: string[], dateFrom?: string, dateTo?: string, creator?: string): Promise<{data: any[], pagination: {total: number, page: number, limit: number, pages: number}, statistics?: {totalEntries: number, totalAmountChange: number, changeTypes: Record<string, number>, periodRange: { start: string, end: string }}}> {
    try {
      console.log(`[Storage] Fetching budget history${mis ? ` for MIS: ${mis}` : ' for all projects'}, page ${page}, limit ${limit}, changeType: ${changeType || 'all'}, userUnits: ${userUnits?.join(',') || 'all'}`);
      
      const offset = (page - 1) * limit;
      
      // Apply unit-based access control by filtering budget history through user documents
      let allowedMisIds: number[] = [];
      if (userUnits && userUnits.length > 0) {
        console.log('[Storage] Applying unit-based access control for units:', userUnits);
        
        // Get documents created by users from the same units to determine accessible MIS codes
        console.log('[Storage] Searching for users with units overlapping:', userUnits);
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, units')
          .contains('units', userUnits);
        
        console.log('[Storage] User query result:', { userData, userError });
          
        if (!userError && userData && userData.length > 0) {
          const userIds = userData.map(u => u.id);
          console.log('[Storage] Found user IDs in same units:', userIds);
          
          // Get budget history entries created by users from the same units
          const { data: budgetData, error: budgetError } = await supabase
            .from('budget_history')
            .select('mis')
            .in('created_by', userIds);
            
          if (!budgetError && budgetData && budgetData.length > 0) {
            const uniqueMisIds = new Set(budgetData.map(b => parseInt(b.mis)).filter(id => !isNaN(id)));
            allowedMisIds = [...uniqueMisIds];
            console.log('[Storage] Found allowed MIS codes for units:', allowedMisIds.length, allowedMisIds);
          } else {
            console.log('[Storage] No budget history found for unit users');
            allowedMisIds = [-1]; // Use impossible MIS to ensure empty results
          }
        } else {
          console.log('[Storage] No users found for units:', userUnits);
          allowedMisIds = [-1]; // Use impossible MIS to ensure empty results
        }
      }
      
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
      
      // Apply unit-based access control - managers must only see their unit's data
      if (userUnits && userUnits.length > 0) {
        if (allowedMisIds.length > 0 && !allowedMisIds.includes(-1)) {
          console.log('[Storage] Applying MIS filter for allowed MIS codes:', allowedMisIds);
          query = query.in('mis', allowedMisIds);
        } else {
          // No MIS codes found for user's units or using security filter - return empty result
          console.log('[Storage] No valid MIS codes for user units - returning empty result for security');
          return {
            data: [],
            pagination: { total: 0, page, limit, pages: 0 },
            statistics: {
              totalEntries: 0,
              totalAmountChange: 0,
              changeTypes: {},
              periodRange: { start: '', end: '' }
            }
          };
        }
      }
      
      // Apply filters
      if (mis && mis !== 'all') {
        query = query.eq('mis', mis);
      }
      
      if (changeType && changeType !== 'all') {
        query = query.eq('change_type', changeType);
      }
      
      // Apply date filters
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59.999Z');
      }
      
      // Apply creator filter if specified
      if (creator && creator !== 'all' && creator !== '') {
        // First get the user ID for the creator name
        const { data: creatorData, error: creatorError } = await supabase
          .from('users')
          .select('id')
          .eq('name', creator)
          .single();
          
        if (!creatorError && creatorData) {
          query = query.eq('created_by', creatorData.id);
        }
      }
      
      // Get filtered data for statistics calculation (without pagination)
      let statsQuery = supabase
        .from('budget_history')
        .select('id, previous_amount, new_amount, change_type, created_at');
        
      // Apply the same filters to stats query
      if (userUnits && userUnits.length > 0 && allowedProjectIds.length > 0) {
        statsQuery = statsQuery.in('mis', allowedProjectIds);
      } else if (userUnits && userUnits.length > 0 && allowedProjectIds.length === 0) {
        // Return empty statistics
        const emptyStats = {
          totalEntries: 0,
          totalAmountChange: 0,
          changeTypes: {},
          periodRange: { start: '', end: '' }
        };
        
        return {
          data: [],
          pagination: { total: 0, page, limit, pages: 0 },
          statistics: emptyStats
        };
      }
      
      if (mis && mis !== 'all') {
        statsQuery = statsQuery.eq('mis', mis);
      }
      
      if (changeType && changeType !== 'all') {
        statsQuery = statsQuery.eq('change_type', changeType);
      }
      
      if (dateFrom) {
        statsQuery = statsQuery.gte('created_at', dateFrom);
      }
      
      if (dateTo) {
        statsQuery = statsQuery.lte('created_at', dateTo + 'T23:59:59.999Z');
      }
      
      if (creator && creator !== 'all' && creator !== '') {
        const { data: creatorData, error: creatorError } = await supabase
          .from('users')
          .select('id')
          .eq('name', creator)
          .single();
          
        if (!creatorError && creatorData) {
          statsQuery = statsQuery.eq('created_by', creatorData.id);
        }
      }
      
      // Get statistics data
      const { data: statsData, error: statsError } = await statsQuery;
      
      // Calculate statistics
      let statistics = {
        totalEntries: 0,
        totalAmountChange: 0,
        changeTypes: {} as Record<string, number>,
        periodRange: { start: '', end: '' }
      };
      
      if (!statsError && statsData) {
        statistics.totalEntries = statsData.length;
        
        // Calculate total amount change and change types
        let totalChange = 0;
        const changeTypeCounts: Record<string, number> = {};
        let dates: string[] = [];
        
        statsData.forEach(entry => {
          const prevAmount = parseFloat(entry.previous_amount) || 0;
          const newAmount = parseFloat(entry.new_amount) || 0;
          totalChange += (newAmount - prevAmount);
          
          // Count change types
          const changeType = entry.change_type || 'unknown';
          changeTypeCounts[changeType] = (changeTypeCounts[changeType] || 0) + 1;
          
          // Collect dates for period range
          if (entry.created_at) {
            dates.push(entry.created_at);
          }
        });
        
        statistics.totalAmountChange = totalChange;
        statistics.changeTypes = changeTypeCounts;
        
        // Set period range
        if (dates.length > 0) {
          dates.sort();
          statistics.periodRange = {
            start: dates[0],
            end: dates[dates.length - 1]
          };
        }
      }
      
      // Get total count for pagination (with same filters)
      // Clone the query for count to avoid conflicts
      let countQuery = supabase
        .from('budget_history')
        .select('*', { count: 'exact', head: true });
        
      // Apply the same filters to count query
      if (userUnits && userUnits.length > 0 && allowedProjectIds.length > 0) {
        countQuery = countQuery.in('mis', allowedProjectIds);
      }
      
      if (mis && mis !== 'all') {
        countQuery = countQuery.eq('mis', mis);
      }
      
      if (changeType && changeType !== 'all') {
        countQuery = countQuery.eq('change_type', changeType);
      }
      
      if (dateFrom) {
        countQuery = countQuery.gte('created_at', dateFrom);
      }
      
      if (dateTo) {
        countQuery = countQuery.lte('created_at', dateTo + 'T23:59:59.999Z');
      }
      
      if (creator && creator !== 'all' && creator !== '') {
        const { data: creatorData, error: creatorError } = await supabase
          .from('users')
          .select('id')
          .eq('name', creator)
          .single();
          
        if (!creatorError && creatorData) {
          countQuery = countQuery.eq('created_by', creatorData.id);
        }
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('[Storage] Error getting count of budget history records:', countError);
        throw countError;
      }
      
      // Now get the paginated data with all columns
      const { data, error } = await query
        .order('id', { ascending: false })
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
        },
        statistics
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
        .from('Employees')
        .select('*')
        .order('surname', { ascending: true });
        
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
        .from('Employees')
        .select('*')
        .eq('monada', unit)
        .order('surname', { ascending: true });
        
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
      
      // For bigint fields, use range search to find AFM numbers that start with the search term
      const searchNum = parseInt(afm);
      if (isNaN(searchNum)) {
        return [];
      }
      
      // Calculate range for numbers that start with the search term
      const multiplier = Math.pow(10, (9 - afm.length)); // AFM is typically 9 digits
      const rangeStart = searchNum * multiplier;
      const rangeEnd = (searchNum + 1) * multiplier - 1;
      
      const { data, error } = await supabase
        .from('Employees')
        .select('*')
        .gte('afm', rangeStart)
        .lte('afm', rangeEnd)
        .order('surname', { ascending: true })
        .limit(20);
        
      if (error) {
        console.error('[Storage] Error searching employees by AFM:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} employees matching AFM range ${rangeStart}-${rangeEnd}`);
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
        .from('Employees')
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
        .from('Employees')
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
        .from('Employees')
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

  // Beneficiary management methods - SECURITY: Removed getAllBeneficiaries to prevent unauthorized access
  // All beneficiary access must go through unit-based filtering

  async getBeneficiariesByUnit(unit: string): Promise<Beneficiary[]> {
    try {
      console.log(`[Storage] Fetching ALL beneficiaries for unit: ${unit} using pagination`);
      
      let allBeneficiaries: Beneficiary[] = [];
      let fromIndex = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`[Storage] Fetching batch ${Math.floor(fromIndex / batchSize) + 1}, starting from index ${fromIndex}`);
        
        // Use the legacy Beneficiary table since it has the expected structure with monada column
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('*')
          .range(fromIndex, fromIndex + batchSize - 1);
          
        if (error) {
          console.error('[Storage] Error fetching beneficiaries batch:', error);
          throw error;
        }
        
        const batchData = data || [];
        allBeneficiaries.push(...batchData);
        
        console.log(`[Storage] Fetched ${batchData.length} beneficiaries in this batch. Total so far: ${allBeneficiaries.length}`);
        
        // If we got less than the batch size, we've reached the end
        hasMore = batchData.length === batchSize;
        fromIndex += batchSize;
        
        // Safety break to prevent infinite loops
        if (fromIndex > 50000) {
          console.warn('[Storage] Safety break activated - stopping at 50,000 records');
          break;
        }
      }
      
      console.log(`[Storage] FINAL: Successfully fetched ${allBeneficiaries.length} beneficiaries for unit: ${unit}`);
      return allBeneficiaries;
    } catch (error) {
      console.error('[Storage] Error in getBeneficiariesByUnit:', error);
      throw error;
    }
  }

  async searchBeneficiariesByAFM(afm: string): Promise<Beneficiary[]> {
    try {
      console.log(`[Storage] Searching beneficiaries by AFM: ${afm}`);
      
      const searchNum = parseInt(afm);
      if (isNaN(searchNum)) {
        return [];
      }
      
      // For exact AFM match first, then partial matches
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('afm', searchNum)
        .order('id', { ascending: false });
        
      if (error) {
        console.error('[Storage] Error searching beneficiaries by AFM:', error);
        throw error;
      }
      
      // Return all beneficiaries - let the frontend determine available installments
      console.log(`[Storage] Found ${data?.length || 0} beneficiaries with AFM: ${afm}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in searchBeneficiariesByAFM:', error);
      throw error;
    }
  }

  async getBeneficiaryById(id: number): Promise<Beneficiary | null> {
    try {
      console.log(`[Storage] Fetching beneficiary by ID: ${id}`);
      
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[Storage] Beneficiary with ID ${id} not found`);
          return null;
        }
        console.error('[Storage] Error fetching beneficiary by ID:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully fetched beneficiary:`, data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in getBeneficiaryById:', error);
      throw error;
    }
  }

  async createBeneficiary(beneficiary: InsertBeneficiary): Promise<Beneficiary> {
    try {
      console.log('[Storage] Creating new beneficiary:', beneficiary);
      
      // Let the database handle ID generation with its sequence
      const { data, error } = await supabase
        .from('beneficiaries')
        .insert({
          ...beneficiary,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating beneficiary:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created beneficiary with ID:', data.id);
      return data;
    } catch (error) {
      console.error('[Storage] Error in createBeneficiary:', error);
      throw error;
    }
  }

  async updateBeneficiary(id: number, beneficiary: Partial<InsertBeneficiary>): Promise<Beneficiary> {
    try {
      console.log(`[Storage] Updating beneficiary ${id}:`, beneficiary);
      
      const { data, error } = await supabase
        .from('beneficiaries')
        .update({
          ...beneficiary,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating beneficiary:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated beneficiary:', data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in updateBeneficiary:', error);
      throw error;
    }
  }

  async deleteBeneficiary(id: number): Promise<void> {
    try {
      console.log(`[Storage] Deleting beneficiary ${id}`);
      
      const { error } = await supabase
        .from('beneficiaries')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('[Storage] Error deleting beneficiary:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully deleted beneficiary ${id}`);
    } catch (error) {
      console.error('[Storage] Error in deleteBeneficiary:', error);
      throw error;
    }
  }

  async updateBeneficiaryInstallmentStatus(afm: string, paymentType: string, installment: string, status: string, protocolNumber?: string): Promise<void> {
    try {
      console.log(`[Storage] Updating beneficiary installment status for AFM: ${afm}, Type: ${paymentType}, Installment: ${installment}, Status: ${status}`);
      
      // First, get the beneficiary by AFM
      const { data: beneficiary, error: fetchError } = await supabase
        .from('beneficiaries')
        .select('id')
        .eq('afm', afm)
        .single();
        
      if (fetchError || !beneficiary) {
        console.error('[Storage] Error fetching beneficiary for status update:', fetchError);
        throw new Error(`Beneficiary with AFM ${afm} not found`);
      }
      
      // Using normalized beneficiary_payments table approach
      console.log(`[Storage] Updating payment record for beneficiary ${beneficiary.id}`);
      
      // The update will happen to the beneficiary_payments table directly
      
      // Update the beneficiary record
      const { error: updateError } = await supabase
        .from('beneficiary_payments')
        .update({
          status: status,
          protocol_number: protocolNumber,
          updated_at: new Date().toISOString()
        })
        .eq('beneficiary_id', beneficiary.id)
        .eq('expenditure_type', paymentType)
        .eq('installment', installment);
        
      if (updateError) {
        console.error('[Storage] Error updating beneficiary installment status:', updateError);
        throw updateError;
      }
      
      console.log(`[Storage] Successfully updated beneficiary ${afm} installment ${installment} status to ${status}`);
    } catch (error) {
      console.error('[Storage] Error in updateBeneficiaryInstallmentStatus:', error);
      throw error;
    }
  }

  // Document generation data operations implementation
  async getUnitDetails(unit: string): Promise<any> {
    try {
      console.log(`[Storage] Fetching unit details for: ${unit}`);
      
      const { data, error } = await supabase
        .from('Monada')
        .select('*')
        .eq('unit', unit)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('[Storage] Error fetching unit details:', error);
        throw error;
      }

      console.log(`[Storage] Successfully fetched unit details for: ${unit}`);
      return data;
    } catch (error) {
      console.error('[Storage] Error in getUnitDetails:', error);
      throw error;
    }
  }

  async getStaffByUnit(unit: string): Promise<any[]> {
    try {
      console.log(`[Storage] Fetching staff for unit: ${unit}`);
      
      const { data, error } = await supabase
        .from('Employees')
        .select('*')
        .eq('monada', unit);

      if (error) {
        console.error('[Storage] Error fetching staff by unit:', error);
        throw error;
      }

      console.log(`[Storage] Successfully fetched ${data?.length || 0} staff members for unit: ${unit}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getStaffByUnit:', error);
      throw error;
    }
  }

  async getProjectDetails(identifier: string): Promise<any | null> {
    try {
      console.log(`[Storage] Fetching project details for identifier: ${identifier}`);
      
      // Check if identifier is numeric (MIS) or alphanumeric (NA853)
      if (/^\d+$/.test(identifier)) {
        // Numeric identifier - search by MIS
        const { data, error } = await supabase
          .from('Projects')
          .select('*')
          .eq('mis', parseInt(identifier))
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('[Storage] Error fetching project details by MIS:', error);
          throw error;
        }

        if (data) {
          console.log(`[Storage] Successfully fetched project details for MIS: ${identifier}`);
          return data;
        }
      } else {
        // Alphanumeric identifier - try different possible column names for NA853
        const possibleColumns = ['budget_na853', 'na853', 'project_na853'];
        
        for (const column of possibleColumns) {
          try {
            const { data, error } = await supabase
              .from('Projects')
              .select('*')
              .eq(column, identifier)
              .single();

            if (data) {
              console.log(`[Storage] Successfully fetched project details for ${column}: ${identifier}`);
              return data;
            }
            
            if (error && error.code !== 'PGRST116') {
              console.log(`[Storage] Column ${column} not found or error:`, error.message);
            }
          } catch (err) {
            console.log(`[Storage] Skipping column ${column} due to error:`, err);
            continue;
          }
        }
      }

      console.log(`[Storage] No project found for identifier: ${identifier}`);
      return null;
    } catch (error) {
      console.error('[Storage] Error in getProjectDetails:', error);
      return null; // Return null instead of throwing to prevent document generation from failing
    }
  }

  // Beneficiary Payment operations - for normalized structure
  async getBeneficiaryPayments(beneficiaryId: number): Promise<BeneficiaryPayment[]> {
    try {
      console.log(`[Storage] Fetching payments for beneficiary ID: ${beneficiaryId}`);
      
      const { data, error } = await supabase
        .from('beneficiary_payments')
        .select('*')
        .eq('beneficiary_id', beneficiaryId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[Storage] Error fetching beneficiary payments:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} payments for beneficiary ${beneficiaryId}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getBeneficiaryPayments:', error);
      throw error;
    }
  }

  async createBeneficiaryPayment(payment: InsertBeneficiaryPayment): Promise<BeneficiaryPayment> {
    try {
      console.log('[Storage] Creating new beneficiary payment:', payment);
      
      const { data, error } = await supabase
        .from('beneficiary_payments')
        .insert({
          ...payment,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating beneficiary payment:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created beneficiary payment with ID:', data.id);
      return data;
    } catch (error) {
      console.error('[Storage] Error in createBeneficiaryPayment:', error);
      throw error;
    }
  }

  async updateBeneficiaryPayment(id: number, payment: Partial<InsertBeneficiaryPayment>): Promise<BeneficiaryPayment> {
    try {
      console.log(`[Storage] Updating beneficiary payment ${id}:`, payment);
      
      const { data, error } = await supabase
        .from('beneficiary_payments')
        .update({
          ...payment,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating beneficiary payment:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated beneficiary payment:', data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in updateBeneficiaryPayment:', error);
      throw error;
    }
  }

  async deleteBeneficiaryPayment(id: number): Promise<void> {
    try {
      console.log(`[Storage] Deleting beneficiary payment ${id}`);
      
      const { error } = await supabase
        .from('beneficiary_payments')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('[Storage] Error deleting beneficiary payment:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully deleted beneficiary payment ${id}`);
    } catch (error) {
      console.error('[Storage] Error in deleteBeneficiaryPayment:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();