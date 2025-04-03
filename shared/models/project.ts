import { z } from 'zod';

// Base schema for Projects
export const projectSchema = z.object({
  mis: z.union([z.string(), z.number().int()]),
  e069: z.string().nullable(),
  na271: z.string().nullable(),
  na853: z.string().nullable(),
  event_description: z.string().nullable(),
  project_title: z.string().nullable(),
  event_type: z.array(z.string()).nullable(),
  event_year: z.array(z.string()).nullable(),
  region: z.object({
    region: z.array(z.string()),
    municipality: z.array(z.string()),
    regional_unit: z.array(z.string()),
  }).nullable(),
  implementing_agency: z.array(z.string()).nullable(),
  expenditure_type: z.array(z.string()).nullable(),
  kya: z.array(z.string()).nullable(),
  fek: z.array(z.string()).nullable(),
  ada: z.array(z.string()).nullable(),
  ada_import_sana271: z.array(z.string()).nullable(),
  ada_import_sana853: z.array(z.string()).nullable(),
  budget_decision: z.array(z.string()).nullable(),
  funding_decision: z.array(z.string()).nullable(),
  allocation_decision: z.array(z.string()).nullable(),
  budget_e069: z.number().nullable(),
  budget_na271: z.number().nullable(),
  budget_na853: z.number().nullable(),
  status: z.string().nullable().default("pending"),
  created_at: z.date().nullable().default(() => new Date()),
  updated_at: z.date().nullable().default(() => new Date())
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
    'Event Type': project.event_type ? project.event_type.join(', ') : '',
    'Event Year': project.event_year ? project.event_year.join(', ') : '',
    'Region': project.region?.region.join(', ') || '',
    'Regional Unit': project.region?.regional_unit.join(', ') || '',
    'Municipality': project.region?.municipality.join(', ') || '',
    'Implementing Agency': project.implementing_agency?.join(', ') || '',
    'Budget NA853': project.budget_na853?.toString() || '0',
    'Budget E069': project.budget_e069?.toString() || '0',
    'Budget NA271': project.budget_na271?.toString() || '0',
    'Status': project.status,
    'KYA': project.kya?.join(', ') || '',
    'FEK': project.fek?.join(', ') || '',
    'ADA': project.ada?.join(', ') || '',
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