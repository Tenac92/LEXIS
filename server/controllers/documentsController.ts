import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { AuthenticatedRequest } from "../authentication";
import { authenticateSession } from "../authentication";
import { DocumentGenerator } from "../utils/document-generator";
import { broadcastDocumentUpdate, broadcastDashboardRefresh } from "../websocket";
import { createLogger } from "../utils/logger";
import { storage } from "../storage";
import { encryptAFM, hashAFM, decryptAFM } from "../utils/crypto";
import { validateBudgetAllocation } from "../services/budgetNotificationService";
import { mergeRegiondetWithPayments } from "../utils/regiondet-merge";
import { buildBeneficiaryRecipientSyncPlan } from "../utils/beneficiary-recipient-sync";
import JSZip from "jszip";

const logger = createLogger("DocumentsController");

// Create the router
export const router = Router();

const extractCorrectionReason = (doc: any): string | undefined => {
  const directReason =
    typeof doc?.correction_reason === "string"
      ? doc.correction_reason.trim()
      : "";

  if (directReason) {
    return directReason;
  }

  if (typeof doc?.comments === "string") {
    const match = doc.comments.match(/Λόγος Διόρθωσης:\s*([^\n\r]+)/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
};

// Export the router as default
// Debug endpoint to check expenditure type data
router.get("/debug-expenditure/:docId", async (req: Request, res: Response) => {
  try {
    const docId = parseInt(req.params.docId);

    // Get document with project_index_id
    const { data: doc, error: docError } = await supabase
      .from("generated_documents")
      .select("id, project_index_id")
      .eq("id", docId)
      .single();

    if (docError || !doc) {
      return res.json({ error: "Document not found", docError });
    }

    let projectIndexData = null;
    let expenditureTypeData = null;

    if (doc.project_index_id) {
      // Get project index data
      const { data: indexData, error: indexError } = await supabase
        .from("project_index")
        .select("id, project_id, expenditure_type_id")
        .eq("id", doc.project_index_id)
        .single();

      projectIndexData = { indexData, indexError };

      if (indexData && indexData.expenditure_type_id) {
        // Get expenditure type data
        const { data: expTypeData, error: expTypeError } = await supabase
          .from("expenditure_types")
          .select("id, expenditure_types")
          .eq("id", indexData.expenditure_type_id)
          .single();

        expenditureTypeData = { expTypeData, expTypeError };
      }
    }

    res.json({
      document: doc,
      projectIndex: projectIndexData,
      expenditureType: expenditureTypeData,
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

/**
 * POST /api/documents
 * Direct document creation route (V1)
 * Priority route that handles document creation from the main application
 */
router.post(
  "/",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Request logging removed for cleaner console output

      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const {
        unit,
        project_id,
        expenditure_type,
        recipients,
        total_amount,
        esdian_field1,
        esdian_field2,
      } = req.body;

      if (!recipients?.length || !project_id || !unit || !expenditure_type) {
        return res.status(400).json({
          message:
            "Missing required fields: recipients, project_id, unit, and expenditure_type are required",
        });
      }

      // The frontend may send unit as either:
      // 1. A numeric ID (like "2" or 2)
      // 2. A text string (like "ΔΑΕΦΚ-ΚΕ")
      // We need to resolve this to the numeric unit_id
      let numericUnitId: number;
      try {
        // Check if unit is already a numeric ID
        const parsedUnitId = parseInt(String(unit));
        const isNumericUnit = !isNaN(parsedUnitId) && String(parsedUnitId) === String(unit).trim();
        
        let unitData: { id: number } | null = null;
        let unitError: any = null;
        
        if (isNumericUnit) {
          // Unit is a numeric ID, lookup by id column
          const result = await supabase
            .from("Monada")
            .select("id")
            .eq("id", parsedUnitId)
            .single();
          unitData = result.data;
          unitError = result.error;
          console.log("[DocumentsController] V1 Looking up unit by numeric ID:", parsedUnitId);
        } else {
          // Unit is a text string, lookup by unit column
          const result = await supabase
            .from("Monada")
            .select("id")
            .eq("unit", unit)
            .single();
          unitData = result.data;
          unitError = result.error;
          console.log("[DocumentsController] V1 Looking up unit by string:", unit);
        }

        if (unitData) {
          numericUnitId = unitData.id;
          console.log(
            "[DocumentsController] V1 Resolved unit",
            unit,
            "to numeric ID:",
            numericUnitId,
          );
        } else {
          console.error(
            "[DocumentsController] V1 Could not resolve unit:",
            unit,
            "Error:",
            unitError,
          );
          return res.status(400).json({
            message: `Unit "${unit}" not found in database`,
            error: "Invalid unit identifier",
          });
        }
      } catch (error) {
        console.error("[DocumentsController] V1 Error resolving unit:", error);
        return res.status(500).json({
          message: "Error resolving unit identifier",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // SECURITY: Verify user is authorized to create documents for this unit
      const userUnits: number[] = Array.isArray(req.user.unit_id)
        ? req.user.unit_id
        : req.user.unit_id ? [req.user.unit_id] : [];
      if (!userUnits.includes(numericUnitId)) {
        console.error(
          "[DocumentsController] V1 Authorization failed: user units",
          userUnits,
          "do not include target unit",
          numericUnitId,
        );
        return res.status(403).json({
          message:
            "Δεν έχετε δικαίωμα να δημιουργήσετε έγγραφα για αυτήν την μονάδα",
          error: "Unauthorized unit access",
        });
      }

      // Get project data with enhanced information using optimized schema
      const [projectRes, expenditureTypesRes, indexRes] = await Promise.all([
        supabase.from("Projects").select("*").eq("id", project_id).single(),
        supabase.from("expenditure_types").select("*"),
        supabase.from("project_index").select("*"),
      ]);

      if (projectRes.error || !projectRes.data) {
        return res.status(404).json({
          message: "Project not found",
          error: projectRes.error?.message,
        });
      }

      const projectData = projectRes.data;
      const expenditureTypes = expenditureTypesRes.data || [];
      const indexData = indexRes.data || [];

      // Get enhanced data for this project
      const projectIndexItems = indexData.filter(
        (idx) => idx.project_id === projectData.id,
      );
      
      // Find the specific project_index item that matches the selected expenditure_type
      let selectedProjectIndexItem = projectIndexItems[0]; // Default to first if no match found
      
      if (expenditure_type && projectIndexItems.length > 0) {
        // Find expenditure type ID from name
        const selectedExpenditureTypeData = expenditureTypes.find(
          (et) => et.expenditure_types === expenditure_type
        );
        
        if (selectedExpenditureTypeData) {
          // Find project_index item with this expenditure_type_id
          const matchingItem = projectIndexItems.find(
            (idx) => idx.expenditure_type_id === selectedExpenditureTypeData.id
          );
          if (matchingItem) {
            selectedProjectIndexItem = matchingItem;
            console.log('[DocumentsController] V1 Found matching project_index for expenditure type:', expenditure_type);
          }
        }
      }
      
      // Project data logging removed for cleaner console output

      const now = new Date().toISOString();

      // Create document with enhanced normalized schema structure
      const documentPayload = {
        // Core document fields
        status: "pending",
        total_amount: parseFloat(String(total_amount)) || 0,
        esdian:
          esdian_field1 || esdian_field2
            ? [esdian_field1, esdian_field2].filter(Boolean)
            : [],
        created_at: now,
        updated_at: now,

        // Enhanced foreign key relationships
        generated_by: req.user.id,
        unit_id: numericUnitId, // Properly resolved foreign key to monada table
        project_index_id: selectedProjectIndexItem ? selectedProjectIndexItem.id : null, // Foreign key to correct project_index entry
        attachment_id: [], // Will be populated after attachment processing
        beneficiary_payments_id: [], // Will be populated after beneficiary processing
        employee_payments_id: [], // Will be populated for ΕΚΤΟΣ ΕΔΡΑΣ documents
      };

      // Payload logging removed for cleaner console output

      // Insert into database
      const { data, error } = await supabase
        .from("generated_documents")
        .insert([documentPayload])
        .select("id")
        .single();

      if (error) {
        console.error("[DocumentsController] Error creating document:", error);
        return res.status(500).json({
          message: "Error creating document",
          error: error.message,
          details: error.details,
        });
      }

      // Success logging removed for cleaner console output
      // Update project budget with spending amount and create budget history
      try {
        console.log(
          "[DocumentsController] V1 Updating budget for spending amount:",
          total_amount,
        );
        const { storage } = await import("../storage");
        await storage.updateProjectBudgetSpending(
          project_id,
          parseFloat(String(total_amount)) || 0,
          data.id,
          req.user?.id,
        );
        console.log("[DocumentsController] V1 Budget updated successfully");

        // Broadcast dashboard refresh to trigger budget indicator updates
        try {
          broadcastDashboardRefresh({
            projectId: project_id,
            changeType: 'document_created',
            reason: `Document ${data.id} created with amount ${total_amount}`
          });
        } catch (broadcastError) {
          console.error('[DocumentsController] V1 Failed to broadcast dashboard refresh:', broadcastError);
        }
      } catch (budgetError) {
        console.error(
          "[DocumentsController] V1 Error updating budget:",
          budgetError,
        );
        // Don't fail the document creation if budget update fails, just log the error
      }

      res.status(201).json({ id: data.id });
    } catch (error) {
      console.error("[DocumentsController] Error creating document:", error);
      res.status(500).json({
        message: "Error creating document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/v2-documents
 * Document creation route (V2)
 * Alternative endpoint with different input validation
 */
router.post(
  "/v2",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log(
        "[DocumentsController] V2 Document creation request received!",
      );
      // Removed sensitive logging of req.body and req.headers to prevent PII/session leaks

      // Proper authentication check
      if (!req.user?.id) {
        console.log(
          "[DocumentsController] V2 Authentication failed - no user ID",
        );
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(
        "[DocumentsController] V2 Authenticated user ID:",
        req.user.id,
      );

      const {
        unit,
        project_id,
        expenditure_type,
        recipients,
        total_amount,
        attachments = [],
        esdian_field1,
        esdian_field2,
        esdian,
        director_signature,
        region,
        for_yl_id,
        for_yl_title,
      } = req.body;

      console.log("[DocumentsController] V2 Request summary:", {
        unit,
        project_id,
        expenditure_type,
        recipientsCount: recipients?.length,
        total_amount,
      });
      
      console.log("[DocumentsController] V2 DEBUG - Recipients from request:", JSON.stringify(recipients, null, 2));

      // The frontend may send unit as either:
      // 1. A numeric ID (like "2" or 2)
      // 2. A text string (like "ΔΑΕΦΚ-ΚΕ")
      // We need to resolve this to the numeric unit_id
      let numericUnitId: number;
      try {
        // Check if unit is already a numeric ID
        const parsedUnitId = parseInt(String(unit));
        const isNumericUnit = !isNaN(parsedUnitId) && String(parsedUnitId) === String(unit).trim();
        
        let unitData: { id: number } | null = null;
        let unitError: any = null;
        
        if (isNumericUnit) {
          // Unit is a numeric ID, lookup by id column
          const result = await supabase
            .from("Monada")
            .select("id")
            .eq("id", parsedUnitId)
            .single();
          unitData = result.data;
          unitError = result.error;
          console.log("[DocumentsController] V2 Looking up unit by numeric ID:", parsedUnitId);
        } else {
          // Unit is a text string, lookup by unit column
          const result = await supabase
            .from("Monada")
            .select("id")
            .eq("unit", unit)
            .single();
          unitData = result.data;
          unitError = result.error;
          console.log("[DocumentsController] V2 Looking up unit by string:", unit);
        }

        if (unitData) {
          numericUnitId = unitData.id;
          console.log(
            "[DocumentsController] V2 Resolved unit",
            unit,
            "to numeric ID:",
            numericUnitId,
          );
        } else {
          console.error(
            "[DocumentsController] V2 Could not resolve unit:",
            unit,
            "Error:",
            unitError,
          );
          return res.status(400).json({
            message: `Unit "${unit}" not found in database`,
            error: "Invalid unit identifier",
          });
        }
      } catch (error) {
        console.error("[DocumentsController] V2 Error resolving unit:", error);
        return res.status(500).json({
          message: "Error resolving unit identifier",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // SECURITY: Verify user is authorized to create documents for this unit
      const userUnits: number[] = Array.isArray(req.user.unit_id)
        ? req.user.unit_id
        : req.user.unit_id ? [req.user.unit_id] : [];
      if (!userUnits.includes(numericUnitId)) {
        console.error(
          "[DocumentsController] V2 Authorization failed: user units",
          userUnits,
          "do not include target unit",
          numericUnitId,
        );
        return res.status(403).json({
          message:
            "Δεν έχετε δικαίωμα να δημιουργήσετε έγγραφα για αυτήν την μονάδα",
          error: "Unauthorized unit access",
        });
      }

      if (!recipients?.length || !project_id || !unit || !expenditure_type) {
        return res.status(400).json({
          message:
            "Missing required fields: recipients, project_id, unit, and expenditure_type are required",
        });
      }

      // Validate that project_id is numeric
      const numericProjectId = parseInt(project_id);
      if (isNaN(numericProjectId)) {
        return res.status(400).json({
          message: "project_id must be a valid numeric ID",
        });
      }

      // Get project data using numeric project_id only
      let projectData = null;
      let project_na853 = null;

      try {
        console.log(
          "[DocumentsController] V2 Looking up project with numeric ID:",
          numericProjectId,
        );

        // First, let's check what projects exist in the database
        const allProjectsRes = await supabase
          .from("Projects")
          .select("id, mis, project_title")
          .limit(10);

        console.log(
          "[DocumentsController] V2 Projects query completed - found",
          allProjectsRes.data?.length || 0,
          "projects",
        );

        const projectRes = await supabase
          .from("Projects")
          .select("*")
          .eq("id", numericProjectId)
          .single();

        if (projectRes.error || !projectRes.data) {
          console.error(
            "[DocumentsController] V2 Project not found with ID:",
            numericProjectId,
          );
          console.error(
            "[DocumentsController] V2 Database error:",
            projectRes.error,
          );
          return res.status(400).json({
            message: `Project not found in Projects table. ID ${numericProjectId} does not exist.`,
            error: "No project found with the provided project_id",
            debug: {
              searchedId: numericProjectId,
              dbError: projectRes.error?.message,
            },
          });
        }

        projectData = projectRes.data;
        project_na853 = projectData.na853;
        console.log(
          "[DocumentsController] V2 Found project:",
          projectData.mis,
          "NA853:",
          project_na853,
        );
      } catch (error) {
        console.error(
          "[DocumentsController] V2 Error during project lookup:",
          error,
        );
        return res.status(500).json({
          message: "Error during project lookup",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Format recipients data consistently
      let formattedRecipients = recipients.map((r: any) => {
        const baseRecipient = {
          firstname: String(r.firstname || "").trim(),
          lastname: String(r.lastname || "").trim(),
          fathername: String(r.fathername || "").trim(),
          afm: String(r.afm || "").trim(),
          amount: parseFloat(String(r.amount || 0)),
          installment: String(r.installment || "Α").trim(),
          installments: r.installments || [],
          installmentAmounts: r.installmentAmounts || {},
          secondary_text: r.secondary_text
            ? String(r.secondary_text).trim()
            : undefined,
        };

        // Include ΕΚΤΟΣ ΕΔΡΑΣ-specific fields if this is an out-of-office expense
        if (expenditure_type === "ΕΚΤΟΣ ΕΔΡΑΣ") {
          return {
            ...baseRecipient,
            employee_id: r.employee_id,
            month: r.month,
            days: r.days,
            daily_compensation: r.daily_compensation,
            accommodation_expenses: r.accommodation_expenses,
            kilometers_traveled: r.kilometers_traveled,
            price_per_km:
              r.price_per_km !== undefined && r.price_per_km !== null
                ? Number(r.price_per_km)
                : 0.2,
            tickets_tolls_rental: r.tickets_tolls_rental,
            tickets_tolls_rental_entries: r.tickets_tolls_rental_entries || [],
            has_2_percent_deduction: Boolean(r.has_2_percent_deduction),
            net_payable: r.net_payable,
          };
        }

        return baseRecipient;
      });

      const isEktosEdrasType = expenditure_type === "ΕΚΤΟΣ ΕΔΡΑΣ";

      // Resolve employee IDs for ΕΚΤΟΣ ΕΔΡΑΣ recipients and block creation when missing
      if (isEktosEdrasType) {
        const resolvedRecipients = [];

        for (const recipient of formattedRecipients) {
          let employeeId = recipient.employee_id;

          // Fallback: try to resolve employee_id by AFM hash if not provided by the client
          if (!employeeId && recipient.afm) {
            try {
              const afmHash = hashAFM(recipient.afm);
              const { data: existingEmployee } = await supabase
                .from("Employees")
                .select("id")
                .eq("afm_hash", afmHash)
                .limit(1);

              if (existingEmployee && existingEmployee.length > 0) {
                employeeId = existingEmployee[0].id;
              }
            } catch (lookupError) {
              console.error(
                "[DocumentsController] V2 Error resolving employee by AFM hash:",
                lookupError,
              );
            }
          }

          resolvedRecipients.push({
            ...recipient,
            employee_id: employeeId,
          });
        }

        const recipientsMissingEmployee = resolvedRecipients.filter(
          (recipient) => !recipient.employee_id,
        );

        if (recipientsMissingEmployee.length > 0) {
          return res.status(400).json({
            message:
              "Employee selection is required for ΕΚΤΟΣ ΕΔΡΑΣ payments. Please select a valid employee from the search results.",
          });
        }

        formattedRecipients = resolvedRecipients;
      }

      // Pre-validate ΕΚΤΟΣ ΕΔΡΑΣ recipients before creating the document to avoid orphan records
      if (isEktosEdrasType) {
        const hasMissingMonth = formattedRecipients.some(
          (recipient: any) => !recipient.month || !String(recipient.month).trim(),
        );

        if (hasMissingMonth) {
          return res.status(400).json({
            message:
              "Month selection is required for ΕΚΤΟΣ ΕΔΡΑΣ recipients",
          });
        }

        const hasZeroExpenses = formattedRecipients.some((recipient: any) => {
          const dailyComp = Number(recipient.daily_compensation) || 0;
          const accommodation = Number(recipient.accommodation_expenses) || 0;
          const kmTraveled = Number(recipient.kilometers_traveled) || 0;
          const pricePerKm = Number(recipient.price_per_km) || 0.2;
          const tickets = Number(recipient.tickets_tolls_rental) || 0;
          const kmCost = kmTraveled * pricePerKm;

          return dailyComp + accommodation + kmCost + tickets <= 0;
        });

        if (hasZeroExpenses) {
          return res.status(400).json({
            message:
              "Total expenses must be greater than zero for ΕΚΤΟΣ ΕΔΡΑΣ recipients",
          });
        }
      }

      const now = new Date().toISOString();

      // Use director signature from request body if provided, otherwise get from Monada table
      let directorSignature = director_signature || null;

      // If no director signature was provided in the request, fallback to fetching from Monada table
      if (!directorSignature) {
        try {
          const { data: monadaData } = await supabase
            .from("Monada")
            .select("director")
            .eq("id", numericUnitId) // Use resolved numeric unit ID
            .single();

          if (monadaData && monadaData.director) {
            directorSignature = monadaData.director;
            console.log(
              "[DocumentsController] V2 Using fallback director signature from Monada",
            );
          }
        } catch (error) {
          console.log(
            "[DocumentsController] V2 Could not fetch fallback director signature:",
            error,
          );
        }
      } else {
        console.log(
          "[DocumentsController] V2 Using director signature from request",
        );
      }

      // Resolve project_index_id before creating document
      let projectIndexId = null;
      let actualProjectId = null;

      // Use the numeric project_id directly (already validated above)
      actualProjectId = numericProjectId;
      console.log(
        "[DocumentsController] V2 Using numeric project_id:",
        actualProjectId,
      );

      // Find existing project_index entry for this project, unit, and expenditure type
      if (actualProjectId) {
        try {
          // STRICT VALIDATION: Look up expenditure_type_id from expenditure_types table
          if (!expenditure_type) {
            return res.status(400).json({
              message: "Expenditure type is required for document creation",
              error: "Missing expenditure_type field",
            });
          }

          console.log(
            "[DocumentsController] V2 Looking up expenditure_type_id for:",
            expenditure_type,
          );
          const { data: expTypeData, error: expTypeError } = await supabase
            .from("expenditure_types")
            .select("id")
            .eq("expenditure_types", expenditure_type)
            .single();

          if (expTypeError || !expTypeData) {
            console.error(
              "[DocumentsController] V2 Expenditure type not found:",
              expenditure_type,
              "Error:",
              expTypeError,
            );
            return res.status(400).json({
              message: `Expenditure type "${expenditure_type}" not found in database`,
              error: "Invalid expenditure_type",
              details: expTypeError?.message,
            });
          }

          const expenditureTypeId = expTypeData.id;
          console.log(
            "[DocumentsController] V2 Found expenditure_type_id:",
            expenditureTypeId,
            "for type:",
            expenditure_type,
          );

          // STRICT VALIDATION: Find project_index entry matching ALL three criteria
          console.log(
            "[DocumentsController] V2 Looking up project_index with project_id:",
            actualProjectId,
            "monada_id:",
            numericUnitId,
            "expenditure_type_id:",
            expenditureTypeId,
          );
          const { data: projectIndexData, error: projectIndexError } =
            await supabase
              .from("project_index")
              .select("id")
              .eq("project_id", actualProjectId)
              .eq("monada_id", numericUnitId)
              .eq("expenditure_type_id", expenditureTypeId)
              .limit(1);

          if (projectIndexError) {
            console.error(
              "[DocumentsController] V2 Error querying project_index:",
              projectIndexError,
            );
            return res.status(500).json({
              message: "Error looking up project configuration",
              error: projectIndexError.message,
            });
          }

          if (!projectIndexData || projectIndexData.length === 0) {
            console.error(
              "[DocumentsController] V2 No project_index found for combination:",
              {
                project_id: actualProjectId,
                monada_id: numericUnitId,
                expenditure_type_id: expenditureTypeId,
                expenditure_type: expenditure_type,
              },
            );
            return res.status(400).json({
              message: `No valid project configuration found for project ${actualProjectId}, unit ${unit}, and expenditure type "${expenditure_type}"`,
              error: "Invalid project/unit/expenditure_type combination",
              details: {
                project_id: actualProjectId,
                unit: unit,
                expenditure_type: expenditure_type,
                resolved_expenditure_type_id: expenditureTypeId,
              },
            });
          }

          projectIndexId = projectIndexData[0].id;
          console.log(
            "[DocumentsController] V2 Successfully found project_index_id:",
            projectIndexId,
            "for project:",
            actualProjectId,
            "unit:",
            unit,
            "expenditure_type:",
            expenditure_type,
          );
        } catch (indexError) {
          console.error(
            "[DocumentsController] V2 Unexpected error during project_index lookup:",
            indexError,
          );
          return res.status(500).json({
            message: "Internal error during project configuration lookup",
            error:
              indexError instanceof Error
                ? indexError.message
                : "Unknown error",
          });
        }
      }

      // Process attachments: Convert selected attachment names to IDs
      let attachmentIds = [];
      if (attachments && attachments.length > 0) {
        try {
          // Get all attachments from database to map names to IDs
          const { data: allAttachments, error: attachmentError } =
            await supabase.from("attachments").select("id, atachments");

          if (attachmentError) {
            console.error(
              "[DocumentsController] V2 Error fetching attachments:",
              attachmentError,
            );
          } else {
            // Map selected attachment names to IDs
            attachmentIds = allAttachments
              .filter((attachment) =>
                attachments.includes(attachment.atachments),
              )
              .map((attachment) => attachment.id);

            console.log(
              "[DocumentsController] V2 Selected attachments:",
              attachments,
            );
            console.log(
              "[DocumentsController] V2 Mapped to attachment IDs:",
              attachmentIds,
            );
          }
        } catch (error) {
          console.error(
            "[DocumentsController] V2 Error processing attachments:",
            error,
          );
        }
      }

      // Parse region data from string format (Region|RegionalUnit|Municipality) to JSONB
      // Also include for_yl (delegated implementing agency) info if provided
      let regionJsonb: any = null;
      if (region && typeof region === 'string' && region.trim() !== '') {
        const parts = region.split('|');
        const regionName = parts[0] || '';
        const regionalUnit = parts[1] || '';
        const municipality = parts[2] || '';
        
        // Determine the level based on which parts are filled
        let level = 'region';
        if (municipality && municipality.trim() !== '') {
          level = 'municipality';
        } else if (regionalUnit && regionalUnit.trim() !== '') {
          level = 'regional_unit';
        }
        
        regionJsonb = {
          region: regionName,
          regional_unit: regionalUnit,
          municipality: municipality,
          level: level
        };
        
        console.log('[DocumentsController] V2 Parsed region data:', regionJsonb);
      }
      
      // Add for_yl (delegated implementing agency) to region JSONB if provided
      if (for_yl_id) {
        if (!regionJsonb) {
          regionJsonb = {};
        }
        regionJsonb.for_yl_id = for_yl_id;
        regionJsonb.for_yl_title = for_yl_title || null;
        console.log('[DocumentsController] V2 Added for_yl to region:', { for_yl_id, for_yl_title });
      }

      // PRE-VALIDATE BUDGET BEFORE CREATING DOCUMENT
      // This ensures we don't create documents that would exceed budget limits
      // TWO-TIER VALIDATION:
      // - ετήσια πίστωση exceeded = HARD BLOCK (cannot save)
      // - κατανομή έτους exceeded = SOFT WARNING (save with warning)
      // WARNING: RACE CONDITION POSSIBLE - Multiple concurrent requests can pass validation
      // and all create documents. True fix requires database transaction with row-level locking.
      const spendingAmount = parseFloat(String(total_amount)) || 0;
      let budgetWarning: { message: string; budgetType: string } | null = null;
      
      if (spendingAmount > 0 && project_id) {
        console.log('[DocumentsController] V2 Pre-validating budget before document creation');
        console.log('[DocumentsController] V2 Project ID:', project_id, 'Amount:', spendingAmount);
        
        try {
          const { storage } = await import("../storage");
          const budgetCheck = await storage.checkBudgetAvailability(project_id, spendingAmount);
          
          // HARD BLOCK: Only block if ετήσια πίστωση is exceeded (hardBlock = true)
          if (budgetCheck.hardBlock) {
            console.log('[DocumentsController] V2 BUDGET HARD BLOCK (πίστωση exceeded):', budgetCheck.message);
            return res.status(400).json({
              message: "Υπέρβαση Ετήσιας Πίστωσης - Δεν μπορείτε να αποθηκεύσετε",
              error: budgetCheck.message,
              budget_error: true,
              budget_type: budgetCheck.budgetType,
              hard_block: true,
              available_budget: budgetCheck.availableBudget,
              yearly_available: budgetCheck.yearlyAvailable,
              katanomes_etous: budgetCheck.katanomesEtous,
              ethsia_pistosi: budgetCheck.ethsiaPistosi,
              requested_amount: spendingAmount
            });
          }
          
          // SOFT WARNING: κατανομή έτους exceeded - allow save but log warning
          if (budgetCheck.budgetType === 'katanomi') {
            console.log('[DocumentsController] V2 BUDGET SOFT WARNING (κατανομή exceeded):', budgetCheck.message);
            budgetWarning = {
              message: budgetCheck.message,
              budgetType: 'katanomi'
            };
            // Don't return - continue with document creation
          } else {
            console.log('[DocumentsController] V2 Budget pre-validation PASSED. Available:', budgetCheck.availableBudget);
          }
        } catch (budgetCheckError) {
          console.error('[DocumentsController] V2 Error during budget pre-validation:', budgetCheckError);
          // If we can't validate budget, we should still block the document creation for safety
          return res.status(500).json({
            message: "Σφάλμα ελέγχου προϋπολογισμού",
            error: budgetCheckError instanceof Error ? budgetCheckError.message : "Unknown error",
            budget_error: true
          });
        }
      }

      // Create document with exact schema match and default values where needed
      const documentPayload = {
        unit_id: numericUnitId, // Use resolved numeric unit ID
        total_amount: parseFloat(String(total_amount)) || 0,
        generated_by: (req as any).user?.id || null,
        project_index_id: projectIndexId, // Add project_index_id to document
        attachment_id: attachmentIds, // Array of attachment IDs
        status: "pending", // Always set initial status to pending
        protocol_date: new Date().toISOString().split("T")[0], // Set current date
        protocol_number_input: null, // Will be set by user during document processing
        is_correction: false,
        comments: `Document created for project ${project_id}`,
        esdian:
          esdian && Array.isArray(esdian)
            ? esdian.filter(Boolean)
            : esdian_field1 || esdian_field2
              ? [esdian_field1, esdian_field2].filter(Boolean)
              : [],
        director_signature: directorSignature,
        beneficiary_payments_id: [], // Will be populated after beneficiary payments creation
        employee_payments_id: [], // Will be populated for ΕΚΤΟΣ ΕΔΡΑΣ documents
        creation_integrity: null,
        region: regionJsonb, // Geographic region data (parsed from Region|RegionalUnit|Municipality format)
        needs_xrimatodotisi: budgetWarning?.budgetType === 'katanomi' ? true : false, // Flag for budget warning requiring approval
        created_at: now,
        updated_at: now,
      };

      console.log(
        "[DocumentsController] V2 Document payload prepared:",
        documentPayload,
      );

      // Insert into database
      const { data, error } = await supabase
        .from("generated_documents")
        .insert([documentPayload])
        .select("id")
        .single();

      if (error) {
        console.error(
          "[DocumentsController] V2 Error creating document:",
          error,
        );
        return res.status(500).json({
          message: "Error creating document",
          error: error.message,
          details: error.details,
        });
      }

      console.log(
        "[DocumentsController] V2 Document created successfully:",
        data.id,
      );

      // Create beneficiary payments OR employee payments for each recipient using project_index_id
      const beneficiaryPaymentsIds: number[] = [];
      const employeePaymentsIds: number[] = [];
      const createdBeneficiaryIds: number[] = []; // Track newly created beneficiaries for rollback
      let beneficiaryPaymentFailed = false;
      let beneficiaryPaymentError: any = null;
      let employeePaymentFailed = false;
      let employeePaymentError: any = null;
      type CreationIssue = { code: string; stage: string; message: string };
      const creationIssues: CreationIssue[] = [];
      let shouldPersistAsDraft = false;
      let rollbackAttempted = false;
      let rollbackSucceeded = true;

      const toIssueMessage = (errorOrMessage: unknown): string => {
        if (errorOrMessage instanceof Error) {
          return errorOrMessage.message;
        }
        if (typeof errorOrMessage === "string") {
          return errorOrMessage;
        }
        if (
          errorOrMessage &&
          typeof errorOrMessage === "object" &&
          "message" in errorOrMessage &&
          typeof (errorOrMessage as any).message === "string"
        ) {
          return (errorOrMessage as any).message;
        }
        try {
          return JSON.stringify(errorOrMessage);
        } catch {
          return String(errorOrMessage);
        }
      };

      const addCreationIssue = (
        code: string,
        stage: string,
        errorOrMessage: unknown,
      ) => {
        creationIssues.push({
          code,
          stage,
          message: toIssueMessage(errorOrMessage),
        });
      };

      const rollbackPostInsertArtifacts = async (stage: string) => {
        rollbackAttempted = true;

        if (beneficiaryPaymentsIds.length > 0) {
          const { error: beneficiaryRollbackError } = await supabase
            .from("beneficiary_payments")
            .delete()
            .in("id", beneficiaryPaymentsIds);

          if (beneficiaryRollbackError) {
            rollbackSucceeded = false;
            addCreationIssue(
              "ROLLBACK_BENEFICIARY_PAYMENTS_FAILED",
              stage,
              beneficiaryRollbackError,
            );
          } else {
            beneficiaryPaymentsIds.length = 0;
          }
        }

        if (employeePaymentsIds.length > 0) {
          const { error: employeeRollbackError } = await supabase
            .from("EmployeePayments")
            .delete()
            .in("id", employeePaymentsIds);

          if (employeeRollbackError) {
            rollbackSucceeded = false;
            addCreationIssue(
              "ROLLBACK_EMPLOYEE_PAYMENTS_FAILED",
              stage,
              employeeRollbackError,
            );
          } else {
            employeePaymentsIds.length = 0;
          }
        }

        if (createdBeneficiaryIds.length > 0) {
          const { data: linkedBeneficiaries, error: linkedBeneficiariesError } =
            await supabase
              .from("beneficiary_payments")
              .select("beneficiary_id")
              .in("beneficiary_id", createdBeneficiaryIds);

          if (linkedBeneficiariesError) {
            rollbackSucceeded = false;
            addCreationIssue(
              "ROLLBACK_BENEFICIARY_LINK_LOOKUP_FAILED",
              stage,
              linkedBeneficiariesError,
            );
          } else {
            const linkedSet = new Set<number>(
              (linkedBeneficiaries || [])
                .map((entry: any) => Number(entry.beneficiary_id))
                .filter((entry: number) => Number.isFinite(entry)),
            );
            const beneficiariesToDelete = createdBeneficiaryIds.filter(
              (beneficiaryId) => !linkedSet.has(beneficiaryId),
            );

            if (beneficiariesToDelete.length > 0) {
              const { error: beneficiaryDeleteError } = await supabase
                .from("beneficiaries")
                .delete()
                .in("id", beneficiariesToDelete);

              if (beneficiaryDeleteError) {
                rollbackSucceeded = false;
                addCreationIssue(
                  "ROLLBACK_CREATED_BENEFICIARIES_FAILED",
                  stage,
                  beneficiaryDeleteError,
                );
              } else {
                beneficiariesToDelete.forEach((beneficiaryId) => {
                  const idx = createdBeneficiaryIds.indexOf(beneficiaryId);
                  if (idx >= 0) {
                    createdBeneficiaryIds.splice(idx, 1);
                  }
                });
              }
            }
          }
        }
      };

      try {
        console.log(
          "[DocumentsController] V2 Creating payments for",
          formattedRecipients.length,
          "recipients. Expenditure type:",
          expenditure_type,
        );

        // Use the project_index_id already resolved for the document
        console.log(
          "[DocumentsController] V2 Using project_index_id for payments:",
          projectIndexId,
        );

        // Check if this is out-of-office expenses
        const isEktosEdras = isEktosEdrasType;

        for (const recipient of formattedRecipients) {
          // Out-of-office flow: create employee payment
          if (isEktosEdras) {
            // Validate required out-of-office fields
            if (!recipient.month || !String(recipient.month).trim()) {
              employeePaymentFailed = true;
              employeePaymentError = new Error(
                "Month is required for out-of-office employee payments",
              );
              addCreationIssue(
                "EMPLOYEE_PAYMENT_VALIDATION_FAILED",
                "employee_payments",
                employeePaymentError,
              );
              break;
            }

            // Calculate totals
            const dailyComp = Number(recipient.daily_compensation) || 0;
            const accommodation = Number(recipient.accommodation_expenses) || 0;
            const kmTraveled = Number(recipient.kilometers_traveled) || 0;
            const pricePerKm = Number(recipient.price_per_km) || 0.2;
            const tickets = Number(recipient.tickets_tolls_rental) || 0;

            const kmCost = kmTraveled * pricePerKm;
            const totalExpense = dailyComp + accommodation + kmCost + tickets;

            if (totalExpense <= 0) {
              employeePaymentFailed = true;
              employeePaymentError = new Error(
                "Total expenses must be greater than zero for out-of-office employee payments",
              );
              addCreationIssue(
                "EMPLOYEE_PAYMENT_VALIDATION_FAILED",
                "employee_payments",
                employeePaymentError,
              );
              break;
            }

            // For out-of-office: 2% withholding applies only to daily compensation
            const deduction2Percent = recipient.has_2_percent_deduction
              ? dailyComp * 0.02
              : 0;
            const netPayable = totalExpense - deduction2Percent;

            const employeePayment = {
              employee_id: recipient.employee_id || null,
              document_id: data.id,
              month: recipient.month || "",
              days: Number(recipient.days) || 1,
              daily_compensation: dailyComp,
              accommodation_expenses: accommodation,
              kilometers_traveled: kmTraveled,
              price_per_km: pricePerKm,
              tickets_tolls_rental: tickets,
              has_2_percent_deduction: Boolean(recipient.has_2_percent_deduction),
              total_expense: totalExpense,
              deduction_2_percent: deduction2Percent,
              net_payable: netPayable,
              status: "pending",
              created_at: now,
              updated_at: now,
            };

            const { data: empPaymentData, error: empPaymentError } = await supabase
              .from("EmployeePayments")
              .insert([employeePayment])
              .select("id")
              .single();

            if (empPaymentError) {
              employeePaymentFailed = true;
              employeePaymentError = empPaymentError;
            } else {
              employeePaymentsIds.push(empPaymentData.id);
            }
          }
          // Standard flow: Create beneficiary payment
          else {
            // Step 1: Look up or create/update beneficiary
            let beneficiaryId = null;
            try {
              // Find existing beneficiary by AFM hash (since AFM is encrypted)
              const afmHash = hashAFM(recipient.afm);
              const { data: existingBeneficiary, error: findError } =
                await supabase
                  .from("beneficiaries")
                  .select("id, regiondet")
                  .eq("afm_hash", afmHash)
                  .single();

              if (existingBeneficiary) {
                beneficiaryId = existingBeneficiary.id;

                // Update beneficiary with latest details
                const mergedRegiondet = mergeRegiondetWithPayments(
                  existingBeneficiary.regiondet,
                  recipient.regiondet || null,
                );

                const { error: updateError } = await supabase
                  .from("beneficiaries")
                  .update({
                    surname: recipient.lastname,
                    name: recipient.firstname,
                    fathername: recipient.fathername,
                    regiondet: mergedRegiondet,
                    updated_at: now,
                  })
                  .eq("id", beneficiaryId);

                if (updateError) {
                  console.error(
                    "[DocumentsController] V2 Error updating beneficiary:",
                    updateError,
                  );
                }
              } else if (findError && findError.code === "PGRST116") {
                // Beneficiary not found, create new one
                const newBeneficiary = {
                  afm: encryptAFM(recipient.afm),
                  afm_hash: afmHash,
                  surname: recipient.lastname,
                  name: recipient.firstname,
                  fathername: recipient.fathername,
                  regiondet: mergeRegiondetWithPayments(
                    null,
                    recipient.regiondet || null,
                  ),
                  date: new Date().toISOString().split("T")[0],
                  created_at: now,
                  updated_at: now,
                };

                const { data: createdBeneficiary, error: createError } =
                  await supabase
                    .from("beneficiaries")
                    .insert([newBeneficiary])
                    .select("id")
                    .single();

                if (createError) {
                  beneficiaryPaymentFailed = true;
                  beneficiaryPaymentError = createError;
                } else {
                  beneficiaryId = createdBeneficiary.id;
                  createdBeneficiaryIds.push(beneficiaryId);
                }
              } else {
                beneficiaryPaymentFailed = true;
                beneficiaryPaymentError = findError;
              }
            } catch (beneficiaryError) {
              beneficiaryPaymentFailed = true;
              beneficiaryPaymentError = beneficiaryError;
            }

            // Step 2: Create separate beneficiary payment records for each installment
            if (beneficiaryId) {
              if (recipient.installments && recipient.installmentAmounts) {
                for (const installmentName of recipient.installments) {
                  const installmentAmount = recipient.installmentAmounts[installmentName];

                  if (installmentAmount > 0) {
                    const beneficiaryPayment = {
                      document_id: data.id,
                      beneficiary_id: beneficiaryId,
                      amount: installmentAmount,
                      status: "pending",
                      installment: installmentName,
                      freetext: recipient.secondary_text || null,
                      unit_id: numericUnitId,
                      project_index_id: projectIndexId,
                      created_at: now,
                      updated_at: now,
                    };

                    const { data: paymentData, error: paymentError } =
                      await supabase
                        .from("beneficiary_payments")
                        .insert([beneficiaryPayment])
                        .select("id")
                        .single();

                    if (paymentError) {
                      beneficiaryPaymentFailed = true;
                      beneficiaryPaymentError = paymentError;
                    } else {
                      beneficiaryPaymentsIds.push(paymentData.id);
                      try {
                        await storage.appendPaymentIdToRegiondet(
                          beneficiaryId,
                          paymentData.id,
                        );
                      } catch (appendError) {
                        console.error(
                          "[DocumentsController] V2 Error appending payment id to regiondet:",
                          appendError,
                        );
                      }
                    }
                  }
                }
              } else {
                const beneficiaryPayment = {
                  document_id: data.id,
                  beneficiary_id: beneficiaryId,
                  amount: recipient.amount,
                  status: "pending",
                  installment: recipient.installment,
                  freetext: recipient.secondary_text || null,
                  unit_id: numericUnitId,
                  project_index_id: projectIndexId,
                  created_at: now,
                  updated_at: now,
                };

                const { data: paymentData, error: paymentError } = await supabase
                  .from("beneficiary_payments")
                  .insert([beneficiaryPayment])
                  .select("id")
                  .single();

                if (paymentError) {
                  beneficiaryPaymentFailed = true;
                  beneficiaryPaymentError = paymentError;
                } else {
                  beneficiaryPaymentsIds.push(paymentData.id);
                  try {
                    await storage.appendPaymentIdToRegiondet(
                      beneficiaryId,
                      paymentData.id,
                    );
                  } catch (appendError) {
                    console.error(
                      "[DocumentsController] V2 Error appending payment id to regiondet:",
                      appendError,
                    );
                  }
                }
              }
            } else {
              beneficiaryPaymentFailed = true;
              beneficiaryPaymentError =
                beneficiaryPaymentError ||
                new Error(
                  `Cannot create payment because beneficiary_id is missing for AFM ${recipient.afm}`,
                );
            }
          }
        }

        // Update document with appropriate payment IDs based on expenditure type
        if (isEktosEdras) {
          if (employeePaymentsIds.length === 0 || employeePaymentFailed) {
            shouldPersistAsDraft = true;
            addCreationIssue(
              "EMPLOYEE_PAYMENTS_NOT_CREATED",
              "employee_payments",
              employeePaymentError || "No employee payments were created",
            );
            await rollbackPostInsertArtifacts("employee_payments");
          } else {
            const { error: updateError } = await supabase
              .from("generated_documents")
              .update({ employee_payments_id: employeePaymentsIds })
              .eq("id", data.id);

            if (updateError) {
              shouldPersistAsDraft = true;
              addCreationIssue(
                "DOCUMENT_PAYMENT_LINK_UPDATE_FAILED",
                "employee_payments",
                updateError,
              );
              await rollbackPostInsertArtifacts("employee_payments");
            }
          }
        } else {
          if (
            formattedRecipients.length > 0 &&
            (beneficiaryPaymentsIds.length === 0 || beneficiaryPaymentFailed)
          ) {
            shouldPersistAsDraft = true;
            addCreationIssue(
              "BENEFICIARY_PAYMENTS_NOT_CREATED",
              "beneficiary_payments",
              beneficiaryPaymentError || "No beneficiary payments were created",
            );
            await rollbackPostInsertArtifacts("beneficiary_payments");
          } else {
            const { error: updateError } = await supabase
              .from("generated_documents")
              .update({ beneficiary_payments_id: beneficiaryPaymentsIds })
              .eq("id", data.id);

            if (updateError) {
              shouldPersistAsDraft = true;
              addCreationIssue(
                "DOCUMENT_PAYMENT_LINK_UPDATE_FAILED",
                "beneficiary_payments",
                updateError,
              );
              await rollbackPostInsertArtifacts("beneficiary_payments");
            }
          }
        }
      } catch (paymentsError) {
        shouldPersistAsDraft = true;
        addCreationIssue(
          "PAYMENT_CREATION_EXCEPTION",
          "payments",
          paymentsError,
        );
        await rollbackPostInsertArtifacts("payments");
      }

      // Update project budget with spending amount and create budget history
      if (!shouldPersistAsDraft) {
        try {
          console.log(
            "[DocumentsController] V2 Updating budget for spending amount:",
            total_amount,
          );
          const { storage } = await import("../storage");
          await storage.updateProjectBudgetSpending(
            project_id,
            parseFloat(String(total_amount)) || 0,
            data.id,
            req.user?.id,
          );
          console.log("[DocumentsController] V2 Budget updated successfully");

          try {
            broadcastDashboardRefresh({
              projectId: project_id,
              changeType: "document_created",
              reason: `Document ${data.id} created with amount ${total_amount}`,
            });
          } catch (broadcastError) {
            console.error(
              "[DocumentsController] Failed to broadcast dashboard refresh:",
              broadcastError,
            );
          }

          try {
            await validateBudgetAllocation(
              project_id,
              parseFloat(String(total_amount)) || 0,
              req.user?.id,
            );
          } catch (validationError) {
            console.error(
              "[DocumentsController] V2 Error during budget validation:",
              validationError,
            );
          }
        } catch (budgetError) {
          shouldPersistAsDraft = true;
          addCreationIssue("BUDGET_UPDATE_FAILED", "budget_update", budgetError);
          await rollbackPostInsertArtifacts("budget_update");
        }
      }

      if (shouldPersistAsDraft) {
        const creationIntegrity = {
          integrity_status: "incomplete" as const,
          issues: creationIssues,
          rollback: {
            attempted: rollbackAttempted,
            succeeded: rollbackSucceeded,
          },
          generated_at: new Date().toISOString(),
        };

        const { error: draftUpdateError } = await supabase
          .from("generated_documents")
          .update({
            status: "draft",
            beneficiary_payments_id: [],
            employee_payments_id: [],
            creation_integrity: creationIntegrity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);

        if (draftUpdateError) {
          return res.status(500).json({
            message: "Error finalizing draft integrity state",
            error: draftUpdateError.message,
            integrity_status: "incomplete",
            creation_issues: creationIssues,
          });
        }

        broadcastDocumentUpdate({
          type: "DOCUMENT_UPDATE",
          documentId: data.id,
          data: {
            userId: (req as any).user?.id,
            timestamp: new Date().toISOString(),
          },
        });

        return res.status(201).json({
          id: data.id,
          status: "draft",
          integrity_status: "incomplete",
          creation_issues: creationIssues,
          message:
            "Document saved as draft with integrity flags due to post-create failures",
          beneficiary_payments_count: beneficiaryPaymentsIds.length,
        });
      }

      broadcastDocumentUpdate({
        type: "DOCUMENT_UPDATE",
        documentId: data.id,
        data: {
          userId: (req as any).user?.id,
          timestamp: new Date().toISOString(),
        },
      });

      const responsePayload: any = {
        id: data.id,
        status: "pending",
        integrity_status: "ok",
        message: budgetWarning
          ? "Document saved with budget warning"
          : "Document created successfully",
        beneficiary_payments_count: beneficiaryPaymentsIds.length,
      };

      if (budgetWarning) {
        responsePayload.budget_warning = true;
        responsePayload.budget_warning_message = budgetWarning.message;
        responsePayload.budget_type = budgetWarning.budgetType;
      }

      res.status(201).json(responsePayload);
    } catch (error) {
      console.error("[DocumentsController] V2 Error creating document:", error);
      res.status(500).json({
        message: "Error creating document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// List documents with filters (batched fetch to avoid N+1 queries)
router.get("/", async (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit =
      typeof limitParam === "number" && Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 500)
        : undefined;
    const offset =
      typeof offsetParam === "number" && Number.isFinite(offsetParam) && offsetParam >= 0
        ? offsetParam
        : 0;

    const filters = {
      unit_id: req.query.unit ? parseInt(req.query.unit as string) : undefined,
      status: req.query.status as string,
      generated_by: req.query.generated_by
        ? parseInt(req.query.generated_by as string)
        : undefined,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      amountFrom: req.query.amountFrom
        ? parseFloat(req.query.amountFrom as string)
        : undefined,
      amountTo: req.query.amountTo
        ? parseFloat(req.query.amountTo as string)
        : undefined,
      recipient: req.query.recipient as string,
      afm: req.query.afm as string,
      expenditureType: req.query.expenditureType as string,
      na853: req.query.na853 as string,
      protocolNumber: req.query.protocolNumber as string,
    };

    // Base query - fetch ALL matching documents to apply client-side filters before pagination
    // Use 'exact' count to get the total count of matching rows (ignores pagination)
    let query = supabase
      .from("generated_documents")
      .select("*, employee_payments_id, beneficiary_payments_id", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.unit_id) {
      query = query.eq("unit_id", filters.unit_id);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.generated_by) {
      query = query.eq("generated_by", filters.generated_by);
    }

    // Fetch all filtered documents - no pagination at query level
    // Supabase will return up to 1000 rows by default
    const { data: allDocuments, error, count: totalCountAll } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        message: "Database query failed",
        error: error.message,
      });
    }

    if (!allDocuments || allDocuments.length === 0) {
      console.log("[DocumentsController] No documents found from database query");
      return res.json([]);
    }

    console.log(`[DocumentsController] Fetched ${allDocuments.length} raw documents from database for unit_id=${filters.unit_id}`);

    // Collect all related IDs for batched fetching
    const employeePaymentIds = new Set<number>();
    const beneficiaryPaymentIds = new Set<number>();
    const unitIds = new Set<number>();
    const projectIndexIds = new Set<number>();
    const attachmentIds = new Set<number>();

    for (const doc of allDocuments) {
      if (doc.unit_id) unitIds.add(doc.unit_id);
      if (doc.project_index_id) projectIndexIds.add(doc.project_index_id);
      if (Array.isArray(doc.attachment_id)) {
        doc.attachment_id.forEach((id: number) => attachmentIds.add(id));
      } else if (doc.attachment_id) {
        attachmentIds.add(doc.attachment_id as number);
      }
      if (Array.isArray(doc.employee_payments_id)) {
        doc.employee_payments_id.forEach((id: number) => employeePaymentIds.add(id));
      }
      if (Array.isArray(doc.beneficiary_payments_id)) {
        doc.beneficiary_payments_id.forEach((id: number) => beneficiaryPaymentIds.add(id));
      }
    }

    const [
      employeePaymentsResult,
      beneficiaryPaymentsResult,
      unitsResult,
      projectIndexResult,
      attachmentsResult,
    ] = await Promise.all([
      employeePaymentIds.size
        ? supabase
            .from("EmployeePayments")
            .select(
              `
              id,
              net_payable,
              month,
              days,
              daily_compensation,
              accommodation_expenses,
              kilometers_traveled,
              tickets_tolls_rental,
              has_2_percent_deduction,
              total_expense,
              deduction_2_percent,
              status,
              Employees (
                id,
                afm,
                surname,
                name,
                fathername,
                klados
              )
            `,
            )
            .in("id", Array.from(employeePaymentIds))
        : { data: [] },
      beneficiaryPaymentIds.size
        ? supabase
            .from("beneficiary_payments")
            .select(
              `
              id,
              amount,
              installment,
              status,
              freetext,
              eps,
              payment_date,
              created_at,
              beneficiaries (
                id,
                afm,
                surname,
                name,
                fathername,
                regiondet
              )
            `,
            )
            .in("id", Array.from(beneficiaryPaymentIds))
        : { data: [] },
      unitIds.size
        ? supabase.from("Monada").select("id, unit, unit_name").in("id", Array.from(unitIds))
        : { data: [] },
      projectIndexIds.size
        ? supabase
            .from("project_index")
            .select(
              `
              id,
              project_id,
              expenditure_type_id,
              Projects (
                id,
                mis,
                na853,
                event_description,
                project_title
              )
            `,
            )
            .in("id", Array.from(projectIndexIds))
        : { data: [] },
      attachmentIds.size
        ? supabase
            .from("attachments")
            .select("id, expenditure_type_id")
            .in("id", Array.from(attachmentIds))
        : { data: [] },
    ]);

    const employeePayments = (employeePaymentsResult as any).data || [];
    const beneficiaryPayments = (beneficiaryPaymentsResult as any).data || [];
    const units = (unitsResult as any).data || [];
    const projectIndexes = (projectIndexResult as any).data || [];
    const attachments = (attachmentsResult as any).data || [];

    const expenditureTypeIds = new Set<number>();
    projectIndexes.forEach((idx: any) => {
      if (idx.expenditure_type_id) expenditureTypeIds.add(idx.expenditure_type_id);
    });
    attachments.forEach((att: any) => {
      if (Array.isArray(att.expenditure_type_id)) {
        att.expenditure_type_id.forEach((id: number) => expenditureTypeIds.add(id));
      } else if (att.expenditure_type_id) {
        expenditureTypeIds.add(att.expenditure_type_id);
      }
    });

    const { data: expenditureTypesData = [] } = expenditureTypeIds.size
      ? await supabase
          .from("expenditure_types")
          .select("id, expenditure_types")
          .in("id", Array.from(expenditureTypeIds))
      : { data: [] as any[] };

    const employeePaymentMap = new Map<number, any>(
      employeePayments.map((p: any) => [p.id, p]),
    );
    const beneficiaryPaymentMap = new Map<number, any>(
      beneficiaryPayments.map((p: any) => [p.id, p]),
    );
    const unitMap = new Map<number, any>(units.map((u: any) => [u.id, u]));
    const projectIndexMap = new Map<number, any>(
      projectIndexes.map((p: any) => [p.id, p]),
    );
    const attachmentMap = new Map<number, any>(
      attachments.map((a: any) => [a.id, a]),
    );
    const expenditureTypeMap = new Map<number, string>(
      (expenditureTypesData as any[]).map((e: any) => [e.id, e.expenditure_types]),
    );

    const enrichedDocuments = allDocuments.map((doc) => {
      let recipients: any[] = [];

      if (Array.isArray(doc.employee_payments_id) && doc.employee_payments_id.length > 0) {
        recipients = doc.employee_payments_id
          .map((id: number) => employeePaymentMap.get(id))
          .filter(Boolean)
          .map((payment: any) => {
            const employee = Array.isArray(payment.Employees)
              ? payment.Employees[0]
              : payment.Employees;
            return {
              id: employee?.id,
              firstname: employee?.name || "",
              lastname: employee?.surname || "",
              fathername: employee?.fathername || "",
              afm: employee?.afm ? String(employee.afm) : "",
              amount: parseFloat(payment.net_payable) || 0,
              month: payment.month || "",
              days: payment.days || 0,
              daily_compensation: payment.daily_compensation || 0,
              accommodation_expenses: payment.accommodation_expenses || 0,
              kilometers_traveled: payment.kilometers_traveled || 0,
              tickets_tolls_rental: payment.tickets_tolls_rental || 0,
              tickets_tolls_rental_entries: [],
              has_2_percent_deduction: payment.has_2_percent_deduction ?? false,
              total_expense: payment.total_expense ?? 0,
              deduction_2_percent: payment.deduction_2_percent ?? 0,
              status: payment.status || "pending",
              secondary_text: employee?.klados || null,
            };
          });
      } else if (
        Array.isArray(doc.beneficiary_payments_id) &&
        doc.beneficiary_payments_id.length > 0
      ) {
        recipients = doc.beneficiary_payments_id
          .map((id: number) => beneficiaryPaymentMap.get(id))
          .filter(Boolean)
          .map((payment: any) => {
            const beneficiary = Array.isArray(payment.beneficiaries)
              ? payment.beneficiaries[0]
              : payment.beneficiaries;
            return {
              id: beneficiary?.id,
              firstname: beneficiary?.name || "",
              lastname: beneficiary?.surname || "",
              fathername: beneficiary?.fathername || "",
              afm: beneficiary?.afm ? String(beneficiary.afm) : "",
              amount: parseFloat(payment.amount) || 0,
              installment: payment.installment || "",
              region: beneficiary?.regiondet || "",
              status: payment.status || "pending",
              freetext: payment.eps ?? payment.freetext ?? null,
              eps: payment.eps ?? payment.freetext ?? null,
              payment_date: payment.payment_date || null,
            };
          });
      }

      // Compute aggregated payment data for the document
      let latest_payment_date: string | null = null;
      let latest_eps: string | null = null;
      let payment_count = 0;

      if (Array.isArray(doc.beneficiary_payments_id) && doc.beneficiary_payments_id.length > 0) {
        const paymentsList = doc.beneficiary_payments_id
          .map((id: number) => beneficiaryPaymentMap.get(id))
          .filter(Boolean);
        
        payment_count = paymentsList.length;
        
        if (paymentsList.length > 0) {
          // Sort by payment_date DESC (latest first), then by created_at DESC for tie-breaking
          const sorted = paymentsList.sort((a: any, b: any) => {
            const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
            const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
            if (dateA !== dateB) {
              return dateB - dateA;
            }
            const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return createdB - createdA;
          });
          
          const latestPayment = sorted[0];
          latest_payment_date = latestPayment.payment_date || null;
          latest_eps = latestPayment.eps ?? latestPayment.freetext ?? null;
        }
      }

      const unitInfo = doc.unit_id ? unitMap.get(doc.unit_id) : null;
      const projectIndex = doc.project_index_id
        ? projectIndexMap.get(doc.project_index_id)
        : null;
      const projectInfo = projectIndex?.Projects || null;

      let expenditureTypeName = projectIndex?.expenditure_type_id
        ? expenditureTypeMap.get(projectIndex.expenditure_type_id) || ""
        : "";

      if (!expenditureTypeName && Array.isArray(doc.attachment_id) && doc.attachment_id.length) {
        const attachment = attachmentMap.get(doc.attachment_id[0]);
        if (attachment) {
          const firstExpId = Array.isArray(attachment.expenditure_type_id)
            ? attachment.expenditure_type_id[0]
            : attachment.expenditure_type_id;
          if (firstExpId) {
            expenditureTypeName = expenditureTypeMap.get(firstExpId) || "";
          }
        }
      }

      return {
        ...doc,
        recipients,
        unit: unitInfo?.unit || "",
        unit_name: unitInfo?.unit_name || "",
        project_id: projectInfo?.mis || "",
        mis: projectInfo?.mis || "",
        project_na853: projectInfo?.na853 || "",
        project_title: projectInfo?.project_title || "",
        event_description: projectInfo?.event_description || "",
        expenditure_type: expenditureTypeName,
        latest_payment_date,
        latest_eps,
        payment_count,
      };
    });

    // Apply filters to enriched documents (client-side filtering for expenditure type and NA853)
    let filteredDocuments = enrichedDocuments;

    // Date filters - filter by created_at date
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredDocuments = filteredDocuments.filter((doc) => {
        const docDate = new Date(doc.created_at);
        return docDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      // Set to end of day to include documents created on this date
      toDate.setHours(23, 59, 59, 999);
      filteredDocuments = filteredDocuments.filter((doc) => {
        const docDate = new Date(doc.created_at);
        return docDate <= toDate;
      });
    }

    // Amount filters - sum all recipient amounts and filter
    if (filters.amountFrom) {
      const minAmount = filters.amountFrom;
      filteredDocuments = filteredDocuments.filter((doc) => {
        if (!doc.recipients || !Array.isArray(doc.recipients)) return false;
        const totalAmount = doc.recipients.reduce(
          (sum: number, recipient: any) => sum + (recipient.amount || 0),
          0,
        );
        return totalAmount >= minAmount;
      });
    }

    if (filters.amountTo) {
      const maxAmount = filters.amountTo;
      filteredDocuments = filteredDocuments.filter((doc) => {
        if (!doc.recipients || !Array.isArray(doc.recipients)) return false;
        const totalAmount = doc.recipients.reduce(
          (sum: number, recipient: any) => sum + (recipient.amount || 0),
          0,
        );
        return totalAmount <= maxAmount;
      });
    }

    if (filters.expenditureType) {
      filteredDocuments = filteredDocuments.filter(
        (doc) =>
          doc.expenditure_type &&
          doc.expenditure_type
            .toLowerCase()
            .includes(filters.expenditureType.toLowerCase()),
      );
    }

    if (filters.na853) {
      filteredDocuments = filteredDocuments.filter(
        (doc) =>
          doc.project_na853 &&
          doc.project_na853.toString().includes(filters.na853),
      );
    }

    if (filters.recipient) {
      filteredDocuments = filteredDocuments.filter((doc) => {
        if (!doc.recipients || !Array.isArray(doc.recipients)) return false;
        return doc.recipients.some((recipient: any) =>
          `${recipient.firstname} ${recipient.lastname}`
            .toLowerCase()
            .includes(filters.recipient.toLowerCase()),
        );
      });
    }

    if (filters.afm) {
      filteredDocuments = filteredDocuments.filter((doc) => {
        if (!doc.recipients || !Array.isArray(doc.recipients)) return false;
        return doc.recipients.some(
          (recipient: any) =>
            recipient.afm && recipient.afm.includes(filters.afm),
        );
      });
    }

    if (filters.protocolNumber) {
      filteredDocuments = filteredDocuments.filter(
        (doc) =>
          doc.protocol_number_input &&
          doc.protocol_number_input
            .toLowerCase()
            .includes(filters.protocolNumber.toLowerCase()),
      );
    }

    // Apply pagination AFTER client-side filtering
    let resultDocuments = filteredDocuments;
    const totalCount = filteredDocuments.length;
    
    if (limit) {
      resultDocuments = filteredDocuments.slice(offset, offset + limit);
    }
    
    res.json(resultDocuments);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({
      message: "Failed to fetch documents",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/documents/user
 * Get user's recent documents
 */
router.get("/user", async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("[DocumentsController] ==> User endpoint called");
    console.log("[DocumentsController] ==> Session exists:", !!req.session);
    console.log(
      "[DocumentsController] ==> Session user:",
      req.session?.user ? "exists" : "missing",
    );
    console.log(
      "[DocumentsController] ==> Session user ID:",
      req.session?.user?.id,
    );
    console.log(
      "[DocumentsController] ==> req.user:",
      req.user ? "exists" : "missing",
    );
    console.log("[DocumentsController] ==> req.user.id:", req.user?.id);

    // Check session first
    if (!req.session?.user?.id) {
      console.log(
        "[DocumentsController] No authenticated session - returning empty array",
      );
      return res.json([]);
    }

    // Set user from session if not already set
    if (!req.user) {
      req.user = req.session.user;
    }

    if (!req.user || !req.user.id) {
      console.log(
        "[DocumentsController] No authenticated user - returning empty array",
      );
      return res.json([]);
    }

    console.log(
      "[DocumentsController] Fetching documents for user:",
      req.user.id,
      "type:",
      typeof req.user.id,
    );

    // Ensure user ID is a valid number
    const userId = Number(req.user.id);
    console.log(
      "[DocumentsController] Converted user ID:",
      userId,
      "isNaN:",
      isNaN(userId),
    );

    if (isNaN(userId) || userId <= 0) {
      console.error("[DocumentsController] Invalid user ID:", req.user.id);
      return res.json([]);
    }

    // Get recent documents for the user
    const { data: documents, error } = await supabase
      .from("generated_documents")
      .select("*")
      .eq("generated_by", userId.toString()) // Convert to string to handle bigint compatibility
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error(
        "[DocumentsController] Error fetching user documents:",
        error,
      );
      return res.status(500).json({
        error: "Failed to fetch user documents",
        details: error.message,
      });
    }

    // Enrich user documents with the same project/unit information
    const enrichedUserDocuments = await Promise.all(
      (documents || []).map(async (doc) => {
        let recipients: any[] = [];

        // Fetch employee payments for ΕΚΤΟΣ ΕΔΡΑΣ documents
        if (
          doc.employee_payments_id &&
          Array.isArray(doc.employee_payments_id) &&
          doc.employee_payments_id.length > 0
        ) {
          try {
            console.log(`[DocumentsController] Fetching employee payments for document ${doc.id} with IDs:`, doc.employee_payments_id);
            
            const { data: empPayments, error: empPaymentsError } = await supabase
              .from("EmployeePayments")
              .select(
                `
                id,
                net_payable,
                month,
                days,
                daily_compensation,
                accommodation_expenses,
                kilometers_traveled,
                tickets_tolls_rental,
                has_2_percent_deduction,
                total_expense,
                deduction_2_percent,
                status,
                Employees (
                  id,
                  afm,
                  surname,
                  name,
                  fathername,
                  klados
                )
              `,
              )
              .in("id", doc.employee_payments_id);

            console.log(`[DocumentsController] Employee payments query result for doc ${doc.id}:`, {
              error: empPaymentsError,
              paymentsCount: empPayments?.length || 0
            });

            if (!empPaymentsError && empPayments) {
              // Transform employee payments into recipients format
              recipients = empPayments.map((payment) => {
                const employee = Array.isArray(payment.Employees)
                  ? payment.Employees[0]
                  : payment.Employees;
                return {
                  id: employee?.id,
                  firstname: employee?.name || "",
                  lastname: employee?.surname || "",
                  fathername: employee?.fathername || "",
                  afm: employee?.afm ? String(employee.afm) : "",
                  amount: parseFloat(payment.net_payable) || 0,
                  month: payment.month || "",
                  days: payment.days || 0,
                  daily_compensation: payment.daily_compensation || 0,
                  accommodation_expenses: payment.accommodation_expenses || 0,
                  kilometers_traveled: payment.kilometers_traveled || 0,
                  tickets_tolls_rental: payment.tickets_tolls_rental || 0,
                  tickets_tolls_rental_entries: [], // Empty array - field not stored in DB
                  has_2_percent_deduction: payment.has_2_percent_deduction ?? false,
                  total_expense: payment.total_expense ?? 0,
                  deduction_2_percent: payment.deduction_2_percent ?? 0,
                  status: payment.status || "pending",
                  secondary_text: employee?.klados || null,
                };
              });
              console.log(`[DocumentsController] Transformed ${recipients.length} employee payments into recipients for doc ${doc.id}`);
            } else if (empPaymentsError) {
              console.error(`[DocumentsController] Error fetching employee payments for doc ${doc.id}:`, empPaymentsError);
            }
          } catch (err) {
            console.error(
              "Error fetching employee payments for user document",
              doc.id,
              ":",
              err,
            );
          }
        }
        // Fetch beneficiary payments for regular documents
        else if (
          doc.beneficiary_payments_id &&
          Array.isArray(doc.beneficiary_payments_id) &&
          doc.beneficiary_payments_id.length > 0
        ) {
          try {
            console.log(`[DocumentsController] Fetching beneficiary payments for user document ${doc.id} with IDs:`, doc.beneficiary_payments_id);
            
            const { data: payments, error: paymentsError } = await supabase
              .from("beneficiary_payments")
              .select(
                `
                id,
                amount,
                installment,
                status,
                beneficiaries (
                  id,
                  afm,
                  surname,
                  name,
                  fathername,
                  regiondet
                )
              `,
              )
              .in("id", doc.beneficiary_payments_id);

            console.log(`[DocumentsController] Beneficiary payments query result for user doc ${doc.id}:`, {
              error: paymentsError,
              paymentsCount: payments?.length || 0
            });

            if (!paymentsError && payments) {
              recipients = payments.map((payment) => {
                const beneficiary = Array.isArray(payment.beneficiaries)
                  ? payment.beneficiaries[0]
                  : payment.beneficiaries;
                return {
                  id: beneficiary?.id,
                  firstname: beneficiary?.name || "",
                  lastname: beneficiary?.surname || "",
                  fathername: beneficiary?.fathername || "",
                  afm: beneficiary?.afm ? String(beneficiary.afm) : "",
                  amount: parseFloat(payment.amount) || 0,
                  installment: payment.installment || "",
                  region: beneficiary?.regiondet || "",
                  status: payment.status || "pending",
                };
              });
              console.log(`[DocumentsController] Transformed ${recipients.length} beneficiary payments into recipients for user doc ${doc.id}`);
            } else if (paymentsError) {
              console.error(`[DocumentsController] Error fetching beneficiary payments for user doc ${doc.id}:`, paymentsError);
            }
          } catch (err) {
            console.error(
              "Error fetching beneficiary payments for user document",
              doc.id,
              ":",
              err,
            );
          }
        }

        // Fetch unit information
        let unitInfo = null;
        if (doc.unit_id) {
          try {
            const { data: unitData, error: unitError } = await supabase
              .from("Monada")
              .select("unit, unit_name")
              .eq("id", doc.unit_id)
              .single();

            if (!unitError && unitData) {
              unitInfo = unitData;
            }
          } catch (err) {
            console.error(
              "Error fetching unit for user document",
              doc.id,
              ":",
              err,
            );
          }
        }

        // Fetch project information through project_index
        let projectInfo = null;
        let expenditureTypeInfo = null;
        if (doc.project_index_id) {
          try {
            const { data: indexData, error: indexError } = await supabase
              .from("project_index")
              .select(
                `
                id,
                project_id,
                expenditure_type_id,
                Projects (
                  id,
                  mis,
                  na853,
                  event_description,
                  project_title
                )
              `,
              )
              .eq("id", doc.project_index_id)
              .single();

            if (!indexError && indexData && indexData.Projects) {
              projectInfo = indexData.Projects;

              if (indexData.expenditure_type_id) {
                const { data: expTypeData, error: expTypeError } =
                  await supabase
                    .from("expenditure_types")
                    .select("expenditure_types")
                    .eq("id", indexData.expenditure_type_id)
                    .single();

                if (!expTypeError && expTypeData) {
                  expenditureTypeInfo = { name: expTypeData.expenditure_types };
                }
              }
            }
          } catch (err) {
            console.error(
              "Error fetching project info for user document",
              doc.id,
              ":",
              err,
            );
          }
        }

        // Fallback: Try to get expenditure type from attachments if not found via project_index
        if (
          !expenditureTypeInfo &&
          doc.attachment_id &&
          Array.isArray(doc.attachment_id) &&
          doc.attachment_id.length > 0
        ) {
          try {
            const { data: attachmentData, error: attachmentError } =
              await supabase
                .from("attachments")
                .select("expenditure_type_id")
                .in("id", doc.attachment_id)
                .limit(1);

            if (
              !attachmentError &&
              attachmentData &&
              attachmentData.length > 0 &&
              attachmentData[0].expenditure_type_id
            ) {
              const expenditureTypeIds = Array.isArray(
                attachmentData[0].expenditure_type_id,
              )
                ? attachmentData[0].expenditure_type_id
                : [attachmentData[0].expenditure_type_id];

              if (expenditureTypeIds.length > 0) {
                const { data: expTypeData, error: expTypeError } =
                  await supabase
                    .from("expenditure_types")
                    .select("expenditure_types")
                    .eq("id", expenditureTypeIds[0])
                    .single();

                if (!expTypeError && expTypeData) {
                  expenditureTypeInfo = { name: expTypeData.expenditure_types };
                }
              }
            }
          } catch (err) {
            console.error(
              "Error fetching expenditure type from attachments for user document",
              doc.id,
              ":",
              err,
            );
          }
        }

        return {
          ...doc,
          recipients: recipients as any[],
          unit: unitInfo?.unit || "",
          unit_name: unitInfo?.unit_name || "",
          project_id: (projectInfo as any)?.mis || "",
          mis: (projectInfo as any)?.mis || "",
          project_na853: (projectInfo as any)?.na853 || "",
          project_title: (projectInfo as any)?.project_title || "",
          event_description: (projectInfo as any)?.event_description || "",
          expenditure_type: expenditureTypeInfo?.name || "",
        };
      }),
    );

    console.log(
      "[DocumentsController] Successfully fetched",
      enrichedUserDocuments?.length || 0,
      "enriched documents",
    );
    res.json(enrichedUserDocuments || []);
  } catch (error) {
    console.error("[DocumentsController] Error in user endpoint:", error);
    res.status(500).json({
      error: "Failed to fetch user documents",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update single document
router.patch(
  "/:id",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Fetch the old document for budget reconciliation
      const { data: oldDocument, error: fetchError } = await supabase
        .from("generated_documents")
        .select("project_index_id, total_amount")
        .eq("id", documentId)
        .single();

      if (fetchError || !oldDocument) {
        console.error("Error fetching old document:", fetchError);
        return res.status(404).json({ message: "Document not found" });
      }

      const updateData = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("generated_documents")
        .update(updateData)
        .eq("id", documentId)
        .select()
        .single();

      if (error) {
        console.error("Error updating document:", error);
        return res.status(500).json({
          message: "Error updating document",
          error: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Reconcile budget if project or amount changed
      const oldProjectIndexId = oldDocument.project_index_id;
      const newProjectIndexId = updateData.project_index_id ?? oldProjectIndexId;
      const oldAmount = parseFloat(String(oldDocument.total_amount || 0));
      const newAmount = parseFloat(String(updateData.total_amount ?? oldAmount));

      if (oldProjectIndexId !== newProjectIndexId || oldAmount !== newAmount) {
        try {
          // Get actual project IDs from project_index records
          let oldProjectId = null;
          let newProjectId = null;

          if (oldProjectIndexId) {
            const { data: oldProjectIndex, error: oldProjectError } = await supabase
              .from("project_index")
              .select("project_id")
              .eq("id", oldProjectIndexId)
              .single();
            
            if (oldProjectError) {
              console.error(`[DocumentsController] ERROR: Failed to fetch project_index ${oldProjectIndexId}:`, oldProjectError);
              return res.status(500).json({
                message: "Cannot update document - failed to fetch project configuration",
                error: oldProjectError.message
              });
            } else if (!oldProjectIndex?.project_id) {
              console.error(`[DocumentsController] ERROR: project_index ${oldProjectIndexId} has no project_id`);
              return res.status(500).json({
                message: "Cannot update document - missing project configuration",
                error: `project_index ${oldProjectIndexId} has invalid data (no project_id)`
              });
            } else {
              oldProjectId = oldProjectIndex.project_id;
            }
          }

          if (newProjectIndexId) {
            const { data: newProjectIndex, error: newProjectError } = await supabase
              .from("project_index")
              .select("project_id")
              .eq("id", newProjectIndexId)
              .single();
            
            if (newProjectError) {
              console.error(`[DocumentsController] ERROR: Failed to fetch project_index ${newProjectIndexId}:`, newProjectError);
              return res.status(500).json({
                message: "Cannot update document - failed to fetch new project configuration",
                error: newProjectError.message
              });
            } else if (!newProjectIndex?.project_id) {
              console.error(`[DocumentsController] ERROR: project_index ${newProjectIndexId} has no project_id`);
              return res.status(500).json({
                message: "Cannot update document - missing new project configuration",
                error: `project_index ${newProjectIndexId} has invalid data (no project_id)`
              });
            } else {
              newProjectId = newProjectIndex.project_id;
            }
          }

          if (oldProjectId || newProjectId) {
            await storage.reconcileBudgetOnDocumentEdit(
              documentId,
              oldProjectId,
              newProjectId,
              oldAmount,
              newAmount,
              req.user.id
            );
            console.log(`[DocumentsController] Budget reconciled for document ${documentId}`);
          } else {
            console.error(`[DocumentsController] WARNING: Skipping budget reconciliation for document ${documentId} - no valid project IDs found (oldProjectIndexId: ${oldProjectIndexId}, newProjectIndexId: ${newProjectIndexId})`);
          }
        } catch (budgetError) {
          console.error("[DocumentsController] Error reconciling budget:", budgetError);
          // Don't fail the update if budget reconciliation fails, but log it
        }
      }

      // Broadcast document update
      broadcastDocumentUpdate({
        type: "DOCUMENT_UPDATE",
        documentId,
        data: {
          id: documentId,
          project_index_id: newProjectIndexId,
          total_amount: newAmount,
        },
      });

      res.json(data);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({
        message: "Error updating document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// GET /api/documents/search - Search documents by AFM (encrypted search via hash)
// IMPORTANT: This route MUST be defined BEFORE the /:id route to prevent "search" being treated as an ID
router.get(
  "/search",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { afm } = req.query;
      
      if (!afm || typeof afm !== 'string') {
        return res.status(400).json({
          message: 'Το ΑΦΜ είναι υποχρεωτικό για την αναζήτηση'
        });
      }
      
      if (!/^\d{9}$/.test(afm)) {
        return res.status(400).json({
          message: 'Το ΑΦΜ πρέπει να περιέχει ακριβώς 9 ψηφία'
        });
      }
      
      // SECURITY: Get user's authorized units
      const userUnits = req.user?.unit_id || [];
      if (userUnits.length === 0) {
        return res.status(403).json({
          message: 'Δεν έχετε εκχωρημένες μονάδες'
        });
      }
      
      console.log(`[DocumentsController] Searching documents by AFM for units:`, userUnits);
      
      // Use storage method to search documents by AFM hash
      const documents = await storage.searchDocumentsByAFM(afm, userUnits);
      
      console.log(`[DocumentsController] Found ${documents.length} documents matching AFM: ${afm}`);
      res.json(documents);
    } catch (error) {
      console.error('[DocumentsController] Error searching documents by AFM:', error);
      res.status(500).json({
        message: 'Αποτυχία αναζήτησης εγγράφων',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get single document
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { data: document, error } = await supabase
      .from("generated_documents")
      .select(
        `
        *,
        generated_by:users!generated_documents_generated_by_fkey (
          name,
          email,
          department,
          telephone
        )
      `,
      )
      .eq("id", parseInt(req.params.id))
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check if user has access to this document's unit
    if (
      req.user?.role === "user" &&
      !req.user.unit_id?.includes(document.unit_id)
    ) {
      return res.status(403).json({ error: "Access denied to this document" });
    }

    // Enrich document with project and expenditure type information
    let unitInfo: any = null;
    let projectInfo: any = null;
    let expenditureTypeInfo: any = null;

    // Fetch unit information
    if (document.unit_id) {
      try {
        const { data: unitData, error: unitError } = await supabase
          .from("Monada")
          .select("id, unit, unit_name")
          .eq("id", document.unit_id)
          .single();

        if (!unitError && unitData) {
          unitInfo = unitData;
        }
      } catch (err) {
        console.error("Error fetching unit info for document", document.id, ":", err);
      }
    }

    // Fetch project information via project_index
    if (document.project_index_id) {
      try {
        const { data: indexData, error: indexError } = await supabase
          .from("project_index")
          .select(`
            *,
            Projects (
              id,
              mis,
              na853,
              project_title,
              event_description
            )
          `)
          .eq("id", document.project_index_id)
          .single();

        if (!indexError && indexData && indexData.Projects) {
          projectInfo = indexData.Projects;

          // Fetch expenditure type from project_index
          if (indexData.expenditure_type_id) {
            const { data: expTypeData, error: expTypeError } = await supabase
              .from("expenditure_types")
              .select("expenditure_types")
              .eq("id", indexData.expenditure_type_id)
              .single();

            if (!expTypeError && expTypeData) {
              expenditureTypeInfo = { name: expTypeData.expenditure_types };
            }
          }
        }
      } catch (err) {
        console.error("Error fetching project info for document", document.id, ":", err);
      }
    }

    // Fallback: Try to get expenditure type from attachments if not found via project_index
    if (
      !expenditureTypeInfo &&
      document.attachment_id &&
      Array.isArray(document.attachment_id) &&
      document.attachment_id.length > 0
    ) {
      try {
        const { data: attachmentData, error: attachmentError } = await supabase
          .from("attachments")
          .select("expenditure_type_id")
          .in("id", document.attachment_id)
          .limit(1);

        if (
          !attachmentError &&
          attachmentData &&
          attachmentData.length > 0 &&
          attachmentData[0].expenditure_type_id
        ) {
          const expenditureTypeIds = Array.isArray(attachmentData[0].expenditure_type_id)
            ? attachmentData[0].expenditure_type_id
            : [attachmentData[0].expenditure_type_id];

          if (expenditureTypeIds.length > 0) {
            const { data: expTypeData, error: expTypeError } = await supabase
              .from("expenditure_types")
              .select("expenditure_types")
              .eq("id", expenditureTypeIds[0])
              .single();

            if (!expTypeError && expTypeData) {
              expenditureTypeInfo = { name: expTypeData.expenditure_types };
            }
          }
        }
      } catch (err) {
        console.error("Error fetching expenditure type from attachments for document", document.id, ":", err);
      }
    }

    // Return enriched document
    const enrichedDocument = {
      ...document,
      unit: unitInfo?.unit || "",
      unit_name: unitInfo?.unit_name || "",
      project_id: (projectInfo as any)?.mis || "",
      mis: (projectInfo as any)?.mis || "",
      project_na853: (projectInfo as any)?.na853 || "",
      project_title: (projectInfo as any)?.project_title || "",
      event_description: (projectInfo as any)?.event_description || "",
      expenditure_type: expenditureTypeInfo?.name || "",
    };

    res.json(enrichedDocument);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({
      error: "Failed to fetch document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update document
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the document first to check if it exists
    const { data: existingDoc, error: fetchError } = await supabase
      .from("generated_documents")
      .select("id, unit")
      .eq("id", parseInt(req.params.id))
      .single();

    if (fetchError || !existingDoc) {
      console.error("Document not found:", req.params.id);
      return res.status(404).json({
        message: "Document not found",
        error: fetchError?.message,
      });
    }

    // Update the document
    const { data: document, error } = await supabase
      .from("generated_documents")
      .update({
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Broadcast update to connected clients
    broadcastDocumentUpdate({
      type: "DOCUMENT_UPDATE",
      documentId: document.id,
      data: document,
    });

    res.json(document);
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({
      error: "Failed to update document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update document protocol
router.patch(
  "/generated/:id/protocol",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { protocol_number, protocol_date } = req.body;
      const documentId = parseInt(id);
      const trimmedProtocolNumber = protocol_number?.trim();
      const parsedProtocolDate = protocol_date ? new Date(protocol_date) : null;

      // Updating protocol information for document

      if (!trimmedProtocolNumber) {
        return res.status(400).json({
          success: false,
          message: "Protocol number is required",
        });
      }

      // Check if protocol_date is present and not empty
      if (!protocol_date || protocol_date === "") {
        return res.status(400).json({
          success: false,
          message: "Protocol date is required",
        });
      }

      if (!parsedProtocolDate || Number.isNaN(parsedProtocolDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Protocol date is invalid",
        });
      }

      const protocolYear = parsedProtocolDate.getFullYear();

      // Get the document first to check access rights
      const { data: document, error: fetchError } = await supabase
        .from("generated_documents")
        .select("unit_id")
        .eq("id", documentId)
        .single();

      if (fetchError) {
        console.error(
          "Error fetching document for protocol update:",
          fetchError,
        );
        throw fetchError;
      }

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      // Check if user has access to this document's unit
      if (
        req.user?.role === "user" &&
        !req.user.unit_id?.includes(document.unit_id)
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this document",
        });
      }

      // Enforce uniqueness of protocol number within the same year
      const { data: existingProtocols, error: conflictCheckError } =
        await supabase
          .from("generated_documents")
          .select("id, protocol_date")
          .eq("protocol_number_input", trimmedProtocolNumber)
          .neq("id", documentId);

      if (conflictCheckError) {
        console.error(
          "Error checking protocol uniqueness:",
          conflictCheckError,
        );
        return res.status(500).json({
          success: false,
          message: "Could not validate protocol number uniqueness",
          error: conflictCheckError.message,
        });
      }

      const conflictingProtocol = (existingProtocols || []).find((doc) => {
        if (!doc?.protocol_date) return false;
        const existingYear = new Date(doc.protocol_date).getFullYear();
        return existingYear === protocolYear;
      });

      if (conflictingProtocol) {
        return res.status(409).json({
          success: false,
          message: `Protocol number "${trimmedProtocolNumber}" is already used for ${protocolYear}. Please use a different number for this year.`,
          code: "PROTOCOL_NUMBER_EXISTS_YEAR",
          conflict_document_id: conflictingProtocol.id,
        });
      }

      // Update the document
      const updateData: any = {
        status: "completed", // Set to completed when protocol is added
        updated_by: req.user?.id,
      };

      if (trimmedProtocolNumber) {
        updateData.protocol_number_input = trimmedProtocolNumber;
      }

      if (protocol_date && protocol_date !== "") {
        updateData.protocol_date = protocol_date;
      }

      const { data: updatedDocument, error: updateError } = await supabase
        .from("generated_documents")
        .update(updateData)
        .eq("id", documentId)
        .select()
        .single();

      if (updateError) {
        const isUniqueViolation =
          updateError.code === "23505" ||
          (updateError.message || "")
            .toLowerCase()
            .includes("duplicate key value");
        if (isUniqueViolation) {
          return res.status(409).json({
            success: false,
            message: `Protocol number "${trimmedProtocolNumber}" is already in use. Please use a different number for this year.`,
            code: "PROTOCOL_NUMBER_EXISTS_YEAR",
          });
        }

        console.error("Protocol update error:", updateError);
        throw updateError;
      }

      // Broadcast protocol update to connected clients
      if (updatedDocument) {
        broadcastDocumentUpdate({
          type: "PROTOCOL_UPDATE",
          documentId: parseInt(id),
          data: updatedDocument,
        });
      }

      // Protocol updated successfully
      return res.json({
        success: true,
        message: "Protocol updated successfully",
        data: updatedDocument,
      });
    } catch (error) {
      console.error("Protocol update error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update protocol",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Create correction (Orthi Epanalipsi) for a document
router.post("/:id/correction", authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      correction_reason,
      protocol_number_input,
      protocol_date,
      status,
      comments,
      total_amount,
      esdian,
      recipients,
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!correction_reason) {
      return res.status(400).json({
        message: "Correction reason is required",
      });
    }

    // Get the original document (with old values for budget reconciliation)
    const { data: originalDoc, error: fetchError } = await supabase
      .from("generated_documents")
      .select("*")
      .eq("id", parseInt(id))
      .single();

    if (fetchError || !originalDoc) {
      return res.status(404).json({
        message: "Original document not found",
        error: fetchError?.message,
      });
    }

    // Get new values with fallbacks
    const newProjectIndexId =
      req.body.project_index_id ?? originalDoc.project_index_id;
    const newUnitId = req.body.unit_id ?? originalDoc.unit_id;
    const newTotalAmount = total_amount ?? originalDoc.total_amount;

    const effectiveProjectIndexId = newProjectIndexId || originalDoc.project_index_id;
    const effectiveUnitId = newUnitId || originalDoc.unit_id;

    // Resolve expenditure type for the correction (needed to handle ΕΚΤΟΣ ΕΔΡΑΣ correctly)
    let isCorrectionEktosEdras = false;

    if (effectiveProjectIndexId) {
      const { data: projectIndexRow, error: projectIndexLookupError } =
        await supabase
          .from("project_index")
          .select("expenditure_types!inner(expenditure_types)")
          .eq("id", effectiveProjectIndexId)
          .single();

      if (projectIndexLookupError) {
        console.error(
          "[Correction] Could not resolve expenditure type for project_index_id:",
          effectiveProjectIndexId,
          projectIndexLookupError,
        );
      } else {
        const expenditureTypeName =
          (projectIndexRow as any)?.expenditure_types?.expenditure_types;
        if (expenditureTypeName) {
          isCorrectionEktosEdras = expenditureTypeName === "ΕΚΤΟΣ ΕΔΡΑΣ";
        }
      }
    } else {
      console.warn(
        "[Correction] No project_index_id found while creating correction; defaulting to non-ΕΚΤΟΣ ΕΔΡΑΣ flow",
      );
    }

    // Update the original document to mark it as corrected
    const { error: updateError } = await supabase
      .from("generated_documents")
      .update({
        is_correction: true,
        original_protocol_number: originalDoc.protocol_number_input,
        original_protocol_date: originalDoc.protocol_date,
        protocol_number_input: protocol_number_input || null,
        protocol_date: protocol_date || null,
        status: status || originalDoc.status,
        comments: `${comments || originalDoc.comments || ''}\n\nΛόγος Διόρθωσης: ${correction_reason}`,
        total_amount: newTotalAmount,
        esdian: esdian || originalDoc.esdian,
        project_index_id: newProjectIndexId,
        unit_id: newUnitId,
        updated_at: new Date().toISOString(),
        updated_by: req.user.id.toString(),
      })
      .eq("id", parseInt(id));

    if (updateError) {
      console.error("Correction update error:", updateError);
      return res.status(500).json({
        message: "Failed to create correction",
        error: updateError.message,
      });
    }

    // Reconcile budget if project or amount changed
    const oldProjectIndexId = originalDoc.project_index_id;
    const oldAmount = parseFloat(String(originalDoc.total_amount || 0));
    const newAmount = parseFloat(String(newTotalAmount || 0));

    if (oldProjectIndexId !== newProjectIndexId || oldAmount !== newAmount) {
      try {
        // Get actual project IDs from project_index records
        let oldProjectId = null;
        let newProjectId = null;

        if (oldProjectIndexId) {
          const { data: oldProjectIndex, error: oldProjectError } = await supabase
            .from("project_index")
            .select("project_id")
            .eq("id", oldProjectIndexId)
            .single();
          
          if (oldProjectError) {
            console.error(`[Correction] ERROR: Failed to fetch project_index ${oldProjectIndexId}:`, oldProjectError);
            return res.status(500).json({
              message: "Cannot create correction - failed to fetch project configuration",
              error: oldProjectError.message
            });
          } else if (!oldProjectIndex?.project_id) {
            console.error(`[Correction] ERROR: project_index ${oldProjectIndexId} has no project_id`);
            return res.status(500).json({
              message: "Cannot create correction - missing project configuration",
              error: `project_index ${oldProjectIndexId} has invalid data (no project_id)`
            });
          } else {
            oldProjectId = oldProjectIndex.project_id;
          }
        }

        if (newProjectIndexId) {
          const { data: newProjectIndex, error: newProjectError } = await supabase
            .from("project_index")
            .select("project_id")
            .eq("id", newProjectIndexId)
            .single();
          
          if (newProjectError) {
            console.error(`[Correction] ERROR: Failed to fetch project_index ${newProjectIndexId}:`, newProjectError);
            return res.status(500).json({
              message: "Cannot create correction - failed to fetch new project configuration",
              error: newProjectError.message
            });
          } else if (!newProjectIndex?.project_id) {
            console.error(`[Correction] ERROR: project_index ${newProjectIndexId} has no project_id`);
            return res.status(500).json({
              message: "Cannot create correction - missing new project configuration",
              error: `project_index ${newProjectIndexId} has invalid data (no project_id)`
            });
          } else {
            newProjectId = newProjectIndex.project_id;
          }
        }

        if (oldProjectId || newProjectId) {
          await storage.reconcileBudgetOnDocumentEdit(
            parseInt(id),
            oldProjectId,
            newProjectId,
            oldAmount,
            newAmount,
            req.user.id
          );
          console.log(`[Correction] Budget reconciled for correction ${id}`);
        } else {
          console.error(`[Correction] WARNING: Skipping budget reconciliation for correction ${id} - no valid project IDs found (oldProjectIndexId: ${oldProjectIndexId}, newProjectIndexId: ${newProjectIndexId})`);
        }
      } catch (budgetError) {
        console.error("[Correction] Error reconciling budget:", budgetError);
        // Don't fail the correction if budget reconciliation fails, but log it
      }
    }

    // Update payments if provided
    if (recipients && recipients.length > 0) {
      if (isCorrectionEktosEdras) {
        // Validate and prepare employee payments for ΕΚΤΟΣ ΕΔΡΑΣ corrections
        const employeePaymentPayloads: any[] = [];

        for (const recipient of recipients) {
          let employeeId = recipient.employee_id;

          // Resolve employee by AFM hash if not provided
          if (!employeeId && recipient.afm) {
            try {
              const afmHash = hashAFM(recipient.afm);
              const { data: existingEmployee } = await supabase
                .from("Employees")
                .select("id")
                .eq("afm_hash", afmHash)
                .limit(1);

              if (existingEmployee && existingEmployee.length > 0) {
                employeeId = existingEmployee[0].id;
              }
            } catch (lookupError) {
              console.error(
                "[Correction] Error resolving employee by AFM hash during ΕΚΤΟΣ ΕΔΡΑΣ correction:",
                lookupError,
              );
            }
          }

          if (!employeeId) {
            return res.status(400).json({
              message:
                "Employee selection is required for ΕΚΤΟΣ ΕΔΡΑΣ corrections",
            });
          }

          const month = recipient.month ? String(recipient.month).trim() : "";
          if (!month) {
            return res.status(400).json({
              message: "Month selection is required for ΕΚΤΟΣ ΕΔΡΑΣ corrections",
            });
          }

          const dailyComp = Number(recipient.daily_compensation) || 0;
          const accommodation = Number(recipient.accommodation_expenses) || 0;
          const kmTraveled = Number(recipient.kilometers_traveled) || 0;
          const pricePerKm =
            recipient.price_per_km !== undefined &&
            recipient.price_per_km !== null
              ? Number(recipient.price_per_km)
              : 0.2;
          const tickets = Number(recipient.tickets_tolls_rental) || 0;
          const kmCost = kmTraveled * pricePerKm;
          const calculatedTotal = dailyComp + accommodation + kmCost + tickets;
          const totalExpense =
            recipient.total_expense !== undefined &&
            recipient.total_expense !== null
              ? Number(recipient.total_expense)
              : calculatedTotal;

          if (totalExpense <= 0) {
            return res.status(400).json({
              message:
                "Total expenses must be greater than zero for ΕΚΤΟΣ ΕΔΡΑΣ corrections",
            });
          }

          const deduction2Percent = recipient.has_2_percent_deduction
            ? totalExpense * 0.02
            : Number(recipient.deduction_2_percent) || 0;
          const netPayable =
            recipient.net_payable !== undefined &&
            recipient.net_payable !== null
              ? Number(recipient.net_payable)
              : totalExpense - deduction2Percent;

          employeePaymentPayloads.push({
            employee_id: employeeId,
            document_id: parseInt(id),
            month,
            days: Number(recipient.days) || 1,
            daily_compensation: dailyComp,
            accommodation_expenses: accommodation,
            kilometers_traveled: kmTraveled,
            price_per_km: pricePerKm,
            tickets_tolls_rental: tickets,
            has_2_percent_deduction: Boolean(recipient.has_2_percent_deduction),
            total_expense: totalExpense,
            deduction_2_percent: deduction2Percent,
            net_payable: netPayable,
            status: recipient.status || "pending",
          });
        }

        // Replace existing payments with employee payments
        await supabase
          .from("EmployeePayments")
          .delete()
          .eq("document_id", parseInt(id));
        await supabase
          .from("beneficiary_payments")
          .delete()
          .eq("document_id", parseInt(id));

        const employeePaymentIds: number[] = [];

        for (const payment of employeePaymentPayloads) {
          const { data: createdPayment, error: empInsertError } = await supabase
            .from("EmployeePayments")
            .insert(payment)
            .select("id")
            .single();

          if (empInsertError) {
            console.error(
              "[Correction] Error inserting employee payment during correction:",
              empInsertError,
            );
            return res.status(500).json({
              message:
                "Failed to create employee payment during correction for ΕΚΤΟΣ ΕΔΡΑΣ document",
              error: empInsertError.message,
            });
          }

          if (createdPayment?.id) {
            employeePaymentIds.push(createdPayment.id);
          }
        }

        await supabase
          .from("generated_documents")
          .update({
            employee_payments_id: employeePaymentIds,
            beneficiary_payments_id: [],
          })
          .eq("id", parseInt(id));
      } else {
        // Non-ΕΚΤΟΣ ΕΔΡΑΣ: refresh beneficiary payments and clear any stale employee payments
        await supabase
          .from("EmployeePayments")
          .delete()
          .eq("document_id", parseInt(id));

        // Delete existing beneficiary payments
        await supabase
          .from("beneficiary_payments")
          .delete()
          .eq("document_id", parseInt(id));

        // Create new beneficiary payments
        for (const recipient of recipients) {
          // First, try to find or create/update beneficiary
          let beneficiaryId: number | null = null;

          if (recipient.afm) {
            // Search by AFM hash (since AFM is encrypted)
            const afmHash = hashAFM(recipient.afm);
            const { data: existingBeneficiary } = await supabase
              .from("beneficiaries")
              .select("id, regiondet")
              .eq("afm_hash", afmHash)
              .single();

            if (existingBeneficiary) {
              beneficiaryId = existingBeneficiary.id;

              // Update beneficiary with latest details
              const mergedRegiondet = mergeRegiondetWithPayments(
                existingBeneficiary.regiondet,
                recipient.regiondet || null,
              );

              await supabase
                .from("beneficiaries")
                .update({
                  name: recipient.firstname,
                  surname: recipient.lastname,
                  fathername: recipient.fathername || null,
                  regiondet: mergedRegiondet,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", beneficiaryId);
            } else {
              // Create new beneficiary with encrypted AFM
              const { data: newBeneficiary } = await supabase
                .from("beneficiaries")
                .insert({
                  afm: encryptAFM(recipient.afm),
                  afm_hash: afmHash,
                  name: recipient.firstname,
                  surname: recipient.lastname,
                  fathername: recipient.fathername || null,
                  regiondet: mergeRegiondetWithPayments(
                    null,
                    recipient.regiondet || null,
                  ),
                  date: new Date().toISOString().split("T")[0],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select("id")
                .single();

              if (newBeneficiary) {
                beneficiaryId = newBeneficiary.id;
              }
            }
          }

          // Create beneficiary payment
          if (beneficiaryId) {
            const { data: paymentInsert, error: paymentInsertError } =
              await supabase
                .from("beneficiary_payments")
                .insert({
                  beneficiary_id: beneficiaryId,
                  document_id: parseInt(id),
                  installment: recipient.installment || "ΕΦΑΠΑΞ",
                  amount: recipient.amount,
                  status: recipient.status || "pending",
                  project_index_id: effectiveProjectIndexId,
                  unit_id: effectiveUnitId,
                })
                .select("id")
                .single();

            if (paymentInsertError) {
              console.error(
                "[DocumentsController] Error inserting beneficiary payment during update:",
                paymentInsertError,
              );
            } else if (paymentInsert?.id) {
              try {
                await storage.appendPaymentIdToRegiondet(
                  beneficiaryId,
                  paymentInsert.id,
                );
              } catch (appendErr) {
                console.error(
                  "[DocumentsController] Error appending payment id to regiondet:",
                  appendErr,
                );
              }
            }
          }
        }

        // Refresh beneficiary payment IDs on the document so recipients can be hydrated in UI
        const { data: refreshedPayments, error: fetchPaymentsError } =
          await supabase
            .from("beneficiary_payments")
            .select("id")
            .eq("document_id", parseInt(id));

        if (fetchPaymentsError) {
          console.error(
            "[Correction] Failed to fetch beneficiary payments after correction:",
            fetchPaymentsError,
          );
        } else {
          const paymentIds = (refreshedPayments || [])
            .map((p: any) => p.id)
            .filter(Boolean);
          const { error: updateBeneficiaryIdsError } = await supabase
            .from("generated_documents")
            .update({
              beneficiary_payments_id: paymentIds,
              employee_payments_id: [],
            })
            .eq("id", parseInt(id));

          if (updateBeneficiaryIdsError) {
            console.error(
              "[Correction] Failed to update beneficiary_payments_id after correction:",
              updateBeneficiaryIdsError,
            );
          }
        }
      }
    }

    // Broadcast correction update
    broadcastDocumentUpdate({
      type: "DOCUMENT_UPDATE",
      documentId: parseInt(id),
      data: {
        id: parseInt(id),
        is_correction: true,
        correction_reason,
      },
    });

    return res.json({
      success: true,
      message: "Correction created successfully",
      documentId: parseInt(id),
    });
  } catch (error) {
    console.error("Correction creation error:", error);
    return res.status(500).json({
      message: "Failed to create correction",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create new document
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Creating new document with provided data
    const {
      unit,
      project_id,
      expenditure_type,
      recipients,
      total_amount,
      attachments,
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message:
          "Missing required fields: recipients, project_id, unit, and expenditure_type are required",
      });
    }

    // Get project NA853 - try project_catalog first
    let projectData: any = null;
    let projectError: any = null;
    let project_na853: string = "";

    try {
      // First attempt to get from project_catalog using numeric project_id
      const result = await supabase
        .from("project_catalog")
        .select("budget_na853")
        .eq("id", project_id)
        .single();

      projectData = result.data;
      projectError = result.error;

      if (projectError || !projectData) {
        // If not found in project_catalog, try Projects table using numeric ID
        console.log(
          "[DOCUMENT_CONTROLLER] Looking up project in Projects table using numeric ID:",
          project_id,
        );

        const projectResult = await supabase
          .from("Projects")
          .select("id, mis, na853, budget_na853")
          .eq("id", project_id)
          .single();

        if (projectResult.data) {
          if (projectResult.data.na853) {
            // Found na853 in Projects table - use this as it matches the foreign key constraint
            project_na853 = String(projectResult.data.na853);
            console.log(
              "[DOCUMENT_CONTROLLER] Retrieved na853 from Projects table:",
              project_na853,
            );
          } else if (projectResult.data.budget_na853) {
            // Fall back to budget_na853 if na853 is not available
            project_na853 = String(projectResult.data.budget_na853);
            console.log(
              "[DOCUMENT_CONTROLLER] Retrieved budget_na853 from Projects table:",
              project_na853,
            );
          }
        } else if (project_id && !isNaN(Number(project_id))) {
          // Use MIS as fallback if it's a number
          project_na853 = project_id;
          console.log(
            "[DOCUMENT_CONTROLLER] Using project_id as numeric fallback:",
            project_id,
          );
        } else {
          return res.status(404).json({
            message: "Project not found and no valid fallback available",
          });
        }
      } else {
        // Found in project_catalog
        project_na853 = projectData.budget_na853;
      }
    } catch (error) {
      console.error(
        "[DOCUMENT_CONTROLLER] Error during project lookup:",
        error,
      );

      // If error happens, use project_id as numeric fallback if available and valid
      if (project_id && !isNaN(Number(project_id))) {
        project_na853 = project_id;
      } else {
        return res.status(500).json({
          message: "Error looking up project and no valid fallback available",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const now = new Date().toISOString();

    // Create document with exact schema match and set initial status to pending
    const documentPayload = {
      unit_id: parseInt(unit), // Convert unit to unit_id as integer
      status: "pending", // Always set initial status to pending
      total_amount: parseFloat(String(total_amount)) || 0,
      generated_by: req.user.id,
      created_at: now,
      updated_at: now,
    };

    // Insert document
    const { data, error } = await supabase
      .from("generated_documents")
      .insert([documentPayload])
      .select()
      .single();

    if (error) {
      console.error("Document creation error:", error);
      return res.status(500).json({
        message: "Failed to create document",
        error: error.message,
      });
    }

    // Create attachment records if provided
    if (attachments?.length && data?.id) {
      const { error: attachError } = await supabase.from("attachments").insert(
        attachments.map((att: any) => ({
          document_id: data.id,
          file_path: att.path,
          type: att.type,
          created_by: req.user?.id,
          created_at: now,
        })),
      );

      if (attachError) {
        console.error("Attachment creation error:", attachError);
        // Continue even if attachment creation fails
      }
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error("Error creating document:", error);
    return res.status(500).json({
      message: "Failed to create document",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Export document
router.get(
  "/generated/:id/export",
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    // Check format parameter to see if user wants both documents in a ZIP
    const format = req.query.format as string;
    const generateBoth = format === "both" || format === "zip";

    console.log(
      "[DocumentsController] Export request for document ID:",
      id,
      "Format:",
      format,
      "Generate both:",
      generateBoth,
    );

    try {
      // Get document with user details including gender and specialty, plus attachments
      const { data: document, error } = await supabase
        .from("generated_documents")
        .select(
          `
        *,
        generated_by:users!generated_documents_generated_by_fkey (
          name,
          email,
          department,
          telephone,
          details
        )
      `,
        )
        .eq("id", parseInt(id))
        .single();

      if (error) {
        console.error("[DocumentsController] Database query error:", error);
        throw error;
      }

      console.log(
        "[DocumentsController] Raw document from database:",
        JSON.stringify(document, null, 2),
      );

      if (!document) {
        console.error("[DocumentsController] Document not found:", id);
        return res.status(404).json({ error: "Document not found" });
      }

      const correctionReason = document.is_correction
        ? extractCorrectionReason(document)
        : undefined;

      if (document.is_correction && !correctionReason) {
        console.error(
          "[DocumentsController] Export blocked - missing correction reason for document:",
          id,
        );
        return res.status(400).json({
          error: "CORRECTION_REASON_REQUIRED",
          message:
            "Η Αιτιολογία Ορθής Επανάληψης είναι υποχρεωτική για την εξαγωγή του εγγράφου.",
        });
      }

      // BUDGET VALIDATION CHECK: Block DOCX export if document needs χρηματοδότηση approval
      // This happens when the document was saved while exceeding Κατανομή έτους budget
      if (document.needs_xrimatodotisi === true) {
        console.log("[DocumentsController] Export blocked - document needs χρηματοδότηση approval (saved flag):", id);
        return res.status(403).json({ 
          error: "DOCX export blocked",
          message: "Δεν είναι δυνατή η εξαγωγή DOCX. Το έγγραφο χρειάζεται έγκριση χρηματοδότησης επειδή υπερβαίνει την κατανομή έτους.",
          code: "NEEDS_XRIMATODOTISI"
        });
      }

      // REAL-TIME BUDGET VALIDATION: Also check current budget state for documents without the flag
      // This handles older documents or edited documents where the flag wasn't set
      if (document.project_index_id && document.total_amount) {
        try {
          // Get the project MIS from project_index
          const { data: projectIndexData } = await supabase
            .from("project_index")
            .select("project_id, Projects:project_id(mis)")
            .eq("id", document.project_index_id)
            .single();
          
          const projectsData = projectIndexData?.Projects as any;
          if (projectsData?.mis) {
            const projectMis = projectsData.mis;
            const documentAmount = parseFloat(document.total_amount) || 0;
            
            // Fetch current budget for the project
            const { data: budgetData } = await supabase
              .from("Budget")
              .select("katanomes_etous, ethsia_pistosi, user_view")
              .eq("mis", projectMis)
              .single();
            
            if (budgetData) {
              const katanomesEtous = parseFloat(budgetData.katanomes_etous) || 0;
              const userView = parseFloat(budgetData.user_view) || 0;
              
              // Check if document amount + current spending exceeds Κατανομή
              // Note: The document is already included in user_view, so we just check if user_view > katanomesEtous
              if (userView > katanomesEtous) {
                console.log("[DocumentsController] Export blocked - current budget exceeds Κατανομή έτους:", {
                  id,
                  katanomesEtous,
                  userView,
                  documentAmount
                });
                return res.status(403).json({ 
                  error: "DOCX export blocked",
                  message: "Δεν είναι δυνατή η εξαγωγή DOCX. Ο προϋπολογισμός υπερβαίνει την κατανομή έτους. Απαιτείται έγκριση χρηματοδότησης.",
                  code: "NEEDS_XRIMATODOTISI"
                });
              }
            }
          }
        } catch (budgetCheckError) {
          console.warn("[DocumentsController] Failed to validate budget for export:", budgetCheckError);
          // Continue with export if budget check fails - don't block on validation errors
        }
      }

      // Prepare document data with user name and contact information
      // Also fetch missing data needed for document generation
      let projectData: any = null;
      let beneficiaryData: any[] = [];
      let attachmentsData: any[] = [];
      let expenditureType = "ΔΑΠΑΝΗ"; // Default fallback

      // Fetch related project data if project_index_id exists
      let forYlData: { id: number; title: string; monada_id: string } | null = null;
      
      if (document.project_index_id) {
        try {
          const { data: projectIndexData, error: projectIndexError } =
            await supabase
              .from("project_index")
              .select(
                `
            id,
            project_id,
            for_yl_id,
            Projects:project_id (
              id,
              na853,
              project_title,
              event_description,
              mis
            ),
            expenditure_types:expenditure_type_id (
              id,
              expenditure_types
            )
          `,
              )
              .eq("id", document.project_index_id)
              .single();
          
          // Fetch for_yl data if for_yl_id exists in project_index
          if (!projectIndexError && projectIndexData?.for_yl_id) {
            const { data: forYl } = await supabase
              .from("for_yl")
              .select("id, title, monada_id")
              .eq("id", projectIndexData.for_yl_id)
              .single();
            
            if (forYl) {
              forYlData = forYl as { id: number; title: string; monada_id: string };
              console.log("[DocumentsController] Using for_yl from project_index:", forYlData.title);
            }
          }
          
          // Fallback: Check if for_yl is stored in the document's region JSONB
          if (!forYlData && document.region && typeof document.region === 'object') {
            const regionData = document.region as { for_yl_id?: number; for_yl_title?: string };
            if (regionData.for_yl_id) {
              // If we have the title in region, use it directly
              if (regionData.for_yl_title) {
                forYlData = { 
                  id: regionData.for_yl_id, 
                  title: regionData.for_yl_title, 
                  monada_id: '' 
                };
                console.log("[DocumentsController] Using for_yl from region JSONB:", forYlData.title);
              } else {
                // Otherwise fetch from database
                const { data: forYl } = await supabase
                  .from("for_yl")
                  .select("id, title, monada_id")
                  .eq("id", regionData.for_yl_id)
                  .single();
                
                if (forYl) {
                  forYlData = forYl as { id: number; title: string; monada_id: string };
                  console.log("[DocumentsController] Using for_yl from region JSONB (fetched):", forYlData.title);
                }
              }
            }
          }

          if (!projectIndexError && projectIndexData) {
            projectData = projectIndexData.Projects;
            const fetchedExpenditure = (
              projectIndexData.expenditure_types as any
            )?.expenditure_types;
            if (fetchedExpenditure && fetchedExpenditure !== "ΔΑΠΑΝΗ") {
              expenditureType = fetchedExpenditure;
              console.log(
                "[DocumentsController] Using project expenditure type:",
                expenditureType,
              );
            } else {
              console.log(
                "[DocumentsController] No valid expenditure type from project, checking project_index details...",
              );
              console.log(
                "[DocumentsController] ProjectIndexData:",
                JSON.stringify(projectIndexData, null, 2),
              );
            }
          }
        } catch (error) {
          logger.debug("Error fetching project data for document:", error);
          console.log("[DocumentsController] Project data fetch error:", error);
        }
      } else {
        console.log(
          "[DocumentsController] No project_index_id found for document:",
          document.id,
        );
        console.log(
          "[DocumentsController] Document data keys:",
          Object.keys(document),
        );

        // Try alternative approaches to find expenditure type
        console.log(
          "[DocumentsController] Looking for expenditure type in document fields...",
        );
        console.log(
          "[DocumentsController] Document total_amount:",
          document.total_amount,
        );
        console.log(
          "[DocumentsController] Document comments:",
          document.comments,
        );

        // If we have beneficiary payments, we might be able to infer the type
        if (beneficiaryData.length > 0) {
          const hasInstallments = beneficiaryData.some(
            (b) => b.installment && b.installment.includes("ΤΡΙΜΗΝΟ"),
          );
          if (hasInstallments) {
            console.log(
              "[DocumentsController] Found installment payments, likely ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ",
            );
            expenditureType = "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ";
          }
        }
      }

      // Fetch employee payments data for ΕΚΤΟΣ ΕΔΡΑΣ documents
      if (
        document.employee_payments_id &&
        Array.isArray(document.employee_payments_id) &&
        document.employee_payments_id.length > 0
      ) {
        try {
          console.log(`[DocumentsController] Fetching employee payments for export, IDs:`, document.employee_payments_id);
          
          const { data: empPaymentsData, error: empPaymentsError } = await supabase
            .from("EmployeePayments")
            .select(
              `
            id,
            net_payable,
            month,
            days,
            daily_compensation,
            accommodation_expenses,
            kilometers_traveled,
            tickets_tolls_rental,
            has_2_percent_deduction,
            total_expense,
            deduction_2_percent,
            status,
            Employees (
              id,
              afm,
              surname,
              name,
              fathername,
              klados
            )
          `,
            )
            .in("id", document.employee_payments_id);

          if (!empPaymentsError && empPaymentsData) {
            beneficiaryData = empPaymentsData.map((payment: any) => {
              const employee = payment.Employees;
              const encryptedAFM = employee?.afm || "";
              // SECURITY: Decrypt AFM for document generation
              const decryptedAFM = encryptedAFM ? decryptAFM(encryptedAFM) : "";
              
              return {
                id: payment.id,
                firstname: employee?.name || "",
                lastname: employee?.surname || "",
                fathername: employee?.fathername || "",
                afm: decryptedAFM,
                amount: parseFloat(payment.net_payable || "0"),
                // ΕΚΤΟΣ ΕΔΡΑΣ specific fields
                month: payment.month || "",
                days: payment.days || 1,
                daily_compensation: payment.daily_compensation || 0,
                accommodation_expenses: payment.accommodation_expenses || 0,
                kilometers_traveled: payment.kilometers_traveled || 0,
                tickets_tolls_rental: payment.tickets_tolls_rental || 0,
              };
            });
            console.log(`[DocumentsController] Fetched ${beneficiaryData.length} employee payment records for export`);
          }
        } catch (error) {
          logger.debug("Error fetching employee payment data for document:", error);
        }
      }
      // Fetch beneficiary payments data for standard documents
      else if (
        document.beneficiary_payments_id &&
        document.beneficiary_payments_id.length > 0
      ) {
        try {
          const { data: paymentsData, error: paymentsError } = await supabase
            .from("beneficiary_payments")
            .select(
              `
            id,
            amount,
            installment,
            freetext,
            eps,
            beneficiaries:beneficiary_id (
              id,
              afm,
              surname,
              name,
              fathername
            )
          `,
            )
            .in("id", document.beneficiary_payments_id);

          if (!paymentsError && paymentsData) {
            beneficiaryData = paymentsData.map((payment: any) => {
              const encryptedAFM = (payment.beneficiaries as any)?.afm || "";
              // SECURITY: Decrypt AFM for document generation
              const decryptedAFM = encryptedAFM ? decryptAFM(encryptedAFM) : "";
              
              return {
                id: payment.id,
                firstname: (payment.beneficiaries as any)?.name || "",
                lastname: (payment.beneficiaries as any)?.surname || "",
                fathername: (payment.beneficiaries as any)?.fathername || "",
                afm: decryptedAFM,
                amount: parseFloat(payment.amount || "0"),
                installment: payment.installment || "ΕΦΑΠΑΞ",
                freetext: payment.eps ?? payment.freetext ?? null,
                eps: payment.eps ?? payment.freetext ?? null,
              };
            });
          }
        } catch (error) {
          logger.debug("Error fetching beneficiary data for document:", error);
        }
      }

      // Fetch attachments data if attachment_id exists (corrected field name)
      if (document.attachment_id && document.attachment_id.length > 0) {
        try {
          const { data: attachments, error: attachmentsError } = await supabase
            .from("attachments")
            .select("*")
            .in("id", document.attachment_id);

          if (!attachmentsError && attachments) {
            // Transform attachments to the format expected by document generators
            // Use 'atachments' field as per database schema (note: typo in original schema)
            attachmentsData = attachments.map(
              (att: any) =>
                att.atachments || att.original_name || att.filename || att.name,
            );
            console.log(
              "[DocumentsController] Fetched attachments:",
              attachmentsData.length,
              attachmentsData,
            );
          }
        } catch (error) {
          logger.debug("Error fetching attachments data for document:", error);
        }
      } else {
        // Fallback: check if document has a simple attachments field with text array
        if (document.attachments && Array.isArray(document.attachments)) {
          attachmentsData = document.attachments;
          console.log(
            "[DocumentsController] Using existing attachments field:",
            attachmentsData.length,
            attachmentsData,
          );
        }
      }

      console.log(
        "[DocumentsController] Beneficiary data for export:",
        beneficiaryData.length,
        "recipients",
      );
      console.log(
        "[DocumentsController] AFM data check:",
        beneficiaryData.map((b) => ({
          name: `${b.firstname} ${b.lastname}`,
          afm: b.afm,
          afm_type: typeof b.afm,
          afm_length: b.afm ? b.afm.length : 0,
          all_fields: Object.keys(b),
        })),
      );
      console.log(
        "[DocumentsController] Attachments data for export:",
        attachmentsData.length,
        "attachments",
      );
      console.log(
        "[DocumentsController] Full document data being passed to generators:",
        {
          recipients: beneficiaryData.length,
          attachments: attachmentsData.length,
          hasRecipients: beneficiaryData.length > 0,
          hasAttachments: attachmentsData.length > 0,
        },
      );

      const documentData = {
        ...document,
        correction_reason: correctionReason || document.correction_reason || "",
        user_name: document.generated_by?.name || "Unknown User",
        department: document.generated_by?.department || "",
        contact_number: document.generated_by?.telephone || "",
        // Map unit_id to unit for compatibility with existing document generators
        unit: document.unit_id?.toString() || "2", // Default to unit 2 as fallback
        // Add project data
        project_na853: (projectData as any)?.na853 || "",
        project_title:
          (projectData as any)?.project_title ||
          (projectData as any)?.event_description ||
          "",
        expenditure_type: expenditureType,
        // Add recipients data
        recipients: beneficiaryData,
        // Add attachments data
        attachments: attachmentsData,
        // Add for_yl data (delegated implementing agency)
        for_yl: forYlData,
      };

      console.log(
        "[DocumentsController] ESDIAN Debug - ESDIAN is array:",
        Array.isArray(document.esdian),
      );

      // If generating a single document (old behavior)
      if (!generateBoth) {
        console.log(
          "[DocumentsController] Generating single document for export",
        );

        // For regular documents, use the standard document generation
        const primaryBuffer =
          await DocumentGenerator.generatePrimaryDocument(documentData);

        // Set response headers for DOCX file
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=document-${id}.docx`,
        );
        res.send(primaryBuffer);
        return;
      }

      // If we're here, the user wants both documents in a ZIP file
      console.log(
        "[DocumentsController] Generating both documents for ZIP export",
      );

      // Generate primary document
      const primaryBuffer =
        await DocumentGenerator.generatePrimaryDocument(documentData);

      // Generate secondary document
      const { SecondaryDocumentFormatter } = await import(
        "../utils/secondary-document-formatter"
      );
      const secondaryBuffer =
        await SecondaryDocumentFormatter.generateSecondDocument(documentData);

      // Create a ZIP file containing both documents
      const zip = new JSZip();

      // Add both documents to the ZIP
      zip.file(
        `document-primary-${document.id.toString().padStart(6, "0")}.docx`,
        primaryBuffer,
      );
      zip.file(
        `document-supplementary-${document.id.toString().padStart(6, "0")}.docx`,
        secondaryBuffer,
      );

      // Generate the ZIP file
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      // Set response headers for ZIP file
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=documents-${id}.zip`,
      );
      res.send(zipBuffer);
      console.log(
        "[DocumentsController] ZIP file with both documents sent successfully",
      );
    } catch (error) {
      console.error("[DocumentsController] Export error:", error);
      res.status(500).json({
        error: "Failed to export document",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// GET /api/documents/:id/beneficiaries - Get beneficiary or employee payments for a document
router.get(
  "/:id/beneficiaries",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      // First, get the document to check if it has employee_payments_id
      const { data: document, error: docError } = await supabase
        .from("generated_documents")
        .select("employee_payments_id, beneficiary_payments_id")
        .eq("id", documentId)
        .single();

      if (docError) {
        console.error("Error fetching document:", docError);
        return res.status(500).json({
          message: "Failed to fetch document",
          error: docError.message,
        });
      }

      // Check if this is an ΕΚΤΟΣ ΕΔΡΑΣ document (has employee_payments_id)
      if (
        document?.employee_payments_id &&
        Array.isArray(document.employee_payments_id) &&
        document.employee_payments_id.length > 0
      ) {
        // Fetch employee payments
        const { data: empPayments, error: empPaymentsError } = await supabase
          .from("EmployeePayments")
          .select(
            `
            id,
            net_payable,
            month,
            days,
            daily_compensation,
            accommodation_expenses,
            kilometers_traveled,
            tickets_tolls_rental,
            has_2_percent_deduction,
            total_expense,
            deduction_2_percent,
            status,
            Employees (
              id,
              afm,
              surname,
              name,
              fathername,
              klados
            )
          `,
          )
          .in("id", document.employee_payments_id);

        if (empPaymentsError) {
          console.error("Error fetching employee payments:", empPaymentsError);
          return res.status(500).json({
            message: "Failed to fetch employee payments",
            error: empPaymentsError.message,
          });
        }

        // Transform employee payments into recipients format
        const recipients = (empPayments || []).map((payment) => {
          const employee = Array.isArray(payment.Employees)
            ? payment.Employees[0]
            : payment.Employees;
          return {
            id: payment.id,
            employee_id: employee?.id,
            firstname: employee?.name || "",
            lastname: employee?.surname || "",
            fathername: employee?.fathername || "",
            afm: employee?.afm ? decryptAFM(employee.afm) || "" : "",
            amount: parseFloat(payment.net_payable) || 0,
            month: payment.month || "",
            days: payment.days || 0,
            daily_compensation: payment.daily_compensation || 0,
            accommodation_expenses: payment.accommodation_expenses || 0,
            kilometers_traveled: payment.kilometers_traveled || 0,
            tickets_tolls_rental: payment.tickets_tolls_rental || 0,
            tickets_tolls_rental_entries: [], // Empty array - field not stored in DB
            has_2_percent_deduction: payment.has_2_percent_deduction ?? false,
            total_expense: payment.total_expense ?? 0,
            deduction_2_percent: payment.deduction_2_percent ?? 0,
            status: payment.status || "pending",
            secondary_text: employee?.klados || "",
          };
        });

        return res.json(recipients);
      }

      // Otherwise, fetch beneficiary payments (standard flow)
      const { data: payments, error } = await supabase
        .from("beneficiary_payments")
        .select(
          `
        id,
        beneficiary_id,
        amount,
        installment,
        status,
        payment_date,
        freetext,
        eps,
        beneficiaries (
          id,
          afm,
          surname,
          name,
          fathername,
          regiondet
        )
      `,
        )
        .eq("document_id", documentId);

      if (error) {
        console.error("Error fetching beneficiary payments:", error);
        return res.status(500).json({
          message: "Failed to fetch beneficiary payments",
          error: error.message,
        });
      }

      // Decrypt AFM fields in beneficiary data
      const paymentsWithDecryptedAFM = (payments || []).map((payment) => {
        const beneficiary = Array.isArray(payment.beneficiaries)
          ? payment.beneficiaries[0]
          : payment.beneficiaries;
        const epsValue = payment.eps ?? payment.freetext ?? null;
        
        return {
          ...payment,
          eps: epsValue,
          freetext: epsValue,
          beneficiaries: beneficiary ? {
            ...beneficiary,
            afm: decryptAFM(beneficiary.afm) || ""
          } : null
        };
      });

      res.json(paymentsWithDecryptedAFM);
    } catch (error) {
      console.error("Error in beneficiaries endpoint:", error);
      res.status(500).json({
        message: "Failed to fetch beneficiary payments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// PUT /api/documents/:id/beneficiaries - Update beneficiary or employee payments for a document
router.put(
  "/:id/beneficiaries",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const { recipients } = req.body;

      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      if (!Array.isArray(recipients)) {
        return res.status(400).json({ message: "Recipients must be an array" });
      }

      if (recipients.length === 0) {
        return res.status(400).json({ message: "At least one recipient is required" });
      }

      // Check if this is an ΕΚΤΟΣ ΕΔΡΑΣ document by checking expenditure type
      const { data: document, error: docError } = await supabase
        .from("generated_documents")
        .select(`
          employee_payments_id, 
          beneficiary_payments_id,
          project_index!inner (
            expenditure_type_id,
            expenditure_types!inner (
              expenditure_types
            )
          )
        `)
        .eq("id", documentId)
        .single();

      if (docError) {
        console.error("Error fetching document:", docError);
        return res.status(500).json({
          message: "Failed to fetch document",
          error: docError.message,
        });
      }

      // Check if expenditure type is ΕΚΤΟΣ ΕΔΡΑΣ
      const expenditureType = (document as any)?.project_index?.expenditure_types?.expenditure_types;
      const isEktosEdras = expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ";

      if (isEktosEdras) {
        // Handle employee payments update for ΕΚΤΟΣ ΕΔΡΑΣ
        const updatedPayments = [];
        const newEmployeePaymentIds = [];

        console.log('[EmployeePayments] Received recipients for ΕΚΤΟΣ ΕΔΡΑΣ:', JSON.stringify(recipients, null, 2));

        for (const recipient of recipients) {
          if (recipient.id) {
            // Update existing employee payment
            console.log('[EmployeePayments] Updating payment ID', recipient.id, 'with recipient data:', recipient);
            
            const { data: updatedPayment, error } = await supabase
              .from("EmployeePayments")
              .update({
                net_payable: recipient.amount?.toString() ?? recipient.net_payable?.toString() ?? "0",
                month: recipient.month ?? "",
                days: recipient.days ?? 0,
                daily_compensation: recipient.daily_compensation ?? 0,
                accommodation_expenses: recipient.accommodation_expenses ?? 0,
                kilometers_traveled: recipient.kilometers_traveled ?? 0,
                tickets_tolls_rental: recipient.tickets_tolls_rental ?? 0,
                has_2_percent_deduction: recipient.has_2_percent_deduction ?? false,
                total_expense: recipient.total_expense ?? 0,
                deduction_2_percent: recipient.deduction_2_percent ?? 0,
                status: recipient.status ?? "pending",
              })
              .eq("id", recipient.id)
              .select()
              .single();
              
            console.log('[EmployeePayments] Update result:', { error, updatedPayment });

            if (error) {
              console.error("Error updating employee payment:", error);
              return res.status(500).json({
                message: "Failed to update employee payment",
                error: error.message,
              });
            }

            updatedPayments.push(updatedPayment);
          } else if (recipient.afm && recipient.firstname && recipient.lastname) {
            // Create new employee payment
            // First, find or create the employee
            let employeeId = recipient.employee_id;

            if (!employeeId && recipient.afm) {
              // Try to find existing employee by AFM hash
              const afmHash = hashAFM(recipient.afm);
              const { data: existingEmployee } = await supabase
                .from("Employees")
                .select("id")
                .eq("afm_hash", afmHash)
                .single();

              if (existingEmployee) {
                employeeId = existingEmployee.id;
              } else {
                // Create new employee with encrypted AFM
                const encryptedAFM = encryptAFM(recipient.afm);
                const { data: newEmployee, error: employeeError } = await supabase
                  .from("Employees")
                  .insert({
                    name: recipient.firstname,
                    surname: recipient.lastname,
                    fathername: recipient.fathername || null,
                    afm: encryptedAFM,
                    afm_hash: afmHash,
                    klados: recipient.secondary_text || null,
                  })
                  .select("id")
                  .single();

                if (employeeError) {
                  console.error("Error creating employee:", employeeError);
                  continue;
                }

                employeeId = newEmployee.id;
              }
            }

            // Create employee payment
            const { data: newPayment, error: paymentError } = await supabase
              .from("EmployeePayments")
              .insert({
                employee_id: employeeId,
                document_id: documentId,
                net_payable: recipient.amount?.toString() || "0",
                month: recipient.month || "",
                days: recipient.days || 0,
                daily_compensation: recipient.daily_compensation || 0,
                accommodation_expenses: recipient.accommodation_expenses || 0,
                kilometers_traveled: recipient.kilometers_traveled || 0,
                tickets_tolls_rental: recipient.tickets_tolls_rental || 0,
                has_2_percent_deduction: recipient.has_2_percent_deduction ?? false,
                total_expense: recipient.total_expense ?? 0,
                deduction_2_percent: recipient.deduction_2_percent ?? 0,
                status: recipient.status || "pending",
              })
              .select()
              .single();

            if (paymentError) {
              console.error("Error creating employee payment:", paymentError);
              continue;
            }

            updatedPayments.push(newPayment);
            newEmployeePaymentIds.push(newPayment.id);
          }
        }

        // Update document with new employee payment IDs if any were created
        if (newEmployeePaymentIds.length > 0) {
          const existingIds = document.employee_payments_id || [];
          const allIds = [...existingIds, ...newEmployeePaymentIds];
          
          const { error: updateError } = await supabase
            .from("generated_documents")
            .update({ employee_payments_id: allIds })
            .eq("id", documentId);

          if (updateError) {
            console.error("Error updating document with new employee payment IDs:", updateError);
          }
        }

        // Calculate new total amount from all updated employee payments
        const newTotalAmount = recipients.reduce((sum, recipient) => {
          return sum + (parseFloat(recipient.amount?.toString() || '0') || 0);
        }, 0);

        // Get current document data for budget reconciliation
        const { data: currentDoc, error: docFetchError } = await supabase
          .from("generated_documents")
          .select("total_amount, project_index_id")
          .eq("id", documentId)
          .single();

        if (docFetchError) {
          console.error("Error fetching document for budget reconciliation:", docFetchError);
        } else if (currentDoc) {
          const oldAmount = parseFloat(String(currentDoc.total_amount || 0));
          const oldProjectIndexId = currentDoc.project_index_id;

          // Update document total_amount if changed
          if (Math.abs(newTotalAmount - oldAmount) > 0.001) {
            const { error: totalUpdateError } = await supabase
              .from("generated_documents")
              .update({ total_amount: newTotalAmount })
              .eq("id", documentId);

            if (totalUpdateError) {
              console.error("Error updating document total_amount:", totalUpdateError);
            } else {
              console.log(`[EmployeePayments] Updated document ${documentId} total_amount: ${oldAmount} -> ${newTotalAmount}`);
            }

            // Trigger budget reconciliation for amount change
            if (oldProjectIndexId && req.user?.id) {
              try {
                // Get actual project ID from project_index
                const { data: projectIndex, error: projectError } = await supabase
                  .from("project_index")
                  .select("project_id")
                  .eq("id", oldProjectIndexId)
                  .single();

                if (projectError) {
                  console.error(`[EmployeePayments] ERROR: Failed to fetch project_index ${oldProjectIndexId}:`, projectError);
                } else if (!projectIndex?.project_id) {
                  console.error(`[EmployeePayments] ERROR: project_index ${oldProjectIndexId} has no project_id`);
                } else {
                  const projectId = projectIndex.project_id;
                  await storage.reconcileBudgetOnDocumentEdit(
                    documentId,
                    projectId,
                    projectId, // Same project, amount changed
                    oldAmount,
                    newTotalAmount,
                    req.user.id
                  );
                  console.log(`[EmployeePayments] Budget reconciled for document ${documentId}: amount changed from ${oldAmount} to ${newTotalAmount}`);
                }
              } catch (budgetError) {
                console.error("[EmployeePayments] Error reconciling budget:", budgetError);
                // Don't fail the update if budget reconciliation fails
              }
            } else if (oldProjectIndexId && !req.user?.id) {
              console.error(`[EmployeePayments] WARNING: Skipping budget reconciliation for document ${documentId} - no user ID available`);
            }
          }
        }

        return res.json(updatedPayments);
      }

      // Handle standard beneficiary payments
      const updatedPayments: any[] = [];
      const createdPayments: any[] = [];

      const { data: existingPayments, error: existingPaymentsError } = await supabase
        .from("beneficiary_payments")
        .select("id, beneficiary_id")
        .eq("document_id", documentId);

      if (existingPaymentsError) {
        console.error("Error fetching current beneficiary payments:", existingPaymentsError);
        return res.status(500).json({
          message: "Failed to fetch current beneficiary payments",
          error: existingPaymentsError.message,
        });
      }

      const existingPaymentMap = new Map<number, { id: number; beneficiary_id: number | null }>(
        (existingPayments || []).map((payment: any) => [
          Number(payment.id),
          {
            id: Number(payment.id),
            beneficiary_id:
              payment.beneficiary_id !== null && payment.beneficiary_id !== undefined
                ? Number(payment.beneficiary_id)
                : null,
          },
        ]),
      );

      const syncPlan = buildBeneficiaryRecipientSyncPlan(
        recipients,
        Array.from(existingPaymentMap.keys()),
      );

      if (!syncPlan.ok) {
        return res.status(syncPlan.status).json({
          message: syncPlan.message,
          ...(syncPlan.details ? { details: syncPlan.details } : {}),
        });
      }

      const { toUpdate, toCreate, toDeleteIds } = syncPlan;

      for (const recipient of toUpdate) {
        const existingPayment = existingPaymentMap.get(recipient.id)!;

        // Update beneficiary information if we have it
        if (
          existingPayment.beneficiary_id &&
          (recipient.firstname ||
            recipient.lastname ||
            recipient.fathername ||
            recipient.afm)
        ) {
          const beneficiaryUpdate: any = {};
          if (recipient.firstname) beneficiaryUpdate.name = recipient.firstname;
          if (recipient.lastname) beneficiaryUpdate.surname = recipient.lastname;
          if (recipient.fathername) beneficiaryUpdate.fathername = recipient.fathername;
          if (recipient.afm) {
            beneficiaryUpdate.afm = encryptAFM(recipient.afm);
            beneficiaryUpdate.afm_hash = hashAFM(recipient.afm);
          }

          if (Object.keys(beneficiaryUpdate).length > 0) {
            const { error: beneficiaryError } = await supabase
              .from("beneficiaries")
              .update(beneficiaryUpdate)
              .eq("id", existingPayment.beneficiary_id);

            if (beneficiaryError) {
              console.error("Error updating beneficiary:", beneficiaryError);
              return res.status(500).json({
                message: "Failed to update beneficiary",
                error: beneficiaryError.message,
              });
            }
          }
        }

        // Update payment information
        const { data: updatedPayment, error } = await supabase
          .from("beneficiary_payments")
          .update({
            amount: recipient.amount?.toString(),
            installment: recipient.installment || "ΕΦΑΠΑΞ",
            status: recipient.status || "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id)
          .eq("document_id", documentId)
          .select()
          .single();

        if (error) {
          console.error("Error updating beneficiary payment:", error);
          return res.status(500).json({
            message: "Failed to update beneficiary payment",
            error: error.message,
          });
        }

        updatedPayments.push(updatedPayment);
      }

      for (const recipient of toCreate) {
        if (!recipient.afm || !recipient.firstname || !recipient.lastname) {
          return res.status(400).json({
            message: "Recipient is missing required fields",
            details: { required: ["firstname", "lastname", "afm"] },
          });
        }

        const afmHash = hashAFM(recipient.afm);
        const encryptedAFM = encryptAFM(recipient.afm);

        const { data: existingBeneficiary, error: existingBeneficiaryError } = await supabase
          .from("beneficiaries")
          .select("id")
          .eq("afm_hash", afmHash)
          .maybeSingle();

        if (existingBeneficiaryError) {
          console.error("Error searching beneficiary by AFM hash:", existingBeneficiaryError);
          return res.status(500).json({
            message: "Failed to search beneficiary by AFM",
            error: existingBeneficiaryError.message,
          });
        }

        let beneficiaryId = existingBeneficiary?.id as number | undefined;

        if (!beneficiaryId) {
          const { data: newBeneficiary, error: beneficiaryError } = await supabase
            .from("beneficiaries")
            .insert({
              name: recipient.firstname,
              surname: recipient.lastname,
              fathername: recipient.fathername || null,
              afm: encryptedAFM,
              afm_hash: afmHash,
            })
            .select("id")
            .single();

          if (beneficiaryError || !newBeneficiary) {
            console.error("Error creating beneficiary:", beneficiaryError);
            return res.status(500).json({
              message: "Failed to create beneficiary",
              error: beneficiaryError?.message,
            });
          }

          beneficiaryId = newBeneficiary.id;
        }

        const { data: newPayment, error: paymentError } = await supabase
          .from("beneficiary_payments")
          .insert({
            document_id: documentId,
            beneficiary_id: beneficiaryId,
            amount: recipient.amount?.toString() || "0",
            installment: recipient.installment || "ΕΦΑΠΑΞ",
            status: recipient.status || "pending",
          })
          .select()
          .single();

        if (paymentError) {
          console.error("Error creating beneficiary payment:", paymentError);
          return res.status(500).json({
            message: "Failed to create beneficiary payment",
            error: paymentError.message,
          });
        }

        createdPayments.push(newPayment);
      }

      if (toDeleteIds.length > 0) {
        const { error: deletePaymentsError } = await supabase
          .from("beneficiary_payments")
          .delete()
          .eq("document_id", documentId)
          .in("id", toDeleteIds);

        if (deletePaymentsError) {
          console.error("Error deleting removed beneficiary payments:", deletePaymentsError);
          return res.status(500).json({
            message: "Failed to delete removed beneficiary payments",
            error: deletePaymentsError.message,
          });
        }
      }

      const { data: finalPayments, error: finalPaymentsError } = await supabase
        .from("beneficiary_payments")
        .select("id, amount, installment, status, beneficiary_id")
        .eq("document_id", documentId)
        .order("id", { ascending: true });

      if (finalPaymentsError) {
        console.error("Error fetching final beneficiary payments:", finalPaymentsError);
        return res.status(500).json({
          message: "Failed to fetch final beneficiary payments",
          error: finalPaymentsError.message,
        });
      }

      const finalPaymentIds = (finalPayments || []).map((payment: any) => Number(payment.id));
      const { error: documentPaymentSyncError } = await supabase
        .from("generated_documents")
        .update({ beneficiary_payments_id: finalPaymentIds })
        .eq("id", documentId);

      if (documentPaymentSyncError) {
        console.error(
          "Error syncing generated_documents.beneficiary_payments_id:",
          documentPaymentSyncError,
        );
        return res.status(500).json({
          message: "Failed to sync document beneficiary payment IDs",
          error: documentPaymentSyncError.message,
        });
      }

      // Calculate new total amount from final persisted beneficiary payments
      const newTotalAmount = (finalPayments || []).reduce((sum: number, payment: any) => {
        return sum + (parseFloat(String(payment.amount || "0")) || 0);
      }, 0);

      // Get current document data for budget reconciliation
      const { data: currentDoc, error: docFetchError } = await supabase
        .from("generated_documents")
        .select("total_amount, project_index_id")
        .eq("id", documentId)
        .single();

      if (docFetchError) {
        console.error("Error fetching document for budget reconciliation:", docFetchError);
      } else if (currentDoc) {
        const oldAmount = parseFloat(String(currentDoc.total_amount || 0));
        const oldProjectIndexId = currentDoc.project_index_id;

        // Update document total_amount if changed
        if (Math.abs(newTotalAmount - oldAmount) > 0.001) {
          const { error: totalUpdateError } = await supabase
            .from("generated_documents")
            .update({ total_amount: newTotalAmount })
            .eq("id", documentId);

          if (totalUpdateError) {
            console.error("Error updating document total_amount:", totalUpdateError);
          } else {
            console.log(`[BeneficiaryPayments] Updated document ${documentId} total_amount: ${oldAmount} -> ${newTotalAmount}`);
          }

          // Trigger budget reconciliation for amount change
          if (oldProjectIndexId && req.user?.id) {
            try {
              // Get actual project ID from project_index
              const { data: projectIndex, error: projectError } = await supabase
                .from("project_index")
                .select("project_id")
                .eq("id", oldProjectIndexId)
                .single();

              if (projectError) {
                console.error(`[BeneficiaryPayments] ERROR: Failed to fetch project_index ${oldProjectIndexId}:`, projectError);
              } else if (!projectIndex?.project_id) {
                console.error(`[BeneficiaryPayments] ERROR: project_index ${oldProjectIndexId} has no project_id`);
              } else {
                const projectId = projectIndex.project_id;
                await storage.reconcileBudgetOnDocumentEdit(
                  documentId,
                  projectId,
                  projectId, // Same project, amount changed
                  oldAmount,
                  newTotalAmount,
                  req.user.id
                );
                console.log(`[BeneficiaryPayments] Budget reconciled for document ${documentId}: amount changed from ${oldAmount} to ${newTotalAmount}`);
              }
            } catch (budgetError) {
              console.error("[BeneficiaryPayments] Error reconciling budget:", budgetError);
              // Don't fail the update if budget reconciliation fails
            }
          } else if (oldProjectIndexId && !req.user?.id) {
            console.error(`[BeneficiaryPayments] WARNING: Skipping budget reconciliation for document ${documentId} - no user ID available`);
          }
        }
      }

      res.json({
        message: "Beneficiaries and payments updated successfully",
        payments: finalPayments || [...updatedPayments, ...createdPayments],
        count: (finalPayments || []).length,
        deleted_count: toDeleteIds.length,
        payment_ids: finalPaymentIds,
      });
    } catch (error) {
      console.error("Error updating beneficiary payments:", error);
      res.status(500).json({
        message: "Failed to update beneficiary payments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * DELETE /api/documents/generated/:id
 * Delete a generated document (only if it hasn't received a protocol number yet)
 * This will:
 * 1. Check if document has a protocol number - if yes, block deletion
 * 2. Delete associated beneficiary payments FIRST (to avoid FK constraint)
 * 3. Delete associated employee payments (for ΕΚΤΟΣ ΕΔΡΑΣ documents)
 * 4. Delete the document (after all payment references are removed)
 * 5. Return the budget amount to the project (only after document is successfully deleted)
 */
router.delete(
  "/generated/:id",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          message: "Μη έγκυρο ID εγγράφου",
        });
      }

      // Fetch document with all necessary fields for deletion logic
      const { data: existingDocument, error: fetchError } = await supabase
        .from("generated_documents")
        .select("id, generated_by, protocol_number_input, total_amount, project_index_id, beneficiary_payments_id")
        .eq("id", documentId)
        .single();

      if (fetchError || !existingDocument) {
        return res.status(404).json({
          success: false,
          message: "Το έγγραφο δεν βρέθηκε",
        });
      }

      // BLOCK DELETION: Check if document has a protocol number
      // Documents with protocol numbers cannot be deleted
      if (existingDocument.protocol_number_input && existingDocument.protocol_number_input.trim() !== "") {
        return res.status(400).json({
          success: false,
          message: "Δεν μπορείτε να διαγράψετε έγγραφο που έχει ήδη αριθμό πρωτοκόλλου. Μόνο έγγραφα χωρίς πρωτόκολλο μπορούν να διαγραφούν.",
        });
      }

      // Authorization check - only allow user who created the document or manager to delete
      if (
        req.user?.role !== "manager" &&
        existingDocument.generated_by !== req.user?.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Δεν έχετε άδεια να διαγράψετε αυτό το έγγραφο",
        });
      }

      console.log(`[DocumentsController] Deleting document ${documentId} - deleting payments first, then returning budget, then deleting document`);

      // Store document info needed for cleanup
      const projectIndexId = existingDocument.project_index_id;
      const totalAmount = existingDocument.total_amount;

      // STEP 1: Delete associated beneficiary payments FIRST (to avoid foreign key constraint)
      const { data: linkedPayments, error: paymentsError } = await supabase
        .from("beneficiary_payments")
        .select("id")
        .eq("document_id", documentId);

      if (!paymentsError && linkedPayments && linkedPayments.length > 0) {
        const paymentIds = linkedPayments.map(p => p.id);
        
        const { error: deletePaymentsError } = await supabase
          .from("beneficiary_payments")
          .delete()
          .in("id", paymentIds);

        if (deletePaymentsError) {
          console.error("[DocumentsController] Error deleting beneficiary payments:", deletePaymentsError);
          return res.status(500).json({
            success: false,
            message: "Σφάλμα κατά τη διαγραφή των πληρωμών δικαιούχων",
            error: deletePaymentsError.message,
          });
        }
        console.log(`[DocumentsController] Deleted ${paymentIds.length} beneficiary payment(s) for document ${documentId}`);
      }

      // STEP 2: Delete employee payments if any exist (for ΕΚΤΟΣ ΕΔΡΑΣ documents)
      const { data: linkedEmployeePayments, error: employeePaymentsError } = await supabase
        .from("employee_payments")
        .select("id")
        .eq("document_id", documentId);

      if (!employeePaymentsError && linkedEmployeePayments && linkedEmployeePayments.length > 0) {
        const employeePaymentIds = linkedEmployeePayments.map(p => p.id);
        
        const { error: deleteEmployeePaymentsError } = await supabase
          .from("employee_payments")
          .delete()
          .in("id", employeePaymentIds);

        if (deleteEmployeePaymentsError) {
          console.error("[DocumentsController] Error deleting employee payments:", deleteEmployeePaymentsError);
          return res.status(500).json({
            success: false,
            message: "Σφάλμα κατά τη διαγραφή των πληρωμών υπαλλήλων",
            error: deleteEmployeePaymentsError.message,
          });
        }
        console.log(`[DocumentsController] Deleted ${employeePaymentIds.length} employee payment(s) for document ${documentId}`);
      }

      // STEP 3: Delete the document (after all payment references are removed)
      const { error: deleteError } = await supabase
        .from("generated_documents")
        .delete()
        .eq("id", documentId);

      if (deleteError) {
        console.error("Error deleting document:", deleteError);
        return res.status(500).json({
          success: false,
          message: "Σφάλμα κατά τη διαγραφή του εγγράφου",
          error: deleteError.message,
        });
      }

      console.log(`[DocumentsController] Document ${documentId} deleted successfully`);

      // STEP 4: Return the budget amount to the project (AFTER document is successfully deleted)
      // This ensures budget is only refunded if deletion succeeded
      if (projectIndexId && totalAmount) {
        try {
          const { data: projectIndex, error: projectIndexError } = await supabase
            .from("project_index")
            .select("project_id")
            .eq("id", projectIndexId)
            .single();

          if (!projectIndexError && projectIndex?.project_id) {
            const amountToReturn = parseFloat(String(totalAmount));
            
            await storage.updateProjectBudgetSpending(
              projectIndex.project_id,
              -amountToReturn,
              documentId,
              req.user?.id
            );
            
            console.log(`[DocumentsController] Budget returned: €${amountToReturn} for project ${projectIndex.project_id}`);

            // Broadcast dashboard refresh to trigger budget indicator updates
            try {
              broadcastDashboardRefresh({
                projectId: projectIndex.project_id,
                changeType: 'document_deleted',
                reason: `Document ${documentId} deleted - budget returned €${amountToReturn}`
              });
            } catch (broadcastError) {
              console.error('[DocumentsController] Failed to broadcast dashboard refresh on deletion:', broadcastError);
            }
          } else {
            console.warn(`[DocumentsController] Could not find project for budget return - project_index_id: ${projectIndexId}`);
          }
        } catch (budgetError) {
          console.error("[DocumentsController] Error returning budget (document already deleted, manual resolution needed):", budgetError);
        }
      }

      logger.info(
        `Document ${documentId} deleted successfully by user ${req.user?.id} - budget returned and payments cleaned up`,
      );

      res.json({
        success: true,
        message: "Το έγγραφο διαγράφηκε επιτυχώς. Ο προϋπολογισμός επιστράφηκε και οι πληρωμές διαγράφηκαν.",
      });
    } catch (error) {
      console.error("Error in document deletion endpoint:", error);
      res.status(500).json({
        success: false,
        message: "Εσωτερικό σφάλμα διακομιστή",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.post(
  "/:id/toggle-returned",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          message: "Μη έγκυρο ID εγγράφου",
        });
      }

      const { data: document, error: fetchError } = await supabase
        .from("generated_documents")
        .select("id, is_returned, total_amount, project_index_id, generated_by")
        .eq("id", documentId)
        .single();

      if (fetchError || !document) {
        return res.status(404).json({
          success: false,
          message: "Το έγγραφο δεν βρέθηκε",
        });
      }

      if (
        req.user?.role !== "manager" &&
        document.generated_by !== req.user?.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Δεν έχετε άδεια να επεξεργαστείτε αυτό το έγγραφο",
        });
      }

      const newReturnedStatus = !document.is_returned;
      const amount = parseFloat(String(document.total_amount || 0));

      const { error: updateError } = await supabase
        .from("generated_documents")
        .update({
          is_returned: newReturnedStatus,
          updated_at: new Date().toISOString(),
          updated_by: req.user?.name || req.user?.email || String(req.user?.id),
        })
        .eq("id", documentId);

      if (updateError) {
        console.error("Error updating document return status:", updateError);
        return res.status(500).json({
          success: false,
          message: "Σφάλμα κατά την ενημέρωση του εγγράφου",
          error: updateError.message,
        });
      }

      if (amount > 0 && document.project_index_id) {
        const { data: projectIndex, error: indexError } = await supabase
          .from("project_index")
          .select("project_id")
          .eq("id", document.project_index_id)
          .single();

        if (indexError || !projectIndex?.project_id) {
          console.error(
            "[DocumentsController] Error fetching project index:",
            indexError,
          );
          return res.status(500).json({
            success: false,
            message: "Σφάλμα κατά την ανάκτηση δεδομένων έργου",
            error: indexError?.message,
          });
        }

        try {
          const budgetAdjustment = newReturnedStatus ? -amount : amount;

          await storage.updateProjectBudgetSpending(
            projectIndex.project_id,
            budgetAdjustment,
            documentId,
            req.user?.id,
          );

          console.log(
            `[DocumentsController] Budget adjusted by ${budgetAdjustment} for document ${documentId} (returned: ${newReturnedStatus})`,
          );

          // Broadcast dashboard refresh to trigger budget indicator updates
          try {
            broadcastDashboardRefresh({
              projectId: projectIndex.project_id,
              changeType: 'document_returned_status_changed',
              reason: `Document ${documentId} returned status changed to ${newReturnedStatus} - budget adjusted by €${budgetAdjustment}`
            });
          } catch (broadcastError) {
            console.error('[DocumentsController] Failed to broadcast dashboard refresh on status change:', broadcastError);
          }
        } catch (budgetError) {
          console.error(
            "[DocumentsController] Error updating budget:",
            budgetError,
          );

          await supabase
            .from("generated_documents")
            .update({
              is_returned: !newReturnedStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", documentId);

          return res.status(500).json({
            success: false,
            message: "Σφάλμα κατά την ενημέρωση του προϋπολογισμού",
            error: budgetError instanceof Error ? budgetError.message : "Unknown error",
          });
        }
      }

      logger.info(
        `Document ${documentId} return status toggled to ${newReturnedStatus} by user ${req.user?.id}`,
      );

      res.json({
        success: true,
        message: newReturnedStatus
          ? "Το έγγραφο επεστράφη"
          : "Η επιστροφή του εγγράφου ακυρώθηκε",
        is_returned: newReturnedStatus,
      });
    } catch (error) {
      console.error("Error in toggle-returned endpoint:", error);
      res.status(500).json({
        success: false,
        message: "Εσωτερικό σφάλμα διακομιστή",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);
