import { pgTable, text, serial, timestamp, jsonb, numeric, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define schemas first, before validation schemas and types

/**
 * SECTION 1: SCHEMA DEFINITIONS
 * All database table schemas are defined here
 */

// Enhanced recipient schema with better validation - moved to top to fix order issue
const recipientSchema = z.object({
  firstname: z.string().min(2, "First name must be at least 2 characters"),
  lastname: z.string().min(2, "Last name must be at least 2 characters"),
  afm: z.string().length(9, "AFM must be exactly 9 digits").regex(/^\d+$/, "AFM must contain only numbers"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
});

// Users table definition
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

// Budget NA853 Split table with quarterly fields
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

// Budget Notifications table
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

// Project catalog table
export const projectCatalog = pgTable("project_catalog", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  title: text("title").notNull(),
  implementing_agency: text("implementing_agency").array(),
  event_type: text("event_type").array(),
  event_year: text("event_year").array(),
  budget_na853: numeric("budget_na853").default("0"),
  budget_e069: numeric("budget_e069").default("0"),
  budget_na271: numeric("budget_na271").default("0"),
  ethsia_pistosi: numeric("ethsia_pistosi").default("0"),
  status: text("status").default("pending"),
  procedures: text("procedures"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Generated Documents table
export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  unit: text("unit").notNull(),
  project_id: text("project_id").notNull(),
  project_na853: text("project_na853"),
  region: text("region"),
  department: text("department"),
  expenditure_type: text("expenditure_type").notNull(),
  recipients: jsonb("recipients").notNull(),
  total_amount: numeric("total_amount").notNull(),
  status: text("status").default("draft"), // draft, pending, approved, rejected
  protocol_number: text("protocol_number"),
  protocol_date: timestamp("protocol_date"),
  protocol_number_input: text("protocol_number_input"),
  user_name: text("user_name"),
  contact_number: text("contact_number"),
  attachments: text("attachments").array(),
  comments: text("comments"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Budget history model
export const budgetHistory = pgTable("budget_history", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  previous_amount: numeric("previous_amount"),
  new_amount: numeric("new_amount"),
  change_type: text("change_type").notNull(), // funding, reallocation, adjustment
  change_reason: text("change_reason"),
  document_id: serial("document_id"),
  document_status: text("document_status"),
  metadata: jsonb("metadata"),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow(),
});

// Attachments table
export const attachmentsRows = pgTable("attachments", {
  id: serial("id").primaryKey(),
  document_id: serial("document_id").notNull(),
  filename: text("filename").notNull(),
  mimetype: text("mimetype").notNull(),
  path: text("path").notNull(),
  size: numeric("size").notNull(),
  type: text("type").notNull(), // 'draft', 'decision', 'other'
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Document versions table
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  document_id: serial("document_id").notNull(),
  version: numeric("version").notNull(),
  data: jsonb("data").notNull(),
  metadata: jsonb("metadata"),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow(),
});

// Document templates table
export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: jsonb("content").notNull(),
  category: text("category").default("general"),
  expenditure_type: text("expenditure_type"),
  is_default: boolean("is_default").default(false),
  is_active: boolean("is_active").default(true),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Projects table
export const projects = pgTable("Projects", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  title: text("title").notNull(),
  event_type: jsonb("event_type"),
  event_year: jsonb("event_year"),
  region: jsonb("region"),
  implementing_agency: jsonb("implementing_agency"),
  budget_e069: numeric("budget_e069"),
  budget_na271: numeric("budget_na271"),
  budget_na853: numeric("budget_na853"),
  status: text("status").default("pending"),
  expenditure_type: jsonb("expenditure_type"),
  kya: jsonb("kya"),
  fek: jsonb("fek"),
  ada: jsonb("ada"),
  ada_import_sana271: jsonb("ada_import_sana271"),
  ada_import_sana853: jsonb("ada_import_sana853"),
  budget_decision: jsonb("budget_decision"),
  funding_decision: jsonb("funding_decision"),
  allocation_decision: jsonb("allocation_decision"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Monada table schema
export const monada = pgTable("Monada", {
  id: text("id").primaryKey(),
  unit: text("unit").notNull(),
  unit_name: jsonb("unit_name").notNull(),
  parts: jsonb("parts"),
  email: text("email"),
  manager: jsonb("manager"),
  address: jsonb("address"),
});

/**
 * SECTION 2: SCHEMA VALIDATION DEFINITIONS
 * Validation schemas for inserts and updates
 */

// User insert schema
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

// Project insert schema
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

// Project catalog insert schema
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

// Generated document insert schema
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

// Budget validation schema
export const budgetValidationSchema = z.object({
  mis: z.string().min(1, "Project ID is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
  type: z.enum(["funding", "reallocation"]).optional(),
});

// Budget validation response schema
export const budgetValidationResponseSchema = z.object({
  status: z.enum(["success", "warning", "error"]),
  message: z.string().optional(),
  canCreate: z.boolean(),
  requiresNotification: z.boolean().optional(),
  notificationType: z.enum(["funding", "reallocation", "exceeded_proip"]).optional(),
  allowDocx: z.boolean().optional(),
});

// Budget notification insert schema
export const insertBudgetNotificationSchema = createInsertSchema(budgetNotifications, {
  type: z.enum(["funding", "reallocation"]),
  amount: z.number().min(0, "Amount must be non-negative"),
  current_budget: z.number().min(0, "Current budget must be non-negative"),
  ethsia_pistosi: z.number().min(0, "Annual credit must be non-negative"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending")
}).omit({ id: true, created_at: true, updated_at: true });

// Budget history insert schema
export const insertBudgetHistorySchema = createInsertSchema(budgetHistory, {
  metadata: z.any().optional()
}).omit({
  id: true
});

/**
 * SECTION 3: TYPE DEFINITIONS
 * Type definitions for tables and schemas
 */

// Database record types
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectCatalog = typeof projectCatalog.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;
export type BudgetNA853Split = typeof budgetNA853Split.$inferSelect;
export type BudgetHistory = typeof budgetHistory.$inferSelect;
export type BudgetNotification = typeof budgetNotifications.$inferSelect;
export type AttachmentsRow = typeof attachmentsRows.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// Insert types derived from schemas
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectCatalog = z.infer<typeof insertProjectCatalogSchema>;
export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;
export type InsertBudgetHistory = z.infer<typeof insertBudgetHistorySchema>;
export type InsertBudgetNotification = z.infer<typeof insertBudgetNotificationSchema>;
export type BudgetValidation = z.infer<typeof budgetValidationSchema>;

// Custom types
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

export interface BudgetValidationResponse {
  status: "success" | "warning" | "error";
  message?: string;
  canCreate: boolean;
  requiresNotification?: boolean;
  notificationType?: "funding" | "reallocation" | "exceeded_proip";
  allowDocx?: boolean;
}

// Database type for Supabase client
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