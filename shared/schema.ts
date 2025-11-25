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
  bigserial,
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
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  unit_id: integer("unit_id").array(),
  telephone: bigint("telephone", { mode: "number" }),
  department: text("department"),
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
  mis: integer("mis").unique(),
  e069: text("e069"),
  na271: text("na271"),
  na853: text("na853").notNull().unique(),
  event_description: text("event_description").notNull().unique(),
  project_title: text("project_title"),
  summary: text("summary"),
  event_year: jsonb("event_year").default([]),
  budget_e069: decimal("budget_e069", { precision: 12, scale: 2 }),
  budget_na271: decimal("budget_na271", { precision: 12, scale: 2 }),
  budget_na853: decimal("budget_na853", { precision: 12, scale: 2 }),
  status: text("status"),
  event_type_id: integer("event_type_id"),
  inc_year: integer("inc_year"), // Έτος Ένταξης (Inclusion Year)
  updates: jsonb("updates").default([]), // Αλλαγές (Changes and Updates)
  created_at: timestamp("created_at"),
  updated_at: timestamp("updated_at"),
});

/**
 * Project Budget Table
 * Stores budget allocation data for projects
 * Updated schema with enhanced precision and foreign key relationships
 */
export const projectBudget = pgTable("project_budget", {
  id: serial("id").primaryKey(),
  na853: text("na853").notNull().unique(),
  mis: integer("mis").unique().notNull(),
  proip: decimal("proip", { precision: 15, scale: 2 }).default("0"),
  ethsia_pistosi: decimal("ethsia_pistosi", {
    precision: 15,
    scale: 2,
  }).default("0"),
  q1: decimal("q1", { precision: 15, scale: 2 }).default("0"),
  q2: decimal("q2", { precision: 15, scale: 2 }).default("0"),
  q3: decimal("q3", { precision: 15, scale: 2 }).default("0"),
  q4: decimal("q4", { precision: 15, scale: 2 }).default("0"),
  katanomes_etous: decimal("katanomes_etous", {
    precision: 15,
    scale: 2,
  }).default("0"),
  user_view: decimal("user_view", { precision: 15, scale: 2 }).default("0"),
  current_quarter_spent: decimal("current_quarter_spent", { precision: 15, scale: 2 }).default("0"),
  year_close: jsonb("year_close"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  last_quarter_check: text("last_quarter_check").default("q1"),
  sum: jsonb("sum"),
  project_id: integer("project_id").references(() => projects.id),
});

/**
 * Budget History Table
 * Tracks changes to budget allocations over time
 * Now references project by id instead of mis
 */
export const budgetHistory = pgTable("budget_history", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  previous_amount: decimal("previous_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  new_amount: decimal("new_amount", { precision: 12, scale: 2 }).notNull(),
  change_type: text("change_type").notNull(),
  change_reason: text("change_reason"),
  document_id: bigint("document_id", { mode: "number" }),
  created_by: bigint("created_by", { mode: "number" }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Project History Table - Simplified Linear Structure
 * Tracks historical changes and versions of project data
 * Simple column-based approach instead of complex JSONB
 */
export const projectHistory = pgTable("project_history", {
  id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
  project_id: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  change_type: text("change_type").notNull(), // "CREATE", "UPDATE", "STATUS_CHANGE"
  change_description: text("change_description"),
  changed_by: integer("changed_by"), // User ID who made the change

  // Core Project Fields (snapshot at time of change)
  project_title: text("project_title"),
  project_description: text("project_description"),
  event_description: text("event_description"),
  status: text("status"),

  // Financial Data
  budget_na853: decimal("budget_na853", { precision: 12, scale: 2 }),
  budget_na271: decimal("budget_na271", { precision: 12, scale: 2 }),
  budget_e069: decimal("budget_e069", { precision: 12, scale: 2 }),

  // SA Codes
  na853: text("na853"),
  na271: text("na271"),
  e069: text("e069"),

  // Event Information
  event_type_id: integer("event_type_id").references(() => eventTypes.id),
  event_year: text("event_year"), // JSON array as text for multiple years

  // Document References (for decisions/documents that triggered this change)
  protocol_number: text("protocol_number"),
  fek: jsonb("fek"),
  ada: text("ada"),

  // Location (simplified - main location only)
  region: text("region"),
  regional_unit: text("regional_unit"),
  municipality: text("municipality"),

  // Implementation
  implementing_agency_id: integer("implementing_agency_id").references(
    () => monada.id,
  ),
  implementing_agency_name: text("implementing_agency_name"),

  // Additional Fields
  expenses_executed: decimal("expenses_executed", { precision: 12, scale: 2 }),
  project_status: text("project_status"),
  enumeration_code: text("enumeration_code"),
  inclusion_year: integer("inclusion_year"),

  // Summary and Comments
  summary_description: text("summary_description"),
  change_comments: text("change_comments"),

  // Previous state (for comparison)
  previous_status: text("previous_status"),
  previous_budget_na853: decimal("previous_budget_na853", {
    precision: 12,
    scale: 2,
  }),
  previous_budget_na271: decimal("previous_budget_na271", {
    precision: 12,
    scale: 2,
  }),
  previous_budget_e069: decimal("previous_budget_e069", {
    precision: 12,
    scale: 2,
  }),
});

/**
 * Budget Notifications Table
 * Stores budget-related notifications and alerts
 * Now references project by id instead of mis
 */
export const budgetNotifications = pgTable("budget_notifications", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
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
 * Enhanced structure with proper foreign key relationships
 * Matches the enhanced database schema provided by user
 */
export const generatedDocuments = pgTable("generated_documents", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  generated_by: integer("generated_by").references(() => users.id),
  protocol_date: date("protocol_date"),
  total_amount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default("pending"),
  protocol_number_input: text("protocol_number_input").unique(),
  original_protocol_number: varchar("original_protocol_number", {
    length: 255,
  }),
  original_protocol_date: date("original_protocol_date"),
  is_correction: boolean("is_correction").default(false),
  is_returned: boolean("is_returned").default(false),
  comments: text("comments"),
  updated_by: text("updated_by"),
  updated_at: timestamp("updated_at", { withTimezone: true }),
  esdian: text("esdian").array(),
  director_signature: jsonb("director_signature"),
  beneficiary_payments_id: integer("beneficiary_payments_id").array(),
  employee_payments_id: integer("employee_payments_id").array(),

  // Enhanced foreign key relationships
  attachment_id: integer("attachment_id").array(), // Array of attachment IDs
  project_index_id: integer("project_index_id").references(
    () => projectIndex.id,
  ),
  unit_id: bigint("unit_id", { mode: "number" }).references(() => monada.id),
  region: jsonb("region"), // Geographic region data (region, unit, municipality)
});

/**
 * Attachments Table
 * Stores attachment metadata with expenditure type associations
 */
export const attachmentsRows = pgTable("attachments", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  atachments: text("atachments"), // Note: keeping the typo from the database schema
  expenditure_type_id: integer("expenditure_type_id").array(),
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
  id: bigint("id", { mode: "number" }).primaryKey(),
  unit: text("unit"),
  unit_name: jsonb("unit_name"),
  parts: jsonb("parts"),
  email: text("email"),
  director: jsonb("director"),
  address: jsonb("address"),
});

/**
 * Employees Table
 * Contains employee information for autocomplete and recipient management
 */
export const employees = pgTable(
  "Employees",
  {
    id: serial("id").primaryKey(),
    surname: text("surname"),
    name: text("name"),
    fathername: text("fathername"),
    afm: text("afm"),
    afm_hash: text("afm_hash"),
    klados: text("klados"),
    attribute: text("attribute"),
    workaf: text("workaf"),
    monada: text("monada"),
  },
  (table) => ({
    monadaReference: foreignKey({
      columns: [table.monada],
      foreignColumns: [monada.unit],
    }),
    afmHashIndex: index("idx_employees_afm_hash").on(table.afm_hash),
  }),
);

/**
 * Beneficiaries Table (Clean normalized structure)
 * Contains basic beneficiary information
 */
export const beneficiaries = pgTable(
  "beneficiaries",
  {
    id: serial("id").primaryKey(),
    afm: text("afm").notNull(), // Tax ID (AFM) - encrypted, no longer unique
    afm_hash: text("afm_hash").notNull().unique(), // Hash for uniqueness and search
    surname: text("surname").notNull(),
    name: text("name").notNull(),
    fathername: text("fathername"),
    region: text("region"),
    adeia: integer("adeia"), // License/permit number
    ceng1: integer("ceng1").references(() => employees.id), // Engineer 1 foreign key
    ceng2: integer("ceng2").references(() => employees.id), // Engineer 2 foreign key
    onlinefoldernumber: text("onlinefoldernumber"), // Online folder number
    freetext: text("freetext"), // Additional free text
    regiondet: jsonb("regiondet"), // Region details as JSON
    date: date("date").defaultNow(),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    afmHashIndex: index("idx_beneficiaries_afm_hash").on(table.afm_hash),
  })
);

/**
 * Beneficiary Payments Table (Replaces oikonomika JSONB)
 * Enhanced normalized financial data with proper foreign key relationships
 * Now references project_index.id for faster querying
 */
export const beneficiaryPayments = pgTable(
  "beneficiary_payments",
  {
    id: serial("id").primaryKey(),
    beneficiary_id: integer("beneficiary_id").references(
      () => beneficiaries.id,
      { onDelete: "cascade" },
    ),
    installment: text("installment").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }),
    status: text("status").default("pending"),
    payment_date: date("payment_date"),
    freetext: text("freetext"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),

    // Enhanced foreign key relationships using project_index.id
    unit_id: bigint("unit_id", { mode: "number" }).references(() => monada.id),
    document_id: bigint("document_id", { mode: "number" }).references(
      () => generatedDocuments.id,
    ),
    project_index_id: integer("project_index_id").references(
      () => projectIndex.id,
    ),
  },
  (table) => ({
    // Index on status for pending records performance optimization
    pendingStatusIndex: index("idx_beneficiary_payments_pending")
      .on(table.status)
      .where(sql`${table.status} = 'pending'`),
    uniqueId: unique("beneficiary_payments_id_key").on(table.id),
  }),
);

/**
 * Employee Payments Table
 * Stores ΕΚΤΟΣ ΕΔΡΑΣ payment information for employees
 */
export const employeePayments = pgTable(
  "EmployeePayments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    employee_id: bigint("employee_id", { mode: "number" })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    document_id: bigint("document_id", { mode: "number" }).references(
      () => generatedDocuments.id,
      { onDelete: "cascade" },
    ),
    month: text("month").notNull(),
    days: integer("days").notNull().default(1),
    daily_compensation: decimal("daily_compensation", {
      precision: 10,
      scale: 2,
    }).default("0.00"),
    accommodation_expenses: decimal("accommodation_expenses", {
      precision: 10,
      scale: 2,
    }).default("0.00"),
    kilometers_traveled: decimal("kilometers_traveled", {
      precision: 10,
      scale: 2,
    }).default("0.00"),
    price_per_km: decimal("price_per_km", { precision: 10, scale: 2 }).default(
      "0.20",
    ),
    tickets_tolls_rental: decimal("tickets_tolls_rental", {
      precision: 10,
      scale: 2,
    }).default("0.00"),
    tickets_tolls_rental_entries: jsonb("tickets_tolls_rental_entries"), // Array of individual ticket/toll/rental amounts
    has_2_percent_deduction: boolean("has_2_percent_deduction").default(false),
    total_expense: decimal("total_expense", {
      precision: 10,
      scale: 2,
    }).default("0.00"),
    deduction_2_percent: decimal("deduction_2_percent", {
      precision: 10,
      scale: 2,
    }).default("0.00"),
    net_payable: decimal("net_payable", { precision: 10, scale: 2 }).default(
      "0.00",
    ),
    status: text("status").default("pending"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    employeeIdIndex: index("idx_employee_payments_employee_id").on(
      table.employee_id,
    ),
    documentIdIndex: index("idx_employee_payments_document_id").on(
      table.document_id,
    ),
    monthIndex: index("idx_employee_payments_month").on(table.month),
    statusIndex: index("idx_employee_payments_status").on(table.status),
  }),
);

/**
 * User Preferences Table
 * Stores user preferences including frequently used Internal Distribution options
 */
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
 * Enhanced with identity column for faster references
 */
export const projectIndex = pgTable(
  "project_index",
  {
    id: serial("id").primaryKey(), // Auto-increment identity column for fast references
    project_id: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    monada_id: integer("monada_id")
      .notNull()
      .references(() => monada.id), // NOT NULL - matches actual database schema
    event_types_id: integer("event_types_id")
      .notNull()
      .references(() => eventTypes.id), // NOT NULL - matches actual database schema
    expenditure_type_id: integer("expenditure_type_id")
      .notNull()
      .references(() => expenditureTypes.id), // NOT NULL - matches actual database schema
    // NOTE: kallikratis_id and geographic_code columns don't exist in actual database
    // Geographic data should be stored in a separate table or handled differently
  },
  (table) => ({
    // Create unique constraint on id
    uniqueId: unique("project_index_id_key").on(table.id),
    // NOTE: Removed project_index_context_unique constraint to allow multiple geographic areas
    // per project+agency+event+expenditure combination. Geographic uniqueness is handled
    // by separate relationship tables (project_index_regions, project_index_units, project_index_munis)
    // Performance indexes - matching actual database
    projectMonadaIndex: index("idx_project_index_project_monada").on(
      table.project_id,
      table.monada_id,
    ),
    projectIdIndex: index("idx_project_index_project_id").on(table.project_id),
    monadaIdIndex: index("idx_project_index_monada_id").on(table.monada_id),
    eventTypesIndex: index("idx_project_index_event_types_id").on(
      table.event_types_id,
    ),
    expenditureTypeIndex: index("idx_project_index_expediture_type_id").on(
      table.expenditure_type_id,
    ),
  }),
);

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
export const expenditureTypes = pgTable("expenditure_types", {
  id: serial("id").primaryKey(),
  expenditure_types: text("expenditure_types").notNull(),
  expenditure_types_minor: text("expenditure_types_minor"),
});

/**
 * Regions Table - New normalized geographic structure
 * Greek administrative regions (Περιφέρειες)
 */
export const regions = pgTable("regions", {
  code: bigint("code", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
});

/**
 * Regional Units Table - New normalized geographic structure
 * Greek regional units (Περιφερειακές Ενότητες)
 */
export const regionalUnits = pgTable("regional_units", {
  code: bigint("code", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  region_code: bigint("region_code", { mode: "number" })
    .notNull()
    .references(() => regions.code),
});

/**
 * Municipalities Table - New normalized geographic structure
 * Greek municipalities (Δήμοι)
 */
export const municipalities = pgTable("municipalities", {
  code: bigint("code", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  unit_code: bigint("unit_code", { mode: "number" })
    .notNull()
    .references(() => regionalUnits.code),
});

/**
 * Subprojects Table
 * Contains subproject information scoped to EPA versions only
 */
export const subprojects = pgTable(
  "Subprojects",
  {
    id: serial("id").primaryKey(),
    epa_version_id: integer("epa_version_id")
      .notNull()
      .references(() => projectBudgetVersions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    epaVersionIndex: index("idx_subprojects_epa_version_id").on(
      table.epa_version_id,
    ),
  }),
);

/**
 * Subproject Financials Table
 * Stores per-year financial data for each subproject
 */
export const subprojectFinancials = pgTable(
  "subproject_financials",
  {
    id: serial("id").primaryKey(),
    subproject_id: integer("subproject_id")
      .notNull()
      .references(() => subprojects.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    total_public: decimal("total_public", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    eligible_public: decimal("eligible_public", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    subprojectIdIndex: index("idx_subproject_financials_subproject_id").on(
      table.subproject_id,
    ),
    yearIndex: index("idx_subproject_financials_year").on(table.year),
    uniqueSubprojectYear: sql`UNIQUE(subproject_id, year)`,
    totalPublicCheck: sql`CHECK (total_public >= 0)`,
    eligiblePublicCheck: sql`CHECK (eligible_public >= 0)`,
    eligibleLessThanTotalCheck: sql`CHECK (eligible_public <= total_public)`,
  }),
);

/**
 * Project Index Geographic Junction Tables
 * Links project_index entries to specific geographic entities
 */
export const projectIndexRegions = pgTable(
  "project_index_regions",
  {
    project_index_id: integer("project_index_id")
      .notNull()
      .references(() => projectIndex.id, { onDelete: "cascade" }),
    region_code: bigint("region_code", { mode: "number" })
      .notNull()
      .references(() => regions.code, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.project_index_id, table.region_code] }),
    projectIndexIndex: index("idx_pir_pi").on(table.project_index_id),
  }),
);

export const projectIndexUnits = pgTable(
  "project_index_units",
  {
    project_index_id: integer("project_index_id")
      .notNull()
      .references(() => projectIndex.id, { onDelete: "cascade" }),
    unit_code: bigint("unit_code", { mode: "number" })
      .notNull()
      .references(() => regionalUnits.code, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.project_index_id, table.unit_code] }),
    projectIndexIndex: index("idx_piu_pi").on(table.project_index_id),
  }),
);

export const projectIndexMunis = pgTable(
  "project_index_munis",
  {
    project_index_id: integer("project_index_id")
      .notNull()
      .references(() => projectIndex.id, { onDelete: "cascade" }),
    muni_code: bigint("muni_code", { mode: "number" })
      .notNull()
      .references(() => municipalities.code, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.project_index_id, table.muni_code] }),
    projectIndexIndex: index("idx_pim_pi").on(table.project_index_id),
  }),
);

/**
 * Normalized Project Decisions Table - "Αποφάσεις που τεκμηριώνουν το έργο"
 * Separate table for project decisions with proper foreign key relationships
 */
export const projectDecisions = pgTable(
  "project_decisions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    project_id: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Decision identification
    decision_sequence: integer("decision_sequence").notNull().default(1),
    decision_type: text("decision_type").notNull().default("Έγκριση"), // Έγκριση, Τροποποίηση, Παράταση

    // Document references
    protocol_number: text("protocol_number"),
    fek: jsonb("fek"),
    ada: text("ada"),

    // Decision details
    implementing_agency: integer("implementing_agency").array(),
    decision_budget: decimal("decision_budget", { precision: 12, scale: 2 }),
    expenditure_type: integer("expenditure_type").array(),
    decision_date: date("decision_date"),

    // Status and metadata
    included: boolean("included").notNull().default(true),
    is_active: boolean("is_active").default(true),
    comments: text("comments"),

    // Additional document references
    budget_decision: text("budget_decision"),
    funding_decision: text("funding_decision"),
    allocation_decision: text("allocation_decision"),

    // Audit fields
    created_by: integer("created_by"),
    updated_by: integer("updated_by"),
  },
  (table) => ({
    // Ensure unique sequence per project
    uniqueProjectSequence: unique().on(
      table.project_id,
      table.decision_sequence,
    ),
  }),
);

/**
 * Normalized Project Formulations Table - "Στοιχεία κατάρτισης έργου"
 * Separate table for project formulations that can link to decisions
 */
export const projectFormulations = pgTable(
  "project_formulations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    project_id: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    decision_id: bigint("decision_id", { mode: "number" }).references(
      () => projectDecisions.id,
      { onDelete: "set null" },
    ),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Formulation identification
    formulation_sequence: integer("formulation_sequence").notNull().default(1),

    // SA type and codes
    sa_type: text("sa_type").notNull(), // CHECK constraint: ΝΑ853, ΝΑ271, E069
    enumeration_code: text("enumeration_code"),

    // Decision references (can link to external decisions too)
    protocol_number: text("protocol_number"),
    ada: text("ada"),
    decision_year: integer("decision_year"),

    // Financial data
    project_budget: decimal("project_budget", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total_public_expense: decimal("total_public_expense", {
      precision: 12,
      scale: 2,
    }),
    eligible_public_expense: decimal("eligible_public_expense", {
      precision: 12,
      scale: 2,
    }),

    // EPA and status
    epa_version: text("epa_version"),
    decision_status: text("decision_status").default("Ενεργή"),
    change_type: text("change_type").default("Έγκριση"),

    // Connected decisions (can reference multiple decision IDs)
    connected_decision_ids: integer("connected_decision_ids").array(),

    // Comments and metadata
    comments: text("comments"),
    is_active: boolean("is_active").default(true),

    // Audit fields
    created_by: integer("created_by"),
    updated_by: integer("updated_by"),
  },
  (table) => ({
    // Ensure unique sequence per project
    uniqueProjectSequence: unique().on(
      table.project_id,
      table.formulation_sequence,
    ),
  }),
);

/**
 * Project Budget Versions Table
 * Junction table for storing ΠΔΕ and ΕΠΑ budget versions for each enumeration code
 * Links to project formulations to support multiple budget versions per SA type
 */
export const projectBudgetVersions = pgTable(
  "project_budget_versions",
  {
    id: serial("id").primaryKey(),
    project_id: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    formulation_id: bigint("formulation_id", { mode: "number" }).references(
      () => projectFormulations.id,
      { onDelete: "cascade" },
    ),

    // Budget version type: "ΠΔΕ" or "ΕΠΑ"
    budget_type: text("budget_type").notNull(), // "ΠΔΕ" | "ΕΠΑ"

    // Version identification
    version_number: decimal("version_number", {
      precision: 3,
      scale: 1,
    }).default("1.0"), // Sortable version number (e.g., 1.0, 1.1, 2.0)

    // ΠΔΕ specific fields
    boundary_budget: decimal("boundary_budget", { precision: 12, scale: 2 }), // Προϋπολογισμός Οριοθέτησης

    // ΕΠΑ specific fields
    epa_version: text("epa_version"),

    // Document references
    protocol_number: text("protocol_number"),
    ada: text("ada"),
    decision_date: date("decision_date"),

    // Action details (renamed from decision_type)
    action_type: text("action_type").default("Έγκριση"), // Είδος Πράξης: Έγκριση, Τροποποίηση, Κλείσιμο στο ύψος πληρωμών

    // Metadata
    comments: text("comments"),

    // Audit fields
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
    created_by: integer("created_by"),
    updated_by: integer("updated_by"),
  },
  (table) => ({
    // Indexes for performance
    projectIdIndex: index("idx_budget_versions_project_id").on(
      table.project_id,
    ),
    formulationIdIndex: index("idx_budget_versions_formulation_id").on(
      table.formulation_id,
    ),
    budgetTypeIndex: index("idx_budget_versions_budget_type").on(
      table.budget_type,
    ),
    // Constraint for boundary_budget >= 0
    boundaryBudgetCheck: sql`CHECK (boundary_budget >= 0 OR boundary_budget IS NULL)`,
  }),
);

/**
 * EPA Financials Table
 * Stores financial data for EPA budget versions by year
 * Each EPA version can have multiple financial entries (one per year)
 */
export const epaFinancials = pgTable(
  "epa_financials",
  {
    id: serial("id").primaryKey(),
    epa_version_id: integer("epa_version_id")
      .notNull()
      .references(() => projectBudgetVersions.id, { onDelete: "cascade" }),
    year: integer("year").notNull(), // Έτος - unique per EPA version
    total_public_expense: decimal("total_public_expense", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"), // Συνολική Δημόσια Δαπάνη ≥ 0
    eligible_public_expense: decimal("eligible_public_expense", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"), // Επιλέξιμη Δημόσια Δαπάνη ≥ 0, ≤ Συνολική

    // Audit fields
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    // Unique constraint: one financial record per EPA version per year
    uniqueEpaVersionYear: unique("unique_epa_version_year").on(
      table.epa_version_id,
      table.year,
    ),

    // Business constraints
    totalExpenseCheck: sql`CHECK (total_public_expense >= 0)`,
    eligibleExpenseCheck: sql`CHECK (eligible_public_expense >= 0)`,
    eligibleLteTotalCheck: sql`CHECK (eligible_public_expense <= total_public_expense)`,

    // Indexes for performance
    epaVersionIdIndex: index("idx_epa_financials_version_id").on(
      table.epa_version_id,
    ),
    yearIndex: index("idx_epa_financials_year").on(table.year),
  }),
);

// ==============================================================
// 2. Table Definitions above, Schema Helpers below
// ==============================================================

// Schema definitions for insert operations - used with forms and validation
export const insertUserSchema = createInsertSchema(users);
export const insertUserPreferencesSchema = createInsertSchema(userPreferences);

// Schema for user details JSON structure
export const userDetailsSchema = z
  .object({
    gender: z.enum(["male", "female"]).optional(),
    specialty: z.string().optional(),
  })
  .optional();

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
  telephone: z
    .number()
    .int()
    .positive("Το τηλέφωνο πρέπει να είναι θετικός αριθμός")
    .optional()
    .nullable(), // Telephone as numeric field
  details: userDetailsSchema,
});

export const insertProjectSchema = createInsertSchema(projects);

export const insertProjectCatalogSchema = createInsertSchema(projectCatalog);

export const insertProjectFormulationSchema =
  createInsertSchema(projectFormulations);

export const insertProjectBudgetVersionSchema = createInsertSchema(
  projectBudgetVersions,
);

export const insertEpaFinancialsSchema = createInsertSchema(epaFinancials);

// Enhanced schema for budget versions with validation
export const budgetVersionSchema = insertProjectBudgetVersionSchema.extend({
  budget_type: z.enum(["ΠΔΕ", "ΕΠΑ"], {
    required_error: "Ο τύπος προϋπολογισμού είναι υποχρεωτικός",
  }),
  boundary_budget: z.string().optional(), // For PDE - Προϋπολογισμός Οριοθέτησης
  action_type: z
    .enum(["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"])
    .default("Έγκριση"), // Είδος Πράξης
});

// Schema for EPA financials with validation
export const epaFinancialsSchema = insertEpaFinancialsSchema.extend({
  year: z.number().int().min(2000).max(2100, "Το έτος πρέπει να είναι έγκυρο"),
  total_public_expense: z.string().optional().default("0"),
  eligible_public_expense: z.string().optional().default("0"),
});

// Schema for document recipients
export const recipientSchema = z.object({
  id: z.number().optional(), // For existing beneficiary/employee payment records
  employee_id: z.number().optional(), // For linking to employees table (ΕΚΤΟΣ ΕΔΡΑΣ)
  beneficiary_id: z.number().optional(), // For linking to beneficiaries table
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
  installmentAmounts: z.record(z.string(), z.number()).default({ ΕΦΑΠΑΞ: 0 }), // Πεδίο για ποσά ανά δόση
  status: z.string().optional(), // For payment status
  // Employee payment fields (ΕΚΤΟΣ ΕΔΡΑΣ only)
  month: z.string().optional(),
  days: z.number().optional(),
  daily_compensation: z.number().optional(),
  accommodation_expenses: z.number().optional(),
  kilometers_traveled: z.number().optional(),
  price_per_km: z.number().optional(),
  tickets_tolls_rental: z.number().optional(),
  tickets_tolls_rental_entries: z.array(z.number()).optional().default([]), // Array of individual amounts
  has_2_percent_deduction: z.boolean().optional(),
  total_expense: z.number().optional(),
  deduction_2_percent: z.number().optional(),
  net_payable: z.number().optional(),
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

// Schema for editing documents - more permissive validation than creation
export const editDocumentSchema = insertGeneratedDocumentSchema
  .omit({ 
    id: true,
    created_at: true, 
    updated_at: true,
  })
  .extend({
    protocol_number_input: z.string().optional(),
    protocol_date: z.string().optional(),
    status: z.enum(["draft", "pending", "approved", "rejected", "completed"]).optional(),
    comments: z.string().optional(),
    total_amount: z.number().min(0).optional(),
    esdian_field1: z.string().optional(),
    esdian_field2: z.string().optional(),
    is_correction: z.boolean().default(false),
    original_protocol_number: z.string().optional(),
    original_protocol_date: z.string().optional(),
    correction_reason: z.string().optional(),
    recipients: z.array(recipientSchema).default([]),
    project_index_id: z.number().optional(),
    unit_id: z.number().optional(),
    expenditure_type_id: z.number().optional(),
    region: z.object({
      region_code: z.number().optional(),
      region_name: z.string().optional(),
      unit_code: z.number().optional(),
      unit_name: z.string().optional(),
      municipality_code: z.number().optional(),
      municipality_name: z.string().optional(),
    }).optional(),
  });

// Schema for correction mode - requires correction reason
export const correctionDocumentSchema = editDocumentSchema.extend({
  is_correction: z.literal(true),
  correction_reason: z.string().min(1, "Ο λόγος διόρθωσης είναι υποχρεωτικός"),
});

export const insertBudgetHistorySchema = createInsertSchema(budgetHistory);

export const insertProjectHistorySchema = createInsertSchema(projectHistory);

export const insertBudgetNotificationSchema =
  createInsertSchema(budgetNotifications);

export const insertEmployeeSchema = createInsertSchema(employees);

export const insertBeneficiarySchema = createInsertSchema(beneficiaries, {
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  afm: z
    .string()
    .length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    .regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να περιέχει μόνο αριθμούς"),
});

export const insertBeneficiaryPaymentSchema = createInsertSchema(
  beneficiaryPayments,
  {
    installment: z.string().min(1, "Η δόση είναι υποχρεωτική"),
    amount: z.string().min(1, "Το ποσό είναι υποχρεωτικό"),
  },
);

export const insertEmployeePaymentSchema = createInsertSchema(employeePayments, {
  month: z.string().min(1, "Ο μήνας είναι υποχρεωτικός"),
  days: z.number().int().min(1, "Οι ημέρες πρέπει να είναι τουλάχιστον 1"),
});

export const insertProjectBudgetSchema = createInsertSchema(projectBudget);

export const insertProjectIndexSchema = createInsertSchema(projectIndex);
export const insertEventTypeSchema = createInsertSchema(eventTypes);
export const insertExpenditureTypeSchema = createInsertSchema(expenditureTypes);

// Subprojects schemas
export const insertSubprojectSchema = createInsertSchema(subprojects);
export const insertSubprojectFinancialsSchema =
  createInsertSchema(subprojectFinancials);

// Enhanced subprojects schema with validation for form handling
export const subprojectFormSchema = insertSubprojectSchema
  .extend({
    title: z.string().min(1, "Ο τίτλος υποέργου είναι υποχρεωτικός"),
    status: z
      .enum(["Συνεχιζόμενο", "Σε αναμονή", "Ολοκληρωμένο"])
      .default("Συνεχιζόμενο"),
    description: z.string().optional(),
  })
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

export const subprojectFinancialsFormSchema = insertSubprojectFinancialsSchema
  .extend({
    year: z.number().int().min(2020, "Έτος πρέπει να είναι μετά το 2020"),
    total_public: z
      .string()
      .min(1, "Συνολική δημόσια δαπάνη είναι υποχρεωτική"),
    eligible_public: z
      .string()
      .min(1, "Επιλέξιμη δημόσια δαπάνη είναι υποχρεωτική"),
  })
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

// New geographic table schemas
export const insertRegionSchema = createInsertSchema(regions);
export const insertRegionalUnitSchema = createInsertSchema(regionalUnits);
export const insertMunicipalitySchema = createInsertSchema(municipalities);

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
export type ProjectBudget = typeof projectBudget.$inferSelect;
export type BudgetHistory = typeof budgetHistory.$inferSelect;
export type ProjectHistory = typeof projectHistory.$inferSelect;
export type BudgetNotification = typeof budgetNotifications.$inferSelect;
export type AttachmentsRow = typeof attachmentsRows.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type ProjectIndex = typeof projectIndex.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type ExpenditureType = typeof expenditureTypes.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type Subproject = typeof subprojects.$inferSelect;
export type SubprojectFinancials = typeof subprojectFinancials.$inferSelect;
export type ProjectDecision = typeof projectDecisions.$inferSelect;
export type ProjectFormulation = typeof projectFormulations.$inferSelect;

// New geographic entity types
export type Region = typeof regions.$inferSelect;
export type RegionalUnit = typeof regionalUnits.$inferSelect;
export type Municipality = typeof municipalities.$inferSelect;

export type Employee = typeof employees.$inferSelect;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type BeneficiaryPayment = typeof beneficiaryPayments.$inferSelect;
export type EmployeePayment = typeof employeePayments.$inferSelect;

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
export type InsertBeneficiaryPayment = z.infer<
  typeof insertBeneficiaryPaymentSchema
>;
export type InsertEmployeePayment = z.infer<typeof insertEmployeePaymentSchema>;
export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type Recipient = z.infer<typeof recipientSchema>;

// Subprojects insert types
export type InsertSubproject = z.infer<typeof insertSubprojectSchema>;
export type InsertSubprojectFinancials = z.infer<
  typeof insertSubprojectFinancialsSchema
>;
export type SubprojectFormData = z.infer<typeof subprojectFormSchema>;

// New geographic insert types
export type InsertRegion = z.infer<typeof insertRegionSchema>;
export type InsertRegionalUnit = z.infer<typeof insertRegionalUnitSchema>;
export type InsertMunicipality = z.infer<typeof insertMunicipalitySchema>;

// ==============================================================
// 5. Insert Types above, Custom Types & Interfaces below
// ==============================================================

// Custom types for specific UI and business logic needs

// Financial payment record structure for beneficiaries
export interface BeneficiaryPaymentRecord {
  id: number;
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
  id: number;
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

// ==============================================================
// 7. TypeScript Types for new tables
// ==============================================================

export type ProjectBudgetVersion = InferSelectModel<
  typeof projectBudgetVersions
>;
export type InsertProjectBudgetVersion = InferInsertModel<
  typeof projectBudgetVersions
>;

export type EpaFinancials = InferSelectModel<typeof epaFinancials>;
export type InsertEpaFinancials = InferInsertModel<typeof epaFinancials>;

// Enhanced types for forms
export type BudgetVersionFormData = z.infer<typeof budgetVersionSchema>;
export type EpaFinancialsFormData = z.infer<typeof epaFinancialsSchema>;

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
  projectBudget: typeof projectBudget.$inferSelect;
  budgetHistory: typeof budgetHistory.$inferSelect;
  budgetNotifications: typeof budgetNotifications.$inferSelect;
  attachmentsRows: typeof attachmentsRows.$inferSelect;
  documentVersions: typeof documentVersions.$inferSelect;
  documentTemplates: typeof documentTemplates.$inferSelect;
  monada: Monada;
  projects: Project;
  employees: Employee;
  beneficiaries: Beneficiary;
  eventTypes: EventType;
  expenditureTypes: ExpenditureType;
  Employees: typeof employees.$inferSelect;
  Monada: typeof monada.$inferSelect;
};
