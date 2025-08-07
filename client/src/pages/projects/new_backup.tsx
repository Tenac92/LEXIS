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
    inclusion_year: z.string().default(""),
    project_title: z.string().default(""),
    project_description: z.string().default(""),
    summary_description: z.string().default(""),
    expenses_executed: z.string().default(""),
    project_status: z.string().default("Ενεργό"),
  }).default({ 
    mis: "", sa: "", inclusion_year: "", 
    project_title: "", project_description: "", summary_description: "", 
    expenses_executed: "", project_status: "Ενεργό" 
  }),
  
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
    timestamp: z.string().default(new Date().toISOString()),
    user_id: z.number().optional(),
    user_name: z.string().default(""),
    change_type: z.string().default("Update"),
    description: z.string().default(""),
    notes: z.string().default(""),
  })).default([]),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

export default function NewProjectPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userInteractedFields, setUserInteractedFields] = useState<Set<string>>(new Set());

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
        regions: [{ 
          region: "", 
          regional_unit: "", 
          municipality: "" 
        }]
      }],
      project_details: { 
        mis: "", 
        sa: "", 
        inclusion_year: "", 
        project_title: "", 
        project_description: "", 
        summary_description: "", 
        expenses_executed: "", 
        project_status: "Ενεργό" 
      },
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
      changes: [{ 
        timestamp: new Date().toISOString(),
        user_id: undefined,
        user_name: "",
        change_type: "Initial Creation",
        description: "Project created",
        notes: ""
      }],
    },
  });

  // Fetch supporting data (similar to edit form)
  const { 
    data: completeProjectData, 
    isLoading: isCompleteDataLoading, 
    error: completeDataError 
  } = useQuery({
    queryKey: [`/api/projects/reference-data`],
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false, 
  });

  // Extract data from unified API response with proper typing
  const eventTypesData = (completeProjectData as any)?.event_types;
  const unitsData = (completeProjectData as any)?.units;
  const kallikratisData = (completeProjectData as any)?.kallikratis;
  const expenditureTypesData = (completeProjectData as any)?.expenditure_types;

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
          na853: data.project_details.sa || "",
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
          
          // Budget fields - parse European format to numbers
          budget_e069: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "E069");
            return formEntry?.project_budget ? parseEuropeanNumber(formEntry.project_budget) : null;
          })(),
          budget_na271: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "ΝΑ271");
            return formEntry?.project_budget ? parseEuropeanNumber(formEntry.project_budget) : null;
          })(),
          budget_na853: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "ΝΑ853");
            return formEntry?.project_budget ? parseEuropeanNumber(formEntry.project_budget) : null;
          })(),
          
          // New fields: inc_year and updates
          inc_year: data.project_details.inclusion_year ? parseInt(data.project_details.inclusion_year) : null,
          updates: data.changes || [],
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
        
        // 3. Create project formulations if provided
        if (data.formulation_details && data.formulation_details.length > 0 && data.formulation_details[0].protocol_number) {
          console.log("3. Creating project formulations:", data.formulation_details);
          await apiRequest(`/api/projects/${projectMis}/formulations`, {
            method: "PUT",
            body: JSON.stringify({ formulation_details: data.formulation_details }),
          });
          console.log("✓ Formulations creation successful");
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

  // Helper functions for dynamic dropdowns (similar to edit form)
  const getUniqueRegions = () => {
    if (!typedKallikratisData) return [];
    const regions = new Set(typedKallikratisData.map(k => k.perifereia));
    return Array.from(regions).sort();
  };

  const getRegionalUnitsForRegion = (region: string) => {
    if (!typedKallikratisData || !region) return [];
    const units = new Set(
      typedKallikratisData
        .filter(k => k.perifereia === region)
        .map(k => k.perifereiaki_enotita)
    );
    return Array.from(units).sort();
  };

  const getMunicipalitiesForRegionalUnit = (region: string, regionalUnit: string) => {
    if (!typedKallikratisData || !region || !regionalUnit) return [];
    const municipalities = new Set(
      typedKallikratisData
        .filter(k => k.perifereia === region && k.perifereiaki_enotita === regionalUnit)
        .map(k => k.onoma_neou_ota)
    );
    return Array.from(municipalities).sort();
  };

  if (isCompleteDataLoading) {
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {form.watch("changes").map((change, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Αλλαγή {index + 1}</h4>
                            <span className="text-sm text-muted-foreground">
                              {new Date(change.timestamp || new Date()).toLocaleDateString('el-GR')}
                            </span>
                          </div>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <FormField
                            control={form.control}
                            name={`changes.${index}.change_type`}
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
                                    <SelectItem value="Initial Creation">Αρχική Δημιουργία</SelectItem>
                                    <SelectItem value="Budget Update">Ενημέρωση Προϋπολογισμού</SelectItem>
                                    <SelectItem value="Status Change">Αλλαγή Κατάστασης</SelectItem>
                                    <SelectItem value="Document Update">Ενημέρωση Εγγράφων</SelectItem>
                                    <SelectItem value="Other">Άλλο</SelectItem>
                                  </SelectContent>
                                </Select>
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
                                  <Input {...field} placeholder="Όνομα χρήστη" readOnly />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`changes.${index}.description`}
                          render={({ field }) => (
                            <FormItem className="mb-4">
                              <FormLabel>Περιγραφή Αλλαγής</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Περιγράψτε την αλλαγή που πραγματοποιήθηκε..." rows={2} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`changes.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Επιπλέον Σημειώσεις</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Προσθέστε οποιεσδήποτε επιπλέον σημειώσεις..." rows={2} />
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
                          timestamp: new Date().toISOString(),
                          user_id: undefined,
                          user_name: "",
                          change_type: "Other",
                          description: "",
                          notes: ""
                        });
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
