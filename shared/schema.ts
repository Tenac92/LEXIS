import { pgTable, text, serial, integer, timestamp, jsonb, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Updated Budget NA853 Split table with quarterly fields
export const budgetNA853Split = pgTable("budget_na853_split", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  na853: text("na853").notNull(),
  user_view: numeric("user_view").default("0"),
  proip: numeric("proip").default("0"),
  ethsia_pistosi: numeric("ethsia_pistosi").default("0"),
  katanomes_etous: numeric("katanomes_etous").default("0"),
  q1: numeric("q1").default("0"),
  q2: numeric("q2").default("0"),
  q3: numeric("q3").default("0"),
  q4: numeric("q4").default("0"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Updated Budget Notifications table matching existing Supabase structure
export const budgetNotifications = pgTable("budget_notifications", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  type: text("type").notNull(), // 'funding' | 'reallocation'
  amount: numeric("amount").notNull(),
  current_budget: numeric("current_budget").notNull(),
  ethsia_pistosi: numeric("ethsia_pistosi").notNull(),
  reason: text("reason"),
  status: text("status").default("pending"), // 'pending' | 'approved' | 'rejected'
  user_id: integer("user_id").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Update the users table definition to match the actual database structure
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  units: text("units").array(),
  department: text("department"),
  telephone: text("telephone"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Project Catalog table matching Supabase structure
export const projectCatalog = pgTable("project_catalog", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  na853: text("na853"),
  event_description: text("event_description"),
  implementing_agency: text("implementing_agency").array(),
  region: text("region"),
  municipality: text("municipality"),
  budget_na853: numeric("budget_na853").default("0"),
  budget_e069: numeric("budget_e069").default("0"),
  budget_na271: numeric("budget_na271").default("0"),
  ethsia_pistosi: numeric("ethsia_pistosi").default("0"),
  status: text("status").default("pending"),
  event_type: text("event_type"),
  event_year: text("event_year").array(),
  procedures: text("procedures"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Update the Generated Documents table with protocol fields
export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  status: text("status").default("draft").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  unit: text("unit").notNull(),
  project_id: text("project_id").notNull(),
  project_na853: text("project_na853"),
  expenditure_type: text("expenditure_type").notNull(),
  recipients: jsonb("recipients").notNull(),
  total_amount: numeric("total_amount").notNull(),
  generated_by: integer("generated_by").references(() => users.id),
  department: text("department"),
  attachments: text("attachments").array(),
  protocol_number_input: text("protocol_number_input"),
  protocol_date: timestamp("protocol_date"),
  original_protocol_number: text("original_protocol_number"),
  original_protocol_date: timestamp("original_protocol_date"),
  is_correction: boolean("is_correction").default(false),
  comments: text("comments"),
  region: text("region"), // Added region field
});

// Update the budget history table to include metadata
export const budgetHistory = pgTable("budget_history", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  previous_amount: text("previous_amount").notNull(),
  new_amount: text("new_amount").notNull(),
  change_type: text("change_type").notNull(), // e.g., 'document_creation', 'manual_adjustment'
  change_reason: text("change_reason"),
  document_id: integer("document_id").references(() => generatedDocuments.id),
  created_by: integer("created_by").references(() => users.id),
  metadata: jsonb("metadata"), // Add metadata column
  created_at: timestamp("created_at").defaultNow(),
});

// Update the attachments table schema within the existing file
export const attachmentsRows = pgTable("attachments", {
  id: serial("id").primaryKey(),
  document_id: integer("document_id").references(() => generatedDocuments.id),
  file_path: text("file_path").notNull(),
  type: text("type").notNull(),
  created_by: integer("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Add document version table definition
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  document_id: integer("document_id").references(() => generatedDocuments.id),
  version_number: integer("version_number").notNull(),
  recipients: jsonb("recipients").notNull(),
  changes: jsonb("changes"),
  metadata: jsonb("metadata"),
  is_current: boolean("is_current").default(true),
  created_by: integer("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  expenditure_type: text("expenditure_type"),
  template_data: jsonb("template_data").notNull(),
  created_by: integer("created_by").references(() => users.id),
  updated_by: integer("updated_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
  structure_version: text("structure_version").default("1.0"),
  is_active: boolean("is_active").default(true),
  is_default: boolean("is_default").default(false),
});

// Update the Projects table definition to properly handle JSONB fields
export const projects = pgTable("Projects", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  e069: text("e069"),
  na271: text("na271"),
  na853: text("na853"),
  event_description: text("event_description"),
  project_title: text("project_title"),
  event_type: jsonb("event_type").$type<string[]>(),
  event_year: jsonb("event_year").$type<string[]>(),
  region: jsonb("region").$type<{
    region: string[];
    municipality: string[];
    regional_unit: string[];
  }>(),
  implementing_agency: jsonb("implementing_agency").$type<string[]>(),
  expenditure_type: jsonb("expenditure_type").$type<string[]>(), // Properly type expenditure_type as JSONB array
  kya: jsonb("kya").$type<string[]>(),
  fek: jsonb("fek").$type<string[]>(),
  ada: jsonb("ada").$type<string[]>(),
  ada_import_sana271: jsonb("ada_import_sana271").$type<string[]>(),
  ada_import_sana853: jsonb("ada_import_sana853").$type<string[]>(),
  budget_decision: jsonb("budget_decision").$type<string[]>(),
  funding_decision: jsonb("funding_decision").$type<string[]>(),
  allocation_decision: jsonb("allocation_decision").$type<string[]>(),
  budget_e069: numeric("budget_e069"),
  budget_na271: numeric("budget_na271"),
  budget_na853: numeric("budget_na853"),
  status: text("status").default("pending"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// TODO: Refactor - There are duplicate type definitions in this file
// Project type is defined both here and at line 387
// InsertProject type is defined both here and at line 296
// Export project types
export type Project = typeof projects.$inferSelect; 
export type InsertProject = typeof projects.$inferInsert;

// Create insert schema for Projects
export const insertProjectSchema = createInsertSchema(projects, {
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
  status: z.enum(["active", "pending", "pending_reallocation", "completed"]).default("pending"),
}).omit({
  id: true,
  created_at: true,
  updated_at: true
});

// TODO: Refactor - InsertGeneratedDocument is defined both here and at line 282
// Enhanced recipient schema with better validation
const recipientSchema = z.object({
  firstname: z.string().min(2, "First name must be at least 2 characters"),
  lastname: z.string().min(2, "Last name must be at least 2 characters"),
  afm: z.string().length(9, "AFM must be exactly 9 digits").regex(/^\d+$/, "AFM must contain only numbers"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
});

// Keep existing types and schemas but update document-related ones
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;
export type InsertGeneratedDocument = typeof generatedDocuments.$inferInsert;

// Update the generated document schema to include region
export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments, {
  recipients: z.array(recipientSchema)
    .min(1, "At least one recipient is required")
    .max(10, "Maximum 10 recipients allowed"),
  total_amount: z.number().min(0.01, "Total amount must be greater than 0"),
  project_id: z.string().min(1, "Project ID is required"),
  region: z.string().min(1, "Region is required"),
  unit: z.string().min(1, "Unit is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  status: z.enum(["draft", "pending", "approved", "rejected"]).default("draft"),
}).omit({
  id: true,
  created_at: true,
  updated_at: true,
});


export const budgetValidationSchema = z.object({
  mis: z.string().min(1, "Project ID is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
  type: z.enum(["funding", "reallocation"]).optional(),
});

export const budgetValidationResponseSchema = z.object({
  status: z.enum(["success", "warning", "error"]),
  message: z.string().optional(),
  canCreate: z.boolean(),
  requiresNotification: z.boolean().optional(),
  notificationType: z.enum(["funding", "reallocation", "exceeded_proip"]).optional(),
  allowDocx: z.boolean().optional(),
});

// Update the notification schema to match the table
export const insertBudgetNotificationSchema = createInsertSchema(budgetNotifications, {
  type: z.enum(["funding", "reallocation"]),
  amount: z.number().min(0, "Amount must be non-negative"),
  current_budget: z.number().min(0, "Current budget must be non-negative"),
  ethsia_pistosi: z.number().min(0, "Annual credit must be non-negative"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending")
}).omit({ id: true, created_at: true, updated_at: true });

// Recipientschema is now defined earlier in the file

// Update generated document schema with enhanced validation and protocol fields

export const insertBudgetHistorySchema = createInsertSchema(budgetHistory, {
  metadata: z.any().optional()
}).omit({
  id: true
});

// Export types for insert operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProjectCatalog = z.infer<typeof insertProjectCatalogSchema>;
export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;
export type BudgetValidation = z.infer<typeof budgetValidationSchema>;

export interface BudgetValidationResponse {
  status: "success" | "warning" | "error";
  message?: string;
  canCreate: boolean;
  requiresNotification?: boolean;
  notificationType?: "funding" | "reallocation" | "exceeded_proip";
  allowDocx?: boolean;
}

export type InsertBudgetHistory = z.infer<typeof insertBudgetHistorySchema>;
export type InsertBudgetNotification = z.infer<typeof insertBudgetNotificationSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;

// Add the Monada table schema
export const monada = pgTable("Monada", {
  id: text("id").primaryKey(),
  unit: text("unit").notNull(),
  unit_name: jsonb("unit_name").notNull(),
  parts: jsonb("parts"),
  email: text("email"),
  manager: jsonb("manager"),
  address: jsonb("address"),
});

// Add Monada type with specific JSON structure
export interface MonadaUnitName {
  name: string;
  prop: string;
}

export interface MonadaManager {
  name: string;
  order: string;
  title: string;
  degree: string;
  prepose: string;
}

export interface MonadaAddress {
  tk: string;
  region: string;
  address: string;
}

export interface Monada {
  id: string;
  unit: string;
  unit_name: MonadaUnitName;
  parts?: Record<string, string>;
  email?: string;
  manager?: MonadaManager;
  address?: MonadaAddress;
}

// Export database type
export type Database = {
  users: typeof users.$inferSelect;
  projectCatalog: typeof projectCatalog.$inferSelect;
  generatedDocuments: typeof generatedDocuments.$inferSelect;
  budgetNA853Split: typeof budgetNA853Split.$inferSelect;
  budgetHistory: typeof budgetHistory.$inferSelect;
  budgetNotifications: typeof budgetNotifications.$inferSelect;
  attachmentsRows: typeof attachmentsRows.$inferSelect;
  documentVersions: typeof documentVersions.$inferSelect;
  documentTemplates: typeof documentTemplates.$inferSelect;
  monada: Monada;
  projects: Project;
};
import { integer } from "drizzle-orm/pg-core";
export const insertProjectCatalogSchema = createInsertSchema(projectCatalog, {
  implementing_agency: z.array(z.string()).min(1, "At least one implementing agency is required"),
  budget_na853: z.coerce.number().min(0, "Budget NA853 must be non-negative"),
  budget_e069: z.coerce.number().min(0, "Budget E069 must be non-negative"),
  budget_na271: z.coerce.number().min(0, "Budget NA271 must be non-negative"),
  ethsia_pistosi: z.coerce.number().min(0, "Annual credit must be non-negative"),
  status: z.enum(["active", "pending", "pending_reallocation", "pending_funding", "completed"]).default("pending"),
  event_type: z.string().nullable(),
  event_year: z.array(z.string()).nullable(),
  procedures: z.string().nullable(),
}).omit({ id: true, created_at: true, updated_at: true });

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["admin", "manager", "user"]),
  units: z.array(z.string()).optional(),
  department: z.string().optional(),
  telephone: z.string().optional(),
}).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type ProjectCatalog = typeof projectCatalog.$inferSelect;
export type BudgetNA853Split = typeof budgetNA853Split.$inferSelect;
export type BudgetHistory = typeof budgetHistory.$inferSelect;
export type BudgetNotification = typeof budgetNotifications.$inferSelect;
export type AttachmentsRow = typeof attachmentsRows.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type User = typeof users.$inferSelect;