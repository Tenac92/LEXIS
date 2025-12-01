import { Request, Response } from "express";
import { supabase } from "../config/db";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Project, projectHelpers } from "@shared/models/project";
import { Router } from "express";
import { authenticateSession } from "../authentication";
import { storage } from "../storage";
import { AuthenticatedRequest } from "../authentication";
import {
  parseAndValidateBudgetAmount,
  parseEuropeanNumber,
} from "../utils/europeanNumberParser";
import { canAccessProject, requireProjectAccess } from "../utils/authorization";

export const router = Router();

/**
 * Process budget versions and create records in project_budget_versions and epa_financials tables
 */
async function processBudgetVersions(
  formulationId: number,
  projectId: number,
  budgetVersions: any,
  userId: number,
) {
  try {
    console.log(
      `[ProcessBudgetVersions] Processing budget versions for formulation ${formulationId}`,
      budgetVersions,
    );

    // Process PDE versions
    if (budgetVersions.pde && Array.isArray(budgetVersions.pde)) {
      for (const pdeVersion of budgetVersions.pde) {
        const budgetVersionData = {
          project_id: projectId,
          formulation_id: formulationId,
          budget_type: "ΠΔΕ",
          version_number: pdeVersion.version_number || "1.0",
          action_type: pdeVersion.action_type || "Έγκριση",
          boundary_budget: pdeVersion.boundary_budget
            ? parseAndValidateBudgetAmount(pdeVersion.boundary_budget)
            : null,
          protocol_number: pdeVersion.protocol_number || null,
          ada: pdeVersion.ada || null,
          decision_date: pdeVersion.decision_date || null,
          comments: pdeVersion.comments || null,
          created_by: userId,
          updated_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdPDE, error: pdeError } = await supabase
          .from("project_budget_versions")
          .insert(budgetVersionData)
          .select()
          .single();

        if (pdeError) {
          console.error(
            "[ProcessBudgetVersions] Error creating PDE version:",
            pdeError,
          );
          throw pdeError;
        }

        console.log(
          `[ProcessBudgetVersions] Created PDE version with ID: ${createdPDE.id}`,
        );
      }
    }

    // Process EPA versions
    if (budgetVersions.epa && Array.isArray(budgetVersions.epa)) {
      for (const epaVersion of budgetVersions.epa) {
        const budgetVersionData = {
          project_id: projectId,
          formulation_id: formulationId,
          budget_type: "ΕΠΑ",
          version_number: epaVersion.version_number || "1.0",
          action_type: epaVersion.action_type || "Έγκριση",
          epa_version: epaVersion.epa_version || null,
          protocol_number: epaVersion.protocol_number || null,
          ada: epaVersion.ada || null,
          decision_date: epaVersion.decision_date || null,
          comments: epaVersion.comments || null,
          created_by: userId,
          updated_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdEPA, error: epaError } = await supabase
          .from("project_budget_versions")
          .insert(budgetVersionData)
          .select()
          .single();

        if (epaError) {
          console.error(
            "[ProcessBudgetVersions] Error creating EPA version:",
            epaError,
          );
          throw epaError;
        }

        console.log(
          `[ProcessBudgetVersions] Created EPA version with ID: ${createdEPA.id}`,
        );

        // Process EPA financials if provided
        if (epaVersion.financials && Array.isArray(epaVersion.financials)) {
          for (const financial of epaVersion.financials) {
            const financialData = {
              epa_version_id: createdEPA.id,
              year: parseInt(financial.year) || new Date().getFullYear(),
              total_public_expense:
                parseEuropeanNumber(financial.total_public_expense) || 0,
              eligible_public_expense:
                parseEuropeanNumber(financial.eligible_public_expense) || 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { data: createdFinancial, error: financialError } =
              await supabase
                .from("epa_financials")
                .insert(financialData)
                .select()
                .single();

            if (financialError) {
              console.error(
                "[ProcessBudgetVersions] Error creating EPA financial record:",
                financialError,
              );
              throw financialError;
            }

            console.log(
              `[ProcessBudgetVersions] Created EPA financial record with ID: ${createdFinancial.id} for year ${financialData.year}`,
            );
          }
        }
      }
    }

    console.log(
      `[ProcessBudgetVersions] Successfully processed all budget versions for formulation ${formulationId}`,
    );
  } catch (error) {
    console.error(
      "[ProcessBudgetVersions] Error processing budget versions:",
      error,
    );
    throw error;
  }
}

export async function listProjects(req: Request, res: Response) {
  try {
    console.log("[Projects] Fetching all projects with optimized schema and pagination");

    // Validate and clamp pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 500));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    console.log(`[Projects] Pagination: page=${page}, pageSize=${pageSize}, range=${from}-${to}`);

    // Step 1: Get paginated projects first
    const projectsRes = await supabase
      .from("Projects")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (projectsRes.error) {
      console.error("Database error:", projectsRes.error);
      return res.status(500).json({
        message: "Failed to fetch projects from database",
        error: projectsRes.error.message,
      });
    }

    if (!projectsRes.data || projectsRes.data.length === 0) {
      return res.status(404).json({ message: "No projects found" });
    }

    const projects = projectsRes.data;
    const projectIds = projects.map(p => p.id);

    // Step 2: Get cached reference data and targeted project_index in parallel
    const { getReferenceData } = await import('../utils/reference-cache');
    const [refData, indexRes, forYlRes] = await Promise.all([
      getReferenceData(),
      supabase
        .from("project_index")
        .select("id, project_id, monada_id, event_types_id, expenditure_type_id, for_yl_id")
        .in("project_id", projectIds),
      supabase
        .from("for_yl")
        .select("id, foreis")
    ]);

    if (indexRes.error) {
      console.error("[Projects] Error fetching project_index:", indexRes.error);
    }

    const monadaData = refData.monada;
    const eventTypes = refData.eventTypes;
    const expenditureTypes = refData.expenditureTypes;
    const indexData = indexRes.data || [];
    const forYlData = forYlRes.data || [];

    // Enhance projects with optimized schema data
    const enhancedProjects = projects
      .map((project) => {
        try {
          // Get all index entries for this project
          const projectIndexItems = indexData.filter(
            (idx) => idx.project_id === project.id,
          );

          // Get enhanced data
          const eventTypeData =
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
          const monadaData_item =
            projectIndexItems.length > 0
              ? monadaData.find((m) => m.id === projectIndexItems[0].monada_id)
              : null;
          
          // Get for_yl data if project has a for_yl_id
          const forYlItem = projectIndexItems.length > 0 && projectIndexItems[0].for_yl_id
            ? forYlData.find((f) => f.id === projectIndexItems[0].for_yl_id)
            : null;
          const forYlForeis = forYlItem?.foreis as { title?: string; monada_id?: string } | null;

          // Get all expenditure types for this project
          const allExpenditureTypes = projectIndexItems
            .map((idx) =>
              expenditureTypes.find((et) => et.id === idx.expenditure_type_id),
            )
            .filter((et) => et !== null && et !== undefined)
            .map((et) => et.expenditure_types);
          const uniqueExpenditureTypes = Array.from(
            new Set(allExpenditureTypes),
          );

          // Get all event types for this project
          const allEventTypes = projectIndexItems
            .map((idx) => eventTypes.find((et) => et.id === idx.event_types_id))
            .filter((et) => et !== null && et !== undefined)
            .map((et) => et.name);
          const uniqueEventTypes = Array.from(new Set(allEventTypes));

          const enhancedProject = {
            ...project,
            enhanced_event_type: eventTypeData
              ? {
                  id: eventTypeData.id,
                  name: eventTypeData.name,
                }
              : null,
            enhanced_expenditure_type: expenditureTypeData
              ? {
                  id: expenditureTypeData.id,
                  name: expenditureTypeData.expenditure_types,
                }
              : null,
            enhanced_unit: monadaData_item
              ? {
                  id: monadaData_item.id,
                  name: monadaData_item.unit,
                }
              : null,
            enhanced_kallikratis: null,
            // For YL (implementing agency) data
            enhanced_for_yl: forYlItem
              ? {
                  id: forYlItem.id,
                  title: forYlForeis?.title || "",
                  monada_id: forYlForeis?.monada_id || ""
                }
              : null,
            // Implementing agency for frontend compatibility
            implementing_agency: forYlItem
              ? {
                  id: forYlItem.id,
                  title: forYlForeis?.title || ""
                }
              : null,
            // Add arrays for backward compatibility
            expenditure_types: uniqueExpenditureTypes,
            event_types: uniqueEventTypes,
          };

          return projectHelpers.validateProject(enhancedProject);
        } catch (error) {
          console.error("Project validation error:", error);
          return null;
        }
      })
      .filter((project): project is Project => project !== null);

    const total = projectsRes.count || 0;
    console.log(`[Projects] Returning ${enhancedProjects.length} projects (page ${page}/${Math.ceil(total / pageSize)}, total: ${total})`);

    return res.json({
      data: enhancedProjects,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ message: "Failed to fetch projects" });
  }
}

// Helper function to parse budget value to number
function parseBudgetValue(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(",", ".").trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Helper function to format array fields
function formatArrayField(value: any): string {
  if (!value) return "-";
  if (Array.isArray(value)) {
    const filtered = value.filter(v => v && v.trim && v.trim() !== "");
    return filtered.length > 0 ? filtered.join(", ") : "-";
  }
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

// Helper function to format region data
function formatRegionData(region: any): string {
  if (!region) return "-";
  if (typeof region === "string") return region || "-";
  if (typeof region === "object") {
    const parts: string[] = [];
    if (region.region && Array.isArray(region.region) && region.region.length > 0) {
      parts.push(region.region.filter((r: string) => r).join(", "));
    }
    if (region.regional_unit && Array.isArray(region.regional_unit) && region.regional_unit.length > 0) {
      parts.push(region.regional_unit.filter((r: string) => r).join(", "));
    }
    if (region.municipality && Array.isArray(region.municipality) && region.municipality.length > 0) {
      parts.push(region.municipality.filter((r: string) => r).join(", "));
    }
    return parts.length > 0 ? parts.join(" | ") : "-";
  }
  return "-";
}

// Enhanced Excel export with both projects and budget data using ExcelJS
export async function exportProjectsXLSX(req: Request, res: Response) {
  try {
    console.log(
      "[Projects] Generating professional Excel export with projects and budget data",
    );

    // Get filter parameters from query string
    const na853Filter = req.query.na853 as string || "";
    const expenditureTypeFilter = req.query.expenditureType as string || "";
    const statusFilter = req.query.status as string || "";
    const unitFilter = req.query.unit as string || "";
    const searchFilter = req.query.search as string || "";

    console.log(`[Export] Filters - NA853: ${na853Filter}, Expenditure: ${expenditureTypeFilter}, Status: ${statusFilter}, Unit: ${unitFilter}, Search: ${searchFilter}`);

    // Build filter query for projects
    let projectQuery = supabase
      .from("Projects")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    if (na853Filter) {
      projectQuery = projectQuery.eq("na853", na853Filter);
    }
    if (statusFilter && statusFilter !== "all") {
      projectQuery = projectQuery.eq("status", statusFilter);
    }
    if (searchFilter) {
      projectQuery = projectQuery.or(`na853.ilike.%${searchFilter}%,event_description.ilike.%${searchFilter}%,project_title.ilike.%${searchFilter}%`);
    }

    const projectsRes = await projectQuery;

    // Fetch all supporting data including geographic data from junction tables
    const [
      monadaRes,
      eventTypesRes,
      expenditureTypesRes,
      indexRes,
      regionsRes,
      regionalUnitsRes,
      municipalitiesRes,
      projectRegionsRes,
      projectUnitsRes,
      projectMunisRes,
    ] = await Promise.all([
      supabase.from("Monada").select("*"),
      supabase.from("event_types").select("*"),
      supabase.from("expenditure_types").select("*"),
      supabase.from("project_index").select("*"),
      supabase.from("regions").select("*"),
      supabase.from("regional_units").select("*"),
      supabase.from("municipalities").select("*"),
      supabase.from("project_index_regions").select("project_index_id, region_code"),
      supabase.from("project_index_units").select("project_index_id, unit_code"),
      supabase.from("project_index_munis").select("project_index_id, muni_code"),
    ]);

    if (projectsRes.error) {
      console.error(
        "Error fetching projects for Excel export:",
        projectsRes.error,
      );
      return res.status(500).json({
        message: "Failed to fetch projects for export",
        error: projectsRes.error.message,
      });
    }

    const projects = projectsRes.data;
    const monadaData = monadaRes.data || [];
    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const indexData = indexRes.data || [];
    const regionsData = regionsRes.data || [];
    const regionalUnitsData = regionalUnitsRes.data || [];
    const municipalitiesData = municipalitiesRes.data || [];
    const projectRegionsData = projectRegionsRes.data || [];
    const projectUnitsData = projectUnitsRes.data || [];
    const projectMunisData = projectMunisRes.data || [];

    // Enhance projects with optimized schema data including geographic info
    const enhancedProjects = projects.map((project) => {
      const projectIndexItems = indexData.filter(
        (idx) => idx.project_id === project.id,
      );
      const projectIndexIds = projectIndexItems.map((idx) => idx.id);

      // Get all expenditure types for this project
      const allExpenditureTypes = projectIndexItems
        .map((idx) =>
          expenditureTypes.find((et) => et.id === idx.expenditure_type_id),
        )
        .filter((et) => et !== null && et !== undefined)
        .map((et) => et.expenditure_types);
      const uniqueExpenditureTypes = Array.from(new Set(allExpenditureTypes));

      // Get all event types for this project
      const allEventTypes = projectIndexItems
        .map((idx) => eventTypes.find((et) => et.id === idx.event_types_id))
        .filter((et) => et !== null && et !== undefined)
        .map((et) => et.name);
      const uniqueEventTypes = Array.from(new Set(allEventTypes));

      // Get all monada for this project
      const allMonadas = projectIndexItems
        .map((idx) => monadaData.find((m) => m.id === idx.monada_id))
        .filter((m) => m !== null && m !== undefined)
        .map((m) => m.unit);
      const uniqueMonadas = Array.from(new Set(allMonadas));

      // Get geographic data from junction tables
      const regionCodes = projectRegionsData
        .filter((pr) => projectIndexIds.includes(pr.project_index_id))
        .map((pr) => pr.region_code);
      const regionNames = regionsData
        .filter((r) => regionCodes.includes(r.code))
        .map((r) => r.name);
      const uniqueRegions = Array.from(new Set(regionNames));

      const unitCodes = projectUnitsData
        .filter((pu) => projectIndexIds.includes(pu.project_index_id))
        .map((pu) => pu.unit_code);
      const unitNames = regionalUnitsData
        .filter((u) => unitCodes.includes(u.code))
        .map((u) => u.name);
      const uniqueUnits = Array.from(new Set(unitNames));

      const muniCodes = projectMunisData
        .filter((pm) => projectIndexIds.includes(pm.project_index_id))
        .map((pm) => pm.muni_code);
      const muniNames = municipalitiesData
        .filter((m) => muniCodes.includes(m.code))
        .map((m) => m.name);
      const uniqueMunis = Array.from(new Set(muniNames));

      // Format geographic string: Περιφέρεια | Π.Ε. | Δήμος
      const geoParts: string[] = [];
      if (uniqueRegions.length > 0) geoParts.push(uniqueRegions.join(", "));
      if (uniqueUnits.length > 0) geoParts.push(uniqueUnits.join(", "));
      if (uniqueMunis.length > 0) geoParts.push(uniqueMunis.join(", "));
      const enhancedRegion = geoParts.length > 0 ? geoParts.join(" | ") : null;

      return {
        ...project,
        enhanced_unit: uniqueMonadas.length > 0 ? uniqueMonadas.join(", ") : null,
        expenditure_types: uniqueExpenditureTypes,
        event_types: uniqueEventTypes,
        enhanced_region: enhancedRegion,
      };
    });

    // Fetch all budget splits
    const { data: budgetSplits, error: budgetError } = await supabase
      .from("project_budget")
      .select("*")
      .order("created_at", { ascending: false });

    if (budgetError) {
      console.warn(
        "Warning: Could not fetch budget data for export:",
        budgetError,
      );
    }

    if (!enhancedProjects || enhancedProjects.length === 0) {
      return res.status(404).json({ message: "No projects found for export" });
    }

    // Create ExcelJS workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ΓΓΠΠ - Σύστημα Διαχείρισης Έργων";
    workbook.created = new Date();
    workbook.modified = new Date();

    const currentYear = new Date().getFullYear();

    // Define styles
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      border: {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      },
    };

    const dataStyle: Partial<ExcelJS.Style> = {
      alignment: { vertical: "middle", wrapText: true },
      border: {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      },
    };

    const currencyStyle: Partial<ExcelJS.Style> = {
      ...dataStyle,
      alignment: { horizontal: "right", vertical: "middle" },
      numFmt: '#,##0.00 [$€-el-GR]', // Greek locale: dots for thousands, comma for decimals
    };

    const totalRowStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } },
      alignment: { horizontal: "right", vertical: "middle" },
      border: {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      },
    };

    // ========== SHEET 1: Projects with Allocations ==========
    const wsIntegrated = workbook.addWorksheet("Έργα με Κατανομές", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    // Define columns for integrated view
    const integratedColumns = [
      { header: "MIS", key: "mis", width: 12 },
      { header: "ΝΑ853", key: "na853", width: 15 },
      { header: "Τίτλος Έργου", key: "title", width: 45 },
      { header: "Κατάσταση", key: "status", width: 14 },
      { header: "Μονάδα", key: "unit", width: 25 },
      { header: "Τύπος Δαπάνης", key: "expenditure_type", width: 20 },
      { header: "Τύπος Συμβάντος", key: "event_type", width: 20 },
      { header: "Έτος Συμβάντος", key: "event_year", width: 15 },
      { header: "Περιφέρεια", key: "region", width: 30 },
      { header: "Π/Υ ΝΑ853 (€)", key: "budget_na853", width: 18 },
      { header: "Π/Υ ΝΑ271 (€)", key: "budget_na271", width: 18 },
      { header: "Π/Υ Ε069 (€)", key: "budget_e069", width: 18 },
      { header: "ΠΡΟΙΠ (€)", key: "proip", width: 16 },
      { header: "Ετήσια Πίστωση (€)", key: "ethsia_pistosi", width: 18 },
      { header: "Α΄ Τρίμηνο (€)", key: "q1", width: 16 },
      { header: "Β΄ Τρίμηνο (€)", key: "q2", width: 16 },
      { header: "Γ΄ Τρίμηνο (€)", key: "q3", width: 16 },
      { header: "Δ΄ Τρίμηνο (€)", key: "q4", width: 16 },
      { header: "Κατανομές Έτους (€)", key: "katanomes_etous", width: 18 },
      { header: `Δαπάνες ${currentYear} (€)`, key: "user_view", width: 18 },
      { header: "Έτος Ένταξης", key: "inc_year", width: 14 },
      { header: "Ημ/νία Δημιουργίας", key: "created_at", width: 16 },
    ];

    wsIntegrated.columns = integratedColumns;

    // Apply header styles
    wsIntegrated.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });
    wsIntegrated.getRow(1).height = 35;

    // Collect data and totals
    let totalBudgetNA853 = 0;
    let totalBudgetNA271 = 0;
    let totalBudgetE069 = 0;
    let totalProip = 0;
    let totalEthsiaPistosi = 0;
    let totalQ1 = 0;
    let totalQ2 = 0;
    let totalQ3 = 0;
    let totalQ4 = 0;
    let totalKatanomesEtous = 0;
    let totalUserView = 0;

    enhancedProjects.forEach((project) => {
      const projectSplits =
        budgetSplits?.filter(
          (split) =>
            split.mis?.toString() === project.mis?.toString() ||
            split.na853 === project.na853,
        ) || [];

      const budgetNA853 = parseBudgetValue(project.budget_na853);
      const budgetNA271 = parseBudgetValue(project.budget_na271);
      const budgetE069 = parseBudgetValue(project.budget_e069);

      if (budgetNA853) totalBudgetNA853 += budgetNA853;
      if (budgetNA271) totalBudgetNA271 += budgetNA271;
      if (budgetE069) totalBudgetE069 += budgetE069;

      if (projectSplits.length === 0) {
        wsIntegrated.addRow({
          mis: project.mis || "-",
          na853: project.na853 || "-",
          title: project.project_title || project.event_description || "-",
          status: project.status || "-",
          unit: project.enhanced_unit || "-",
          expenditure_type: formatArrayField(project.expenditure_types),
          event_type: formatArrayField(project.event_types),
          event_year: formatArrayField(project.event_year),
          region: project.enhanced_region || "-",
          budget_na853: budgetNA853,
          budget_na271: budgetNA271,
          budget_e069: budgetE069,
          proip: null,
          ethsia_pistosi: null,
          q1: null,
          q2: null,
          q3: null,
          q4: null,
          katanomes_etous: null,
          user_view: null,
          inc_year: project.inc_year || "-",
          created_at: project.created_at
            ? new Date(project.created_at).toLocaleDateString("el-GR")
            : "-",
        });
      } else {
        projectSplits.forEach((split: any) => {
          const proip = parseBudgetValue(split.proip);
          const ethsiaPistosi = parseBudgetValue(split.ethsia_pistosi);
          const q1 = parseBudgetValue(split.q1);
          const q2 = parseBudgetValue(split.q2);
          const q3 = parseBudgetValue(split.q3);
          const q4 = parseBudgetValue(split.q4);
          const katanomesEtous = parseBudgetValue(split.katanomes_etous);
          const userView = parseBudgetValue(split.user_view);

          if (proip) totalProip += proip;
          if (ethsiaPistosi) totalEthsiaPistosi += ethsiaPistosi;
          if (q1) totalQ1 += q1;
          if (q2) totalQ2 += q2;
          if (q3) totalQ3 += q3;
          if (q4) totalQ4 += q4;
          if (katanomesEtous) totalKatanomesEtous += katanomesEtous;
          if (userView) totalUserView += userView;

          wsIntegrated.addRow({
            mis: project.mis || "-",
            na853: project.na853 || "-",
            title: project.project_title || project.event_description || "-",
            status: project.status || "-",
            unit: project.enhanced_unit || "-",
            expenditure_type: formatArrayField(project.expenditure_types),
            event_type: formatArrayField(project.event_types),
            event_year: formatArrayField(project.event_year),
            region: project.enhanced_region || "-",
            budget_na853: budgetNA853,
            budget_na271: budgetNA271,
            budget_e069: budgetE069,
            proip: proip,
            ethsia_pistosi: ethsiaPistosi,
            q1: q1,
            q2: q2,
            q3: q3,
            q4: q4,
            katanomes_etous: katanomesEtous,
            user_view: userView,
            inc_year: project.inc_year || "-",
            created_at: project.created_at
              ? new Date(project.created_at).toLocaleDateString("el-GR")
              : "-",
          });
        });
      }
    });

    // Apply data styles and currency format
    const currencyColumns = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // Column indices for currency
    const currencyFormat = '#,##0.00 [$€-el-GR]'; // Greek locale: dots for thousands, comma for decimals
    const defaultBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFD9D9D9" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } },
    };
    wsIntegrated.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          if (currencyColumns.includes(colNumber)) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }
          cell.border = defaultBorder;
        });
        row.height = 22;
      }
    });

    // Add totals row
    const totalRow = wsIntegrated.addRow({
      mis: "",
      na853: "ΣΥΝΟΛΑ:",
      title: "",
      status: "",
      unit: "",
      expenditure_type: "",
      event_type: "",
      event_year: "",
      region: "",
      budget_na853: totalBudgetNA853,
      budget_na271: totalBudgetNA271,
      budget_e069: totalBudgetE069,
      proip: totalProip,
      ethsia_pistosi: totalEthsiaPistosi,
      q1: totalQ1,
      q2: totalQ2,
      q3: totalQ3,
      q4: totalQ4,
      katanomes_etous: totalKatanomesEtous,
      user_view: totalUserView,
      inc_year: "",
      created_at: "",
    });

    totalRow.eachCell((cell, colNumber) => {
      Object.assign(cell, { style: totalRowStyle });
      if (currencyColumns.includes(colNumber)) {
        cell.numFmt = currencyFormat;
      }
    });
    totalRow.height = 28;

    // Add alternating row colors
    wsIntegrated.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber < wsIntegrated.rowCount) {
        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb !== "FFE2EFDA") {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
            }
          });
        }
      }
    });

    // ========== SHEET 2: Projects Only ==========
    const wsProjects = workbook.addWorksheet("Μόνο Έργα", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    const projectColumns = [
      { header: "MIS", key: "mis", width: 12 },
      { header: "ΝΑ853", key: "na853", width: 15 },
      { header: "ΝΑ271", key: "na271", width: 15 },
      { header: "Ε069", key: "e069", width: 15 },
      { header: "Τίτλος Έργου", key: "title", width: 50 },
      { header: "Περίληψη", key: "summary", width: 40 },
      { header: "Κατάσταση", key: "status", width: 14 },
      { header: "Μονάδα", key: "unit", width: 25 },
      { header: "Τύπος Δαπάνης", key: "expenditure_type", width: 20 },
      { header: "Τύπος Συμβάντος", key: "event_type", width: 20 },
      { header: "Έτος Συμβάντος", key: "event_year", width: 15 },
      { header: "Έτος Ένταξης", key: "inc_year", width: 14 },
      { header: "Περιφέρεια", key: "region", width: 30 },
      { header: "Π/Υ ΝΑ853 (€)", key: "budget_na853", width: 18 },
      { header: "Π/Υ ΝΑ271 (€)", key: "budget_na271", width: 18 },
      { header: "Π/Υ Ε069 (€)", key: "budget_e069", width: 18 },
      { header: "Ημ/νία Δημιουργίας", key: "created_at", width: 16 },
      { header: "Ημ/νία Ενημέρωσης", key: "updated_at", width: 16 },
    ];

    wsProjects.columns = projectColumns;

    // Apply header styles
    wsProjects.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });
    wsProjects.getRow(1).height = 35;

    // Add project data
    let projectTotalNA853 = 0;
    let projectTotalNA271 = 0;
    let projectTotalE069 = 0;

    enhancedProjects.forEach((project) => {
      const budgetNA853 = parseBudgetValue(project.budget_na853);
      const budgetNA271 = parseBudgetValue(project.budget_na271);
      const budgetE069 = parseBudgetValue(project.budget_e069);

      if (budgetNA853) projectTotalNA853 += budgetNA853;
      if (budgetNA271) projectTotalNA271 += budgetNA271;
      if (budgetE069) projectTotalE069 += budgetE069;

      wsProjects.addRow({
        mis: project.mis || "-",
        na853: project.na853 || "-",
        na271: project.na271 || "-",
        e069: project.e069 || "-",
        title: project.project_title || project.event_description || "-",
        summary: project.summary || "-",
        status: project.status || "-",
        unit: project.enhanced_unit || "-",
        expenditure_type: formatArrayField(project.expenditure_types),
        event_type: formatArrayField(project.event_types),
        event_year: formatArrayField(project.event_year),
        inc_year: project.inc_year || "-",
        region: project.enhanced_region || "-",
        budget_na853: budgetNA853,
        budget_na271: budgetNA271,
        budget_e069: budgetE069,
        created_at: project.created_at
          ? new Date(project.created_at).toLocaleDateString("el-GR")
          : "-",
        updated_at: project.updated_at
          ? new Date(project.updated_at).toLocaleDateString("el-GR")
          : "-",
      });
    });

    // Apply styles with currency format
    const projectCurrencyColumns = [14, 15, 16];
    wsProjects.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          if (projectCurrencyColumns.includes(colNumber)) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }
          cell.border = defaultBorder;
        });
        row.height = 22;
        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
          });
        }
      }
    });

    // Add totals row for projects
    const projectTotalRow = wsProjects.addRow({
      mis: "",
      na853: "ΣΥΝΟΛΑ:",
      na271: "",
      e069: "",
      title: `${enhancedProjects.length} Έργα`,
      summary: "",
      status: "",
      unit: "",
      expenditure_type: "",
      event_type: "",
      event_year: "",
      inc_year: "",
      region: "",
      budget_na853: projectTotalNA853,
      budget_na271: projectTotalNA271,
      budget_e069: projectTotalE069,
      created_at: "",
      updated_at: "",
    });

    projectTotalRow.eachCell((cell, colNumber) => {
      Object.assign(cell, { style: totalRowStyle });
      if (projectCurrencyColumns.includes(colNumber)) {
        cell.numFmt = currencyFormat;
      }
    });
    projectTotalRow.height = 28;

    // ========== SHEET 3: Budget Allocations Only ==========
    const wsBudgets = workbook.addWorksheet("Μόνο Κατανομές", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    const budgetColumns = [
      { header: "ID", key: "id", width: 10 },
      { header: "MIS", key: "mis", width: 12 },
      { header: "ΝΑ853", key: "na853", width: 15 },
      { header: "ΠΡΟΙΠ (€)", key: "proip", width: 18 },
      { header: "Ετήσια Πίστωση (€)", key: "ethsia_pistosi", width: 18 },
      { header: "Α΄ Τρίμηνο (€)", key: "q1", width: 16 },
      { header: "Β΄ Τρίμηνο (€)", key: "q2", width: 16 },
      { header: "Γ΄ Τρίμηνο (€)", key: "q3", width: 16 },
      { header: "Δ΄ Τρίμηνο (€)", key: "q4", width: 16 },
      { header: "Κατανομές Έτους (€)", key: "katanomes_etous", width: 18 },
      { header: `Δαπάνες ${currentYear} (€)`, key: "user_view", width: 18 },
      { header: "Ημ/νία Δημιουργίας", key: "created_at", width: 16 },
    ];

    wsBudgets.columns = budgetColumns;

    // Apply header styles
    wsBudgets.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });
    wsBudgets.getRow(1).height = 35;

    // Add budget data with totals calculation
    let budgetTotalProip = 0;
    let budgetTotalEthsia = 0;
    let budgetTotalQ1 = 0;
    let budgetTotalQ2 = 0;
    let budgetTotalQ3 = 0;
    let budgetTotalQ4 = 0;
    let budgetTotalKatanomes = 0;
    let budgetTotalUserView = 0;

    if (budgetSplits && budgetSplits.length > 0) {
      budgetSplits.forEach((split) => {
        const proip = parseBudgetValue(split.proip);
        const ethsia = parseBudgetValue(split.ethsia_pistosi);
        const q1 = parseBudgetValue(split.q1);
        const q2 = parseBudgetValue(split.q2);
        const q3 = parseBudgetValue(split.q3);
        const q4 = parseBudgetValue(split.q4);
        const katanomes = parseBudgetValue(split.katanomes_etous);
        const userView = parseBudgetValue(split.user_view);

        if (proip) budgetTotalProip += proip;
        if (ethsia) budgetTotalEthsia += ethsia;
        if (q1) budgetTotalQ1 += q1;
        if (q2) budgetTotalQ2 += q2;
        if (q3) budgetTotalQ3 += q3;
        if (q4) budgetTotalQ4 += q4;
        if (katanomes) budgetTotalKatanomes += katanomes;
        if (userView) budgetTotalUserView += userView;

        wsBudgets.addRow({
          id: split.id || "-",
          mis: split.mis || "-",
          na853: split.na853 || "-",
          proip: proip,
          ethsia_pistosi: ethsia,
          q1: q1,
          q2: q2,
          q3: q3,
          q4: q4,
          katanomes_etous: katanomes,
          user_view: userView,
          created_at: split.created_at
            ? new Date(split.created_at).toLocaleDateString("el-GR")
            : "-",
        });
      });
    }

    // Apply styles with currency format
    const budgetCurrencyColumns = [4, 5, 6, 7, 8, 9, 10, 11];
    wsBudgets.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          if (budgetCurrencyColumns.includes(colNumber)) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }
          cell.border = defaultBorder;
        });
        row.height = 22;
        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
          });
        }
      }
    });

    // Add totals row for budgets
    const budgetTotalRow = wsBudgets.addRow({
      id: "",
      mis: "ΣΥΝΟΛΑ:",
      na853: `${budgetSplits?.length || 0} Εγγραφές`,
      proip: budgetTotalProip,
      ethsia_pistosi: budgetTotalEthsia,
      q1: budgetTotalQ1,
      q2: budgetTotalQ2,
      q3: budgetTotalQ3,
      q4: budgetTotalQ4,
      katanomes_etous: budgetTotalKatanomes,
      user_view: budgetTotalUserView,
      created_at: "",
    });

    budgetTotalRow.eachCell((cell, colNumber) => {
      Object.assign(cell, { style: totalRowStyle });
      if (budgetCurrencyColumns.includes(colNumber)) {
        cell.numFmt = currencyFormat;
      }
    });
    budgetTotalRow.height = 28;

    // Generate buffer and send the response
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date as dd-mm-yyyy
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, "0")}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getFullYear()}`;

    // Use ASCII characters for the filename to avoid encoding issues
    const encodedFilename = `Projects-and-Budgets-${formattedDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"`,
    );
    res.setHeader("Content-Length", buffer.byteLength.toString());

    res.end(Buffer.from(buffer));
    console.log(`[Projects] Professional Excel export successful: ${encodedFilename} (${enhancedProjects.length} projects, ${budgetSplits?.length || 0} budget entries)`);
  } catch (error) {
    console.error("Error generating Excel export:", error);
    res.status(500).json({
      message: "Failed to generate Excel export",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Get projects by unit
router.get("/by-unit/:unitName", authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let { unitName } = req.params;

    if (!unitName) {
      return res.status(400).json({ message: "Unit name is required" });
    }

    // Validate and clamp pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 500));

    // Decode URL-encoded Greek characters
    try {
      unitName = decodeURIComponent(unitName);
    } catch (decodeError) {
      console.log(
        `[Projects] Unit name decode error, using original: ${unitName}`,
      );
    }

    console.log(`[Projects] Fetching projects for unit: ${unitName} (page ${page}, pageSize ${pageSize})`);
    console.log(
      `[Projects] Unit name after decoding: "${unitName}" (length: ${unitName.length})`,
    );

    // SECURITY: Verify user has access to this unit
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Get the unit ID from the unit name
    const { data: unitData, error: unitError } = await supabase
      .from("Monada")
      .select("id, unit")
      .eq("unit", unitName)
      .single();

    if (unitError || !unitData) {
      console.log(`[Projects] Unit not found: ${unitName}`);
      return res.status(404).json({ message: "Unit not found" });
    }

    // Check if user has access to this unit (unless admin)
    if (req.user.role !== "admin") {
      const userUnits = Array.isArray(req.user.unit_id) ? req.user.unit_id : req.user.unit_id ? [req.user.unit_id] : [];
      
      if (!userUnits.includes(unitData.id)) {
        console.log(`[Projects] User ${req.user.id} denied access to unit ${unitName} (ID: ${unitData.id})`);
        return res.status(403).json({ 
          message: "You do not have access to this unit's projects" 
        });
      }
    }

    console.log(`[Projects] User authorized to access unit: ${unitName}`);

    // Use the storage method which correctly handles filtering by implementing_agency
    const projects = await storage.getProjectsByUnit(unitName);
    console.log(
      `[Projects] Storage returned ${projects?.length || 0} projects`,
    );

    const total = projects?.length || 0;

    if (!projects || projects.length === 0) {
      console.log(`[Projects] No projects found for unit: ${unitName}`);
      return res.json({
        data: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedProjects = projects.slice(from, to);

    // Return projects with proper formatting (manually constructed to avoid type errors)
    const formattedProjects = paginatedProjects.map((project) => {
      return {
        id: project.id,
        mis: project.mis?.toString() || "",
        e069: project.e069 || "",
        na271: project.na271 || "",
        na853: project.na853 || "",
        event_description: project.event_description || "",
        project_title: project.project_title || "",
        event_year: project.event_year || [],
        budget_e069: project.budget_e069 || 0,
        budget_na271: project.budget_na271 || 0,
        budget_na853: project.budget_na853 || 0,
        status: project.status || "pending",
        event_type_id: project.event_type_id || null,
        created_at: project.created_at,
        updated_at: project.updated_at,
        // Fields that were removed but frontend expects
        implementing_agency: [],
        expenditure_type: [],
      };
    });

    console.log(
      `[Projects] Returning ${formattedProjects.length} of ${total} projects for unit: ${unitName} (page ${page}/${Math.ceil(total / pageSize)})`,
    );

    return res.json({
      data: formattedProjects,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[Projects] Error fetching projects by unit:", error);
    res.status(500).json({
      message: "Failed to fetch projects by unit",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Note: Project regions endpoint moved to routes.ts using optimized schema
// This endpoint was removed to prevent database column errors

// Get complete project data in one call (optimized for performance)
router.get("/:id/complete", authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    console.log(
      `[ProjectComplete] Fetching complete data for project ID: ${projectId}`,
    );

    const authResult = await canAccessProject(req.user, projectId);
    if (!authResult.authorized) {
      return res.status(authResult.statusCode || 403).json({
        message: authResult.error || "Access denied",
      });
    }

    console.log(`[ProjectComplete] User authorized, fetching project data for ID: ${projectId}`);

    // Fetch full project data from Projects table
    const { data: projectData, error: projectError } = await supabase
      .from("Projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !projectData) {
      console.error(`[ProjectComplete] Error fetching full project data:`, projectError);
      return res.status(404).json({ message: "Project data not found" });
    }

    // PERFORMANCE OPTIMIZATION: Fetch only essential project-specific data first
    // Reference data will be cached and loaded separately
    const [decisionsRes, formulationsRes, indexRes, budgetVersionsRes] = await Promise.all([
      supabase
        .from("project_decisions")
        .select("*")
        .eq("project_id", projectId)
        .order("decision_sequence"),
      supabase
        .from("project_formulations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at"),
      supabase.from("project_index").select("*").eq("project_id", projectId),
      supabase
        .from("project_budget_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("formulation_id")
        .order("budget_type")
        .order("version_number"),
    ]);
    
    // Check for errors in budget versions fetch
    if (budgetVersionsRes.error) {
      console.error(
        "[ProjectComplete] Error fetching budget versions:",
        budgetVersionsRes.error,
      );
    }

    // Fetch reference data with optimized queries and smaller limits for initial load
    const [eventTypesRes, unitsRes, expenditureTypesRes, forYlRes] = await Promise.all([
      supabase.from("event_types").select("id, name").limit(50), // Only essential fields
      supabase.from("Monada").select("id, unit, unit_name").limit(30), // Only essential fields
      supabase
        .from("expenditure_types")
        .select("id, expenditure_types")
        .limit(30), // Only essential fields
      supabase.from("for_yl").select("id, foreis"), // For YL (implementing agencies)
    ]);

    // Check for errors in reference data queries
    if (eventTypesRes.error) {
      console.error(
        "[ProjectComplete] Error fetching event types:",
        eventTypesRes.error,
      );
    }
    if (unitsRes.error) {
      console.error("[ProjectComplete] Error fetching units:", unitsRes.error);
    }
    if (expenditureTypesRes.error) {
      console.error(
        "[ProjectComplete] Error fetching expenditure types:",
        expenditureTypesRes.error,
      );
    }

    // Enhance project data with related information
    const eventTypes = eventTypesRes.data || [];
    const units = unitsRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const forYlData = forYlRes.data || [];

    console.log(
      `[ProjectComplete] Before kallikratis loading - got ${eventTypes.length} eventTypes, ${units.length} units, ${expenditureTypes.length} expenditureTypes`,
    );

    // Load normalized geographic data (new system replaces old kallikratis table)
    let kallikratis: any[] = []; // Empty - table no longer exists
    let regions: any[] = [];
    let regionalUnits: any[] = [];
    let municipalities: any[] = [];

    console.log("[ProjectComplete] Skipping old kallikratis table (no longer in use), loading normalized geographic data instead...");

    // Load normalized geographic data
    try {
      console.log("[ProjectComplete] Loading normalized geographic data...");
      const [regionsRes, regionalUnitsRes, municipalitiesRes] =
        await Promise.all([
          supabase.from("regions").select("*"),
          supabase.from("regional_units").select("*"),
          supabase.from("municipalities").select("*"),
        ]);

      regions = regionsRes.data || [];
      regionalUnits = regionalUnitsRes.data || [];
      municipalities = municipalitiesRes.data || [];

      console.log(
        `[ProjectComplete] Loaded normalized geographic data: ${regions.length} regions, ${regionalUnits.length} regional units, ${municipalities.length} municipalities`,
      );
    } catch (geoError) {
      console.warn(
        "[ProjectComplete] Normalized geographic data load failed:",
        geoError,
      );
    }

    // Get related data from project_index entries (the most common ones)
    const projectIndex = indexRes.data || [];
    console.log(
      `[ProjectComplete] Project has ${projectIndex.length} index entries`,
    );

    // Fetch project-specific geographic relationships from junction tables
    let projectRegions: any[] = [];
    let projectRegionalUnits: any[] = [];
    let projectMunicipalities: any[] = [];

    if (projectIndex.length > 0) {
      try {
        console.log(
          `[ProjectComplete] Fetching geographic relationships for project index entries`,
        );

        // Get all project_index IDs for this project
        const projectIndexIds = projectIndex.map((idx) => idx.id);

        // Fetch geographic relationships from junction tables
        // IMPORTANT: Include project_index_id so frontend can map areas to specific agencies
        const [regionsJunctionRes, unitsJunctionRes, munisJunctionRes] =
          await Promise.all([
            supabase
              .from("project_index_regions")
              .select(
                `
              project_index_id,
              region_code,
              regions (
                code,
                name
              )
            `,
              )
              .in("project_index_id", projectIndexIds),
            supabase
              .from("project_index_units")
              .select(
                `
              project_index_id,
              unit_code,
              regional_units (
                code,
                name,
                region_code
              )
            `,
              )
              .in("project_index_id", projectIndexIds),
            supabase
              .from("project_index_munis")
              .select(
                `
              project_index_id,
              muni_code,
              municipalities (
                code,
                name,
                unit_code
              )
            `,
              )
              .in("project_index_id", projectIndexIds),
          ]);

        projectRegions = regionsJunctionRes.data || [];
        projectRegionalUnits = unitsJunctionRes.data || [];
        projectMunicipalities = munisJunctionRes.data || [];

        // DEBUG: Detailed logging for municipality fetch
        console.log(`[ProjectComplete] Municipality query result:`, {
          error: munisJunctionRes.error,
          dataLength: munisJunctionRes.data?.length || 0,
          data: munisJunctionRes.data,
          projectIndexIds: projectIndexIds,
        });

        console.log(
          `[ProjectComplete] Found geographic relationships: ${projectRegions.length} regions, ${projectRegionalUnits.length} units, ${projectMunicipalities.length} municipalities`,
        );
      } catch (junctionError) {
        console.warn(
          "[ProjectComplete] Failed to fetch geographic relationships from junction tables:",
          junctionError,
        );
      }
    }

    // Find the most common values from project_index (for enhanced fields)
    const mostCommonUnit =
      projectIndex.length > 0
        ? units.find((u) => u.id === projectIndex[0].monada_id)
        : null;
    const mostCommonExpenditure =
      projectIndex.length > 0
        ? expenditureTypes.find(
            (et) => et.id === projectIndex[0].expenditure_type_id,
          )
        : null;
    
    // Find for_yl if project has one
    const projectForYlId = projectIndex.length > 0 ? projectIndex[0].for_yl_id : null;
    const forYlItem = projectForYlId
      ? forYlData.find((f) => f.id === projectForYlId)
      : null;
    const forYlForeis = forYlItem?.foreis as { title?: string; monada_id?: string } | null;

    // Find event type from direct field
    const eventType = eventTypes.find(
      (et) => et.id === projectData.event_type_id,
    );

    // Create enhanced project data
    const enhancedProject = {
      ...projectData,
      enhanced_event_type: eventType
        ? {
            id: eventType.id,
            name: eventType.name,
          }
        : null,
      enhanced_expenditure_type: mostCommonExpenditure
        ? {
            id: mostCommonExpenditure.id,
            name: mostCommonExpenditure.expenditure_types,
          }
        : null,
      enhanced_unit: mostCommonUnit
        ? {
            id: mostCommonUnit.id,
            name: mostCommonUnit.unit || mostCommonUnit.unit_name,
          }
        : null,
      enhanced_for_yl: forYlItem
        ? {
            id: forYlItem.id,
            title: forYlForeis?.title || "",
            monada_id: forYlForeis?.monada_id || ""
          }
        : null,
    };

    // Process budget versions and group them by formulation_id
    const budgetVersions = budgetVersionsRes.data || [];
    const budgetVersionsByFormulation = new Map<number, { pde: any[], epa: any[] }>();
    
    budgetVersions.forEach((version) => {
      if (!budgetVersionsByFormulation.has(version.formulation_id)) {
        budgetVersionsByFormulation.set(version.formulation_id, { pde: [], epa: [] });
      }
      const formVersions = budgetVersionsByFormulation.get(version.formulation_id)!;
      // Handle both Greek (ΠΔΕ/ΕΠΑ) and English (pde/epa) budget types
      const budgetTypeNormalized = version.budget_type?.toUpperCase();
      if (budgetTypeNormalized === 'ΠΔΕ' || budgetTypeNormalized === 'PDE') {
        formVersions.pde.push(version);
      } else if (budgetTypeNormalized === 'ΕΠΑ' || budgetTypeNormalized === 'EPA') {
        formVersions.epa.push(version);
      }
    });
    
    console.log(`[ProjectComplete] Processed ${budgetVersions.length} budget versions for ${budgetVersionsByFormulation.size} formulations`);
    
    // Fetch EPA financials for all EPA versions
    const epaVersionIds = budgetVersions
      .filter(v => {
        const typeNormalized = v.budget_type?.toUpperCase();
        return typeNormalized === 'ΕΠΑ' || typeNormalized === 'EPA';
      })
      .map(v => v.id);
    
    let epaFinancialsByVersion = new Map<number, any[]>();
    if (epaVersionIds.length > 0) {
      console.log(`[ProjectComplete] Fetching financials for ${epaVersionIds.length} EPA versions`);
      const { data: epaFinancialsData, error: epaFinancialsError } = await supabase
        .from('epa_financials')
        .select('*')
        .in('epa_version_id', epaVersionIds)
        .order('year');
      
      if (epaFinancialsError) {
        console.error('[ProjectComplete] Error fetching EPA financials:', epaFinancialsError);
      } else {
        // Group financials by epa_version_id
        (epaFinancialsData || []).forEach(financial => {
          if (!epaFinancialsByVersion.has(financial.epa_version_id)) {
            epaFinancialsByVersion.set(financial.epa_version_id, []);
          }
          epaFinancialsByVersion.get(financial.epa_version_id)!.push(financial);
        });
        console.log(`[ProjectComplete] Loaded ${epaFinancialsData?.length || 0} EPA financial records`);
      }
    }
    
    // Attach financials to EPA budget versions
    budgetVersionsByFormulation.forEach((versions, formulationId) => {
      versions.epa = versions.epa.map(epaVersion => ({
        ...epaVersion,
        financials: epaFinancialsByVersion.get(epaVersion.id) || []
      }));
    });
    
    // Attach budget versions to formulations
    const formulationsWithBudgetVersions = (formulationsRes.data || []).map((formulation) => {
      const versions = budgetVersionsByFormulation.get(formulation.id) || { pde: [], epa: [] };
      return {
        ...formulation,
        budget_versions: versions
      };
    });

    const completeData = {
      project: enhancedProject,
      decisions: decisionsRes.data || [],
      formulations: formulationsWithBudgetVersions,
      index: indexRes.data || [],
      eventTypes: eventTypes,
      units: units,
      kallikratis: kallikratis,
      expenditureTypes: expenditureTypes,
      forYl: forYlData, // For YL (implementing agencies)
      // New normalized geographic data
      regions: regions,
      regionalUnits: regionalUnits,
      municipalities: municipalities,
      // Project-specific geographic relationships
      projectGeographicData: {
        regions: projectRegions,
        regionalUnits: projectRegionalUnits,
        municipalities: projectMunicipalities,
      },
    };

    console.log(
      `[ProjectComplete] Successfully fetched complete data for project ${projectId}`,
    );
    console.log(
      `[ProjectComplete] Data counts: decisions=${completeData.decisions.length}, formulations=${completeData.formulations.length}, index=${completeData.index.length}, eventTypes=${completeData.eventTypes.length}, units=${completeData.units.length}, expenditureTypes=${completeData.expenditureTypes.length}, kallikratis=${completeData.kallikratis.length}, regions=${completeData.regions.length}, regionalUnits=${completeData.regionalUnits.length}, municipalities=${completeData.municipalities.length}`,
    );

    res.json(completeData);
  } catch (error) {
    console.error(
      "[ProjectComplete] Error fetching complete project data:",
      error,
    );
    res.status(500).json({
      message: "Failed to fetch complete project data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Separate endpoint for reference data that can be heavily cached
router.get("/reference-data", authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("[ProjectReference] Fetching reference data");

    // Fetch all reference data in parallel with optimized queries
    const [eventTypesRes, unitsRes, expenditureTypesRes, projectIndexRes, forYlRes] =
      await Promise.all([
        supabase.from("event_types").select("id, name").limit(100),
        supabase.from("Monada").select("id, unit, unit_name").limit(50),
        supabase
          .from("expenditure_types")
          .select("id, expenditure_types")
          .limit(50),
        supabase.from("project_index").select("kallikratis_id").limit(5000),
        supabase.from("for_yl").select("id, foreis"), // For YL (implementing agencies)
      ]);

    // Kallikratis table no longer exists - using normalized geographic data instead
    let kallikratisFromIndex: any[] = [];
    console.log(
      "[ProjectReference] Using normalized geographic tables instead of old kallikratis table",
    );

    // Set reasonable caching headers
    res.set("Cache-Control", "public, max-age=300"); // 5 minutes cache

    // Format for_yl data for easy consumption
    const formattedForYl = (forYlRes.data || []).map(item => {
      const foreis = item.foreis as { title?: string; monada_id?: string } | null;
      return {
        id: item.id,
        title: foreis?.title || "",
        monada_id: foreis?.monada_id || ""
      };
    });

    const referenceData = {
      eventTypes: eventTypesRes.data || [],
      units: unitsRes.data || [],
      kallikratis: kallikratisFromIndex,
      expenditureTypes: expenditureTypesRes.data || [],
      forYl: formattedForYl, // For YL (implementing agencies)
    };

    console.log(
      `[ProjectReference] Reference data counts: eventTypes=${referenceData.eventTypes.length}, units=${referenceData.units.length}, expenditureTypes=${referenceData.expenditureTypes.length}, forYl=${referenceData.forYl.length}`,
    );

    res.json(referenceData);
  } catch (error) {
    console.error("[ProjectReference] Error fetching reference data:", error);
    res.status(500).json({
      message: "Failed to fetch reference data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Project Decisions CRUD endpoints
router.get(
  "/:id/decisions",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(`[ProjectDecisions] Fetching decisions for project ID: ${projectId}`);

      const project = await requireProjectAccess(req, res, projectId);
      if (!project) {
        return;
      }

      // Fetch all decisions for this project
      const { data: decisions, error: decisionsError } = await supabase
        .from("project_decisions")
        .select("*")
        .eq("project_id", project.id)
        .order("decision_sequence", { ascending: true });

      if (decisionsError) {
        console.error(
          "[ProjectDecisions] Error fetching decisions:",
          decisionsError,
        );
        return res.status(500).json({
          message: "Failed to fetch decisions",
          error: decisionsError.message,
        });
      }

      console.log(
        `[ProjectDecisions] Found ${decisions?.length || 0} decisions for project ${project.id}`,
      );
      res.json(decisions || []);
    } catch (error) {
      console.error("[ProjectDecisions] Error in decisions endpoint:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.post(
  "/:id/decisions",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);
      const decisionData = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectDecisions] Creating decision for project ID: ${projectId}`,
        decisionData,
      );

      const project = await requireProjectAccess(req, res, projectId);
      if (!project) {
        return;
      }

      // Get the next sequence number
      const { data: lastDecision } = await supabase
        .from("project_decisions")
        .select("decision_sequence")
        .eq("project_id", project.id)
        .order("decision_sequence", { ascending: false })
        .limit(1)
        .single();

      const nextSequence = (lastDecision?.decision_sequence || 0) + 1;

      // Prepare decision data
      const newDecision = {
        project_id: project.id,
        decision_sequence: nextSequence,
        decision_type: decisionData.decision_type || "Έγκριση",
        protocol_number: decisionData.protocol_number || null,
        fek: decisionData.fek || null,
        ada: decisionData.ada || null,
        implementing_agency: decisionData.implementing_agency || [],
        implementing_agency_for_yl: decisionData.implementing_agency_for_yl || {},
        decision_budget: decisionData.decision_budget
          ? parseFloat(
              decisionData.decision_budget.toString().replace(/[.,]/g, ""),
            ) / 100
          : null,
        expenditure_type: decisionData.expenditure_type || [],
        decision_date:
          decisionData.decision_date || new Date().toISOString().split("T")[0],
        included: decisionData.included ?? true,
        comments: decisionData.comments || null,
        created_by: req.user!.id,
        updated_by: req.user!.id,
      };

      const { data: createdDecision, error: createError } = await supabase
        .from("project_decisions")
        .insert(newDecision)
        .select()
        .single();

      if (createError) {
        console.error(
          "[ProjectDecisions] Error creating decision:",
          createError,
        );
        return res.status(500).json({
          message: "Failed to create decision",
          error: createError.message,
        });
      }

      console.log(
        `[ProjectDecisions] Successfully created decision with ID: ${createdDecision.id}`,
      );
      res.status(201).json(createdDecision);
    } catch (error) {
      console.error("[ProjectDecisions] Error creating decision:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.patch(
  "/:id/decisions/:decisionId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, decisionId } = req.params;
      const projectId = parseInt(id);
      const updateData = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectDecisions] Updating decision ${decisionId} for project ID: ${projectId}`,
        updateData,
      );

      const project = await requireProjectAccess(req, res, projectId);
      if (!project) {
        return;
      }

      // Verify the decision exists and belongs to this project
      const { data: existingDecision, error: findError } = await supabase
        .from("project_decisions")
        .select("*")
        .eq("id", decisionId)
        .eq("project_id", project.id)
        .single();

      if (findError || !existingDecision) {
        return res.status(404).json({
          message: "Decision not found",
          error: findError?.message || "Not found",
        });
      }

      // Prepare update data
      const fieldsToUpdate: any = {
        updated_by: req.user!.id,
        updated_at: new Date().toISOString(),
      };

      if (updateData.decision_type)
        fieldsToUpdate.decision_type = updateData.decision_type;
      if (updateData.protocol_number !== undefined)
        fieldsToUpdate.protocol_number = updateData.protocol_number;
      if (updateData.fek !== undefined) fieldsToUpdate.fek = updateData.fek;
      if (updateData.ada !== undefined) fieldsToUpdate.ada = updateData.ada;
      if (updateData.implementing_agency !== undefined)
        fieldsToUpdate.implementing_agency = updateData.implementing_agency;
      if (updateData.implementing_agency_for_yl !== undefined)
        fieldsToUpdate.implementing_agency_for_yl = updateData.implementing_agency_for_yl;
      if (updateData.expenditure_type !== undefined)
        fieldsToUpdate.expenditure_type = updateData.expenditure_type;
      if (updateData.decision_date !== undefined)
        fieldsToUpdate.decision_date = updateData.decision_date;
      if (updateData.included !== undefined)
        fieldsToUpdate.included = updateData.included;
      if (updateData.comments !== undefined)
        fieldsToUpdate.comments = updateData.comments;

      if (updateData.decision_budget !== undefined) {
        fieldsToUpdate.decision_budget = updateData.decision_budget
          ? parseFloat(
              updateData.decision_budget.toString().replace(/[.,]/g, ""),
            ) / 100
          : null;
      }

      const { data: updatedDecision, error: updateError } = await supabase
        .from("project_decisions")
        .update(fieldsToUpdate)
        .eq("id", decisionId)
        .select()
        .single();

      if (updateError) {
        console.error(
          "[ProjectDecisions] Error updating decision:",
          updateError,
        );
        return res.status(500).json({
          message: "Failed to update decision",
          error: updateError.message,
        });
      }

      console.log(
        `[ProjectDecisions] Successfully updated decision ${decisionId}`,
      );
      res.json(updatedDecision);
    } catch (error) {
      console.error("[ProjectDecisions] Error updating decision:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.delete(
  "/:id/decisions/:decisionId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, decisionId } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectDecisions] Deleting decision ${decisionId} for project ID: ${projectId}`,
      );

      const project = await requireProjectAccess(req, res, projectId);
      if (!project) {
        return;
      }

      // Verify the decision exists and belongs to this project
      const { data: existingDecision, error: findError } = await supabase
        .from("project_decisions")
        .select("*")
        .eq("id", decisionId)
        .eq("project_id", project.id)
        .single();

      if (findError || !existingDecision) {
        return res.status(404).json({
          message: "Decision not found",
          error: findError?.message || "Not found",
        });
      }

      const { error: deleteError } = await supabase
        .from("project_decisions")
        .delete()
        .eq("id", decisionId);

      if (deleteError) {
        console.error(
          "[ProjectDecisions] Error deleting decision:",
          deleteError,
        );
        return res.status(500).json({
          message: "Failed to delete decision",
          error: deleteError.message,
        });
      }

      console.log(
        `[ProjectDecisions] Successfully deleted decision ${decisionId}`,
      );
      res.status(204).send();
    } catch (error) {
      console.error("[ProjectDecisions] Error deleting decision:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Project Formulations CRUD endpoints
router.get(
  "/:id/formulations",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectFormulations] Fetching formulations for project ID: ${projectId}`,
      );

      const project = await requireProjectAccess(req, res, projectId);
      if (!project) {
        return;
      }

      // Fetch all formulations for this project
      const { data: formulations, error: formulationsError } = await supabase
        .from("project_formulations")
        .select("*")
        .eq("project_id", project.id)
        .order("formulation_sequence", { ascending: true });

      if (formulationsError) {
        console.error(
          "[ProjectFormulations] Error fetching formulations:",
          formulationsError,
        );
        return res.status(500).json({
          message: "Failed to fetch formulations",
          error: formulationsError.message,
        });
      }

      console.log(
        `[ProjectFormulations] Found ${formulations?.length || 0} formulations for project ${project.id}`,
      );
      res.json(formulations || []);
    } catch (error) {
      console.error(
        "[ProjectFormulations] Error in formulations endpoint:",
        error,
      );
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.post(
  "/:id/formulations",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);
      const formulationData = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectFormulations] Creating formulation for project ID: ${projectId}`,
        formulationData,
      );

      const project = await requireProjectAccess(req, res, projectId);
      if (!project) {
        return;
      }

      // Get the next sequence number
      const { data: lastFormulation } = await supabase
        .from("project_formulations")
        .select("formulation_sequence")
        .eq("project_id", project.id)
        .order("formulation_sequence", { ascending: false })
        .limit(1)
        .single();

      const nextSequence = (lastFormulation?.formulation_sequence || 0) + 1;

      // Prepare formulation data
      const newFormulation = {
        project_id: project.id,
        formulation_sequence: nextSequence,
        sa_type: formulationData.sa || "ΝΑ853",
        enumeration_code: formulationData.enumeration_code || null,
        protocol_number: formulationData.protocol_number || null,
        ada: formulationData.ada || null,
        decision_year: formulationData.decision_year
          ? parseInt(formulationData.decision_year)
          : null,
        project_budget: formulationData.project_budget
          ? parseFloat(
              formulationData.project_budget.toString().replace(/[.,]/g, ""),
            ) / 100
          : 0,
        total_public_expense: formulationData.total_public_expense
          ? parseFloat(formulationData.total_public_expense)
          : null,
        eligible_public_expense: formulationData.eligible_public_expense
          ? parseFloat(formulationData.eligible_public_expense)
          : null,
        epa_version: formulationData.epa_version || null,
        decision_status: formulationData.decision_status || "Ενεργή",
        change_type: formulationData.change_type || "Έγκριση",
        connected_decision_ids: formulationData.connected_decisions || [],
        comments: formulationData.comments || null,
        created_by: req.user!.id,
        updated_by: req.user!.id,
      };

      const { data: createdFormulation, error: createError } = await supabase
        .from("project_formulations")
        .insert(newFormulation)
        .select()
        .single();

      if (createError) {
        console.error(
          "[ProjectFormulations] Error creating formulation:",
          createError,
        );
        return res.status(500).json({
          message: "Failed to create formulation",
          error: createError.message,
        });
      }

      console.log(
        `[ProjectFormulations] Successfully created formulation with ID: ${createdFormulation.id}`,
      );

      // Process budget_versions if provided OR auto-create EPA version from formulation data
      if (formulationData.budget_versions) {
        await processBudgetVersions(
          createdFormulation.id!,
          project.id!,
          formulationData.budget_versions,
          req.user?.id || 0,
        );
      } else if (
        formulationData.epa_version ||
        (formulationData.sa && formulationData.sa !== "ΠΔΕ")
      ) {
        // Auto-create EPA budget version when EPA formulation data exists
        console.log(
          `[ProjectFormulations] Auto-creating EPA budget version for new EPA formulation type: ${formulationData.sa}`,
        );

        const autoEPAVersion = {
          epa: [
            {
              epa_version: formulationData.epa_version || "Αυτόματη Έκδοση 1.0",
              action_type: "Έγκριση",
              financials:
                formulationData.total_public_expense ||
                formulationData.eligible_public_expense
                  ? [
                      {
                        year: new Date().getFullYear(),
                        total_public_expense:
                          formulationData.total_public_expense || "0",
                        eligible_public_expense:
                          formulationData.eligible_public_expense || "0",
                      },
                    ]
                  : [],
            },
          ],
        };

        await processBudgetVersions(
          createdFormulation.id!,
          project.id!,
          autoEPAVersion,
          req.user?.id || 0,
        );
      }

      res.status(201).json(createdFormulation);
    } catch (error) {
      console.error("[ProjectFormulations] Error creating formulation:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.patch(
  "/:id/formulations/:formulationId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, formulationId } = req.params;
      const projectId = parseInt(id);
      const updateData = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectFormulations] Updating formulation ${formulationId} for project ID: ${projectId}`,
        updateData,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the formulation exists and belongs to the project
      const { data: existingFormulation, error: findError } = await supabase
        .from("project_formulations")
        .select("*, Projects!inner(id)")
        .eq("id", formulationId)
        .eq("Projects.id", projectId)
        .single();

      if (findError || !existingFormulation) {
        return res.status(404).json({
          message: "Formulation not found",
          error: findError?.message || "Not found",
        });
      }

      // Prepare update data
      const fieldsToUpdate: any = {
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      };

      if (updateData.sa) fieldsToUpdate.sa_type = updateData.sa;
      if (updateData.enumeration_code !== undefined)
        fieldsToUpdate.enumeration_code = updateData.enumeration_code;
      if (updateData.protocol_number !== undefined)
        fieldsToUpdate.protocol_number = updateData.protocol_number;
      if (updateData.ada !== undefined) fieldsToUpdate.ada = updateData.ada;
      if (updateData.decision_year !== undefined)
        fieldsToUpdate.decision_year = updateData.decision_year
          ? parseInt(updateData.decision_year)
          : null;
      if (updateData.epa_version !== undefined)
        fieldsToUpdate.epa_version = updateData.epa_version;
      if (updateData.decision_status !== undefined)
        fieldsToUpdate.decision_status = updateData.decision_status;
      if (updateData.change_type !== undefined)
        fieldsToUpdate.change_type = updateData.change_type;
      if (updateData.connected_decisions !== undefined)
        fieldsToUpdate.connected_decision_ids = updateData.connected_decisions;
      if (updateData.comments !== undefined)
        fieldsToUpdate.comments = updateData.comments;

      if (updateData.project_budget !== undefined) {
        fieldsToUpdate.project_budget = updateData.project_budget
          ? parseFloat(
              updateData.project_budget.toString().replace(/[.,]/g, ""),
            ) / 100
          : 0;
      }
      if (updateData.total_public_expense !== undefined) {
        fieldsToUpdate.total_public_expense = updateData.total_public_expense
          ? parseFloat(updateData.total_public_expense)
          : null;
      }
      if (updateData.eligible_public_expense !== undefined) {
        fieldsToUpdate.eligible_public_expense =
          updateData.eligible_public_expense
            ? parseFloat(updateData.eligible_public_expense)
            : null;
      }

      const { data: updatedFormulation, error: updateError } = await supabase
        .from("project_formulations")
        .update(fieldsToUpdate)
        .eq("id", formulationId)
        .select()
        .single();

      if (updateError) {
        console.error(
          "[ProjectFormulations] Error updating formulation:",
          updateError,
        );
        return res.status(500).json({
          message: "Failed to update formulation",
          error: updateError.message,
        });
      }

      console.log(
        `[ProjectFormulations] Successfully updated formulation ${formulationId}`,
      );

      // Process budget_versions if provided OR auto-create EPA version from formulation data
      if (updateData.budget_versions) {
        // First, delete existing budget versions for this formulation
        await supabase
          .from("project_budget_versions")
          .delete()
          .eq("formulation_id", formulationId);

        // Then create new ones
        await processBudgetVersions(
          parseInt(formulationId),
          existingFormulation.project_id!,
          updateData.budget_versions,
          req.user?.id || 0,
        );
      } else if (
        updateData.epa_version ||
        (updateData.sa && updateData.sa !== "ΠΔΕ")
      ) {
        // Auto-create EPA budget version when EPA formulation data exists
        console.log(
          `[ProjectFormulations] Auto-creating EPA budget version for EPA formulation type: ${updateData.sa || fieldsToUpdate.sa_type}`,
        );

        const autoEPAVersion = {
          epa: [
            {
              epa_version:
                updateData.epa_version ||
                fieldsToUpdate.epa_version ||
                "Αυτόματη Έκδοση 1.0",
              action_type: "Έγκριση",
              financials:
                updateData.total_public_expense ||
                updateData.eligible_public_expense
                  ? [
                      {
                        year: new Date().getFullYear(),
                        total_public_expense:
                          updateData.total_public_expense || "0",
                        eligible_public_expense:
                          updateData.eligible_public_expense || "0",
                      },
                    ]
                  : [],
            },
          ],
        };

        // Delete existing EPA budget versions for this formulation
        await supabase
          .from("project_budget_versions")
          .delete()
          .eq("formulation_id", formulationId)
          .eq("budget_type", "ΕΠΑ");

        await processBudgetVersions(
          parseInt(formulationId),
          existingFormulation.project_id!,
          autoEPAVersion,
          req.user?.id || 0,
        );
      }

      res.json(updatedFormulation);
    } catch (error) {
      console.error("[ProjectFormulations] Error updating formulation:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.delete(
  "/:id/formulations/:formulationId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, formulationId } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectFormulations] Deleting formulation ${formulationId} for project ID: ${projectId}`,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the formulation exists and belongs to the project
      const { data: existingFormulation, error: findError } = await supabase
        .from("project_formulations")
        .select("*, Projects!inner(id)")
        .eq("id", formulationId)
        .eq("Projects.id", projectId)
        .single();

      if (findError || !existingFormulation) {
        return res.status(404).json({
          message: "Formulation not found",
          error: findError?.message || "Not found",
        });
      }

      const { error: deleteError } = await supabase
        .from("project_formulations")
        .delete()
        .eq("id", formulationId);

      if (deleteError) {
        console.error(
          "[ProjectFormulations] Error deleting formulation:",
          deleteError,
        );
        return res.status(500).json({
          message: "Failed to delete formulation",
          error: deleteError.message,
        });
      }

      console.log(
        `[ProjectFormulations] Successfully deleted formulation ${formulationId}`,
      );
      res.status(204).send();
    } catch (error) {
      console.error("[ProjectFormulations] Error deleting formulation:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Project History/Changes endpoints
router.get(
  "/:id/history",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(`[ProjectHistory] Fetching history for project ID: ${projectId}`);

      // Get the project
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        return res.status(404).json({
          message: "Project not found",
          error: projectError?.message || "Not found",
        });
      }

      // Fetch all history entries for this project
      const { data: history, error: historyError } = await supabase
        .from("project_history")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (historyError) {
        console.error("[ProjectHistory] Error fetching history:", historyError);
        return res.status(500).json({
          message: "Failed to fetch history",
          error: historyError.message,
        });
      }

      console.log(
        `[ProjectHistory] Found ${history?.length || 0} history entries for project ${project.id}`,
      );
      res.json(history || []);
    } catch (error) {
      console.error("[ProjectHistory] Error in history endpoint:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

router.post(
  "/:id/changes",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);
      const changeData = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectChanges] Recording change for project ID: ${projectId}`,
        changeData,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the project
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        return res.status(404).json({
          message: "Project not found",
          error: projectError?.message || "Not found",
        });
      }

      // Prepare change record with current project state snapshot
      const changeRecord = {
        project_id: project.id,
        change_type: changeData.change_type || "UPDATE",
        change_description:
          changeData.description || "Project updated via comprehensive form",
        changed_by: req.user.id,

        // Snapshot of current project state
        project_title: project.project_title,
        event_description: project.event_description,
        status: project.status,
        budget_na853: project.budget_na853,
        budget_na271: project.budget_na271,
        budget_e069: project.budget_e069,
        na853: project.na853,
        na271: project.na271,
        e069: project.e069,
        event_type_id: project.event_type_id,
        event_year: project.event_year,
      };

      const { data: createdChange, error: createError } = await supabase
        .from("project_history")
        .insert(changeRecord)
        .select()
        .single();

      if (createError) {
        console.error(
          "[ProjectChanges] Error creating change record:",
          createError,
        );
        return res.status(500).json({
          message: "Failed to record change",
          error: createError.message,
        });
      }

      console.log(
        `[ProjectChanges] Successfully recorded change with ID: ${createdChange.id}`,
      );
      res.status(201).json(createdChange);
    } catch (error) {
      console.error("[ProjectChanges] Error recording change:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Check if ΣΑ number already exists
router.get(
  "/check-sa/:saValue",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { saValue } = req.params;
      console.log(`[Projects] Checking ΣΑ availability: ${saValue}`);

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (!saValue?.trim()) {
        return res.status(400).json({ message: "ΣΑ value is required" });
      }

      // Check if the ΣΑ number exists in any of the ΣΑ fields
      const { data: existingProject, error } = await supabase
        .from("Projects")
        .select("id, mis, project_title, na853, na271, e069")
        .or(`na853.eq.${saValue},na271.eq.${saValue},e069.eq.${saValue}`)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found
        console.error("[Projects] Error checking ΣΑ availability:", error);
        return res.status(500).json({
          message: "Failed to check ΣΑ availability",
          error: error.message,
        });
      }

      const exists = !!existingProject;
      const response = {
        exists,
        available: !exists,
        ...(existingProject && {
          existingProject: {
            id: existingProject.id,
            mis: existingProject.mis,
            project_title: existingProject.project_title,
            sa_field:
              existingProject.na853 === saValue
                ? "na853"
                : existingProject.na271 === saValue
                  ? "na271"
                  : "e069",
          },
        }),
      };

      console.log(`[Projects] ΣΑ ${saValue} check result:`, response);
      res.json(response);
    } catch (error) {
      console.error("[Projects] Error checking ΣΑ availability:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Create a new project
router.post(
  "/",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectData = req.body;
      console.log("[Projects] Creating new project:", projectData);

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Prepare project data for database insertion
      const fieldsToInsert: any = {
        mis: projectData.mis || null,
        na853: projectData.na853 || null,
        project_title: projectData.project_title || null,
        event_description: projectData.event_description || null,
        event_year: projectData.event_year ? [projectData.event_year] : [],
        status: projectData.status || "Ενεργό",
        event_type_id: projectData.event_type || null,

        // Budget fields
        budget_e069: projectData.budget_e069 || null,
        budget_na271: projectData.budget_na271 || null,
        budget_na853: projectData.budget_na853 || null,

        // New fields: inc_year and updates
        inc_year: projectData.inc_year || null,
        updates: projectData.updates || [],

        // Timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log(
        "[Projects] Inserting project with fields:",
        Object.keys(fieldsToInsert),
      );

      const { data: createdProject, error: createError } = await supabase
        .from("Projects")
        .insert(fieldsToInsert)
        .select()
        .single();

      if (createError) {
        console.error("[Projects] Error creating project:", createError);
        return res.status(500).json({
          message: "Failed to create project",
          error: createError.message,
        });
      }

      console.log(
        `[Projects] Successfully created project with ID: ${createdProject.id}`,
      );
      res.status(201).json(createdProject);
    } catch (error) {
      console.error("[Projects] Error creating project:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Helper function to insert geographic relationships
async function insertGeographicRelationships(
  projectIndexId: number,
  region: any,
) {
  try {
    console.log(
      `[Geographic] Inserting relationships for project_index ID: ${projectIndexId}`,
      region,
    );

    // Load all geographic data for lookups
    const [regionsRes, unitsRes, munisRes] = await Promise.all([
      supabase.from("regions").select("*"),
      supabase.from("regional_units").select("*"),
      supabase.from("municipalities").select("*"),
    ]);

    const regions = regionsRes.data || [];
    const units = unitsRes.data || [];
    const munis = munisRes.data || [];

    // Insert region relationship
    if (region.perifereia && regions.length > 0) {
      const regionEntry = regions.find((r) => r.name === region.perifereia);
      if (regionEntry) {
        console.log(
          `[Geographic] Inserting region relationship: ${regionEntry.code}`,
        );
        const { error: regionError } = await supabase
          .from("project_index_regions")
          .insert({
            project_index_id: projectIndexId,
            region_code: regionEntry.code,
          });

        if (regionError) {
          console.error(
            `[Geographic] Error inserting region relationship:`,
            regionError,
          );
        } else {
          console.log(`[Geographic] Successfully inserted region relationship`);
        }
      } else {
        console.log(`[Geographic] No region found for: ${region.perifereia}`);
      }
    }

    // Insert regional unit relationship
    if (region.perifereiaki_enotita && units.length > 0) {
      const unitEntry = units.find(
        (u) => u.name === region.perifereiaki_enotita,
      );
      if (unitEntry) {
        console.log(
          `[Geographic] Inserting regional unit relationship: ${unitEntry.code}`,
        );
        const { error: unitError } = await supabase
          .from("project_index_units")
          .insert({
            project_index_id: projectIndexId,
            unit_code: unitEntry.code,
          });

        if (unitError) {
          console.error(
            `[Geographic] Error inserting unit relationship:`,
            unitError,
          );
        } else {
          console.log(`[Geographic] Successfully inserted unit relationship`);
        }
      } else {
        console.log(
          `[Geographic] No regional unit found for: ${region.perifereiaki_enotita}`,
        );
      }
    }

    // Insert municipality relationship
    if (region.dimos && munis.length > 0) {
      const muniEntry = munis.find((m) => m.name === region.dimos);
      if (muniEntry) {
        console.log(
          `[Geographic] Inserting municipality relationship: ${muniEntry.code}`,
        );
        const { error: muniError } = await supabase
          .from("project_index_munis")
          .insert({
            project_index_id: projectIndexId,
            muni_code: muniEntry.code,
          });

        if (muniError) {
          console.error(
            `[Geographic] Error inserting municipality relationship:`,
            muniError,
          );
        } else {
          console.log(
            `[Geographic] Successfully inserted municipality relationship`,
          );
        }
      } else {
        console.log(`[Geographic] No municipality found for: ${region.dimos}`);
      }
    }
  } catch (error) {
    console.error(
      `[Geographic] Error in insertGeographicRelationships:`,
      error,
    );
  }
}

// Mount routes
router.get("/", authenticateSession, listProjects);
router.get("/export", authenticateSession, exportProjectsXLSX);
router.get("/export/xlsx", authenticateSession, exportProjectsXLSX);

// Update a project by ID
router.patch(
  "/:id",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);
      const updateData = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(`[Projects] Updating project with ID: ${projectId}`, updateData);

      const existingProject = await requireProjectAccess(req, res, projectId);
      if (!existingProject) {
        return;
      }

      // Conservative update - only use fields we know exist based on actual database structure
      const fieldsToUpdate: any = {};

      // Core text fields that definitely exist
      if (updateData.project_title)
        fieldsToUpdate.project_title = updateData.project_title;
      if (updateData.event_description)
        fieldsToUpdate.event_description = updateData.event_description;
      if (updateData.summary !== undefined)
        fieldsToUpdate.summary = updateData.summary;

      // Handle event_type field - can be ID or text
      if (
        updateData.event_type !== undefined &&
        updateData.event_type !== null
      ) {
        fieldsToUpdate.event_type_id = updateData.event_type;
        console.log(
          `[Projects] Setting event_type_id to: ${updateData.event_type} (type: ${typeof updateData.event_type})`,
        );
      }

      // Legacy code fields that exist - SKIP na853 to avoid unique constraint violations
      if (updateData.e069) fieldsToUpdate.e069 = updateData.e069;
      if (updateData.na271) fieldsToUpdate.na271 = updateData.na271;
      // Skip na853 field - it has unique constraint and shouldn't change after creation
      // if (updateData.na853) fieldsToUpdate.na853 = updateData.na853;

      // Budget fields - use numbers or null
      console.log("[Projects] Received budget values:", {
        budget_e069: updateData.budget_e069,
        budget_na271: updateData.budget_na271,
        budget_na853: updateData.budget_na853,
      });

      if (updateData.budget_e069 !== undefined) {
        fieldsToUpdate.budget_e069 = updateData.budget_e069;
        console.log(
          `[Projects] Setting budget_e069 to: ${updateData.budget_e069} (type: ${typeof updateData.budget_e069})`,
        );
      }
      if (updateData.budget_na271 !== undefined) {
        fieldsToUpdate.budget_na271 = updateData.budget_na271;
        console.log(
          `[Projects] Setting budget_na271 to: ${updateData.budget_na271} (type: ${typeof updateData.budget_na271})`,
        );
      }
      if (updateData.budget_na853 !== undefined) {
        fieldsToUpdate.budget_na853 = updateData.budget_na853;
        console.log(
          `[Projects] Setting budget_na853 to: ${updateData.budget_na853} (type: ${typeof updateData.budget_na853})`,
        );
      }

      // Status if provided (text field)
      if (updateData.status) fieldsToUpdate.status = updateData.status;

      // Event year as JSONB array (matches database structure)
      if (updateData.event_year)
        fieldsToUpdate.event_year = [updateData.event_year];

      // New fields for inc_year and updates
      if (updateData.inc_year !== undefined) {
        fieldsToUpdate.inc_year = updateData.inc_year
          ? parseInt(updateData.inc_year)
          : null;
        console.log(
          `[Projects] Setting inc_year to: ${fieldsToUpdate.inc_year}`,
        );
      }

      // Handle updates/changes field
      if (updateData.updates) {
        // Ensure we have a proper array structure for the JSONB field
        const updatesArray = Array.isArray(updateData.updates)
          ? updateData.updates
          : [];
        fieldsToUpdate.updates = updatesArray;
        console.log(
          `[Projects] Setting updates with ${updatesArray.length} entries`,
        );
      }

      // Always update timestamp
      fieldsToUpdate.updated_at = new Date().toISOString();

      console.log(
        `[Projects] Conservative update - only updating confirmed fields:`,
        Object.keys(fieldsToUpdate),
      );

      console.log(
        `[Projects] Fields to update for project ID ${projectId}:`,
        fieldsToUpdate,
      );

      // Handle connected decisions data from formulation details
      if (
        updateData.formulation_details &&
        Array.isArray(updateData.formulation_details)
      ) {
        console.log(
          "[Projects] Processing connected decisions from formulation details:",
          updateData.formulation_details,
        );

        // Log specific connected decisions data
        updateData.formulation_details.forEach(
          (formulation: any, index: number) => {
            console.log(`[Projects] Formulation ${index + 1}:`, {
              sa: formulation.sa,
              connected_decisions: formulation.connected_decisions,
              connected_decisions_length:
                formulation.connected_decisions?.length || 0,
            });
          },
        );

        // Save connected decisions data to project_history for audit trail
        try {
          const connectedDecisionsData = updateData.formulation_details.map(
            (formulation: any) => ({
              sa: formulation.sa,
              enumeration_code: formulation.enumeration_code,
              protocol_number: formulation.protocol_number,
              ada: formulation.ada,
              decision_year: formulation.decision_year,
              project_budget: formulation.project_budget,
              epa_version: formulation.epa_version || "",
              total_public_expense: formulation.total_public_expense || "",
              eligible_public_expense:
                formulation.eligible_public_expense || "",
              decision_status: formulation.decision_status || "Ενεργή",
              change_type: formulation.change_type || "Έγκριση",
              connected_decisions: formulation.connected_decisions || [],
              comments: formulation.comments || "",
            }),
          );

          // Update or create project_history entry with formulation details and connected decisions
          const { error: historyError } = await supabase
            .from("project_history")
            .upsert({
              project_id: existingProject.id,
              formulation_details: connectedDecisionsData,
              created_at: new Date().toISOString(),
            });

          if (historyError) {
            console.error(
              "[Projects] Error saving connected decisions to project_history:",
              historyError,
            );
          } else {
            console.log(
              "[Projects] Successfully saved connected decisions data to project_history",
            );
          }
        } catch (historyErr) {
          console.error(
            "[Projects] Error processing connected decisions:",
            historyErr,
          );
        }
      }

      // Perform the update
      const { data: updatedProject, error: updateError } = await supabase
        .from("Projects")
        .update(fieldsToUpdate)
        .eq("id", projectId)
        .select()
        .single();

      if (updateError) {
        console.error(
          `[Projects] Error updating project ID ${projectId}:`,
          updateError,
        );
        return res.status(500).json({
          message: "Failed to update project",
          error: updateError.message,
        });
      }

      // Handle project_index table updates for proper foreign key relationships
      // Combine location_details and project_lines into a single array to process
      const projectLinesToProcess = [
        ...(updateData.location_details || []),
        ...(updateData.project_lines || [])
      ];

      if (projectLinesToProcess && Array.isArray(projectLinesToProcess) && projectLinesToProcess.length > 0) {
        console.log(
          `[Projects] Starting project_index update for project ID: ${updatedProject.id}`,
        );
        console.log(
          `[Projects] Number of project_lines to process: ${projectLinesToProcess.length}`,
        );
        console.log(
          `[Projects] Project lines data:`,
          JSON.stringify(projectLinesToProcess, null, 2),
        );

        // Get reference data for ID lookups
        const [
          eventTypesRes,
          expenditureTypesRes,
          monadaRes,
          existingIndexRes,
        ] = await Promise.all([
          supabase.from("event_types").select("*"),
          supabase.from("expenditure_types").select("*"),
          supabase.from("Monada").select("*"),
          supabase.from("project_index").select("id, monada_id, event_types_id, expenditure_type_id").eq("project_id", updatedProject.id),
        ]);

        const eventTypes = eventTypesRes.data || [];
        const expenditureTypes = expenditureTypesRes.data || [];
        const monadaData = monadaRes.data || [];
        const existingIndexEntries = existingIndexRes.data || [];

        // Build a map of existing project_index entries for quick lookup
        const existingIndexMap = new Map<string, number>();
        for (const entry of existingIndexEntries) {
          const key = `${entry.monada_id}-${entry.event_types_id}-${entry.expenditure_type_id}`;
          existingIndexMap.set(key, entry.id);
        }
        console.log(`[Projects] Found ${existingIndexEntries.length} existing project_index entries`);

        // Delete ALL existing geographic relationships for this project's index entries
        // This allows us to re-insert them fresh without constraint issues
        const existingIndexIds = existingIndexEntries.map(e => e.id);
        if (existingIndexIds.length > 0) {
          console.log(`[Projects] Deleting geographic relationships for ${existingIndexIds.length} project_index entries`);
          
          const [regionsDelRes, unitsDelRes, munisDelRes] = await Promise.all([
            supabase.from("project_index_regions").delete().in("project_index_id", existingIndexIds),
            supabase.from("project_index_units").delete().in("project_index_id", existingIndexIds),
            supabase.from("project_index_munis").delete().in("project_index_id", existingIndexIds),
          ]);
          
          console.log(`[Projects] Deleted geographic relationships: regions=${!regionsDelRes.error}, units=${!unitsDelRes.error}, munis=${!munisDelRes.error}`);
        }

        // STEP 1: Group project_lines by unique key (monada_id, event_types_id, expenditure_type_id)
        // and collect all geographic regions for each unique combination
        const groupedLines = new Map<string, { 
          monadaId: number, 
          eventTypeId: number, 
          expenditureTypeId: number, 
          forYlId: number | null,
          regions: any[] 
        }>();

        for (const line of projectLinesToProcess) {
          // Find event type ID
          let eventTypeId = null;
          if (line.event_type) {
            const eventType = eventTypes.find(
              (et) => et.id === line.event_type || et.name === line.event_type,
            );
            eventTypeId = eventType?.id || null;
          }
          if (!eventTypeId && eventTypes.length > 0) {
            eventTypeId = eventTypes[0].id;
          }

          // Find implementing agency (Monada) ID
          let monadaId = null;
          if (line.implementing_agency_id) {
            monadaId = parseInt(line.implementing_agency_id);
          } else if (line.implementing_agency) {
            const monada = monadaData.find((m) => {
              const unitName = typeof m.unit_name === "object" && m.unit_name.name
                ? m.unit_name.name : m.unit_name;
              return m.id == line.implementing_agency ||
                m.unit === line.implementing_agency ||
                unitName === line.implementing_agency ||
                (unitName && line.implementing_agency.includes(unitName)) ||
                (unitName && unitName.includes(line.implementing_agency));
            });
            monadaId = monada ? parseInt(monada.id) : null;
          }

          if (!monadaId || !eventTypeId) {
            console.warn(`[Projects] Skipping line - missing monadaId (${monadaId}) or eventTypeId (${eventTypeId})`);
            continue;
          }

          // Get for_yl_id from the line (delegated implementing agency)
          // Note: null means explicitly cleared, undefined means not provided
          const forYlId = line.for_yl_id !== undefined 
            ? (line.for_yl_id ? parseInt(line.for_yl_id) : null)
            : undefined;

          // Process each expenditure type
          const expTypes = line.expenditure_types && Array.isArray(line.expenditure_types) && line.expenditure_types.length > 0
            ? line.expenditure_types
            : ['ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ']; // default

          for (const expType of expTypes) {
            const expenditureType = expenditureTypes.find(
              (et) => et.id == expType || et.expenditure_types === expType || et.id === parseInt(expType),
            );
            const expenditureTypeId = expenditureType?.id || null;

            if (!expenditureTypeId) {
              console.warn(`[Projects] Could not find expenditure type ID for: ${expType}`);
              continue;
            }

            // Create unique key for this combination
            const key = `${monadaId}-${eventTypeId}-${expenditureTypeId}`;

            if (!groupedLines.has(key)) {
              groupedLines.set(key, {
                monadaId,
                eventTypeId,
                expenditureTypeId,
                forYlId: forYlId !== undefined ? forYlId : null,
                regions: [],
              });
            } else if (forYlId !== undefined) {
              // Update for_yl_id if this line has an explicit value (including null for clearing)
              // and either the existing entry is undefined or this is a more explicit value
              const existing = groupedLines.get(key)!;
              if (forYlId !== null || existing.forYlId === null) {
                // Set if new value is a number, or if both are null (keep null)
                existing.forYlId = forYlId;
              }
            }

            // Add this line's region to the group (if it has one)
            if (line.region) {
              groupedLines.get(key)!.regions.push(line.region);
            }
          }
        }

        console.log(`[Projects] Grouped ${projectLinesToProcess.length} lines into ${groupedLines.size} unique index entries`);

        // STEP 2: For each unique combination, get existing or create new project_index entry
        // and insert ALL geographic relationships from all lines in that group
        for (const [key, group] of Array.from(groupedLines.entries())) {
          try {
            let projectIndexId: number;

            // Check if entry already exists
            if (existingIndexMap.has(key)) {
              projectIndexId = existingIndexMap.get(key)!;
              console.log(`[Projects] Reusing existing project_index entry for key ${key}, ID: ${projectIndexId}`);
              
              // Update for_yl_id on existing entry if explicitly provided
              // A non-null value means set the for_yl, null means clear it
              if (group.forYlId !== undefined) {
                const updateResult = await supabase
                  .from("project_index")
                  .update({ for_yl_id: group.forYlId })
                  .eq("id", projectIndexId);
                
                if (updateResult.error) {
                  console.warn(`[Projects] Failed to update for_yl_id on project_index ${projectIndexId}:`, updateResult.error);
                } else {
                  console.log(`[Projects] Updated for_yl_id to ${group.forYlId} on project_index ${projectIndexId}`);
                }
              }
            } else {
              // Create new entry
              const indexEntry = {
                project_id: updatedProject.id,
                monada_id: group.monadaId,
                event_types_id: group.eventTypeId,
                expenditure_type_id: group.expenditureTypeId,
                for_yl_id: group.forYlId,
              };

              console.log(`[Projects] Creating new project_index entry for key ${key}:`, indexEntry);

              const result = await supabase
                .from("project_index")
                .insert(indexEntry)
                .select("id")
                .single();

              if (result.error) {
                console.error(`[Projects] Error inserting project_index entry:`, result.error);
                continue;
              }

              projectIndexId = result.data?.id;
              if (!projectIndexId) {
                console.error(`[Projects] No ID returned for project_index entry`);
                continue;
              }
              
              console.log(`[Projects] Created new project_index entry, ID: ${projectIndexId}`);
            }

            // Insert ALL geographic relationships from ALL lines with this key
            console.log(`[Projects] Inserting ${group.regions.length} geographic relationships for project_index ID: ${projectIndexId}`);
            for (const region of group.regions) {
              await insertGeographicRelationships(projectIndexId, region);
            }

            console.log(`[Projects] Completed inserting geographic relationships for project_index ID: ${projectIndexId}`);
          } catch (lineError) {
            console.error(`[Projects] Error processing grouped line ${key}:`, lineError);
          }
        }
      }

      // Get enhanced data for the updated project
      const [
        eventTypesRes,
        expenditureTypesRes,
        monadaRes,
        indexRes,
      ] = await Promise.all([
        supabase.from("event_types").select("*"),
        supabase.from("expenditure_types").select("*"),
        supabase.from("Monada").select("*"),
        supabase.from("project_index").select("*"),
      ]);

      const eventTypes = eventTypesRes.data || [];
      const expenditureTypes = expenditureTypesRes.data || [];
      const monadaData = monadaRes.data || [];
      const indexData = indexRes.data || [];

      // Find enhanced data for this project
      const indexItem = indexData.find(
        (idx) => idx.project_id === updatedProject.id,
      );
      const eventType = indexItem
        ? eventTypes.find((et) => et.id === indexItem.event_types_id)
        : null;
      const expenditureType = indexItem
        ? expenditureTypes.find((et) => et.id === indexItem.expenditure_type_id)
        : null;
      const monada = indexItem
        ? monadaData.find((m) => m.id === indexItem.monada_id)
        : null;

      // Return the updated project with enhanced data
      const enhancedProject = {
        ...updatedProject,
        enhanced_event_type: eventType
          ? {
              id: eventType.id,
              name: eventType.name,
            }
          : null,
        enhanced_expenditure_type: expenditureType
          ? {
              id: expenditureType.id,
              name: expenditureType.expenditure_types,
            }
          : null,
        enhanced_unit: monada
          ? {
              id: monada.id,
              name: monada.unit,
            }
          : null,
      };

      console.log(`[Projects] Successfully updated project with ID: ${projectId}`);

      // Return enhanced project with update summary
      res.json({
        ...enhancedProject,
        updateSummary: {
          projectUpdated: true,
          projectIndexEntriesUpdated: updateData.project_lines
            ? updateData.project_lines.length > 0
            : false,
          message: "Project successfully updated with comprehensive form data",
        },
      });
    } catch (error) {
      console.error(`[Projects] Error updating project:`, error);
      res.status(500).json({
        message: "Failed to update project",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Combined reference data endpoint for faster loading - must be before /:id route
router.get(
  "/reference-data",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    console.log(`[ReferenceData] Fetching combined reference data`);

    try {
      const [
        eventTypesResult,
        unitsResult,
        expenditureTypesResult,
      ] = await Promise.all([
        supabase.from("event_types").select("*").order("id"),
        supabase.from("Monada").select("*").order("id"),
        supabase.from("expenditure_types").select("*").order("id"),
      ]);

      const referenceData = {
        event_types: eventTypesResult.data || [],
        units: unitsResult.data || [],
        expenditure_types: expenditureTypesResult.data || [],
      };

      console.log(
        `[ReferenceData] Successfully fetched combined reference data: ${referenceData.event_types.length} event types, ${referenceData.units.length} units, ${referenceData.expenditure_types.length} expenditure types`,
      );

      res.json(referenceData);
    } catch (error) {
      console.error(`[ReferenceData] Error fetching reference data:`, error);
      res.status(500).json({
        message: "Failed to fetch reference data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get single project by ID with enhanced data
router.get(
  "/:id",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(`[Projects] Fetching project with ID: ${projectId}`);

      if (!req.user) {
        console.error(
          `[Projects] No authenticated user found when fetching project ID: ${projectId}`,
        );
        return res.status(401).json({
          message: "Authentication required",
        });
      }

      // Get project data with enhanced information including project_history
      const [
        projectRes,
        eventTypesRes,
        expenditureTypesRes,
        monadaRes,
        indexRes,
      ] = await Promise.all([
        supabase.from("Projects").select("*").eq("id", projectId).single(),
        supabase.from("event_types").select("*"),
        supabase.from("expenditure_types").select("*"),
        supabase.from("Monada").select("*"),
        supabase.from("project_index").select("*"),
      ]);

      // Get project_history data separately after we have the project ID
      let historyData = null;
      if (projectRes.data) {
        const { data: history } = await supabase
          .from("project_history")
          .select("*")
          .eq("project_id", projectRes.data.id)
          .single();
        historyData = history;
      }

      if (projectRes.error || !projectRes.data) {
        console.error(`[Projects] Project not found for ID ${projectId}`);
        return res.status(404).json({
          message: "Project not found",
          error: projectRes.error?.message || "Not found",
        });
      }

      const project = projectRes.data;
      const eventTypes = eventTypesRes.data || [];
      const expenditureTypes = expenditureTypesRes.data || [];
      const monadaData = monadaRes.data || [];
      const indexData = indexRes.data || [];

      // Find enhanced data for this project
      const indexItem = indexData.find((idx) => idx.project_id === project.id);
      const eventType = indexItem
        ? eventTypes.find((et) => et.id === indexItem.event_types_id)
        : null;
      const expenditureType = indexItem
        ? expenditureTypes.find((et) => et.id === indexItem.expenditure_type_id)
        : null;
      const monada = indexItem
        ? monadaData.find((m) => m.id === indexItem.monada_id)
        : null;

      // Get decision data from project_history instead of duplicated columns
      const decisions = historyData?.decisions || [];
      const decisionData = decisions.length > 0 ? decisions[0] : {};

      // Return project with enhanced data, structuring decision data from project_history
      const enhancedProject = {
        // Core project data (keeping only essential fields)
        id: project.id,
        mis: project.mis,
        project_title: project.project_title,
        event_description: project.event_description,
        status: project.status,
        created_at: project.created_at,
        updated_at: project.updated_at,
        // Budget and code fields (keeping for calculations)
        budget_e069: project.budget_e069,
        budget_na271: project.budget_na271,
        budget_na853: project.budget_na853,
        e069: project.e069,
        na271: project.na271,
        na853: project.na853,
        event_year: project.event_year,

        // Enhanced relational data
        enhanced_event_type: eventType
          ? {
              id: eventType.id,
              name: eventType.name,
            }
          : null,
        enhanced_expenditure_type: expenditureType
          ? {
              id: expenditureType.id,
              name: expenditureType.expenditure_types,
            }
          : null,
        enhanced_unit: monada
          ? {
              id: monada.id,
              name: monada.unit,
            }
          : null,

        // Decision data from project_history (replacing duplicated columns)
        decisions: historyData?.decisions || [],
        decision_data: {
          kya: decisionData.protocol_number || project.kya, // Fallback during transition
          fek: decisionData.fek || project.fek,
          ada: decisionData.ada || project.ada,
          implementing_agency: decisionData.implementing_agency,
          decision_budget: decisionData.decision_budget,
          expenses_covered: decisionData.expenses_covered,
          decision_type: decisionData.decision_type,
          is_included: decisionData.is_included,
          comments: decisionData.comments,
        },

        // Structured data from project_history
        formulation: historyData?.formulation || [],
        changes: historyData?.changes || [],

        // Backward compatibility - keep some original fields for components that still need them
        kya: decisionData.protocol_number || project.kya,
        fek: decisionData.fek || project.fek,
        ada: decisionData.ada || project.ada,
      };

      console.log(`[Projects] Found project with ID: ${projectId}`);
      res.json(enhancedProject);
    } catch (error) {
      console.error(`[Projects] Error fetching project:`, error);
      res.status(500).json({
        message: "Failed to fetch project",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get project decisions from normalized table (DUPLICATE - already defined above)
router.get(
  "/:id/decisions",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectDecisions] Fetching decisions for project ID: ${projectId}`,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the project
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id, mis")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          `[ProjectDecisions] Project not found for ID: ${projectId}`,
          projectError,
        );
        return res.status(404).json({ message: "Project not found" });
      }

      // Get decisions from normalized table
      const { data: decisions, error: decisionsError } = await supabase
        .from("project_decisions")
        .select("*")
        .eq("project_id", project.id)
        .order("decision_sequence");

      if (decisionsError) {
        console.error(
          `[ProjectDecisions] Error fetching decisions:`,
          decisionsError,
        );
        return res.status(500).json({ message: "Failed to fetch decisions" });
      }

      console.log(
        `[ProjectDecisions] Found ${decisions?.length || 0} decisions for project ID: ${projectId}`,
      );
      res.json(decisions || []);
    } catch (error) {
      console.error(`[ProjectDecisions] Error:`, error);
      res.status(500).json({
        message: "Failed to fetch project decisions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get project formulations from normalized table (DUPLICATE - already defined above)
router.get(
  "/:id/formulations",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log(
        `[ProjectFormulations] Fetching formulations for project ID: ${projectId}`,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the project
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id, mis")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          `[ProjectFormulations] Project not found for ID: ${projectId}`,
          projectError,
        );
        return res.status(404).json({ message: "Project not found" });
      }

      // Get formulations from normalized table with optional linked decision data
      const { data: formulations, error: formulationsError } = await supabase
        .from("project_formulations")
        .select(
          `
        *,
        project_decisions(
          id,
          decision_type,
          protocol_number,
          fek,
          ada
        )
      `,
        )
        .eq("project_id", project.id)
        .order("formulation_sequence");

      if (formulationsError) {
        console.error(
          `[ProjectFormulations] Error fetching formulations:`,
          formulationsError,
        );
        return res
          .status(500)
          .json({ message: "Failed to fetch formulations" });
      }

      console.log(
        `[ProjectFormulations] Found ${formulations?.length || 0} formulations for project ID ${projectId}`,
      );
      res.json(formulations || []);
    } catch (error) {
      console.error(`[ProjectFormulations] Error:`, error);
      res.status(500).json({
        message: "Failed to fetch project formulations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get project index data with all relationships
router.get(
  "/:id/index",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId } = req.params;

      console.log(`[ProjectIndex] Fetching project index data for project ID: ${projectId}`);

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // First get the project to get the project_id
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id, mis")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          `[ProjectIndex] Project not found for ID: ${projectId}`,
          projectError,
        );
        return res.status(404).json({ message: "Project not found" });
      }

      // Get project index data with all related entities
      const { data: indexData, error: indexError } = await supabase
        .from("project_index")
        .select(
          `
        *,
        monada:Monada!inner(
          id,
          unit,
          unit_name,
          email,
          manager,
          address
        ),
        kallikratis(
          id,
          kodikos_neou_ota,
          eidos_neou_ota,
          onoma_neou_ota,
          kodikos_perifereiakis_enotitas,
          perifereiaki_enotita,
          kodikos_perifereias,
          perifereia
        ),
        event_types(
          id,
          name
        ),
        expenditure_types(
          id,
          expenditure_types,
          expenditure_types_minor
        )
      `,
        )
        .eq("project_id", project.id);

      if (indexError) {
        console.error(`[ProjectIndex] Error fetching index data:`, indexError);
        return res
          .status(500)
          .json({ message: "Failed to fetch project index data" });
      }

      console.log(
        `[ProjectIndex] Found ${indexData?.length || 0} index entries for project ${project.mis}`,
      );
      res.json(indexData || []);
    } catch (error) {
      console.error(`[ProjectIndex] Error:`, error);
      res.status(500).json({
        message: "Failed to fetch project index data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Update project decisions (normalized table)
router.put(
  "/:id/decisions",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId } = req.params;
      const { decisions_data } = req.body;

      console.log(
        `[ProjectDecisions] Updating decisions for project ID: ${projectId}`,
        decisions_data,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // First get the project to get the project_id
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id, mis")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          `[ProjectDecisions] Project not found for ID: ${projectId}`,
          projectError,
        );
        return res.status(404).json({ message: "Project not found" });
      }

      // Delete existing decisions for this project
      const { error: deleteError } = await supabase
        .from("project_decisions")
        .delete()
        .eq("project_id", project.id);

      if (deleteError) {
        console.error(
          `[ProjectDecisions] Error deleting existing decisions:`,
          deleteError,
        );
        return res
          .status(500)
          .json({ message: "Failed to delete existing decisions" });
      }

      // Insert new decisions
      if (
        decisions_data &&
        Array.isArray(decisions_data) &&
        decisions_data.length > 0
      ) {
        const decisionsToInsert = decisions_data.map(
          (decision: any, index: number) => {
            // Parse European formatted budget values to numbers
            const parseEuropeanBudget = (value: string | number) => {
              if (!value) return 0;
              if (typeof value === "number") return value;

              const strValue = String(value)
                .trim()
                .replace(/[^\d,.-]/g, ""); // Remove currency symbols

              // Handle European format: "15.000,12" -> 15000.12
              if (strValue.includes(".") && strValue.includes(",")) {
                // Remove dots (thousands separators) and replace comma with decimal point
                const normalized = strValue
                  .replace(/\./g, "")
                  .replace(",", ".");
                const result = parseFloat(normalized) || 0;
                console.log(
                  `[ProjectDecisions] Parsed European format: "${strValue}" -> ${result}`,
                );
                return result;
              }

              // Handle comma as decimal separator: "22,50" -> 22.50
              if (strValue.includes(",") && !strValue.includes(".")) {
                const result = parseFloat(strValue.replace(",", ".")) || 0;
                console.log(
                  `[ProjectDecisions] Parsed decimal format: "${strValue}" -> ${result}`,
                );
                return result;
              }

              // Handle dots as thousands separators only: "15.000" -> 15000
              if (strValue.includes(".") && !strValue.includes(",")) {
                const dotCount = (strValue.match(/\./g) || []).length;
                const afterLastDot = strValue.split(".").pop() || "";

                // If last part has exactly 3 digits, treat dots as thousands separators
                if (afterLastDot.length === 3 || dotCount > 1) {
                  const result = parseFloat(strValue.replace(/\./g, "")) || 0;
                  console.log(
                    `[ProjectDecisions] Parsed thousands format: "${strValue}" -> ${result}`,
                  );
                  return result;
                }
              }

              // Handle standard format
              const result = parseFloat(strValue) || 0;
              console.log(
                `[ProjectDecisions] Parsed standard format: "${strValue}" -> ${result}`,
              );
              return result;
            };

            console.log(
              `[ProjectDecisions] Processing decision ${index + 1}:`,
              {
                protocol_number: decision.protocol_number,
                decision_budget: decision.decision_budget,
                parsed_budget: parseEuropeanBudget(decision.decision_budget),
              },
            );

            return {
              project_id: project.id,
              decision_sequence: index + 1,
              decision_type: decision.decision_type || "Έγκριση",
              protocol_number: decision.protocol_number || null,
              fek: decision.fek || null,
              ada: decision.ada || null,
              implementing_agency: decision.implementing_agency || [],
              implementing_agency_for_yl: decision.implementing_agency_for_yl || {},
              decision_budget: parseEuropeanBudget(decision.decision_budget),
              expenditure_type: decision.expenditure_type || [],
              decision_date: new Date().toISOString().split("T")[0], // Today's date as default
              included:
                decision.included !== undefined ? decision.included : true,
              is_active: true,
              comments: decision.comments || null,
              created_by: req.user!.id,
              updated_by: req.user!.id,
            };
          },
        );

        const { error: insertError } = await supabase
          .from("project_decisions")
          .insert(decisionsToInsert);

        if (insertError) {
          console.error(
            `[ProjectDecisions] Error inserting decisions:`,
            insertError,
          );
          return res
            .status(500)
            .json({ message: "Failed to insert decisions" });
        }

        console.log(
          `[ProjectDecisions] Successfully inserted ${decisionsToInsert.length} decisions for project ${project.mis}`,
        );
      }

      res.json({
        message: "Decisions updated successfully",
        decisions_count: decisions_data?.length || 0,
      });
    } catch (error) {
      console.error(`[ProjectDecisions] Error updating decisions:`, error);
      res.status(500).json({
        message: "Failed to update project decisions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Update project formulations (normalized table)
router.put(
  "/:id/formulations",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId } = req.params;
      const { formulation_details, budget_versions, location_details } =
        req.body;

      console.log(
        `[ProjectFormulations] Updating formulations with budget versions for project ID: ${projectId}`,
        { formulation_details, budget_versions },
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // First get the project to get the project_id
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id, mis")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          `[ProjectFormulations] Project not found for ID: ${projectId}`,
          projectError,
        );
        return res.status(404).json({ message: "Project not found" });
      }

      // Get existing decisions for this project to map indices to IDs
      const { data: existingDecisions, error: decisionsError } = await supabase
        .from("project_decisions")
        .select("id")
        .eq("project_id", project.id)
        .order("decision_sequence");

      if (decisionsError) {
        console.error(
          `[ProjectFormulations] Error fetching decisions for mapping:`,
          decisionsError,
        );
        return res
          .status(500)
          .json({ message: "Failed to fetch decisions for mapping" });
      }

      console.log(
        `[ProjectFormulations] Found ${existingDecisions?.length || 0} decisions for mapping connected decisions`,
      );

      // Delete existing formulations for this project
      const { error: deleteError } = await supabase
        .from("project_formulations")
        .delete()
        .eq("project_id", project.id);

      if (deleteError) {
        console.error(
          `[ProjectFormulations] Error deleting existing formulations:`,
          deleteError,
        );
        return res
          .status(500)
          .json({ message: "Failed to delete existing formulations" });
      }

      // Delete existing budget versions for this project
      const { error: deleteBudgetVersionsError } = await supabase
        .from("project_budget_versions")
        .delete()
        .eq("project_id", project.id);

      if (deleteBudgetVersionsError) {
        console.error(
          `[ProjectFormulations] Error deleting existing budget versions:`,
          deleteBudgetVersionsError,
        );
        return res
          .status(500)
          .json({ message: "Failed to delete existing budget versions" });
      }

      // Insert new formulations (without budget fields)
      if (
        formulation_details &&
        Array.isArray(formulation_details) &&
        formulation_details.length > 0
      ) {
        const formulationsToInsert = formulation_details.map(
          (formulation: any, index: number) => {
            console.log(
              `[ProjectFormulations] Processing formulation ${index + 1}:`,
              {
                sa: formulation.sa,
                enumeration_code: formulation.enumeration_code,
              },
            );

            return {
              project_id: project.id,
              formulation_sequence: index + 1,
              sa_type: formulation.sa || "ΝΑ853",
              enumeration_code: formulation.enumeration_code || null,
              protocol_number: formulation.protocol_number || null,
              ada: formulation.ada || null,
              decision_year: formulation.decision_year
                ? parseInt(formulation.decision_year)
                : null,
              // Remove budget fields - they go to budget_versions table now
              decision_status: formulation.decision_status || "Ενεργή",
              change_type: formulation.change_type || "Έγκριση",
              connected_decision_ids: Array.isArray(
                formulation.connected_decisions,
              )
                ? formulation.connected_decisions
                    .map((indexStr: string) => {
                      const index = parseInt(indexStr);
                      if (
                        !isNaN(index) &&
                        existingDecisions &&
                        index < existingDecisions.length
                      ) {
                        const decisionId = existingDecisions[index]?.id;
                        console.log(
                          `[ProjectFormulations] Mapping connected decision index ${index} to ID ${decisionId}`,
                        );
                        return decisionId;
                      }
                      console.log(
                        `[ProjectFormulations] Invalid connected decision index: ${indexStr}`,
                      );
                      return null;
                    })
                    .filter((id: number | null) => id !== null)
                : [],
              comments: formulation.comments || null,
              is_active: true,
              created_by: req.user?.id || null,
              updated_by: req.user?.id || null,
            };
          },
        );

        const { data: insertedFormulations, error: insertError } =
          await supabase
            .from("project_formulations")
            .insert(formulationsToInsert)
            .select();

        if (insertError) {
          console.error(
            `[ProjectFormulations] Error inserting formulations:`,
            insertError,
          );
          return res
            .status(500)
            .json({ message: "Failed to insert formulations" });
        }

        console.log(
          `[ProjectFormulations] Successfully inserted ${insertedFormulations.length} formulations for project ${project.mis}`,
        );

        // Now insert budget versions if provided
        if (
          budget_versions &&
          Array.isArray(budget_versions) &&
          budget_versions.length > 0
        ) {
          const budgetVersionsToInsert: any[] = [];

          // Parse European formatted budget values to numbers
          const parseEuropeanBudget = (value: string | number) => {
            if (!value) return 0;
            if (typeof value === "number") return value;

            const strValue = String(value).replace(/[^\d,.-]/g, ""); // Remove currency symbols
            if (strValue.includes(".") && strValue.includes(",")) {
              return (
                parseFloat(strValue.replace(/\./g, "").replace(",", ".")) || 0
              );
            }
            if (strValue.includes(",")) {
              return parseFloat(strValue.replace(",", ".")) || 0;
            }
            return parseFloat(strValue) || 0;
          };

          // Process each formulation's budget versions
          budget_versions.forEach(
            (budgetVersions: any, formulationIndex: number) => {
              const formulation = insertedFormulations[formulationIndex];
              if (!formulation) return;

              // Process ΠΔΕ versions
              if (budgetVersions.pde && Array.isArray(budgetVersions.pde)) {
                budgetVersions.pde.forEach((pdeVersion: any) => {
                  budgetVersionsToInsert.push({
                    project_id: project.id,
                    formulation_id: formulation.id,
                    budget_type: "ΠΔΕ",
                    boundary_budget: parseEuropeanBudget(
                      pdeVersion.boundary_budget || pdeVersion.project_budget,
                    ),
                    protocol_number: pdeVersion.protocol_number || null,
                    ada: pdeVersion.ada || null,
                    decision_date: pdeVersion.decision_date || null,
                    action_type:
                      pdeVersion.action_type ||
                      pdeVersion.decision_type ||
                      "Έγκριση",
                    comments: pdeVersion.comments || null,
                    created_by: req.user?.id || null,
                    updated_by: req.user?.id || null,
                  });
                });
              }

              // Process ΕΠΑ versions
              if (budgetVersions.epa && Array.isArray(budgetVersions.epa)) {
                budgetVersions.epa.forEach((epaVersion: any) => {
                  budgetVersionsToInsert.push({
                    project_id: project.id,
                    formulation_id: formulation.id,
                    budget_type: "ΕΠΑ",
                    epa_version: epaVersion.epa_version || null,
                    boundary_budget: parseEuropeanBudget(
                      epaVersion.boundary_budget || epaVersion.amount,
                    ),
                    protocol_number: epaVersion.protocol_number || null,
                    ada: epaVersion.ada || null,
                    decision_date: epaVersion.decision_date || null,
                    action_type:
                      epaVersion.action_type ||
                      epaVersion.decision_type ||
                      "Έγκριση",
                    comments: epaVersion.comments || null,
                    created_by: req.user?.id || null,
                    updated_by: req.user?.id || null,
                  });
                });
              }
            },
          );

          // Insert budget versions if any
          if (budgetVersionsToInsert.length > 0) {
            const { data: insertedBudgetVersions, error: budgetInsertError } =
              await supabase
                .from("project_budget_versions")
                .insert(budgetVersionsToInsert)
                .select();

            if (budgetInsertError) {
              console.error(
                `[ProjectFormulations] Error inserting budget versions:`,
                budgetInsertError,
              );
              return res
                .status(500)
                .json({ message: "Failed to insert budget versions" });
            }

            console.log(
              `[ProjectFormulations] Successfully inserted ${insertedBudgetVersions.length} budget versions`,
            );
          }
        }

        // Process location_details after formulations are successfully created
        if (
          location_details &&
          Array.isArray(location_details) &&
          location_details.length > 0
        ) {
          console.log(
            `[ProjectFormulations] Processing ${location_details.length} location details`,
          );

          // First, delete existing project_index entries for this project
          const { error: deleteIndexError } = await supabase
            .from("project_index")
            .delete()
            .eq("project_id", project.id);

          if (deleteIndexError) {
            console.error(
              `[ProjectFormulations] Error deleting existing project_index:`,
              deleteIndexError,
            );
          } else {
            console.log(
              `[ProjectFormulations] Deleted existing project_index entries`,
            );
          }

          // Get reference data for lookups
          const [eventTypesRes, expenditureTypesRes, monadaRes] =
            await Promise.all([
              supabase.from("event_types").select("*"),
              supabase.from("expenditure_types").select("*"),
              supabase.from("Monada").select("*"),
            ]);

          const eventTypes = eventTypesRes.data || [];
          const expenditureTypes = expenditureTypesRes.data || [];
          const monadaData = monadaRes.data || [];

          // Process each location detail
          for (const locationDetail of location_details) {
            try {
              console.log(`[ProjectFormulations] Processing location detail:`, {
                implementing_agency: locationDetail.implementing_agency,
                event_type: locationDetail.event_type,
                expenditure_types:
                  locationDetail.expenditure_types?.length || 0,
                geographic_areas: locationDetail.geographic_areas?.length || 0,
              });

              // Find event type ID
              let eventTypeId = null;
              if (locationDetail.event_type) {
                const eventType = eventTypes.find(
                  (et) => et.name === locationDetail.event_type,
                );
                eventTypeId = eventType?.id || null;
                console.log(
                  `[ProjectFormulations] Event type "${locationDetail.event_type}" -> ID: ${eventTypeId}`,
                );
              }

              // Find implementing agency ID
              let monadaId = null;
              if (locationDetail.implementing_agency) {
                const monada = monadaData.find((m) => {
                  const unitName =
                    typeof m.unit_name === "object" && m.unit_name.name
                      ? m.unit_name.name
                      : m.unit_name;
                  return (
                    unitName === locationDetail.implementing_agency ||
                    m.unit === locationDetail.implementing_agency
                  );
                });
                monadaId = monada?.id || null;
                console.log(
                  `[ProjectFormulations] Agency "${locationDetail.implementing_agency}" -> ID: ${monadaId}`,
                );
              }

              // Process each expenditure type
              const expenditureTypesToProcess =
                locationDetail.expenditure_types || [];
              if (expenditureTypesToProcess.length === 0) {
                // Use default expenditure type if none specified
                expenditureTypesToProcess.push("ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ");
              }

              for (const expType of expenditureTypesToProcess) {
                const expenditureType = expenditureTypes.find(
                  (et) => et.expenditure_types === expType,
                );
                const expenditureTypeId = expenditureType?.id || null;

                if (expenditureTypeId && eventTypeId && monadaId) {
                  // Process each geographic area
                  const geographicAreas = locationDetail.geographic_areas || [];

                  for (const geographicArea of geographicAreas) {
                    // Parse geographic area string: "REGION|REGIONAL_UNIT|MUNICIPALITY"
                    const parts = geographicArea.split("|");
                    const regionName = parts[0] || "";
                    const regionalUnitName = parts[1] || "";
                    const municipalityName = parts[2] || "";

                    console.log(
                      `[ProjectFormulations] Processing geographic area:`,
                      {
                        region: regionName,
                        regionalUnit: regionalUnitName,
                        municipality: municipalityName,
                      },
                    );

                    // Create project_index entry
                    const { data: insertedEntry, error: insertError } =
                      await supabase
                        .from("project_index")
                        .insert({
                          project_id: project.id,
                          monada_id: monadaId,
                          event_types_id: eventTypeId,
                          expenditure_type_id: expenditureTypeId,
                        })
                        .select("id")
                        .single();

                    if (insertError) {
                      console.error(
                        `[ProjectFormulations] Error inserting project_index:`,
                        insertError,
                      );
                    } else {
                      console.log(
                        `[ProjectFormulations] Created project_index entry ID: ${insertedEntry.id}`,
                      );

                      // Create geographic relationships if we have geographic data
                      if (regionName || regionalUnitName || municipalityName) {
                        const regionObject = {
                          perifereia: regionName,
                          perifereiaki_enotita: regionalUnitName,
                          onoma_neou_ota: municipalityName,
                        };

                        // Helper function to insert geographic relationships
                        const insertGeographicRelationships = async (
                          projectIndexId: number,
                          region: any,
                        ) => {
                          const relationships = [];

                          if (region.perifereia) {
                            relationships.push(
                              supabase.from("project_index_regions").insert({
                                project_index_id: projectIndexId,
                                region_code: region.perifereia,
                              }),
                            );
                          }

                          if (region.perifereiaki_enotita) {
                            relationships.push(
                              supabase.from("project_index_units").insert({
                                project_index_id: projectIndexId,
                                unit_code: region.perifereiaki_enotita,
                              }),
                            );
                          }

                          if (region.onoma_neou_ota) {
                            relationships.push(
                              supabase.from("project_index_munis").insert({
                                project_index_id: projectIndexId,
                                muni_code: region.onoma_neou_ota,
                              }),
                            );
                          }

                          if (relationships.length > 0) {
                            await Promise.all(relationships);
                            console.log(
                              `[ProjectFormulations] Created ${relationships.length} geographic relationships for project_index ${projectIndexId}`,
                            );
                          }
                        };

                        await insertGeographicRelationships(
                          insertedEntry.id,
                          regionObject,
                        );
                      }
                    }
                  }
                } else {
                  console.log(
                    `[ProjectFormulations] Skipping entry due to missing IDs:`,
                    {
                      expenditureTypeId,
                      eventTypeId,
                      monadaId,
                    },
                  );
                }
              }
            } catch (detailError) {
              console.error(
                `[ProjectFormulations] Error processing location detail:`,
                detailError,
              );
            }
          }

          console.log(
            `[ProjectFormulations] Completed processing all location details`,
          );
        }

        res.json({
          message: "Formulations and budget versions updated successfully",
          formulations: insertedFormulations,
          count: insertedFormulations.length,
        });
      } else {
        console.log(
          `[ProjectFormulations] No formulations to insert for project ${project.mis}`,
        );
        res.json({
          message: "No formulations to update",
          formulations: [],
          count: 0,
        });
      }
    } catch (error) {
      console.error(
        `[ProjectFormulations] Error updating formulations:`,
        error,
      );
      res.status(500).json({
        message: "Failed to update project formulations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Comprehensive project update - handles all form data at once
router.put(
  "/:id/comprehensive",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId } = req.params;
      const formData = req.body;

      console.log(
        `[ComprehensiveUpdate] ========== STARTING UPDATE FOR PROJECT ID: ${projectId} ==========`,
      );
      console.log(
        `[ComprehensiveUpdate] Request body keys:`,
        Object.keys(formData),
      );
      console.log(
        `[ComprehensiveUpdate] Project details provided:`,
        !!formData.project_details,
      );
      console.log(
        `[ComprehensiveUpdate] Decisions provided:`,
        !!formData.decisions,
        formData.decisions?.length || 0,
      );
      console.log(
        `[ComprehensiveUpdate] Location details provided:`,
        !!formData.location_details,
        formData.location_details?.length || 0,
      );
      console.log(
        `[ComprehensiveUpdate] Formulation details provided:`,
        !!formData.formulation_details,
        formData.formulation_details?.length || 0,
      );

      // DEBUG: Log location_details content
      if (formData.location_details) {
        console.log(
          `[ComprehensiveUpdate] DEBUG: location_details content:`,
          JSON.stringify(formData.location_details, null, 2),
        );
        formData.location_details.forEach((detail: any, index: number) => {
          console.log(`[ComprehensiveUpdate] Location ${index + 1}:`, {
            implementing_agency: detail.implementing_agency,
            event_type: detail.event_type,
            expenditure_types: detail.expenditure_types,
            geographic_areas: detail.geographic_areas,
          });
        });
      } else {
        console.log(
          `[ComprehensiveUpdate] DEBUG: NO location_details received in request`,
        );
      }

      if (!req.user) {
        console.log(
          `[ComprehensiveUpdate] Authentication failed - no user session`,
        );
        return res.status(401).json({ message: "Authentication required" });
      }

      // First get the project to get the project_id
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id, mis")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          `[ComprehensiveUpdate] Project not found for ID: ${projectId}`,
          projectError,
        );
        return res.status(404).json({ message: "Project not found" });
      }

      console.log(
        `[ComprehensiveUpdate] Processing update for project ID: ${project.id}`,
      );

      // Update project details if provided
      if (formData.project_details) {
        const projectUpdate = {
          mis: formData.project_details.mis
            ? parseInt(formData.project_details.mis)
            : project.mis,
          project_title: formData.project_details.project_title || null,
          event_description:
            formData.project_details.project_description ||
            formData.project_details.summary_description ||
            null,
          status: formData.project_details.project_status || "Ενεργό",
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("Projects")
          .update(projectUpdate)
          .eq("id", project.id);

        if (updateError) {
          console.error(
            `[ComprehensiveUpdate] Error updating project:`,
            updateError,
          );
          return res
            .status(500)
            .json({ message: "Failed to update project details" });
        }
        console.log(`[ComprehensiveUpdate] Updated project details`);
      }

      // Update project decisions if provided
      if (formData.decisions && Array.isArray(formData.decisions)) {
        await supabase
          .from("project_decisions")
          .delete()
          .eq("project_id", project.id);

        const decisionsToInsert = formData.decisions.map(
          (decision: any, index: number) => ({
            project_id: project.id,
            decision_sequence: index + 1,
            decision_type: decision.decision_type || "Έγκριση",
            protocol_number: decision.protocol_number || null,
            fek: decision.fek || null,
            ada: decision.ada || null,
            implementing_agency: decision.implementing_agency || [],
            decision_budget:
              parseFloat(
                String(decision.decision_budget || 0).replace(/[^\d.,]/g, "."),
              ) || 0,
            expenses_covered:
              parseFloat(
                String(decision.expenses_covered || 0).replace(/[^\d.,]/g, "."),
              ) || 0,
            expenditure_type: decision.expenditure_type || [],
            decision_date: new Date().toISOString().split("T")[0],
            included:
              decision.included !== undefined ? decision.included : true,
            is_active: true,
            comments: decision.comments || null,
            created_by: req.user!.id,
            updated_by: req.user!.id,
          }),
        );

        if (decisionsToInsert.length > 0) {
          const { error: decisionsError } = await supabase
            .from("project_decisions")
            .insert(decisionsToInsert);

          if (decisionsError) {
            console.error(
              `[ComprehensiveUpdate] Error inserting decisions:`,
              decisionsError,
            );
            return res
              .status(500)
              .json({ message: "Failed to update decisions" });
          }
          console.log(
            `[ComprehensiveUpdate] Updated ${decisionsToInsert.length} decisions`,
          );
        }
      }

      // Update formulations if provided
      if (
        formData.formulation_details &&
        Array.isArray(formData.formulation_details)
      ) {
        await supabase
          .from("project_formulations")
          .delete()
          .eq("project_id", project.id);

        const { data: existingDecisions } = await supabase
          .from("project_decisions")
          .select("id")
          .eq("project_id", project.id)
          .order("decision_sequence");

        const formulationsToInsert = formData.formulation_details.map(
          (formulation: any, index: number) => ({
            project_id: project.id,
            formulation_sequence: index + 1,
            sa_type: formulation.sa || "ΝΑ853",
            enumeration_code: formulation.enumeration_code || null,
            protocol_number: formulation.protocol_number || null,
            ada: formulation.ada || null,
            decision_year: formulation.decision_year
              ? parseInt(formulation.decision_year)
              : null,
            project_budget:
              parseFloat(
                String(formulation.project_budget || 0).replace(
                  /[^\d.,]/g,
                  ".",
                ),
              ) || 0,
            total_public_expense:
              parseFloat(
                String(formulation.total_public_expense || 0).replace(
                  /[^\d.,]/g,
                  ".",
                ),
              ) || 0,
            eligible_public_expense:
              parseFloat(
                String(formulation.eligible_public_expense || 0).replace(
                  /[^\d.,]/g,
                  ".",
                ),
              ) || 0,
            epa_version: formulation.epa_version || null,
            decision_status: formulation.decision_status || "Ενεργή",
            change_type: formulation.change_type || "Έγκριση",
            connected_decision_ids: Array.isArray(
              formulation.connected_decisions,
            )
              ? formulation.connected_decisions
                  .map((index: number) =>
                    existingDecisions && index < existingDecisions.length
                      ? existingDecisions[index]?.id
                      : null,
                  )
                  .filter((id: number | null) => id !== null)
              : [],
            comments: formulation.comments || null,
            is_active: true,
            created_by: req.user?.id || null,
            updated_by: req.user?.id || null,
          }),
        );

        if (formulationsToInsert.length > 0) {
          const { error: formulationsError } = await supabase
            .from("project_formulations")
            .insert(formulationsToInsert);

          if (formulationsError) {
            console.error(
              `[ComprehensiveUpdate] Error inserting formulations:`,
              formulationsError,
            );
            return res
              .status(500)
              .json({ message: "Failed to update formulations" });
          }
          console.log(
            `[ComprehensiveUpdate] Updated ${formulationsToInsert.length} formulations`,
          );
        }
      }

      // NEW: Process location_details with geographic areas
      // Uses UPSERT pattern to avoid FK constraint violations from generated_documents
      if (
        formData.location_details &&
        Array.isArray(formData.location_details)
      ) {
        console.log(
          `[ComprehensiveUpdate] Processing ${formData.location_details.length} location details`,
        );

        // Get reference data and existing project_index entries in parallel
        const [eventTypesRes, expenditureTypesRes, monadaRes, existingIndexRes] =
          await Promise.all([
            supabase.from("event_types").select("*"),
            supabase.from("expenditure_types").select("*"),
            supabase.from("Monada").select("*"),
            supabase.from("project_index").select("id, monada_id, event_types_id, expenditure_type_id").eq("project_id", project.id),
          ]);

        const eventTypes = eventTypesRes.data || [];
        const expenditureTypes = expenditureTypesRes.data || [];
        const monadaData = monadaRes.data || [];
        const existingIndexEntries = existingIndexRes.data || [];

        // Build a map of existing project_index entries for quick lookup
        const existingIndexMap = new Map<string, number>();
        for (const entry of existingIndexEntries) {
          const key = `${entry.monada_id}-${entry.event_types_id}-${entry.expenditure_type_id}`;
          existingIndexMap.set(key, entry.id);
        }
        console.log(`[ComprehensiveUpdate] Found ${existingIndexEntries.length} existing project_index entries`);

        // Delete ONLY geographic relationships (not project_index rows to preserve FK references)
        const existingIndexIds = existingIndexEntries.map(e => e.id);
        if (existingIndexIds.length > 0) {
          console.log(`[ComprehensiveUpdate] Deleting geographic relationships for ${existingIndexIds.length} project_index entries`);
          
          const [regionsDelRes, unitsDelRes, munisDelRes] = await Promise.all([
            supabase.from("project_index_regions").delete().in("project_index_id", existingIndexIds),
            supabase.from("project_index_units").delete().in("project_index_id", existingIndexIds),
            supabase.from("project_index_munis").delete().in("project_index_id", existingIndexIds),
          ]);
          
          console.log(`[ComprehensiveUpdate] Deleted geographic relationships: regions=${!regionsDelRes.error}, units=${!unitsDelRes.error}, munis=${!munisDelRes.error}`);
        }

        // STEP 1: Group location_details by unique key (monada_id, event_types_id, expenditure_type_id)
        // and collect ALL geographic areas for each unique combination
        const groupedLines = new Map<string, { 
          monadaId: number, 
          eventTypeId: number, 
          expenditureTypeId: number, 
          regions: any[] 
        }>();

        for (const locationDetail of formData.location_details) {
          try {
            // Find event type ID
            let eventTypeId = null;
            if (locationDetail.event_type) {
              const eventType = eventTypes.find(
                (et) => et.name === locationDetail.event_type,
              );
              eventTypeId = eventType?.id || null;
            }

            // Find implementing agency ID
            let monadaId = null;
            if (locationDetail.implementing_agency) {
              const monada = monadaData.find((m) => {
                const unitName =
                  typeof m.unit_name === "object" && m.unit_name.name
                    ? m.unit_name.name
                    : m.unit_name;
                return (
                  unitName === locationDetail.implementing_agency ||
                  m.unit === locationDetail.implementing_agency
                );
              });
              monadaId = monada?.id || null;
            }

            if (!monadaId || !eventTypeId) {
              console.warn(`[ComprehensiveUpdate] Skipping location - missing monadaId (${monadaId}) or eventTypeId (${eventTypeId})`);
              continue;
            }

            // Process each expenditure type
            const expenditureTypesToProcess = locationDetail.expenditure_types || [];
            if (expenditureTypesToProcess.length === 0) {
              expenditureTypesToProcess.push("ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ");
            }

            for (const expType of expenditureTypesToProcess) {
              const expenditureType = expenditureTypes.find(
                (et) => et.expenditure_types === expType,
              );
              const expenditureTypeId = expenditureType?.id || null;

              if (!expenditureTypeId) {
                console.warn(`[ComprehensiveUpdate] Could not find expenditure type ID for: ${expType}`);
                continue;
              }

              // Create unique key for this combination
              const key = `${monadaId}-${eventTypeId}-${expenditureTypeId}`;

              if (!groupedLines.has(key)) {
                groupedLines.set(key, {
                  monadaId,
                  eventTypeId,
                  expenditureTypeId,
                  regions: [],
                });
              }

              // Add ALL geographic areas from this location to the group
              const geographicAreas = locationDetail.geographic_areas || [];
              for (const geographicArea of geographicAreas) {
                const parts = geographicArea.split("|");
                const regionObj = {
                  perifereia: parts[0] || null,
                  perifereiaki_enotita: parts[1] || null,
                  dimos: parts[2] || null,
                };
                groupedLines.get(key)!.regions.push(regionObj);
              }
            }
          } catch (locationError) {
            console.error(`[ComprehensiveUpdate] Error processing location detail:`, locationError);
          }
        }

        console.log(`[ComprehensiveUpdate] Grouped into ${groupedLines.size} unique index entries`);

        // STEP 2: For each unique combination, get existing or create new project_index entry
        // and insert ALL geographic relationships
        for (const [key, group] of Array.from(groupedLines.entries())) {
          try {
            let projectIndexId: number;

            // Check if entry already exists
            if (existingIndexMap.has(key)) {
              projectIndexId = existingIndexMap.get(key)!;
              console.log(`[ComprehensiveUpdate] Reusing existing project_index entry for key ${key}, ID: ${projectIndexId}`);
            } else {
              // Create new entry
              const indexEntry = {
                project_id: project.id,
                monada_id: group.monadaId,
                event_types_id: group.eventTypeId,
                expenditure_type_id: group.expenditureTypeId,
              };

              console.log(`[ComprehensiveUpdate] Creating new project_index entry for key ${key}:`, indexEntry);

              const result = await supabase
                .from("project_index")
                .insert(indexEntry)
                .select("id")
                .single();

              if (result.error) {
                console.error(`[ComprehensiveUpdate] Error inserting project_index entry:`, result.error);
                continue;
              }

              projectIndexId = result.data?.id;
              if (!projectIndexId) {
                console.error(`[ComprehensiveUpdate] No ID returned for project_index entry`);
                continue;
              }
              
              console.log(`[ComprehensiveUpdate] Created new project_index entry, ID: ${projectIndexId}`);
            }

            // Insert ALL geographic relationships for this group
            console.log(`[ComprehensiveUpdate] Inserting ${group.regions.length} geographic relationships for project_index ID: ${projectIndexId}`);
            for (const region of group.regions) {
              await insertGeographicRelationships(projectIndexId, region);
            }

            console.log(`[ComprehensiveUpdate] Completed inserting geographic relationships for key ${key}`);
          } catch (lineError) {
            console.error(`[ComprehensiveUpdate] Error processing grouped line ${key}:`, lineError);
          }
        }

        console.log(
          `[ComprehensiveUpdate] Completed processing location details`,
        );
      }

      res.json({
        message: "Project updated successfully",
        project_id: project.id,
        sections_updated: {
          project_details: !!formData.project_details,
          decisions: !!(formData.decisions && formData.decisions.length > 0),
          formulations: !!(
            formData.formulation_details &&
            formData.formulation_details.length > 0
          ),
        },
      });
    } catch (error) {
      console.error(`[ComprehensiveUpdate] Error updating project:`, error);
      res.status(500).json({
        message: "Failed to update project",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ================================================================
// PROJECT BUDGET VERSIONS ENDPOINTS
// ================================================================

// Get budget versions for a project
router.get("/:id/budget-versions", authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { formulation_id } = req.query;
    const projectIdNumber = parseInt(projectId);
    console.log(
      `[ProjectBudgetVersions] Fetching budget versions for project ID: ${projectId}${formulation_id ? `, formulation: ${formulation_id}` : ""}`,
    );

    const project = await requireProjectAccess(req, res, projectIdNumber);
    if (!project) {
      return;
    }

    // Get budget versions using storage method
    const budgetVersions = await storage.getBudgetVersionsByProject(
      project.id,
      formulation_id ? parseInt(formulation_id as string) : undefined,
    );

    console.log(
      `[ProjectBudgetVersions] Found ${budgetVersions.length} budget versions for project ${project.id}`,
    );
    res.json(budgetVersions);
  } catch (error) {
    console.error(
      "[ProjectBudgetVersions] Error in budget versions endpoint:",
      error,
    );
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create budget version for a project
router.post(
  "/:id/budget-versions",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId } = req.params;
      const budgetVersionData = req.body;
      const projectIdNumber = parseInt(projectId);
      console.log(
        `[ProjectBudgetVersions] Creating budget version for project ID: ${projectId}`,
        budgetVersionData,
      );

      const project = await requireProjectAccess(req, res, projectIdNumber);
      if (!project) {
        return;
      }

      // Prepare budget version data
      const newBudgetVersion = {
        project_id: project.id,
        formulation_id: budgetVersionData.formulation_id || null,
        budget_type: budgetVersionData.budget_type,
        version_number: budgetVersionData.version_number || "1.0",
        boundary_budget: budgetVersionData.boundary_budget || null, // For PDE
        epa_version: budgetVersionData.epa_version || null, // For EPA
        protocol_number: budgetVersionData.protocol_number || null,
        ada: budgetVersionData.ada || null,
        decision_date: budgetVersionData.decision_date || null,
        action_type: budgetVersionData.action_type || "Έγκριση",
        comments: budgetVersionData.comments || null,
        created_by: req.user!.id,
      };

      // Create budget version using storage method
      const createdVersion =
        await storage.createBudgetVersion(newBudgetVersion);

      console.log(
        "[ProjectBudgetVersions] Budget version created successfully:",
        createdVersion.id,
      );
      res.status(201).json(createdVersion);
    } catch (error) {
      console.error(
        "[ProjectBudgetVersions] Error creating budget version:",
        error,
      );
      res.status(500).json({
        message: "Failed to create budget version",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Update budget version
router.patch(
  "/:id/budget-versions/:versionId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, versionId } = req.params;
      const updateData = req.body;
      console.log(
        `[ProjectBudgetVersions] Updating budget version ${versionId} for project ID: ${projectId}`,
        updateData,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the budget version exists and belongs to the project
      const existingVersion = await storage.getBudgetVersionById(
        parseInt(versionId),
      );
      if (!existingVersion) {
        return res.status(404).json({ message: "Budget version not found" });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (
        projectError ||
        !project ||
        existingVersion.project_id !== project.id
      ) {
        return res
          .status(404)
          .json({ message: "Project or budget version not found" });
      }

      // Prepare update data
      const versionUpdateData = {
        ...updateData,
        updated_by: req.user.id,
      };

      // Update budget version using storage method
      const updatedVersion = await storage.updateBudgetVersion(
        parseInt(versionId),
        versionUpdateData,
      );

      console.log(
        "[ProjectBudgetVersions] Budget version updated successfully:",
        updatedVersion.id,
      );
      res.json(updatedVersion);
    } catch (error) {
      console.error(
        "[ProjectBudgetVersions] Error updating budget version:",
        error,
      );
      res.status(500).json({
        message: "Failed to update budget version",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Delete budget version
router.delete(
  "/:id/budget-versions/:versionId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, versionId } = req.params;
      console.log(
        `[ProjectBudgetVersions] Deleting budget version ${versionId} for project ID: ${projectId}`,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the budget version exists and belongs to the project
      const existingVersion = await storage.getBudgetVersionById(
        parseInt(versionId),
      );
      if (!existingVersion) {
        return res.status(404).json({ message: "Budget version not found" });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (
        projectError ||
        !project ||
        existingVersion.project_id !== project.id
      ) {
        return res
          .status(404)
          .json({ message: "Project or budget version not found" });
      }

      // Delete budget version using storage method
      await storage.deleteBudgetVersion(parseInt(versionId));

      console.log(
        "[ProjectBudgetVersions] Budget version deleted successfully:",
        versionId,
      );
      res.json({ message: "Budget version deleted successfully" });
    } catch (error) {
      console.error(
        "[ProjectBudgetVersions] Error deleting budget version:",
        error,
      );
      res.status(500).json({
        message: "Failed to delete budget version",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ================================================================
// EPA FINANCIALS ENDPOINTS
// ================================================================

// Get EPA financials for a budget version
router.get(
  "/:id/budget-versions/:versionId/epa-financials",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, versionId } = req.params;
      console.log(
        `[EPAFinancials] Fetching EPA financials for project ID: ${projectId}, version: ${versionId}`,
      );

      // Verify the budget version exists and belongs to the project
      const existingVersion = await storage.getBudgetVersionById(
        parseInt(versionId),
      );
      if (!existingVersion) {
        return res.status(404).json({ message: "Budget version not found" });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (
        projectError ||
        !project ||
        existingVersion.project_id !== project.id
      ) {
        return res
          .status(404)
          .json({ message: "Project or budget version not found" });
      }

      // Get EPA financials using storage method
      const epaFinancials = await storage.getEPAFinancials(parseInt(versionId));

      console.log(
        `[EPAFinancials] Found ${epaFinancials.length} EPA financial records for version ${versionId}`,
      );
      res.json(epaFinancials);
    } catch (error) {
      console.error("[EPAFinancials] Error in EPA financials endpoint:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Create EPA financial record
router.post(
  "/:id/budget-versions/:versionId/epa-financials",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, versionId } = req.params;
      const financialData = req.body;
      console.log(
        `[EPAFinancials] Creating EPA financial for project ID: ${projectId}, version: ${versionId}`,
        financialData,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the budget version exists and belongs to the project
      const existingVersion = await storage.getBudgetVersionById(
        parseInt(versionId),
      );
      if (!existingVersion) {
        return res.status(404).json({ message: "Budget version not found" });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (
        projectError ||
        !project ||
        existingVersion.project_id !== project.id
      ) {
        return res
          .status(404)
          .json({ message: "Project or budget version not found" });
      }

      // Verify this is an EPA budget version
      if (existingVersion.budget_type !== "ΕΠΑ") {
        return res.status(400).json({
          message: "Financial records can only be added to EPA budget versions",
        });
      }

      // Prepare EPA financial data
      const newFinancial = {
        epa_version_id: parseInt(versionId),
        year: financialData.year,
        total_public_expense: financialData.total_public_expense || "0",
        eligible_public_expense: financialData.eligible_public_expense || "0",
      };

      // Create EPA financial using storage method
      const createdFinancial = await storage.createEPAFinancials(newFinancial);

      console.log(
        "[EPAFinancials] EPA financial created successfully:",
        createdFinancial.id,
      );
      res.status(201).json(createdFinancial);
    } catch (error) {
      console.error("[EPAFinancials] Error creating EPA financial:", error);
      res.status(500).json({
        message: "Failed to create EPA financial record",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Update EPA financial record
router.patch(
  "/:id/budget-versions/:versionId/epa-financials/:financialId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, versionId, financialId } = req.params;
      const updateData = req.body;
      console.log(
        `[EPAFinancials] Updating EPA financial ${financialId} for project ID: ${projectId}, version: ${versionId}`,
        updateData,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the budget version exists and belongs to the project
      const existingVersion = await storage.getBudgetVersionById(
        parseInt(versionId),
      );
      if (!existingVersion) {
        return res.status(404).json({ message: "Budget version not found" });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (
        projectError ||
        !project ||
        existingVersion.project_id !== project.id
      ) {
        return res
          .status(404)
          .json({ message: "Project or budget version not found" });
      }

      // Update EPA financial using storage method
      const updatedFinancial = await storage.updateEPAFinancials(
        parseInt(financialId),
        updateData,
      );

      console.log(
        "[EPAFinancials] EPA financial updated successfully:",
        updatedFinancial.id,
      );
      res.json(updatedFinancial);
    } catch (error) {
      console.error("[EPAFinancials] Error updating EPA financial:", error);
      res.status(500).json({
        message: "Failed to update EPA financial record",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Delete EPA financial record
router.delete(
  "/:id/budget-versions/:versionId/epa-financials/:financialId",
  authenticateSession,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, versionId, financialId } = req.params;
      console.log(
        `[EPAFinancials] Deleting EPA financial ${financialId} for project ID: ${projectId}, version: ${versionId}`,
      );

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the budget version exists and belongs to the project
      const existingVersion = await storage.getBudgetVersionById(
        parseInt(versionId),
      );
      if (!existingVersion) {
        return res.status(404).json({ message: "Budget version not found" });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("Projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (
        projectError ||
        !project ||
        existingVersion.project_id !== project.id
      ) {
        return res
          .status(404)
          .json({ message: "Project or budget version not found" });
      }

      // Delete EPA financial using storage method
      await storage.deleteEPAFinancials(parseInt(financialId));

      console.log(
        "[EPAFinancials] EPA financial deleted successfully:",
        financialId,
      );
      res.json({ message: "EPA financial record deleted successfully" });
    } catch (error) {
      console.error("[EPAFinancials] Error deleting EPA financial:", error);
      res.status(500).json({
        message: "Failed to delete EPA financial record",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export { router as projectsRouter };
