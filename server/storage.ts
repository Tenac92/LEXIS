import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type ProjectCatalog } from "@shared/schema";
import { supabase } from "./db";
import session from "express-session";
import MemoryStore from "memorystore";
import { PostgrestError } from '@supabase/supabase-js';

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
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  async getUserUnits(userId: string): Promise<string[]> {
    try {
      console.log('[Storage] Fetching units for user:', userId);

      const { data, error } = await supabase
        .from('users')
        .select('units')
        .eq('id', userId.toString())
        .single();

      if (error) {
        console.error('[Storage] Error in getUserUnits:', error);
        throw error;
      }

      if (!data?.units) {
        console.log('[Storage] No units found for user');
        return [];
      }

      let units: string[] = [];
      if (typeof data.units === 'string') {
        try {
          units = JSON.parse(data.units);
        } catch (e) {
          console.error('[Storage] Error parsing units JSON:', e);
          return [];
        }
      } else if (Array.isArray(data.units)) {
        units = data.units;
      }

      console.log('[Storage] Processed units:', units);
      return units;
    } catch (error) {
      console.error('[Storage] Error fetching user units:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id.toString())
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      console.log('[Storage] Fetching project catalog');
      const { data, error } = await supabase
        .from('project_catalog')
        .select('*')
        .order('mis');

      if (error) {
        console.error('[Storage] Error fetching project catalog:', error);
        throw error;
      }

      console.log('[Storage] Project catalog data:', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('[Storage] Error fetching project catalog:', error);
      throw error;
    }
  }

  async getProjectCatalogByUnit(unit: string): Promise<ProjectCatalog[]> {
    try {
      console.log('[Storage] Fetching project catalog for unit:', unit);
      const { data, error } = await supabase
        .from('project_catalog')
        .select('*')
        .contains('implementing_agency', [unit])
        .order('mis');

      if (error) {
        console.error('[Storage] Error fetching project catalog by unit:', error);
        throw error;
      }

      console.log('[Storage] Project catalog data for unit:', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('[Storage] Error fetching project catalog by unit:', error);
      throw error;
    }
  }

  async getProjectExpenditureTypes(projectId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
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
}

export const storage = new DatabaseStorage();