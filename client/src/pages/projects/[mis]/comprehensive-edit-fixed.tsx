import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, X, FileText, Calendar, CheckCircle, Building2, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatEuropeanCurrency, parseEuropeanNumber, formatNumberWhileTyping, formatEuropeanNumber } from "@/lib/number-format";
import { getGeographicInfo, formatGeographicDisplay, getGeographicCodeForSave } from "@shared/utils/geographic-utils";

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

// Helper function to convert FEK data from old string format to new object format
function normalizeFekData(fekValue: any): { year: string; issue: string; number: string } {
  if (!fekValue) return { year: "", issue: "", number: "" };
  
  // If it's already an object with the new format
  if (typeof fekValue === "object" && fekValue.year !== undefined) {
    return {
      year: String(fekValue.year || ""),
      issue: String(fekValue.issue || ""),
      number: String(fekValue.number || "")
    };
  }
  
  // If it's a string (old format), return empty object for now
  // In the future, we could try to parse the string format if needed
  if (typeof fekValue === "string") {
    return { year: "", issue: "", number: "" };
  }
  
  // If it's an array (from JSONB), take the first element if it's an object
  if (Array.isArray(fekValue) && fekValue.length > 0 && typeof fekValue[0] === "object") {
    const obj = fekValue[0];
    return {
      year: String(obj.year || ""),
      issue: String(obj.issue || ""),
      number: String(obj.number || "")
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
  decisions: z.array(z.object({
    protocol_number: z.string().default(""),
    fek: z.object({
      year: z.string().default(""),
      issue: z.string().default(""),
      number: z.string().default(""),
    }).default({ year: "", issue: "", number: "" }),
    ada: z.string().default(""),
    implementing_agency: z.array(z.number()).default([]),
    decision_budget: z.string().default(""),
    expenses_covered: z.string().default(""),
    expenditure_type: z.array(z.number()).default([]),
    decision_type: z.enum(["Έγκριση", "Τροποποίηση", "Παράταση"]).default("Έγκριση"),
    included: z.boolean().default(true),
    comments: z.string().default(""),
  })).default([]),
  
  // Section 2: Event details
  event_details: z.object({
    event_name: z.string().default(""),
    event_year: z.string().default(""),
  }).default({ event_name: "", event_year: "" }),
  
  // Section 2 Location details with cascading dropdowns
  location_details: z.array(z.object({
    implementing_agency: z.string().default(""),
    event_type: z.string().default(""),
    expenditure_types: z.array(z.string()).default([]),
    regions: z.array(z.object({
      region: z.string().default(""),
      regional_unit: z.string().default(""),
      municipality: z.string().default(""),
    })).default([{ region: "", regional_unit: "", municipality: "" }]),
  })).default([]),
  
  // Section 3: Project details
  project_details: z.object({
    mis: z.string().default(""),
    sa: z.string().default(""),
    enumeration_code: z.string().default(""),
    inclusion_year: z.string().default(""),
    project_title: z.string().default(""),
    project_description: z.string().default(""),
    summary_description: z.string().default(""),
    expenses_executed: z.string().default(""),
    project_status: z.string().default("Ενεργό"),
  }).default({ 
    mis: "", sa: "", enumeration_code: "", inclusion_year: "", 
    project_title: "", project_description: "", summary_description: "", 
    expenses_executed: "", project_status: "Ενεργό" 
  }),
  
  // Previous entries for section 3
  previous_entries: z.array(z.object({
    mis: z.string().default(""),
    sa: z.string().default(""),
    enumeration_code: z.string().default(""),
    inclusion_year: z.string().default(""),
    project_title: z.string().default(""),
    project_description: z.string().default(""),
    summary_description: z.string().default(""),
    expenses_executed: z.string().default(""),
    project_status: z.string().default("Ενεργό"),
  })).default([]),
  
  // Section 4: Project formulation details
  formulation_details: z.array(z.object({
    sa: z.enum(["ΝΑ853", "ΝΑ271", "E069"]).default("ΝΑ853"),
    enumeration_code: z.string().default(""),
    protocol_number: z.string().default(""),
    ada: z.string().default(""),
    decision_year: z.string().default(""),
    project_budget: z.string().default(""),
    epa_version: z.string().default(""),
    total_public_expense: z.string().default(""),
    eligible_public_expense: z.string().default(""),
    decision_status: z.enum(["Ενεργή", "Ανενεργή", "Αναστολή"]).default("Ενεργή"),
    change_type: z.enum(["Τροποποίηση", "Παράταση", "Έγκριση"]).default("Έγκριση"),
    connected_decisions: z.array(z.string()).default([]),
    comments: z.string().default(""),
  })).default([]),
  
  // Section 5: Changes performed
  changes: z.array(z.object({
    description: z.string().default(""),
  })).default([]),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

export default function ComprehensiveEditFixed() {
  const { mis } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasPreviousEntries, setHasPreviousEntries] = useState(false);
  const [userInteractedFields, setUserInteractedFields] = useState<Set<string>>(new Set());
  const hasInitialized = useRef(false);
  const [initializationTime, setInitializationTime] = useState<number>(0);
  const [formKey, setFormKey] = useState<number>(0);
  const isInitializingRef = useRef(false);

  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    mode: "onChange",
    defaultValues: {
      decisions: [{ 
        protocol_number: "", 
        fek: { year: "", issue: "", number: "" }, 
        ada: "", 
        implementing_agency: [], 
        decision_budget: "", 
        expenses_covered: "", 
        expenditure_type: [],
        decision_type: "Έγκριση", 
        included: true, 
        comments: "" 
      }],
      event_details: { 
        event_name: "", 
        event_year: "" 
      },
      location_details: [{ 
        implementing_agency: "", 
        event_type: "", 
        expenditure_types: [],
        regions: [{ 
          region: "", 
          regional_unit: "", 
          municipality: "" 
        }]
      }],
      project_details: { 
        mis: "", 
        sa: "", 
        enumeration_code: "", 
        inclusion_year: "", 
        project_title: "", 
        project_description: "", 
        summary_description: "", 
        expenses_executed: "", 
        project_status: "Συμπληρωμένο" 
      },
      previous_entries: [],
      formulation_details: [{ 
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
        comments: "" 
      }],
      changes: [{ description: "" }],
    },
  });

  // PERFORMANCE OPTIMIZATION: Single API call to fetch all project data
  const { 
    data: completeProjectData, 
    isLoading: isCompleteDataLoading, 
    error: completeDataError 
  } = useQuery({
    queryKey: [`/api/projects/${mis}/complete`],
    enabled: !!mis,
    staleTime: 10 * 60 * 1000, // 10 minutes cache for better performance
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention (v5 renamed from cacheTime)
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: false, // Use cached data when available
  });

  // Extract data from unified API response with proper typing
  const projectData = completeProjectData?.project;
  const projectIndexData = completeProjectData?.index;
  const decisionsData = completeProjectData?.decisions;
  const formulationsData = completeProjectData?.formulations;
  const eventTypesData = completeProjectData?.eventTypes;
  const unitsData = completeProjectData?.units;
  const kallikratisData = completeProjectData?.kallikratis;
  const expenditureTypesData = completeProjectData?.expenditureTypes;

  // Debug logging for unified data fetch
  console.log('DEBUG - Complete Project Data:', { 
    hasData: !!completeProjectData,
    projectData: !!projectData,
    decisionsCount: decisionsData?.length || 0,
    formulationsCount: formulationsData?.length || 0,
    isLoading: isCompleteDataLoading,
    error: completeDataError?.message || completeDataError 
  });

  // Reset initialization state when component mounts
  useEffect(() => {
    hasInitialized.current = false;
  }, []);

  // Type-safe data casting
  const typedProjectData = projectData as ProjectData | undefined;
  const typedUnitsData = unitsData as UnitData[] | undefined;
  const typedKallikratisData = kallikratisData as KallikratisEntry[] | undefined;
  const typedEventTypesData = eventTypesData as EventTypeData[] | undefined;
  const typedExpenditureTypesData = expenditureTypesData as ExpenditureTypeData[] | undefined;

  // Helper functions for geographic data
  const getUniqueRegions = () => {
    return [...new Set(typedKallikratisData?.map(k => k.perifereia) || [])].filter(Boolean);
  };

  const getRegionalUnitsForRegion = (region: string) => {
    if (!region) return [];
    return [...new Set(typedKallikratisData
      ?.filter(k => k.perifereia === region)
      .map(k => k.perifereiaki_enotita) || [])].filter(Boolean);
  };

  const getMunicipalitiesForRegionalUnit = (region: string, regionalUnit: string) => {
    if (!region || !regionalUnit) return [];
    return [...new Set(typedKallikratisData
      ?.filter(k => k.perifereia === region && k.perifereiaki_enotita === regionalUnit)
      .map(k => k.onoma_neou_ota) || [])].filter(Boolean);
  };

  // Number formatting helper functions
  const formatNumberWhileTyping = (value: string): string => {
    // Remove all non-numeric characters except comma and period
    const cleanValue = value.replace(/[^0-9,.]/g, '');
    
    // Handle European format (comma as decimal separator)
    if (cleanValue.includes(',')) {
      const parts = cleanValue.split(',');
      if (parts.length === 2) {
        // Add thousand separators to integer part
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${integerPart},${parts[1]}`;
      }
    }
    
    // If no decimal separator, add thousand separators
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parseEuropeanNumber = (value: string): number | null => {
    if (!value) return null;
    
    // Replace thousand separators (periods) and convert comma to period for decimal
    const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  };

  const mutation = useMutation({
    mutationFn: async (data: ComprehensiveFormData) => {
      console.log("=== COMPREHENSIVE FORM SUBMISSION ===");
      console.log("Form data:", data);
      
      try {
        // 1. Update core project data
        const projectUpdateData = {
          project_title: data.project_details.project_title,
          event_description: data.project_details.project_description,
          // Convert event_name to event_type_id if needed
          event_type: (() => {
            if (!data.event_details.event_name) {
              console.log("No event name provided");
              return null;
            }
            
            if (typedEventTypesData) {
              const eventType = typedEventTypesData.find(et => 
                et.name === data.event_details.event_name || 
                et.id.toString() === data.event_details.event_name
              );
              console.log("Event type conversion:", {
                input: data.event_details.event_name,
                found: eventType,
                result: eventType ? eventType.id : null
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
            const formEntry = data.formulation_details.find(f => f.sa === "E069");
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(`Budget E069: "${formEntry.project_budget}" -> ${parsed}`);
              return parsed;
            }
            return typedProjectData?.budget_e069 || null;
          })(),
          budget_na271: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "ΝΑ271");
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(`Budget ΝΑ271: "${formEntry.project_budget}" -> ${parsed}`);
              return parsed;
            }
            return typedProjectData?.budget_na271 || null;
          })(),
          budget_na853: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "ΝΑ853");
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(`Budget ΝΑ853: "${formEntry.project_budget}" -> ${parsed}`);
              return parsed;
            }
            return typedProjectData?.budget_na853 || null;
          })(),
        };
        
        console.log("1. Updating core project data:", projectUpdateData);
        try {
          const projectResponse = await apiRequest(`/api/projects/${mis}`, {
            method: "PATCH",
            body: JSON.stringify(projectUpdateData),
          });
          console.log("✓ Project update successful:", projectResponse);
        } catch (error) {
          console.error("✗ Project update failed:", error);
          throw error;
        }
        
        // 2. Update project decisions in normalized table
        if (data.decisions && data.decisions.length > 0) {
          console.log("2. Updating project decisions:", data.decisions);
          
          // Transform decisions data to match API expectations
          const transformedDecisions = data.decisions.map(decision => ({
            protocol_number: decision.protocol_number || "",
            fek: decision.fek || { year: "", issue: "", number: "" },
            ada: decision.ada || "",
            implementing_agency: Array.isArray(decision.implementing_agency) 
              ? decision.implementing_agency 
              : decision.implementing_agency ? [decision.implementing_agency] : [],
            decision_budget: decision.decision_budget || "",
            expenditure_type: Array.isArray(decision.expenditure_type) 
              ? decision.expenditure_type 
              : decision.expenditure_type ? [decision.expenditure_type] : [],
            decision_type: decision.decision_type || "Έγκριση",
            included: decision.included !== undefined ? decision.included : true,
            comments: decision.comments || "",
          }));
          
          try {
            const decisionsResponse = await apiRequest(`/api/projects/${mis}/decisions`, {
              method: "PUT",
              body: JSON.stringify({ decisions_data: transformedDecisions }),
            });
            console.log("✓ Decisions update successful:", decisionsResponse);
          } catch (error) {
            console.error("✗ Decisions update failed:", error);
            throw error;
          }
        }
        
        // 3. Update project formulations in normalized table
        if (data.formulation_details && data.formulation_details.length > 0) {
          console.log("3. Updating project formulations:", data.formulation_details);
          try {
            const formulationsResponse = await apiRequest(`/api/projects/${mis}/formulations`, {
              method: "PUT",
              body: JSON.stringify({ formulation_details: data.formulation_details }),
            });
            console.log("✓ Formulations update successful:", formulationsResponse);
          } catch (error) {
            console.error("✗ Formulations update failed:", error);
            throw error;
          }
        }
        
        // 4. Update project index (location details) through project PATCH endpoint
        if (data.location_details && data.location_details.length > 0) {
          console.log("4. Processing location details:", data.location_details);
          console.log("4a. Form location_details structure:", JSON.stringify(data.location_details, null, 2));
          
          // Transform location details to project_index format
          const projectLines = [];
          
          for (const location of data.location_details) {
            // Skip empty locations
            if (!location.regions || location.regions.length === 0 || !location.implementing_agency) {
              continue;
            }
            
            // Find implementing agency (monada_id)
            let monadaId = null;
            if (typedUnitsData && location.implementing_agency) {
              const unit = typedUnitsData.find(u => 
                u.name === location.implementing_agency || 
                u.unit_name?.name === location.implementing_agency ||
                u.unit === location.implementing_agency
              );
              if (unit) {
                monadaId = unit.id;
              }
            }
            
            // Find event type ID
            let eventTypeId = null;
            if (typedEventTypesData && location.event_type) {
              const eventType = typedEventTypesData.find(et => et.name === location.event_type);
              if (eventType) {
                eventTypeId = eventType.id;
              }
            }
            
            // Create entries for each region
            for (const region of location.regions) {
              // Skip empty regions
              if (!region.region && !region.regional_unit && !region.municipality) {
                continue;
              }
              
              // Find kallikratis_id and geographic_code
              let kallikratisId = null;
              let geographicCode = null;
              
              if (typedKallikratisData && region.region) {
                const kallikratis = typedKallikratisData.find(k => 
                  k.perifereia === region.region && 
                  (!region.regional_unit || k.perifereiaki_enotita === region.regional_unit) &&
                  (!region.municipality || k.onoma_neou_ota === region.municipality)
                );
                
                if (kallikratis) {
                  kallikratisId = kallikratis.id;
                  // Calculate geographic code based on what data is selected
                  geographicCode = getGeographicCodeForSave(region, kallikratis);
                }
                console.log("Kallikratis lookup:", { region, found: kallikratis, kallikratisId, geographicCode });
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
                  geographic_code: geographicCode
                }
              });
            }
          }
          
          if (projectLines.length > 0) {
            console.log("Updating project index with lines:", projectLines);
            // Include project_lines in the main project update
            projectUpdateData.project_lines = projectLines;
          }
        }
        
        // Update the project again with project_lines if they exist
        if (projectUpdateData.project_lines) {
          console.log("Updating project with location details via PATCH");
          await apiRequest(`/api/projects/${mis}`, {
            method: "PATCH",
            body: JSON.stringify({ project_lines: projectUpdateData.project_lines }),
          });
        }
        
        return { success: true };
        
      } catch (error) {
        console.error("Comprehensive form submission error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({ 
        title: "Επιτυχία", 
        description: "Όλα τα στοιχεία του έργου ενημερώθηκαν επιτυχώς" 
      });
      
      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/index`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/decisions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/formulations`] });
      
      // Stay on the edit page to show updated data
      // Data will refresh automatically due to query invalidation
      console.log("✅ Save successful - staying on edit page with refreshed data");
    },
    onError: (error) => {
      console.error("Form submission failed:", error);
      toast({ 
        title: "Σφάλμα", 
        description: "Παρουσιάστηκε σφάλμα κατά την ενημέρωση. Παρακαλώ προσπαθήστε ξανά.", 
        variant: "destructive" 
      });
    },
  });

  // Data initialization effect
  useEffect(() => {
    console.log('DEBUG - useEffect triggered with conditions:', {
      typedProjectData: !!typedProjectData,
      typedKallikratisData: !!typedKallikratisData, 
      typedUnitsData: !!typedUnitsData,
      typedExpenditureTypesData: !!typedExpenditureTypesData,
      hasInitialized: hasInitialized.current,
      willInitialize: typedProjectData && typedKallikratisData && typedUnitsData && typedExpenditureTypesData && !hasInitialized.current
    });

    if (typedProjectData && typedKallikratisData && typedUnitsData && typedExpenditureTypesData && !hasInitialized.current) {
      console.log('🚀 INITIALIZING FORM with project data:', typedProjectData);
      console.log('Project index data:', projectIndexData);
      
      // Set initialization flag to prevent field clearing during setup
      isInitializingRef.current = true;
      
      // Populate decisions from database or create default
      console.log('DEBUG - Decisions Data for initialization:', {
        decisionsData,
        hasDecisions: decisionsData && decisionsData.length > 0,
        length: decisionsData?.length || 0
      });
      
      const decisions = decisionsData && decisionsData.length > 0 
        ? decisionsData.map(decision => ({
            protocol_number: decision.protocol_number || "",
            fek: normalizeFekData(decision.fek),
            ada: decision.ada || "",
            implementing_agency: decision.implementing_agency || [],
            decision_budget: decision.decision_budget ? formatEuropeanNumber(decision.decision_budget) : "",
            expenditure_type: decision.expenditure_type || [],
            decision_type: decision.decision_type || "Έγκριση" as const,
            included: decision.included ?? decision.is_included ?? true,
            comments: decision.comments || "",
          }))
        : [{
            protocol_number: "",
            fek: { year: "", issue: "", number: "" },
            ada: "",
            implementing_agency: [],
            decision_budget: "",
            expenditure_type: [],
            decision_type: "Έγκριση" as const,
            included: true,
            comments: "",
          }];

      console.log('DEBUG - Final decisions array:', decisions);
      
      // Populate formulation details from database or create default from project data
      const formulations = formulationsData && formulationsData.length > 0
        ? formulationsData.map(formulation => {
            // Convert connected_decision_ids from database to form format
            let connectedDecisions: string[] = [];
            if (formulation.connected_decision_ids && Array.isArray(formulation.connected_decision_ids)) {
              // Map decision IDs back to form indices by finding them in decisionsData
              console.log(`[ConnectedDecisions] Processing for formulation ${formulation.sa_type}:`, {
                connected_decision_ids: formulation.connected_decision_ids,
                decisionsData_available: !!decisionsData,
                decisionsData_length: decisionsData?.length || 0,
                available_decision_ids: decisionsData?.map(d => d.id) || []
              });
              
              connectedDecisions = formulation.connected_decision_ids
                .map((decisionId: number) => {
                  const decisionIndex = decisionsData?.findIndex((d: any) => d.id === decisionId);
                  console.log(`[ConnectedDecisions] Mapping ID ${decisionId} to index ${decisionIndex}`);
                  return decisionIndex !== -1 && decisionIndex !== undefined ? String(decisionIndex) : null;
                })
                .filter((index: string | null) => index !== null) as string[];
            }
            
            console.log(`[FormulationInit] Formulation ${formulation.sa_type}:`, {
              connected_decision_ids: formulation.connected_decision_ids,
              mapped_to_indices: connectedDecisions,
              decisions_available: decisionsData?.length || 0,
              final_connected_decisions: connectedDecisions
            });

            return {
              sa: formulation.sa_type || "ΝΑ853" as const,
              enumeration_code: formulation.enumeration_code || "",
              protocol_number: formulation.protocol_number || "",
              ada: formulation.ada || formulation.ada_reference || "",
              decision_year: String(formulation.decision_year || formulation.year || ""),
              project_budget: formulation.project_budget ? formatEuropeanNumber(formulation.project_budget) : "",
              epa_version: formulation.epa_version || "",
              total_public_expense: formulation.total_public_expense ? String(formulation.total_public_expense) : "",
              eligible_public_expense: formulation.eligible_public_expense ? String(formulation.eligible_public_expense) : "",
              decision_status: formulation.decision_status || formulation.status || "Ενεργή" as const,
              change_type: formulation.change_type || "Έγκριση" as const,
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
              decision_year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
              project_budget: typedProjectData.budget_na853 ? formatEuropeanNumber(typedProjectData.budget_na853) : "",
              epa_version: "",
              total_public_expense: "",
              eligible_public_expense: "",
              decision_status: "Ενεργή" as const,
              change_type: "Έγκριση" as const,
              connected_decisions: [],
              comments: "",
            },
            // NA271 entry if exists
            ...(typedProjectData.na271 ? [{
              sa: "ΝΑ271" as const,
              enumeration_code: typedProjectData.na271,
              protocol_number: "",
              ada: "",
              decision_year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
              project_budget: typedProjectData.budget_na271 ? formatEuropeanNumber(typedProjectData.budget_na271) : "",
              epa_version: "",
              total_public_expense: "",
              eligible_public_expense: "",
              decision_status: "Ενεργή" as const,
              change_type: "Έγκριση" as const,
              connected_decisions: [],
              comments: "",
            }] : []),
            // E069 entry if exists
            ...(typedProjectData.e069 ? [{
              sa: "E069" as const,
              enumeration_code: typedProjectData.e069,
              protocol_number: "",
              ada: "",
              decision_year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
              project_budget: typedProjectData.budget_e069 ? formatEuropeanNumber(typedProjectData.budget_e069) : "",
              epa_version: "",
              total_public_expense: "",
              eligible_public_expense: "",
              decision_status: "Ενεργή" as const,
              change_type: "Έγκριση" as const,
              connected_decisions: [],
              comments: "",
            }] : [])
          ];

      // Use reset to properly initialize all form values
      console.log('🔥 RESETTING FORM WITH DECISIONS:', decisions);
      
      const formData = {
        decisions,
        event_details: {
          event_name: typedProjectData.enhanced_event_type?.name || "",
          event_year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
        },
        project_details: {
          mis: typedProjectData.mis?.toString() || "",
          sa: [typedProjectData.na853, typedProjectData.na271, typedProjectData.e069].filter(Boolean).join(", ") || "",
          enumeration_code: typedProjectData.enumeration_code || "",
          inclusion_year: "",
          project_title: typedProjectData.project_title || "",
          project_description: typedProjectData.event_description || "",
          summary_description: "",
          expenses_executed: "",
          project_status: typedProjectData.status || "Ενεργό"
        },
        formulation_details: formulations,
        location_details: (() => {
          if (projectIndexData && Array.isArray(projectIndexData) && projectIndexData.length > 0) {
            const locationDetailsMap = new Map();
            
            projectIndexData.forEach(indexEntry => {
              const kallikratisData = indexEntry.kallikratis_data;
              const expenditureType = indexEntry.expenditure_type;
              const unit = indexEntry.unit;
              const eventType = indexEntry.event_type;
              
              if (kallikratisData) {
                const geoInfo = getGeographicInfo(kallikratisData.geographic_code);
                console.log('DEBUG Geographic Code Analysis:', {
                  geographicCode: kallikratisData.geographic_code,
                  geoInfo,
                  kallikratisFound: !!kallikratisData,
                  kallikratisData: {
                    region: kallikratisData.region,
                    regionalUnit: kallikratisData.regionalUnit,
                    municipality: kallikratisData.municipality
                  }
                });

                // For null values from database, try to get from enhanced project data
                const implementingAgencyValue = unit?.unit || typedProjectData.enhanced_unit?.unit || "";
                const eventTypeValue = eventType?.name || typedProjectData.enhanced_event_type?.name || "";
                
                // Create a key based on implementing agency and event type
                const key = `${implementingAgencyValue}-${eventTypeValue}`;
                
                if (!locationDetailsMap.has(key)) {
                  const locationDetail = {
                    implementing_agency: implementingAgencyValue,
                    event_type: eventTypeValue,
                    expenditure_types: [] as string[],
                    regions: [] as Array<{
                      region: string;
                      regional_unit: string;
                      municipality: string;
                    }>
                  };
                  
                  locationDetailsMap.set(key, locationDetail);
                }
                
                const locationDetail = locationDetailsMap.get(key);
                
                // Add region if it doesn't exist
                const regionKey = `${kallikratisData.region}-${kallikratisData.regionalUnit}-${kallikratisData.municipality}`;
                const existingRegion = locationDetail.regions.find(r => 
                  r.region === kallikratisData.region && 
                  r.regional_unit === kallikratisData.regionalUnit && 
                  r.municipality === kallikratisData.municipality
                );
                
                if (!existingRegion) {
                  locationDetail.regions.push({
                    region: kallikratisData.region || "",
                    regional_unit: kallikratisData.regionalUnit || "",
                    municipality: kallikratisData.municipality || ""
                  });
                }
                
                // Add expenditure type if it exists
                if (expenditureType && expenditureType.expenditure_types) {
                  if (!locationDetail.expenditure_types.includes(expenditureType.expenditure_types)) {
                    locationDetail.expenditure_types.push(expenditureType.expenditure_types);
                  }
                }
              }
            });
            
            const locationDetailsArray = Array.from(locationDetailsMap.values());
            console.log('DEBUG Final locationDetailsArray:', locationDetailsArray);
            return locationDetailsArray.length > 0 ? locationDetailsArray : [{
              implementing_agency: typedProjectData.enhanced_unit?.name || "",
              event_type: "",
              expenditure_types: [],
              regions: [{
                region: "",
                regional_unit: "",
                municipality: ""
              }]
            }];
          }
          
          // Default location detail if no project index data
          return [{
            implementing_agency: typedProjectData.enhanced_unit?.name || "",
            event_type: "",
            expenditure_types: [],
            regions: [{
              region: "",
              regional_unit: "",
              municipality: ""
            }]
          }];
        })(),
        previous_entries: [],
        changes: []
      };
      
      // Set each field individually to force component updates
      console.log('🔥 SETTING FORM VALUES INDIVIDUALLY:');
      form.setValue("decisions", formData.decisions, { shouldValidate: true, shouldDirty: true });
      form.setValue("formulation_details", formData.formulation_details, { shouldValidate: true, shouldDirty: true });
      form.setValue("location_details", formData.location_details, { shouldValidate: true, shouldDirty: true });
      form.setValue("previous_entries", formData.previous_entries, { shouldValidate: true, shouldDirty: true });
      form.setValue("changes", formData.changes, { shouldValidate: true, shouldDirty: true });
      
      // Force form re-render and validation
      form.trigger();
      
      // Force component re-render by updating key
      setFormKey(prev => prev + 1);
      
      // Verify the values were set
      setTimeout(() => {
        const currentDecisions = form.getValues("decisions");
        console.log('🔍 FORM VALUES AFTER INDIVIDUAL SET:', currentDecisions);
      }, 100);
      form.setValue("event_details", {
        event_name: typedProjectData.enhanced_event_type?.name || "",
        event_year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
      });
      

      form.setValue("project_details", {
        mis: String(typedProjectData.mis || ""),
        sa: "",
        enumeration_code: "",
        inclusion_year: "",
        project_title: typedProjectData.project_title || "",
        project_description: typedProjectData.event_description || "",
        summary_description: "",
        expenses_executed: "",
        project_status: typedProjectData.status || "Ενεργό",
      });
      form.setValue("formulation_details", formulations);
      
      // Populate location details from project index data OR create fallback from project data
      const locationDetailsArray = (() => {
          if (projectIndexData && projectIndexData.length > 0) {
            const locationDetailsMap = new Map();
            
            // Group by implementing agency and event type
            projectIndexData.forEach(indexItem => {
              const kallikratis = typedKallikratisData.find(k => k.id === indexItem.kallikratis_id);
              const unit = typedUnitsData.find(u => u.id === indexItem.monada_id);
              const eventType = typedEventTypesData.find(et => et.id === indexItem.event_types_id);
              const expenditureType = typedExpenditureTypesData.find(et => et.id === indexItem.expenditure_type_id);
              
              const key = `${indexItem.monada_id || 'no-unit'}-${indexItem.event_types_id || 'no-event'}`;
              
              if (!locationDetailsMap.has(key)) {
                let locationDetail = {
                  implementing_agency: unit?.unit || unit?.name || unit?.unit_name?.name || "",
                  event_type: eventType?.name || "",
                  expenditure_types: [],
                  regions: []
                };
                
                locationDetailsMap.set(key, locationDetail);
              }
              
              const locationDetail = locationDetailsMap.get(key);
              
              // Add region if it doesn't exist
              if (kallikratis) {
                const existingRegion = locationDetail.regions.find(r => 
                  r.region === kallikratis.perifereia && 
                  r.regional_unit === kallikratis.perifereiaki_enotita && 
                  r.municipality === kallikratis.onoma_neou_ota
                );
                
                if (!existingRegion) {
                  locationDetail.regions.push({
                    region: kallikratis.perifereia || "",
                    regional_unit: kallikratis.perifereiaki_enotita || "",
                    municipality: kallikratis.onoma_neou_ota || ""
                  });
                }
              }
              
              // Add expenditure type if it exists
              if (expenditureType && expenditureType.expenditure_types) {
                if (!locationDetail.expenditure_types.includes(expenditureType.expenditure_types)) {
                  locationDetail.expenditure_types.push(expenditureType.expenditure_types);
                }
              }
            });
            
            const locationDetailsArray = Array.from(locationDetailsMap.values());
            console.log('DEBUG Final locationDetailsArray:', locationDetailsArray);
            return locationDetailsArray.length > 0 ? locationDetailsArray : [{
              implementing_agency: typedProjectData.enhanced_unit?.name || "",
              event_type: "",
              expenditure_types: [],
              regions: [{
                region: "",
                regional_unit: "",
                municipality: ""
              }]
            }];
          }
          
          // Default location detail if no project index data
          console.log('DEBUG - Creating fallback location entry for project without project_index data');
          
          // Try to get implementing agency from various sources
          const implementingAgency = typedProjectData.enhanced_unit?.name || 
                                   typedProjectData.enhanced_unit?.unit ||
                                   (typedUnitsData && typedUnitsData.length > 0 ? typedUnitsData[0].unit : "") ||
                                   "ΔΑΕΦΚ-ΚΕ";
          
          console.log('DEBUG - Fallback implementing agency:', implementingAgency);
          
          return [{
            implementing_agency: implementingAgency,
            event_type: "",
            expenditure_types: [],
            regions: [{
              region: "",
              regional_unit: "",
              municipality: ""
            }]
          }];
        })();
        
        
        console.log("🔥 SETTING LOCATION DETAILS:", locationDetailsArray);
        form.setValue("location_details", locationDetailsArray);
        console.log("🔍 FORM location_details AFTER SET:", form.getValues("location_details"));
        
      form.setValue("changes", []);
      hasInitialized.current = true;
      setInitializationTime(Date.now());
      
      // Clear initialization flag after a delay to allow form to settle
      setTimeout(() => {
        isInitializingRef.current = false;
        console.log('Form initialization complete - field clearing protection disabled');
      }, 3000);
    }
  }, [mis, typedProjectData, typedKallikratisData, typedUnitsData, typedExpenditureTypesData]);

  const isLoading = isCompleteDataLoading;
  const isDataReady = typedProjectData && typedEventTypesData && typedUnitsData && typedKallikratisData && typedExpenditureTypesData;

  if (completeDataError) {
    return <div className="container mx-auto p-6">Σφάλμα κατά τη φόρτωση των δεδομένων</div>;
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
                  <div className={`w-2 h-2 rounded-full ${typedProjectData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Στοιχεία έργου {typedProjectData ? '✓' : '...'}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${typedUnitsData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Φορείς υλοποίησης {typedUnitsData ? '✓' : '...'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isDataReady) {
    return <div className="container mx-auto p-6">Αναμονή για φόρτωση δεδομένων...</div>;
  }

  const handleSubmit = (data: ComprehensiveFormData) => {
    console.log("=== FORM SUBMISSION DEBUG ===");
    console.log("✓ handleSubmit called - form is valid");
    console.log("Form data:", data);
    console.log("Form errors:", form.formState.errors);
    console.log("Form is valid:", form.formState.isValid);
    console.log("Mutation pending:", mutation.isPending);
    
    mutation.mutate(data);
  };

  // Debug all fetched data
  console.log("DEBUG - Kallikratis data sample:", typedKallikratisData?.slice(0, 3));
  console.log("DEBUG - Total kallikratis entries:", typedKallikratisData?.length);
  console.log("DEBUG - Units data:", typedUnitsData?.length, "units total");
  console.log("DEBUG - All units:", typedUnitsData?.map(u => `${u.id}: ${u.unit}`));
  console.log("DEBUG - Event types data:", typedEventTypesData?.length || 0, "total items", typedEventTypesData?.slice(0, 3));
  console.log("DEBUG - Expenditure types data:", typedExpenditureTypesData?.length || 0, "total items", typedExpenditureTypesData?.slice(0, 3));

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
              <span className="text-sm">{typedProjectData?.status || "Ενεργό"}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(`/projects/${mis}`)}>
              Επιστροφή στο Έργο
            </Button>
            <Button 
              onClick={form.handleSubmit(handleSubmit)}
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="decisions" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="decisions" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Αποφάσεις
                </TabsTrigger>
                <TabsTrigger value="event-location" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Γεγονός & Τοποθεσία
                </TabsTrigger>
                <TabsTrigger value="project" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Στοιχεία Έργου
                </TabsTrigger>
                <TabsTrigger value="formulation" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Διατύπωση
                </TabsTrigger>
                <TabsTrigger value="changes" className="flex items-center gap-2">
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
                      <div key={index} className="border rounded-lg p-4 space-y-4">
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
                                  <Input {...field} placeholder="π.χ. 12345/2024" />
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
                                  <Input {...field} placeholder="π.χ. ΩΔΨΚ4653Π6-ΓΞΤ" />
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
                                      const formatted = formatNumberWhileTyping(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Τύπος Απόφασης</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Επιλέξτε τύπο" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                    <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                    <SelectItem value="Παράταση">Παράταση</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`decisions.${index}.comments`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Σχόλια</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Προαιρετικά σχόλια..." />
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε γεγονός" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {typedEventTypesData?.map((eventType) => (
                                  <SelectItem key={eventType.id} value={eventType.name}>
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
                      {form.watch("location_details").map((_, locationIndex) => (
                        <div key={locationIndex} className="border rounded-lg p-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">Τοποθεσία {locationIndex + 1}</h4>
                            {form.watch("location_details").length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const locations = form.getValues("location_details");
                                  locations.splice(locationIndex, 1);
                                  form.setValue("location_details", locations);
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
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε μονάδα" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {typedUnitsData?.map((unit) => (
                                        <SelectItem key={unit.id} value={unit.unit_name?.name || unit.name || unit.unit || ""}>
                                          {unit.unit_name?.name || unit.name || unit.unit}
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
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε τύπο" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {typedEventTypesData?.map((eventType) => (
                                        <SelectItem key={eventType.id} value={eventType.name}>
                                          {eventType.name}
                                        </SelectItem>
                                      ))}
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
                              {typedExpenditureTypesData?.map((expenditureType) => (
                                <FormField
                                  key={expenditureType.id}
                                  control={form.control}
                                  name={`location_details.${locationIndex}.expenditure_types`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(expenditureType.expenditure_types || expenditureType.name || "")}
                                          onCheckedChange={(checked) => {
                                            const expenditureName = expenditureType.expenditure_types || expenditureType.name || "";
                                            if (checked) {
                                              field.onChange([...(field.value || []), expenditureName]);
                                            } else {
                                              field.onChange((field.value || []).filter((item: string) => item !== expenditureName));
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {expenditureType.expenditure_types || expenditureType.name}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Regions */}
                          <div className="space-y-4">
                            <FormLabel>Περιοχές</FormLabel>
                            {form.watch(`location_details.${locationIndex}.regions`).map((_, regionIndex) => (
                              <div key={regionIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border rounded">
                                <FormField
                                  control={form.control}
                                  name={`location_details.${locationIndex}.regions.${regionIndex}.region`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Περιφέρεια</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Επιλέξτε περιφέρεια" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {getUniqueRegions().map((region) => (
                                            <SelectItem key={region} value={region}>
                                              {region}
                                            </SelectItem>
                                          ))}
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
                                      <FormLabel>Περιφερειακή Ενότητα</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Επιλέξτε ενότητα" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {getRegionalUnitsForRegion(form.watch(`location_details.${locationIndex}.regions.${regionIndex}.region`)).map((unit) => (
                                            <SelectItem key={unit} value={unit}>
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
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Επιλέξτε δήμο" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {getMunicipalitiesForRegionalUnit(
                                            form.watch(`location_details.${locationIndex}.regions.${regionIndex}.region`),
                                            form.watch(`location_details.${locationIndex}.regions.${regionIndex}.regional_unit`)
                                          ).map((municipality) => (
                                            <SelectItem key={municipality} value={municipality}>
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
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const locations = form.getValues("location_details");
                          locations.push({
                            implementing_agency: "",
                            event_type: "",
                            expenditure_types: [],
                            regions: [{ region: "", regional_unit: "", municipality: "" }],
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
                            <FormControl>
                              <Input {...field} placeholder="π.χ. ΝΑ853" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.enumeration_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Κωδικός Απαρίθμησης</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="π.χ. 2023ΕΠ00100001" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="project_details.inclusion_year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Έτος Ένταξης</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="π.χ. 2024" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.project_status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Κατάσταση Έργου</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Ενεργό">Ενεργό</SelectItem>
                                <SelectItem value="Αναμονή">Αναμονή</SelectItem>
                                <SelectItem value="Ολοκληρωμένο">Ολοκληρωμένο</SelectItem>
                                <SelectItem value="Ακυρωμένο">Ακυρωμένο</SelectItem>
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
                            <Input {...field} placeholder="Εισάγετε τον τίτλο του έργου..." />
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
                            <Textarea {...field} placeholder="Εισάγετε αναλυτική περιγραφή του έργου..." rows={4} />
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
                            <Textarea {...field} placeholder="Εισάγετε συνοπτική περιγραφή..." rows={2} />
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
                                const formatted = formatNumberWhileTyping(e.target.value);
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
                      <div key={index} className="border rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Διατύπωση {index + 1}</h4>
                          {form.watch("formulation_details").length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const formulations = form.getValues("formulation_details");
                                formulations.splice(index, 1);
                                form.setValue("formulation_details", formulations);
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Επιλέξτε ΣΑ" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="ΝΑ853">ΝΑ853</SelectItem>
                                    <SelectItem value="ΝΑ271">ΝΑ271</SelectItem>
                                    <SelectItem value="E069">E069</SelectItem>
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
                                  <Input {...field} placeholder="π.χ. 2023ΕΠ00100001" />
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
                                  <Input {...field} placeholder="π.χ. 12345/2024" />
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
                                  <Input {...field} placeholder="π.χ. ΩΔΨΚ4653Π6-ΓΞΤ" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                      const formatted = formatNumberWhileTyping(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

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
                                      const formatted = formatNumberWhileTyping(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.eligible_public_expense`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Επιλέξιμη Δημόσια Δαπάνη</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="π.χ. 750.000,00" 
                                    onChange={(e) => {
                                      const formatted = formatNumberWhileTyping(e.target.value);
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
                            name={`formulation_details.${index}.decision_status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Κατάσταση Απόφασης</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Ενεργή">Ενεργή</SelectItem>
                                    <SelectItem value="Ανενεργή">Ανενεργή</SelectItem>
                                    <SelectItem value="Αναστολή">Αναστολή</SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Επιλέξτε τύπο" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                    <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                    <SelectItem value="Παράταση">Παράταση</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`formulation_details.${index}.comments`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Σχόλια</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Προαιρετικά σχόλια..." />
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
                        const formulations = form.getValues("formulation_details");
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

            {/* Tab 5: Changes */}
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
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium">Αλλαγή {index + 1}</h4>
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
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <FormField
                          control={form.control}
                          name={`changes.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Περιγραφή Αλλαγής</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Περιγράψτε την αλλαγή που πραγματοποιήθηκε..." rows={3} />
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
                        changes.push({ description: "" });
                        form.setValue("changes", changes);
                      }}
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
};
