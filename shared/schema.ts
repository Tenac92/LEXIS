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
  bigint,
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
  descr: text("descr"),
  details: jsonb("details"),
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
 * Uses 'id' as primary key for all operations, 'mis' kept for legacy compatibility
 */
export const projects = pgTable("Projects", {
  id: serial("id").primaryKey(),
  mis: integer("mis").unique(), // Legacy field, no longer primary identifier
  e069: text("e069"),
  na271: text("na271"),
  na853: text("na853").notNull().unique(), // Main project code users see
  event_description: text("event_description").notNull().unique(), // Main description users see
  project_title: text("project_title"),
  event_type: jsonb("event_type").default([]),
  event_year: jsonb("event_year").default([]),
  region: jsonb("region").default({}),
  implementing_agency: jsonb("implementing_agency").default([]),
  expenditure_type: jsonb("expenditure_type").default([]),
  kya: jsonb("kya"),
  fek: jsonb("fek"),
  ada: jsonb("ada"),
  ada_import_sana271: jsonb("ada_import_sana271"),
  ada_import_sana853: jsonb("ada_import_sana853"),
  budget_decision: jsonb("budget_decision"),
  funding_decision: jsonb("funding_decision"),
  allocation_decision: jsonb("allocation_decision"),
  budget_e069: decimal("budget_e069", { precision: 12, scale: 2 }),
  budget_na271: decimal("budget_na271", { precision: 12, scale: 2 }),
  budget_na853: decimal("budget_na853", { precision: 12, scale: 2 }),
  status: text("status"),
  created_at: date("created_at"),
  updated_at: date("updated_at"),
});

/**
 * Budget NA853 Split Table
 * Stores budget allocation data for NA853 budget code
 * Now references project by id instead of mis
 */
export const budgetNA853Split = pgTable("budget_na853_split", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  mis: integer("mis").unique(), // Legacy field for migration compatibility
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
 * Now references project by id instead of mis
 */
export const budgetHistory = pgTable("budget_history", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  mis: integer("mis"), // Legacy field for migration compatibility
  previous_amount: decimal("previous_amount", { precision: 12, scale: 2 }).notNull(),
  new_amount: decimal("new_amount", { precision: 12, scale: 2 }).notNull(),
  change_type: text("change_type").notNull(),
  change_reason: text("change_reason"),
  document_id: integer("document_id"),
  created_by: integer("created_by"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Project History Table
 * Tracks historical changes and versions of project data
 * Stores comprehensive project state snapshots for audit trails
 */
export const projectHistory = pgTable("project_history", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  implementing_agency_location: text("implementing_agency_location"),
  expenditure_types: jsonb("expenditure_types"),
  decisions: jsonb("decisions"),
  event_name: text("event_name"),
  event_year: integer("event_year"),
  enumeration_code: text("enumeration_code"),
  inclusion_year: integer("inclusion_year"),
  summary_description: text("summary_description"),
  expenses_executed: decimal("expenses_executed", { precision: 12, scale: 2 }),
  project_status: text("project_status"),
  previous_entries: jsonb("previous_entries"),
  formulation: jsonb("formulation"),
  changes: jsonb("changes"),
});

/**
 * Budget Notifications Table
 * Stores budget-related notifications and alerts
 * Now references project by id instead of mis
 */
export const budgetNotifications = pgTable("budget_notifications", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  mis: integer("mis"), // Legacy field for migration compatibility
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
 * Now references project by id instead of mis
 */
export const generatedDocuments = pgTable("generated_documents", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("draft"),
  unit: text("unit").notNull(),
  project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  mis: integer("mis"), // Legacy field for migration compatibility
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
  esdian: jsonb("esdian").default([]), // Internal distribution fields
  // Director signature fields
  director_signature: jsonb("director_signature"), // Stores selected director info
  department_manager_signature: jsonb("department_manager_signature"), // Stores selected department manager info
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

/**
 * Employees Table
 * Contains employee information for autocomplete and recipient management
 */
export const employees = pgTable("Employees", {
  id: serial("id").primaryKey(),
  surname: text("surname"),
  name: text("name"),
  fathername: text("fathername"),
  afm: serial("afm").unique(),
  klados: text("klados"),
  attribute: text("attribute"),
  workaf: text("workaf"),
  monada: text("monada"),
}, (table) => ({
  monadaReference: foreignKey({
    columns: [table.monada],
    foreignColumns: [monada.unit],
  }),
}));

/**
 * Beneficiaries Table (Clean normalized structure)
 * Contains basic beneficiary information
 */
export const beneficiaries = pgTable("beneficiaries", {
  id: serial("id").primaryKey(),
  afm: text("afm").notNull().unique(), // Tax ID (AFM) - now text and required
  surname: text("surname").notNull(),
  name: text("name").notNull(),
  fathername: text("fathername"),
  region: text("region"),
  adeia: integer("adeia"), // License/permit number
  cengsur1: text("cengsur1"), // Engineer 1 surname
  cengname1: text("cengname1"), // Engineer 1 name
  cengsur2: text("cengsur2"), // Engineer 2 surname
  cengname2: text("cengname2"), // Engineer 2 name
  onlinefoldernumber: text("onlinefoldernumber"), // Online folder number
  freetext: text("freetext"), // Additional free text
  date: date("date").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * Beneficiary Payments Table (Replaces oikonomika JSONB)
 * Normalized financial data with proper relationships
 */
export const beneficiaryPayments = pgTable("beneficiary_payments", {
  id: serial("id").primaryKey(),
  beneficiary_id: integer("beneficiary_id").notNull().references(() => beneficiaries.id, { onDelete: "cascade" }),
  unit_code: text("unit_code").notNull(),
  na853_code: text("na853_code").notNull(),
  expenditure_type: text("expenditure_type").notNull(),
  installment: text("installment").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  status: text("status").default("pending"),
  protocol_number: text("protocol_number"),
  payment_date: date("payment_date"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

/**
 * User Preferences Table
 * Stores user preferences including frequently used Internal Distribution options
 */
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  preference_type: text("preference_type").notNull(), // 'esdian', 'attachments', etc.
  preference_key: text("preference_key").notNull(), // 'field1', 'field2', etc.
  preference_value: text("preference_value").notNull(), // The actual preference value
  usage_count: integer("usage_count").default(1), // How many times user has used this preference
  last_used: timestamp("last_used").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

/**
 * Project Index Table
 * Contains normalized project relationships with reference tables
 */
export const projectIndex = pgTable("project_index", {
  project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  monada_id: integer("monada_id").notNull().references(() => monada.id),
  kallikratis_id: integer("kallikratis_id").notNull().references(() => kallikratis.id),
  event_types_id: integer("event_types_id").notNull().references(() => eventTypes.id),
  expediture_type_id: integer("expediture_type_id").notNull(),
  geographic_code: bigint("geographic_code", { mode: "number" }), // Administrative level determined by digit count: 6=municipal, 3=regional_unit, 1=region
}, (table) => ({
  pk: { 
    name: "project_monada_kallikratis_pkey",
    columns: [table.project_id, table.monada_id, table.kallikratis_id, table.event_types_id, table.expediture_type_id]
  }
}));

/**
 * Event Types Table
 * Reference table for event types
 */
export const eventTypes = pgTable("event_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

/**
 * Expenditure Types Table
 * Reference table for expenditure types
 */
export const expenditureTypes = pgTable("expediture_types", {
  id: serial("id").primaryKey(),
  expediture_types: text("expediture_types").notNull(),
  expediture_types_minor: text("expediture_types_minor"),
});

/**
 * Kallikratis Table
 * Reference table for Greek administrative divisions
 * Supports both municipal-level and regional-level projects
 */
export const kallikratis = pgTable("kallikratis", {
  id: serial("id").primaryKey(),
  kodikos_dimotikis_enotitas: bigint("kodikos_dimotikis_enotitas", { mode: "number" }).notNull(),
  onoma_dimotikis_enotitas: text("onoma_dimotikis_enotitas"),
  kodikos_neou_ota: bigint("kodikos_neou_ota", { mode: "number" }),
  eidos_neou_ota: text("eidos_neou_ota"),
  onoma_neou_ota: text("onoma_neou_ota"),
  kodikos_perifereiakis_enotitas: bigint("kodikos_perifereiakis_enotitas", { mode: "number" }),
  perifereiaki_enotita: text("perifereiaki_enotita"),
  kodikos_perifereias: bigint("kodikos_perifereias", { mode: "number" }),
  perifereia: text("perifereia"),
});

/**
 * Legacy Beneficiary Table (for backward compatibility during migration)
 */
export const beneficiariesLegacy = pgTable("Beneficiary", {
  id: serial("id").primaryKey(),
  aa: integer("a / a"), // Serial number
  region: text("region"),
  adeia: integer("adeia"), // License/permit number
  surname: text("surname"),
  name: text("name"),
  fathername: text("fathername"),
  freetext: text("freetext"), // Additional free text
  afm: integer("afm"), // Tax ID (AFM)
  date: text("date"), // Date as text
  monada: text("monada"), // Unit/Organization
  cengsur1: text("cengsur1"), // Engineer 1 surname
  cengname1: text("cengname1"), // Engineer 1 name
  cengsur2: text("cengsur2"), // Engineer 2 surname
  cengname2: text("cengname2"), // Engineer 2 name
  onlinefoldernumber: text("onlinefoldernumber"), // Online folder number
  project: integer("project"), // Legacy project reference (MIS code)
  project_id: integer("project_id").references(() => projects.id, { onDelete: "set null" }), // New project reference by id
  oikonomika: jsonb("oikonomika"), // Financial data - stores multiple payment records
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
}, (table) => ({
  monadaReference: foreignKey({
    columns: [table.monada],
    foreignColumns: [monada.unit],
  }),
  projectReference: foreignKey({
    columns: [table.project],
    foreignColumns: [projects.mis],
  }),
}));

// ==============================================================
// 2. Table Definitions above, Schema Helpers below
// ==============================================================

// Schema definitions for insert operations - used with forms and validation
export const insertUserSchema = createInsertSchema(users);
export const insertUserPreferencesSchema = createInsertSchema(userPreferences);

// Schema for user details JSON structure
export const userDetailsSchema = z.object({
  gender: z.enum(["male", "female"]).optional(),
  specialty: z.string().optional(),
}).optional();

// Extended schemas with additional validation
export const extendedUserSchema = insertUserSchema.extend({
  email: z.string().email("Παρακαλώ εισάγετε ένα έγκυρο email"),
  password: z
    .string()
    .min(6, "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες"),
  name: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  role: z.string().refine((val) => ["admin", "user", "manager"].includes(val), {
    message: "Ο ρόλος πρέπει να είναι admin, user ή manager",
  }),
  details: userDetailsSchema,
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
  secondary_text: z.string().optional(), // Πεδίο για το ελεύθερο κείμενο κάτω από το όνομα
  installment: z.string().default("ΕΦΑΠΑΞ"), // Παλιό πεδίο για συμβατότητα
  installments: z.array(z.string()).default(["ΕΦΑΠΑΞ"]), // Νέο πεδίο για πολλαπλές δόσεις
  installmentAmounts: z.record(z.string(), z.number()).default({ΕΦΑΠΑΞ: 0}), // Πεδίο για ποσά ανά δόση
});

export const insertGeneratedDocumentSchema =
  createInsertSchema(generatedDocuments);

// Schema for signature information
export const signatureSchema = z.object({
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  order: z.string().min(1, "Η εντολή είναι υποχρεωτική"),
  title: z.string().min(1, "Ο τίτλος είναι υποχρεωτικός"),
  degree: z.string().optional(),
  prepose: z.string().optional(),
});

// Extended schema with validation for recipients and signatures
export const extendedGeneratedDocumentSchema =
  insertGeneratedDocumentSchema.extend({
    recipients: z
      .array(recipientSchema)
      .min(1, "Πρέπει να υπάρχει τουλάχιστον ένας παραλήπτης"),
    director_signature: signatureSchema.optional(),
  });

export const insertBudgetHistorySchema = createInsertSchema(budgetHistory);

export const insertProjectHistorySchema = createInsertSchema(projectHistory);

export const insertBudgetNotificationSchema =
  createInsertSchema(budgetNotifications);

export const insertEmployeeSchema = createInsertSchema(employees);

export const insertBeneficiarySchema = createInsertSchema(beneficiaries, {
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  afm: z.string().length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία").regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να περιέχει μόνο αριθμούς"),
});

export const insertBeneficiaryPaymentSchema = createInsertSchema(beneficiaryPayments, {
  unit_code: z.string().min(1, "Η μονάδα είναι υποχρεωτική"),
  na853_code: z.string().min(1, "Ο κωδικός NA853 είναι υποχρεωτικός"),
  expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
  installment: z.string().min(1, "Η δόση είναι υποχρεωτική"),
  amount: z.string().min(1, "Το ποσό είναι υποχρεωτικό"),
});

export const insertProjectIndexSchema = createInsertSchema(projectIndex);
export const insertEventTypeSchema = createInsertSchema(eventTypes);
export const insertExpenditureTypeSchema = createInsertSchema(expenditureTypes);
export const insertKallikratisSchema = createInsertSchema(kallikratis);

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
export type ProjectHistory = typeof projectHistory.$inferSelect;
export type BudgetNotification = typeof budgetNotifications.$inferSelect;
export type AttachmentsRow = typeof attachmentsRows.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type ProjectIndex = typeof projectIndex.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type ExpenditureType = typeof expenditureTypes.$inferSelect;
export type Kallikratis = typeof kallikratis.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type BeneficiaryPayment = typeof beneficiaryPayments.$inferSelect;

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
export type InsertProjectHistory = z.infer<typeof insertProjectHistorySchema>;
export type InsertBudgetNotification = z.infer<
  typeof insertBudgetNotificationSchema
>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertBeneficiary = z.infer<typeof insertBeneficiarySchema>;
export type InsertBeneficiaryPayment = z.infer<typeof insertBeneficiaryPaymentSchema>;
export type Recipient = z.infer<typeof recipientSchema>;

// ==============================================================
// 5. Insert Types above, Custom Types & Interfaces below
// ==============================================================

// Custom types for specific UI and business logic needs

// Financial payment record structure for beneficiaries
export interface BeneficiaryPaymentRecord {
  amount: string;
  status: string | null;
  installment: string[];
  protocol_number: string | null;
}

// Complete financial data structure for beneficiaries
export interface BeneficiaryOikonomika {
  [paymentType: string]: BeneficiaryPaymentRecord[];
}

// Unit name structure
export interface MonadaUnitName {
  name: string;
  prop: string;
}

// Optimized project data from project_index with related tables
export interface OptimizedProject {
  na853: string;
  mis: string;
  budget_na853?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  event_description?: string;
  project_title?: string;
  name?: string;
  event_type: {
    id?: number;
    name?: string;
    description?: string;
  };
  expenditure_type: {
    id?: number;
    name?: string;
  };
  unit: {
    id?: number;
    name?: string;
  };
  region: {
    id?: number;
    region?: string;
    regional_unit?: string;
    municipality?: string;
  };
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
  employees: Employee;
  beneficiaries: Beneficiary;
};
