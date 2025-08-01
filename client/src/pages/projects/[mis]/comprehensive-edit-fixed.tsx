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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Διαχείριση Έργου: {typedProjectData?.project_title}
          </h1>
          <div className="flex items-center gap-4 text-gray-600">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">MIS: {typedProjectData?.mis}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">{typedProjectData?.status || "Ενεργό"}</span>
            </div>
          </div>
        </div>

        <Form key={formKey} {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white shadow-lg border-0 h-14 rounded-xl">
                <TabsTrigger 
                  value="summary" 
                  className="text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Σύνοψη
                </TabsTrigger>
                <TabsTrigger 
                  value="edit"
                  className="text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Επεξεργασία
                </TabsTrigger>
              </TabsList>
            
            <TabsContent value="summary" className="space-y-8">
              <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="py-6 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <FileText className="h-6 w-6" />
                    </div>
                    Σύνοψη Έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                        <h3 className="text-base font-bold text-blue-800 mb-4 flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Βασικά Στοιχεία
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">MIS:</span> 
                            <span className="font-bold text-blue-600">{typedProjectData?.mis}</span>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <span className="font-medium text-gray-600 block mb-1">Τίτλος:</span> 
                            <span className="text-gray-800">{typedProjectData?.project_title}</span>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <span className="font-medium text-gray-600 block mb-1">Περιγραφή:</span> 
                            <span className="text-gray-800">{typedProjectData?.event_description}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">Κατάσταση:</span> 
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">{typedProjectData?.status}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                        <h3 className="text-base font-bold text-purple-800 mb-4 flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Κωδικοί ΣΑ
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">ΝΑ853:</span> 
                            <span className="font-mono text-purple-600">{typedProjectData?.na853 || "Μη διαθέσιμο"}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">ΝΑ271:</span> 
                            <span className="font-mono text-purple-600">{typedProjectData?.na271 || "Μη διαθέσιμο"}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">E069:</span> 
                            <span className="font-mono text-purple-600">{typedProjectData?.e069 || "Μη διαθέσιμο"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                        <h3 className="text-base font-bold text-green-800 mb-4 flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Προϋπολογισμοί
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">Προϋπ. ΝΑ853:</span> 
                            <span className="font-bold text-green-600">{typedProjectData?.budget_na853 ? formatEuropeanCurrency(typedProjectData.budget_na853) : "Μη διαθέσιμο"}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">Προϋπ. ΝΑ271:</span> 
                            <span className="font-bold text-green-600">{typedProjectData?.budget_na271 ? formatEuropeanCurrency(typedProjectData.budget_na271) : "Μη διαθέσιμο"}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                            <span className="font-medium text-gray-600">Προϋπ. E069:</span> 
                            <span className="font-bold text-green-600">{typedProjectData?.budget_e069 ? formatEuropeanCurrency(typedProjectData.budget_e069) : "Μη διαθέσιμο"}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-100">
                        <h3 className="text-base font-bold text-orange-800 mb-4 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          Συνδέσεις
                        </h3>
                        <div className="space-y-3">
                          <div className="p-3 bg-white rounded-lg">
                            <span className="font-medium text-gray-600 block mb-1">Τύπος Συμβάντος:</span> 
                            <span className="text-orange-600 font-medium">{typedProjectData?.enhanced_event_type?.name || "Μη διαθέσιμο"}</span>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <span className="font-medium text-gray-600 block mb-1">Φορέας Υλοποίησης:</span> 
                            <span className="text-orange-600 font-medium">{typedProjectData?.enhanced_unit?.name || "Μη διαθέσιμο"}</span>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <span className="font-medium text-gray-600 block mb-1">Τύπος Δαπάνης:</span> 
                            <span className="text-orange-600 font-medium">{typedProjectData?.enhanced_expenditure_type?.name || "Μη διαθέσιμο"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="edit" className="space-y-8">
              {/* Combined Section 2&3: Event & Project Details */}
              <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="py-6 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Calendar className="h-6 w-6" />
                    </div>
                    1. Στοιχεία Συμβάντος & Έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Event Details Column */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-600 mb-3 pb-2 border-b">Στοιχεία Συμβάντος</h3>
                      <FormField
                        control={form.control}
                        name="event_details.event_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τύπος Συμβάντος</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε τύπο συμβάντος" />
                                </SelectTrigger>
                                <SelectContent>
                                  {typedEventTypesData?.map((eventType) => (
                                    <SelectItem key={eventType.id} value={eventType.name}>
                                      {eventType.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="event_details.event_year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Έτος Συμβάντος</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="π.χ. 2024" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Project Details Column */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-600 mb-3 pb-2 border-b">Στοιχεία Έργου</h3>
                      <FormField
                        control={form.control}
                        name="project_details.project_title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τίτλος Έργου</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Τίτλος έργου" />
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
                              <Textarea {...field} placeholder="Περιγραφή έργου" rows={3} />
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
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Ενεργό">Ενεργό</SelectItem>
                                  <SelectItem value="Ολοκληρωμένο">Ολοκληρωμένο</SelectItem>
                                  <SelectItem value="Αναστολή">Αναστολή</SelectItem>
                                  <SelectItem value="Ακυρωμένο">Ακυρωμένο</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: Location Details */}
              <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="py-6 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Building2 className="h-6 w-6" />
                    </div>
                    2. Διαχείριση Τοποθεσιών & Φορέων
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {(() => {
                      const locationDetails = form.watch("location_details");
                      console.log("🔍 RENDER LOCATION DETAILS:", locationDetails);
                      return locationDetails?.map((location, index) => {
                      // Ensure regions array exists
                      if (!location.regions || !Array.isArray(location.regions)) {
                        location.regions = [{
                          region: location.region || "",
                          regional_unit: location.regional_unit || "",
                          municipality: location.municipality || ""
                        }];
                      }
                      
                      return (
                      <div key={index} className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-sm text-gray-700">Τοποθεσία {index + 1}</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentLocations = form.getValues("location_details");
                              form.setValue("location_details", currentLocations.filter((_, i) => i !== index));
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Αφαίρεση Τοποθεσίας
                          </Button>
                        </div>

                        {/* Regions Section */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <FormLabel className="text-sm font-medium">Περιοχές</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentLocations = form.getValues("location_details");
                                const updatedLocations = [...currentLocations];
                                if (!updatedLocations[index].regions) {
                                  updatedLocations[index].regions = [];
                                }
                                updatedLocations[index].regions.push({
                                  region: "",
                                  regional_unit: "",
                                  municipality: ""
                                });
                                form.setValue("location_details", updatedLocations);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Προσθήκη Περιοχής
                            </Button>
                          </div>
                          
                          {location.regions?.map((region, regionIndex) => {
                            const regionFieldName = `location_details.${index}.regions.${regionIndex}`;
                            return (
                              <div key={regionIndex} className="grid grid-cols-4 gap-4 p-3 bg-gray-50 rounded-md">
                                <FormField
                                  control={form.control}
                                  name={`${regionFieldName}.region`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">Περιφέρεια</FormLabel>
                                      <FormControl>
                                        <Select
                                          onValueChange={(value) => {
                                            field.onChange(value);
                                            // Reset dependent fields when region changes
                                            form.setValue(`${regionFieldName}.regional_unit`, "");
                                            form.setValue(`${regionFieldName}.municipality`, "");
                                          }} 
                                          value={field.value || ""}
                                        >
                                          <SelectTrigger className="text-sm">
                                            <SelectValue placeholder="Επιλέξτε περιφέρεια" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(() => {
                                              const regions = [...new Set(typedKallikratisData?.map(k => k.perifereia) || [])].filter(Boolean);
                                              return regions.map((region) => (
                                                <SelectItem key={region} value={region}>{region}</SelectItem>
                                              ));
                                            })()}
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name={`${regionFieldName}.regional_unit`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">Περιφερειακή Ενότητα</FormLabel>
                                      <FormControl>
                                        <Select 
                                          onValueChange={(value) => {
                                            field.onChange(value);
                                            // Reset municipality when regional unit changes
                                            form.setValue(`${regionFieldName}.municipality`, "");
                                          }} 
                                          value={field.value || ""}
                                          disabled={!form.watch(`${regionFieldName}.region`)}
                                        >
                                          <SelectTrigger className="text-sm">
                                            <SelectValue placeholder="Επιλέξτε περιφερειακή ενότητα" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(() => {
                                              const currentRegion = form.watch(`${regionFieldName}.region`);
                                              const regionalUnits = [...new Set(typedKallikratisData
                                                ?.filter(k => k.perifereia === currentRegion)
                                                .map(k => k.perifereiaki_enotita) || [])].filter(Boolean);
                                              return regionalUnits.map((unit) => (
                                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                              ));
                                            })()}
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name={`${regionFieldName}.municipality`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">Δήμος</FormLabel>
                                      <FormControl>
                                        <Select 
                                          onValueChange={field.onChange} 
                                          value={field.value || ""}
                                          disabled={!form.watch(`${regionFieldName}.regional_unit`)}
                                        >
                                          <SelectTrigger className="text-sm">
                                            <SelectValue placeholder="Επιλέξτε δήμο" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(() => {
                                              const currentRegion = form.watch(`${regionFieldName}.region`);
                                              const currentUnit = form.watch(`${regionFieldName}.regional_unit`);
                                              const municipalities = [...new Set(typedKallikratisData
                                                ?.filter(k => k.perifereia === currentRegion && k.perifereiaki_enotita === currentUnit)
                                                .map(k => k.onoma_neou_ota) || [])].filter(Boolean);
                                              return municipalities.map((municipality) => (
                                                <SelectItem key={municipality} value={municipality}>{municipality}</SelectItem>
                                              ));
                                            })()}
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentLocations = form.getValues("location_details");
                                    const updatedLocations = [...currentLocations];
                                    updatedLocations[index].regions = updatedLocations[index].regions?.filter((_, i) => i !== regionIndex) || [];
                                    form.setValue("location_details", updatedLocations);
                                  }}
                                  className="text-red-600 hover:text-red-700 self-start mt-6"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Αφαίρεση
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Implementing Agency and Expenditure Types */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`location_details.${index}.implementing_agency`}
                            render={({ field }) => {
                              console.log(`🔍 [Field ${index}] implementing_agency field value:`, field.value);
                              return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Φορέας Υλοποίησης</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value || ""}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Επιλέξτε φορέα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {typedUnitsData?.map((unit) => (
                                        <SelectItem key={unit.id} value={unit.unit || unit.name || unit.unit_name?.name || ""}>
                                          {unit.unit || unit.name || unit.unit_name?.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                              );
                            }}
                          />
                          <FormField
                            control={form.control}
                            name={`location_details.${index}.expenditure_types`}
                            render={({ field }) => {
                              console.log(`🔍 [Field ${index}] expenditure_types field value:`, field.value);
                              return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Τύπος Δαπάνης</FormLabel>
                                <FormControl>
                                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                                    {typedExpenditureTypesData?.map((expenditureType) => {
                                      const expenditureName = expenditureType.expenditure_types || expenditureType.name;
                                      const isChecked = field.value?.includes(expenditureName) || false;
                                      console.log(`🔍 [Field ${index}] Checking expenditure:`, {expenditureName, isChecked, fieldValue: field.value});
                                      return (
                                      <div key={expenditureType.id} className="flex items-center space-x-2 py-1">
                                        <input
                                          type="checkbox"
                                          id={`expenditure-type-${index}-${expenditureType.id}`}
                                          checked={isChecked}
                                          onChange={(e) => {
                                            const currentValue = field.value || [];
                                            if (e.target.checked) {
                                              field.onChange([...currentValue, expenditureName]);
                                            } else {
                                              field.onChange(currentValue.filter(name => name !== expenditureName));
                                            }
                                          }}
                                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                        />
                                        <label 
                                          htmlFor={`expenditure-type-${index}-${expenditureType.id}`}
                                          className="text-sm cursor-pointer flex-1"
                                        >
                                          {expenditureType.expenditure_types || expenditureType.name}
                                        </label>
                                      </div>
                                      );
                                    })}
                                  </div>
                                </FormControl>
                              </FormItem>
                              );
                            }}
                          />
                        </div>
                      </div>
                      );
                      });
                    })()}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentLocations = form.getValues("location_details");
                        form.setValue("location_details", [
                          ...currentLocations,
                          {
                            implementing_agency: "",
                            event_type: "",
                            expenditure_types: [],
                            regions: [{ region: "", regional_unit: "", municipality: "" }]
                          }
                        ]);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Προσθήκη Τοποθεσίας
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: Formulation Details */}
              <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="py-6 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-600 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <FileText className="h-6 w-6" />
                    </div>
                    3. Στοιχεία κατάρτισης έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {(() => {
                      const formulations = form.watch("formulation_details");
                      const hasFormulations = formulations && formulations.length > 0 && formulations.some(f => 
                        f.sa || f.enumeration_code || f.protocol_number || f.ada || f.project_budget
                      );
                      
                      if (!hasFormulations) {
                        return (
                          <div className="text-center py-12 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                            <div className="flex flex-col items-center space-y-4">
                              <div className="p-4 bg-amber-100 rounded-full">
                                <FileText className="h-8 w-8 text-amber-600" />
                              </div>
                              <p className="text-gray-600 font-medium">Δεν υπάρχουν στοιχεία κατάρτισης για αυτό το έργο</p>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  form.setValue("formulation_details", [
                                    { 
                                      sa: "ΝΑ853" as const, 
                                      enumeration_code: "", 
                                      protocol_number: "", 
                                      ada: "", 
                                      decision_year: "", 
                                      project_budget: "", 
                                      epa_version: "", 
                                      total_public_expense: "", 
                                      eligible_public_expense: "", 
                                      decision_status: "Ενεργή" as const, 
                                      change_type: "Έγκριση" as const, 
                                      connected_decisions: [], 
                                      comments: "" 
                                    }
                                  ]);
                                }}
                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Προσθήκη Πρώτου Στοιχείου Κατάρτισης
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      
                      return formulations.map((_, index) => (
                      <div key={index} className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Στοιχεία κατάρτισης #{index + 1}</span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 px-2"
                            onClick={async () => {
                              console.log(`🗑️ Deleting formulation at index ${index}`);
                              const currentFormulations = form.getValues("formulation_details");
                              console.log(`🗑️ Current formulations before delete:`, currentFormulations);
                              console.log(`🗑️ Formulation being deleted:`, currentFormulations[index]);
                              
                              const updatedFormulations = currentFormulations.filter((_, i) => i !== index);
                              console.log(`🗑️ Updated formulations after delete:`, updatedFormulations);
                              
                              form.setValue("formulation_details", updatedFormulations, { 
                                shouldDirty: true, 
                                shouldTouch: true,
                                shouldValidate: true 
                              });
                              
                              // Immediately save the updated formulations to the database
                              try {
                                console.log(`🗑️ Immediately updating database with remaining formulations`);
                                
                                await apiRequest(`/api/projects/${mis}/formulations`, {
                                  method: "PUT",
                                  body: JSON.stringify({ formulation_details: updatedFormulations }),
                                });
                                
                                console.log(`🗑️ ✅ Successfully deleted formulation from database`);
                                toast({
                                  title: "Επιτυχία",
                                  description: "Το στοιχείο κατάρτισης διαγράφηκε επιτυχώς",
                                });
                              } catch (error) {
                                console.error(`🗑️ ❌ Failed to delete formulation from database:`, error);
                                toast({
                                  title: "Σφάλμα",
                                  description: "Αποτυχία διαγραφής στοιχείου κατάρτισης",
                                  variant: "destructive",
                                });
                                // Revert the form state if database update failed
                                form.setValue("formulation_details", currentFormulations);
                              }
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Αφαίρεση
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.sa`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">ΣΑ</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-xs">
                                      <SelectValue placeholder="ΣΑ" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ΝΑ853">ΝΑ853</SelectItem>
                                      <SelectItem value="ΝΑ271">ΝΑ271</SelectItem>
                                      <SelectItem value="E069">E069</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.enumeration_code`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Κωδικός ενάριθμος</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Κωδικός" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Αρ. Πρωτοκόλλου</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Πρωτόκολλο" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.project_budget`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Προϋπολογισμός έργου</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="0,00 €" 
                                    className="text-sm"
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
                            name={`formulation_details.${index}.ada`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">ΑΔΑ</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ΑΔΑ" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.decision_status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Κατάσταση</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Κατάσταση" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Ενεργή">Ενεργή</SelectItem>
                                      <SelectItem value="Ανενεργή">Ανενεργή</SelectItem>
                                      <SelectItem value="Αναστολή">Αναστολή</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.change_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Είδος Αλλαγής</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Είδος" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                      <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                      <SelectItem value="Ακύρωση">Ακύρωση</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="col-span-full">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.connected_decisions`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Αποφάσεις που συνδέονται</FormLabel>
                                <FormControl>
                                  <Select 
                                    onValueChange={(value) => {
                                      const currentArray = Array.isArray(field.value) ? field.value : [];
                                      if (!currentArray.includes(value)) {
                                        field.onChange([...currentArray, value]);
                                      }
                                    }} 
                                    value=""
                                  >
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε απόφαση" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {form.watch("decisions").map((decision, decisionIndex) => (
                                        <SelectItem key={decisionIndex} value={`${decisionIndex}`}>
                                          {decision.protocol_number || `Απόφαση ${decisionIndex + 1}`}
                                          {decision.fek?.year && ` - ΦΕΚ: ${decision.fek.year}/${decision.fek.issue}/${decision.fek.number}`}
                                          {decision.ada && ` - ΑΔΑ: ${decision.ada}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <div className="mt-2">
                                  {Array.isArray(field.value) && field.value.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {field.value.map((decisionIndex, i) => {
                                        const decisionData = form.watch("decisions")[parseInt(decisionIndex)];
                                        return (
                                          <div key={i} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                            <span>
                                              {decisionData?.protocol_number || `Απόφαση ${parseInt(decisionIndex) + 1}`}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newArray = field.value.filter((_, index) => index !== i);
                                                field.onChange(newArray);
                                              }}
                                              className="text-blue-600 hover:text-blue-800"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="col-span-full">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.comments`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Σχόλια</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Σχόλια" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      ));
                    })()}
                    
                    {/* Add Formulation Button - only show when there are existing formulations */}
                    {(() => {
                      const formulations = form.watch("formulation_details");
                      const hasFormulations = formulations && formulations.length > 0 && formulations.some(f => 
                        f.sa || f.enumeration_code || f.protocol_number || f.ada || f.project_budget
                      );
                      
                      if (hasFormulations) {
                        return (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentFormulations = form.getValues("formulation_details");
                                form.setValue("formulation_details", [
                                  ...currentFormulations,
                                  { 
                                    sa: "ΝΑ853" as const, 
                                    enumeration_code: "", 
                                    protocol_number: "", 
                                    ada: "", 
                                    decision_year: "", 
                                    project_budget: "", 
                                    epa_version: "", 
                                    total_public_expense: "", 
                                    eligible_public_expense: "", 
                                    decision_status: "Ενεργή" as const, 
                                    change_type: "Έγκριση" as const, 
                                    connected_decisions: [], 
                                    comments: "" 
                                  }
                                ]);
                              }}
                              className="text-sm"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Προσθήκη Στοιχείου
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Section 1: Decisions */}
              <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="py-6 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <FileText className="h-6 w-6" />
                    </div>
                    4. Αποφάσεις που τεκμηριώνουν το έργο
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6" key={`decisions-container-${initializationTime}`}>
                    {/* Decisions List */}
                    {(() => {
                      const decisions = form.watch("decisions");
                      const hasDecisions = decisions && decisions.length > 0 && decisions.some(d => 
                        d.protocol_number || d.ada || d.decision_budget || 
                        (d.implementing_agency && d.implementing_agency.length > 0) ||
                        (d.expenditure_type && d.expenditure_type.length > 0)
                      );
                      
                      if (!hasDecisions) {
                        return (
                          <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                            <div className="flex flex-col items-center space-y-4">
                              <div className="p-4 bg-purple-100 rounded-full">
                                <FileText className="h-8 w-8 text-purple-600" />
                              </div>
                              <p className="text-gray-600 font-medium">Δεν υπάρχουν αποφάσεις για αυτό το έργο</p>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  form.setValue("decisions", [
                                    { protocol_number: "", fek: { year: "", issue: "", number: "" }, ada: "", implementing_agency: [], decision_budget: "", expenses_covered: "", expenditure_type: [], decision_type: "Έγκριση" as const, included: true, comments: "" }
                                  ]);
                                }}
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Προσθήκη Πρώτης Απόφασης
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      
                      return decisions.map((decision, index) => (
                      <div key={`decision-${index}-${decision.protocol_number || 'empty'}`} className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Απόφαση #{index + 1}</span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 px-2"
                            onClick={async () => {
                              console.log(`🗑️ Deleting decision at index ${index}`);
                              const currentDecisions = form.getValues("decisions");
                              console.log(`🗑️ Current decisions before delete:`, currentDecisions);
                              console.log(`🗑️ Decision being deleted:`, currentDecisions[index]);
                              
                              const updatedDecisions = currentDecisions.filter((_, i) => i !== index);
                              console.log(`🗑️ Updated decisions after delete:`, updatedDecisions);
                              
                              form.setValue("decisions", updatedDecisions, { 
                                shouldDirty: true, 
                                shouldTouch: true,
                                shouldValidate: true 
                              });
                              
                              // Immediately save the updated decisions to the database
                              try {
                                console.log(`🗑️ Immediately updating database with remaining decisions`);
                                const transformedDecisions = updatedDecisions.map(decision => ({
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
                                
                                await apiRequest(`/api/projects/${mis}/decisions`, {
                                  method: "PUT",
                                  body: JSON.stringify({ decisions_data: transformedDecisions }),
                                });
                                
                                console.log(`🗑️ ✅ Successfully deleted decision from database`);
                                toast({
                                  title: "Επιτυχία",
                                  description: "Η απόφαση διαγράφηκε επιτυχώς",
                                });
                              } catch (error) {
                                console.error(`🗑️ ❌ Failed to delete decision from database:`, error);
                                toast({
                                  title: "Σφάλμα",
                                  description: "Αποτυχία διαγραφής απόφασης",
                                  variant: "destructive",
                                });
                                // Revert the form state if database update failed
                                form.setValue("decisions", currentDecisions);
                              }
                              
                              // Force a re-render by triggering the watch
                              setTimeout(() => {
                                const finalDecisions = form.getValues("decisions");
                                console.log(`🗑️ Final decisions after setValue:`, finalDecisions);
                              }, 50);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Αφαίρεση
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Αρ. πρωτ. Απόφασης</FormLabel>
                                <FormControl>
                                  <Input {...field} className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <FormLabel className="text-xs">ΦΕΚ</FormLabel>
                            <div className="grid grid-cols-3 gap-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.fek.year`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="text-xs">
                                          <SelectValue placeholder="Έτος" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-48 overflow-y-auto">
                                          {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => {
                                            const year = (new Date().getFullYear() - i).toString();
                                            return (
                                              <SelectItem key={year} value={year}>
                                                {year}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.fek.issue`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="text-xs">
                                          <SelectValue placeholder="Τεύχος" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Α">Α</SelectItem>
                                          <SelectItem value="Β">Β</SelectItem>
                                          <SelectItem value="Γ">Γ</SelectItem>
                                          <SelectItem value="Δ">Δ</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.fek.number`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="Αριθμός" 
                                        className="text-xs" 
                                        type="text"
                                        maxLength={6}
                                        onChange={(e) => {
                                          // Only allow numbers and limit to 6 digits
                                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                          field.onChange(value);
                                        }}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.ada`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">ΑΔΑ</FormLabel>
                                <FormControl>
                                  <Input {...field} className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.implementing_agency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Φορέας υλοποίησης</FormLabel>
                                <FormControl>
                                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                                    {typedUnitsData?.map((unit) => (
                                      <div key={unit.id} className="flex items-center space-x-2 py-1">
                                        <input
                                          type="checkbox"
                                          id={`implementing-agency-${index}-${unit.id}`}
                                          checked={field.value?.includes(unit.id) || false}
                                          onChange={(e) => {
                                            const currentValue = field.value || [];
                                            if (e.target.checked) {
                                              field.onChange([...currentValue, unit.id]);
                                            } else {
                                              field.onChange(currentValue.filter(id => id !== unit.id));
                                            }
                                          }}
                                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                        />
                                        <label 
                                          htmlFor={`implementing-agency-${index}-${unit.id}`}
                                          className="text-sm cursor-pointer flex-1"
                                        >
                                          {unit.unit || unit.name || unit.unit_name?.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_budget`}
                            render={({ field }) => {
                              const [displayValue, setDisplayValue] = useState(() => {
                                if (!field.value) return '';
                                // If it's already a formatted string, use it as is
                                if (typeof field.value === 'string') return field.value;
                                // If it's a number, format it
                                return formatEuropeanNumber(field.value, 2);
                              });

                              const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                                const formatted = formatNumberWhileTyping(e.target.value);
                                setDisplayValue(formatted);
                                
                                // Store the formatted string for form submission
                                field.onChange(formatted);
                              };

                              const handleBlur = () => {
                                // Format the display value when user finishes typing
                                if (displayValue) {
                                  const numericValue = parseEuropeanNumber(displayValue);
                                  if (!isNaN(numericValue)) {
                                    setDisplayValue(formatEuropeanNumber(numericValue, 2));
                                  }
                                }
                              };

                              return (
                                <FormItem>
                                  <FormLabel className="text-xs">Προϋπολογισμός Απόφασης</FormLabel>
                                  <FormControl>
                                    <Input 
                                      className="text-sm"
                                      placeholder="0,00 €"
                                      value={displayValue}
                                      onChange={handleInputChange}
                                      onBlur={handleBlur}
                                    />
                                  </FormControl>
                                </FormItem>
                              );
                            }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.expenditure_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Δαπάνες που αφορά</FormLabel>
                                <FormControl>
                                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                                    {typedExpenditureTypesData?.map((expenditureType) => (
                                      <div key={expenditureType.id} className="flex items-center space-x-2 py-1">
                                        <input
                                          type="checkbox"
                                          id={`expenditure-type-${index}-${expenditureType.id}`}
                                          checked={field.value?.includes(expenditureType.id) || false}
                                          onChange={(e) => {
                                            const currentValue = field.value || [];
                                            if (e.target.checked) {
                                              field.onChange([...currentValue, expenditureType.id]);
                                            } else {
                                              field.onChange(currentValue.filter(id => id !== expenditureType.id));
                                            }
                                          }}
                                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                        />
                                        <label 
                                          htmlFor={`expenditure-type-${index}-${expenditureType.id}`}
                                          className="text-sm cursor-pointer flex-1"
                                        >
                                          {expenditureType.expenditure_types || expenditureType.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Είδος Απόφασης</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε είδος" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                      <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                      <SelectItem value="Ανάκληση">Ανάκληση</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.comments`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Σχόλια</FormLabel>
                                <FormControl>
                                  <Input {...field} className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name={`decisions.${index}.included`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Έχει συμπεριληφθεί</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      ));
                    })()}
                    
                    {/* Add Decision Button - only show when there are existing decisions */}
                    {(() => {
                      const decisions = form.watch("decisions");
                      const hasDecisions = decisions && decisions.length > 0 && decisions.some(d => 
                        d.protocol_number || d.ada || d.decision_budget || 
                        (d.implementing_agency && d.implementing_agency.length > 0) ||
                        (d.expenditure_type && d.expenditure_type.length > 0)
                      );
                      
                      if (hasDecisions) {
                        return (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentDecisions = form.getValues("decisions");
                                form.setValue("decisions", [
                                  ...currentDecisions,
                                  { protocol_number: "", fek: { year: "", issue: "", number: "" }, ada: "", implementing_agency: [], decision_budget: "", expenses_covered: "", expenditure_type: [], decision_type: "Έγκριση" as const, included: true, comments: "" }
                                ]);
                              }}
                              className="text-sm"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Προσθήκη Απόφασης
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex gap-6 pt-8 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/projects/${mis}`)}
                  disabled={mutation.isPending}
                  className="px-8 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-800 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Ακύρωση
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  onClick={() => {
                    console.log("=== SUBMIT BUTTON CLICKED ===");
                    console.log("Form state:", {
                      isValid: form.formState.isValid,
                      errors: form.formState.errors,
                      isDirty: form.formState.isDirty,
                      isSubmitting: form.formState.isSubmitting
                    });
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  {mutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Αποθήκευση...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Αποθήκευση Αλλαγών
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
      </div>
    </div>
  );
};
