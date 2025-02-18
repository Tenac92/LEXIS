import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { integer, numeric } from "drizzle-orm/pg-core";

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

// User type for Supabase Auth
export type User = {
  id: string;
  email: string | null;
  role: string;
  created_at: string;
};

// Login credentials type
export type LoginCredentials = z.infer<typeof loginSchema>;

// Rest of the schema remains unchanged
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  unit: text("unit").notNull(),
  status: text("status").default("pending").notNull(),
  created_by: text("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
  protocol_number: text("protocol_number"),
  protocol_date: timestamp("protocol_date"),
  total_amount: numeric("total_amount").notNull(),
  project_id: text("project_id").notNull(),
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
export const insertDocumentSchema = createInsertSchema(documents);
export const insertRecipientSchema = createInsertSchema(recipients);
export const insertProjectSchema = createInsertSchema(projects);

// Types
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Recipient = typeof recipients.$inferSelect;
export type InsertRecipient = z.infer<typeof insertRecipientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

// Define the Database type for Supabase
export type Database = {
  public: {
    Tables: {
      documents: {
        Row: Document;
        Insert: InsertDocument;
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