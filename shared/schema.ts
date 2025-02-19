import { pgTable, text, serial, boolean, timestamp, jsonb, numeric, integer } from "drizzle-orm/pg-core";
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

// Type Definitions
export type User = typeof users.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;

// Insert Schemas
export const insertGeneratedDocumentSchema = z.object({
  unit: z.string().min(1, "Unit is required"),
  project_id: z.string().min(1, "Project ID is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  recipients: z.array(z.object({
    firstname: z.string().min(2, "First name must be at least 2 characters"),
    lastname: z.string().min(2, "Last name must be at least 2 characters"),
    afm: z.string().length(9, "AFM must be exactly 9 digits"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    installment: z.number().min(1).max(12, "Installment must be between 1 and 12"),
    status: z.string()
  })).min(1, "At least one recipient is required"),
  total_amount: z.number().min(0.01, "Total amount must be greater than 0"),
  status: z.string()
});

export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;

// Database type for Supabase
export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
      };
      generated_documents: {
        Row: GeneratedDocument;
        Insert: InsertGeneratedDocument;
      };
    };
  };
};