import { z } from 'zod';

// Optimized schema for Projects with enhanced data structure
export const projectSchema = z.object({
  id: z.number().optional(),
  mis: z.union([z.string(), z.number().int()]).nullable(),
  e069: z.string().nullable(),
  na271: z.string().nullable(),
  na853: z.string().nullable(),
  event_description: z.string().nullable(),
  project_title: z.string().nullable(),
  event_type_id: z.number().nullable().optional(),
  event_year: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  kya: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  fek: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  ada: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  ada_import_sana271: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  ada_import_sana853: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  budget_decision: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  funding_decision: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  allocation_decision: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  budget_e069: z.number().nullable().optional(),
  budget_na271: z.number().nullable().optional(),
  budget_na853: z.number().nullable().optional(),
  status: z.string().nullable().default("pending"),
  created_at: z.union([z.date(), z.string()]).nullable().default(() => new Date()),
  updated_at: z.union([z.date(), z.string()]).nullable().default(() => new Date()),
  // Enhanced fields from project_index joins
  enhanced_event_type: z.object({
    id: z.number(),
    name: z.string()
  }).nullable().optional(),
  enhanced_expenditure_type: z.object({
    id: z.number(),
    name: z.string()
  }).nullable().optional(),
  enhanced_unit: z.object({
    id: z.number(),
    name: z.string()
  }).nullable().optional(),
  enhanced_kallikratis: z.object({
    id: z.number(),
    name: z.string(),
    level: z.string()
  }).nullable().optional(),
  // Legacy compatibility fields - made optional for backward compatibility
  event_type: z.array(z.string()).nullable().optional().default([]),
  region: z.object({
    region: z.array(z.string()),
    municipality: z.array(z.string()),
    regional_unit: z.array(z.string()),
  }).nullable().optional().default({ region: [], municipality: [], regional_unit: [] }),
  implementing_agency: z.union([z.array(z.string()), z.null()]).optional().default([]).transform(v => v === null ? [] : v),
  expenditure_type: z.union([z.array(z.string()), z.null()]).optional().default([]).transform(v => v === null ? [] : v),
});

// Type inference
export type Project = z.infer<typeof projectSchema>;

// Schema for creating new projects
export const createProjectSchema = projectSchema.omit({ 
  id: true,
  created_at: true,
  updated_at: true 
});

export type CreateProject = z.infer<typeof createProjectSchema>;

// Helper functions for data transformation
export const projectHelpers = {
  formatForExcel: (project: Project) => ({
    'MIS': project.mis,
    'NA853': project.na853,
    'E069': project.e069,
    'NA271': project.na271,
    'Event Description': project.event_description,
    'Project Title': project.project_title,
    'Event Type': Array.isArray(project.event_type) ? project.event_type.join(', ') : (project.event_type || ''),
    'Event Year': Array.isArray(project.event_year) ? project.event_year.join(', ') : (typeof project.event_year === 'string' ? project.event_year : ''),
    'Region': project.region?.region?.join(', ') || '',
    'Regional Unit': project.region?.regional_unit?.join(', ') || '',
    'Municipality': project.region?.municipality?.join(', ') || '',
    'Implementing Agency': project.implementing_agency?.join(', ') || '',
    'Budget NA853': project.budget_na853?.toString() || '0',
    'Budget E069': project.budget_e069?.toString() || '0',
    'Budget NA271': project.budget_na271?.toString() || '0',
    'Status': project.status,
    'KYA': Array.isArray(project.kya) ? project.kya.join(', ') : (typeof project.kya === 'string' ? project.kya : ''),
    'FEK': Array.isArray(project.fek) ? project.fek.join(', ') : (typeof project.fek === 'string' ? project.fek : ''),
    'ADA': Array.isArray(project.ada) ? project.ada.join(', ') : (typeof project.ada === 'string' ? project.ada : ''),
    'Created At': project.created_at?.toLocaleDateString() || '',
    'Updated At': project.updated_at?.toLocaleDateString() || ''
  }),

  validateProject: (data: unknown): Project => {
    try {
      const result = projectSchema.safeParse(data);
      if (!result.success) {
        console.error('Project validation failed:', result.error);
        throw result.error;
      }
      return result.data;
    } catch (error) {
      console.error('Project validation error details:', error);
      throw error;
    }
  }
};