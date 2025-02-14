import { pgTable, text, serial, integer, boolean, timestamp, numeric, foreignKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  full_name: text("full_name").notNull(),
  role: text("role").default("user").notNull(),
  unit: text("unit"),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  unit: text("unit").notNull(),
  status: text("status").default("pending").notNull(),
  created_by: integer("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
  protocol_number: text("protocol_number"),
  protocol_date: timestamp("protocol_date"),
  total_amount: numeric("total_amount").notNull(),
  project_id: text("project_id").notNull(),
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
  created_by: integer("created_by").references(() => users.id),
  updated_at: timestamp("updated_at"),
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

// Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertDocumentSchema = createInsertSchema(documents);
export const insertRecipientSchema = createInsertSchema(recipients);
export const insertProjectSchema = createInsertSchema(projects);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Recipient = typeof recipients.$inferSelect;
export type InsertRecipient = z.infer<typeof insertRecipientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
