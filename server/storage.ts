import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type ProjectCatalog, type BudgetNA853Split, type BudgetValidation, type BudgetValidationResponse, type BudgetHistory, type InsertBudgetHistory, type BudgetNotification } from "@shared/schema";
import { db } from "./db";
import session from "express-session";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createGeneratedDocument(doc: InsertGeneratedDocument): Promise<GeneratedDocument>;
  getGeneratedDocument(id: number): Promise<GeneratedDocument | undefined>;
  listGeneratedDocuments(): Promise<GeneratedDocument[]>;
  getProjectCatalog(): Promise<ProjectCatalog[]>;
  getProjectCatalogByUnit(unit: string): Promise<ProjectCatalog[]>;
  getProjectExpenditureTypes(projectId: string): Promise<string[]>;
  getUserUnits(userId: string): Promise<string[]>;
  getBudgetData(projectId: string): Promise<BudgetNA853Split | undefined>;
  validateBudget(validation: BudgetValidation): Promise<BudgetValidationResponse>;
  createBudgetHistoryEntry(historyEntry: InsertBudgetHistory): Promise<BudgetHistory>;
  getBudgetHistory(projectId: string): Promise<BudgetHistory[]>;
  getBudgetNotifications(): Promise<BudgetNotification[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data || undefined;
    } catch (error) {
      console.error('[Storage] Error fetching user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw error;
      return data || undefined;
    } catch (error) {
      console.error('[Storage] Error fetching user by email:', error);
      throw error;
    }
  }

  async createGeneratedDocument(doc: InsertGeneratedDocument): Promise<GeneratedDocument> {
    try {
      const { data, error } = await db
        .from('generated_documents')
        .insert([doc])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from insert');

      return data;
    } catch (error) {
      console.error('[Storage] Error creating generated document:', error);
      throw error;
    }
  }

  async getGeneratedDocument(id: number): Promise<GeneratedDocument | undefined> {
    try {
      const { data, error } = await db
        .from('generated_documents')
        .select('*')
        .eq('id', id.toString())
        .single();

      if (error) throw error;
      return data || undefined;
    } catch (error) {
      console.error('[Storage] Error fetching generated document:', error);
      throw error;
    }
  }

  async listGeneratedDocuments(): Promise<GeneratedDocument[]> {
    try {
      const { data, error } = await db
        .from('generated_documents')
        .select('*')
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Storage] Error listing generated documents:', error);
      throw error;
    }
  }

  async getProjectCatalog(): Promise<ProjectCatalog[]> {
    try {
      const { data, error } = await db
        .from('project_catalog')
        .select('*')
        .order('mis');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Storage] Error fetching project catalog:', error);
      throw error;
    }
  }

  async getProjectCatalogByUnit(unit: string): Promise<ProjectCatalog[]> {
    try {
      const { data, error } = await db
        .from('project_catalog')
        .select('*')
        .contains('implementing_agency', [unit])
        .order('mis');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Storage] Error fetching project catalog by unit:', error);
      throw error;
    }
  }

  async getProjectExpenditureTypes(projectId: string): Promise<string[]> {
    try {
      const { data, error } = await db
        .from('project_catalog')
        .select('expenditure_type')
        .eq('mis', projectId)
        .single();

      if (error) throw error;
      return data?.expenditure_type || [];
    } catch (error) {
      console.error('[Storage] Error fetching project expenditure types:', error);
      throw error;
    }
  }

  async getBudgetData(projectId: string): Promise<BudgetNA853Split | undefined> {
    try {
      const { data, error } = await db
        .from('budget_na853_split')
        .select('*')
        .eq('mis', projectId)
        .single();

      if (error) throw error;
      return data || undefined;
    } catch (error) {
      console.error('[Storage] Error fetching budget data:', error);
      throw error;
    }
  }

  async validateBudget(validation: BudgetValidation): Promise<BudgetValidationResponse> {
    try {
      const budgetData = await this.getBudgetData(validation.mis);

      if (!budgetData) {
        return {
          status: 'error',
          message: 'Budget data not found for the project',
          canCreate: false
        };
      }

      const currentBudget = parseFloat(budgetData.user_view?.toString() || '0');
      const annualAllocation = parseFloat(budgetData.katanomes_etous?.toString() || '0');
      const remainingBudget = currentBudget - validation.amount;
      const minimumThreshold = annualAllocation * 0.2; // 20% of annual allocation

      if (remainingBudget < 0) {
        return {
          status: 'error',
          message: 'Insufficient budget available',
          canCreate: false
        };
      }

      if (remainingBudget < minimumThreshold) {
        return {
          status: 'warning',
          message: 'Budget will be reduced below 20% of annual allocation',
          canCreate: true
        };
      }

      return {
        status: 'success',
        canCreate: true
      };
    } catch (error) {
      console.error('[Storage] Error validating budget:', error);
      throw error;
    }
  }

  async createBudgetHistoryEntry(historyEntry: InsertBudgetHistory): Promise<BudgetHistory> {
    try {
      const { data, error } = await db
        .from('budget_history')
        .insert([historyEntry])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from insert');

      return data;
    } catch (error) {
      console.error('[Storage] Error creating budget history entry:', error);
      throw error;
    }
  }

  async getBudgetHistory(projectId: string): Promise<BudgetHistory[]> {
    try {
      const { data, error } = await db
        .from('budget_history')
        .select('*')
        .eq('mis', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Storage] Error fetching budget history:', error);
      throw error;
    }
  }
  async getUserUnits(userId: string): Promise<string[]> {
    try {
      const { data, error } = await db
        .from('unit_det')
        .select('unit, unit_name')
        .order('unit');

      if (error) throw error;
      return data?.map(item => item.unit) || [];
    } catch (error) {
      console.error('[Storage] Error fetching user units:', error);
      throw error;
    }
  }
  async getBudgetNotifications(): Promise<BudgetNotification[]> {
    try {
      console.log('[Storage] Fetching budget notifications...');

      const { data, error } = await db
        .from('budget_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Storage] Error fetching budget notifications:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('[Storage] Successfully fetched notifications:', {
        count: data?.length || 0
      });

      return data || [];
    } catch (error) {
      console.error('[Storage] Error in getBudgetNotifications:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();