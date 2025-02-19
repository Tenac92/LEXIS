import { z } from 'zod';

// Base schema for project catalog
export const projectSchema = z.object({
  mis: z.coerce.string(),
  na853: z.string().nullable(),
  e069: z.string().nullable(),
  na271: z.string().nullable(),
  event_description: z.string().nullable(),
  project_title: z.string().nullable(),
  event_type: z.string().nullable(),
  event_year: z.array(z.coerce.string()).nullable(),
  region: z.string().nullable(),
  regional_unit: z.string().nullable(),
  municipality: z.string().nullable(),
  implementing_agency: z.array(z.string()).nullable(),
  budget_na853: z.coerce.number().nullable(),
  budget_e069: z.coerce.number().nullable(),
  budget_na271: z.coerce.number().nullable(),
  ethsia_pistosi: z.coerce.number().nullable().transform(val => 
    isNaN(val) ? null : val
  ),
  status: z.string().nullable().default("pending"),
  kya: z.string().nullable(),
  fek: z.string().nullable(),
  ada: z.string().nullable(),
  expenditure_type: z.array(z.string()).nullable(),
  procedures: z.string().nullable(),
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
    'Event Type': project.event_type,
    'Event Year': project.event_year ? project.event_year.join(', ') : '',
    'Region': project.region,
    'Regional Unit': project.regional_unit,
    'Municipality': project.municipality,
    'Implementing Agency': Array.isArray(project.implementing_agency) 
      ? project.implementing_agency.join(', ') 
      : project.implementing_agency,
    'Budget NA853': project.budget_na853?.toString() ?? '0',
    'Budget E069': project.budget_e069?.toString() ?? '0',
    'Budget NA271': project.budget_na271?.toString() ?? '0',
    'Annual Credit': project.ethsia_pistosi?.toString() ?? '0',
    'Status': project.status,
    'KYA': project.kya,
    'FEK': project.fek,
    'ADA': project.ada,
    'Expenditure Type': Array.isArray(project.expenditure_type)
      ? project.expenditure_type.join(', ')
      : project.expenditure_type,
    'Procedures': project.procedures,
    'Created At': project.created_at ? project.created_at.toLocaleDateString() : '',
    'Updated At': project.updated_at ? project.updated_at.toLocaleDateString() : ''
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