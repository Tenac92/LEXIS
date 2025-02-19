import { pgTable, text, serial, boolean, timestamp, jsonb, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Document Templates table
export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
  created_by: text("created_by").references(() => users.id),
  updated_at: timestamp("updated_at"),
  updated_by: text("updated_by").references(() => users.id),
  is_active: boolean("is_active").default(true),
  category: text("category").notNull(),
  template_data: jsonb("template_data").notNull(),
  structure_version: text("structure_version").notNull(),
  expenditure_type: text("expenditure_type"),
  is_default: boolean("is_default").default(false),
});

// Generated Documents table (with versioning support)
export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  generated_by: text("generated_by").references(() => users.id),
  recipients: jsonb("recipients").notNull(),
  protocol_date: timestamp("protocol_date"),
  total_amount: numeric("total_amount").notNull(),
  document_date: timestamp("document_date"),
  status: text("status").default("pending"),
  protocol_number_input: text("protocol_number_input"),
  expenditure_type: text("expenditure_type").notNull(),
  project_id: text("project_id").notNull(),
  project_na853: text("project_na853"),
  unit: text("unit").notNull(),
  original_protocol_number: text("original_protocol_number"),
  original_protocol_date: timestamp("original_protocol_date"),
  is_correction: boolean("is_correction").default(false),
  department: text("department"),
  comments: text("comments"),
  original_document_id: integer("original_document_id"),
  updated_by: text("updated_by").references(() => users.id),
  template_id: integer("template_id").references(() => documentTemplates.id),
  current_version: integer("current_version"),
});

// Document Versions table
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  document_id: integer("document_id").references(() => generatedDocuments.id),
  version_number: integer("version_number").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  created_by: text("created_by").references(() => users.id),
  changes: jsonb("changes").notNull(),
  recipients: jsonb("recipients").notNull(),
  metadata: jsonb("metadata"),
  is_current: boolean("is_current").default(false),
});

// Recipients table
export const recipients = pgTable("recipients", {
  id: serial("id").primaryKey(),
  firstname: text("firstname").notNull(),
  lastname: text("lastname").notNull(),
  afm: text("afm").notNull(),
  amount: numeric("amount").notNull(),
  project_id: text("project_id").notNull(),
  unit: text("unit").notNull(),
  installment: integer("installment").default(1),
  status: text("status").default("pending"),
  created_at: timestamp("created_at").defaultNow(),
  created_by: text("created_by").references(() => users.id),
  updated_at: timestamp("updated_at"),
  document_id: integer("document_id").references(() => generatedDocuments.id, {
    onDelete: "cascade",
    onUpdate: "cascade"
  }),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  na853: text("na853"),
  expenditure_type: text("expenditure_type"),
  budget: numeric("budget").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// Units table
export const units = pgTable("units", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  created_at: timestamp("created_at").defaultNow(),
  is_active: boolean("is_active").default(true),
});

// Project Catalog table
export const projectCatalog = pgTable("project_catalog", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  na271: text("na271"),
  na853: text("na853"),
  event_description: text("event_description"),
  project_title: text("project_title"),
  event_type: text("event_type"),
  event_year: text("event_year"),
  region: text("region"),
  regional_unit: text("regional_unit"),
  municipality: text("municipality"),
  implementing_agency: jsonb("implementing_agency"),
  expenditure_type: jsonb("expenditure_type"),
  budget_e069: numeric("budget_e069"),
  budget_na271: numeric("budget_na271"),
  budget_na853: numeric("budget_na853"),
  status: text("status"),
  created_at: timestamp("created_at").defaultNow(),
});

// Types
export type User = typeof users.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;
export type Recipient = typeof recipients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type ProjectCatalog = typeof projectCatalog.$inferSelect;


// Insert Types
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;
export type InsertRecipient = z.infer<typeof insertRecipientSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type InsertProjectCatalog = z.infer<typeof insertProjectCatalogSchema>;

// Insert Schemas
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates);
export const insertDocumentVersionSchema = createInsertSchema(documentVersions);
export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments, {
  recipients: z.array(z.object({
    afm: z.string(),
    amount: z.number(),
    status: z.string(),
    lastname: z.string(),
    firstname: z.string(),
    installment: z.number()
  })),
  project_id: z.string(),
  unit: z.string(),
  expenditure_type: z.string(),
  total_amount: z.number()
});
export const insertRecipientSchema = createInsertSchema(recipients);
export const insertProjectSchema = createInsertSchema(projects);
export const insertUnitSchema = createInsertSchema(units);
export const insertProjectCatalogSchema = createInsertSchema(projectCatalog);

// Database type for Supabase
export type Database = {
  public: {
    Tables: {
      document_templates: {
        Row: DocumentTemplate;
        Insert: InsertDocumentTemplate;
      };
      document_versions: {
        Row: DocumentVersion;
        Insert: InsertDocumentVersion;
      };
      generated_documents: {
        Row: GeneratedDocument;
        Insert: InsertGeneratedDocument;
      };
      recipients: {
        Row: Recipient;
        Insert: InsertRecipient;
      };
      projects: {
        Row: Project;
        Insert: InsertProject;
      };
      units: {
        Row: Unit;
        Insert: InsertUnit;
      };
      project_catalog: {
        Row: ProjectCatalog;
        Insert: InsertProjectCatalog;
      };
      users: {
        Row: User;
        Insert: z.infer<typeof createInsertSchema(users)>
      }
    };
  };
};