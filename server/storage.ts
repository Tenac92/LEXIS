import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project, type ProjectBudget, type InsertBudgetHistory, type Employee, type InsertEmployee, type Beneficiary, type InsertBeneficiary, type BeneficiaryPayment, type InsertBeneficiaryPayment, type ProjectBudgetVersion, type InsertProjectBudgetVersion, type EpaFinancials, type InsertEpaFinancials } from "@shared/schema";
import { integer } from "drizzle-orm/pg-core";
import { supabase } from "./config/db";
import session from 'express-session';
import MemoryStore from 'memorystore';
import { encryptAFM, decryptAFM, hashAFM } from './utils/crypto';

export interface IStorage {
  sessionStore: session.Store;
  getProjectsByUnit(unit: string): Promise<Project[]>;
  getProjectExpenditureTypes(projectId: string): Promise<string[]>;
  getBudgetData(mis: string): Promise<ProjectBudget | null>;
  createBudgetHistoryEntry(entry: InsertBudgetHistory): Promise<void>;
  updateProjectBudgetSpending(projectId: number, amount: number, documentId: number, userId?: number): Promise<void>;
  reconcileBudgetOnDocumentEdit(
    documentId: number,
    oldProjectId: number | null,
    newProjectId: number | null,
    oldAmount: number,
    newAmount: number,
    userId?: number
  ): Promise<void>;
  getBudgetHistory(
    na853?: string, 
    page?: number, 
    limit?: number, 
    changeType?: string,
    userUnits?: number[],
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
  bulkImportEmployees(employees: InsertEmployee[]): Promise<{ success: number; failed: number; errors: string[] }>;
  cleanupDuplicateEmployees(): Promise<{ deleted: number; kept: number; errors: string[] }>;

  // Beneficiary management operations - SECURITY: Unit-based access only
  getBeneficiariesByUnit(unit: string): Promise<Beneficiary[]>;
  searchBeneficiariesByAFM(afm: string): Promise<Beneficiary[]>;
  getBeneficiaryById(id: number): Promise<Beneficiary | null>;
  createBeneficiary(beneficiary: InsertBeneficiary): Promise<Beneficiary>;
  updateBeneficiary(id: number, beneficiary: Partial<InsertBeneficiary>): Promise<Beneficiary>;
  deleteBeneficiary(id: number): Promise<void>;
  
  // Document search operations - SECURITY: Searches encrypted AFM via hash
  searchDocumentsByAFM(afm: string, userUnits: number[]): Promise<GeneratedDocument[]>;
  
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
  
  // Project Budget Versions operations (PDE and EPA)
  getBudgetVersionsByProject(projectId: number, formulationId?: number): Promise<ProjectBudgetVersion[]>;
  getBudgetVersionById(id: number): Promise<ProjectBudgetVersion | null>;
  createBudgetVersion(version: InsertProjectBudgetVersion): Promise<ProjectBudgetVersion>;
  updateBudgetVersion(id: number, version: Partial<InsertProjectBudgetVersion>): Promise<ProjectBudgetVersion>;
  deleteBudgetVersion(id: number): Promise<void>;
  
  // EPA Financials operations
  getEPAFinancials(epaVersionId: number): Promise<EpaFinancials[]>;
  createEPAFinancials(financial: InsertEpaFinancials): Promise<EpaFinancials>;
  updateEPAFinancials(id: number, financial: Partial<InsertEpaFinancials>): Promise<EpaFinancials>;
  deleteEPAFinancials(id: number): Promise<void>;
  
  // Region data operations
  updateBeneficiaryRegiondet(beneficiaryId: number, projectIndexId: number): Promise<void>;
  backfillBeneficiaryRegiondet(): Promise<{ processed: number; updated: number; errors: number }>;
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
      noDisposeOnSet: true, // Prevent disposal on session updates
      dispose: (key: string, session: any) => {
        console.log(`[SessionStore] Session naturally expired: ${key}`);
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

  async getBudgetData(mis: string): Promise<ProjectBudget | null> {
    try {
      console.log(`[Storage] Fetching budget data for MIS: ${mis}`);
      
      // Check if MIS is numeric or has a special format (like "2024ΝΑ85300001")
      const isNumericMis = /^\d+$/.test(mis);
      const isProjectCode = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/.test(mis); // Pattern for "2024ΝΑ85300001"
      
      // Case 1: If the MIS is a project code (NA853), try to find it in the project_budget table by na853
      if (isProjectCode) {
        console.log(`[Storage] MIS appears to be a project code: ${mis}, searching by na853`);
        const { data: naData, error: naError } = await supabase
          .from('project_budget')
          .select('*')
          .eq('na853', mis)
          .single();
          
        if (!naError && naData) {
          console.log(`[Storage] Found budget data by NA853 code: ${mis}`);
          return naData as ProjectBudget;
        }
      }
      
      // Case 2: Try to get budget data directly using MIS as string (default approach)
      const { data, error } = await supabase
        .from('project_budget')
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
            .from('project_budget')
            .select('*')
            .eq('mis', projectData.mis)
            .single();
            
          if (retryResult.error) {
            console.log(`[Storage] Budget still not found for MIS: ${projectData.mis}`);
            return null;
          }
          
          return retryResult.data as ProjectBudget;
        }
        
        console.log(`[Storage] Could not find project for MIS or NA853: ${mis}`);
        return null;
      }
      
      return data as ProjectBudget;
    } catch (error) {
      console.error('[Storage] Error fetching budget data:', error);
      return null;
    }
  }
  
  async createBudgetHistoryEntry(entry: InsertBudgetHistory): Promise<void> {
    try {
      console.log(`[Storage] Creating budget history entry for project: ${entry.project_id}`);
      
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

  async updateProjectBudgetSpending(projectId: number, amount: number, documentId: number, userId?: number): Promise<void> {
    try {
      console.log(`[Storage] Updating budget spending for project ${projectId}: ${amount} (document: ${documentId})`);
      
      // First, get the project details to find the associated budget record
      const { data: project, error: projectError } = await supabase
        .from('Projects')
        .select('mis, na853')
        .eq('id', projectId)
        .single();
        
      if (projectError || !project) {
        console.error('[Storage] Error fetching project details:', projectError);
        throw new Error(`Project ${projectId} not found`);
      }
      
      // Find the budget record using project_id (preferred) or fallback to MIS
      let budgetQuery = supabase
        .from('project_budget')
        .select('*')
        .eq('project_id', projectId);
      
      let { data: budgetData, error: budgetError } = await budgetQuery.single();
      
      // If no budget found by project_id, try by MIS as fallback
      if (budgetError && project.mis) {
        console.log(`[Storage] Budget not found by project_id, trying MIS: ${project.mis}`);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('project_budget')
          .select('*')
          .eq('mis', project.mis)
          .single();
          
        budgetData = fallbackData;
        budgetError = fallbackError;
      }
      
      if (budgetError || !budgetData) {
        console.error('[Storage] No budget record found for project:', projectId, budgetError);
        throw new Error(`No budget record found for project ${projectId}`);
      }
      
      console.log(`[Storage] Found budget record - current user_view: ${budgetData.user_view}`);
      
      // Calculate new spending amount for both year and current quarter
      const currentSpending = parseFloat(String(budgetData.user_view || 0));
      const newSpending = currentSpending + amount;
      
      const currentQuarterSpent = parseFloat(String(budgetData.current_quarter_spent || 0));
      const newQuarterSpent = currentQuarterSpent + amount;
      
      console.log(`[Storage] Budget calculation: user_view ${currentSpending} + ${amount} = ${newSpending}, current_quarter_spent ${currentQuarterSpent} + ${amount} = ${newQuarterSpent}`);
      
      // Update the budget record with new spending (both year total and current quarter)
      const { error: updateError } = await supabase
        .from('project_budget')
        .update({ 
          user_view: newSpending,
          current_quarter_spent: newQuarterSpent,
          updated_at: new Date().toISOString()
        })
        .eq('id', budgetData.id);
        
      if (updateError) {
        console.error('[Storage] Error updating budget spending:', updateError);
        throw updateError;
      }
      
      // Create budget history entry showing the decrease in available budget (katanomes_etous)
      // When spending increases, available budget decreases
      const katanomesEtous = parseFloat(String(budgetData.katanomes_etous || 0));
      const previousAvailableBudget = katanomesEtous - currentSpending;
      const newAvailableBudget = katanomesEtous - newSpending;
      
      // Determine if this is spending (positive amount) or a refund (negative amount)
      const isSpending = amount > 0;
      const absoluteAmount = Math.abs(amount);
      
      await this.createBudgetHistoryEntry({
        project_id: projectId,
        previous_amount: String(previousAvailableBudget),
        new_amount: String(newAvailableBudget),
        change_type: isSpending ? 'spending' : 'refund',
        change_reason: isSpending 
          ? `Δαπάνη εγγράφου: €${absoluteAmount.toFixed(2)}`
          : `Επιστροφή λόγω επεξεργασίας ή διαγραφής εγγράφου: €${absoluteAmount.toFixed(2)}`,
        document_id: documentId,
        created_by: userId
      });
      
      console.log(`[Storage] Successfully updated project budget spending: ${currentSpending} → ${newSpending}`);
      
    } catch (error) {
      console.error('[Storage] Error in updateProjectBudgetSpending:', error);
      throw error;
    }
  }

  async reconcileBudgetOnDocumentEdit(
    documentId: number,
    oldProjectId: number | null,
    newProjectId: number | null,
    oldAmount: number,
    newAmount: number,
    userId?: number
  ): Promise<void> {
    try {
      console.log(`[Storage] Reconciling budget for document ${documentId}:`, {
        oldProjectId,
        newProjectId,
        oldAmount,
        newAmount,
      });

      // Case 1: Project changed (with or without amount change)
      if (oldProjectId && newProjectId && oldProjectId !== newProjectId) {
        console.log(`[Storage] Project changed from ${oldProjectId} to ${newProjectId}`);
        
        try {
          // Remove old amount from old project
          await this.updateProjectBudgetSpending(oldProjectId, -oldAmount, documentId, userId);
          
          // Add new amount to new project (if this fails, restore the old project)
          try {
            await this.updateProjectBudgetSpending(newProjectId, newAmount, documentId, userId);
          } catch (newProjectError) {
            // Compensating transaction: restore the old project's budget
            console.error(`[Storage] Failed to add to new project ${newProjectId}, restoring old project ${oldProjectId}`);
            try {
              await this.updateProjectBudgetSpending(oldProjectId, oldAmount, documentId, userId);
            } catch (restoreError) {
              console.error(`[Storage] CRITICAL: Failed to restore old project budget:`, restoreError);
            }
            throw newProjectError;
          }
        } catch (error) {
          console.error(`[Storage] Error in project change reconciliation:`, error);
          throw error;
        }
        
      } 
      // Case 2: Only amount changed (same project)
      else if (oldProjectId && oldProjectId === newProjectId && oldAmount !== newAmount) {
        console.log(`[Storage] Amount changed from ${oldAmount} to ${newAmount} for project ${oldProjectId}`);
        
        const amountDifference = newAmount - oldAmount;
        await this.updateProjectBudgetSpending(oldProjectId, amountDifference, documentId, userId);
        
      }
      // Case 3: Project added (document didn't have a project before)
      else if (!oldProjectId && newProjectId) {
        console.log(`[Storage] Project added: ${newProjectId}`);
        
        await this.updateProjectBudgetSpending(newProjectId, newAmount, documentId, userId);
        
      }
      // Case 4: Project removed (document had a project, now doesn't)
      else if (oldProjectId && !newProjectId) {
        console.log(`[Storage] Project removed: ${oldProjectId}`);
        
        await this.updateProjectBudgetSpending(oldProjectId, -oldAmount, documentId, userId);
      }
      
      console.log(`[Storage] Successfully reconciled budget for document ${documentId}`);
      
    } catch (error) {
      console.error('[Storage] Error in reconcileBudgetOnDocumentEdit:', error);
      throw error;
    }
  }

  async getBudgetHistory(na853?: string, page: number = 1, limit: number = 10, changeType?: string, userUnits?: number[], dateFrom?: string, dateTo?: string, creator?: string, expenditureType?: string): Promise<{data: any[], pagination: {total: number, page: number, limit: number, pages: number}, statistics?: {totalEntries: number, totalAmountChange: number, changeTypes: Record<string, number>, periodRange: { start: string, end: string }}}> {
    try {
      console.log(`[Storage] Fetching budget history${na853 ? ` for NA853: ${na853}` : ' for all projects'}, page ${page}, limit ${limit}, changeType: ${changeType || 'all'}, userUnits: ${userUnits?.join(',') || 'all'}, expenditureType: ${expenditureType || 'all'}`);
      
      const offset = (page - 1) * limit;
      
      // Apply unit-based access control using unit_id array
      let allowedMisIds: number[] = [];
      if (userUnits && userUnits.length > 0) {
        console.log('[Storage] Applying unit-based access control for unit IDs:', userUnits);
        
        // Since userUnits is now unit_id array, we can use it directly
        // Get projects associated with these unit IDs
        const { data: projectIndexData, error: projectIndexError } = await supabase
          .from('project_index')
          .select('project_id, Projects!inner(mis)')
          .in('monada_id', userUnits);
        
        if (!projectIndexError && projectIndexData && projectIndexData.length > 0) {
          const projectMisIds = projectIndexData
            .map((p: any) => p.Projects?.mis)
            .filter(mis => mis != null)
            .map(mis => parseInt(String(mis)))
            .filter(id => !isNaN(id));
          allowedMisIds = Array.from(new Set(projectMisIds));
          console.log('[Storage] Found allowed MIS codes for unit IDs:', allowedMisIds.length, allowedMisIds);
        } else {
          console.log('[Storage] No projects found for unit IDs:', userUnits);
          allowedMisIds = [-1]; // Use impossible MIS to ensure empty results
        }
      }
      
      // Build the base query with the actual schema columns and join with projects table for MIS
      let query = supabase
        .from('budget_history')
        .select(`
          id,
          project_id,
          previous_amount,
          new_amount,
          change_type,
          change_reason,
          document_id,
          created_by,
          created_at,
          updated_at,
          Projects!budget_history_project_id_fkey (
            id,
            mis,
            na853,
            project_title
          ),
          generated_documents!budget_history_document_id_fkey (
            protocol_number_input,
            status
          )
        `, { count: 'exact' });
      
      // Apply unit-based access control - managers must only see their unit's data
      if (userUnits && userUnits.length > 0) {
        if (allowedMisIds.length > 0 && !allowedMisIds.includes(-1)) {
          console.log('[Storage] Applying MIS filter for allowed MIS codes:', allowedMisIds);
          // Need to filter by project_id instead of mis directly since we're joining with Projects table
          const { data: allowedProjects, error: projectError } = await supabase
            .from('Projects')
            .select('id')
            .in('mis', allowedMisIds);
          
          if (!projectError && allowedProjects && allowedProjects.length > 0) {
            const projectIds = allowedProjects.map(p => p.id);
            query = query.in('project_id', projectIds);
          } else {
            // No projects found - return empty result for security
            console.log('[Storage] No projects found for allowed MIS codes - returning empty result for security');
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
      if (na853 && na853 !== 'all') {
        // Need to get project_id for the NA853 filter
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('id')
          .eq('na853', na853)
          .single();
          
        if (!projectError && projectData) {
          query = query.eq('project_id', projectData.id);
        } else {
          // NA853 not found - return empty result
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
      
      // Apply expenditure type filter if specified
      // Uses correct relationship chain: budget_history -> generated_documents -> project_index -> expenditure_types
      // Preserves entries without documents (null document_id) for system operations
      if (expenditureType && expenditureType !== 'all' && expenditureType !== '') {
        // Step 1: Get project_index IDs that match the expenditure type
        const { data: projectIndexData, error: projectIndexError } = await supabase
          .from('project_index')
          .select('id')
          .eq('expenditure_type_id', parseInt(expenditureType));
          
        if (!projectIndexError && projectIndexData && projectIndexData.length > 0) {
          const projectIndexIds = projectIndexData.map(pi => pi.id);
          
          // Step 2: Get document IDs that reference those project_index IDs
          const { data: documentsData, error: documentsError } = await supabase
            .from('generated_documents')
            .select('id')
            .in('project_index_id', projectIndexIds);
          
          if (!documentsError && documentsData && documentsData.length > 0) {
            const documentIds = documentsData.map(d => d.id);
            // Step 3: Filter to include rows with matching document IDs OR null document_id (system operations)
            query = query.or(`document_id.in.(${documentIds.join(',')}),document_id.is.null`);
          } else {
            // No documents found - only show system operations (null document_id)
            query = query.is('document_id', null);
          }
        } else {
          // No project_index entries match - only show system operations (null document_id)
          query = query.is('document_id', null);
        }
      }
      
      // Get filtered data for statistics calculation (without pagination)
      let statsQuery = supabase
        .from('budget_history')
        .select('id, previous_amount, new_amount, change_type, created_at, project_id');
        
      // Apply the same filters to stats query
      if (userUnits && userUnits.length > 0) {
        if (allowedMisIds.length > 0 && !allowedMisIds.includes(-1)) {
          // Get project IDs for allowed MIS codes
          const { data: allowedProjects, error: projectError } = await supabase
            .from('Projects')
            .select('id')
            .in('mis', allowedMisIds);
          
          if (!projectError && allowedProjects && allowedProjects.length > 0) {
            const projectIds = allowedProjects.map(p => p.id);
            statsQuery = statsQuery.in('project_id', projectIds);
          } else {
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
        } else {
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
      }
      
      if (na853 && na853 !== 'all') {
        // Get project_id for the NA853 filter
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('id')
          .eq('na853', na853)
          .single();
          
        if (!projectError && projectData) {
          statsQuery = statsQuery.eq('project_id', projectData.id);
        } else {
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
      
      // Apply expenditure type filter to stats query
      if (expenditureType && expenditureType !== 'all' && expenditureType !== '') {
        const { data: projectIndexData, error: projectIndexError } = await supabase
          .from('project_index')
          .select('id')
          .eq('expenditure_type_id', parseInt(expenditureType));
          
        if (!projectIndexError && projectIndexData && projectIndexData.length > 0) {
          const projectIndexIds = projectIndexData.map(pi => pi.id);
          
          const { data: documentsData, error: documentsError } = await supabase
            .from('generated_documents')
            .select('id')
            .in('project_index_id', projectIndexIds);
          
          if (!documentsError && documentsData && documentsData.length > 0) {
            const documentIds = documentsData.map(d => d.id);
            // Filter to include rows with matching document IDs OR null document_id
            statsQuery = statsQuery.or(`document_id.in.(${documentIds.join(',')}),document_id.is.null`);
          } else {
            statsQuery = statsQuery.is('document_id', null);
          }
        } else {
          statsQuery = statsQuery.is('document_id', null);
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
      if (userUnits && userUnits.length > 0) {
        if (allowedMisIds.length > 0 && !allowedMisIds.includes(-1)) {
          // Get project IDs for allowed MIS codes
          const { data: allowedProjects, error: projectError } = await supabase
            .from('Projects')
            .select('id')
            .in('mis', allowedMisIds);
          
          if (!projectError && allowedProjects && allowedProjects.length > 0) {
            const projectIds = allowedProjects.map(p => p.id);
            countQuery = countQuery.in('project_id', projectIds);
          }
        }
      }
      
      if (na853 && na853 !== 'all') {
        // Get project_id for the NA853 filter
        const { data: projectData, error: projectError } = await supabase
          .from('Projects')
          .select('id')
          .eq('na853', na853)
          .single();
          
        if (!projectError && projectData) {
          countQuery = countQuery.eq('project_id', projectData.id);
        }
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
      
      // Apply expenditure type filter to count query
      if (expenditureType && expenditureType !== 'all' && expenditureType !== '') {
        const { data: projectIndexData, error: projectIndexError } = await supabase
          .from('project_index')
          .select('id')
          .eq('expenditure_type_id', parseInt(expenditureType));
          
        if (!projectIndexError && projectIndexData && projectIndexData.length > 0) {
          const projectIndexIds = projectIndexData.map(pi => pi.id);
          
          const { data: documentsData, error: documentsError } = await supabase
            .from('generated_documents')
            .select('id')
            .in('project_index_id', projectIndexIds);
          
          if (!documentsError && documentsData && documentsData.length > 0) {
            const documentIds = documentsData.map(d => d.id);
            // Filter to include rows with matching document IDs OR null document_id
            countQuery = countQuery.or(`document_id.in.(${documentIds.join(',')}),document_id.is.null`);
          } else {
            countQuery = countQuery.is('document_id', null);
          }
        } else {
          countQuery = countQuery.is('document_id', null);
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
        // Supabase returns a single object for foreign key joins, not an array
        const documentData: any = Array.isArray(entry.generated_documents) 
          ? entry.generated_documents[0] 
          : entry.generated_documents || null;
        const documentStatus = documentData?.status || null;
        const protocolNumberInput = documentData?.protocol_number_input || null;
        
        console.log(`[Storage] Document data for entry ${entry.id}:`, documentData);
        
        // Extract project data from the joined Projects table
        const projectData = entry.Projects || {};
        const projectMis = Array.isArray(projectData) 
          ? (projectData[0] as any)?.mis || 'Unknown' 
          : (projectData as any).mis || 'Unknown';
        const projectNa853 = Array.isArray(projectData) 
          ? (projectData[0] as any)?.na853 || null 
          : (projectData as any).na853 || null;
        const projectId = Array.isArray(projectData) 
          ? (projectData[0] as any)?.id || null 
          : (projectData as any).id || null;
        
        // The columns already match what the frontend expects, so we can use them directly
        return {
          id: entry.id,
          project_id: projectId,
          mis: projectMis,
          na853: projectNa853,
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
      
      const decryptedEmployees = (data || []).map(e => ({
        ...e,
        afm: decryptAFM(e.afm)
      }));
      
      console.log(`[Storage] Successfully fetched ${decryptedEmployees.length} employees`);
      return decryptedEmployees;
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
      
      const decryptedEmployees = (data || []).map(e => ({
        ...e,
        afm: decryptAFM(e.afm)
      }));
      
      console.log(`[Storage] Successfully fetched ${decryptedEmployees.length} employees for unit: ${unit}`);
      return decryptedEmployees;
    } catch (error) {
      console.error('[Storage] Error in getEmployeesByUnit:', error);
      throw error;
    }
  }

  async searchEmployeesByAFM(afm: string): Promise<Employee[]> {
    try {
      console.log(`[Storage] Searching employees by AFM: ${afm}`);
      
      if (!/^\d+$/.test(afm)) {
        console.log(`[Storage] Invalid AFM format (contains non-digits): ${afm}`);
        return [];
      }
      
      const minDigits = 9;
      const currentDigits = afm.length;
      
      if (currentDigits >= minDigits) {
        console.log(`[Storage] Exact AFM search using hash for: ${afm}`);
        
        const afmHash = hashAFM(afm);
        
        // Optimized: select only essential columns for faster query
        const { data, error } = await supabase
          .from('Employees')
          .select('id, afm, afm_hash, surname, name, fathername, klados, attribute, workaf, monada')
          .eq('afm_hash', afmHash)
          .order('surname', { ascending: true })
          .limit(20);
          
        if (error) {
          console.error('[Storage] Error searching employees by AFM hash:', error);
          throw error;
        }
        
        const decryptedEmployees = (data || []).map(e => ({
          ...e,
          afm: decryptAFM(e.afm)
        }));
        
        console.log(`[Storage] Found ${decryptedEmployees.length} employees with exact AFM: ${afm}`);
        return decryptedEmployees;
      } else {
        console.log(`[Storage] Prefix search for AFM: ${afm} - fetching records to decrypt and filter`);
        
        // Optimized: select only essential columns and reduced batch size
        const { data, error } = await supabase
          .from('Employees')
          .select('id, afm, afm_hash, surname, name, fathername, klados, attribute, workaf, monada')
          .order('surname', { ascending: true })
          .limit(200);
          
        if (error) {
          console.error('[Storage] Error fetching employees for prefix search:', error);
          throw error;
        }
        
        // Optimized: early exit after finding 20 matches to avoid unnecessary decryption
        const results: any[] = [];
        for (const e of (data || [])) {
          if (results.length >= 20) break;
          
          const decryptedAFM = decryptAFM(e.afm);
          if (decryptedAFM && decryptedAFM.startsWith(afm)) {
            results.push({
              ...e,
              afm: decryptedAFM
            });
          }
        }
        
        console.log(`[Storage] Found ${results.length} employees matching AFM prefix: ${afm}`);
        return results;
      }
    } catch (error) {
      console.error('[Storage] Error in searchEmployeesByAFM:', error);
      throw error;
    }
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    try {
      console.log('[Storage] Creating new employee:', employee);
      
      const afmString = employee.afm ? String(employee.afm) : '';
      const employeeToInsert = {
        ...employee,
        afm: afmString ? encryptAFM(afmString) : '',
        afm_hash: afmString ? hashAFM(afmString) : ''
      };
      
      const { data, error } = await supabase
        .from('Employees')
        .insert(employeeToInsert)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating employee:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created employee:', data);
      
      return {
        ...data,
        afm: decryptAFM(data.afm)
      };
    } catch (error) {
      console.error('[Storage] Error in createEmployee:', error);
      throw error;
    }
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    try {
      console.log(`[Storage] Updating employee ${id}:`, employee);
      
      const afmString = employee.afm ? String(employee.afm) : '';
      const employeeToUpdate = {
        ...employee,
        afm: afmString ? encryptAFM(afmString) : undefined,
        afm_hash: afmString ? hashAFM(afmString) : undefined
      };
      
      const { data, error } = await supabase
        .from('Employees')
        .update(employeeToUpdate)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating employee:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated employee:', data);
      
      return {
        ...data,
        afm: decryptAFM(data.afm)
      };
    } catch (error) {
      console.error('[Storage] Error in updateEmployee:', error);
      throw error;
    }
  }

  async bulkImportEmployees(employees: InsertEmployee[]): Promise<{ success: number; failed: number; errors: string[] }> {
    try {
      console.log(`[Storage] Bulk importing ${employees.length} employees`);
      
      // Deduplicate by AFM - keep only the last occurrence of each AFM
      const afmMap = new Map<string, InsertEmployee>();
      for (const emp of employees) {
        const afmString = emp.afm ? String(emp.afm) : '';
        if (afmString) {
          afmMap.set(afmString, emp);
        } else if (!afmMap.has('')) {
          afmMap.set('', emp);
        }
      }
      
      const deduplicatedEmployees = Array.from(afmMap.values());
      console.log(`[Storage] Deduplicated from ${employees.length} to ${deduplicatedEmployees.length} employees`);
      
      // Get the max ID from existing employees to generate sequential IDs
      const { data: maxIdData, error: maxIdError } = await supabase
        .from('Employees')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      let nextId = 1;
      if (!maxIdError && maxIdData && maxIdData.length > 0) {
        nextId = (maxIdData[0].id as number) + 1;
      }
      
      console.log(`[Storage] Starting bulk import from ID: ${nextId}`);
      
      const employeesToInsert = deduplicatedEmployees.map((emp, idx) => {
        const afmString = emp.afm ? String(emp.afm) : '';
        const encryptedAfm = afmString ? encryptAFM(afmString) : '';
        return {
          ...emp,
          id: nextId + idx,
          afm: encryptedAfm,
          afm_hash: afmString ? hashAFM(afmString) : ''
        };
      });
      
      // Use upsert to update existing employees (by AFM hash) or insert new ones
      // Use afm_hash instead of afm because AFM encryption is randomized each time
      const { data, error } = await supabase
        .from('Employees')
        .upsert(employeesToInsert, { onConflict: 'afm_hash' })
        .select();
        
      if (error) {
        console.error('[Storage] Error in bulk import:', error);
        return { success: 0, failed: deduplicatedEmployees.length, errors: [error.message] };
      }
      
      console.log(`[Storage] Successfully imported/updated ${data?.length || 0} employees`);
      return { success: data?.length || 0, failed: 0, errors: [] };
    } catch (error) {
      console.error('[Storage] Error in bulkImportEmployees:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: 0, failed: employees.length, errors: [errorMsg] };
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

  async cleanupDuplicateEmployees(): Promise<{ deleted: number; kept: number; errors: string[] }> {
    try {
      console.log('[Storage] Starting duplicate employee cleanup...');
      
      // Get all employees grouped by afm_hash to find duplicates
      const { data: allEmployees, error: fetchError } = await supabase
        .from('Employees')
        .select('id, afm_hash');
        
      if (fetchError || !allEmployees) {
        console.error('[Storage] Error fetching employees for cleanup:', fetchError);
        return { deleted: 0, kept: 0, errors: [fetchError?.message || 'Failed to fetch employees'] };
      }
      
      // Group by afm_hash to find duplicates
      const groupsByHash = new Map<string, number[]>();
      for (const emp of allEmployees) {
        const hash = emp.afm_hash || '';
        if (!groupsByHash.has(hash)) {
          groupsByHash.set(hash, []);
        }
        groupsByHash.get(hash)!.push(emp.id);
      }
      
      // Find duplicates and collect IDs to delete (keep lowest ID for each hash)
      const idsToDelete: number[] = [];
      for (const [hash, ids] of Array.from(groupsByHash.entries())) {
        if (ids.length > 1 && hash !== '') {
          // Sort IDs, keep the lowest (original), delete the rest
          ids.sort((a: number, b: number) => a - b);
          const kept = ids[0];
          const toDelete = ids.slice(1);
          console.log(`[Storage] Duplicate hash ${hash}: keeping ID ${kept}, deleting ${toDelete.length} copies`);
          idsToDelete.push(...toDelete);
        }
      }
      
      console.log(`[Storage] Total duplicates to delete: ${idsToDelete.length}`);
      
      if (idsToDelete.length === 0) {
        console.log('[Storage] No duplicates found');
        return { deleted: 0, kept: allEmployees.length, errors: [] };
      }
      
      // Delete duplicates in batches
      let deletedCount = 0;
      const batchSize = 100;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('Employees')
          .delete()
          .in('id', batch);
          
        if (deleteError) {
          console.error('[Storage] Error deleting batch:', deleteError);
          return { deleted: deletedCount, kept: allEmployees.length - idsToDelete.length, errors: [deleteError.message] };
        }
        deletedCount += batch.length;
        console.log(`[Storage] Deleted batch of ${batch.length}, total: ${deletedCount}`);
      }
      
      console.log(`[Storage] Successfully cleaned up duplicates. Deleted: ${deletedCount}`);
      return { deleted: deletedCount, kept: allEmployees.length - idsToDelete.length, errors: [] };
    } catch (error) {
      console.error('[Storage] Error in cleanupDuplicateEmployees:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { deleted: 0, kept: 0, errors: [errorMsg] };
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
        
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('*')
          .range(fromIndex, fromIndex + batchSize - 1);
          
        if (error) {
          console.error('[Storage] Error fetching beneficiaries batch:', error);
          throw error;
        }
        
        const batchData = (data || []).map(b => ({
          ...b,
          afm: decryptAFM(b.afm)
        }));
        
        allBeneficiaries.push(...batchData);
        
        console.log(`[Storage] Fetched ${batchData.length} beneficiaries in this batch. Total so far: ${allBeneficiaries.length}`);
        
        hasMore = batchData.length === batchSize;
        fromIndex += batchSize;
        
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

  async getBeneficiariesByUnitOptimized(unit: string): Promise<any[]> {
    try {
      console.log(`[Storage] Fetching beneficiaries for unit: ${unit} (OPTIMIZED - no AFM decryption, with unit filtering)`);
      
      // SECURITY: First, get the unit_id from the monada table
      const { data: monadaData, error: monadaError } = await supabase
        .from('Monada')
        .select('id')
        .eq('unit', unit)
        .single();
        
      if (monadaError || !monadaData) {
        console.error(`[Storage] Could not find unit ID for unit code: ${unit}`, monadaError);
        return [];
      }
      
      const unitId = monadaData.id;
      console.log(`[Storage] Mapped unit "${unit}" to unit_id: ${unitId}`);
      
      // SECURITY: Get unique beneficiary IDs that have payments for this unit
      const { data: paymentsBeneficiaryIds, error: paymentsError } = await supabase
        .from('beneficiary_payments')
        .select('beneficiary_id')
        .eq('unit_id', unitId);
        
      if (paymentsError) {
        console.error('[Storage] Error fetching beneficiary IDs from payments:', paymentsError);
        throw paymentsError;
      }
      
      // Extract unique beneficiary IDs
      const uniqueBeneficiaryIds = Array.from(new Set(paymentsBeneficiaryIds?.map(p => p.beneficiary_id) || []));
      console.log(`[Storage] Found ${uniqueBeneficiaryIds.length} unique beneficiaries for unit ${unit}`);
      
      if (uniqueBeneficiaryIds.length === 0) {
        return [];
      }
      
      // Fetch beneficiaries in batches using .in() for the filtered IDs
      let allBeneficiaries: any[] = [];
      const batchSize = 1000;
      
      for (let i = 0; i < uniqueBeneficiaryIds.length; i += batchSize) {
        const idBatch = uniqueBeneficiaryIds.slice(i, i + batchSize);
        console.log(`[Storage] Fetching batch ${Math.floor(i / batchSize) + 1} of beneficiaries (${idBatch.length} IDs)`);
        
        // Select only needed fields, exclude encrypted AFM field
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('id, surname, name, fathername, region, ceng1, ceng2, regiondet, freetext, date, created_at, updated_at, afm_hash')
          .in('id', idBatch);
          
        if (error) {
          console.error('[Storage] Error fetching beneficiaries batch:', error);
          throw error;
        }
        
        // Return data without decrypting AFM - masked for security and performance
        const batchData = (data || []).map(b => ({
          ...b,
          afm: '***MASKED***', // Masked AFM for list view
          monada: unit // Add unit for compatibility
        }));
        
        allBeneficiaries.push(...batchData);
      }
      
      console.log(`[Storage] FINAL: Successfully fetched ${allBeneficiaries.length} beneficiaries (optimized, unit-filtered) for unit: ${unit}`);
      return allBeneficiaries;
    } catch (error) {
      console.error('[Storage] Error in getBeneficiariesByUnitOptimized:', error);
      throw error;
    }
  }

  async searchBeneficiariesByAFM(afm: string): Promise<Beneficiary[]> {
    try {
      console.log(`[Storage] Searching beneficiaries by AFM: ${afm}`);
      
      if (!/^\d+$/.test(afm)) {
        console.log(`[Storage] Invalid AFM format (contains non-digits): ${afm}`);
        return [];
      }
      
      const minDigits = 9;
      const currentDigits = afm.length;
      
      if (currentDigits >= minDigits) {
        console.log(`[Storage] Exact AFM search using hash for: ${afm}`);
        
        const afmHash = hashAFM(afm);
        
        // Optimized: select only essential columns for faster query
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('*')
          .eq('afm_hash', afmHash)
          .order('id', { ascending: false})
          .limit(100);
          
        if (error) {
          console.error('[Storage] Error searching beneficiaries by AFM hash:', error);
          throw error;
        }
        
        const decryptedBeneficiaries = (data || []).map(b => ({
          ...b,
          afm: decryptAFM(b.afm)
        }));
        
        console.log(`[Storage] Found ${decryptedBeneficiaries.length} beneficiaries with exact AFM: ${afm}`);
        return decryptedBeneficiaries;
      } else {
        console.log(`[Storage] Prefix search for AFM: ${afm} - fetching records to decrypt and filter`);
        
        // Optimized: select only essential columns and reduced batch size
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('*')
          .order('id', { ascending: false })
          .limit(300);
          
        if (error) {
          console.error('[Storage] Error fetching beneficiaries for prefix search:', error);
          throw error;
        }
        
        // Optimized: early exit after finding 100 matches to avoid unnecessary decryption
        const results: any[] = [];
        for (const b of (data || [])) {
          if (results.length >= 100) break;
          
          const decryptedAFM = decryptAFM(b.afm);
          if (decryptedAFM && decryptedAFM.startsWith(afm)) {
            results.push({
              ...b,
              afm: decryptedAFM
            });
          }
        }
        
        console.log(`[Storage] Found ${results.length} beneficiaries matching AFM prefix: ${afm}`);
        return results;
      }
    } catch (error) {
      console.error('[Storage] Error in searchBeneficiariesByAFM:', error);
      throw error;
    }
  }

  async searchDocumentsByAFM(afm: string, userUnits: number[]): Promise<GeneratedDocument[]> {
    try {
      console.log(`[Storage] Searching documents by AFM: ${afm} for units:`, userUnits);
      
      if (!/^\d{9}$/.test(afm)) {
        console.log(`[Storage] Invalid AFM format - must be exactly 9 digits: ${afm}`);
        return [];
      }
      
      // SECURITY: Verify user has at least one authorized unit
      if (!userUnits || userUnits.length === 0) {
        console.log(`[Storage] SECURITY: No authorized units provided`);
        return [];
      }
      
      const afmHash = hashAFM(afm);
      // Use Set that accepts both number and string to safely handle Supabase BigInt IDs
      const documentIds = new Set<number | string>();
      
      // PART 1: Search beneficiary payments with SECURITY unit filtering
      console.log(`[Storage] Searching beneficiary payments with AFM hash for units:`, userUnits);
      const { data: beneficiaryPayments, error: benError} = await supabase
        .from('beneficiary_payments')
        .select(`
          document_id,
          beneficiaries!inner (
            afm_hash
          ),
          generated_documents!inner (
            unit_id
          )
        `)
        .eq('beneficiaries.afm_hash', afmHash)
        .in('generated_documents.unit_id', userUnits);
      
      if (benError) {
        console.error('[Storage] Error searching beneficiary payments:', benError);
      } else {
        (beneficiaryPayments || []).forEach(payment => {
          if (payment.document_id != null) {
            const docId = payment.document_id;
            // Keep ID as-is (whatever type Supabase returns) - validate it's not NaN/invalid
            // For numbers: check it's a valid positive integer
            // For strings: check it's a numeric string  
            const isValidNumber = typeof docId === 'number' && Number.isFinite(docId) && docId > 0 && Number.isInteger(docId);
            const isValidString = typeof docId === 'string' && /^\d+$/.test(docId) && docId.length > 0;
            
            if (isValidNumber || isValidString) {
              documentIds.add(docId);
            } else {
              console.warn(`[Storage] Skipping invalid document_id from beneficiary payment:`, docId, typeof docId);
            }
          }
        });
        console.log(`[Storage] Found ${documentIds.size} documents from beneficiary payments (unit-filtered)`);
      }
      
      // PART 2: Search employee payments with SECURITY unit filtering
      console.log(`[Storage] Searching employee payments with AFM hash for units:`, userUnits);
      const { data: employeePayments, error: empError } = await supabase
        .from('EmployeePayments')
        .select(`
          id,
          Employees!inner (
            afm_hash
          )
        `)
        .eq('Employees.afm_hash', afmHash);
      
      if (empError) {
        console.error('[Storage] Error searching employee payments:', empError);
      } else if (employeePayments && employeePayments.length > 0) {
        // Get employee payment IDs
        const employeePaymentIds = employeePayments.map(ep => ep.id);
        console.log(`[Storage] Found ${employeePaymentIds.length} employee payment IDs`);
        
        // SECURITY: Find documents that contain these employee payment IDs AND belong to user's units
        const { data: empDocuments, error: empDocError } = await supabase
          .from('generated_documents')
          .select('id, employee_payments_id, unit_id')
          .not('employee_payments_id', 'is', null)
          .in('unit_id', userUnits);
        
        if (empDocError) {
          console.error('[Storage] Error searching documents with employee payments:', empDocError);
        } else {
          (empDocuments || []).forEach(doc => {
            const empPaymentIds = doc.employee_payments_id || [];
            if (Array.isArray(empPaymentIds) && empPaymentIds.some((id: number) => employeePaymentIds.includes(id))) {
              if (doc.id != null) {
                const docId = doc.id;
                // Keep ID as-is (whatever type Supabase returns) - validate it's not NaN/invalid
                // For numbers: check it's a valid positive integer
                // For strings: check it's a numeric string
                const isValidNumber = typeof docId === 'number' && Number.isFinite(docId) && docId > 0 && Number.isInteger(docId);
                const isValidString = typeof docId === 'string' && /^\d+$/.test(docId) && docId.length > 0;
                
                if (isValidNumber || isValidString) {
                  documentIds.add(docId);
                } else {
                  console.warn(`[Storage] Skipping invalid document id from employee search:`, docId, typeof docId);
                }
              }
            }
          });
          console.log(`[Storage] Total documents found after employee search (unit-filtered): ${documentIds.size}`);
        }
      }
      
      // PART 3: Fetch final documents (already filtered by unit)
      if (documentIds.size === 0) {
        console.log(`[Storage] No documents found matching AFM: ${afm} for authorized units`);
        return [];
      }
      
      // DEFENSIVE: Filter out any invalid IDs before querying (belt and suspenders approach)
      // The Set should already contain only valid IDs, but this ensures database safety
      // Keep IDs as-is (don't convert) to preserve BigInt precision
      const validDocumentIds = Array.from(documentIds).filter(id => {
        if (typeof id === 'number') {
          return Number.isFinite(id) && Number.isInteger(id) && id > 0;
        } else if (typeof id === 'string') {
          return /^\d+$/.test(id) && id.length > 0;
        }
        return false;
      });
      
      if (validDocumentIds.length === 0) {
        console.warn(`[Storage] All document IDs were invalid after filtering`);
        return [];
      }
      
      if (validDocumentIds.length !== documentIds.size) {
        console.warn(`[Storage] Filtered out ${documentIds.size - validDocumentIds.length} invalid document IDs`);
      }
      
      console.log(`[Storage] Fetching ${validDocumentIds.length} documents (all pre-filtered by user units)...`);
      const { data: documents, error: docError } = await supabase
        .from('generated_documents')
        .select('*')
        .in('id', validDocumentIds)
        .order('created_at', { ascending: false });
      
      if (docError) {
        console.error('[Storage] Error fetching documents:', docError);
        throw docError;
      }
      
      console.log(`[Storage] SECURITY: Returning ${documents?.length || 0} documents (all verified to belong to user units)`);
      return documents || [];
    } catch (error) {
      console.error('[Storage] Error in searchDocumentsByAFM:', error);
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
      
      return {
        ...data,
        afm: decryptAFM(data.afm)
      };
    } catch (error) {
      console.error('[Storage] Error in getBeneficiaryById:', error);
      throw error;
    }
  }

  async createBeneficiary(beneficiary: InsertBeneficiary): Promise<Beneficiary> {
    try {
      console.log('[Storage] Creating new beneficiary:', beneficiary);
      
      const beneficiaryToInsert = {
        ...beneficiary,
        afm: encryptAFM(beneficiary.afm),
        afm_hash: hashAFM(beneficiary.afm),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('beneficiaries')
        .insert(beneficiaryToInsert)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating beneficiary:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created beneficiary with ID:', data.id);
      
      return {
        ...data,
        afm: decryptAFM(data.afm)
      };
    } catch (error) {
      console.error('[Storage] Error in createBeneficiary:', error);
      throw error;
    }
  }

  async updateBeneficiary(id: number, beneficiary: Partial<InsertBeneficiary>): Promise<Beneficiary> {
    try {
      console.log(`[Storage] Updating beneficiary ${id}:`, beneficiary);
      
      const beneficiaryToUpdate = {
        ...beneficiary,
        afm: beneficiary.afm ? encryptAFM(beneficiary.afm) : undefined,
        afm_hash: beneficiary.afm ? hashAFM(beneficiary.afm) : undefined,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('beneficiaries')
        .update(beneficiaryToUpdate)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating beneficiary:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated beneficiary:', data);
      
      return {
        ...data,
        afm: decryptAFM(data.afm)
      };
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
      
      const encryptedAfm = encryptAFM(afm);
      
      const { data: beneficiary, error: fetchError } = await supabase
        .from('beneficiaries')
        .select('id')
        .eq('afm', encryptedAfm)
        .single();
        
      if (fetchError || !beneficiary) {
        console.error('[Storage] Error fetching beneficiary for status update:', fetchError);
        throw new Error(`Beneficiary with AFM ${afm} not found`);
      }
      
      console.log(`[Storage] Updating payment record for beneficiary ${beneficiary.id}`);
      
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

      const decryptedStaff = (data || []).map(e => ({
        ...e,
        afm: decryptAFM(e.afm)
      }));

      console.log(`[Storage] Successfully fetched ${decryptedStaff.length} staff members for unit: ${unit}`);
      return decryptedStaff;
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
        .select(`
          *,
          project_index!inner(
            expenditure_type_id,
            expenditure_types!inner(
              expenditure_types
            )
          )
        `)
        .eq('beneficiary_id', beneficiaryId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[Storage] Error fetching beneficiary payments:', error);
        throw error;
      }
      
      // Transform the data to include expenditure_type at the root level
      const transformedData = data?.map(payment => ({
        ...payment,
        expenditure_type: payment.project_index?.expenditure_types?.expenditure_types || 'UNKNOWN'
      })) || [];
      
      console.log(`[Storage] Found ${transformedData.length} payments for beneficiary ${beneficiaryId}`);
      if (transformedData.length > 0) {
        console.log(`[Storage] Sample expenditure types:`, transformedData.slice(0, 3).map(p => p.expenditure_type));
      }
      
      return transformedData;
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
      
      // Update beneficiary's regiondet with accumulated unique regions
      if (payment.beneficiary_id && payment.project_index_id) {
        await this.updateBeneficiaryRegiondet(payment.beneficiary_id, payment.project_index_id);
      }
      
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
      
      // Update beneficiary's regiondet if project_index_id was changed
      if (data.beneficiary_id && payment.project_index_id) {
        await this.updateBeneficiaryRegiondet(data.beneficiary_id, payment.project_index_id);
      }
      
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

  /**
   * Updates beneficiary's regiondet field with accumulated unique regions from project_index
   * Fetches region data from project_index junction tables and merges with existing regiondet
   */
  async updateBeneficiaryRegiondet(beneficiaryId: number, projectIndexId: number): Promise<void> {
    try {
      console.log(`[Storage] Updating regiondet for beneficiary ${beneficiaryId} with project_index ${projectIndexId}`);
      
      // Fetch region data from project_index junction tables with names
      const { data: regionData, error: regionError } = await supabase
        .from('project_index_regions')
        .select(`
          region_code,
          regions!inner(code, name)
        `)
        .eq('project_index_id', projectIndexId);
      
      const { data: unitData, error: unitError } = await supabase
        .from('project_index_units')
        .select(`
          unit_code,
          regional_units!inner(code, name, region_code)
        `)
        .eq('project_index_id', projectIndexId);
      
      const { data: muniData, error: muniError } = await supabase
        .from('project_index_munis')
        .select(`
          muni_code,
          municipalities!inner(code, name, unit_code)
        `)
        .eq('project_index_id', projectIndexId);
      
      if (regionError || unitError || muniError) {
        console.error('[Storage] Error fetching geographic data:', { regionError, unitError, muniError });
        return; // Don't fail the payment creation, just log and continue
      }
      
      // Build region entry object from the fetched data
      const newRegionEntry: Record<string, unknown> = {
        project_index_id: projectIndexId,
        timestamp: new Date().toISOString()
      };
      
      // Add regions if available
      if (regionData && regionData.length > 0) {
        newRegionEntry.regions = regionData.map((r: any) => ({
          code: r.region_code,
          name: r.regions?.name || 'Unknown'
        }));
      }
      
      // Add regional units if available
      if (unitData && unitData.length > 0) {
        newRegionEntry.regional_units = unitData.map((u: any) => ({
          code: u.unit_code,
          name: u.regional_units?.name || 'Unknown',
          region_code: u.regional_units?.region_code
        }));
      }
      
      // Add municipalities if available
      if (muniData && muniData.length > 0) {
        newRegionEntry.municipalities = muniData.map((m: any) => ({
          code: m.muni_code,
          name: m.municipalities?.name || 'Unknown',
          unit_code: m.municipalities?.unit_code
        }));
      }
      
      // Skip if no geographic data found
      if (!newRegionEntry.regions && !newRegionEntry.regional_units && !newRegionEntry.municipalities) {
        console.log(`[Storage] No geographic data found for project_index ${projectIndexId}, skipping regiondet update`);
        return;
      }
      
      // Get current beneficiary regiondet
      const { data: beneficiary, error: fetchError } = await supabase
        .from('beneficiaries')
        .select('regiondet')
        .eq('id', beneficiaryId)
        .single();
      
      if (fetchError) {
        console.error('[Storage] Error fetching beneficiary for regiondet update:', fetchError);
        return;
      }
      
      // Parse existing regiondet or initialize as empty array
      let existingRegiondet: Record<string, unknown>[] = [];
      if (beneficiary?.regiondet) {
        if (Array.isArray(beneficiary.regiondet)) {
          existingRegiondet = beneficiary.regiondet as Record<string, unknown>[];
        } else {
          // If it was a single object, convert to array
          existingRegiondet = [beneficiary.regiondet as Record<string, unknown>];
        }
      }
      
      // Check if this project_index_id already exists in regiondet
      const existingIndex = existingRegiondet.findIndex(
        (entry) => entry.project_index_id === projectIndexId
      );
      
      if (existingIndex >= 0) {
        // Update existing entry
        existingRegiondet[existingIndex] = newRegionEntry;
        console.log(`[Storage] Updated existing region entry for project_index ${projectIndexId}`);
      } else {
        // Add new entry
        existingRegiondet.push(newRegionEntry);
        console.log(`[Storage] Added new region entry for project_index ${projectIndexId}`);
      }
      
      // Update beneficiary with new regiondet
      const { error: updateError } = await supabase
        .from('beneficiaries')
        .update({ 
          regiondet: existingRegiondet,
          updated_at: new Date().toISOString()
        })
        .eq('id', beneficiaryId);
      
      if (updateError) {
        console.error('[Storage] Error updating beneficiary regiondet:', updateError);
        return;
      }
      
      console.log(`[Storage] Successfully updated regiondet for beneficiary ${beneficiaryId} with ${existingRegiondet.length} region entries`);
    } catch (error) {
      console.error('[Storage] Error in updateBeneficiaryRegiondet:', error);
      // Don't throw - this is a non-critical update
    }
  }

  /**
   * Backfill regiondet for all beneficiaries based on their existing payment data
   * This is a one-time migration helper
   */
  async backfillBeneficiaryRegiondet(): Promise<{ processed: number; updated: number; errors: number }> {
    try {
      console.log('[Storage] Starting regiondet backfill for all beneficiaries...');
      
      // Get all beneficiary payments with project_index_id
      const { data: payments, error: paymentsError } = await supabase
        .from('beneficiary_payments')
        .select('beneficiary_id, project_index_id')
        .not('project_index_id', 'is', null);
      
      if (paymentsError) {
        console.error('[Storage] Error fetching payments for backfill:', paymentsError);
        throw paymentsError;
      }
      
      if (!payments || payments.length === 0) {
        console.log('[Storage] No payments with project_index_id found');
        return { processed: 0, updated: 0, errors: 0 };
      }
      
      // Group by beneficiary_id to process each beneficiary once per project_index
      const beneficiaryPayments = new Map<number, Set<number>>();
      for (const payment of payments) {
        if (payment.beneficiary_id && payment.project_index_id) {
          if (!beneficiaryPayments.has(payment.beneficiary_id)) {
            beneficiaryPayments.set(payment.beneficiary_id, new Set());
          }
          beneficiaryPayments.get(payment.beneficiary_id)!.add(payment.project_index_id);
        }
      }
      
      let processed = 0;
      let updated = 0;
      let errors = 0;
      
      const beneficiaryEntries = Array.from(beneficiaryPayments.entries());
      for (const [beneficiaryId, projectIndexIds] of beneficiaryEntries) {
        const projectIndexArray = Array.from(projectIndexIds);
        for (const projectIndexId of projectIndexArray) {
          processed++;
          try {
            await this.updateBeneficiaryRegiondet(beneficiaryId, projectIndexId);
            updated++;
          } catch (err) {
            console.error(`[Storage] Error updating regiondet for beneficiary ${beneficiaryId}:`, err);
            errors++;
          }
        }
      }
      
      console.log(`[Storage] Regiondet backfill complete: processed=${processed}, updated=${updated}, errors=${errors}`);
      return { processed, updated, errors };
    } catch (error) {
      console.error('[Storage] Error in backfillBeneficiaryRegiondet:', error);
      throw error;
    }
  }

  // New normalized geographic data methods
  async getRegions(): Promise<any[]> {
    try {
      console.log('[Storage] Fetching regions...');
      
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('name');
        
      if (error) {
        console.error('[Storage] Error fetching regions:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} regions`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getRegions:', error);
      throw error;
    }
  }

  async getRegionalUnits(): Promise<any[]> {
    try {
      console.log('[Storage] Fetching regional units...');
      
      const { data, error } = await supabase
        .from('regional_units')
        .select('*')
        .order('name');
        
      if (error) {
        console.error('[Storage] Error fetching regional units:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} regional units`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getRegionalUnits:', error);
      throw error;
    }
  }

  async getMunicipalities(): Promise<any[]> {
    try {
      console.log('[Storage] Fetching municipalities...');
      
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .order('name');
        
      if (error) {
        console.error('[Storage] Error fetching municipalities:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} municipalities`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getMunicipalities:', error);
      throw error;
    }
  }

  // Junction table methods for normalized geographic relationships
  async getProjectIndexRegions(projectIndexId: number): Promise<any[]> {
    try {
      console.log(`[Storage] Fetching regions for project_index ${projectIndexId}`);
      
      const { data, error } = await supabase
        .from('project_index_regions')
        .select(`
          region_code,
          regions (
            code,
            name
          )
        `)
        .eq('project_index_id', projectIndexId);
        
      if (error) {
        console.error('[Storage] Error fetching project index regions:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getProjectIndexRegions:', error);
      throw error;
    }
  }

  async getProjectIndexUnits(projectIndexId: number): Promise<any[]> {
    try {
      console.log(`[Storage] Fetching regional units for project_index ${projectIndexId}`);
      
      const { data, error } = await supabase
        .from('project_index_units')
        .select(`
          unit_code,
          regional_units (
            code,
            name,
            region_code
          )
        `)
        .eq('project_index_id', projectIndexId);
        
      if (error) {
        console.error('[Storage] Error fetching project index units:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getProjectIndexUnits:', error);
      throw error;
    }
  }

  async getProjectIndexMunicipalities(projectIndexId: number): Promise<any[]> {
    try {
      console.log(`[Storage] Fetching municipalities for project_index ${projectIndexId}`);
      
      const { data, error } = await supabase
        .from('project_index_munis')
        .select(`
          muni_code,
          municipalities (
            code,
            name,
            unit_code
          )
        `)
        .eq('project_index_id', projectIndexId);
        
      if (error) {
        console.error('[Storage] Error fetching project index municipalities:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getProjectIndexMunicipalities:', error);
      throw error;
    }
  }

  // Project Budget Versions operations implementation
  async getBudgetVersionsByProject(projectId: number, formulationId?: number): Promise<ProjectBudgetVersion[]> {
    try {
      console.log(`[Storage] Fetching budget versions for project ${projectId}${formulationId ? `, formulation ${formulationId}` : ''}`);
      
      let query = supabase
        .from('project_budget_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('budget_type')
        .order('version_number');
      
      if (formulationId) {
        query = query.eq('formulation_id', formulationId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[Storage] Error fetching budget versions:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} budget versions for project ${projectId}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getBudgetVersionsByProject:', error);
      throw error;
    }
  }

  async getBudgetVersionById(id: number): Promise<ProjectBudgetVersion | null> {
    try {
      console.log(`[Storage] Fetching budget version by ID: ${id}`);
      
      const { data, error } = await supabase
        .from('project_budget_versions')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[Storage] Budget version with ID ${id} not found`);
          return null;
        }
        console.error('[Storage] Error fetching budget version by ID:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully fetched budget version:`, data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in getBudgetVersionById:', error);
      throw error;
    }
  }

  async createBudgetVersion(version: InsertProjectBudgetVersion): Promise<ProjectBudgetVersion> {
    try {
      console.log('[Storage] Creating new budget version:', version);
      
      const { data, error } = await supabase
        .from('project_budget_versions')
        .insert({
          ...version,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating budget version:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created budget version with ID:', data.id);
      return data;
    } catch (error) {
      console.error('[Storage] Error in createBudgetVersion:', error);
      throw error;
    }
  }

  async updateBudgetVersion(id: number, version: Partial<InsertProjectBudgetVersion>): Promise<ProjectBudgetVersion> {
    try {
      console.log(`[Storage] Updating budget version ${id}:`, version);
      
      const { data, error } = await supabase
        .from('project_budget_versions')
        .update({
          ...version,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating budget version:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated budget version:', data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in updateBudgetVersion:', error);
      throw error;
    }
  }

  async deleteBudgetVersion(id: number): Promise<void> {
    try {
      console.log(`[Storage] Deleting budget version ${id}`);
      
      const { error } = await supabase
        .from('project_budget_versions')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('[Storage] Error deleting budget version:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully deleted budget version ${id}`);
    } catch (error) {
      console.error('[Storage] Error in deleteBudgetVersion:', error);
      throw error;
    }
  }

  // EPA Financials operations implementation
  async getEPAFinancials(epaVersionId: number): Promise<EpaFinancials[]> {
    try {
      console.log(`[Storage] Fetching EPA financials for version ${epaVersionId}`);
      
      const { data, error } = await supabase
        .from('epa_financials')
        .select('*')
        .eq('epa_version_id', epaVersionId)
        .order('year');
        
      if (error) {
        console.error('[Storage] Error fetching EPA financials:', error);
        throw error;
      }
      
      console.log(`[Storage] Found ${data?.length || 0} EPA financial records for version ${epaVersionId}`);
      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getEPAFinancials:', error);
      throw error;
    }
  }

  async createEPAFinancials(financial: InsertEpaFinancials): Promise<EpaFinancials> {
    try {
      console.log('[Storage] Creating new EPA financial record:', financial);
      
      const { data, error } = await supabase
        .from('epa_financials')
        .insert({
          ...financial,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error creating EPA financial record:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully created EPA financial record with ID:', data.id);
      return data;
    } catch (error) {
      console.error('[Storage] Error in createEPAFinancials:', error);
      throw error;
    }
  }

  async updateEPAFinancials(id: number, financial: Partial<InsertEpaFinancials>): Promise<EpaFinancials> {
    try {
      console.log(`[Storage] Updating EPA financial record ${id}:`, financial);
      
      const { data, error } = await supabase
        .from('epa_financials')
        .update({
          ...financial,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('[Storage] Error updating EPA financial record:', error);
        throw error;
      }
      
      console.log('[Storage] Successfully updated EPA financial record:', data);
      return data;
    } catch (error) {
      console.error('[Storage] Error in updateEPAFinancials:', error);
      throw error;
    }
  }

  async deleteEPAFinancials(id: number): Promise<void> {
    try {
      console.log(`[Storage] Deleting EPA financial record ${id}`);
      
      const { error } = await supabase
        .from('epa_financials')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('[Storage] Error deleting EPA financial record:', error);
        throw error;
      }
      
      console.log(`[Storage] Successfully deleted EPA financial record ${id}`);
    } catch (error) {
      console.error('[Storage] Error in deleteEPAFinancials:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();