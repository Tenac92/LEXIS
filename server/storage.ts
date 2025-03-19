import { users, type User, type GeneratedDocument, type InsertGeneratedDocument, type Project } from "@shared/schema";
import { supabase } from "./config/db";

export interface IStorage {
  // ... other interface methods ...
  getProjectsByUnit(unit: string): Promise<Project[]>;
}

export class DatabaseStorage implements IStorage {
  // ... other methods ...

  async getProjectsByUnit(unit: string): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('Projects')
        .select('*');

      if (error) throw error;

      // Filter in JavaScript since PostgREST JSONB filtering is problematic
      return (data || []).filter(project => {
        if (!project.implementing_agency) return false;
        const agencies = Array.isArray(project.implementing_agency) ? 
          project.implementing_agency : 
          JSON.parse(project.implementing_agency);
        return agencies.includes(unit);
      });
    } catch (error) {
      console.error('[Storage] Error fetching projects by unit:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();