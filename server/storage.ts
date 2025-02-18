import { users, generatedDocuments, projectCatalog, type ProjectCatalog, type InsertProjectCatalog } from "@shared/schema";
import type { User, GeneratedDocument, InsertGeneratedDocument } from "@shared/schema";
import { supabase } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createGeneratedDocument(doc: InsertGeneratedDocument): Promise<GeneratedDocument>;
  getGeneratedDocument(id: number): Promise<GeneratedDocument | undefined>;
  listGeneratedDocuments(): Promise<GeneratedDocument[]>;
  sessionStore: session.Store;
  getProjectCatalog(): Promise<ProjectCatalog[]>;
  getProjectCatalogByUnit(unit: string): Promise<ProjectCatalog[]>;
  getProjectExpenditureTypes(projectId: string): Promise<string[]>;
  getUserUnits(userId: string): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }

  async getUserUnits(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('auth.users')
        .select('units')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data?.units || [];
    } catch (error) {
      console.error('[Storage] Error fetching user units:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const { data, error } = await supabase
        .from('auth.users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Storage] Error fetching user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const { data, error } = await supabase
        .from('auth.users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Storage] Error fetching user by email:', error);
      throw error;
    }
  }

  async createGeneratedDocument(doc: InsertGeneratedDocument): Promise<GeneratedDocument> {
    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .insert(doc)
        .select()
        .single();

      if (error) throw error;
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
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('project_catalog')
        .select('expenditure_type')
        .eq('id', projectId)
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