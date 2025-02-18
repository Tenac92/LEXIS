import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { integer, numeric, jsonb } from "drizzle-orm/pg-core";

// Users table matching Supabase Auth
export const users = pgTable("auth.users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  created_at: timestamp("created_at").defaultNow(),
  role: text("role").default("user").notNull(),
});

// Login schema for validation
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Generated Documents table
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
});

// Types
export type User = typeof users.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;
export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;

// Insert Schemas
export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments, {
  recipients: z.array(z.object({
    afm: z.string(),
    amount: z.number(),
    status: z.string(),
    lastname: z.string(),
    firstname: z.string(),
    installment: z.number()
  }))
});

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
  document_id: integer("document_id").references(() => generatedDocuments.id),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  mis: text("mis").notNull().unique(),
  na853: text("na853"),
  expenditure_type: text("expenditure_type"),
  budget: numeric("budget").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertRecipientSchema = createInsertSchema(recipients);
export const insertProjectSchema = createInsertSchema(projects);

// Types
export type Recipient = typeof recipients.$inferSelect;
export type InsertRecipient = z.infer<typeof insertRecipientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

// Define the Database type for Supabase
export type Database = {
  public: {
    Tables: {
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
    };
  };
  auth: {
    Users: {
      Row: User;
    };
  };
};