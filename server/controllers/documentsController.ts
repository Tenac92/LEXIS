import { Router, Request, Response } from "express";
import { supabase } from "../config/db";
import type { GeneratedDocument } from "@shared/schema";
import type { User } from "@shared/schema";
import type { AuthenticatedRequest } from "../authentication";
import { authenticateSession } from "../authentication";
import { DocumentGenerator } from "../utils/document-generator";
import { broadcastDocumentUpdate } from "../services/websocketService";
import { createLogger } from "../utils/logger";
import JSZip from "jszip";

const logger = createLogger("DocumentsController");

// Create the router
export const router = Router();

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
        attachments,
        esdian_field1,
        esdian_field2,
      } = req.body;

      if (!recipients?.length || !project_id || !unit || !expenditure_type) {
        return res.status(400).json({
          message:
            "Missing required fields: recipients, project_id, unit, and expenditure_type are required",
        });
      }

      // SECURITY: Resolve unit string to numeric ID and verify authorization
      let numericUnitId;
      try {
        const { data: unitData, error: unitError } = await supabase
          .from("Monada")
          .select("id")
          .eq("unit", unit)
          .single();

        if (unitData) {
          numericUnitId = unitData.id;
          console.log(
            "[DocumentsController] V1 Resolved unit string",
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
      const userUnits = Array.isArray(req.user.unit_id)
        ? req.user.unit_id
        : [req.user.unit_id];
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
      const [
        projectRes,
        eventTypesRes,
        expenditureTypesRes,
        monadaRes,
        kallikratisRes,
        indexRes,
      ] = await Promise.all([
        supabase.from("Projects").select("*").eq("id", project_id).single(),
        supabase.from("event_types").select("*"),
        supabase.from("expenditure_types").select("*"),
        supabase.from("Monada").select("*"),
        supabase.from("kallikratis").select("*"),
        supabase.from("project_index").select("*"),
      ]);

      if (projectRes.error || !projectRes.data) {
        return res.status(404).json({
          message: "Project not found",
          error: projectRes.error?.message,
        });
      }

      const projectData = projectRes.data;
      const eventTypes = eventTypesRes.data || [];
      const expenditureTypes = expenditureTypesRes.data || [];
      const monadaData = monadaRes.data || [];
      const kallikratisData = kallikratisRes.data || [];
      const indexData = indexRes.data || [];

      // Get enhanced data for this project
      const projectIndexItems = indexData.filter(
        (idx) => idx.project_id === projectData.id,
      );
      const eventType =
        projectIndexItems.length > 0
          ? eventTypes.find(
              (et) => et.id === projectIndexItems[0].event_types_id,
            )
          : null;
      const expenditureTypeData =
        projectIndexItems.length > 0
          ? expenditureTypes.find(
              (et) => et.id === projectIndexItems[0].expenditure_type_id,
            )
          : null;
      const monadaItem =
        projectIndexItems.length > 0
          ? monadaData.find((m) => m.id === projectIndexItems[0].monada_id)
          : null;
      const kallikratisItem =
        projectIndexItems.length > 0
          ? kallikratisData.find(
              (k) => k.id === projectIndexItems[0].kallikratis_id,
            )
          : null;

      // Project data logging removed for cleaner console output

      // Format recipients data
      const formattedRecipients = recipients.map((r: any) => ({
        firstname: String(r.firstname).trim(),
        lastname: String(r.lastname).trim(),
        fathername: String(r.fathername).trim(),
        afm: String(r.afm).trim(),
        amount: parseFloat(String(r.amount)),
        installment: String(r.installment).trim(),
        secondary_text: r.secondary_text
          ? String(r.secondary_text).trim()
          : undefined,
      }));

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
        project_index_id:
          projectIndexItems.length > 0 ? projectIndexItems[0].id : null, // Foreign key to project_index table
        attachment_id: [], // Will be populated after attachment processing
        beneficiary_payments_id: [], // Will be populated after beneficiary processing
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
      } = req.body;

      console.log("[DocumentsController] V2 Request summary:", {
        unit,
        project_id,
        expenditure_type,
        recipientsCount: recipients?.length,
        total_amount,
      });
      
      console.log("[DocumentsController] V2 DEBUG - Recipients from request:", JSON.stringify(recipients, null, 2));

      // Important: The frontend is sending unit as a string like "ΔΑΕΦΚ-ΚΕ", but we need the numeric unit_id
      // Let's resolve this by looking up the unit from the Monada table
      let numericUnitId = null;
      try {
        const { data: unitData, error: unitError } = await supabase
          .from("Monada")
          .select("id")
          .eq("unit", unit)
          .single();

        if (unitData) {
          numericUnitId = unitData.id;
          console.log(
            "[DocumentsController] V2 Resolved unit string",
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
      const userUnits = Array.isArray(req.user.unit_id)
        ? req.user.unit_id
        : [req.user.unit_id];
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
      const formattedRecipients = recipients.map((r: any) => {
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
            tickets_tolls_rental: r.tickets_tolls_rental,
            net_payable: r.net_payable,
          };
        }

        return baseRecipient;
      });

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
      const beneficiaryPaymentsIds = [];
      const employeePaymentsIds = [];
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

        // Check if this is ΕΚΤΟΣ ΕΔΡΑΣ (out-of-office expenses)
        const isEktosEdras = expenditure_type === "ΕΚΤΟΣ ΕΔΡΑΣ";

        for (const recipient of formattedRecipients) {
          // ΕΚΤΟΣ ΕΔΡΑΣ: Create employee payment
          if (isEktosEdras) {
            console.log("[DocumentsController] V2 Creating employee payment for ΕΚΤΟΣ ΕΔΡΑΣ");
            console.log("[DocumentsController] V2 DEBUG - Full recipient object:", JSON.stringify(recipient, null, 2));
            console.log("[DocumentsController] V2 DEBUG - recipient.month value:", recipient.month);
            console.log("[DocumentsController] V2 DEBUG - recipient.month type:", typeof recipient.month);
            
            // Validate required ΕΚΤΟΣ ΕΔΡΑΣ fields
            if (!recipient.month || !recipient.month.trim()) {
              console.error("[DocumentsController] V2 ΕΚΤΟΣ ΕΔΡΑΣ validation failed: month is required");
              console.error("[DocumentsController] V2 DEBUG - All recipients:", JSON.stringify(formattedRecipients, null, 2));
              return res.status(400).json({
                message: "Ο μήνας είναι υποχρεωτικός για ΕΚΤΟΣ ΕΔΡΑΣ",
              });
            }
            
            // Calculate totals
            const dailyComp = Number(recipient.daily_compensation) || 0;
            const accommodation = Number(recipient.accommodation_expenses) || 0;
            const kmTraveled = Number(recipient.kilometers_traveled) || 0;
            const pricePerKm = Number(recipient.price_per_km) || 0.20;
            const tickets = Number(recipient.tickets_tolls_rental) || 0;
            
            const kmCost = kmTraveled * pricePerKm;
            const totalExpense = dailyComp + accommodation + kmCost + tickets;
            
            // Validate that there's at least some expense amount
            if (totalExpense <= 0) {
              console.error("[DocumentsController] V2 ΕΚΤΟΣ ΕΔΡΑΣ validation failed: total expense must be > 0");
              return res.status(400).json({
                message: "Το συνολικό ποσό δαπάνης πρέπει να είναι μεγαλύτερο από 0 για ΕΚΤΟΣ ΕΔΡΑΣ",
              });
            }
            
            const deduction2Percent = recipient.has_2_percent_deduction ? totalExpense * 0.02 : 0;
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

            console.log("[DocumentsController] V2 Employee payment data:", employeePayment);

            const { data: empPaymentData, error: empPaymentError } = await supabase
              .from("EmployeePayments")
              .insert([employeePayment])
              .select("id")
              .single();

            if (empPaymentError) {
              console.error(
                "[DocumentsController] V2 Error creating employee payment:",
                empPaymentError,
              );
            } else {
              employeePaymentsIds.push(empPaymentData.id);
              console.log(
                "[DocumentsController] V2 Created employee payment:",
                empPaymentData.id,
              );
            }
          } 
          // Standard flow: Create beneficiary payment
          else {
            // Step 1: Look up or create beneficiary
            let beneficiaryId = null;
          try {
            // Find existing beneficiary by AFM (keep as string to preserve leading zeros)
            const { data: existingBeneficiary, error: findError } =
              await supabase
                .from("beneficiaries")
                .select("id")
                .eq("afm", recipient.afm)
                .single();

            if (existingBeneficiary) {
              beneficiaryId = existingBeneficiary.id;
              console.log(
                "[DocumentsController] V2 Found existing beneficiary:",
                beneficiaryId,
                "for AFM:",
                recipient.afm,
              );
            } else if (findError && findError.code === "PGRST116") {
              // Beneficiary not found, create new one
              const newBeneficiary = {
                afm: recipient.afm, // Keep AFM as string to preserve leading zeros
                surname: recipient.lastname,
                name: recipient.firstname,
                fathername: recipient.fathername,
                region: "1", // Region should be text according to schema
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
                console.error(
                  "[DocumentsController] V2 Error creating beneficiary:",
                  createError,
                );
              } else {
                beneficiaryId = createdBeneficiary.id;
                console.log(
                  "[DocumentsController] V2 Created new beneficiary:",
                  beneficiaryId,
                  "for AFM:",
                  recipient.afm,
                );
              }
            } else {
              console.error(
                "[DocumentsController] V2 Error finding beneficiary:",
                findError,
              );
            }
          } catch (beneficiaryError) {
            console.error(
              "[DocumentsController] V2 Error during beneficiary lookup/creation:",
              beneficiaryError,
            );
          }

          // Step 2: Create separate beneficiary payment records for each installment
          if (beneficiaryId) {
            // Check if recipient has installments array and amounts
            if (recipient.installments && recipient.installmentAmounts) {
              console.log(
                "[DocumentsController] V2 Creating",
                recipient.installments.length,
                "installment payments for",
                recipient.afm,
              );

              // Create one payment record per installment
              for (const installmentName of recipient.installments) {
                const installmentAmount =
                  recipient.installmentAmounts[installmentName];

                if (installmentAmount > 0) {
                  const beneficiaryPayment = {
                    document_id: data.id,
                    beneficiary_id: beneficiaryId,
                    amount: installmentAmount,
                    status: "pending",
                    installment: installmentName, // Use specific installment name
                    freetext: recipient.secondary_text || null,
                    unit_id: numericUnitId,
                    project_index_id: projectIndexId,
                    created_at: now,
                    updated_at: now,
                  };

                  console.log(
                    "[DocumentsController] V2 Creating installment payment:",
                    installmentName,
                    "Amount:",
                    installmentAmount,
                  );
                  console.log(
                    "[DocumentsController] V2 Payment payload with IDs:",
                    {
                      document_id: data.id,
                      beneficiary_id: beneficiaryId,
                      unit_id: numericUnitId,
                      project_index_id: projectIndexId,
                      unit_raw: unit,
                      projectIndexId_raw: projectIndexId,
                    },
                  );

                  const { data: paymentData, error: paymentError } =
                    await supabase
                      .from("beneficiary_payments")
                      .insert([beneficiaryPayment])
                      .select("id")
                      .single();

                  if (paymentError) {
                    console.error(
                      "[DocumentsController] V2 Error creating installment payment:",
                      paymentError,
                    );
                  } else {
                    beneficiaryPaymentsIds.push(paymentData.id);
                    console.log(
                      "[DocumentsController] V2 Created installment payment:",
                      paymentData.id,
                      "for",
                      installmentName,
                    );
                  }
                }
              }
            } else {
              // Fallback: create single payment record (legacy behavior)
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

              console.log(
                "[DocumentsController] V2 Creating single payment (fallback):",
                beneficiaryPayment,
              );
              console.log(
                "[DocumentsController] V2 Single payment IDs check:",
                {
                  unit_id: numericUnitId,
                  project_index_id: projectIndexId,
                  unit_raw: unit,
                  projectIndexId_null: projectIndexId === null,
                },
              );

              const { data: paymentData, error: paymentError } = await supabase
                .from("beneficiary_payments")
                .insert([beneficiaryPayment])
                .select("id")
                .single();

              if (paymentError) {
                console.error(
                  "[DocumentsController] V2 Error creating single payment:",
                  paymentError,
                );
              } else {
                beneficiaryPaymentsIds.push(paymentData.id);
                console.log(
                  "[DocumentsController] V2 Created single payment:",
                  paymentData.id,
                );
              }
            }
          } else {
            console.error(
              "[DocumentsController] V2 Cannot create payment: beneficiary_id is null for AFM:",
              recipient.afm,
            );
          }
          } // End of else block for standard beneficiary payments
        }

        // Always update document with beneficiary payments IDs, even if array is empty
        console.log(
          "[DocumentsController] V2 Updating document with beneficiary payment IDs:",
          beneficiaryPaymentsIds,
        );

        const { error: updateError } = await supabase
          .from("generated_documents")
          .update({ beneficiary_payments_id: beneficiaryPaymentsIds })
          .eq("id", data.id);

        if (updateError) {
          console.error(
            "[DocumentsController] V2 Error updating document with beneficiary payment IDs:",
            updateError,
          );
          console.error(
            "[DocumentsController] V2 Update error details:",
            updateError.details,
          );
          console.error(
            "[DocumentsController] V2 Update error hint:",
            updateError.hint,
          );
        } else {
          console.log(
            "[DocumentsController] V2 Successfully updated document with beneficiary payment IDs:",
            beneficiaryPaymentsIds,
          );
        }
      } catch (beneficiaryError) {
        console.error(
          "[DocumentsController] V2 Error creating beneficiary payments:",
          beneficiaryError,
        );
      }

      // Update project budget with spending amount and create budget history
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
      } catch (budgetError) {
        console.error(
          "[DocumentsController] V2 Error updating budget:",
          budgetError,
        );
        // Don't fail the document creation if budget update fails, just log the error
      }

      // Broadcast document update to all connected clients
      broadcastDocumentUpdate({
        type: "DOCUMENT_UPDATE",
        documentId: data.id,
        data: {
          userId: (req as any).user?.id,
          timestamp: new Date().toISOString(),
        },
      });

      res.status(201).json({
        id: data.id,
        message: "Document created successfully",
        beneficiary_payments_count: beneficiaryPaymentsIds.length,
      });
    } catch (error) {
      console.error("[DocumentsController] V2 Error creating document:", error);
      res.status(500).json({
        message: "Error creating document",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// List documents with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    // Starting document fetch with filters
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
    };

    // Get documents from database directly, ordered by most recent first
    let query = supabase
      .from("generated_documents")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters only if they exist
    if (filters.unit_id) {
      query = query.eq("unit_id", filters.unit_id);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.generated_by) {
      query = query.eq("generated_by", filters.generated_by);
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        message: "Database query failed",
        error: error.message,
      });
    }

    // Enrich documents with beneficiary payment data and project/unit information
    const enrichedDocuments = await Promise.all(
      (documents || []).map(async (doc) => {
        let recipients: any[] = [];

        // Fetch beneficiary payments for this document
        if (
          doc.beneficiary_payments_id &&
          Array.isArray(doc.beneficiary_payments_id) &&
          doc.beneficiary_payments_id.length > 0
        ) {
          try {
            const { data: payments, error: paymentsError } = await supabase
              .from("beneficiary_payments")
              .select(
                `
                id,
                amount,
                installment,
                status,
                freetext,
                beneficiaries (
                  id,
                  afm,
                  surname,
                  name,
                  fathername,
                  region
                )
              `,
              )
              .in("id", doc.beneficiary_payments_id);

            if (!paymentsError && payments) {
              // Transform payments into recipients format
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
                  region: beneficiary?.region || "",
                  status: payment.status || "pending",
                  freetext: payment.freetext || null,
                };
              });
            }
          } catch (err) {
            console.error(
              "Error fetching payments for document",
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
            console.error("Error fetching unit for document", doc.id, ":", err);
          }
        }

        // Fetch project information through project_index
        let projectInfo = null;
        let expenditureTypeInfo = null;
        if (doc.project_index_id) {
          try {
            // Get project index entry with related project data
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

              // Get expenditure type information
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
              "Error fetching project info for document",
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
              "Error fetching expenditure type from attachments for document",
              doc.id,
              ":",
              err,
            );
          }
        }

        // Return enriched document with all necessary data for cards
        return {
          ...doc,
          recipients: recipients as any[],
          // Add fields that the document cards expect
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

    // Apply filters to enriched documents (client-side filtering for expenditure type and NA853)
    let filteredDocuments = enrichedDocuments;

    // Filter by expenditure type
    if (filters.expenditureType) {
      filteredDocuments = filteredDocuments.filter(
        (doc) =>
          doc.expenditure_type &&
          doc.expenditure_type
            .toLowerCase()
            .includes(filters.expenditureType.toLowerCase()),
      );
    }

    // Filter by NA853 code
    if (filters.na853) {
      filteredDocuments = filteredDocuments.filter(
        (doc) =>
          doc.project_na853 &&
          doc.project_na853.toString().includes(filters.na853),
      );
    }

    // Filter by recipient name (if not already applied in database filters)
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

    // Filter by AFM (if not already applied in database filters)
    if (filters.afm) {
      filteredDocuments = filteredDocuments.filter((doc) => {
        if (!doc.recipients || !Array.isArray(doc.recipients)) return false;
        return doc.recipients.some(
          (recipient: any) =>
            recipient.afm && recipient.afm.includes(filters.afm),
        );
      });
    }

    return res.json(filteredDocuments);
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

        // Fetch beneficiary payments for this document
        if (
          doc.beneficiary_payments_id &&
          Array.isArray(doc.beneficiary_payments_id) &&
          doc.beneficiary_payments_id.length > 0
        ) {
          try {
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
                  region
                )
              `,
              )
              .in("id", doc.beneficiary_payments_id);

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
                  region: beneficiary?.region || "",
                  status: payment.status || "pending",
                };
              });
            }
          } catch (err) {
            console.error(
              "Error fetching payments for user document",
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

    res.json(document);
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

      // Updating protocol information for document

      if (!protocol_number?.trim()) {
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

      // Get the document first to check access rights
      const { data: document, error: fetchError } = await supabase
        .from("generated_documents")
        .select("unit_id")
        .eq("id", parseInt(id))
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

      // Update the document
      const updateData: any = {
        status: "completed", // Set to completed when protocol is added
        updated_by: req.user?.id,
      };

      if (protocol_number && protocol_number.trim() !== "") {
        updateData.protocol_number_input = protocol_number.trim();
      }

      if (protocol_date && protocol_date !== "") {
        updateData.protocol_date = protocol_date;
      }

      const { data: updatedDocument, error: updateError } = await supabase
        .from("generated_documents")
        .update(updateData)
        .eq("id", parseInt(id))
        .select()
        .single();

      if (updateError) {
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

    // Format recipients data
    const formattedRecipients = recipients.map((r: any) => ({
      firstname: String(r.firstname).trim(),
      lastname: String(r.lastname).trim(),
      fathername: String(r.fathername || "").trim(),
      afm: String(r.afm).trim(),
      amount: parseFloat(String(r.amount)),
      installment: String(r.installment).trim(),
      secondary_text: r.secondary_text
        ? String(r.secondary_text).trim()
        : undefined,
    }));

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

      // Prepare document data with user name and contact information
      // Also fetch missing data needed for document generation
      let projectData: any = null;
      let beneficiaryData: any[] = [];
      let attachmentsData: any[] = [];
      let expenditureType = "ΔΑΠΑΝΗ"; // Default fallback

      // Fetch related project data if project_index_id exists
      if (document.project_index_id) {
        try {
          const { data: projectIndexData, error: projectIndexError } =
            await supabase
              .from("project_index")
              .select(
                `
            id,
            project_id,
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

      // Fetch beneficiary payments data
      if (
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
            beneficiaryData = paymentsData.map((payment: any) => ({
              id: payment.id,
              firstname: (payment.beneficiaries as any)?.name || "",
              lastname: (payment.beneficiaries as any)?.surname || "",
              fathername: (payment.beneficiaries as any)?.fathername || "",
              afm: (payment.beneficiaries as any)?.afm || "",
              amount: parseFloat(payment.amount || "0"),
              installment: payment.installment || "ΕΦΑΠΑΞ",
              freetext: payment.freetext || null,
            }));
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

// GET /api/documents/:id/beneficiaries - Get beneficiary payments for a document
router.get(
  "/:id/beneficiaries",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      // Get beneficiary payments for this document
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
        beneficiaries (
          id,
          afm,
          surname,
          name,
          fathername,
          region
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

      res.json(payments || []);
    } catch (error) {
      console.error("Error in beneficiaries endpoint:", error);
      res.status(500).json({
        message: "Failed to fetch beneficiary payments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// PUT /api/documents/:id/beneficiaries - Update beneficiary payments for a document
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

      // Start a transaction-like operation by handling updates sequentially
      const updatedPayments = [];

      for (const recipient of recipients) {
        if (recipient.id) {
          // First, get the existing payment to find beneficiary_id
          const { data: existingPayment, error: fetchError } = await supabase
            .from("beneficiary_payments")
            .select("beneficiary_id")
            .eq("id", recipient.id)
            .eq("document_id", documentId)
            .single();

          if (fetchError || !existingPayment) {
            console.error("Error fetching existing payment:", fetchError);
            continue;
          }

          // Update beneficiary information if we have it
          if (
            existingPayment.beneficiary_id &&
            (recipient.firstname ||
              recipient.lastname ||
              recipient.fathername ||
              recipient.afm)
          ) {
            const beneficiaryUpdate: any = {};
            if (recipient.firstname)
              beneficiaryUpdate.name = recipient.firstname;
            if (recipient.lastname)
              beneficiaryUpdate.surname = recipient.lastname;
            if (recipient.fathername)
              beneficiaryUpdate.fathername = recipient.fathername;
            if (recipient.afm) beneficiaryUpdate.afm = recipient.afm;

            if (Object.keys(beneficiaryUpdate).length > 0) {
              const { error: beneficiaryError } = await supabase
                .from("beneficiaries")
                .update(beneficiaryUpdate)
                .eq("id", existingPayment.beneficiary_id);

              if (beneficiaryError) {
                console.error("Error updating beneficiary:", beneficiaryError);
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
        } else if (recipient.firstname && recipient.lastname && recipient.afm) {
          // Create new beneficiary and payment if we have required data
          const { data: newBeneficiary, error: beneficiaryError } =
            await supabase
              .from("beneficiaries")
              .insert({
                name: recipient.firstname,
                surname: recipient.lastname,
                fathername: recipient.fathername || null,
                afm: recipient.afm,
              })
              .select()
              .single();

          if (beneficiaryError) {
            console.error("Error creating beneficiary:", beneficiaryError);
            continue;
          }

          // Create new payment
          const { data: newPayment, error: paymentError } = await supabase
            .from("beneficiary_payments")
            .insert({
              document_id: documentId,
              beneficiary_id: newBeneficiary.id,
              amount: recipient.amount?.toString() || "0",
              installment: recipient.installment || "ΕΦΑΠΑΞ",
              status: recipient.status || "pending",
            })
            .select()
            .single();

          if (paymentError) {
            console.error("Error creating beneficiary payment:", paymentError);
            continue;
          }

          updatedPayments.push(newPayment);
        }
      }

      res.json({
        message: "Beneficiaries and payments updated successfully",
        payments: updatedPayments,
        count: updatedPayments.length,
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
 * Delete a generated document
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

      // Verify document exists before deletion
      const { data: existingDocument, error: fetchError } = await supabase
        .from("generated_documents")
        .select("id, generated_by")
        .eq("id", documentId)
        .single();

      if (fetchError || !existingDocument) {
        return res.status(404).json({
          success: false,
          message: "Το έγγραφο δεν βρέθηκε",
        });
      }

      // Optional: Add authorization check - only allow user who created the document or admin to delete
      if (
        req.user?.role !== "manager" &&
        existingDocument.generated_by !== req.user?.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Δεν έχετε άδεια να διαγράψετε αυτό το έγγραφο",
        });
      }

      // Delete the document
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

      logger.info(
        `Document ${documentId} deleted successfully by user ${req.user?.id}`,
      );

      res.json({
        success: true,
        message: "Το έγγραφο διαγράφηκε επιτυχώς",
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
