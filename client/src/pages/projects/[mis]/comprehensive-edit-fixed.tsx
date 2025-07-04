import React, { useState, useEffect } from "react";
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
  name: string;
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
    fek: z.string().default(""),
    ada: z.string().default(""),
    implementing_agency: z.string().default(""),
    decision_budget: z.string().default(""),
    expenses_covered: z.union([z.string(), z.number()]).transform(val => String(val)).default(""),
    decision_type: z.enum(["Έγκριση", "Τροποποίηση", "Παράταση"]).default("Έγκριση"),
    is_included: z.boolean().default(true),
    comments: z.string().default(""),
  })).default([]),
  
  // Section 2: Event details
  event_details: z.object({
    event_name: z.string().default(""),
    event_year: z.string().default(""),
  }).default({ event_name: "", event_year: "" }),
  
  // Section 2 Location details with cascading dropdowns
  location_details: z.array(z.object({
    municipality: z.string().default(""),
    regional_unit: z.string().default(""),
    region: z.string().default(""),
    implementing_agency: z.string().default(""),
    event_type: z.string().default(""),
    expenditure_types: z.array(z.string()).default([]),
    geographic_level: z.number().optional(),
    geographic_code: z.union([z.string(), z.number()]).optional(),
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

  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    mode: "onChange",
    defaultValues: {
      decisions: [{ 
        protocol_number: "", 
        fek: "", 
        ada: "", 
        implementing_agency: "", 
        decision_budget: "", 
        expenses_covered: "", 
        decision_type: "Έγκριση", 
        is_included: true, 
        comments: "" 
      }],
      event_details: { 
        event_name: "", 
        event_year: "" 
      },
      location_details: [{ 
        municipality: "", 
        regional_unit: "", 
        region: "", 
        implementing_agency: "", 
        event_type: "", 
        expenditure_types: [],
        geographic_level: undefined,
        geographic_code: undefined
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

  // Use optimized parallel fetching - project data + combined reference data
  const queries = useQueries({
    queries: [
      // Project-specific data (dependent on MIS)
      {
        queryKey: [`/api/projects/${mis}`],
        enabled: !!mis,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
      },
      {
        queryKey: [`/api/projects/${mis}/index`],
        enabled: !!mis,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: [`/api/projects/${mis}/decisions`],
        enabled: !!mis,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: [`/api/projects/${mis}/formulations`],
        enabled: !!mis,
        staleTime: 5 * 60 * 1000,
      },
      // Individual reference data endpoints (fallback for reliability)
      {
        queryKey: ["/api/event-types"],
        staleTime: 30 * 60 * 1000, // 30 minutes cache for reference data
      },
      {
        queryKey: ["/api/public/units"],
        staleTime: 30 * 60 * 1000,
      },
      {
        queryKey: ["/api/kallikratis"],
        staleTime: 30 * 60 * 1000,
      },
      {
        queryKey: ["/api/expenditure-types"],
        staleTime: 30 * 60 * 1000,
      },
    ],
  });

  // Extract data from parallel queries with proper typing
  const [
    { data: projectData, isLoading: projectLoading, error: projectError },
    { data: projectIndexData },
    { data: decisionsData },
    { data: formulationsData },
    { data: eventTypesData, isLoading: eventTypesLoading },
    { data: unitsData, isLoading: unitsLoading },
    { data: kallikratisData, isLoading: kallikratisLoading },
    { data: expenditureTypesData, isLoading: expenditureTypesLoading },
  ] = queries;

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
          event_type: data.event_details.event_name,
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
          try {
            const decisionsResponse = await apiRequest(`/api/projects/${mis}/decisions`, {
              method: "PUT",
              body: JSON.stringify({ decisions_data: data.decisions }),
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
          
          // Transform location details to project_index format
          const projectLines = [];
          
          for (const location of data.location_details) {
            // Skip empty locations
            if (!location.region && !location.regional_unit && !location.municipality && !location.implementing_agency) {
              continue;
            }
            
            // Find kallikratis_id and geographic_code
            let kallikratisId = null;
            let geographicCode = null;
            
            if (typedKallikratisData && location.region) {
              const kallikratis = typedKallikratisData.find(k => 
                k.perifereia === location.region && 
                (!location.regional_unit || k.perifereiaki_enotita === location.regional_unit) &&
                (!location.municipality || k.onoma_neou_ota === location.municipality)
              );
              
              if (kallikratis) {
                kallikratisId = kallikratis.id;
                // Calculate geographic code based on what data is selected
                geographicCode = getGeographicCodeForSave(location, kallikratis);
              }
              console.log("Kallikratis lookup:", { location, found: kallikratis, kallikratisId, geographicCode });
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
            
            // Create single entry with all expenditure types for this location
            projectLines.push({
              implementing_agency: location.implementing_agency,
              implementing_agency_id: monadaId,
              event_type: location.event_type,
              event_type_id: eventTypeId,
              expenditure_types: location.expenditure_types || [],
              region: {
                perifereia: location.region,
                perifereiaki_enotita: location.regional_unit,
                dimos: location.municipality,
                kallikratis_id: kallikratisId,
                geographic_code: geographicCode
              }
            });
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
    if (typedProjectData && typedKallikratisData && typedUnitsData && typedExpenditureTypesData) {
      console.log('Initializing form with project data:', typedProjectData);
      console.log('Project index data:', projectIndexData);
      
      // Populate decisions from database or create default
      const decisions = decisionsData && decisionsData.length > 0 
        ? decisionsData.map(decision => ({
            protocol_number: decision.protocol_number || "",
            fek: decision.fek || "",
            ada: decision.ada || "",
            implementing_agency: decision.implementing_agency || typedProjectData.enhanced_unit?.name || "",
            decision_budget: decision.decision_budget ? String(decision.decision_budget) : "",
            expenses_covered: decision.expenses_covered || "",
            decision_type: decision.decision_type || "Έγκριση" as const,
            is_included: decision.is_included ?? true,
            comments: decision.comments || "",
          }))
        : [{
            protocol_number: "",
            fek: "",
            ada: "",
            implementing_agency: typedProjectData.enhanced_unit?.name || "",
            decision_budget: "",
            expenses_covered: "",
            decision_type: "Έγκριση" as const,
            is_included: true,
            comments: "",
          }];
      
      // Populate formulation details from database or create default from project data
      const formulations = formulationsData && formulationsData.length > 0
        ? formulationsData.map(formulation => ({
            sa: formulation.sa || "ΝΑ853" as const,
            enumeration_code: formulation.enumeration_code || "",
            protocol_number: formulation.protocol_number || "",
            ada_reference: formulation.ada_reference || "",
            status: formulation.status || "Συμπληρωμένο" as const,
            year: formulation.year || "",
            epa_version: formulation.epa_version || "",
            expenses: formulation.expenses || "",
            changes: formulation.changes || "",
            connected_decisions: formulation.connected_decisions || [],
            comments: formulation.comments || "",
            project_budget: formulation.project_budget || "",
          }))
        : [
            // NA853 entry
            {
              sa: "ΝΑ853" as const,
              enumeration_code: typedProjectData.na853 || "",
              protocol_number: "",
              ada_reference: "",
              status: "Συμπληρωμένο" as const,
              year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
              epa_version: "",
              expenses: "",
              changes: "",
              connected_decisions: [],
              comments: "",
              project_budget: typedProjectData.budget_na853 ? formatEuropeanNumber(typedProjectData.budget_na853) : "",
            },
            // NA271 entry if exists
            ...(typedProjectData.na271 ? [{
              sa: "ΝΑ271" as const,
              enumeration_code: typedProjectData.na271,
              protocol_number: "",
              ada_reference: "",
              status: "Συμπληρωμένο" as const,
              year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
              epa_version: "",
              expenses: "",
              changes: "",
              connected_decisions: [],
              comments: "",
              project_budget: typedProjectData.budget_na271 ? formatEuropeanNumber(typedProjectData.budget_na271) : "",
            }] : []),
            // E069 entry if exists
            ...(typedProjectData.e069 ? [{
              sa: "E069" as const,
              enumeration_code: typedProjectData.e069,
              protocol_number: "",
              ada_reference: "",
              status: "Συμπληρωμένο" as const,
              year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
              epa_version: "",
              expenses: "",
              changes: "",
              connected_decisions: [],
              comments: "",
              project_budget: typedProjectData.budget_e069 ? formatEuropeanNumber(typedProjectData.budget_e069) : "",
            }] : [])
          ];

      // Use setValue instead of reset to maintain controlled components
      form.setValue("decisions", decisions);
      form.setValue("event_details", {
        event_name: typedProjectData.enhanced_event_type?.name || "",
        event_year: Array.isArray(typedProjectData.event_year) ? typedProjectData.event_year[0] : typedProjectData.event_year?.toString() || "",
      });
      form.setValue("project_details", {
        project_title: typedProjectData.project_title || "",
        project_description: typedProjectData.event_description || "",
        project_status: typedProjectData.status || "Ενεργό",
      });
      form.setValue("formulation_details", formulations);
      form.setValue("location_details", (() => {
          // Populate location details from project index data
          if (projectIndexData && projectIndexData.length > 0) {
            const locationDetailsMap = new Map();
            
            // Group by kallikratis and implementing agency
            projectIndexData.forEach(indexItem => {
              const kallikratis = typedKallikratisData.find(k => k.id === indexItem.kallikratis_id);
              const unit = typedUnitsData.find(u => u.id === indexItem.unit_id);
              const expenditureType = typedExpenditureTypesData.find(et => et.id === indexItem.expenditure_type_id);
              
              const key = `${indexItem.kallikratis_id || 'no-location'}-${indexItem.unit_id || 'no-unit'}`;
              
              if (!locationDetailsMap.has(key)) {
                // Get event type from project index data  
                const eventType = typedEventTypesData.find(et => et.id === indexItem.event_type_id);
                
                // Use geographic code logic to determine what to display
                const geographicCode = indexItem.geographic_code;
                const geoInfo = getGeographicInfo(geographicCode);
                
                console.log(`DEBUG Geographic Code Analysis:`, {
                  geographicCode,
                  geoInfo,
                  kallikratisFound: !!kallikratis,
                  kallikratisData: kallikratis ? {
                    region: kallikratis.perifereia,
                    regionalUnit: kallikratis.perifereiaki_enotita,
                    municipality: kallikratis.onoma_neou_ota
                  } : null
                });
                
                let locationDetail = {
                  municipality: "",
                  regional_unit: "", 
                  region: "",
                  implementing_agency: unit?.name || unit?.unit_name?.name || unit?.unit || "",
                  event_type: eventType?.name || "",
                  expenditure_types: [],
                  geographic_code: geographicCode
                };
                
                // Populate fields based on geographic level
                if (geoInfo && kallikratis) {
                  locationDetail.region = kallikratis.perifereia || "";
                  console.log(`Setting region: ${locationDetail.region}`);
                  
                  if (geoInfo.level === 'municipality' || geoInfo.level === 'regional_unit') {
                    locationDetail.regional_unit = kallikratis.perifereiaki_enotita || "";
                    console.log(`Setting regional_unit: ${locationDetail.regional_unit}`);
                  }
                  
                  if (geoInfo.level === 'municipality') {
                    locationDetail.municipality = kallikratis.onoma_neou_ota || "";
                    console.log(`Setting municipality: ${locationDetail.municipality}`);
                  }
                } else {
                  console.log(`Using fallback population - geoInfo:`, geoInfo, `kallikratis:`, !!kallikratis);
                  // Fallback: populate all fields to avoid controlled/uncontrolled warnings
                  locationDetail.municipality = kallikratis?.onoma_neou_ota || "";
                  locationDetail.regional_unit = kallikratis?.perifereiaki_enotita || "";
                  locationDetail.region = kallikratis?.perifereia || "";
                }
                
                console.log(`Final locationDetail:`, locationDetail);
                locationDetailsMap.set(key, locationDetail);
              }
              
              // Add expenditure type if it exists
              if (expenditureType && expenditureType.expediture_types) {
                const locationDetail = locationDetailsMap.get(key);
                if (!locationDetail.expenditure_types.includes(expenditureType.expediture_types)) {
                  locationDetail.expenditure_types.push(expenditureType.expediture_types);
                }
              }
            });
            
            const locationDetailsArray = Array.from(locationDetailsMap.values());
            return locationDetailsArray.length > 0 ? locationDetailsArray : [{
              municipality: "",
              regional_unit: "",
              region: "",
              implementing_agency: typedProjectData.enhanced_unit?.name || "",
              event_type: "",
              expenditure_types: [],
              geographic_level: undefined,
              geographic_code: undefined
            }];
          }
          
          // Default location detail if no project index data
          return [{
            municipality: "",
            regional_unit: "",
            region: "",
            implementing_agency: typedProjectData.enhanced_unit?.name || "",
            event_type: "",
            expenditure_types: [],
            geographic_level: undefined,
            geographic_code: undefined
          }];
        })());
      form.setValue("changes", []);
    }
  }, [typedProjectData, projectIndexData, decisionsData, formulationsData, typedKallikratisData, typedUnitsData, typedExpenditureTypesData, form]);

  const isLoading = projectLoading || eventTypesLoading || unitsLoading || kallikratisLoading || expenditureTypesLoading;
  const isDataReady = typedProjectData && typedEventTypesData && typedUnitsData && typedKallikratisData && typedExpenditureTypesData;

  if (projectError) {
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
  console.log("DEBUG - Event types data:", typedEventTypesData?.slice(0, 2));
  console.log("DEBUG - Expenditure types data:", typedExpenditureTypesData?.slice(0, 2));

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Διαχείριση Έργου: {typedProjectData?.project_title}</h1>
        <p className="text-gray-600">MIS: {typedProjectData?.mis}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary">Σύνοψη</TabsTrigger>
              <TabsTrigger value="edit">Επεξεργασία</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Σύνοψη Έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">Βασικά Στοιχεία</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">MIS:</span> {typedProjectData?.mis}</div>
                          <div><span className="font-medium">Τίτλος:</span> {typedProjectData?.project_title}</div>
                          <div><span className="font-medium">Περιγραφή:</span> {typedProjectData?.event_description}</div>
                          <div><span className="font-medium">Κατάσταση:</span> {typedProjectData?.status}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">Κωδικοί ΣΑ</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">ΝΑ853:</span> {typedProjectData?.na853 || "Μη διαθέσιμο"}</div>
                          <div><span className="font-medium">ΝΑ271:</span> {typedProjectData?.na271 || "Μη διαθέσιμο"}</div>
                          <div><span className="font-medium">E069:</span> {typedProjectData?.e069 || "Μη διαθέσιμο"}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">Προϋπολογισμοί</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Προϋπ. ΝΑ853:</span> {typedProjectData?.budget_na853 ? formatEuropeanCurrency(typedProjectData.budget_na853) : "Μη διαθέσιμο"}</div>
                          <div><span className="font-medium">Προϋπ. ΝΑ271:</span> {typedProjectData?.budget_na271 ? formatEuropeanCurrency(typedProjectData.budget_na271) : "Μη διαθέσιμο"}</div>
                          <div><span className="font-medium">Προϋπ. E069:</span> {typedProjectData?.budget_e069 ? formatEuropeanCurrency(typedProjectData.budget_e069) : "Μη διαθέσιμο"}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">Συνδέσεις</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Τύπος Συμβάντος:</span> {typedProjectData?.enhanced_event_type?.name || "Μη διαθέσιμο"}</div>
                          <div><span className="font-medium">Φορέας Υλοποίησης:</span> {typedProjectData?.enhanced_unit?.name || "Μη διαθέσιμο"}</div>
                          <div><span className="font-medium">Τύπος Δαπάνης:</span> {typedProjectData?.enhanced_expenditure_type?.name || "Μη διαθέσιμο"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="edit" className="space-y-6">
              {/* Section 1: Decisions */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    1. Αποφάσεις που τεκμηριώνουν το έργο
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 p-2 bg-gray-50 rounded-lg font-medium text-xs">
                      <div className="col-span-1 text-center">α.α.</div>
                      <div className="col-span-1 text-center">Αρ. πρωτ. Απόφασης</div>
                      <div className="col-span-1 text-center">ΦΕΚ</div>
                      <div className="col-span-1 text-center">ΑΔΑ</div>
                      <div className="col-span-2 text-center">Φορέας υλοποίησης</div>
                      <div className="col-span-1 text-center">Προϋπολογισμός Απόφασης</div>
                      <div className="col-span-1 text-center">Δαπάνες που αφορά</div>
                      <div className="col-span-1 text-center">Είδος Απόφασης</div>
                      <div className="col-span-1 text-center">Έχει συμπεριληφθεί</div>
                      <div className="col-span-2 text-center">Σχόλια</div>
                    </div>

                    {/* Table Rows */}
                    {form.watch("decisions").map((_, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 p-2 border rounded-lg">
                        <div className="col-span-1 flex items-center justify-center">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="Αρ. πρωτ." className="text-xs h-8" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.fek`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="ΦΕΚ" className="text-xs h-8" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.ada`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="ΑΔΑ" className="text-xs h-8" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.implementing_agency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue placeholder="Φορέας" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {typedUnitsData?.map((unit) => (
                                        <SelectItem key={unit.id} value={unit.name || unit.unit_name?.name || unit.unit || ""}>
                                          {unit.name || unit.unit_name?.name || unit.unit}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_budget`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="Προϋπ." className="text-xs h-8" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.expenses_covered`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="Δαπάνες" className="text-xs h-8" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue placeholder="Είδος" />
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
                        </div>
                        <div className="col-span-1">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.is_included`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={field.value}
                                      onChange={(e) => field.onChange(e.target.checked)}
                                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                    />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.comments`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="Σχόλια" className="text-xs h-8" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentDecisions = form.getValues("decisions");
                          form.setValue("decisions", [
                            ...currentDecisions,
                            { protocol_number: "", fek: "", ada: "", implementing_agency: "", decision_budget: "", expenses_covered: "", decision_type: "Έγκριση" as const, is_included: true, comments: "" }
                          ]);
                        }}
                        className="text-sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Προσθήκη Απόφασης
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Event Details */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    2. Στοιχεία Συμβάντος
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 gap-4">
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
                </CardContent>
              </Card>

              {/* Section 3: Project Details */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    3. Στοιχεία Έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 gap-4">
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
                </CardContent>
              </Card>

              {/* Section 4: Formulation Details */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    4. Στοιχεία κατάρτισης έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {form.watch("formulation_details").map((_, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg text-sm">
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.sa`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">ΣΑ</FormLabel>
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
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.enumeration_code`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Κωδικός ενάριθμος</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Κωδικός" className="text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.project_budget`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Προϋπολογισμός έργου</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="0,00 €" 
                                    className="text-xs"
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
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Αρ. Πρωτοκόλλου</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Πρωτόκολλο" className="text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.ada_reference`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">ΑΔΑ</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ΑΔΑ" className="text-xs" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Κατάσταση</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-xs">
                                      <SelectValue placeholder="Κατάσταση" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Συμπληρωμένο">Συμπληρωμένο</SelectItem>
                                      <SelectItem value="Συνεχιζόμενο">Συνεχιζόμενο</SelectItem>
                                      <SelectItem value="Ολοκληρωμένο">Ολοκληρωμένο</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentFormulations = form.getValues("formulation_details");
                          form.setValue("formulation_details", [
                            ...currentFormulations,
                            { sa: "ΝΑ853" as const, enumeration_code: "", project_budget: "", protocol_number: "", ada_reference: "", status: "Συμπληρωμένο" as const, year: "", epa_version: "", expenses: "", changes: "", connected_decisions: "", comments: "" }
                          ]);
                        }}
                        className="text-sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Προσθήκη Στοιχείου
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: Location Details */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    5. Διαχείριση Τοποθεσιών & Φορέων
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {form.watch("location_details").map((location, index) => {
                      // Get geographic level from geographic code
                      const geoInfo = getGeographicInfo(location.geographic_code);
                      const shouldShowRegion = true; // Always show region
                      const shouldShowRegionalUnit = !geoInfo || geoInfo.level === 'municipality' || geoInfo.level === 'regional_unit';
                      const shouldShowMunicipality = !geoInfo || geoInfo.level === 'municipality';
                      
                      return (
                      <div key={index} className="p-4 border rounded-lg space-y-4">

                        <div className="grid grid-cols-4 gap-4">
                          {shouldShowRegion && (
                            <FormField
                              control={form.control}
                              name={`location_details.${index}.region`}
                              render={({ field }) => {
                                console.log(`Region field debug - Index ${index}:`, {
                                  fieldValue: field.value,
                                  formValue: form.getValues(`location_details.${index}.region`),
                                  locationDetail: location
                                });
                                return (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Περιφέρεια</FormLabel>
                                  <FormControl>
                                    <Select 
                                      key={`region-${index}-${field.value || 'empty'}`}
                                      onValueChange={(value) => {
                                        const fieldKey = `location_details.${index}.region`;
                                        field.onChange(value);
                                        
                                        // Only reset dependent fields if user has interacted with this field
                                        if (userInteractedFields.has(fieldKey)) {
                                          const currentRegionalUnit = form.getValues(`location_details.${index}.regional_unit`);
                                          const currentMunicipality = form.getValues(`location_details.${index}.municipality`);
                                          
                                          // Check if current regional unit belongs to the new region
                                          const validRegionalUnits = typedKallikratisData?.filter(k => k.perifereia === value).map(k => k.perifereiaki_enotita) || [];
                                          if (!validRegionalUnits.includes(currentRegionalUnit)) {
                                            form.setValue(`location_details.${index}.regional_unit`, "");
                                            form.setValue(`location_details.${index}.municipality`, "");
                                          }
                                        } else {
                                          // Mark this field as interacted for future changes
                                          setUserInteractedFields(prev => new Set(prev).add(fieldKey));
                                        }
                                      }} 
                                      value={field.value || ""}
                                      defaultValue={field.value || ""}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Επιλέξτε περιφέρεια" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(() => {
                                          const regions = [...new Set(typedKallikratisData?.map(k => k.perifereia) || [])].filter(Boolean);
                                          console.log(`Region options for field value "${field.value}":`, regions.includes(field.value), regions);
                                          return regions.map((region, regionIndex) => (
                                            <SelectItem key={`region-${index}-${regionIndex}-${region}`} value={region}>{region}</SelectItem>
                                          ));
                                        })()}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              );
                              }}
                            />
                          )}
                          {shouldShowRegionalUnit && (
                            <FormField
                              control={form.control}
                              name={`location_details.${index}.regional_unit`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Περιφερειακή Ενότητα</FormLabel>
                                  <FormControl>
                                    <Select 
                                      onValueChange={(value) => {
                                        const fieldKey = `location_details.${index}.regional_unit`;
                                        field.onChange(value);
                                        
                                        // Only reset municipality if user has interacted with this field
                                        if (userInteractedFields.has(fieldKey)) {
                                          const currentMunicipality = form.getValues(`location_details.${index}.municipality`);
                                          const currentRegion = form.getValues(`location_details.${index}.region`);
                                          
                                          const validMunicipalities = typedKallikratisData?.filter(k => 
                                            k.perifereia === currentRegion && k.perifereiaki_enotita === value
                                          ).map(k => k.onoma_neou_ota) || [];
                                          
                                          if (!validMunicipalities.includes(currentMunicipality)) {
                                            form.setValue(`location_details.${index}.municipality`, "");
                                          }
                                        } else {
                                          // Mark this field as interacted for future changes
                                          setUserInteractedFields(prev => new Set(prev).add(fieldKey));
                                        }
                                      }} 
                                      value={field.value || ""}
                                      defaultValue={field.value || ""}
                                      disabled={!form.watch(`location_details.${index}.region`) && !field.value}
                                  >
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε περιφερειακή ενότητα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const currentRegion = form.watch(`location_details.${index}.region`);
                                        const regionalUnits = [...new Set(typedKallikratisData
                                          ?.filter(k => k.perifereia === currentRegion)
                                          .map(k => k.perifereiaki_enotita) || [])].filter(Boolean);
                                        console.log(`Regional Unit options for region "${currentRegion}", field value "${field.value}":`, regionalUnits.includes(field.value), regionalUnits);
                                        return regionalUnits.map((unit, unitIndex) => (
                                          <SelectItem key={`unit-${index}-${unitIndex}-${unit}`} value={unit}>{unit}</SelectItem>
                                        ));
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          )}
                          {shouldShowMunicipality && (
                            <FormField
                              control={form.control}
                              name={`location_details.${index}.municipality`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Δήμος</FormLabel>
                                  <FormControl>
                                    <Select 
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                      }} 
                                      value={field.value || ""}
                                      defaultValue={field.value || ""}
                                      disabled={!form.watch(`location_details.${index}.regional_unit`) && !field.value}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Επιλέξτε δήμο" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(() => {
                                          const currentRegion = form.watch(`location_details.${index}.region`);
                                          const currentRegionalUnit = form.watch(`location_details.${index}.regional_unit`);
                                          const municipalities = [...new Set(typedKallikratisData
                                            ?.filter(k => 
                                              k.perifereia === currentRegion &&
                                              k.perifereiaki_enotita === currentRegionalUnit
                                            )
                                            .map(k => k.onoma_neou_ota) || [])].filter(Boolean);
                                          console.log(`Municipality options for region "${currentRegion}", regional unit "${currentRegionalUnit}", field value "${field.value}":`, municipalities.includes(field.value), municipalities);
                                          return municipalities.map((municipality, muniIndex) => (
                                            <SelectItem key={`municipality-${index}-${muniIndex}-${municipality}`} value={municipality}>{municipality}</SelectItem>
                                          ));
                                        })()}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`location_details.${index}.event_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Τύπος Συμβάντος</FormLabel>
                                <FormControl>
                                  <Select 
                                    onValueChange={field.onChange} 
                                    value={field.value || ""}
                                  >
                                    <SelectTrigger className="text-sm">
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
                            name={`location_details.${index}.implementing_agency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Φορέας Υλοποίησης</FormLabel>
                                <FormControl>
                                  <Select 
                                    onValueChange={field.onChange} 
                                    value={field.value || ""}
                                  >
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε φορέα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {typedUnitsData?.map((unit) => (
                                        <SelectItem key={unit.id} value={unit.name}>
                                          {unit.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div>
                          <FormLabel className="text-sm font-medium mb-3 block">Τύπος Δαπάνης</FormLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {typedExpenditureTypesData?.map((expType) => (
                              <FormField
                                key={expType.id}
                                control={form.control}
                                name={`location_details.${index}.expenditure_types`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <input
                                        type="checkbox"
                                        checked={field.value?.includes(expType.expediture_types) || false}
                                        onChange={(e) => {
                                          const currentValues = field.value || [];
                                          if (e.target.checked) {
                                            field.onChange([...currentValues, expType.expediture_types]);
                                          } else {
                                            field.onChange(currentValues.filter(v => v !== expType.expediture_types));
                                          }
                                        }}
                                        className="rounded border-gray-300"
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal cursor-pointer">
                                      {expType.expediture_types}
                                    </FormLabel>
                                    {field.value?.includes(expType.expediture_types) && (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    )}
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
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
                            Αφαίρεση
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentLocations = form.getValues("location_details");
                          form.setValue("location_details", [
                            ...currentLocations,
                            { region: "", regional_unit: "", municipality: "", implementing_agency: "", event_type: "", expenditure_types: [] }
                          ]);
                        }}
                        className="text-sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Προσθήκη Τοποθεσίας
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/projects/${mis}`)}
                  disabled={mutation.isPending}
                >
                  Ακύρωση
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  onClick={(e) => {
                    console.log("=== SAVE BUTTON CLICKED ===");
                    console.log("Button clicked, form will attempt to submit");
                    console.log("Current form errors:", form.formState.errors);
                    console.log("Form is valid:", form.formState.isValid);
                    console.log("Form dirty fields:", form.formState.dirtyFields);
                    console.log("Is submitting:", form.formState.isSubmitting);
                    console.log("Form mutation pending:", mutation.isPending);
                    
                    // Force trigger validation
                    form.trigger().then((isValid) => {
                      console.log("Manual validation result:", isValid);
                      if (!isValid) {
                        console.log("Validation failed, errors:", form.formState.errors);
                      }
                    });
                  }}
                >
                  {mutation.isPending ? "Αποθήκευση..." : "Αποθήκευση Αλλαγών"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
};
