/**
 * Unified Database Schema Definition
 *
 * This file contains all database schema definitions, relationships, and type exports
 * in a consistent, well-organized structure.
 *
 * Organization:
 * 1. Imports
 * 2. Table Definitions
 * 3. Schema Helpers (createInsertSchema, etc.)
 * 4. Entity Types
 * 5. Insert Types
 * 6. Custom Types & Interfaces
 * 7. Validation Schemas
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  varchar,
  integer,
  decimal,
  date,
  customType,
  foreignKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { number, z } from "zod";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// ==============================================================
// 1. Imports above, Table Definitions below
// ==============================================================

/**
 * Users Table
 * Stores user account information and credentials
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  units: text("units").array(),
  department: text("department"),
  telephone: text("telephone"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Project Catalog Table
 * Contains project metadata and reference information
 */
export const projectCatalog = pgTable("project_catalog", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  title: text("title").notNull(),
  budget_na853: text("budget_na853"),
  budget_na271: text("budget_na271"),
  budget_e069: text("budget_e069"),
  expenditure_type: text("expenditure_type").array().default([]),
  status: text("status").notNull().default("active"),
  implementing_agency: text("implementing_agency").array().default([]),
  region: jsonb("region").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Projects Table
 * Primary project data with budget information
 */
export const projects = pgTable("Projects", {
  id: serial("id").primaryKey(),
  mis: integer("mis").notNull().unique(),
  title: text("title").notNull(),
  budget_na853: text("budget_na853"),
  budget_na271: text("budget_na271"),
  budget_e069: text("budget_e069"),
  expenditure_type: text("expenditure_type").array().default([]),
  status: text("status").notNull().default("active"),
  implementing_agency: text("implementing_agency").array().default([]),
  region: jsonb("region").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Budget NA853 Split Table
 * Stores budget allocation data for NA853 budget code
 */
export const budgetNA853Split = pgTable("budget_na853_split", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  na853: text("na853").notNull(),
  ethsia_pistosi: decimal("ethsia_pistosi", {
    precision: 12,
    scale: 2,
  }).default("0"),
  q1: decimal("q1", { precision: 12, scale: 2 }).default("0"),
  q2: decimal("q2", { precision: 12, scale: 2 }).default("0"),
  q3: decimal("q3", { precision: 12, scale: 2 }).default("0"),
  q4: decimal("q4", { precision: 12, scale: 2 }).default("0"),
  katanomes_etous: decimal("katanomes_etous", {
    precision: 12,
    scale: 2,
  }).default("0"),
  user_view: decimal("user_view", { precision: 12, scale: 2 }).default("0"),
  proip: decimal("proip", { precision: 12, scale: 2 }).default("0"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
  sum: jsonb("sum"),
  last_quarter_check: text("last_quarter_check"),
});

/**
 * Budget History Table
 * Tracks changes to budget allocations over time
 */
export const budgetHistory = pgTable("budget_history", {
  id: serial("id").primaryKey(),
  mis: integer("mis").notNull(),
  previous_amount: text("previous_amount").notNull(),
  new_amount: text("new_amount").notNull(),
  change_type: text("change_type").notNull(),
  change_reason: text("change_reason"),
  document_id: integer("document_id"),
  document_status: text("document_status"),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({}),
});

/**
 * Budget Notifications Table
 * Stores budget-related notifications and alerts
 */
export const budgetNotifications = pgTable("budget_notifications", {
  id: serial("id").primaryKey(),
  mis: integer("mis").notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  current_budget: decimal("current_budget", { precision: 12, scale: 2 }),
  ethsia_pistosi: decimal("ethsia_pistosi", { precision: 12, scale: 2 }),
  reason: text("reason"),
  status: text("status").default("pending"),
  user_id: integer("user_id").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Generated Documents Table
 * Stores information about documents generated in the system
 */
export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("draft"),
  unit: text("unit").notNull(),
  project_id: integer("mis").notNull(),
  project_na853: text("project_na853"),
  expenditure_type: text("expenditure_type").notNull(),
  total_amount: decimal("total_amount", { precision: 12, scale: 2 }),
  protocol_number: text("protocol_number"),
  protocol_number_input: text("protocol_number_input"),
  protocol_date: timestamp("protocol_date"),
  department: text("department"),
  user_name: text("user_name"),
  contact_number: text("contact_number"),
  region: text("region"),
  attachments: jsonb("attachments").default([]),
  recipients: jsonb("recipients").default([]),
  installments: jsonb("installments").default([]),
  installmentAmounts: jsonb("installmentAmounts").default({}),
  template_id: integer("template_id"),
  comments: text("comments"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Attachments Table
 * Stores document attachment metadata
 */
export const attachmentsRows = pgTable("attachments", {
  id: serial("id").primaryKey(),
  document_id: integer("document_id").notNull(),
  file_path: text("file_path").notNull(),
  file_name: text("file_name").notNull(),
  file_type: text("file_type").notNull(),
  file_size: integer("file_size"),
  content_type: text("content_type"),
  uploaded_by: integer("uploaded_by"),
  created_at: timestamp("created_at").defaultNow(),
});

/**
 * Document Versions Table
 * Tracks version history for documents
 */
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  document_id: integer("document_id").notNull(),
  version_number: integer("version_number").notNull(),
  document_data: jsonb("document_data").notNull(),
  metadata: jsonb("metadata").default({}),
  created_by: integer("created_by"),
  created_at: timestamp("created_at").defaultNow(),
});

/**
 * Document Templates Table
 * Stores document templates for various document types
 */
export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: jsonb("content").notNull(),
  category: text("category").default("general"),
  expenditure_type: text("expenditure_type"),
  is_default: boolean("is_default").default(false),
  is_active: boolean("is_active").default(true),
  created_by: integer("created_by"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Monada Table (Units/Organizations)
 * Contains information about organizational units
 */
export const monada = pgTable("Monada", {
  id: text("id").primaryKey(),
  unit: text("unit").notNull(),
  unit_name: jsonb("unit_name").notNull(),
  parts: jsonb("parts"),
  email: text("email"),
  manager: jsonb("manager"),
  address: jsonb("address"),
});

// ==============================================================
// 2. Table Definitions above, Schema Helpers below
// ==============================================================

// Schema definitions for insert operations - used with forms and validation
export const insertUserSchema = createInsertSchema(users);

// Extended schemas with additional validation
export const extendedUserSchema = insertUserSchema.extend({
  email: z.string().email("Παρακαλώ εισάγετε ένα έγκυρο email"),
  password: z
    .string()
    .min(6, "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες"),
  name: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  role: z.string().refine((val) => ["admin", "user"].includes(val), {
    message: "Ο ρόλος πρέπει να είναι admin ή user",
  }),
});

export const insertProjectSchema = createInsertSchema(projects);

export const insertProjectCatalogSchema = createInsertSchema(projectCatalog);

// Schema for document recipients
export const recipientSchema = z.object({
  firstname: z.string().min(1, "Το όνομα του παραλήπτη είναι υποχρεωτικό"),
  lastname: z.string().min(1, "Το επώνυμο του παραλήπτη είναι υποχρεωτικό"),
  fathername: z.string().min(1, "Το πατρώνυμο του παραλήπτη είναι υποχρεωτικό"),
  afm: z
    .string()
    .min(9, "Το ΑΦΜ πρέπει να έχει 9 ψηφία")
    .max(9, "Το ΑΦΜ πρέπει να έχει 9 ψηφία"),
  amount: z.number().min(0.01, "Το ποσό πρέπει να είναι μεγαλύτερο από 0"),
  installment: z.string().default("ΕΦΑΠΑΞ"), // Παλιό πεδίο για συμβατότητα
  installments: z.array(z.string()).default(["ΕΦΑΠΑΞ"]), // Νέο πεδίο για πολλαπλές δόσεις
  installmentAmounts: z.record(z.string(), z.number()).default({ΕΦΑΠΑΞ: 0}), // Πεδίο για ποσά ανά δόση
});

export const insertGeneratedDocumentSchema =
  createInsertSchema(generatedDocuments);

// Extended schema with validation for recipients
export const extendedGeneratedDocumentSchema =
  insertGeneratedDocumentSchema.extend({
    recipients: z
      .array(recipientSchema)
      .min(1, "Πρέπει να υπάρχει τουλάχιστον ένας παραλήπτης"),
  });

export const insertBudgetHistorySchema = createInsertSchema(budgetHistory);

export const insertBudgetNotificationSchema =
  createInsertSchema(budgetNotifications);

// Budget validation schema for validating budget changes
export const budgetValidationSchema = z.object({
  mis: z.union([z.string().min(1, "Κωδικός MIS απαιτείται"), z.number().int()]),
  amount: z.number().positive("Το ποσό πρέπει να είναι θετικός αριθμός"),
  note: z.string().optional(),
});

// ==============================================================
// 3. Schema Helpers above, Entity Types below
// ==============================================================

// Base entity types inferred from table definitions
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;
export type BudgetNA853Split = typeof budgetNA853Split.$inferSelect;
export type BudgetHistory = typeof budgetHistory.$inferSelect;
export type BudgetNotification = typeof budgetNotifications.$inferSelect;
export type AttachmentsRow = typeof attachmentsRows.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// ==============================================================
// 4. Entity Types above, Insert Types below
// ==============================================================

// Insert types for form handling and database operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectCatalog = z.infer<typeof insertProjectCatalogSchema>;
export type InsertGeneratedDocument = z.infer<
  typeof insertGeneratedDocumentSchema
>;
export type InsertBudgetHistory = z.infer<typeof insertBudgetHistorySchema>;
export type InsertBudgetNotification = z.infer<
  typeof insertBudgetNotificationSchema
>;
export type Recipient = z.infer<typeof recipientSchema>;

// ==============================================================
// 5. Insert Types above, Custom Types & Interfaces below
// ==============================================================

// Custom types for specific UI and business logic needs

// Unit name structure
export interface MonadaUnitName {
  name: string;
  prop: string;
}

// Manager information structure
export interface MonadaManager {
  name: string;
  order: string;
  title: string;
  degree: string;
  prepose: string;
}

// Address structure
export interface MonadaAddress {
  tk: string;
  region: string;
  address: string;
}

// Complete Monada (Unit) structure
export interface Monada {
  id: string;
  unit: string;
  unit_name: MonadaUnitName;
  parts?: Record<string, string>;
  email?: string;
  manager?: MonadaManager;
  address?: MonadaAddress;
}

// Budget validation response structure
export interface BudgetValidationResponse {
  status: "success" | "warning" | "error";
  message?: string;
  canCreate: boolean;
  requiresNotification?: boolean;
  notificationType?: "funding" | "reallocation" | "exceeded_proip";
  allowDocx?: boolean;
}

// ==============================================================
// 6. Custom Types above, Validation Schemas below
// ==============================================================

// Budget validation response schema
export const budgetValidationResponseSchema = z.object({
  status: z.enum(["success", "warning", "error"]),
  message: z.string().optional(),
  canCreate: z.boolean(),
  requiresNotification: z.boolean().optional(),
  notificationType: z
    .enum(["funding", "reallocation", "exceeded_proip"])
    .optional(),
  allowDocx: z.boolean().optional(),
});

// Budget validation type
export type BudgetValidation = z.infer<typeof budgetValidationSchema>;

// Version metadata schema
export const versionMetadataSchema = z.object({
  reason: z.string().optional(),
  changes: z.record(z.string(), z.any()).optional(),
  user_id: z.number().optional(),
  automated: z.boolean().optional(),
});

// ==============================================================
// 7. Database Type for Supabase
// ==============================================================

export type Database = {
  users: typeof users.$inferSelect;
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
