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

// Units table
export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit_id: integer("unit_id").references(() => units.id),
  expenditure_types: text("expenditure_types").array(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

// Budgets table
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").references(() => projects.id),
  total_budget: numeric("total_budget").notNull(),
  annual_budget: numeric("annual_budget").notNull(),
  current_budget: numeric("current_budget").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  unit: text("unit").notNull(),
  project_id: text("project_id").notNull(),
  expenditure_type: text("expenditure_type").notNull(),
  recipients: jsonb("recipients").notNull(),
  total_amount: numeric("total_amount").notNull(),
  status: text("status").default("draft"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
  created_by: integer("created_by").references(() => users.id),
});

// Types
export type User = typeof users.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Document = typeof documents.$inferSelect;

// Recipient schema for documents
export const recipientSchema = z.object({
  firstname: z.string().min(2, "First name must be at least 2 characters"),
  lastname: z.string().min(2, "Last name must be at least 2 characters"),
  afm: z.string().length(9, "AFM must be exactly 9 digits"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertUnitSchema = createInsertSchema(units);
export const insertProjectSchema = createInsertSchema(projects);
export const insertBudgetSchema = createInsertSchema(budgets);
export const insertDocumentSchema = createInsertSchema(documents, {
  recipients: z.array(recipientSchema),
  project_id: z.string().min(1, "Project ID is required"),
  unit: z.string().min(1, "Unit is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required")
});

// Export types for insert operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Export database type
export type Database = {
  users: User;
  units: Unit;
  projects: Project;
  budgets: Budget;
  documents: Document;
};