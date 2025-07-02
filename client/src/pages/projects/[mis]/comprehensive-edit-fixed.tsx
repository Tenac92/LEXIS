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
import { Plus, Trash2, Save, X, FileText, Calendar, CheckCircle, Building, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatEuropeanCurrency, parseEuropeanNumber, formatNumberWhileTyping } from "@/lib/number-format";

// Interface for kallikratis data structure
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
    municipal_community: z.string().default(""),
    municipality: z.string().default(""),
    regional_unit: z.string().default(""),
    region: z.string().default(""),
    implementing_agency: z.string().default(""),
    expenditure_types: z.array(z.string()).default([]),
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
    project_status: z.enum(["Συμπληρωμένο", "Συνεχιζόμενο", "Ολοκληρωμένο"]).default("Συμπληρωμένο"),
  }).default({ 
    mis: "", sa: "", enumeration_code: "", inclusion_year: "", 
    project_title: "", project_description: "", summary_description: "", 
    expenses_executed: "", project_status: "Συμπληρωμένο" 
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
    project_status: z.enum(["Συμπληρωμένο", "Συνεχιζόμενο", "Ολοκληρωμένο"]).default("Συμπληρωμένο"),
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

  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    defaultValues: {
      decisions: [{ protocol_number: "", fek: "", ada: "", implementing_agency: "", decision_budget: "", expenses_covered: "", decision_type: "Έγκριση", is_included: true, comments: "" }],
      event_details: { event_name: "", event_year: "" },
      location_details: [{ municipal_community: "", municipality: "", regional_unit: "", region: "", implementing_agency: "", expenditure_types: [] }],
      project_details: { mis: "", sa: "", enumeration_code: "", inclusion_year: "", project_title: "", project_description: "", summary_description: "", expenses_executed: "", project_status: "Συμπληρωμένο" },
      previous_entries: [],
      formulation_details: [{ sa: "ΝΑ853", enumeration_code: "", protocol_number: "", ada: "", decision_year: "", project_budget: "", epa_version: "", total_public_expense: "", eligible_public_expense: "", decision_status: "Ενεργή", change_type: "Έγκριση", connected_decisions: [], comments: "" }],
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

  // Extract data from parallel queries
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
            return projectData?.budget_e069 || null;
          })(),
          budget_na271: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "NA271");
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(`Budget NA271: "${formEntry.project_budget}" -> ${parsed}`);
              return parsed;
            }
            return projectData?.budget_na271 || null;
          })(),
          budget_na853: (() => {
            const formEntry = data.formulation_details.find(f => f.sa === "NA853");
            if (formEntry?.project_budget) {
              const parsed = parseEuropeanNumber(formEntry.project_budget);
              console.log(`Budget NA853: "${formEntry.project_budget}" -> ${parsed}`);
              return parsed;
            }
            return projectData?.budget_na853 || null;
          })(),
        };
        
        console.log("1. Updating core project data:", projectUpdateData);
        const projectResponse = await apiRequest(`/api/projects/${mis}`, {
          method: "PATCH",
          body: JSON.stringify(projectUpdateData),
        });
        
        // 2. Update project decisions in normalized table
        if (data.decisions && data.decisions.length > 0) {
          console.log("2. Updating project decisions:", data.decisions);
          await apiRequest(`/api/projects/${mis}/decisions`, {
            method: "PUT",
            body: JSON.stringify(data.decisions),
          });
        }
        
        // 3. Update project formulations in normalized table
        if (data.formulation_details && data.formulation_details.length > 0) {
          console.log("3. Updating project formulations:", data.formulation_details);
          await apiRequest(`/api/projects/${mis}/formulations`, {
            method: "PUT",
            body: JSON.stringify(data.formulation_details),
          });
        }
        
        // 4. Update project index (location details)
        if (data.location_details && data.location_details.length > 0) {
          console.log("4. Processing location details:", data.location_details);
          
          // Transform location details to project_index format
          const projectLines = [];
          
          for (const location of data.location_details) {
            // Skip empty locations
            if (!location.region && !location.regional_unit && !location.municipality && !location.implementing_agency) {
              continue;
            }
            
            // Find kallikratis_id
            let kallikratisId = null;
            if (kallikratisData && location.region) {
              const kallikratis = kallikratisData.find(k => 
                k.perifereia === location.region && 
                (!location.regional_unit || k.perifereiaki_enotita === location.regional_unit) &&
                (!location.municipality || k.onoma_neou_ota === location.municipality)
              );
              if (kallikratis) {
                kallikratisId = kallikratis.id;
              }
            }
            
            // Find implementing agency (monada_id)
            let monadaId = null;
            if (unitsData && location.implementing_agency) {
              const unit = unitsData.find(u => 
                u.name === location.implementing_agency || 
                u.unit_name?.name === location.implementing_agency ||
                u.unit === location.implementing_agency
              );
              if (unit) {
                monadaId = unit.id;
              }
            }
            
            // Create entries for each expenditure type
            if (location.expenditure_types && location.expenditure_types.length > 0) {
              for (const expenditureType of location.expenditure_types) {
                const expenditureTypeData = expenditureTypesData?.find(et => et.name === expenditureType);
                if (expenditureTypeData) {
                  projectLines.push({
                    kallikratis_id: kallikratisId,
                    monada_id: monadaId,
                    expediture_type_id: expenditureTypeData.id,
                    event_types_id: eventTypesData?.find(et => et.name === data.event_details.event_name)?.id || null,
                  });
                }
              }
            } else {
              // Create entry without expenditure type
              projectLines.push({
                kallikratis_id: kallikratisId,
                monada_id: monadaId,
                expediture_type_id: null,
                event_types_id: eventTypesData?.find(et => et.name === data.event_details.event_name)?.id || null,
              });
            }
          }
          
          if (projectLines.length > 0) {
            console.log("Updating project index with lines:", projectLines);
            await apiRequest(`/api/projects/${mis}/index`, {
              method: "PUT",
              body: JSON.stringify({ project_lines: projectLines }),
            });
          }
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
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/index`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/decisions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/formulations`] });
      
      // Navigate back to project page
      navigate(`/projects/${mis}`);
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
    if (projectData) {
      console.log('Initializing form with project data:', projectData);
      
      const decisions = [{
        protocol_number: "",
        fek: "",
        ada: "",
        implementing_agency: projectData.enhanced_unit?.name || "",
        decision_budget: "",
        expenses_covered: "",
        decision_type: "Έγκριση" as const,
        is_included: true,
        comments: "",
      }];

      form.reset({
        decisions: decisions,
        event_details: {
          event_name: projectData.event_description || "",
          event_year: projectData.event_year?.toString() || "",
        },
        project_details: {
          project_title: projectData.project_title || "",
          project_description: projectData.event_description || "",
          project_status: projectData.status || "Ενεργό",
        },
        formulation_details: [{
          sa: "ΝΑ853",
          enumeration_code: projectData.na853 || "",
          protocol_number: "",
          ada: "",
          decision_year: projectData.event_year?.toString() || "",
          project_budget: projectData.budget_na853 ? formatEuropeanNumber(projectData.budget_na853) : "",
          epa_version: "",
          total_public_expense: projectData.budget_na853 ? formatEuropeanNumber(projectData.budget_na853) : "",
          eligible_public_expense: projectData.budget_na853 ? formatEuropeanNumber(projectData.budget_na853) : "",
          decision_status: "Ενεργή",
          change_type: "Έγκριση",
          connected_decisions: [],
          comments: "",
        }],
        location_details: [{
          municipal_community: "",
          municipality: "",
          regional_unit: "",
          region: "",
          implementing_agency: projectData.enhanced_unit?.name || "",
          expenditure_types: [],
        }],
        changes: [],
      });
    }
  }, [projectData, form]);

  const isLoading = projectLoading || eventTypesLoading || unitsLoading || kallikratisLoading || expenditureTypesLoading;
  const isDataReady = projectData && eventTypesData && unitsData && kallikratisData && expenditureTypesData;

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
                  <div className={`w-2 h-2 rounded-full ${projectData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Στοιχεία έργου {projectData ? '✓' : '...'}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${unitsData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Φορείς υλοποίησης {unitsData ? '✓' : '...'}</span>
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
    console.log("Form submitted with data:", data);
    mutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Διαχείριση Έργου: {projectData?.project_title}</h1>
        <p className="text-gray-600">MIS: {projectData?.mis}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary">Σύνοψη</TabsTrigger>
              <TabsTrigger value="edit">Επεξεργασία</TabsTrigger>
            </TabsList>
            
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
                    {form.watch("decisions").map((_, index) => (
                      <div key={index} className="grid grid-cols-6 gap-3 p-3 border rounded-lg">
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Αρ. Πρωτοκόλλου</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Αριθμός πρωτοκόλλου" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.fek`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">ΦΕΚ</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ΦΕΚ" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.ada`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">ΑΔΑ</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ΑΔΑ" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-3">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.implementing_agency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Φορέας Υλοποίησης</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε φορέα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unitsData?.map((unit) => (
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
                  <div className="grid grid-cols-2 gap-4">
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
                                {eventTypesData?.map((eventType) => (
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
