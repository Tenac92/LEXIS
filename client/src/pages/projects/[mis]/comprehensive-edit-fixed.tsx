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
      console.log("=== PERFORMANCE OPTIMIZED BATCH SAVE ===");
      console.log("Form data:", data);

      const startTime = Date.now();

      try {
        // Prepare project update data
        const projectUpdateData = {
          project_title: data.project_details.project_title,
          event_description: data.project_details.project_description,
          inc_year: data.project_details.inc_year ? parseInt(data.project_details.inc_year) : null,
          updates: data.changes || [],
          na853: data.project_details.sa,
          // Convert event_name to event_type_id if needed
          event_type: (() => {
            if (!data.event_details.event_name) return null;
            if (typedEventTypesData) {
              const eventType = typedEventTypesData.find(
                (et) =>
                  et.name === data.event_details.event_name ||
                  et.id.toString() === data.event_details.event_name,
              );
              return eventType ? eventType.id : null;
            }
            return null;
          })(),
          event_year: data.event_details.event_year,
          status: data.project_details.project_status,

          // Budget fields - parse European format to numbers
          budget_e069: (() => {
            const formEntry = data.formulation_details.find((f) => f.sa === "E069");
            if (formEntry?.project_budget) {
              return parseEuropeanNumber(formEntry.project_budget);
            }
            return typedProjectData?.budget_e069 || null;
          })(),
          budget_na271: (() => {
            const formEntry = data.formulation_details.find((f) => f.sa === "ΝΑ271");
            if (formEntry?.project_budget) {
              return parseEuropeanNumber(formEntry.project_budget);
            }
            return typedProjectData?.budget_na271 || null;
          })(),
          budget_na853: (() => {
            const formEntry = data.formulation_details.find((f) => f.sa === "ΝΑ853");
            if (formEntry?.project_budget) {
              return parseEuropeanNumber(formEntry.project_budget);
            }
            return typedProjectData?.budget_na853 || null;
          })(),
        };

        // Prepare decisions data
        const decisionsData = data.decisions?.map(decision => ({
          protocol_number: decision.protocol_number || "",
          fek: decision.fek || { year: "", issue: "", number: "" },
          ada: decision.ada || "",
          implementing_agency: Array.isArray(decision.implementing_agency) ? decision.implementing_agency : [],
          decision_budget: parseEuropeanNumber(decision.decision_budget || "") || 0,
          expenses_covered: parseEuropeanNumber(decision.expenses_covered || "") || 0,
          expenditure_type: Array.isArray(decision.expenditure_type) ? decision.expenditure_type : [],
          decision_type: decision.decision_type || "Έγκριση",
          included: decision.included !== undefined ? decision.included : true,
          comments: decision.comments || "",
        })) || [];

        // Prepare formulations data  
        const formulationsData = data.formulation_details?.map(formulation => ({
          sa: formulation.sa,
          enumeration_code: formulation.enumeration_code || "",
          protocol_number: formulation.protocol_number || "",
          ada: formulation.ada || "",
          decision_year: formulation.decision_year || "",
          project_budget: parseEuropeanNumber(formulation.project_budget || "") || 0,
          epa_version: formulation.epa_version || "",
          total_public_expense: parseEuropeanNumber(formulation.total_public_expense || "") || 0,
          eligible_public_expense: parseEuropeanNumber(formulation.eligible_public_expense || "") || 0,
          decision_status: formulation.decision_status || "Ενεργή",
          change_type: formulation.change_type || "Έγκριση",
          connected_decisions: formulation.connected_decisions || [],
          comments: formulation.comments || "",
        })) || [];

        // PERFORMANCE: Single batch API call instead of multiple sequential calls
        const batchSaveData = {
          projectUpdate: projectUpdateData,
          decisions: decisionsData,
          formulations: formulationsData
        };

        console.log("🚀 Starting batch save with data:", batchSaveData);
        
        const response = await apiRequest(`/api/projects/${mis}/batch-save`, {
          method: "PATCH",
          body: JSON.stringify(batchSaveData),
        });

        const endTime = Date.now();
        const clientTime = endTime - startTime;
        
        console.log("✅ Batch save completed successfully!");
        console.log(`⚡ Performance: Client: ${clientTime}ms, Server: ${response.performance?.totalTime}ms`);
        
        return response;

      } catch (error: any) {
        console.error("❌ Batch save failed:", error);
        throw new Error(`Batch save failed: ${error?.message || error}`);
      }
    },
    onSuccess: () => {
      console.log("🎉 Form submission successful!");
      toast({
        title: "Επιτυχία",
        description: "Το έργο ενημερώθηκε με επιτυχία",
        variant: "default",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/complete`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/reference-data`] });
    },
    onError: (error: any) => {
      console.error("💥 Form submission failed:", error);
      toast({
        title: "Σφάλμα",
        description: error?.message || "Αποτυχία ενημέρωσης του έργου",
        variant: "destructive",
      });
    }
  });

  // Individual delete handlers - these now just update form state since we use batch save
  const handleDeleteDecision = async (decisionIndex: number) => {
    try {
      // Simply remove from form state - batch save handles the rest
      const currentDecisions = form.getValues("decisions") || [];
      const updatedDecisions = currentDecisions.filter((_, index) => index !== decisionIndex);
      form.setValue("decisions", updatedDecisions);
      
      console.log(`Decision ${decisionIndex} removed from form state`);
    } catch (error) {
      console.error("Error removing decision:", error);
    }
  };

  const handleDeleteFormulation = async (formulationIndex: number) => {
    try {
      // Simply remove from form state - batch save handles the rest
      const currentFormulations = form.getValues("formulation_details") || [];
      const updatedFormulations = currentFormulations.filter((_, index) => index !== formulationIndex);
      form.setValue("formulation_details", updatedFormulations);
      
      console.log(`Formulation ${formulationIndex} removed from form state`);
    } catch (error) {
      console.error("Error removing formulation:", error);
    }
  };

  // Helper functions already defined above

  // Helper function for geographic codes
  const getGeographicCodeForSave = (region: any, kallikratis: any, forceLevel?: string) => {
    if (!kallikratis) return null;
    
    const level = forceLevel || kallikratis.level;
    
    switch (level) {
      case 'municipality':
        return kallikratis.onoma_neou_ota ? kallikratis.onoma_neou_ota.substring(0, 5) : null;
      case 'regional_unit':
        return kallikratis.perifereiaki_enotita ? kallikratis.perifereiaki_enotita.substring(0, 3) : null;
      case 'region':
        return kallikratis.perifereia ? kallikratis.perifereia.substring(0, 2) : null;
      default:
        return null;
    }
  };

  if (projectQuery.isLoading || referenceDataQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Φόρτωση στοιχείων έργου...</p>
          </div>
        </div>
      </div>
    );
  }

  if (projectQuery.error || referenceDataQuery.error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Σφάλμα Φόρτωσης</h1>
            <p className="text-gray-600">
              {projectQuery.error?.message || referenceDataQuery.error?.message || "Παρουσιάστηκε σφάλμα κατά τη φόρτωση των δεδομένων"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Επεξεργασία Έργου {projectData?.mis}
              </h1>
              <p className="mt-2 text-gray-600">{projectData?.project_title}</p>
            </div>
            <div className="flex gap-3">
              <Link href="/projects" className="btn-secondary">
                Επιστροφή
              </Link>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-8">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-8">
                <TabsTrigger value="basic">Βασικά Στοιχεία</TabsTrigger>
                <TabsTrigger value="decisions">Αποφάσεις</TabsTrigger>
                <TabsTrigger value="formulations">Διατυπώσεις</TabsTrigger>
                <TabsTrigger value="locations">Τοποθεσίες</TabsTrigger>
                <TabsTrigger value="changes">Αλλαγές</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Στοιχεία Έργου</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="mis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ΜΙΣ</FormLabel>
                            <FormControl>
                              <Input {...field} disabled />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ΣΑ</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="project_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Τίτλος Έργου</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={mutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {mutation.isPending ? 'Αποθήκευση...' : 'Αποθήκευση Αλλαγών'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Additional tabs would go here */}
            </Tabs>
          </form>
        </Form>
      </div>
    </div>
  );
}
