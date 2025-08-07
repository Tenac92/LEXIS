import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Save,
  X,
  FileText,
  Calendar,
  CheckCircle,
  Building2,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  formatEuropeanCurrency,
  parseEuropeanNumber,
  formatNumberWhileTyping,
  formatEuropeanNumber,
} from "@/lib/number-format";
import {
  getGeographicInfo,
  formatGeographicDisplay,
  getGeographicCodeForSave,
} from "@shared/utils/geographic-utils";

// Helper function to safely convert array or object fields to text
function safeText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "Δεν υπάρχει";
    if (value.length === 1) return String(value[0]);
    return value.join(", ");
  }
  return "";
}

// Helper function to generate enumeration code based on ΣΑ type
function generateEnumerationCode(saType: string, currentCode?: string, existingCodes?: Record<string, string>): string {
  // If we have an existing enumeration code for this ΣΑ type, use it
  if (existingCodes && existingCodes[saType]) {
    return existingCodes[saType];
  }

  // If there's already a code and it matches the pattern for the selected ΣΑ, keep it
  if (currentCode) {
    const patterns = {
      ΝΑ853: /^\d{4}ΝΑ853\d{8}$/,
      ΝΑ271: /^\d{4}ΝΑ271\d{8}$/,
      E069: /^\d{4}E069\d{8}$/,
    };

    if (patterns[saType as keyof typeof patterns]?.test(currentCode)) {
      return currentCode;
    }
  }

  // Only generate new code if no existing data found (this should be rare in edit mode)
  const currentYear = new Date().getFullYear();
  const sequentialNumber = Math.floor(Math.random() * 99999999)
    .toString()
    .padStart(8, "0");

  return `${currentYear}${saType}${sequentialNumber}`;
}

// Helper function to convert FEK data from old string format to new object format
function normalizeFekData(fekValue: any): {
  year: string;
  issue: string;
  number: string;
} {
  if (!fekValue) return { year: "", issue: "", number: "" };

  // If it's already an object with the new format
  if (typeof fekValue === "object" && fekValue.year !== undefined) {
    return {
      year: String(fekValue.year || ""),
      issue: String(fekValue.issue || ""),
      number: String(fekValue.number || ""),
    };
  }

  // If it's a string (old format), return empty object for now
  // In the future, we could try to parse the string format if needed
  if (typeof fekValue === "string") {
    return { year: "", issue: "", number: "" };
  }

  // If it's an array (from JSONB), take the first element if it's an object
  if (
    Array.isArray(fekValue) &&
    fekValue.length > 0 &&
    typeof fekValue[0] === "object"
  ) {
    const obj = fekValue[0];
    return {
      year: String(obj.year || ""),
      issue: String(obj.issue || ""),
      number: String(obj.number || ""),
    };
  }

  return { year: "", issue: "", number: "" };
}

// Interface definitions
interface KallikratisEntry {
  id: number;
  kodikos_neou_ota: number;
  eidos_neou_ota: string;
  onoma_neou_ota: string;
  kodikos_perifereiakis_enotitas: number;
  perifereiaki_enotita: string;
  kodikos_perifereias: number;
  perifereia: string;
}

interface UnitData {
  id: number;
  name?: string;
  unit?: string;
  unit_name?: {
    name: string;
    prop: string;
  };
}

interface EventTypeData {
  id: number;
  name: string;
}

interface ExpenditureTypeData {
  id: number;
  expenditure_types?: string;
  expenditure_types_minor?: string;
  name?: string;
}

interface ProjectData {
  id: number;
  mis: string;
  project_title?: string;
  event_description?: string;
  event_year?: string | number;
  status?: string;
  na853?: string;
  na271?: string;
  e069?: string;
  budget_na853?: number;
  budget_na271?: number;
  budget_e069?: number;
  enhanced_unit?: {
    name: string;
  };
}

// Form schema
const comprehensiveProjectSchema = z.object({
  // Section 1: Decisions that document the project
  decisions: z
    .array(
      z.object({
        protocol_number: z.string().default(""),
        fek: z
          .object({
            year: z.string().default(""),
            issue: z.string().default(""),
            number: z.string().default(""),
          })
          .default({ year: "", issue: "", number: "" }),
        ada: z.string().default(""),
        implementing_agency: z.array(z.number()).default([]),
        decision_budget: z.string().default(""),
        expenses_covered: z.string().default(""),
        expenditure_type: z.array(z.number()).default([]),
        decision_type: z
          .enum(["Έγκριση", "Τροποποίηση", "Παράταση"])
          .default("Έγκριση"),
        included: z.boolean().default(true),
        comments: z.string().default(""),
      }),
    )
    .default([]),

  // Section 2: Event details
  event_details: z
    .object({
      event_name: z.string().default(""),
      event_year: z.string().default(""),
    })
    .default({ event_name: "", event_year: "" }),

  // Section 2 Location details with cascading dropdowns
  location_details: z
    .array(
      z.object({
        implementing_agency: z.string().default(""),
        event_type: z.string().default(""),
        expenditure_types: z.array(z.string()).default([]),
        regions: z
          .array(
            z.object({
              region: z.string().default(""),
              regional_unit: z.string().default(""),
              municipality: z.string().default(""),
            }),
          )
          .default([{ region: "", regional_unit: "", municipality: "" }]),
      }),
    )
    .default([]),

  // Section 3: Project details (enumeration_code removed - now only in formulation tab)
  project_details: z
    .object({
      mis: z.string().default(""),
      sa: z.string().default(""),
      inc_year: z.string().default(""), // Renamed from inclusion_year for consistency
      project_title: z.string().default(""),
      project_description: z.string().default(""),
      summary_description: z.string().default(""),
      expenses_executed: z.string().default(""),
      project_status: z.string().default("Ενεργό"),
    })
    .default({
      mis: "",
      sa: "",
      inc_year: "",
      project_title: "",
      project_description: "",
      summary_description: "",
      expenses_executed: "",
      project_status: "Ενεργό",
    }),

  // Previous entries for section 3 (enumeration_code removed)
  previous_entries: z
    .array(
      z.object({
        mis: z.string().default(""),
        sa: z.string().default(""),
        inc_year: z.string().default(""),
        project_title: z.string().default(""),
        project_description: z.string().default(""),
        summary_description: z.string().default(""),
        expenses_executed: z.string().default(""),
        project_status: z.string().default("Ενεργό"),
      }),
    )
    .default([]),

  // Section 4: Project formulation details
  formulation_details: z
    .array(
      z.object({
        sa: z.enum(["ΝΑ853", "ΝΑ271", "E069"]).default("ΝΑ853"),
        enumeration_code: z.string().default(""),
        protocol_number: z.string().default(""),
        ada: z.string().default(""),
        decision_year: z.string().default(""),
        project_budget: z.string().default(""),
        epa_version: z.string().default(""),
        total_public_expense: z.string().default(""),
        eligible_public_expense: z.string().default(""),
        decision_status: z
          .enum(["Ενεργή", "Ανενεργή", "Αναστολή"])
          .default("Ενεργή"),
        change_type: z
          .enum(["Τροποποίηση", "Παράταση", "Έγκριση"])
          .default("Έγκριση"),
        connected_decisions: z.array(z.number()).default([]),
        comments: z.string().default(""),
      }),
    )
    .default([]),

  // Section 5: Changes performed (enhanced with tracking fields)
  changes: z
    .array(
      z.object({
        timestamp: z.string().default(""),
        user_id: z.number().optional(),
        user_name: z.string().default(""),
        change_type: z.enum(["Initial Creation", "Budget Update", "Status Change", "Document Update", "Other"]).default("Other"),
        description: z.string().default(""),
        notes: z.string().default(""),
      }),
    )
    .default([{ 
      timestamp: new Date().toISOString(),
      user_name: "",
      change_type: "Other",
      description: "",
      notes: ""
    }]),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

export default function ComprehensiveEditFixed() {
  const { mis } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasPreviousEntries, setHasPreviousEntries] = useState(false);
  const [userInteractedFields, setUserInteractedFields] = useState<Set<string>>(
    new Set(),
  );
  const hasInitialized = useRef(false);
  const [initializationTime, setInitializationTime] = useState<number>(0);
  const [formKey, setFormKey] = useState<number>(0);
  const isInitializingRef = useRef(false);

  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    mode: "onChange",
    defaultValues: {
      decisions: [
        {
          protocol_number: "",
          fek: { year: "", issue: "", number: "" },
          ada: "",
          implementing_agency: [],
          decision_budget: "",
          expenses_covered: "",
          expenditure_type: [],
          decision_type: "Έγκριση",
          included: true,
          comments: "",
        },
      ],
      event_details: {
        event_name: "",
        event_year: "",
      },
      location_details: [
        {
          implementing_agency: "",
          event_type: "",
          expenditure_types: [],
          regions: [
            {
              region: "",
              regional_unit: "",
              municipality: "",
            },
          ],
        },
      ],
      project_details: {
        mis: "",
        sa: "ΝΑ853",
        inc_year: "",
        project_title: "",
        project_description: "",
        summary_description: "",
        expenses_executed: "",
        project_status: "Συμπληρωμένο",
      },
      previous_entries: [],
      formulation_details: [
        {
          sa: "ΝΑ853",
          enumeration_code: "",
          protocol_number: "",
          ada: "",
          decision_year: "",
          project_budget: "",
          epa_version: "",
          total_public_expense: "",
          eligible_public_expense: "",
          decision_status: "Ενεργή",
          change_type: "Έγκριση",
          connected_decisions: [],
          comments: "",
        },
      ],
      changes: [{ 
        timestamp: new Date().toISOString(),
        user_name: "",
        change_type: "Other",
        description: "",
        notes: ""
      }],
    },
  });

  // PERFORMANCE OPTIMIZATION: Split into project data and reference data queries
  const {
    data: completeProjectData,
    isLoading: isCompleteDataLoading,
    error: completeDataError,
  } = useQuery({
    queryKey: [`/api/projects/${mis}/complete`],
    enabled: !!mis,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for project-specific data
    gcTime: 15 * 60 * 1000, // 15 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // PERFORMANCE OPTIMIZATION: Separate query for reference data with aggressive caching
  const {
    data: referenceData,
    isLoading: isReferenceDataLoading,
    error: referenceDataError,
  } = useQuery({
    queryKey: ['/api/projects/reference-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache for reference data
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Extract data from optimized API responses with proper typing
  const projectData = completeProjectData?.project;
  const projectIndexData = completeProjectData?.index;
  const decisionsData = completeProjectData?.decisions;
  const formulationsData = completeProjectData?.formulations;
  
  // Extract reference data from separate endpoint (with fallback to old structure for compatibility)
  const eventTypesData = referenceData?.eventTypes || completeProjectData?.eventTypes;
  const unitsData = referenceData?.units || completeProjectData?.units;
  const kallikratisData = referenceData?.kallikratis || completeProjectData?.kallikratis;
  const expenditureTypesData = referenceData?.expenditureTypes || completeProjectData?.expenditureTypes;

  // Extract existing ΣΑ types and enumeration codes from formulations data
  const existingSATypes = [...new Set(formulationsData?.map(f => f.sa).filter(Boolean))] || [];
  const existingEnumerationCodes = formulationsData?.reduce((acc, f) => {
    if (f.sa && f.enumeration_code) {
      acc[f.sa] = f.enumeration_code;
    }
    return acc;
  }, {} as Record<string, string>) || {};

  // Check if all essential data is loading
  const isEssentialDataLoading = isCompleteDataLoading;
  const isAllDataLoading = isCompleteDataLoading || isReferenceDataLoading;
  
  // Debug logging for optimized data fetch
  console.log("DEBUG - Project Data:", {
    hasProjectData: !!completeProjectData,
    hasReferenceData: !!referenceData,
    projectData: !!projectData,
    decisionsCount: decisionsData?.length || 0,
    formulationsCount: formulationsData?.length || 0,
    isProjectLoading: isCompleteDataLoading,
    isReferenceLoading: isReferenceDataLoading,
    projectError: completeDataError?.message || completeDataError,
    referenceError: referenceDataError?.message || referenceDataError,
  });

  // Debug logging for ΣΑ types and enumeration codes
  console.log("DEBUG - ΣΑ Data:", {
    existingSATypes,
    existingEnumerationCodes,
    formulationsDataSample: formulationsData?.slice(0, 2),
  });

  // Reset initialization state when component mounts
  useEffect(() => {
    hasInitialized.current = false;
  }, []);

  // Type-safe data casting
  const typedProjectData = projectData as ProjectData | undefined;
  const typedUnitsData = unitsData as UnitData[] | undefined;
  const typedKallikratisData = kallikratisData as
    | KallikratisEntry[]
    | undefined;
  const typedEventTypesData = eventTypesData as EventTypeData[] | undefined;
  const typedExpenditureTypesData = expenditureTypesData as
    | ExpenditureTypeData[]
    | undefined;

  // Helper functions for geographic data
  const getUniqueRegions = () => {
    return [
      ...new Set(typedKallikratisData?.map((k) => k.perifereia) || []),
    ].filter(Boolean);
  };

  const getRegionalUnitsForRegion = (region: string) => {
    if (!region) return [];
    return [
      ...new Set(
        typedKallikratisData
          ?.filter((k) => k.perifereia === region)
          .map((k) => k.perifereiaki_enotita) || [],
      ),
    ].filter(Boolean);
  };

  const getMunicipalitiesForRegionalUnit = (
    region: string,
    regionalUnit: string,
  ) => {
    if (!region || !regionalUnit) return [];
    return [
      ...new Set(
        typedKallikratisData
          ?.filter(
            (k) =>
              k.perifereia === region &&
              k.perifereiaki_enotita === regionalUnit,
          )
          .map((k) => k.onoma_neou_ota) || [],
      ),
    ].filter(Boolean);
  };

  // Number formatting helper functions
  const formatNumberWhileTyping = (value: string): string => {
    // Remove all non-numeric characters except comma and period
    let cleanValue = value.replace(/[^0-9,.]/g, "");

    // If empty, return empty
    if (!cleanValue) return "";

    // Handle European format (comma as decimal separator)
    if (cleanValue.includes(",")) {
      const parts = cleanValue.split(",");
      if (parts.length === 2) {
        // Clean integer part and add thousand separators
        const integerPart = parts[0].replace(/\./g, ""); // Remove existing dots first
        const formattedInteger = integerPart.replace(
          /\B(?=(\d{3})+(?!\d))/g,
          ".",
        );
        // Limit decimal part to 2 digits
        const decimalPart = parts[1].slice(0, 2);
        return `${formattedInteger},${decimalPart}`;
      } else if (parts.length > 2) {
        // If multiple commas, take only the first two parts
        const integerPart = parts[0].replace(/\./g, "");
        const formattedInteger = integerPart.replace(
          /\B(?=(\d{3})+(?!\d))/g,
          ".",
        );
        const decimalPart = parts[1].slice(0, 2);
        return `${formattedInteger},${decimalPart}`;
      }
    }

    // For integers only, remove existing dots and add proper thousand separators
    const integerValue = cleanValue.replace(/[,.]/g, "");
    return integerValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseEuropeanNumber = (value: string): number | null => {
    if (!value) return null;

    // Replace thousand separators (periods) and convert comma to period for decimal
    const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? null : parsed;
  };

  // Helper function to validate and limit numeric input to database constraints
  const validateAndLimitNumericInput = (
    value: string,
    fieldName: string,
  ): string => {
    const parsed = parseEuropeanNumber(value);
    if (parsed && parsed > 9999999999.99) {
      console.warn(
        `${fieldName} value ${parsed} exceeds database limit, limiting input`,
      );
      toast({
        title: "Προσοχή",
        description: `${fieldName}: Το ποσό περιορίστηκε στο μέγιστο επιτρεπτό όριο (9.999.999.999,99 €)`,
        variant: "destructive",
      });
      return formatEuropeanNumber(9999999999.99);
    }
    return value;
  };

  const mutation = useMutation({
    mutationFn: async (data: ComprehensiveFormData) => {
      console.log("=== COMPREHENSIVE FORM SUBMISSION ===");
      console.log("Form data:", data);

      // Track what operations have been completed for potential rollback
      const completedOperations = {
        projectUpdate: false,
        decisions: [],
        formulations: [],
        changes: false,
      };

      try {
        // 1. Update core project data
        const projectUpdateData = {
          project_title: data.project_details.project_title,
          event_description: data.project_details.project_description,
          // New fields: inc_year and updates (enumeration_code removed from project details)  
          inc_year: data.project_details.inc_year ? parseInt(data.project_details.inc_year) : null,
          updates: data.changes || [],
          na853: data.project_details.sa,
          // Convert event_name to event_type_id if needed
          event_type: (() => {
            if (!data.event_details.event_name) {
              console.log("No event name provided");
              return null;
            }

            if (typedEventTypesData) {
              const eventType = typedEventTypesData.find(
                (et) =>
                  et.name === data.event_details.event_name ||
                  et.id.toString() === data.event_details.event_name,
              );
              console.log("Event type conversion:", {
                input: data.event_details.event_name,
                found: eventType,
                result: eventType ? eventType.id : null,
              });
              return eventType ? eventType.id : null;
            }
            console.log("No event types data available for conversion");
            return null;
          })(),
          event_year: data.event_details.event_year,
          status: data.project_details.project_status,

          // Budget fields - parse European format to numbers
          budget_e069: (() => {
            const formEntry = data.formulation_details.find(
              (f) => f.sa === "E069",
            );
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(
                `Budget E069: "${formEntry.project_budget}" -> ${parsed}`,
              );
              return parsed;
            }
            return typedProjectData?.budget_e069 || null;
          })(),
          budget_na271: (() => {
            const formEntry = data.formulation_details.find(
              (f) => f.sa === "ΝΑ271",
            );
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(
                `Budget ΝΑ271: "${formEntry.project_budget}" -> ${parsed}`,
              );
              return parsed;
            }
            return typedProjectData?.budget_na271 || null;
          })(),
          budget_na853: (() => {
            const formEntry = data.formulation_details.find(
              (f) => f.sa === "ΝΑ853",
            );
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(
                `Budget ΝΑ853: "${formEntry.project_budget}" -> ${parsed}`,
              );
              return parsed;
            }
            return typedProjectData?.budget_na853 || null;
          })(),
        };

        console.log("1. Updating core project data:", projectUpdateData);
        console.log("🔍 Key fields being sent:", {
          inclusion_year: projectUpdateData.inclusion_year,
          na853: projectUpdateData.na853,
          enumeration_code: projectUpdateData.enumeration_code,
          project_title: projectUpdateData.project_title,
        });
        try {
          const projectResponse = await apiRequest(`/api/projects/${mis}`, {
            method: "PATCH",
            body: JSON.stringify(projectUpdateData),
          });
          completedOperations.projectUpdate = true;
          console.log("✓ Project update successful:", projectResponse);
        } catch (error) {
          console.error("✗ Project update failed:", error);
          throw new Error(
            `Failed to update project data: ${error.message || error}`,
          );
        }

        // 2. Handle project decisions using individual CRUD endpoints
        if (data.decisions && data.decisions.length > 0) {
          console.log("2. Processing project decisions:", data.decisions);

          // Get existing decisions to compare
          let existingDecisions: any[] = [];
          try {
            existingDecisions = (await apiRequest(
              `/api/projects/${mis}/decisions`,
            )) as any[];
          } catch (error) {
            console.warn("Could not fetch existing decisions:", error);
            existingDecisions = [];
          }

          // Process each decision
          for (let i = 0; i < data.decisions.length; i++) {
            const decision = data.decisions[i];
            const existingDecision = existingDecisions[i];

            // Use implementing_agency IDs directly (already converted in form)
            const implementing_agency_ids = Array.isArray(
              decision.implementing_agency,
            )
              ? decision.implementing_agency
              : [];

            // Use expenditure_type IDs directly (already converted in form)
            const expenditure_type_ids = Array.isArray(
              decision.expenditure_type,
            )
              ? decision.expenditure_type
              : [];

            const decisionData = {
              protocol_number: decision.protocol_number || "",
              fek: decision.fek || { year: "", issue: "", number: "" },
              ada: decision.ada || "",
              implementing_agency: implementing_agency_ids,
              decision_budget:
                parseEuropeanNumber(decision.decision_budget || "") || 0,
              expenses_covered:
                parseEuropeanNumber(decision.expenses_covered || "") || 0,
              expenditure_type: expenditure_type_ids,
              decision_type: decision.decision_type || "Έγκριση",
              included:
                decision.included !== undefined ? decision.included : true,
              comments: decision.comments || "",
            };

            try {
              if (existingDecision) {
                // Update existing decision
                console.log(
                  `Updating decision ${existingDecision.id}:`,
                  decisionData,
                );
                await apiRequest(
                  `/api/projects/${mis}/decisions/${existingDecision.id}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify(decisionData),
                  },
                );
              } else {
                // Create new decision
                console.log(`Creating new decision:`, decisionData);
                await apiRequest(`/api/projects/${mis}/decisions`, {
                  method: "POST",
                  body: JSON.stringify(decisionData),
                });
              }
            } catch (error) {
              console.error(`Error processing decision ${i}:`, error);
              throw error;
            }
          }

          // Delete any extra existing decisions
          if (existingDecisions.length > data.decisions.length) {
            for (
              let i = data.decisions.length;
              i < existingDecisions.length;
              i++
            ) {
              try {
                console.log(
                  `Deleting excess decision ${existingDecisions[i].id}`,
                );
                await apiRequest(
                  `/api/projects/${mis}/decisions/${existingDecisions[i].id}`,
                  {
                    method: "DELETE",
                  },
                );
              } catch (error) {
                console.error(
                  `Error deleting decision ${existingDecisions[i].id}:`,
                  error,
                );
              }
            }
          }

          console.log("✓ Decisions processing completed");
        }

        // 3. Handle project formulations using individual CRUD endpoints
        if (data.formulation_details && data.formulation_details.length > 0) {
          console.log(
            "3. Processing project formulations:",
            data.formulation_details,
          );

          // Get existing formulations to compare
          let existingFormulations = [];
          try {
            existingFormulations = await apiRequest(
              `/api/projects/${mis}/formulations`,
            );
          } catch (error) {
            console.warn("Could not fetch existing formulations:", error);
            existingFormulations = [];
          }

          // Process each formulation
          for (let i = 0; i < data.formulation_details.length; i++) {
            const formulation = data.formulation_details[i];
            const existingFormulation = existingFormulations[i];

            const formulationData = {
              sa: formulation.sa,
              enumeration_code: formulation.enumeration_code,
              protocol_number: formulation.protocol_number,
              ada: formulation.ada,
              decision_year: formulation.decision_year,
              project_budget: (() => {
                const parsed = parseEuropeanNumber(
                  formulation.project_budget || "",
                );
                // Database constraint: precision 12, scale 2 (max: 9,999,999,999.99)
                if (parsed && parsed > 9999999999.99) {
                  console.warn(
                    `Project budget ${parsed} exceeds database limit, capping at 9,999,999,999.99`,
                  );
                  return 9999999999.99;
                }
                return parsed || 0;
              })(),
              epa_version: formulation.epa_version,
              total_public_expense: (() => {
                const parsed = parseEuropeanNumber(
                  formulation.total_public_expense || "",
                );
                // Database constraint: precision 12, scale 2 (max: 9,999,999,999.99)
                if (parsed && parsed > 9999999999.99) {
                  console.warn(
                    `Total public expense ${parsed} exceeds database limit, capping at 9,999,999,999.99`,
                  );
                  return 9999999999.99;
                }
                return parsed || 0;
              })(),
              eligible_public_expense: (() => {
                const parsed = parseEuropeanNumber(
                  formulation.eligible_public_expense || "",
                );
                // Database constraint: precision 12, scale 2 (max: 9,999,999,999.99)
                if (parsed && parsed > 9999999999.99) {
                  console.warn(
                    `Eligible public expense ${parsed} exceeds database limit, capping at 9,999,999,999.99`,
                  );
                  return 9999999999.99;
                }
                return parsed || 0;
              })(),
              decision_status: formulation.decision_status,
              change_type: formulation.change_type,
              connected_decisions: (() => {
                // Convert indices back to decision IDs
                if (!formulation.connected_decisions || !Array.isArray(formulation.connected_decisions)) {
                  return [];
                }
                
                const decisionIds = formulation.connected_decisions
                  .map((index: number) => {
                    const decision = decisionsData?.[index];
                    return decision?.id;
                  })
                  .filter((id: any) => id !== undefined);
                
                console.log(
                  `[FormulationSave] Converting indices ${JSON.stringify(formulation.connected_decisions)} to IDs ${JSON.stringify(decisionIds)}`,
                );
                
                return decisionIds;
              })(),
              comments: formulation.comments,
            };

            try {
              if (existingFormulation) {
                // Update existing formulation
                console.log(
                  `Updating formulation ${existingFormulation.id}:`,
                  formulationData,
                );
                await apiRequest(
                  `/api/projects/${mis}/formulations/${existingFormulation.id}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify(formulationData),
                  },
                );
              } else {
                // Create new formulation
                console.log(`Creating new formulation:`, formulationData);
                await apiRequest(`/api/projects/${mis}/formulations`, {
                  method: "POST",
                  body: JSON.stringify(formulationData),
                });
              }
            } catch (error) {
              console.error(`Error processing formulation ${i}:`, error);

              // Provide more specific error information for database constraints
              let errorMessage = `Error processing formulation ${i}`;
              if (
                error.message &&
                error.message.includes("numeric field overflow")
              ) {
                errorMessage = `Formulation ${i}: Το ποσό υπερβαίνει το μέγιστο επιτρεπτό όριο (9.999.999.999,99 €)`;
              }

              throw new Error(errorMessage);
            }
          }

          // Delete any extra existing formulations
          if (existingFormulations.length > data.formulation_details.length) {
            for (
              let i = data.formulation_details.length;
              i < existingFormulations.length;
              i++
            ) {
              try {
                console.log(
                  `Deleting excess formulation ${existingFormulations[i].id}`,
                );
                await apiRequest(
                  `/api/projects/${mis}/formulations/${existingFormulations[i].id}`,
                  {
                    method: "DELETE",
                  },
                );
              } catch (error) {
                console.error(
                  `Error deleting formulation ${existingFormulations[i].id}:`,
                  error,
                );
              }
            }
          }

          console.log("✓ Formulations processing completed");
        }

        // 4. Record changes in project history if provided
        if (data.changes && data.changes.length > 0) {
          console.log("4. Recording project changes:", data.changes);

          for (const change of data.changes) {
            if (change.description && change.description.trim()) {
              try {
                console.log("Recording change:", change.description);
                await apiRequest(`/api/projects/${mis}/changes`, {
                  method: "POST",
                  body: JSON.stringify({
                    description: change.description,
                    change_type: "UPDATE",
                  }),
                });
              } catch (error) {
                console.error("Error recording change:", error);
                // Don't throw error here, changes recording is not critical
              }
            }
          }

          console.log("✓ Changes recording completed");
        }

        // 5. Process location details and include project_lines in the main update
        if (data.location_details && data.location_details.length > 0) {
          console.log("5. Processing location details:", data.location_details);
          console.log(
            "5a. Form location_details structure:",
            JSON.stringify(data.location_details, null, 2),
          );

          // Transform location details to project_index format
          const projectLines = [];

          for (const location of data.location_details) {
            // Skip empty locations
            if (
              !location.regions ||
              location.regions.length === 0 ||
              !location.implementing_agency
            ) {
              continue;
            }

            // Find implementing agency (monada_id)
            let monadaId = null;
            if (typedUnitsData && location.implementing_agency) {
              const unit = typedUnitsData.find(
                (u) =>
                  u.name === location.implementing_agency ||
                  u.unit_name?.name === location.implementing_agency ||
                  u.unit === location.implementing_agency,
              );
              if (unit) {
                monadaId = unit.id;
              }
            }

            // Find event type ID
            let eventTypeId = null;
            if (typedEventTypesData && location.event_type) {
              const eventType = typedEventTypesData.find(
                (et) => et.name === location.event_type,
              );
              if (eventType) {
                eventTypeId = eventType.id;
              }
            }

            // Create entries for each region
            for (const region of location.regions) {
              // Skip empty regions
              if (
                !region.region &&
                !region.regional_unit &&
                !region.municipality
              ) {
                continue;
              }

              // Find kallikratis_id and geographic_code
              let kallikratisId = null;
              let geographicCode = null;

              if (typedKallikratisData && region.region) {
                const kallikratis = typedKallikratisData.find(
                  (k) =>
                    k.perifereia === region.region &&
                    (!region.regional_unit ||
                      k.perifereiaki_enotita === region.regional_unit) &&
                    (!region.municipality ||
                      k.onoma_neou_ota === region.municipality),
                );

                if (kallikratis) {
                  kallikratisId = kallikratis.id;

                  // Determine the appropriate level based on what data is actually populated
                  // If municipality is empty/cleared, use regional unit level
                  // If municipality is populated, use municipality level
                  const forceLevel =
                    !region.municipality ||
                    region.municipality.trim() === "" ||
                    region.municipality === "__clear__"
                      ? "regional_unit"
                      : "municipality";

                  // Calculate geographic code based on what data is selected
                  geographicCode = getGeographicCodeForSave(
                    region,
                    kallikratis,
                    forceLevel,
                  );

                  // DEBUG: Log the geographic code calculation
                  console.log("Geographic Code Calculation:", {
                    region: region.region,
                    regional_unit: region.regional_unit,
                    municipality: region.municipality,
                    calculated_code: geographicCode,
                    forceLevel,
                    available_codes: {
                      municipality_code: kallikratis.kodikos_neou_ota,
                      regional_unit_code:
                        kallikratis.kodikos_perifereiakis_enotitas,
                      region_code: kallikratis.kodikos_perifereias,
                    },
                  });
                }
                console.log("Kallikratis lookup:", {
                  region,
                  found: kallikratis,
                  kallikratisId,
                  geographicCode,
                });
              }

              // Create project line for this region
              projectLines.push({
                implementing_agency: location.implementing_agency,
                implementing_agency_id: monadaId,
                event_type: location.event_type,
                event_type_id: eventTypeId,
                expenditure_types: location.expenditure_types || [],
                region: {
                  perifereia: region.region,
                  perifereiaki_enotita: region.regional_unit,
                  dimos: region.municipality,
                  kallikratis_id: kallikratisId,
                  geographic_code: geographicCode,
                },
              });
            }
          }

          if (projectLines.length > 0) {
            console.log(
              "Including project_lines in main project update:",
              projectLines,
            );
            // FIX: Include project_lines in the main project update to avoid duplicate calls
            projectUpdateData.project_lines = projectLines;
          }
        }

        // 6. Update the project with all data including project_lines in a single call
        console.log(
          "6. Final project update with all data:",
          projectUpdateData,
        );
        try {
          const finalProjectResponse = await apiRequest(
            `/api/projects/${mis}`,
            {
              method: "PATCH",
              body: JSON.stringify(projectUpdateData),
            },
          );
          console.log(
            "✓ Final project update successful:",
            finalProjectResponse,
          );
        } catch (error) {
          console.error("✗ Final project update failed:", error);
          throw error;
        }

        return { success: true };
      } catch (error) {
        console.error("=== COMPREHENSIVE FORM SUBMISSION ERROR ===");
        console.error("Error details:", error);
        console.error("Completed operations:", completedOperations);

        // Provide more specific error information
        let errorMessage = "Παρουσιάστηκε σφάλμα κατά την ενημέρωση";

        // Type guard for error handling
        const errorObj = error as Error;
        if (errorObj && typeof errorObj.message === 'string') {
          if (errorObj.message.includes("Failed to update project data")) {
            errorMessage = "Σφάλμα ενημέρωσης βασικών στοιχείων έργου";
          } else if (errorObj.message.includes("decisions")) {
            errorMessage = "Σφάλμα ενημέρωσης αποφάσεων";
          } else if (errorObj.message.includes("formulations")) {
            errorMessage = "Σφάλμα ενημέρωσης διατυπώσεων";
          }
        }

        // Create enhanced error with context
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).originalError = error;
        (enhancedError as any).completedOperations = completedOperations;

        throw enhancedError;
      }
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Όλα τα στοιχεία του έργου ενημερώθηκαν επιτυχώς",
      });

      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${mis}/complete`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${mis}/index`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${mis}/decisions`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${mis}/formulations`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${mis}/history`],
      });

      // Stay on the edit page to show updated data
      // Data will refresh automatically due to query invalidation
      console.log(
        "✅ Save successful - staying on edit page with refreshed data",
      );
    },
    onError: (error) => {
      console.error("Form submission failed:", error);
      toast({
        title: "Σφάλμα",
        description:
          "Παρουσιάστηκε σφάλμα κατά την ενημέρωση. Παρακαλώ προσπαθήστε ξανά.",
        variant: "destructive",
      });
    },
  });

  // Helper function to consolidate location details processing
  const getLocationDetailsFromData = () => {
    if (
      projectIndexData &&
      Array.isArray(projectIndexData) &&
      projectIndexData.length > 0
    ) {
      const locationDetailsMap = new Map();

      // Group by implementing agency and event type
      projectIndexData.forEach((indexItem) => {
        const kallikratis = typedKallikratisData.find(
          (k) => k.id === indexItem.kallikratis_id,
        );
        const unit = typedUnitsData.find((u) => u.id === indexItem.monada_id);
        const eventType = typedEventTypesData.find(
          (et) => et.id === indexItem.event_types_id,
        );
        const expenditureType = typedExpenditureTypesData.find(
          (et) => et.id === indexItem.expenditure_type_id,
        );

        const key = `${indexItem.monada_id || "no-unit"}-${indexItem.event_types_id || "no-event"}`;

        if (!locationDetailsMap.has(key)) {
          // Use consistent naming pattern that matches the dropdown options
          const implementingAgencyName =
            unit?.unit_name?.name || unit?.name || unit?.unit || "";

          let locationDetail = {
            implementing_agency: implementingAgencyName,
            event_type: eventType?.name || "",
            expenditure_types: [],
            regions: [],
          };

          locationDetailsMap.set(key, locationDetail);
        }

        const locationDetail = locationDetailsMap.get(key);

        // Add region if it doesn't exist
        if (kallikratis) {
          // For geographic codes 804/805, we want regional unit level, not municipality level
          // Only populate municipality if the geographic code is a 4-digit municipality code (>= 9000)
          const shouldIncludeMunicipality =
            indexItem.geographic_code &&
            parseInt(indexItem.geographic_code) >= 9000;
          const municipalityToCheck = shouldIncludeMunicipality
            ? kallikratis.onoma_neou_ota || ""
            : "";

          // Improved deduplication: compare based on actual fields that will be populated
          const existingRegion = locationDetail.regions.find((r) => {
            if (shouldIncludeMunicipality) {
              // For municipality level, check all three fields
              return (
                r.region === kallikratis.perifereia &&
                r.regional_unit === kallikratis.perifereiaki_enotita &&
                r.municipality === kallikratis.onoma_neou_ota
              );
            } else {
              // For regional unit level, only check region and regional_unit
              return (
                r.region === kallikratis.perifereia &&
                r.regional_unit === kallikratis.perifereiaki_enotita
              );
            }
          });

          if (!existingRegion) {
            locationDetail.regions.push({
              region: kallikratis.perifereia || "",
              regional_unit: kallikratis.perifereiaki_enotita || "",
              municipality: municipalityToCheck,
            });
          }
        }

        // Add expenditure type if it exists
        if (expenditureType && expenditureType.expenditure_types) {
          if (
            !locationDetail.expenditure_types.includes(
              expenditureType.expenditure_types,
            )
          ) {
            locationDetail.expenditure_types.push(
              expenditureType.expenditure_types,
            );
          }
        }
      });

      const locationDetailsArray = Array.from(locationDetailsMap.values());
      console.log("DEBUG Final locationDetailsArray:", locationDetailsArray);
      return locationDetailsArray.length > 0
        ? locationDetailsArray
        : [
            {
              implementing_agency: typedProjectData.enhanced_unit?.name || "",
              event_type: "",
              expenditure_types: [],
              regions: [
                {
                  region: "",
                  regional_unit: "",
                  municipality: "",
                },
              ],
            },
          ];
    }

    // Default location detail if no project index data
    console.log(
      "DEBUG - Creating fallback location entry for project without project_index data",
    );

    // Try to get implementing agency from various sources
    const implementingAgency =
      typedProjectData.enhanced_unit?.name ||
      typedProjectData.enhanced_unit?.unit ||
      (typedUnitsData && typedUnitsData.length > 0
        ? typedUnitsData[0].unit
        : "") ||
      "ΔΑΕΦΚ-ΚΕ";

    return [
      {
        implementing_agency: implementingAgency,
        event_type: "",
        expenditure_types: [],
        regions: [
          {
            region: "",
            regional_unit: "",
            municipality: "",
          },
        ],
      },
    ];
  };

  // Data initialization effect
  useEffect(() => {
    console.log("DEBUG - useEffect triggered with conditions:", {
      typedProjectData: !!typedProjectData,
      typedKallikratisData: !!typedKallikratisData,
      typedUnitsData: !!typedUnitsData,
      typedExpenditureTypesData: !!typedExpenditureTypesData,
      hasInitialized: hasInitialized.current,
      willInitialize:
        typedProjectData &&
        typedKallikratisData &&
        typedUnitsData &&
        typedExpenditureTypesData &&
        !hasInitialized.current,
    });

    if (
      typedProjectData &&
      typedKallikratisData &&
      typedUnitsData &&
      typedExpenditureTypesData &&
      !hasInitialized.current
    ) {
      console.log("🚀 INITIALIZING FORM with project data:", typedProjectData);
      console.log("Project index data:", projectIndexData);

      // Set initialization flag to prevent field clearing during setup
      isInitializingRef.current = true;

      // Populate decisions from database or create default
      console.log("DEBUG - Decisions Data for initialization:", {
        decisionsData,
        hasDecisions: decisionsData && decisionsData.length > 0,
        length: decisionsData?.length || 0,
      });

      const decisions =
        decisionsData && decisionsData.length > 0
          ? decisionsData.map((decision) => ({
              protocol_number: decision.protocol_number || "",
              fek: normalizeFekData(decision.fek),
              ada: decision.ada || "",
              implementing_agency: Array.isArray(decision.implementing_agency)
                ? decision.implementing_agency
                : [],
              decision_budget: decision.decision_budget
                ? formatEuropeanNumber(decision.decision_budget)
                : "",
              expenditure_type: Array.isArray(decision.expenditure_type)
                ? decision.expenditure_type
                : [],
              decision_type: decision.decision_type || ("Έγκριση" as const),
              included: decision.included ?? decision.is_included ?? true,
              comments: decision.comments || "",
            }))
          : [
              {
                protocol_number: "",
                fek: { year: "", issue: "", number: "" },
                ada: "",
                implementing_agency: [],
                decision_budget: "",
                expenditure_type: [],
                decision_type: "Έγκριση" as const,
                included: true,
                comments: "",
              },
            ];

      console.log("DEBUG - Final decisions array:", decisions);

      // Populate formulation details from database or create default from project data
      const formulations =
        formulationsData && formulationsData.length > 0
          ? formulationsData.map((formulation) => {
              // Convert connected_decision_ids from database to form format
              let connectedDecisions: number[] = [];
              if (
                formulation.connected_decision_ids &&
                Array.isArray(formulation.connected_decision_ids) &&
                decisionsData
              ) {
                // FIX: More robust mapping with error handling
                console.log(
                  `[ConnectedDecisions] Processing for formulation ${formulation.sa_type}:`,
                  {
                    connected_decision_ids: formulation.connected_decision_ids,
                    decisionsData_available: !!decisionsData,
                    decisionsData_length: decisionsData?.length || 0,
                    available_decision_ids:
                      decisionsData?.map((d) => d.id) || [],
                  },
                );

                try {
                  connectedDecisions = formulation.connected_decision_ids
                    .map((decisionId: number) => {
                      const decisionIndex = decisionsData.findIndex(
                        (d: any) => d.id === decisionId,
                      );
                      console.log(
                        `[ConnectedDecisions] Mapping ID ${decisionId} to index ${decisionIndex}`,
                      );
                      // Only return valid indices (>= 0)
                      return decisionIndex >= 0 ? decisionIndex : null;
                    })
                    .filter(
                      (index: number | null) => index !== null,
                    ) as number[];
                } catch (error) {
                  console.error(
                    `[ConnectedDecisions] Error mapping connected decisions for ${formulation.sa_type}:`,
                    error,
                  );
                  connectedDecisions = []; // Fallback to empty array
                }
              }

              console.log(
                `[FormulationInit] Formulation ${formulation.sa_type}:`,
                {
                  connected_decision_ids: formulation.connected_decision_ids,
                  mapped_to_indices: connectedDecisions,
                  decisions_available: decisionsData?.length || 0,
                  final_connected_decisions: connectedDecisions,
                },
              );

              return {
                sa: formulation.sa_type || ("ΝΑ853" as const),
                enumeration_code: formulation.enumeration_code || "",
                protocol_number: formulation.protocol_number || "",
                ada: formulation.ada || formulation.ada_reference || "",
                decision_year: String(
                  formulation.decision_year || formulation.year || "",
                ),
                project_budget: formulation.project_budget
                  ? formatEuropeanNumber(formulation.project_budget)
                  : "",
                epa_version: formulation.epa_version || "",
                total_public_expense: formulation.total_public_expense
                  ? String(formulation.total_public_expense)
                  : "",
                eligible_public_expense: formulation.eligible_public_expense
                  ? String(formulation.eligible_public_expense)
                  : "",
                decision_status:
                  formulation.decision_status ||
                  formulation.status ||
                  ("Ενεργή" as const),
                change_type: formulation.change_type || ("Έγκριση" as const),
                connected_decisions: connectedDecisions,
                comments: formulation.comments || "",
              };
            })
          : [
              // NA853 entry
              {
                sa: "ΝΑ853" as const,
                enumeration_code: typedProjectData.na853 || "",
                protocol_number: "",
                ada: "",
                decision_year: Array.isArray(typedProjectData.event_year)
                  ? typedProjectData.event_year[0]
                  : typedProjectData.event_year?.toString() || "",
                project_budget: typedProjectData.budget_na853
                  ? formatEuropeanNumber(typedProjectData.budget_na853)
                  : "",
                epa_version: "",
                total_public_expense: "",
                eligible_public_expense: "",
                decision_status: "Ενεργή" as const,
                change_type: "Έγκριση" as const,
                connected_decisions: [],
                comments: "",
              },
              // NA271 entry if exists
              ...(typedProjectData.na271
                ? [
                    {
                      sa: "ΝΑ271" as const,
                      enumeration_code: typedProjectData.na271,
                      protocol_number: "",
                      ada: "",
                      decision_year: Array.isArray(typedProjectData.event_year)
                        ? typedProjectData.event_year[0]
                        : typedProjectData.event_year?.toString() || "",
                      project_budget: typedProjectData.budget_na271
                        ? formatEuropeanNumber(typedProjectData.budget_na271)
                        : "",
                      epa_version: "",
                      total_public_expense: "",
                      eligible_public_expense: "",
                      decision_status: "Ενεργή" as const,
                      change_type: "Έγκριση" as const,
                      connected_decisions: [],
                      comments: "",
                    },
                  ]
                : []),
              // E069 entry if exists
              ...(typedProjectData.e069
                ? [
                    {
                      sa: "E069" as const,
                      enumeration_code: typedProjectData.e069,
                      protocol_number: "",
                      ada: "",
                      decision_year: Array.isArray(typedProjectData.event_year)
                        ? typedProjectData.event_year[0]
                        : typedProjectData.event_year?.toString() || "",
                      project_budget: typedProjectData.budget_e069
                        ? formatEuropeanNumber(typedProjectData.budget_e069)
                        : "",
                      epa_version: "",
                      total_public_expense: "",
                      eligible_public_expense: "",
                      decision_status: "Ενεργή" as const,
                      change_type: "Έγκριση" as const,
                      connected_decisions: [],
                      comments: "",
                    },
                  ]
                : []),
            ];

      // Use reset to properly initialize all form values
      console.log("🔥 RESETTING FORM WITH DECISIONS:", decisions);

      const formData = {
        decisions,
        event_details: {
          event_name: typedProjectData.enhanced_event_type?.name || "",
          event_year: Array.isArray(typedProjectData.event_year)
            ? typedProjectData.event_year[0]
            : typedProjectData.event_year?.toString() || "",
        },
        project_details: {
          mis: typedProjectData.mis?.toString() || "",
          sa: formulations.length > 0 ? formulations[0].sa : "ΝΑ853",
          inc_year: typedProjectData.inc_year?.toString() || "",
          project_title: typedProjectData.project_title || "",
          project_description: typedProjectData.event_description || "",
          summary_description: "",
          expenses_executed: "",
          project_status: typedProjectData.status || "Ενεργό",
        },
        formulation_details: formulations,
        location_details: getLocationDetailsFromData(),
        previous_entries: [],
        changes: Array.isArray(typedProjectData.updates) && typedProjectData.updates.length > 0 
          ? typedProjectData.updates 
          : [{ 
              timestamp: new Date().toISOString().slice(0, 16),
              user_name: "",
              change_type: "Other",
              description: "",
              notes: ""
            }],
      };

      // Set each field individually to force component updates
      console.log("🔥 SETTING FORM VALUES INDIVIDUALLY:");
      form.setValue("decisions", formData.decisions, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("event_details", formData.event_details, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("project_details", formData.project_details, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("formulation_details", formData.formulation_details, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("location_details", formData.location_details, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("previous_entries", formData.previous_entries, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("changes", formData.changes, {
        shouldValidate: true,
        shouldDirty: true,
      });

      // Force form re-render and validation
      form.trigger();

      // Force component re-render by updating key
      setFormKey((prev) => prev + 1);

      // Verify the values were set
      setTimeout(() => {
        const currentProjectDetails = form.getValues("project_details");
        console.log("🔍 PROJECT DETAILS AFTER SET:", currentProjectDetails);
      }, 100);

      // Populate location details using consolidated function
      const locationDetailsArray = getLocationDetailsFromData();

      console.log("🔥 SETTING LOCATION DETAILS:", locationDetailsArray);
      form.setValue("location_details", locationDetailsArray);
      console.log(
        "🔍 FORM location_details AFTER SET:",
        form.getValues("location_details"),
      );

      form.setValue("changes", []);
      hasInitialized.current = true;
      setInitializationTime(Date.now());

      // Clear initialization flag after a delay to allow form to settle
      setTimeout(() => {
        isInitializingRef.current = false;
        console.log(
          "Form initialization complete - field clearing protection disabled",
        );
      }, 3000);
    }
  }, [
    mis,
    typedProjectData,
    typedKallikratisData,
    typedUnitsData,
    typedExpenditureTypesData,
  ]);

  // PERFORMANCE: Only block on essential project data, allow progressive loading for reference data
  const isLoading = isEssentialDataLoading;
  const isDataReady =
    typedProjectData &&
    (typedEventTypesData || referenceData?.eventTypes) &&
    (typedUnitsData || referenceData?.units) &&
    (typedExpenditureTypesData || referenceData?.expenditureTypes);
  
  // Kallikratis data can load progressively without blocking the form
  const hasKallikratisData = typedKallikratisData || referenceData?.kallikratis;

  if (completeDataError) {
    return (
      <div className="container mx-auto p-6">
        Σφάλμα κατά τη φόρτωση των δεδομένων
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-center">
              Φόρτωση δεδομένων έργου...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${typedProjectData ? "bg-green-500" : "bg-gray-300"}`}
                  ></div>
                  <span>Στοιχεία έργου {typedProjectData ? "✓" : "..."}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${(typedUnitsData || referenceData?.units) ? "bg-green-500" : "bg-gray-300"}`}
                  ></div>
                  <span>Φορείς υλοποίησης {(typedUnitsData || referenceData?.units) ? "✓" : "..."}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${(typedEventTypesData || referenceData?.eventTypes) ? "bg-green-500" : "bg-gray-300"}`}
                  ></div>
                  <span>Τύποι συμβάντων {(typedEventTypesData || referenceData?.eventTypes) ? "✓" : "..."}</span>
                </div>
                {isReferenceDataLoading && (
                  <div className="text-sm text-gray-500 text-center">
                    Φόρτωση επιπλέον δεδομένων στο παρασκήνιο...
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isDataReady) {
    return (
      <div className="container mx-auto p-6">
        Αναμονή για φόρτωση δεδομένων...
      </div>
    );
  }

  // Debug all fetched data
  console.log(
    "DEBUG - Kallikratis data sample:",
    typedKallikratisData?.slice(0, 3),
  );
  console.log(
    "DEBUG - Total kallikratis entries:",
    typedKallikratisData?.length,
  );
  console.log("DEBUG - Units data:", typedUnitsData?.length, "units total");
  console.log(
    "DEBUG - All units:",
    typedUnitsData?.map((u) => `${u.id}: ${u.unit}`),
  );
  console.log(
    "DEBUG - Event types data:",
    typedEventTypesData?.length || 0,
    "total items",
    typedEventTypesData?.slice(0, 3),
  );
  console.log(
    "DEBUG - Expenditure types data:",
    typedExpenditureTypesData?.length || 0,
    "total items",
    typedExpenditureTypesData?.slice(0, 3),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Επεξεργασία Έργου: {typedProjectData?.project_title}
          </h1>
          <div className="flex items-center gap-4 text-gray-600 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">MIS: {typedProjectData?.mis}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm">
                {typedProjectData?.status || "Ενεργό"}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${mis}`)}
            >
              Επιστροφή στο Έργο
            </Button>
            <Button
              onClick={form.handleSubmit((data) => mutation.mutate(data))}
              disabled={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {mutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Αποθήκευση...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Αποθήκευση Αλλαγών
                </>
              )}
            </Button>
          </div>
        </div>

        <Form key={formKey} {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-6"
          >
            <Tabs defaultValue="project" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger
                  value="project"
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Στοιχεία Έργου
                </TabsTrigger>
                <TabsTrigger
                  value="event-location"
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  Γεγονός & Τοποθεσία
                </TabsTrigger>
                <TabsTrigger
                  value="formulation"
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Διατύπωση
                </TabsTrigger>
                <TabsTrigger
                  value="decisions"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Αποφάσεις
                </TabsTrigger>
                <TabsTrigger
                  value="changes"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Αλλαγές
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Decisions */}
              <TabsContent value="decisions">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Αποφάσεις που Τεκμηριώνουν το Έργο
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {form.watch("decisions").map((_, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">Απόφαση {index + 1}</h4>
                            {form.watch("decisions").length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const decisions = form.getValues("decisions");
                                  decisions.splice(index, 1);
                                  form.setValue("decisions", decisions);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`decisions.${index}.protocol_number`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 12345/2024"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`decisions.${index}.ada`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΑΔΑ</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. ΩΔΨΚ4653Π6-ΓΞΤ"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name={`decisions.${index}.fek.year`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΦΕΚ Έτος</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="π.χ. 2024" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`decisions.${index}.fek.issue`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΦΕΚ Τεύχος</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="π.χ. Β'" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`decisions.${index}.fek.number`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΦΕΚ Αριθμός</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="π.χ. 1234" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`decisions.${index}.decision_budget`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Προϋπολογισμός Απόφασης</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 1.000.000,00"
                                      onChange={(e) => {
                                        const formatted =
                                          formatNumberWhileTyping(
                                            e.target.value,
                                          );
                                        field.onChange(formatted);
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`decisions.${index}.expenses_covered`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Δαπάνες που καλύπτει</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 500.000,00"
                                      onChange={(e) => {
                                        const formatted =
                                          formatNumberWhileTyping(
                                            e.target.value,
                                          );
                                        field.onChange(formatted);
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`decisions.${index}.decision_type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Τύπος Απόφασης</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε τύπο" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Έγκριση">
                                        Έγκριση
                                      </SelectItem>
                                      <SelectItem value="Τροποποίηση">
                                        Τροποποίηση
                                      </SelectItem>
                                      <SelectItem value="Παράταση">
                                        Παράταση
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`decisions.${index}.included`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>
                                      Συμπεριλαμβάνεται στο έργο
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Implementing Agency Multi-select */}
                          <div>
                            <FormLabel>Υλοποιούσες Μονάδες</FormLabel>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                              {typedUnitsData?.map((unit) => (
                                <FormField
                                  key={unit.id}
                                  control={form.control}
                                  name={`decisions.${index}.implementing_agency`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(
                                            unit.id,
                                          )}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              field.onChange([
                                                ...(field.value || []),
                                                unit.id,
                                              ]);
                                            } else {
                                              field.onChange(
                                                (field.value || []).filter(
                                                  (item: number) =>
                                                    item !== unit.id,
                                                ),
                                              );
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {unit.unit_name?.name ||
                                          unit.name ||
                                          unit.unit}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Expenditure Type Multi-select */}
                          <div>
                            <FormLabel>Τύποι Δαπανών</FormLabel>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                              {typedExpenditureTypesData?.map(
                                (expenditureType) => (
                                  <FormField
                                    key={expenditureType.id}
                                    control={form.control}
                                    name={`decisions.${index}.expenditure_type`}
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(
                                              expenditureType.id,
                                            )}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                field.onChange([
                                                  ...(field.value || []),
                                                  expenditureType.id,
                                                ]);
                                              } else {
                                                field.onChange(
                                                  (field.value || []).filter(
                                                    (item: number) =>
                                                      item !==
                                                      expenditureType.id,
                                                  ),
                                                );
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal">
                                          {expenditureType.expenditure_types ||
                                            expenditureType.name}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                ),
                              )}
                            </div>
                          </div>

                          <FormField
                            control={form.control}
                            name={`decisions.${index}.comments`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Σχόλια</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Προαιρετικά σχόλια..."
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const decisions = form.getValues("decisions");
                          decisions.push({
                            protocol_number: "",
                            fek: { year: "", issue: "", number: "" },
                            ada: "",
                            implementing_agency: [],
                            decision_budget: "",
                            expenses_covered: "",
                            expenditure_type: [],
                            decision_type: "Έγκριση",
                            included: true,
                            comments: "",
                          });
                          form.setValue("decisions", decisions);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Απόφασης
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Event & Location */}
              <TabsContent value="event-location">
                <div className="space-y-6">
                  {/* Event Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Στοιχεία Γεγονότος</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="event_details.event_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Όνομα Γεγονότος</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε γεγονός" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {typedEventTypesData?.map((eventType) => (
                                    <SelectItem
                                      key={eventType.id}
                                      value={eventType.name}
                                    >
                                      {eventType.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="event_details.event_year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Έτος Γεγονότος</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="π.χ. 2024" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Location Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Στοιχεία Τοποθεσίας</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {form
                          .watch("location_details")
                          .map((_, locationIndex) => (
                            <div
                              key={locationIndex}
                              className="border rounded-lg p-4 space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium">
                                  Τοποθεσία {locationIndex + 1}
                                </h4>
                                {form.watch("location_details").length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const locations =
                                        form.getValues("location_details");
                                      locations.splice(locationIndex, 1);
                                      form.setValue(
                                        "location_details",
                                        locations,
                                      );
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`location_details.${locationIndex}.implementing_agency`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Υλοποιούσα Μονάδα</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Επιλέξτε μονάδα" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {typedUnitsData?.map((unit) => (
                                            <SelectItem
                                              key={unit.id}
                                              value={
                                                unit.unit_name?.name ||
                                                unit.name ||
                                                unit.unit ||
                                                ""
                                              }
                                            >
                                              {unit.unit_name?.name ||
                                                unit.name ||
                                                unit.unit}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`location_details.${locationIndex}.event_type`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Τύπος Γεγονότος</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Επιλέξτε τύπο" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {typedEventTypesData?.map(
                                            (eventType) => (
                                              <SelectItem
                                                key={eventType.id}
                                                value={eventType.name}
                                              >
                                                {eventType.name}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Expenditure Types */}
                              <div>
                                <FormLabel>Τύποι Δαπανών</FormLabel>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                  {typedExpenditureTypesData?.map(
                                    (expenditureType) => (
                                      <FormField
                                        key={expenditureType.id}
                                        control={form.control}
                                        name={`location_details.${locationIndex}.expenditure_types`}
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                              <Checkbox
                                                checked={field.value?.includes(
                                                  expenditureType.expenditure_types ||
                                                    expenditureType.name ||
                                                    "",
                                                )}
                                                onCheckedChange={(checked) => {
                                                  const expenditureName =
                                                    expenditureType.expenditure_types ||
                                                    expenditureType.name ||
                                                    "";
                                                  if (checked) {
                                                    field.onChange([
                                                      ...(field.value || []),
                                                      expenditureName,
                                                    ]);
                                                  } else {
                                                    field.onChange(
                                                      (
                                                        field.value || []
                                                      ).filter(
                                                        (item: string) =>
                                                          item !==
                                                          expenditureName,
                                                      ),
                                                    );
                                                  }
                                                }}
                                              />
                                            </FormControl>
                                            <FormLabel className="text-sm font-normal">
                                              {expenditureType.expenditure_types ||
                                                expenditureType.name}
                                            </FormLabel>
                                          </FormItem>
                                        )}
                                      />
                                    ),
                                  )}
                                </div>
                              </div>

                              {/* Regions */}
                              <div className="space-y-4">
                                <FormLabel>Περιοχές</FormLabel>
                                {form
                                  .watch(
                                    `location_details.${locationIndex}.regions`,
                                  )
                                  .map((_, regionIndex) => (
                                    <div
                                      key={regionIndex}
                                      className="grid grid-cols-1 md:grid-3 gap-4 p-3 border rounded"
                                    >
                                      <div className="md:col-span-3 flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">
                                          Περιοχή {regionIndex + 1}
                                        </span>
                                        {form.watch(
                                          `location_details.${locationIndex}.regions`,
                                        ).length > 1 && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const locations =
                                                form.getValues(
                                                  "location_details",
                                                );
                                              locations[
                                                locationIndex
                                              ].regions.splice(regionIndex, 1);
                                              form.setValue(
                                                "location_details",
                                                locations,
                                              );
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>

                                      <FormField
                                        control={form.control}
                                        name={`location_details.${locationIndex}.regions.${regionIndex}.region`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Περιφέρεια</FormLabel>
                                            <Select
                                              onValueChange={field.onChange}
                                              value={field.value}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Επιλέξτε περιφέρεια" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {getUniqueRegions().map(
                                                  (region) => (
                                                    <SelectItem
                                                      key={region}
                                                      value={region}
                                                    >
                                                      {region}
                                                    </SelectItem>
                                                  ),
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />

                                      <FormField
                                        control={form.control}
                                        name={`location_details.${locationIndex}.regions.${regionIndex}.regional_unit`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>
                                              Περιφερειακή Ενότητα
                                            </FormLabel>
                                            <Select
                                              onValueChange={field.onChange}
                                              value={field.value}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Επιλέξτε ενότητα" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {getRegionalUnitsForRegion(
                                                  form.watch(
                                                    `location_details.${locationIndex}.regions.${regionIndex}.region`,
                                                  ),
                                                ).map((unit) => (
                                                  <SelectItem
                                                    key={unit}
                                                    value={unit}
                                                  >
                                                    {unit}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />

                                      <FormField
                                        control={form.control}
                                        name={`location_details.${locationIndex}.regions.${regionIndex}.municipality`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Δήμος</FormLabel>
                                            <Select
                                              onValueChange={field.onChange}
                                              value={field.value}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Επιλέξτε δήμο" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {getMunicipalitiesForRegionalUnit(
                                                  form.watch(
                                                    `location_details.${locationIndex}.regions.${regionIndex}.region`,
                                                  ),
                                                  form.watch(
                                                    `location_details.${locationIndex}.regions.${regionIndex}.regional_unit`,
                                                  ),
                                                ).map((municipality) => (
                                                  <SelectItem
                                                    key={municipality}
                                                    value={municipality}
                                                  >
                                                    {municipality}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  ))}

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const locations =
                                      form.getValues("location_details");
                                    locations[locationIndex].regions.push({
                                      region: "",
                                      regional_unit: "",
                                      municipality: "",
                                    });
                                    form.setValue(
                                      "location_details",
                                      locations,
                                    );
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Προσθήκη Περιοχής
                                </Button>
                              </div>
                            </div>
                          ))}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const locations =
                              form.getValues("location_details");
                            locations.push({
                              implementing_agency: "",
                              event_type: "",
                              expenditure_types: [],
                              regions: [
                                {
                                  region: "",
                                  regional_unit: "",
                                  municipality: "",
                                },
                              ],
                            });
                            form.setValue("location_details", locations);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Προσθήκη Τοποθεσίας
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 3: Project Details */}
              <TabsContent value="project">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Στοιχεία Έργου
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="project_details.mis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MIS</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="π.χ. 5222801" />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="project_details.sa"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ΣΑ</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  // Auto-populate enumeration code based on selected ΣΑ using existing data
                                  const currentEnumerationCode = form.getValues(
                                    "project_details.enumeration_code",
                                  );
                                  const newEnumerationCode =
                                    generateEnumerationCode(
                                      value,
                                      currentEnumerationCode,
                                      existingEnumerationCodes,
                                    );
                                  form.setValue(
                                    "project_details.enumeration_code",
                                    newEnumerationCode,
                                  );
                                }}
                                value={field.value || ""}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε ΣΑ" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {existingSATypes.length > 0 ? (
                                    existingSATypes.map((saType) => (
                                      <SelectItem key={saType} value={saType}>
                                        {saType}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <>
                                      <SelectItem value="ΝΑ853">ΝΑ853</SelectItem>
                                      <SelectItem value="ΝΑ271">ΝΑ271</SelectItem>
                                      <SelectItem value="E069">E069</SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="project_details.inc_year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Έτος Ένταξης</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="π.χ. 2024" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="project_details.project_status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Κατάσταση Έργου</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Ενεργό">Ενεργό</SelectItem>
                                  <SelectItem value="Αναμονή">
                                    Αναμονή
                                  </SelectItem>
                                  <SelectItem value="Ολοκληρωμένο">
                                    Ολοκληρωμένο
                                  </SelectItem>
                                  <SelectItem value="Ακυρωμένο">
                                    Ακυρωμένο
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="project_details.project_title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τίτλος Έργου</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Εισάγετε τον τίτλο του έργου..."
                                rows={6}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.project_description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Περιγραφή Έργου</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Εισάγετε αναλυτική περιγραφή του έργου..."
                                rows={2}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.summary_description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Συνοπτική Περιγραφή</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Εισάγετε συνοπτική περιγραφή..."
                                rows={2}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.expenses_executed"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Εκτελεσθείσες Δαπάνες</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="π.χ. 500.000,00"
                                onChange={(e) => {
                                  const formatted = formatNumberWhileTyping(
                                    e.target.value,
                                  );
                                  field.onChange(formatted);
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 4: Formulation Details */}
              <TabsContent value="formulation">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Στοιχεία Διατύπωσης Έργου
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {form.watch("formulation_details").map((_, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">
                              Διατύπωση {index + 1}
                            </h4>
                            {form.watch("formulation_details").length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const formulations = form.getValues(
                                    "formulation_details",
                                  );
                                  formulations.splice(index, 1);
                                  form.setValue(
                                    "formulation_details",
                                    formulations,
                                  );
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.sa`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΣΑ</FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Auto-populate enumeration code based on selected ΣΑ using existing data
                                      const currentEnumerationCode =
                                        form.getValues(
                                          `formulation_details.${index}.enumeration_code`,
                                        );
                                      const newEnumerationCode =
                                        generateEnumerationCode(
                                          value,
                                          currentEnumerationCode,
                                          existingEnumerationCodes,
                                        );
                                      form.setValue(
                                        `formulation_details.${index}.enumeration_code`,
                                        newEnumerationCode,
                                      );
                                    }}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε ΣΑ" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {existingSATypes.length > 0 ? (
                                        existingSATypes.map((saType) => (
                                          <SelectItem key={saType} value={saType}>
                                            {saType}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <>
                                          <SelectItem value="ΝΑ853">
                                            ΝΑ853
                                          </SelectItem>
                                          <SelectItem value="ΝΑ271">
                                            ΝΑ271
                                          </SelectItem>
                                          <SelectItem value="E069">E069</SelectItem>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.enumeration_code`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Κωδικός Απαρίθμησης</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 2023ΕΠ00100001"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.decision_year`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Έτος Απόφασης</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="π.χ. 2024" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.protocol_number`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 12345/2024"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.ada`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΑΔΑ</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. ΩΔΨΚ4653Π6-ΓΞΤ"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.project_budget`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Προϋπολογισμός Έργου</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 1.000.000,00"
                                      onChange={(e) => {
                                        const formatted =
                                          formatNumberWhileTyping(
                                            e.target.value,
                                          );
                                        const validated =
                                          validateAndLimitNumericInput(
                                            formatted,
                                            "Προϋπολογισμός Έργου",
                                          );
                                        field.onChange(validated);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs text-muted-foreground">
                                    Μέγιστο επιτρεπτό ποσό: 9.999.999.999,99 €
                                  </FormMessage>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.epa_version`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Έκδοση ΕΠΑ</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="π.χ. 1.0" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.total_public_expense`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Συνολική Δημόσια Δαπάνη</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 800.000,00"
                                      onChange={(e) => {
                                        const formatted =
                                          formatNumberWhileTyping(
                                            e.target.value,
                                          );
                                        const validated =
                                          validateAndLimitNumericInput(
                                            formatted,
                                            "Συνολική Δημόσια Δαπάνη",
                                          );
                                        field.onChange(validated);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs text-muted-foreground">
                                    Μέγιστο επιτρεπτό ποσό: 9.999.999.999,99 €
                                  </FormMessage>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.eligible_public_expense`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    Επιλέξιμη Δημόσια Δαπάνη
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 750.000,00"
                                      onChange={(e) => {
                                        const formatted =
                                          formatNumberWhileTyping(
                                            e.target.value,
                                          );
                                        const validated =
                                          validateAndLimitNumericInput(
                                            formatted,
                                            "Επιλέξιμη Δημόσια Δαπάνη",
                                          );
                                        field.onChange(validated);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs text-muted-foreground">
                                    Μέγιστο επιτρεπτό ποσό: 9.999.999.999,99 €
                                  </FormMessage>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.decision_status`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Κατάσταση Απόφασης</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Ενεργή">
                                        Ενεργή
                                      </SelectItem>
                                      <SelectItem value="Ανενεργή">
                                        Ανενεργή
                                      </SelectItem>
                                      <SelectItem value="Αναστολή">
                                        Αναστολή
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.change_type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Τύπος Αλλαγής</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε τύπο" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Έγκριση">
                                        Έγκριση
                                      </SelectItem>
                                      <SelectItem value="Τροποποίηση">
                                        Τροποποίηση
                                      </SelectItem>
                                      <SelectItem value="Παράταση">
                                        Παράταση
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Connected Decisions Multi-select */}
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.connected_decisions`}
                            render={({ field }) => (
                              <FormItem>
                                <div className="mb-4">
                                  <FormLabel className="text-base">
                                    Αποφάσεις που συνδέονται
                                  </FormLabel>
                                  <div className="grid grid-cols-1 gap-2 mt-2">
                                    {(decisionsData || []).map(
                                      (
                                        decision: any,
                                        decisionIndex: number,
                                      ) => (
                                        <FormItem
                                          key={decisionIndex}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={
                                                field.value?.includes(
                                                  decisionIndex,
                                                ) || false
                                              }
                                              onCheckedChange={(checked) => {
                                                const currentValue =
                                                  field.value || [];
                                                if (checked) {
                                                  field.onChange([
                                                    ...currentValue,
                                                    decisionIndex,
                                                  ]);
                                                } else {
                                                  field.onChange(
                                                    currentValue.filter(
                                                      (item: number) =>
                                                        item !== decisionIndex,
                                                    ),
                                                  );
                                                }
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="text-sm font-normal cursor-pointer">
                                            Απόφαση {decisionIndex + 1}:{" "}
                                            {decision.protocol_number ||
                                              decision.kya ||
                                              `#${decisionIndex + 1}`}{" "}
                                            (
                                            {decision.decision_type ||
                                              "Έγκριση"}
                                            )
                                          </FormLabel>
                                        </FormItem>
                                      ),
                                    )}
                                    {(!decisionsData ||
                                      decisionsData.length === 0) && (
                                      <p className="text-sm text-gray-500">
                                        Δεν υπάρχουν διαθέσιμες αποφάσεις για
                                        σύνδεση
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.comments`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Σχόλια</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Προαιρετικά σχόλια..."
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const formulations = form.getValues(
                            "formulation_details",
                          );
                          formulations.push({
                            sa: "ΝΑ853",
                            enumeration_code: "",
                            protocol_number: "",
                            ada: "",
                            decision_year: "",
                            project_budget: "",
                            epa_version: "",
                            total_public_expense: "",
                            eligible_public_expense: "",
                            decision_status: "Ενεργή",
                            change_type: "Έγκριση",
                            connected_decisions: [],
                            comments: "",
                          });
                          form.setValue("formulation_details", formulations);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Διατύπωσης
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 5: Changes - Enhanced with comprehensive tracking */}
              <TabsContent value="changes">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Αλλαγές που Πραγματοποιήθηκαν
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {form.watch("changes").map((_, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-medium text-blue-900">
                              Αλλαγή {index + 1}
                            </h4>
                            {form.watch("changes").length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const changes = form.getValues("changes");
                                  changes.splice(index, 1);
                                  form.setValue("changes", changes);
                                }}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.timestamp`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Χρονική Στιγμή</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="YYYY-MM-DD HH:MM:SS"
                                      value={
                                        field.value ||
                                        new Date().toISOString().slice(0, 16)
                                      }
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`changes.${index}.user_name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Χρήστης</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Όνομα χρήστη που έκανε την αλλαγή"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="mb-4">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.change_type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Τύπος Αλλαγής</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε τύπο αλλαγής" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Initial Creation">
                                        Αρχική Δημιουργία
                                      </SelectItem>
                                      <SelectItem value="Budget Update">
                                        Ενημέρωση Προϋπολογισμού
                                      </SelectItem>
                                      <SelectItem value="Status Change">
                                        Αλλαγή Κατάστασης
                                      </SelectItem>
                                      <SelectItem value="Document Update">
                                        Ενημέρωση Εγγράφων
                                      </SelectItem>
                                      <SelectItem value="Other">Άλλο</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="mb-4">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Περιγραφή Αλλαγής</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      placeholder="Περιγράψτε την αλλαγή που πραγματοποιήθηκε..."
                                      rows={3}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`changes.${index}.notes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Επιπλέον Σημειώσεις</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Προαιρετικές σημειώσεις ή παρατηρήσεις..."
                                    rows={2}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const changes = form.getValues("changes");
                          changes.push({
                            timestamp: new Date().toISOString().slice(0, 16),
                            user_name: "",
                            change_type: "Other",
                            description: "",
                            notes: "",
                          });
                          form.setValue("changes", changes);
                        }}
                        className="w-full md:w-auto"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Αλλαγής
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>
    </div>
  );
}
