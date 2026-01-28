/**
 * Schema Validation Middleware
 * Provides comprehensive request validation against database schema
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  users,
  projects,
  projectBudget,
  generatedDocuments,
  beneficiaries,
  beneficiaryPayments,
  projectHistory,
  budgetHistory,
  userPreferences,
  projectIndex,
} from "../../shared/schema";

// Create Zod schemas from Drizzle tables
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);

export const insertProjectBudgetSchema = createInsertSchema(projectBudget);
export const selectProjectBudgetSchema = createSelectSchema(projectBudget);

export const insertGeneratedDocumentSchema =
  createInsertSchema(generatedDocuments);
export const selectGeneratedDocumentSchema =
  createSelectSchema(generatedDocuments);

export const insertBeneficiarySchema = createInsertSchema(beneficiaries);
export const selectBeneficiarySchema = createSelectSchema(beneficiaries);

export const insertBeneficiaryPaymentSchema =
  createInsertSchema(beneficiaryPayments);
export const selectBeneficiaryPaymentSchema =
  createSelectSchema(beneficiaryPayments);

export const insertProjectHistorySchema = createInsertSchema(projectHistory);
export const selectProjectHistorySchema = createSelectSchema(projectHistory);

export const insertBudgetHistorySchema = createInsertSchema(budgetHistory);
export const selectBudgetHistorySchema = createSelectSchema(budgetHistory);

export const insertUserPreferenceSchema = createInsertSchema(userPreferences);
export const selectUserPreferenceSchema = createSelectSchema(userPreferences);

export const insertProjectIndexSchema = createInsertSchema(projectIndex);
export const selectProjectIndexSchema = createSelectSchema(projectIndex);

// Validation middleware factory
export function validateSchema(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = schema.safeParse(req.body);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((error) => ({
          field: error.path.join("."),
          message: error.message,
          code: error.code,
        }));

        return res.status(400).json({
          status: "error",
          message: "Validation failed",
          errors,
          timestamp: new Date().toISOString(),
        });
      }

      // Add validated data to request
      req.validatedData = validationResult.data;
      next();
    } catch (error) {
      console.error("[SchemaValidation] Validation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Internal validation error",
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Validation middleware for query parameters
export function validateQueryParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = schema.safeParse(req.query);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((error) => ({
          field: error.path.join("."),
          message: error.message,
          code: error.code,
        }));

        return res.status(400).json({
          status: "error",
          message: "Query parameter validation failed",
          errors,
          timestamp: new Date().toISOString(),
        });
      }

      // Add validated query to request
      req.validatedQuery = validationResult.data;
      next();
    } catch (error) {
      console.error("[SchemaValidation] Query validation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Internal query validation error",
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Common validation schemas for API operations
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const idParamSchema = z.object({
  id: z.coerce.number().positive(),
});

export const misParamSchema = z.object({
  mis: z.union([z.coerce.number(), z.string()]),
});

// Enhanced error response formatting
export function formatValidationError(error: z.ZodError) {
  return {
    status: "error",
    message: "Validation failed",
    errors: error.errors.map((err: any) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
      received: err.received,
    })),
    timestamp: new Date().toISOString(),
  };
}

// Database constraint validation
export function validateDatabaseConstraints(tableName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req.validatedData || req.body;

    // Common constraint validations
    const errors: Array<{ field: string; message: string }> = [];

    // Check for required foreign keys based on table
    switch (tableName) {
      case "projects":
        if (!data.na853) {
          errors.push({ field: "na853", message: "NA853 code is required" });
        }
        if (!data.event_description) {
          errors.push({
            field: "event_description",
            message: "Event description is required",
          });
        }
        break;

      case "beneficiary_payments":
        if (!data.beneficiary_id) {
          errors.push({
            field: "beneficiary_id",
            message: "Beneficiary ID is required",
          });
        }
        if (!data.amount || data.amount <= 0) {
          errors.push({ field: "amount", message: "Amount must be positive" });
        }
        break;

      case "generated_documents":
        if (!data.generated_by) {
          errors.push({
            field: "generated_by",
            message: "Generated by user ID is required",
          });
        }
        break;

      case "budget_history":
        if (!data.project_id) {
          errors.push({
            field: "project_id",
            message: "Project ID is required",
          });
        }
        if (!data.change_type) {
          errors.push({
            field: "change_type",
            message: "Change type is required",
          });
        }
        break;
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Database constraint validation failed",
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

// Type augmentation for Express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedData?: any;
      validatedQuery?: any;
    }
  }
}
