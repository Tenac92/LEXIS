import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, X, FileText, Calendar, CheckCircle, Building2, RefreshCw } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SmartRegionalUnitSelect } from "@/components/forms/SmartRegionalUnitSelect";
import { SmartGeographicMultiSelect } from "@/components/forms/SmartGeographicMultiSelect";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatEuropeanCurrency, parseEuropeanNumber, formatNumberWhileTyping, formatEuropeanNumber } from "@/lib/number-format";
import { getGeographicInfo, formatGeographicDisplay, getGeographicCodeForSave, convertGeographicDataToKallikratis } from "@shared/utils/geographic-utils";

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

// Hook for validating ΣΑ numbers in real-time
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

  const validateSA = async (saValue: string, fieldKey: string) => {
    if (!saValue?.trim()) {
      setValidationStates(prev => ({ ...prev, [fieldKey]: { isChecking: false, exists: false } }));
      return;
    }

    setValidationStates(prev => ({ ...prev, [fieldKey]: { isChecking: true, exists: false } }));

    try {
      const response = await apiRequest(`/api/projects/check-sa/${encodeURIComponent(saValue)}`) as any;
      setValidationStates(prev => ({ 
        ...prev, 
        [fieldKey]: { 
          isChecking: false, 
          exists: response.exists,
          existingProject: response.existingProject
        } 
      }));
    } catch (error) {
      console.error('Error validating ΣΑ:', error);
      setValidationStates(prev => ({ ...prev, [fieldKey]: { isChecking: false, exists: false } }));
    }
  };

  const getValidationState = (fieldKey: string) => {
    return validationStates[fieldKey] || { isChecking: false, exists: false };
  };

  return { validateSA, getValidationState };
}

// Hook for bi-directional sync between main enumeration code and formulation details
function useBidirectionalSync(form: any) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync main enumeration code to formulation details
  const syncMainToFormulation = (enumerationCode: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    const formulations = form.getValues("formulation_details");
    
    // Find or create formulation entry for this enumeration code
    const existingIndex = formulations.findIndex((f: any) => 
      f.enumeration_code === enumerationCode
    );
    
    if (existingIndex === -1 && enumerationCode.trim()) {
      // Create new formulation entry
      const saType = enumerationCode.includes("ΝΑ853") ? "ΝΑ853" : 
                   enumerationCode.includes("ΝΑ271") ? "ΝΑ271" : 
                   enumerationCode.includes("E069") ? "E069" : "ΝΑ853";
      
      const newFormulation = {
        sa: saType,
        enumeration_code: enumerationCode,
        protocol_number: "", ada: "", decision_year: "",
        decision_status: "Ενεργή", change_type: "Έγκριση", connected_decisions: [],
        comments: "",
        budget_versions: {
          pde: [],
          epa: []
        }
      };
      
      form.setValue("formulation_details", [...formulations, newFormulation]);
    }
    
    setIsUpdating(false);
  };

  // Sync formulation details to main enumeration code
  const syncFormulationToMain = (formulations: any[]) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    // Default logic: Use NA853 if available, otherwise first available
    const na853Entry = formulations.find(f => f.sa === "ΝΑ853" && f.enumeration_code?.trim());
    const primaryEntry = na853Entry || formulations.find(f => f.enumeration_code?.trim());
    
    if (primaryEntry?.enumeration_code) {
      form.setValue("project_details.enumeration_code", primaryEntry.enumeration_code);
    }
    
    setIsUpdating(false);
  };

  return { syncMainToFormulation, syncFormulationToMain, isUpdating };
}

// Note: Enumeration codes are now user-entered fields, not auto-generated

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
  if (typeof fekValue === "string") {
    return { year: "", issue: "", number: "" };
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

// Form schema matching the edit form
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
  
  // Section 2 Location details with multi-select geographic areas
  location_details: z.array(z.object({
    implementing_agency: z.string().default(""),
    event_type: z.string().default(""),
    expenditure_types: z.array(z.string()).default([]),
    geographic_areas: z.array(z.string()).default([]),
  })).default([]),
  
  // Section 3: Project details (enumeration_code moved to formulation level only)
  project_details: z.object({
    mis: z.string().default(""),
    sa: z.string().default(""),
    inc_year: z.string().default(""),
    project_title: z.string().default(""),
    project_description: z.string().default(""),
    summary_description: z.string().default(""),
    expenses_executed: z.string().default(""),
    project_status: z.string().default("Ενεργό"),
  }).default({ 
    mis: "", sa: "", inc_year: "", 
    project_title: "", project_description: "", summary_description: "", 
    expenses_executed: "", project_status: "Ενεργό" 
  }),
  
  // Section 4: Project formulation details with multiple budget versions
  formulation_details: z.array(z.object({
    sa: z.enum(["ΝΑ853", "ΝΑ271", "E069"]).default("ΝΑ853"),
    enumeration_code: z.string().default(""),
    decision_year: z.string().default(""),
    decision_status: z.enum(["Ενεργή", "Ανενεργή", "Αναστολή"]).default("Ενεργή"),
    change_type: z.enum(["Τροποποίηση", "Παράταση", "Έγκριση"]).default("Έγκριση"),
    comments: z.string().default(""),
    
    // RESTRUCTURED: Multiple budget versions for ΠΔΕ and ΕΠΑ
    budget_versions: z.object({
      pde: z.array(z.object({
        version_name: z.string().default(""),
        version_number: z.string().default("1.0"), // Added for sorting and active version logic
        project_budget: z.string().default(""), // Moved from main level
        total_public_expense: z.string().default(""), // Moved from main level  
        eligible_public_expense: z.string().default(""), // Moved from main level
        protocol_number: z.string().default(""),
        ada: z.string().default(""),
        decision_date: z.string().default(""),
        decision_type: z.enum(["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"]).default("Έγκριση"),
        status: z.enum(["Ενεργή", "Ανενεργή", "Αναστολή"]).default("Ενεργή"),
        connected_decisions: z.array(z.number()).default([]), // Each PDE version can have different connected decisions
        comments: z.string().default(""),
      })).default([]),
      epa: z.array(z.object({
        version_name: z.string().default(""),
        version_number: z.string().default("1.0"), // Added for sorting and active version logic
        epa_version: z.string().default(""), // Moved from main level
        amount: z.string().default(""),
        protocol_number: z.string().default(""),
        ada: z.string().default(""),
        decision_date: z.string().default(""),
        decision_type: z.enum(["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"]).default("Έγκριση"),
        status: z.enum(["Ενεργή", "Ανενεργή", "Αναστολή"]).default("Ενεργή"),
        connected_decisions: z.array(z.number()).default([]), // Each EPA version can have different connected decisions
        comments: z.string().default(""),
      })).default([]),
    }).default({
      pde: [],
      epa: []
    }),
  })).default([]),
  
  // Section 5: Changes performed
  changes: z.array(z.object({
    description: z.string().default(""),
  })).default([]),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

export default function NewProjectPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userInteractedFields, setUserInteractedFields] = useState<Set<string>>(new Set());
  const { validateSA, getValidationState } = useSAValidation();

  // Form initialization matching edit form
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
        geographic_areas: []
      }],
      project_details: { 
        mis: "", 
        sa: "ΝΑ853", 
        inc_year: "", 
        project_title: "", 
        project_description: "", 
        summary_description: "", 
        expenses_executed: "", 
        project_status: "Ενεργό" 
      },
      formulation_details: [{ 
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
      }],
      changes: [{ description: "" }],
    },
  });

  // Initialize bi-directional sync after form is defined
  const { syncMainToFormulation, syncFormulationToMain, isUpdating } = useBidirectionalSync(form);

  // PERFORMANCE OPTIMIZATION: Separate query for reference data with aggressive caching (same as edit form)
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

  // NEW: Normalized geographic data query (same as edit form)
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

  // Extract reference data (exactly like edit form)
  const eventTypesData = (referenceData as any)?.eventTypes;
  const unitsData = (referenceData as any)?.units; 
  const expenditureTypesData = (referenceData as any)?.expenditureTypes;
  
  // Convert new geographic data format to legacy kallikratis format for SmartGeographicMultiSelect
  const kallikratisData = geographicData ? convertGeographicDataToKallikratis(geographicData as any) : [];

  // Type-safe data casting
  const typedUnitsData = unitsData as UnitData[] | undefined;
  const typedKallikratisData = kallikratisData as KallikratisEntry[] | undefined;
  const typedEventTypesData = eventTypesData as EventTypeData[] | undefined;
  const typedExpenditureTypesData = expenditureTypesData as ExpenditureTypeData[] | undefined;

  const mutation = useMutation({
    mutationFn: async (data: ComprehensiveFormData) => {
      console.log("=== NEW PROJECT CREATION ===");
      console.log("Form data:", data);
      
      try {
        // 1. Create core project data first
        const projectCreateData = {
          mis: parseInt(data.project_details.mis) || 0,
          na853: (() => {
            // Get enumeration code from first formulation with ΝΑ853
            const na853Formulation = data.formulation_details.find(f => f.sa === "ΝΑ853");
            return na853Formulation?.enumeration_code || "";
          })(),
          project_title: data.project_details.project_title,
          event_description: data.project_details.project_description,
          event_year: data.event_details.event_year,
          status: data.project_details.project_status || "Ενεργό",
          
          // Convert event_name to event_type_id if needed
          event_type: (() => {
            if (!data.event_details.event_name) return null;
            if (typedEventTypesData) {
              const eventType = typedEventTypesData.find(et => 
                et.name === data.event_details.event_name || 
                et.id.toString() === data.event_details.event_name
              );
              return eventType ? eventType.id : null;
            }
            return null;
          })(),
          
          // Budget fields - get from latest active PDE version
          budget_e069: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "E069");
            if (!formEntry?.budget_versions?.pde?.length) return null;
            const activePde = formEntry.budget_versions.pde.find(p => p.status === "Ενεργή") || formEntry.budget_versions.pde[0];
            return activePde?.project_budget ? parseEuropeanNumber(activePde.project_budget) : null;
          })(),
          budget_na271: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "ΝΑ271");
            if (!formEntry?.budget_versions?.pde?.length) return null;
            const activePde = formEntry.budget_versions.pde.find(p => p.status === "Ενεργή") || formEntry.budget_versions.pde[0];
            return activePde?.project_budget ? parseEuropeanNumber(activePde.project_budget) : null;
          })(),
          budget_na853: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "ΝΑ853");
            if (!formEntry?.budget_versions?.pde?.length) return null;
            const activePde = formEntry.budget_versions.pde.find(p => p.status === "Ενεργή") || formEntry.budget_versions.pde[0];
            return activePde?.project_budget ? parseEuropeanNumber(activePde.project_budget) : null;
          })(),
        };
        
        console.log("1. Creating core project data:", projectCreateData);
        const projectResponse = await apiRequest("/api/projects", {
          method: "POST",
          body: JSON.stringify(projectCreateData),
        }) as Response;
        
        if (!projectResponse.ok) {
          const error = await projectResponse.json();
          throw new Error(error.message || "Failed to create project");
        }
        
        const createdProject = await projectResponse.json();
        const projectMis = createdProject.mis;
        console.log("✓ Project creation successful:", createdProject);
        
        // 2. Create project decisions if provided
        if (data.decisions && data.decisions.length > 0 && data.decisions[0].protocol_number) {
          console.log("2. Creating project decisions:", data.decisions);
          
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
          
          await apiRequest(`/api/projects/${projectMis}/decisions`, {
            method: "PUT",
            body: JSON.stringify({ decisions_data: transformedDecisions }),
          });
          console.log("✓ Decisions creation successful");
        }
        
        // 3. Create project formulations with budget versions if provided (ENHANCED for budget_versions)
        if (data.formulation_details && data.formulation_details.length > 0 && data.formulation_details[0].enumeration_code) {
          console.log("3. Creating project formulations with budget versions:", data.formulation_details);
          
          // Transform formulation_details to new structure for backend
          const transformedFormulations = data.formulation_details.map(formulation => ({
            ...formulation,
            // Remove old budget fields as they're now in budget_versions
            project_budget: undefined,
            total_public_expense: undefined,
            eligible_public_expense: undefined,
            epa_version: undefined,
          }));
          
          await apiRequest(`/api/projects/${projectMis}/formulations`, {
            method: "PUT",
            body: JSON.stringify({ 
              formulation_details: transformedFormulations,
              budget_versions: data.formulation_details.map(f => f.budget_versions).filter(Boolean)
            }),
          });
          console.log("✓ Formulations and budget versions creation successful");
        }
        
        return createdProject;
      } catch (error) {
        console.error("Error creating project:", error);
        throw error;
      }
    },
    onSuccess: (createdProject) => {
      toast({
        title: "Επιτυχία",
        description: "Το έργο δημιουργήθηκε επιτυχώς",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      navigate("/projects");
    },
    onError: (error) => {
      console.error("Project creation failed:", error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία δημιουργίας έργου",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ComprehensiveFormData) => {
    console.log("Form submission triggered:", data);
    mutation.mutate(data);
  };

  // Debug data loading
  console.log("DEBUG - Event types data:", typedEventTypesData?.length || 0, "items");
  console.log("DEBUG - Kallikratis data:", typedKallikratisData?.length || 0, "items");
  console.log("DEBUG - Geographic data:", geographicData ? {
    regions: (geographicData as any).regions?.length || 0,
    regionalUnits: (geographicData as any).regionalUnits?.length || 0,
    municipalities: (geographicData as any).municipalities?.length || 0
  } : "none");

  // Check if all essential data is loading (same as edit form)
  const isEssentialDataLoading = isReferenceDataLoading;
  const isAllDataLoading = isReferenceDataLoading || isGeographicDataLoading;

  if (isEssentialDataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Φόρτωση δεδομένων...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Δημιουργία Νέου Έργου
          </h1>
          <p className="text-gray-600">
            Συμπληρώστε τα απαιτούμενα στοιχεία για τη δημιουργία νέου έργου
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => navigate("/projects")}>
              Επιστροφή στα Έργα
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {mutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Δημιουργία...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Δημιουργία Έργου
                </>
              )}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <Tabs defaultValue="project" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="project" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Στοιχεία Έργου
              </TabsTrigger>
              <TabsTrigger value="event-location" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Γεγονός & Τοποθεσία
              </TabsTrigger>
              <TabsTrigger value="formulation" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Διατύπωση
              </TabsTrigger>
              <TabsTrigger value="decisions" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Αποφάσεις
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
                            name={`decisions.${index}.expenses_covered`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Δαπάνες που καλύπτει</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="π.χ. 500.000,00" />
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
                                  <FormLabel>Συμπεριλαμβάνεται στο έργο</FormLabel>
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
                                        checked={field.value?.includes(unit.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange([...(field.value || []), unit.id]);
                                          } else {
                                            field.onChange((field.value || []).filter((item: number) => item !== unit.id));
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {unit.unit_name?.name || unit.name || unit.unit}
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
                            {typedExpenditureTypesData?.map((expenditureType) => (
                              <FormField
                                key={expenditureType.id}
                                control={form.control}
                                name={`decisions.${index}.expenditure_type`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(expenditureType.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange([...(field.value || []), expenditureType.id]);
                                          } else {
                                            field.onChange((field.value || []).filter((item: number) => item !== expenditureType.id));
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
                                    kallikratisData={typedKallikratisData || []}
                                    placeholder="Επιλέξτε γεωγραφικές περιοχές..."
                                  />
                                </FormItem>
                              )}
                            />
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
                            geographic_areas: [],
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
                                // Auto-populate enumeration code based on selected ΣΑ
                                // Enumeration code is now user-entered, not auto-generated
                              }} 
                              defaultValue={field.value}
                            >
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

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <Textarea {...field} placeholder="Εισάγετε τον τίτλο του έργου..." rows={6} />
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
                            <Textarea {...field} placeholder="Εισάγετε αναλυτική περιγραφή του έργου..." rows={2} />
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
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    // Auto-populate enumeration code based on selected ΣΑ
                                    // Enumeration code is now user-entered, not auto-generated
                                  }} 
                                  defaultValue={field.value}
                                >
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
                            render={({ field }) => {
                              const fieldKey = `formulation_details.${index}.enumeration_code`;
                              const validationState = getValidationState(fieldKey);
                              return (
                                <FormItem>
                                  <FormLabel>Κωδικός Απαρίθμησης</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        {...field} 
                                        placeholder="π.χ. ΝΑ853, ΝΑ271, E069" 
                                        onChange={(e) => {
                                          field.onChange(e);
                                          
                                          // Bi-directional sync: Formulation → Main
                                          if (!isUpdating) {
                                            const formulations = form.getValues("formulation_details");
                                            syncFormulationToMain(formulations);
                                          }
                                          
                                          // ΣΑ validation
                                          if (e.target.value.trim()) {
                                            const timeoutId = setTimeout(() => {
                                              validateSA(e.target.value.trim(), fieldKey);
                                            }, 500);
                                            return () => clearTimeout(timeoutId);
                                          }
                                        }}
                                        className={
                                          validationState.exists 
                                            ? "border-red-500" 
                                            : validationState.isChecking 
                                            ? "border-yellow-500" 
                                            : field.value && !validationState.exists && !validationState.isChecking
                                            ? "border-green-500"
                                            : ""
                                        }
                                      />
                                      {validationState.isChecking && (
                                        <RefreshCw className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-yellow-500" />
                                      )}
                                      {field.value && !validationState.isChecking && !validationState.exists && (
                                        <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />
                                      )}
                                      {validationState.exists && (
                                        <X className="absolute right-2 top-2.5 h-4 w-4 text-red-500" />
                                      )}
                                    </div>
                                  </FormControl>
                                  {validationState.exists && validationState.existingProject && (
                                    <div className="text-sm text-red-600 mt-1">
                                      ΣΑ ήδη χρησιμοποιείται στο έργο #{validationState.existingProject.mis} - {validationState.existingProject.project_title}
                                    </div>
                                  )}
                                  {field.value && !validationState.isChecking && !validationState.exists && (
                                    <div className="text-sm text-green-600 mt-1">
                                      ΣΑ διαθέσιμο ✓
                                    </div>
                                  )}
                                </FormItem>
                              );
                            }}
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

                        {/* RESTRUCTURED: Multiple Budget Versions (ΠΔΕ/ΕΠΑ) */}
                        <div className="mt-6">
                          <h4 className="text-lg font-medium mb-4">Εκδόσεις Προϋπολογισμού</h4>
                          <Tabs defaultValue="pde" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="pde">ΠΔΕ ({form.watch(`formulation_details.${index}.budget_versions.pde`)?.length || 0})</TabsTrigger>
                              <TabsTrigger value="epa">ΕΠΑ ({form.watch(`formulation_details.${index}.budget_versions.epa`)?.length || 0})</TabsTrigger>
                            </TabsList>
                            
                            {/* ΠΔΕ Tab - Multiple Versions */}
                            <TabsContent value="pde">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base flex justify-between items-center">
                                    <span>Πρόγραμμα Δημοσίων Επενδύσεων (ΠΔΕ)</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const formulations = form.getValues("formulation_details");
                                        const currentFormulation = formulations[index];
                                        
                                        // Smart version numbering logic
                                        const existingPdeVersions = currentFormulation.budget_versions.pde || [];
                                        const nextVersionNumber = existingPdeVersions.length > 0 
                                          ? String(Math.max(...existingPdeVersions.map(v => parseInt(v.version_number || "1"))) + 1)
                                          : "1";
                                        
                                        const newPdeVersion = {
                                          version_name: `Έκδοση ${nextVersionNumber}`,
                                          version_number: nextVersionNumber,
                                          project_budget: "",
                                          total_public_expense: "",
                                          eligible_public_expense: "",
                                          protocol_number: "",
                                          ada: "",
                                          decision_date: "",
                                          decision_type: "Έγκριση" as const,
                                          status: "Ενεργή" as const,
                                          connected_decisions: [],
                                          comments: ""
                                        };
                                        
                                        if (!currentFormulation.budget_versions.pde) {
                                          currentFormulation.budget_versions.pde = [];
                                        }
                                        currentFormulation.budget_versions.pde.push(newPdeVersion);
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
                                                <span className="text-sm text-gray-500">
                                                  {versionData.version_name && `- ${versionData.version_name}`}
                                                </span>
                                              </div>
                                            </AccordionTrigger>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const formulations = form.getValues("formulation_details");
                                                formulations[index].budget_versions.pde.splice(originalIndex, 1);
                                                form.setValue("formulation_details", formulations);
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <AccordionContent>
                                            <div className="space-y-4 pt-4">
                                              
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField
                                                  control={form.control}
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.version_number`}
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
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.version_name`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>Όνομα Έκδοσης</FormLabel>
                                                      <FormControl>
                                                        <Input {...field} placeholder="π.χ. Αρχική έγκριση" />
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
                                              
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField
                                                  control={form.control}
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.project_budget`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>Προϋπολογισμός Έργου (€)</FormLabel>
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
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.total_public_expense`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>Συνολική Δημόσια Δαπάνη (€)</FormLabel>
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
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.eligible_public_expense`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>Επιλέξιμη Δημόσια Δαπάνη (€)</FormLabel>
                                                      <FormControl>
                                                        <Input 
                                                          {...field} 
                                                          placeholder="π.χ. 600.000,00" 
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
                                                      <FormLabel>Αριθμός ΑΔΑ</FormLabel>
                                                      <FormControl>
                                                        <Input {...field} placeholder="π.χ. 6ΑΔΑ465ΦΘΞ-ΨΨΨ" />
                                                      </FormControl>
                                                    </FormItem>
                                                  )}
                                                />
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                  control={form.control}
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.decision_type`}
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
                                                          <SelectItem value="Κλείσιμο στο ύψος πληρωμών">Κλείσιμο στο ύψος πληρωμών</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                    </FormItem>
                                                  )}
                                                />
                                                <FormField
                                                  control={form.control}
                                                  name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.status`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>Κατάσταση</FormLabel>
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
                                              </div>

                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.comments`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Σχόλια ΠΔΕ</FormLabel>
                                                    <FormControl>
                                                      <Textarea {...field} placeholder="Σχόλια για αυτή την έκδοση ΠΔΕ..." rows={2} />
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
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>
                            
                            {/* ΕΠΑ Tab - Multiple Versions */}
                            <TabsContent value="epa">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base flex justify-between items-center">
                                    <span>Ευρωπαϊκό Πρόγραμμα Ανάπτυξης (ΕΠΑ)</span>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  {(!form.watch(`formulation_details.${index}.budget_versions.epa`) || 
                                    form.watch(`formulation_details.${index}.budget_versions.epa`)?.length === 0) ? (
                                    <div className="text-center py-8">
                                      <p className="text-gray-500 mb-4">Δεν υπάρχουν εκδόσεις ΕΠΑ</p>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          const formulations = form.getValues("formulation_details");
                                          const currentFormulation = formulations[index];
                                          
                                          // Smart version numbering logic for EPA
                                          const existingEpaVersions = currentFormulation.budget_versions.epa || [];
                                          const nextVersionNumber = existingEpaVersions.length > 0 
                                            ? String(Math.max(...existingEpaVersions.map(v => parseInt(v.version_number || "1"))) + 1)
                                            : "1";
                                          
                                          const newEpaVersion = {
                                            version_name: `ΕΠΑ ${nextVersionNumber}`,
                                            version_number: nextVersionNumber,
                                            epa_version: "",
                                            amount: "",
                                            protocol_number: "",
                                            ada: "",
                                            decision_date: "",
                                            decision_type: "Έγκριση" as const,
                                            status: "Ενεργή" as const,
                                            connected_decisions: [],
                                            comments: ""
                                          };
                                          
                                          if (!currentFormulation.budget_versions.epa) {
                                            currentFormulation.budget_versions.epa = [];
                                          }
                                          currentFormulation.budget_versions.epa.push(newEpaVersion);
                                          form.setValue("formulation_details", formulations);
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Προσθήκη Πρώτης Έκδοσης ΕΠΑ
                                      </Button>
                                    </div>
                                  ) : (
                                    <Accordion type="single" collapsible className="space-y-4">
                                      {form.watch(`formulation_details.${index}.budget_versions.epa`)?.map((versionData: any, epaIndex: number) => {
                                        const isActiveVersion = form.watch(`formulation_details.${index}.budget_versions.epa`)
                                          ?.reduce((max, current) => 
                                            parseFloat(current.version_number || "1.0") > parseFloat(max.version_number || "1.0") 
                                              ? current : max, versionData
                                          ) === versionData;
                                        return (
                                          <AccordionItem key={epaIndex} value={`epa-${epaIndex}`}>
                                            <div className="flex items-center justify-between pr-4">
                                              <AccordionTrigger className="flex-1 hover:no-underline">
                                                <div className="flex items-center gap-2">
                                                  <h5 className="font-medium">ΕΠΑ v{versionData.version_number || "1.0"}</h5>
                                                  {isActiveVersion && (
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                                      ΕΝΕΡΓΟ
                                                    </span>
                                                  )}
                                                  <span className="text-sm text-gray-500">
                                                    {versionData.version_name && `- ${versionData.version_name}`}
                                                  </span>
                                                </div>
                                              </AccordionTrigger>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const formulations = form.getValues("formulation_details");
                                                  formulations[index].budget_versions.epa.splice(epaIndex, 1);
                                                  form.setValue("formulation_details", formulations);
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <AccordionContent>
                                              <div className="space-y-4 pt-4">
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.version_number`}
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
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.version_name`}
                                                    render={({ field }) => (
                                                      <FormItem>
                                                        <FormLabel>Όνομα Έκδοσης</FormLabel>
                                                        <FormControl>
                                                          <Input {...field} placeholder="π.χ. Αρχική έγκριση" />
                                                        </FormControl>
                                                      </FormItem>
                                                    )}
                                                  />
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.decision_date`}
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

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.epa_version`}
                                                    render={({ field }) => (
                                                      <FormItem>
                                                        <FormLabel>Έκδοση ΕΠΑ</FormLabel>
                                                        <FormControl>
                                                          <Input {...field} placeholder="π.χ. 2021-2027" />
                                                        </FormControl>
                                                      </FormItem>
                                                    )}
                                                  />
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.amount`}
                                                    render={({ field }) => (
                                                      <FormItem>
                                                        <FormLabel>Ποσό ΕΠΑ (€)</FormLabel>
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
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.protocol_number`}
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
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.ada`}
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

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.decision_type`}
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
                                                      <SelectItem value="Κλείσιμο στο ύψος πληρωμών">Κλείσιμο στο ύψος πληρωμών</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </FormItem>
                                              )}
                                            />
                                                  <FormField
                                                    control={form.control}
                                                    name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.status`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel>Κατάσταση</FormLabel>
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
                                          </div>
                                          
                                                <FormField
                                                  control={form.control}
                                                  name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.connected_decisions`}
                                            render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Συνδεδεμένες Αποφάσεις</FormLabel>
                                                <FormControl>
                                                  <Select
                                                    onValueChange={(value) => {
                                                      const currentDecisions = field.value || [];
                                                      const decisionId = parseInt(value);
                                                      if (!currentDecisions.includes(decisionId)) {
                                                        field.onChange([...currentDecisions, decisionId]);
                                                      }
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
                                                      return (
                                                        <span
                                                          key={decisionId}
                                                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                                                        >
                                                          {decision?.protocol_number || `Απόφαση ${decisionId + 1}`}
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const newDecisions = field.value.filter((id: number) => id !== decisionId);
                                                              field.onChange(newDecisions);
                                                            }}
                                                            className="hover:text-blue-600"
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
                                          />
                                                
                                                <FormField
                                                  control={form.control}
                                                  name={`formulation_details.${index}.budget_versions.epa.${epaIndex}.comments`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>Σχόλια ΕΠΑ</FormLabel>
                                                      <FormControl>
                                                        <Textarea {...field} placeholder="Σχόλια για αυτή την έκδοση ΕΠΑ..." />
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
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>
                          </Tabs>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const formulations = form.getValues("formulation_details");
                        
                        // Add new formulation (SA types can be duplicated, enumeration codes must be unique)
                        formulations.push({
                          sa: "ΝΑ853", // Default SA type, user can change it
                          enumeration_code: "",
                          decision_year: "",
                          decision_status: "Ενεργή",
                          change_type: "Έγκριση",
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
        </Form>
      </div>
    </div>
  );
}
