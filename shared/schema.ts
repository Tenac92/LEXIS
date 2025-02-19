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
  department: text("department"),
  comments: text("comments"),
  original_document_id: integer("original_document_id"),
  updated_by: text("updated_by").references(() => users.id),
});

// Types
export type User = typeof users.$inferSelect;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;

// Recipient type used in the recipients jsonb field
export const recipientSchema = z.object({
  lastname: z.string().min(1, "Last name is required"),
  firstname: z.string().min(1, "First name is required"),
  afm: z.string().min(9, "AFM must be at least 9 characters"),
  amount: z.number().positive("Amount must be positive"),
  installment: z.number().int().positive("Installment must be a positive integer"),
  status: z.string().default("pending")
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments, {
  recipients: z.array(recipientSchema),
  project_id: z.string().min(1, "Project ID is required"),
  unit: z.string().min(1, "Unit is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  total_amount: z.number().positive("Total amount must be positive")
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;

// Export database type
export type Database = {
  users: User;
  generated_documents: GeneratedDocument;
};