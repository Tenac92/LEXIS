import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import { SmartGeographicMultiSelect } from "@/components/forms/SmartGeographicMultiSelect";
import { SubprojectsIntegrationCard } from "@/components/subprojects/SubprojectsIntegrationCard";
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
  FolderOpen,
  Copy,
  CheckSquare,
  Square,
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
  getRegionalUnitsForRegion,
  getMunicipalitiesForRegionalUnit,
  buildNormalizedGeographicData,
  getGeographicCodeForSaveNormalized,
  convertGeographicDataToKallikratis,
} from "@shared/utils/geographic-utils";

// Hook for validating ΣΑ numbers in real-time with proper debouncing
function useSAValidation() {
  const [validationStates, setValidationStates] = useState<Record<string, { 
    isChecking: boolean;
    exists: boolean;
    existingProject?: {
      id: number;
      mis: number;
      project_title: string;
    };
  }>>({});
  
  // Debounce validation to prevent excessive API calls
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const validateSA = useCallback(async (saValue: string, fieldKey: string, currentMis?: string) => {
    // Clear existing timeout for this field
    if (timeoutRef.current[fieldKey]) {
      clearTimeout(timeoutRef.current[fieldKey]);
    }

    if (!saValue?.trim()) {
      setValidationStates(prev => ({ ...prev, [fieldKey]: { isChecking: false, exists: false } }));
      return;
    }

    // Set checking state immediately
    setValidationStates(prev => ({ ...prev, [fieldKey]: { isChecking: true, exists: false } }));

    // Debounce the actual validation call
    timeoutRef.current[fieldKey] = setTimeout(async () => {
      try {
        const response = await apiRequest(`/api/projects/check-sa/${encodeURIComponent(saValue)}`) as any;
        
        // Prevent self-collision: exclude current project from validation
        let isSelfProject = false;
        if (currentMis && response.existingProject?.mis) {
          const currentMisStr = currentMis.toString().trim();
          const existingMisStr = response.existingProject.mis.toString().trim();
          isSelfProject = currentMisStr === existingMisStr;
        }
        
        setValidationStates(prev => ({ 
          ...prev, 
          [fieldKey]: { 
            isChecking: false, 
            exists: response.exists && !isSelfProject,
            existingProject: response.existingProject
          } 
        }));
      } catch (error) {
        // Silently handle validation errors to reduce log spam
        setValidationStates(prev => ({ ...prev, [fieldKey]: { isChecking: false, exists: false } }));
      }
    }, 500); // 500ms debounce
  }, []);

  const getValidationState = (fieldKey: string) => {
    return validationStates[fieldKey] || { isChecking: false, exists: false };
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  return { validateSA, getValidationState };
}

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

  // Section 2 Location details with multi-select geographic areas
  location_details: z
    .array(
      z.object({
        implementing_agency: z.string().default(""),
        event_type: z.string().default(""),
        expenditure_types: z.array(z.string()).default([]),
        geographic_areas: z.array(z.string()).default([]),
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

  // Section 4: Project formulation details with budget versions
  formulation_details: z
    .array(
      z.object({
        sa: z.enum(["ΝΑ853", "ΝΑ271", "E069"]).default("ΝΑ853"),
        enumeration_code: z.string().default(""),
        decision_year: z.string().default(""),
        decision_status: z
          .enum(["Ενεργή", "Ανενεργή", "Αναστολή"])
          .default("Ενεργή"),
        change_type: z
          .enum(["Τροποποίηση", "Παράταση", "Έγκριση"])
          .default("Έγκριση"),
        comments: z.string().default(""),
        budget_versions: z.object({
          pde: z.array(z.object({
            // ΠΔΕ fields: removed version_name, project_budget, total_public_expense, eligible_public_expense, status, connected_decisions
            // Added boundary_budget; renamed decision_type to action_type
            version_number: z.string().default("1.0"),
            boundary_budget: z.string().default(""), // Προϋπολογισμός Οριοθέτησης
            protocol_number: z.string().default(""),
            ada: z.string().default(""),
            decision_date: z.string().default(""),
            action_type: z.enum(["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"]).default("Έγκριση"), // Renamed from decision_type
            comments: z.string().default(""),
          })).default([]),
          epa: z.array(z.object({
            // ΕΠΑ fields: removed version_name, amount, status, connected_decisions
            // Renamed decision_type to action_type; added normalized financials section
            version_number: z.string().default("1.0"),
            epa_version: z.string().default(""),
            protocol_number: z.string().default(""),
            ada: z.string().default(""),
            decision_date: z.string().default(""),
            action_type: z.enum(["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"]).default("Έγκριση"), // Renamed from decision_type
            comments: z.string().default(""),
            // New normalized "Οικονομικά" section for EPA with year-based financial records
            financials: z.array(z.object({
              year: z.number().min(2020).max(2050), // Έτος
              total_public_expense: z.string().default("0"), // Συνολική Δημόσια Δαπάνη
              eligible_public_expense: z.string().default("0"), // Επιλέξιμη Δημόσια Δαπάνη
            })).default([]),
          })).default([]),
        }).default({ pde: [], epa: [] }),
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
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasPreviousEntries, setHasPreviousEntries] = useState(false);
  
  // Batch selection state for formulations and locations
  const [selectedFormulations, setSelectedFormulations] = useState<Set<number>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<number>>(new Set());
  
  // Parse the project ID from the URL parameter
  const projectId = id ? parseInt(id, 10) : undefined;

  // REMOVED: connected_decisions field no longer exists in schema
  /*
  // 🔗 Auto-inheritance logic για connected decisions
  const handleConnectedDecisionChange = (
    formulationIndex: number, 
    budgetType: 'pde' | 'epa', 
    versionIndex: number, 
    newDecisionId: number,
    isAdding: boolean = true
  ) => {
    const formulations = form.getValues('formulation_details');
    const versions = formulations[formulationIndex].budget_versions[budgetType];
    
    if (isAdding) {
      // Προσθήκη decision στην τρέχουσα έκδοση
      const currentDecisions = versions[versionIndex].connected_decisions || [];
      if (!currentDecisions.includes(newDecisionId)) {
        currentDecisions.push(newDecisionId);
        versions[versionIndex].connected_decisions = currentDecisions;
        
        // 🚀 AUTO-INHERITANCE: Προσθήκη σε όλες τις μεταγενέστερες εκδόσεις
        for (let i = versionIndex + 1; i < versions.length; i++) {
          const laterVersionDecisions = versions[i].connected_decisions || [];
          if (!laterVersionDecisions.includes(newDecisionId)) {
            versions[i].connected_decisions = [...laterVersionDecisions, newDecisionId];
          }
        }
        
        // Ενημέρωση form
        form.setValue(`formulation_details.${formulationIndex}.budget_versions.${budgetType}`, versions);
        
        console.log(`[Auto-Inheritance] Decision ${newDecisionId} added to ${budgetType} version ${versionIndex} and ${versions.length - versionIndex - 1} later versions`);
      }
    }
  };

  // 🗑️ Helper για αφαίρεση decision (χωρίς auto-inheritance για removal)
  const handleConnectedDecisionRemoval = (
    formulationIndex: number,
    budgetType: 'pde' | 'epa',
    versionIndex: number,
    decisionIdToRemove: number
  ) => {
    const formulations = form.getValues('formulation_details');
    const versions = formulations[formulationIndex].budget_versions[budgetType];
    
    const currentDecisions = versions[versionIndex].connected_decisions || [];
    versions[versionIndex].connected_decisions = currentDecisions.filter(id => id !== decisionIdToRemove);
    
    form.setValue(`formulation_details.${formulationIndex}.budget_versions.${budgetType}`, versions);
    
    console.log(`[Decision Removal] Decision ${decisionIdToRemove} removed from ${budgetType} version ${versionIndex}`);
  };

  // 🔍 Helper για εντοπισμό inherited vs direct decisions
  const getDecisionOrigin = (
    formulationIndex: number,
    budgetType: 'pde' | 'epa',
    versionIndex: number,
    decisionId: number
  ): { isInherited: boolean; inheritedFromVersion: number | null } => {
    const formulations = form.getValues('formulation_details');
    const versions = formulations[formulationIndex].budget_versions[budgetType];
    
    // Ελέγχουμε αν το decision υπάρχει σε παλαιότερη έκδοση
    for (let i = versionIndex - 1; i >= 0; i--) {
      const olderVersionDecisions = versions[i].connected_decisions || [];
      if (olderVersionDecisions.includes(decisionId)) {
        return { isInherited: true, inheritedFromVersion: i };
      }
    }
    
    return { isInherited: false, inheritedFromVersion: null };
  };
  */

  const [userInteractedFields, setUserInteractedFields] = useState<Set<string>>(
    new Set(),
  );
  const hasInitialized = useRef(false);
  const [initializationTime, setInitializationTime] = useState<number>(0);
  const [formKey, setFormKey] = useState<number>(0);
  const isInitializingRef = useRef(false);
  const { validateSA, getValidationState } = useSAValidation();

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
          geographic_areas: [],
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
          decision_year: "",
          decision_status: "Ενεργή",
          change_type: "Έγκριση",
          comments: "",
          budget_versions: {
            pde: [],
            epa: []
          }
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
    queryKey: [`/api/projects/${projectId}/complete`],
    enabled: !!projectId,
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

  // NEW: Normalized geographic data query
  const {
    data: geographicData,
    isLoading: isGeographicDataLoading,
    error: geographicDataError,
  } = useQuery({
    queryKey: ['/api/geographic-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache for geographic data
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Extract data from optimized API responses with proper typing
  const projectData = completeProjectData?.project;
  const projectIndexData = completeProjectData?.index;
  const decisionsData = completeProjectData?.decisions;
  const formulationsData = completeProjectData?.formulations;
  
  // Extract reference data
  const eventTypesData = (referenceData?.eventTypes?.length > 0 ? referenceData.eventTypes : completeProjectData?.eventTypes);
  const unitsData = (referenceData?.units?.length > 0 ? referenceData.units : completeProjectData?.units);
  const expenditureTypesData = (referenceData?.expenditureTypes?.length > 0 ? referenceData.expenditureTypes : completeProjectData?.expenditureTypes);

  // Extract existing ΣΑ types and enumeration codes from formulations data
  const existingSATypes = [...new Set(formulationsData?.map(f => f.sa).filter(Boolean) || [])];
  const existingEnumerationCodes = formulationsData?.reduce((acc, f) => {
    if (f.sa && f.enumeration_code) {
      acc[f.sa] = f.enumeration_code;
    }
    return acc;
  }, {} as Record<string, string>) || {};

  // Check if all essential data is loading
  const isEssentialDataLoading = isCompleteDataLoading;
  const isAllDataLoading = isCompleteDataLoading || isReferenceDataLoading || isGeographicDataLoading;
  
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

  // Debug logging for geographic data status  
  console.log("DEBUG - Geographic Data Status:", {
    hasNormalizedGeographicData: !!geographicData,
    normalizedRegions: geographicData?.regions?.length || 0,
    normalizedRegionalUnits: geographicData?.regionalUnits?.length || 0,
    normalizedMunicipalities: geographicData?.municipalities?.length || 0,
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

  // Disabled validation on mount to prevent log spam
  // TODO: Re-enable with better controls once the edit form is fully stabilized
  // useEffect(() => {
  //   if (hasInitialized.current) {
  //     const currentSA = form.getValues('project_details.sa');
  //     if (currentSA?.trim()) {
  //       validateSA(currentSA, 'project_details.sa', mis);
  //     }
  //   }
  // }, [validateSA, mis, hasInitialized.current]);

  // Type-safe data casting
  const typedProjectData = projectData as ProjectData | undefined;
  const typedUnitsData = unitsData as UnitData[] | undefined;
  const typedEventTypesData = eventTypesData as EventTypeData[] | undefined;
  const typedExpenditureTypesData = expenditureTypesData as
    | ExpenditureTypeData[]
    | undefined;

  // Helper functions for geographic data - Updated for normalized structure
  const getUniqueRegions = () => {
    if (geographicData?.regions) {
      return geographicData.regions.map(r => r.name).filter(Boolean);
    }
    // Return empty array if geographic data isn't available
    return [];
  };

  const getRegionalUnitsForRegionNormalized = (region: string) => {
    if (!region) return [];
    
    if (geographicData?.regions && geographicData?.regionalUnits) {
      const selectedRegion = geographicData.regions.find(r => r.name === region);
      if (selectedRegion) {
        return getRegionalUnitsForRegion(geographicData.regionalUnits, selectedRegion.code)
          .map(ru => ru.name);
      }
    }
    
    // Return empty array if normalized geographic data isn't available
    return [];
  };

  const getMunicipalitiesForRegionalUnitNormalized = (
    region: string,
    regionalUnit: string,
  ) => {
    if (!region || !regionalUnit) return [];
    
    if (geographicData?.regions && geographicData?.regionalUnits && geographicData?.municipalities) {
      const selectedRegion = geographicData.regions.find(r => r.name === region);
      if (selectedRegion) {
        const selectedRegionalUnit = geographicData.regionalUnits.find(
          ru => ru.name === regionalUnit && ru.region_code === selectedRegion.code
        );
        if (selectedRegionalUnit) {
          return getMunicipalitiesForRegionalUnit(geographicData.municipalities, selectedRegionalUnit.code)
            .map(m => m.name);
        }
      }
    }
    
    // Return empty array if normalized geographic data isn't available
    return [];
  };

  // Additional debug logging now that variables are properly initialized
  console.log("DEBUG - Geographic Data:", {
    uniqueRegionsCount: getUniqueRegions().length,
    uniqueRegions: getUniqueRegions().slice(0, 3),
    // Normalized data info
    hasGeographicData: !!geographicData,
    regionsCount: geographicData?.regions?.length || 0,
    regionalUnitsCount: geographicData?.regionalUnits?.length || 0,
    municipalitiesCount: geographicData?.municipalities?.length || 0,
    isGeographicDataLoading,
    geographicDataError: geographicDataError?.message,
  });

  // Batch operation handlers for formulations
  const handleSelectAllFormulations = () => {
    const formulations = form.getValues("formulation_details");
    const allIndices = new Set(formulations.map((_, idx) => idx));
    setSelectedFormulations(allIndices);
  };

  const handleDeselectAllFormulations = () => {
    setSelectedFormulations(new Set());
  };

  const handleDuplicateSelectedFormulations = () => {
    if (selectedFormulations.size === 0) return;
    
    const formulations = form.getValues("formulation_details");
    const newFormulations = [...formulations];
    
    // Duplicate selected formulations
    selectedFormulations.forEach(index => {
      const original = formulations[index];
      if (original) {
        const duplicated = {
          ...original,
          enumeration_code: generateEnumerationCode(original.sa, "", existingEnumerationCodes),
          budget_versions: {
            pde: [...(original.budget_versions?.pde || [])],
            epa: [...(original.budget_versions?.epa || [])]
          }
        };
        newFormulations.push(duplicated);
      }
    });
    
    form.setValue("formulation_details", newFormulations);
    setSelectedFormulations(new Set());
    
    toast({
      title: "Επιτυχία",
      description: `Αντιγράφηκαν ${selectedFormulations.size} διατύπωση/εις`
    });
  };

  const handleDeleteSelectedFormulations = () => {
    if (selectedFormulations.size === 0) return;
    
    const formulations = form.getValues("formulation_details");
    
    // Prevent deletion if it would leave no formulations
    if (formulations.length - selectedFormulations.size < 1) {
      toast({
        title: "Προσοχή",
        description: "Πρέπει να υπάρχει τουλάχιστον μία διατύπωση",
        variant: "destructive"
      });
      return;
    }
    
    const remainingFormulations = formulations.filter((_, idx) => !selectedFormulations.has(idx));
    form.setValue("formulation_details", remainingFormulations);
    setSelectedFormulations(new Set());
    
    toast({
      title: "Επιτυχία",
      description: `Διαγράφηκαν ${selectedFormulations.size} διατύπωση/εις`
    });
  };

  const toggleFormulationSelection = (index: number) => {
    setSelectedFormulations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Batch operation handlers for locations
  const handleSelectAllLocations = () => {
    const locations = form.getValues("location_details");
    const allIndices = new Set(locations.map((_, idx) => idx));
    setSelectedLocations(allIndices);
  };

  const handleDeselectAllLocations = () => {
    setSelectedLocations(new Set());
  };

  const handleDuplicateSelectedLocations = () => {
    if (selectedLocations.size === 0) return;
    
    const locations = form.getValues("location_details");
    const newLocations = [...locations];
    
    // Duplicate selected locations
    selectedLocations.forEach(index => {
      const original = locations[index];
      if (original) {
        const duplicated = {
          ...original,
          geographic_areas: [...(original.geographic_areas || [])],
          expenditure_types: [...(original.expenditure_types || [])]
        };
        newLocations.push(duplicated);
      }
    });
    
    form.setValue("location_details", newLocations);
    setSelectedLocations(new Set());
    
    toast({
      title: "Επιτυχία",
      description: `Αντιγράφηκαν ${selectedLocations.size} τοποθεσία/ες`
    });
  };

  const handleDeleteSelectedLocations = () => {
    if (selectedLocations.size === 0) return;
    
    const locations = form.getValues("location_details");
    
    // Prevent deletion if it would leave no locations
    if (locations.length - selectedLocations.size < 1) {
      toast({
        title: "Προσοχή",
        description: "Πρέπει να υπάρχει τουλάχιστον μία τοποθεσία",
        variant: "destructive"
      });
      return;
    }
    
    const remainingLocations = locations.filter((_, idx) => !selectedLocations.has(idx));
    form.setValue("location_details", remainingLocations);
    setSelectedLocations(new Set());
    
    toast({
      title: "Επιτυχία",
      description: `Διαγράφηκαν ${selectedLocations.size} τοποθεσία/ες`
    });
  };

  const toggleLocationSelection = (index: number) => {
    setSelectedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getSAColor = (saType: string): string => {
    switch (saType) {
      case "ΝΑ853": return "blue";
      case "ΝΑ271": return "purple";
      case "E069": return "green";
      default: return "gray";
    }
  };

  const getSABorderColor = (saType: string): string => {
    switch (saType) {
      case "ΝΑ853": return "border-l-blue-500";
      case "ΝΑ271": return "border-l-purple-500";
      case "E069": return "border-l-green-500";
      default: return "border-l-gray-500";
    }
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
          const projectResponse = await apiRequest(`/api/projects/${projectId}`, {
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
              `/api/projects/${projectId}/decisions`,
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
                  `/api/projects/${projectId}/decisions/${existingDecision.id}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify(decisionData),
                  },
                );
              } else {
                // Create new decision
                console.log(`Creating new decision:`, decisionData);
                await apiRequest(`/api/projects/${projectId}/decisions`, {
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
                  `/api/projects/${projectId}/decisions/${existingDecisions[i].id}`,
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
              `/api/projects/${projectId}/formulations`,
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
              budget_versions: formulation.budget_versions,
              decision_status: formulation.decision_status,
              change_type: formulation.change_type,
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
                  `/api/projects/${projectId}/formulations/${existingFormulation.id}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify(formulationData),
                  },
                );
              } else {
                // Create new formulation
                console.log(`Creating new formulation:`, formulationData);
                await apiRequest(`/api/projects/${projectId}/formulations`, {
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
                  `/api/projects/${projectId}/formulations/${existingFormulations[i].id}`,
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
                await apiRequest(`/api/projects/${projectId}/changes`, {
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
              !location.geographic_areas ||
              location.geographic_areas.length === 0 ||
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

            // Create entries for each geographic area
            for (const geographicAreaId of location.geographic_areas) {
              // Parse the geographic area ID (format: "region|regional_unit|municipality")
              const [region, regionalUnit, municipality] = geographicAreaId.split('|');
              
              // Skip empty geographic areas
              if (!region && !regionalUnit && !municipality) {
                continue;
              }
              
              // Create a region object for compatibility with backend expectations
              const regionObj = {
                perifereia: region || null,           // Backend expects 'perifereia'
                perifereiaki_enotita: regionalUnit || null,  // Backend expects 'perifereiaki_enotita'  
                dimos: municipality || null,          // Backend expects 'dimos'
                dimotiki_enotita: null               // Optional municipal community
              };

              // Find geographic_code using normalized data
              let geographicCode = null;

              // Use normalized geographic data approach
              if (geographicData?.regions && geographicData?.regionalUnits && geographicData?.municipalities && regionObj.perifereia) {
                try {
                  // Convert to normalized format for the calculation function
                  const normalizedRegionObj = {
                    region: regionObj.perifereia,
                    regional_unit: regionObj.perifereiaki_enotita, 
                    municipality: regionObj.dimos
                  };
                  
                  // Use normalized geographic data for calculation
                  const normalizedData = buildNormalizedGeographicData(geographicData);
                  
                  // Determine the appropriate level based on what data is actually populated
                  const forceLevel =
                    !normalizedRegionObj.municipality ||
                    normalizedRegionObj.municipality.trim() === "" ||
                    normalizedRegionObj.municipality === "__clear__"
                      ? "regional_unit"
                      : "municipality";
                  
                  geographicCode = getGeographicCodeForSaveNormalized(
                    normalizedRegionObj,
                    normalizedData,
                    forceLevel,
                  );

                  console.log("Normalized Geographic Code Calculation:", {
                    perifereia: regionObj.perifereia,
                    perifereiaki_enotita: regionObj.perifereiaki_enotita,
                    dimos: regionObj.dimos,
                    calculated_code: geographicCode,
                    forceLevel,
                    usingNormalizedData: true,
                  });
                } catch (error) {
                  console.warn("Failed to use normalized geographic data:", error);
                  // If normalized data fails, set geographic code to null
                  geographicCode = null;
                }
              }

              // Create project line for this region
              projectLines.push({
                implementing_agency: location.implementing_agency,
                implementing_agency_id: monadaId,
                event_type: location.event_type,
                event_type_id: eventTypeId,
                expenditure_types: location.expenditure_types || [],
                region: {
                  perifereia: regionObj.perifereia,
                  perifereiaki_enotita: regionObj.perifereiaki_enotita,
                  dimos: regionObj.dimos,
                  dimotiki_enotita: regionObj.dimotiki_enotita,
                  kallikratis_id: null,
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
            `/api/projects/${projectId}`,
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/complete`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/index`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/decisions`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/formulations`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/history`],
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
            geographic_areas: [],
          };

          locationDetailsMap.set(key, locationDetail);
        }

        const locationDetail = locationDetailsMap.get(key);

        // Add expenditure type if it doesn't exist
        if (expenditureType && !locationDetail.expenditure_types.includes(expenditureType.expenditure_types)) {
          locationDetail.expenditure_types.push(expenditureType.expenditure_types);
        }
      });

      // Add geographic data from the new normalized structure OR fallback to project index data
      if (completeProjectData?.projectGeographicData) {
        const { regions, regionalUnits, municipalities } = completeProjectData.projectGeographicData;
        
        console.log('DEBUG: Processing new geographic data structure:', {
          regionsCount: regions?.length || 0,
          regionalUnitsCount: regionalUnits?.length || 0,
          municipalitiesCount: municipalities?.length || 0
        });

        // Process project-specific geographic relationships and build geographic_areas
        locationDetailsMap.forEach((locationDetail) => {
          // Extract unique geographic areas from the normalized data
          const uniqueAreas = new Set<string>();
          
          // Add geographic areas from project geographic data
          regions?.forEach((regionData: any) => {
            if (regionData.regions?.name) {
              const regionName = regionData.regions.name;
              
              // Find corresponding regional units for this region
              const relatedUnits = regionalUnits?.filter((unitData: any) => 
                unitData.regional_units?.region_code === regionData.regions.code
              ) || [];
              
              // Find corresponding municipalities for these regional units
              const relatedMunicipalities = municipalities?.filter((muniData: any) => 
                relatedUnits.some(unitData => unitData.regional_units?.code === muniData.municipalities?.unit_code)
              ) || [];

              // For each regional unit, create geographic area entries
              relatedUnits.forEach((unitData: any) => {
                const regionalUnitName = unitData.regional_units?.name;
                
                // Find municipalities for this specific regional unit
                const unitMunicipalities = relatedMunicipalities.filter((muniData: any) => 
                  muniData.municipalities?.unit_code === unitData.regional_units?.code
                );

                if (unitMunicipalities.length > 0) {
                  // If there are municipalities, create entries for each municipality
                  unitMunicipalities.forEach((muniData: any) => {
                    const municipalityName = muniData.municipalities?.name;
                    const geographicAreaId = `${regionName}|${regionalUnitName}|${municipalityName}`;
                    
                    if (!uniqueAreas.has(geographicAreaId)) {
                      uniqueAreas.add(geographicAreaId);
                      locationDetail.geographic_areas.push(geographicAreaId);
                    }
                  });
                } else {
                  // If no municipalities, just add the regional unit level
                  const geographicAreaId = `${regionName}|${regionalUnitName}|`;
                  
                  if (!uniqueAreas.has(geographicAreaId)) {
                    uniqueAreas.add(geographicAreaId);
                    locationDetail.geographic_areas.push(geographicAreaId);
                  }
                }
              });
            }
          });

        });
      }

      // Always ensure geographic_areas are populated from project index data
      
      // Use normalized geographic data from projectGeographicData
      const projectGeographicData = completeProjectData?.projectGeographicData;
      if (projectGeographicData) {
        
        // Create a map to collect geographic areas by location key
        const geographicAreasByLocation = new Map();
        
        // Process municipalities and map to specific locations via project index
        if (projectGeographicData.municipalities) {
          projectGeographicData.municipalities.forEach((muniData) => {
            if (muniData.municipalities?.name) {
              // Find corresponding regional unit and region
              const regionData = projectGeographicData.regions?.find(r => 
                r.region_code && projectGeographicData.regionalUnits?.find(u => 
                  u.unit_code && u.regional_units?.region_code === r.region_code
                )
              );
              const unitData = projectGeographicData.regionalUnits?.find(u => 
                u.unit_code === muniData.municipalities?.unit_code
              );
              
              if (regionData?.regions?.name && unitData?.regional_units?.name) {
                const geographicAreaId = `${regionData.regions.name}|${unitData.regional_units.name}|${muniData.municipalities.name}`;
                
                // Find project index entries that match this municipality's muni_code
                const matchingIndexEntries = projectIndexData?.filter(indexItem => 
                  muniData.muni_code && indexItem.geographic_code && 
                  indexItem.geographic_code.toString().startsWith(muniData.muni_code.toString())
                ) || [];
                
                // Add geographic area to location details that correspond to these project index entries
                matchingIndexEntries.forEach((indexItem) => {
                  const key = `${indexItem.monada_id || "no-unit"}-${indexItem.event_types_id || "no-event"}`;
                  if (locationDetailsMap.has(key)) {
                    if (!geographicAreasByLocation.has(key)) {
                      geographicAreasByLocation.set(key, new Set());
                    }
                    geographicAreasByLocation.get(key).add(geographicAreaId);
                  }
                });
                
                // Fallback: if no specific mapping found, add to all locations (for backward compatibility)
                if (matchingIndexEntries.length === 0) {
                  locationDetailsMap.forEach((locationDetail, key) => {
                    if (!geographicAreasByLocation.has(key)) {
                      geographicAreasByLocation.set(key, new Set());
                    }
                    geographicAreasByLocation.get(key).add(geographicAreaId);
                  });
                }
              }
            }
          });
        }
        
        // Apply collected geographic areas to location details (convert Set to Array and replace)
        geographicAreasByLocation.forEach((geographicAreasSet, key) => {
          const locationDetail = locationDetailsMap.get(key);
          if (locationDetail) {
            locationDetail.geographic_areas = Array.from(geographicAreasSet);
          }
        });
      }

      const locationDetailsArray = Array.from(locationDetailsMap.values());
      return locationDetailsArray.length > 0
        ? locationDetailsArray
        : [
            {
              implementing_agency: typedProjectData.enhanced_unit?.name || "",
              event_type: "",
              expenditure_types: [],
              geographic_areas: [],
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

    if (
      typedProjectData &&
      typedUnitsData &&
      typedExpenditureTypesData &&
      !hasInitialized.current
    ) {
      console.log("🚀 INITIALIZING FORM with project data:", typedProjectData);
      console.log("Project index data:", projectIndexData);

      // Set initialization flag to prevent field clearing during setup
      isInitializingRef.current = true;

      // Populate decisions from database or create default

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
                decision_status:
                  formulation.decision_status ||
                  formulation.status ||
                  ("Ενεργή" as const),
                change_type: formulation.change_type || ("Έγκριση" as const),
                connected_decisions: connectedDecisions,
                comments: formulation.comments || "",
                budget_versions: {
                  pde: formulation.budget_versions?.pde || [
                    ...(formulation.project_budget ? [{
                      version_name: "Αρχική έγκριση",
                      project_budget: formulation.project_budget
                        ? formatEuropeanNumber(formulation.project_budget)
                        : "",
                      total_public_expense: formulation.total_public_expense
                        ? String(formulation.total_public_expense)
                        : "",
                      eligible_public_expense: formulation.eligible_public_expense
                        ? String(formulation.eligible_public_expense)
                        : "",
                      protocol_number: formulation.protocol_number || "",
                      ada: formulation.ada || formulation.ada_reference || "",
                      decision_date: "",
                      decision_type: "Έγκριση" as const,
                      status: "Ενεργή" as const,
                      comments: "",
                    }] : [])
                  ],
                  epa: formulation.budget_versions?.epa || [
                    ...(formulation.epa_version ? [{
                      version_name: "Αρχική έγκριση",
                      epa_version: formulation.epa_version || "",
                      amount: formulation.epa_amount || "",
                      protocol_number: formulation.protocol_number || "",
                      ada: formulation.ada || formulation.ada_reference || "",
                      decision_date: "",
                      decision_type: "Έγκριση" as const,
                      status: "Ενεργή" as const,
                      comments: "",
                    }] : [])
                  ],
                },
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
                decision_status: "Ενεργή" as const,
                change_type: "Έγκριση" as const,
                connected_decisions: [],
                comments: "",
                budget_versions: {
                  pde: typedProjectData.budget_na853 ? [{
                    version_name: "Αρχική έγκριση",
                    project_budget: formatEuropeanNumber(typedProjectData.budget_na853),
                    total_public_expense: "",
                    eligible_public_expense: "",
                    protocol_number: "",
                    ada: "",
                    decision_date: "",
                    decision_type: "Έγκριση" as const,
                    status: "Ενεργή" as const,
                    comments: "",
                  }] : [],
                  epa: [],
                },
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
                      decision_status: "Ενεργή" as const,
                      change_type: "Έγκριση" as const,
                      connected_decisions: [],
                      comments: "",
                      budget_versions: {
                        pde: typedProjectData.budget_na271 ? [{
                          version_name: "Αρχική έγκριση",
                          project_budget: formatEuropeanNumber(typedProjectData.budget_na271),
                          total_public_expense: "",
                          eligible_public_expense: "",
                          protocol_number: "",
                          ada: "",
                          decision_date: "",
                          decision_type: "Έγκριση" as const,
                          status: "Ενεργή" as const,
                          comments: "",
                        }] : [],
                        epa: [],
                      },
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
                      decision_status: "Ενεργή" as const,
                      change_type: "Έγκριση" as const,
                      connected_decisions: [],
                      comments: "",
                      budget_versions: {
                        pde: typedProjectData.budget_e069 ? [{
                          version_name: "Αρχική έγκριση",
                          project_budget: formatEuropeanNumber(typedProjectData.budget_e069),
                          total_public_expense: "",
                          eligible_public_expense: "",
                          protocol_number: "",
                          ada: "",
                          decision_date: "",
                          decision_type: "Έγκριση" as const,
                          status: "Ενεργή" as const,
                          comments: "",
                        }] : [],
                        epa: [],
                      },
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
    id,
    typedProjectData,
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
  
  // Data readiness check
  const hasNormalizedGeographicData = !!geographicData;

  // Convert geographic data to kallikratis format for SmartGeographicMultiSelect
  const kallikratisData = useMemo(() => {
    if (!geographicData) return [];
    return convertGeographicDataToKallikratis(geographicData);
  }, [geographicData]);

  if (completeDataError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Σφάλμα</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              Σφάλμα κατά τη φόρτωση των δεδομένων
            </p>
          </CardContent>
        </Card>
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
  console.log("DEBUG - Units data:", typedUnitsData?.length, "units total");
  console.log("DEBUG - Raw unitsData:", unitsData);
  console.log("DEBUG - referenceData?.units:", referenceData?.units?.length);
  console.log("DEBUG - completeProjectData?.units:", completeProjectData?.units?.length);
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
              onClick={() => navigate(`/projects/${id}`)}
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
              <TabsList className="grid w-full grid-cols-6">
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
                  value="subprojects"
                  className="flex items-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  Υποέργα
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
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε έτος" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) => {
                                        const year = new Date().getFullYear() - i;
                                        return (
                                          <SelectItem key={year} value={year.toString()}>
                                            {year}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`decisions.${index}.fek.issue`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΦΕΚ Τεύχος</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε τεύχος" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Α">Α</SelectItem>
                                      <SelectItem value="Β">Β</SelectItem>
                                      <SelectItem value="Γ">Γ</SelectItem>
                                      <SelectItem value="Δ">Δ</SelectItem>
                                    </SelectContent>
                                  </Select>
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
                        {/* Batch Operations Toolbar */}
                        {form.watch("location_details").length > 0 && (
                          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={selectedLocations.size === form.watch("location_details").length 
                                ? handleDeselectAllLocations 
                                : handleSelectAllLocations}
                              data-testid="button-toggle-select-all-locations"
                            >
                              {selectedLocations.size === form.watch("location_details").length ? (
                                <>
                                  <Square className="h-4 w-4 mr-2" />
                                  Αποεπιλογή Όλων
                                </>
                              ) : (
                                <>
                                  <CheckSquare className="h-4 w-4 mr-2" />
                                  Επιλογή Όλων
                                </>
                              )}
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleDuplicateSelectedLocations}
                              disabled={selectedLocations.size === 0}
                              data-testid="button-duplicate-selected-locations"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Αντιγραφή Επιλεγμένων ({selectedLocations.size})
                            </Button>
                            
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteSelectedLocations}
                              disabled={selectedLocations.size === 0 || form.watch("location_details").length <= 1}
                              data-testid="button-delete-selected-locations"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Διαγραφή Επιλεγμένων ({selectedLocations.size})
                            </Button>
                            
                            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
                              {selectedLocations.size} / {form.watch("location_details").length} επιλεγμένα
                            </div>
                          </div>
                        )}

                        {/* Location Accordions */}
                        <Accordion type="multiple" className="w-full space-y-3">
                          {form.watch("location_details").map((location, locationIndex) => {
                            const geoAreasCount = location.geographic_areas?.length || 0;
                            const expenditureTypesCount = location.expenditure_types?.length || 0;
                            const isSelected = selectedLocations.has(locationIndex);
                            
                            return (
                              <AccordionItem 
                                key={locationIndex} 
                                value={`location-${locationIndex}`}
                                className={`border-l-4 border-l-teal-500 ${isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''}`}
                                data-testid={`accordion-location-${locationIndex}`}
                              >
                                <div className="flex items-center gap-3 pr-4">
                                  {/* Checkbox for batch selection */}
                                  <div 
                                    className="pl-4 py-4"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`checkbox-location-${locationIndex}`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleLocationSelection(locationIndex)}
                                    />
                                  </div>
                                  
                                  <AccordionTrigger className="flex-1 hover:no-underline py-4">
                                    {/* Rich Preview Card */}
                                    <div className="flex items-center gap-4 w-full pr-4">
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant="outline" 
                                          className="bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900 dark:text-teal-300 font-bold"
                                        >
                                          #{locationIndex + 1}
                                        </Badge>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                          Τοποθεσία {locationIndex + 1}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                        {location.implementing_agency && (
                                          <div className="flex items-center gap-1">
                                            <Building2 className="h-4 w-4" />
                                            <span className="truncate max-w-[200px]">{location.implementing_agency}</span>
                                          </div>
                                        )}
                                        
                                        {location.event_type && (
                                          <div className="flex items-center gap-1">
                                            <span className="truncate max-w-[150px]">{location.event_type}</span>
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2 ml-auto">
                                          {geoAreasCount > 0 && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                                              {geoAreasCount} Γεωγρ. Περιοχές
                                            </Badge>
                                          )}
                                          {expenditureTypesCount > 0 && (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                                              {expenditureTypesCount} Δαπάνες
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  
                                  {/* Individual delete button */}
                                  {form.watch("location_details").length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const locations = form.getValues("location_details");
                                        locations.splice(locationIndex, 1);
                                        form.setValue("location_details", locations);
                                        // Update selection state
                                        setSelectedLocations(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(locationIndex);
                                          return newSet;
                                        });
                                        toast({
                                          title: "Επιτυχία",
                                          description: "Η τοποθεσία διαγράφηκε"
                                        });
                                      }}
                                      data-testid={`button-delete-location-${locationIndex}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>
                                
                                <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
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
                                              <SelectTrigger data-testid={`select-implementing-agency-${locationIndex}`}>
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
                                              <SelectTrigger data-testid={`select-event-type-${locationIndex}`}>
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
                                                    data-testid={`checkbox-expenditure-${locationIndex}-${expenditureType.id}`}
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

                                  {/* Geographic Areas */}
                                  <div className="space-y-4">
                                    <FormField
                                      control={form.control}
                                      name={`location_details.${locationIndex}.geographic_areas`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Γεωγραφικές Περιοχές</FormLabel>
                                          <SmartGeographicMultiSelect
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            kallikratisData={kallikratisData}
                                            placeholder="Επιλέξτε γεωγραφικές περιοχές..."
                                          />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>

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
                              geographic_areas: [],
                            });
                            form.setValue("location_details", locations);
                          }}
                          data-testid="button-add-location"
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
                          render={({ field }) => {
                            const fieldKey = 'project_details.sa';
                            const validationState = getValidationState(fieldKey);
                            
                            return (
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
                                    
                                    // Disabled validation on change to prevent log spam
                                    // TODO: Re-enable with better controls
                                    // validateSA(value, fieldKey, mis);
                                  }}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="input-sa">
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
                                
                                {/* Validation feedback */}
                                {validationState.isChecking && (
                                  <p className="text-sm text-blue-600 flex items-center gap-1" data-testid="status-sa">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Έλεγχος ΣΑ...
                                  </p>
                                )}
                                {validationState.exists && validationState.existingProject && (
                                  <p className="text-sm text-red-600 flex items-center gap-1" data-testid="text-sa-conflict">
                                    <X className="h-3 w-3" />
                                    ΣΑ υπάρχει ήδη στο έργο: {validationState.existingProject.project_title} (MIS: {validationState.existingProject.mis})
                                  </p>
                                )}
                                {!validationState.isChecking && !validationState.exists && field.value?.trim() && (
                                  <p className="text-sm text-green-600 flex items-center gap-1" data-testid="text-sa-ok">
                                    <CheckCircle className="h-3 w-3" />
                                    ΣΑ διαθέσιμο
                                  </p>
                                )}
                              </FormItem>
                            );
                          }}
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
                      {/* Batch Operations Toolbar */}
                      {form.watch("formulation_details").length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={selectedFormulations.size === form.watch("formulation_details").length 
                              ? handleDeselectAllFormulations 
                              : handleSelectAllFormulations}
                            data-testid="button-toggle-select-all-formulations"
                          >
                            {selectedFormulations.size === form.watch("formulation_details").length ? (
                              <>
                                <Square className="h-4 w-4 mr-2" />
                                Αποεπιλογή Όλων
                              </>
                            ) : (
                              <>
                                <CheckSquare className="h-4 w-4 mr-2" />
                                Επιλογή Όλων
                              </>
                            )}
                          </Button>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDuplicateSelectedFormulations}
                            disabled={selectedFormulations.size === 0}
                            data-testid="button-duplicate-selected-formulations"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Αντιγραφή Επιλεγμένων ({selectedFormulations.size})
                          </Button>
                          
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelectedFormulations}
                            disabled={selectedFormulations.size === 0 || form.watch("formulation_details").length <= 1}
                            data-testid="button-delete-selected-formulations"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Διαγραφή Επιλεγμένων ({selectedFormulations.size})
                          </Button>
                          
                          <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
                            {selectedFormulations.size} / {form.watch("formulation_details").length} επιλεγμένα
                          </div>
                        </div>
                      )}

                      {/* Formulation Accordions */}
                      <Accordion type="multiple" className="w-full space-y-3">
                        {form.watch("formulation_details").map((formulation, index) => {
                          const pdeCount = formulation.budget_versions?.pde?.length || 0;
                          const epaCount = formulation.budget_versions?.epa?.length || 0;
                          const saColor = getSAColor(formulation.sa);
                          const borderColor = getSABorderColor(formulation.sa);
                          const isSelected = selectedFormulations.has(index);
                          
                          return (
                            <AccordionItem 
                              key={index} 
                              value={`formulation-${index}`}
                              className={`border-l-4 ${borderColor} ${isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''}`}
                              data-testid={`accordion-formulation-${index}`}
                            >
                              <div className="flex items-center gap-3 pr-4">
                                {/* Checkbox for batch selection */}
                                <div 
                                  className="pl-4 py-4"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`checkbox-formulation-${index}`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleFormulationSelection(index)}
                                  />
                                </div>
                                
                                <AccordionTrigger className="flex-1 hover:no-underline py-4">
                                  {/* Rich Preview Card */}
                                  <div className="flex items-center gap-4 w-full pr-4">
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant="outline" 
                                        className={`
                                          ${saColor === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300' : ''}
                                          ${saColor === 'purple' ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300' : ''}
                                          ${saColor === 'green' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300' : ''}
                                          font-bold
                                        `}
                                      >
                                        {formulation.sa}
                                      </Badge>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">
                                        Διατύπωση {index + 1}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        <span>{formulation.enumeration_code || "Χωρίς κωδικό"}</span>
                                      </div>
                                      
                                      {formulation.decision_year && (
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-4 w-4" />
                                          <span>{formulation.decision_year}</span>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-2 ml-auto">
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                                          {pdeCount} ΠΔΕ
                                        </Badge>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                                          {epaCount} ΕΠΑ
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                
                                {/* Individual delete button */}
                                {form.watch("formulation_details").length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const formulations = form.getValues("formulation_details");
                                      formulations.splice(index, 1);
                                      form.setValue("formulation_details", formulations);
                                      
                                      // Update selected indices
                                      setSelectedFormulations(prev => {
                                        const newSet = new Set<number>();
                                        prev.forEach(i => {
                                          if (i < index) newSet.add(i);
                                          else if (i > index) newSet.add(i - 1);
                                        });
                                        return newSet;
                                      });
                                      
                                      toast({
                                        title: "Επιτυχία",
                                        description: "Η διατύπωση διαγράφηκε"
                                      });
                                    }}
                                    data-testid={`button-delete-formulation-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <AccordionContent className="px-4 pb-4 pt-2">
                                {/* All existing formulation fields */}
                                <div className="space-y-4">

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


                          {/* Budget Versions Tabs - ΠΔΕ and ΕΠΑ */}
                          <div className="mt-6">
                            <Tabs defaultValue="pde" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pde" className="flex items-center gap-2">
                                  <span>ΠΔΕ</span>
                                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                                    {form.watch(`formulation_details.${index}.budget_versions.pde`)?.length || 0}
                                  </span>
                                </TabsTrigger>
                                <TabsTrigger value="epa" className="flex items-center gap-2">
                                  <span>ΕΠΑ</span>
                                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">
                                    {form.watch(`formulation_details.${index}.budget_versions.epa`)?.length || 0}
                                  </span>
                                </TabsTrigger>
                              </TabsList>

                              {/* ΠΔΕ Tab */}
                              <TabsContent value="pde">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                      <span>Εκδόσεις ΠΔΕ</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const formulations = form.getValues("formulation_details");
                                          const existingPdeVersions = formulations[index].budget_versions.pde;
                                          const nextVersionNumber = existingPdeVersions.length > 0 
                                            ? (Math.max(...existingPdeVersions.map(v => parseFloat(v.version_number || "1.0"))) + 0.1).toFixed(1)
                                            : "1.0";
                                          formulations[index].budget_versions.pde.push({
                                            version_number: nextVersionNumber,
                                            boundary_budget: "",
                                            protocol_number: "",
                                            ada: "",
                                            decision_date: "",
                                            action_type: "Έγκριση",
                                            comments: ""
                                          });
                                          form.setValue("formulation_details", formulations);
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Προσθήκη Έκδοσης ΠΔΕ
                                      </Button>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {form.watch(`formulation_details.${index}.budget_versions.pde`)?.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">
                                        <p>Δεν υπάρχουν εκδόσεις ΠΔΕ</p>
                                        <p className="text-sm">Κάντε κλικ στο κουμπί "Προσθήκη Έκδοσης ΠΔΕ" για να προσθέσετε την πρώτη έκδοση</p>
                                      </div>
                                    ) : (
                                      <Accordion type="multiple" className="w-full">
                                        {form.watch(`formulation_details.${index}.budget_versions.pde`)
                                          ?.sort((a, b) => parseFloat(a.version_number || "1.0") - parseFloat(b.version_number || "1.0"))
                                          ?.map((versionData, pdeIndex) => {
                                            const originalIndex = form.watch(`formulation_details.${index}.budget_versions.pde`).findIndex(
                                              v => v === versionData
                                            );
                                            const isActiveVersion = form.watch(`formulation_details.${index}.budget_versions.pde`)
                                              ?.reduce((max, current) => 
                                                parseFloat(current.version_number || "1.0") > parseFloat(max.version_number || "1.0") 
                                                  ? current : max, versionData
                                              ) === versionData;
                                            return (
                                          <AccordionItem key={originalIndex} value={`pde-${originalIndex}`}>
                                            <div className="flex items-center justify-between pr-4">
                                              <AccordionTrigger className="flex-1 hover:no-underline">
                                                <div className="flex items-center gap-2">
                                                  <h5 className="font-medium">ΠΔΕ v{versionData.version_number || "1.0"}</h5>
                                                  {isActiveVersion && (
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                                      ΕΝΕΡΓΟ
                                                    </span>
                                                  )}
                                                </div>
                                              </AccordionTrigger>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const formulations = form.getValues("formulation_details");
                                                  formulations[index].budget_versions.pde.splice(originalIndex, 1);
                                                  form.setValue("formulation_details", formulations);
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <AccordionContent className="pt-4">
                                            
                                            {/* Version Information */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.version_number`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Αριθμός Έκδοσης</FormLabel>
                                                    <FormControl>
                                                      <Input 
                                                        {...field} 
                                                        placeholder="π.χ. 1.0, 1.1, 2.0" 
                                                        pattern="[0-9]+\.[0-9]+"
                                                        title="Εισάγετε έκδοση π.χ. 1.0, 1.1, 2.0"
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.decision_date`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Ημερομηνία Απόφασης</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} type="date" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.protocol_number`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 12345/2024" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.ada`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>ΑΔΑ</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 6ΔΛ5465ΦΘΞ-ΨΩΣ" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.action_type`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Είδος Πράξης</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl>
                                                        <SelectTrigger>
                                                          <SelectValue placeholder="Επιλέξτε είδος πράξης" />
                                                        </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                        <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                                        <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                                        <SelectItem value="Κλείσιμο στο ύψος πληρωμών">Κλείσιμο στο ύψος πληρωμών</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.boundary_budget`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Προϋπολογισμός Οριοθέτησης (€)</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} value={field.value ?? ""} placeholder="π.χ. 1.500.000,00" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            {/* Connected Decisions - Removed from schema but keeping UI commented for reference */}
                                            {/* <FormField
                                              control={form.control}
                                              name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.connected_decisions`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel>Συνδεδεμένες Αποφάσεις</FormLabel>
                                                  <FormControl>
                                                    <Select
                                                      onValueChange={(value) => {
                                                        const decisionId = parseInt(value);
                                                        // 🚀 Auto-inheritance logic για PDE
                                                        handleConnectedDecisionChange(index, 'pde', pdeIndex, decisionId, true);
                                                      }}
                                                    >
                                                      <SelectTrigger>
                                                        <SelectValue placeholder="Επιλέξτε αποφάσεις..." />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {form.watch("decisions")?.map((decision, decIndex) => (
                                                          <SelectItem key={decIndex} value={decIndex.toString()}>
                                                            {decision.protocol_number || `Απόφαση ${decIndex + 1}`}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </FormControl>
                                                  {field.value && field.value.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                      {field.value.map((decisionId: number) => {
                                                        const decision = form.watch("decisions")?.[decisionId];
                                                        const { isInherited, inheritedFromVersion } = getDecisionOrigin(index, 'pde', pdeIndex, decisionId);
                                                        
                                                        return (
                                                          <span
                                                            key={decisionId}
                                                            className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                                                              isInherited 
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                                                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                                                            }`}
                                                            title={isInherited ? `Κληρονομήθηκε από έκδοση ${inheritedFromVersion! + 1}` : 'Άμεσα προστεθειμένη απόφαση'}
                                                          >
                                                            {isInherited && <span className="mr-1">🔗</span>}
                                                            {decision?.protocol_number || `Απόφαση ${decisionId + 1}`}
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                // 🗑️ PDE Removal με dedicated function
                                                                handleConnectedDecisionRemoval(index, 'pde', originalIndex, decisionId);
                                                              }}
                                                              className={isInherited ? 'hover:text-orange-600' : 'hover:text-blue-600'}
                                                            >
                                                              ×
                                                            </button>
                                                          </span>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </FormItem>
                                              )}
                                            /> */}
                                            
                                            <FormField
                                              control={form.control}
                                              name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.comments`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel>Σχόλια</FormLabel>
                                                  <FormControl>
                                                    <Textarea {...field} placeholder="Εισάγετε σχόλια..." rows={2} />
                                                  </FormControl>
                                                </FormItem>
                                              )}
                                            />
                                            </AccordionContent>
                                          </AccordionItem>
                                          );
                                        })}
                                      </Accordion>
                                    )}
                                  </CardContent>
                                </Card>
                              </TabsContent>

                              {/* ΕΠΑ Tab */}
                              <TabsContent value="epa">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                      <span>Εκδόσεις ΕΠΑ</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const formulations = form.getValues("formulation_details");
                                          const existingEpaVersions = formulations[index].budget_versions.epa;
                                          const nextVersionNumber = existingEpaVersions.length > 0 
                                            ? (Math.max(...existingEpaVersions.map(v => parseFloat(v.version_number || "1.0"))) + 0.1).toFixed(1)
                                            : "1.0";
                                          formulations[index].budget_versions.epa.push({
                                            version_number: nextVersionNumber,
                                            epa_version: "",
                                            protocol_number: "",
                                            ada: "",
                                            decision_date: "",
                                            action_type: "Έγκριση",
                                            comments: "",
                                            financials: []
                                          });
                                          form.setValue("formulation_details", formulations);
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Προσθήκη Έκδοσης ΕΠΑ
                                      </Button>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {form.watch(`formulation_details.${index}.budget_versions.epa`)?.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">
                                        <p>Δεν υπάρχουν εκδόσεις ΕΠΑ</p>
                                        <p className="text-sm">Κάντε κλικ στο κουμπί "Προσθήκη Έκδοσης ΕΠΑ" για να προσθέσετε την πρώτη έκδοση</p>
                                      </div>
                                    ) : (
                                      <Accordion type="multiple" className="w-full">
                                        {form.watch(`formulation_details.${index}.budget_versions.epa`)
                                          ?.sort((a, b) => parseFloat(a.version_number || "1.0") - parseFloat(b.version_number || "1.0"))
                                          ?.map((versionData, epaIndex) => {
                                            const originalIndex = form.watch(`formulation_details.${index}.budget_versions.epa`).findIndex(
                                              v => v === versionData
                                            );
                                            const isActiveVersion = form.watch(`formulation_details.${index}.budget_versions.epa`)
                                              ?.reduce((max, current) => 
                                                parseFloat(current.version_number || "1.0") > parseFloat(max.version_number || "1.0") 
                                                  ? current : max, versionData
                                              ) === versionData;
                                            return (
                                          <AccordionItem key={originalIndex} value={`epa-${originalIndex}`}>
                                            <div className="flex items-center justify-between pr-4">
                                              <AccordionTrigger className="flex-1 hover:no-underline">
                                                <div className="flex items-center gap-2">
                                                  <h5 className="font-medium">ΕΠΑ v{versionData.version_number || "1.0"}</h5>
                                                  {isActiveVersion && (
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                                      ΕΝΕΡΓΟ
                                                    </span>
                                                  )}
                                                </div>
                                              </AccordionTrigger>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const formulations = form.getValues("formulation_details");
                                                  formulations[index].budget_versions.epa.splice(originalIndex, 1);
                                                  form.setValue("formulation_details", formulations);
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <AccordionContent className="pt-4">
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.version_number`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Αριθμός Έκδοσης</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 1.0" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.epa_version`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Έκδοση ΕΠΑ</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 2021-2027" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.decision_date`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Ημερομηνία Απόφασης</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} type="date" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.protocol_number`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 12345/2024" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.ada`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>ΑΔΑ</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 6ΔΛ5465ΦΘΞ-ΨΩΣ" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.action_type`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Είδος Πράξης</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl>
                                                        <SelectTrigger>
                                                          <SelectValue placeholder="Επιλέξτε είδος πράξης" />
                                                        </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                        <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                                        <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                                        <SelectItem value="Κλείσιμο στο ύψος πληρωμών">Κλείσιμο στο ύψος πληρωμών</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            
                                            
                                            {/* Οικονομικά Section - Financial records for EPA Version */}
                                            <div className="mt-6">
                                              <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-medium text-green-900">Οικονομικά</h4>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    const formulations = form.getValues("formulation_details");
                                                    const currentFinancials = formulations[index].budget_versions.epa[originalIndex].financials || [];
                                                    const currentYear = new Date().getFullYear();
                                                    const newFinancial = {
                                                      year: currentYear,
                                                      total_public_expense: "0",
                                                      eligible_public_expense: "0"
                                                    };
                                                    
                                                    formulations[index].budget_versions.epa[originalIndex].financials = [
                                                      ...currentFinancials,
                                                      newFinancial
                                                    ];
                                                    form.setValue("formulation_details", formulations);
                                                  }}
                                                >
                                                  <Plus className="h-4 w-4 mr-2" />
                                                  Προσθήκη Έτους
                                                </Button>
                                              </div>
                                              
                                              {form.watch(`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials`)?.map((financial: any, financialIndex: number) => (
                                                <div key={financialIndex} className="border rounded-lg p-4 bg-green-50 mb-3">
                                                  <div className="flex items-center justify-between mb-3">
                                                    <h5 className="font-medium text-green-800">Οικονομικά Στοιχεία {financialIndex + 1}</h5>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                        const formulations = form.getValues("formulation_details");
                                                        formulations[index].budget_versions.epa[originalIndex].financials.splice(financialIndex, 1);
                                                        form.setValue("formulation_details", formulations);
                                                      }}
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                  
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <FormField
                                                      control={form.control}
                                                      name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials.${financialIndex}.year`}
                                                      render={({ field }) => (
                                                        <FormItem>
                                                          <FormLabel>Έτος</FormLabel>
                                                          <FormControl>
                                                            <Input 
                                                              {...field} 
                                                              type="number" 
                                                              min="2020" 
                                                              max="2050"
                                                              placeholder="π.χ. 2024"
                                                              onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                                                            />
                                                          </FormControl>
                                                        </FormItem>
                                                      )}
                                                    />
                                                    <FormField
                                                      control={form.control}
                                                      name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials.${financialIndex}.total_public_expense`}
                                                      render={({ field }) => (
                                                        <FormItem>
                                                          <FormLabel>Συνολική Δημόσια Δαπάνη (€)</FormLabel>
                                                          <FormControl>
                                                            <Input 
                                                              {...field} 
                                                              placeholder="π.χ. 100000"
                                                              onChange={(e) => {
                                                                const formatted = formatNumberWhileTyping(e.target.value);
                                                                field.onChange(formatted);
                                                                
                                                                // Auto-validate that eligible <= total
                                                                const eligibleValue = form.getValues(`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials.${financialIndex}.eligible_public_expense`);
                                                                const totalValue = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                                                const eligibleNumeric = parseFloat(eligibleValue?.replace(/,/g, '') || '0');
                                                                
                                                                if (eligibleNumeric > totalValue && totalValue > 0) {
                                                                  form.setValue(`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials.${financialIndex}.eligible_public_expense`, formatted);
                                                                }
                                                              }}
                                                            />
                                                          </FormControl>
                                                        </FormItem>
                                                      )}
                                                    />
                                                    <FormField
                                                      control={form.control}
                                                      name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials.${financialIndex}.eligible_public_expense`}
                                                      render={({ field }) => (
                                                        <FormItem>
                                                          <FormLabel>Επιλέξιμη Δημόσια Δαπάνη (€)</FormLabel>
                                                          <FormControl>
                                                            <Input 
                                                              {...field} 
                                                              placeholder="π.χ. 80000"
                                                              onChange={(e) => {
                                                                const formatted = formatNumberWhileTyping(e.target.value);
                                                                field.onChange(formatted);
                                                                
                                                                // Validate that eligible <= total
                                                                const totalValue = form.getValues(`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials.${financialIndex}.total_public_expense`);
                                                                const eligibleNumeric = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                                                const totalNumeric = parseFloat(totalValue?.replace(/,/g, '') || '0');
                                                                
                                                                if (eligibleNumeric > totalNumeric && totalNumeric > 0) {
                                                                  toast({
                                                                    title: "Προσοχή",
                                                                    description: "Η επιλέξιμη δαπάνη δεν μπορεί να είναι μεγαλύτερη από τη συνολική δαπάνη",
                                                                    variant: "destructive"
                                                                  });
                                                                }
                                                              }}
                                                            />
                                                          </FormControl>
                                                        </FormItem>
                                                      )}
                                                    />
                                                  </div>
                                                </div>
                                              ))}
                                              
                                              {(!form.watch(`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials`) || 
                                                form.watch(`formulation_details.${index}.budget_versions.epa.${originalIndex}.financials`).length === 0) && (
                                                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                                                  <p>Δεν υπάρχουν οικονομικά στοιχεία</p>
                                                  <p className="text-sm">Κάντε κλικ στο "Προσθήκη Έτους" για να προσθέσετε</p>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <FormField
                                              control={form.control}
                                              name={`formulation_details.${index}.budget_versions.epa.${originalIndex}.comments`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel>Σχόλια</FormLabel>
                                                  <FormControl>
                                                    <Textarea {...field} placeholder="Εισάγετε σχόλια..." rows={2} />
                                                  </FormControl>
                                                </FormItem>
                                              )}
                                            />
                                            </AccordionContent>
                                          </AccordionItem>
                                          );
                                        })}
                                      </Accordion>
                                    )}
                                  </CardContent>
                                </Card>
                              </TabsContent>
                            </Tabs>
                          </div>



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
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const formulations = form.getValues(
                            "formulation_details",
                          );
                          // Add new formulation (SA types can be duplicated, enumeration codes must be unique)
                          formulations.push({
                            sa: "ΝΑ853", // Default SA type, user can change it
                            enumeration_code: "",
                            protocol_number: "",
                            ada: "",
                            decision_year: "",
                            decision_status: "Ενεργή",
                            change_type: "Έγκριση",
                            connected_decisions: [],
                            comments: "",
                            budget_versions: {
                              pde: [],
                              epa: []
                            },
                          });
                          form.setValue("formulation_details", formulations);
                          
                          toast({
                            title: "Επιτυχία",
                            description: `Προστέθηκε νέα διατύπωση`
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Διατύπωσης
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 5: Subprojects */}
              <TabsContent value="subprojects">
                <SubprojectsIntegrationCard
                  projectId={completeProjectData?.id || 0}
                  formulationDetails={form.watch("formulation_details") || []}
                  onFormulationChange={(financials) => {
                    // Handle formulation financial changes if needed
                    console.log("[Subprojects] Formulation change:", financials);
                  }}
                  isEditing={true}
                />
              </TabsContent>

              {/* Tab 6: Changes - Enhanced with comprehensive tracking */}
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
