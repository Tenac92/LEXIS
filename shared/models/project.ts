import { z } from 'zod';

// Base schema for project catalog
export const projectSchema = z.object({
  id: z.number(),
  mis: z.string(),
  na853: z.string().nullable(),
  e069: z.string().nullable(),
  na271: z.string().nullable(),
  event_description: z.string().nullable(),
  project_title: z.string().nullable(),
  event_type: z.string().nullable(),
  event_year: z.string().nullable(),
  region: z.string().nullable(),
  regional_unit: z.string().nullable(),
  municipality: z.string().nullable(),
  implementing_agency: z.array(z.string()).nullable(),
  budget_na853: z.string().nullable(),
  budget_e069: z.string().nullable(),
  budget_na271: z.string().nullable(),
  ethsia_pistosi: z.string().nullable(),
  status: z.string(),
  kya: z.string().nullable(),
  fek: z.string().nullable(),
  ada: z.string().nullable(),
  expenditure_type: z.array(z.string()).nullable(),
  procedures: z.string().nullable(),
  created_at: z.date().nullable(),
  updated_at: z.date().nullable()
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
    'Event Year': project.event_year,
    'Region': project.region,
    'Regional Unit': project.regional_unit,
    'Municipality': project.municipality,
    'Implementing Agency': Array.isArray(project.implementing_agency) 
      ? project.implementing_agency.join(', ') 
      : project.implementing_agency,
    'Budget NA853': project.budget_na853,
    'Budget E069': project.budget_e069,
    'Budget NA271': project.budget_na271,
    'Annual Credit': project.ethsia_pistosi,
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
    return projectSchema.parse(data);
  }
};
