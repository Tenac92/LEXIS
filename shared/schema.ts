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

// Types
export type User = typeof users.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;

// Insert Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments, {
  recipients: z.array(z.object({
    firstname: z.string().min(2, "First name must be at least 2 characters"),
    lastname: z.string().min(2, "Last name must be at least 2 characters"),
    afm: z.string().length(9, "AFM must be exactly 9 digits"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
  })),
  project_id: z.string().min(1, "Project ID is required"),
  unit: z.string().min(1, "Unit is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required")
});

// Export types for insert operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;

// Export database type
export type Database = {
  users: User;
  generatedDocuments: GeneratedDocument;
};