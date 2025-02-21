import { pgTable, text, serial, boolean, timestamp, jsonb, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Updated Budget NA853 Split table with quarterly fields
export const budgetNA853Split = pgTable("budget_na853_split", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
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

// New Budget Notifications table
export const budgetNotifications = pgTable("budget_notifications", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  type: text("type").notNull(), // 'funding' or 'reallocation'
  amount: numeric("amount").notNull(),
  current_budget: numeric("current_budget").notNull(),
  ethsia_pistosi: numeric("ethsia_pistosi").notNull(),
  reason: text("reason"),
  status: text("status").default("pending"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  created_by: integer("created_by").references(() => users.id),
});

// Users table matching the actual database structure
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  full_name: text("full_name").notNull(),
  role: text("role").notNull(),
  unit: text("unit"),
  active: boolean("active").default(true),
  name: text("name"),
  created_at: timestamp("created_at").defaultNow(),
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

// Generated Documents table
export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  recipients: jsonb("recipients").notNull(),
  protocol_date: timestamp("protocol_date"),
  total_amount: numeric("total_amount").notNull(),
  document_date: timestamp("document_date"),
  original_protocol_date: timestamp("original_protocol_date"),
  is_correction: boolean("is_correction").default(false),
  original_document_id: integer("original_document_id"),
  project_na853: text("project_na853"),
  unit: text("unit").notNull(),
  generated_by: integer("generated_by").references(() => users.id),
  original_protocol_number: text("original_protocol_number"),
  comments: text("comments"),
  updated_by: integer("updated_by").references(() => users.id),
  department: text("department"),
  status: text("status").default("draft"),
  protocol_number_input: text("protocol_number_input"),
  expenditure_type: text("expenditure_type").notNull(),
  project_id: text("project_id").notNull(),
});

// Budget History table for tracking changes
export const budgetHistory = pgTable("budget_history", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull(),
  previous_amount: numeric("previous_amount").notNull(),
  new_amount: numeric("new_amount").notNull(),
  change_type: text("change_type").notNull(), // e.g., 'document_creation', 'manual_adjustment'
  change_reason: text("change_reason"),
  document_id: integer("document_id").references(() => generatedDocuments.id),
  created_by: integer("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Add the attachments_rows table schema
export const attachmentsRows = pgTable("attachments", {
  id: serial("id").primaryKey(),
  expediture_type: text("expediture_type").notNull(),
  installment: integer("installment").notNull(),
  attachments: text("attachments").array(),
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

// Types
export type User = typeof users.$inferSelect;
export type ProjectCatalog = typeof projectCatalog.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;
export type BudgetNA853Split = typeof budgetNA853Split.$inferSelect;
export type BudgetHistory = typeof budgetHistory.$inferSelect;
export type BudgetNotification = typeof budgetNotifications.$inferSelect;
export type AttachmentsRow = typeof attachmentsRows.$inferSelect;
export type InsertAttachmentsRow = typeof attachmentsRows.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

// Insert Schemas
export const insertUserSchema = createInsertSchema(users);
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

// Budget validation schemas
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

// New Budget Notification Schema
export const insertBudgetNotificationSchema = createInsertSchema(budgetNotifications, {
  type: z.enum(["funding", "reallocation"]),
  amount: z.number().min(0, "Amount must be non-negative"),
  current_budget: z.number().min(0, "Current budget must be non-negative"),
  ethsia_pistosi: z.number().min(0, "Annual credit must be non-negative"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
}).omit({ id: true, created_at: true, updated_at: true });

// Enhanced recipient schema with better validation
const recipientSchema = z.object({
  firstname: z.string().min(2, "First name must be at least 2 characters"),
  lastname: z.string().min(2, "Last name must be at least 2 characters"),
  afm: z.string().length(9, "AFM must be exactly 9 digits").regex(/^\d+$/, "AFM must contain only numbers"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
});

// Update generated document schema with enhanced validation
export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments, {
  recipients: z.array(recipientSchema)
    .min(1, "At least one recipient is required")
    .max(10, "Maximum 10 recipients allowed"),
  total_amount: z.number().min(0.01, "Total amount must be greater than 0"),
  project_id: z.string().min(1, "Project ID is required"),
  unit: z.string().min(1, "Unit is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  status: z.enum(["draft", "pending", "approved", "rejected"]).default("draft")
}).superRefine((data, ctx) => {
  // Validate that total amount matches sum of recipient amounts
  const totalFromRecipients = data.recipients.reduce((sum, recipient) => sum + recipient.amount, 0);
  if (Math.abs(totalFromRecipients - Number(data.total_amount)) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Total amount must match sum of recipient amounts",
      path: ["total_amount"]
    });
  }
});

export const insertBudgetHistorySchema = createInsertSchema(budgetHistory).omit({
  id: true,
  created_at: true
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

// Export database type
export type Database = {
  users: User;
  projectCatalog: ProjectCatalog;
  generatedDocuments: GeneratedDocument;
  budgetNA853Split: BudgetNA853Split;
  budgetHistory: BudgetHistory;
  budgetNotifications: BudgetNotification;
  attachmentsRows: AttachmentsRow;
  documentVersions: DocumentVersion;
};