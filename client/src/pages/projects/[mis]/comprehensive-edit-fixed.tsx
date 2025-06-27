import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
import { Plus, Trash2, Save, X, FileText, Calendar, CheckCircle, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Interface for kallikratis data structure
interface KallikratisEntry {
  id: number;
  eidos_koinotitas: string;
  onoma_dimotikis_enotitas: string;
  eidos_neou_ota: string;
  onoma_neou_ota: string;
  perifereiaki_enotita: string;
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
    expenses_covered: z.string().default(""),
    decision_type: z.enum(["Έγκριση", "Τροποποίηση", "Παράταση"]).default("Έγκριση"),
    is_included: z.boolean().default(true),
    comments: z.string().default(""),
  })).default([]),
  
  // Section 2: Event details
  event_details: z.object({
    event_name: z.string().min(1, "Ο τύπος συμβάντος είναι υποχρεωτικός"),
    event_year: z.string().min(1, "Το έτος συμβάντος είναι υποχρεωτικό"),
  }).default({ event_name: "", event_year: "" }),
  
  // Section 2 Location details with cascading dropdowns
  location_details: z.array(z.object({
    municipal_community: z.string().default(""),
    municipality: z.string().default(""),
    regional_unit: z.string().min(1, "Η περιφερειακή ενότητα είναι υποχρεωτική"),
    region: z.string().min(1, "Η περιφέρεια είναι υποχρεωτική"),
    implementing_agency: z.string().min(1, "Ο φορέας υλοποίησης είναι υποχρεωτικός"),
    expenditure_types: z.array(z.string()).min(1, "Απαιτείται τουλάχιστον ένας τύπος δαπάνης"),
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
    decision_status: z.enum(["Ενεργή", "Ανενεργή"]).default("Ενεργή"),
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

  const { data: projectData, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: [`/api/projects/${mis}`],
    enabled: !!mis,
  });

  const { data: projectIndexData } = useQuery({
    queryKey: [`/api/projects/${mis}/index`],
    enabled: !!mis,
  });

  const { data: eventTypesData } = useQuery({
    queryKey: ["/api/event-types"],
  });

  const { data: unitsData } = useQuery({
    queryKey: ["/api/public/units"],
  });

  const { data: kallikratisData } = useQuery<KallikratisEntry[]>({
    queryKey: ["/api/kallikratis"],
  });

  const { data: expenditureTypesData } = useQuery({
    queryKey: ["/api/expenditure-types"],
  });

  const mutation = useMutation({
    mutationFn: async (data: ComprehensiveFormData) => {
      console.log("Sending comprehensive form data:", data);
      
      // Transform the data to match backend expectations
      const transformedData = {
        ...data,
        project_details: {
          ...data.project_details,
          mis: mis, // Ensure MIS is set correctly
        }
      };
      
      // Use fetch directly to ensure proper formatting
      const response = await fetch(`/api/projects/${mis}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transformedData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Τα στοιχεία του έργου ενημερώθηκαν επιτυχώς",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      navigate(`/projects/${mis}`);
    },
    onError: (error: any) => {
      console.error("Error updating project:", error);
      toast({
        variant: "destructive",
        title: "Σφάλμα",
        description: error.message || "Αποτυχία ενημέρωσης του έργου",
      });
    },
  });

  // Data initialization effect
  useEffect(() => {
    if (projectData) {
      console.log('Initializing form with project data:', projectData);
      console.log('Project index data:', projectIndexData);
      const project = projectData;

      // Initialize decisions from project data and decision_data from project_history
      const decisions = [];
      
      // Check if we have decision_data from project_history (new architecture)
      if (project.decision_data && Array.isArray(project.decision_data) && project.decision_data.length > 0) {
        console.log('Loading decisions from project_history decision_data:', project.decision_data);
        project.decision_data.forEach((decision, i) => {
          decisions.push({
            protocol_number: decision.kya || "",
            fek: decision.fek || "",
            ada: decision.ada || "",
            implementing_agency: decision.implementing_agency || "",
            decision_budget: decision.budget_decision || "",
            expenses_covered: decision.expenses_covered || "",
            decision_type: decision.decision_type || "Έγκριση" as const,
            is_included: decision.is_included !== undefined ? decision.is_included : true,
            comments: decision.comments || "",
          });
        });
      } else {
        // Fallback to legacy fields if no project_history data exists
        console.log('Loading decisions from legacy project fields');
        
        // Parse arrays from legacy fields
        const kya = project.decisions?.kya || [];
        const fek = project.decisions?.fek || [];
        const ada = project.decisions?.ada || [];
        
        const maxLength = Math.max(kya.length, fek.length, ada.length, 1);
        
        for (let i = 0; i < maxLength; i++) {
          decisions.push({
            protocol_number: kya[i] || "",
            fek: fek[i] || "",
            ada: ada[i] || "",
            implementing_agency: project.enhanced_unit?.name || "",
            decision_budget: "",
            expenses_covered: "",
            decision_type: "Έγκριση" as const,
            is_included: true,
            comments: "",
          });
        }
      }

      // If no decisions exist, create default entry
      if (decisions.length === 0) {
        decisions.push({
          protocol_number: "",
          fek: "",
          ada: "",
          implementing_agency: project.enhanced_unit?.name || "",
          decision_budget: "",
          expenses_covered: "",
          decision_type: "Έγκριση" as const,
          is_included: true,
          comments: "",
        });
      }

      // Initialize location details from project_index data
      const locationDetails = [];
      
      if (projectIndexData && projectIndexData.length > 0) {
        console.log('No project index data available, initializing with default location details');
        
        // Group by kallikratis_id and monada_id to create location entries
        const grouped = projectIndexData.reduce((acc, entry) => {
          const key = `${entry.kallikratis_id}-${entry.monada_id}`;
          if (!acc[key]) {
            acc[key] = {
              kallikratis_id: entry.kallikratis_id,
              monada_id: entry.monada_id,
              expenditure_types: []
            };
          }
          if (entry.expediture_type_id) {
            acc[key].expenditure_types.push(entry.expediture_type_id.toString());
          }
          return acc;
        }, {});

        Object.values(grouped).forEach((group: any) => {
          // Find the kallikratis entry for this location
          const kallikratisEntry = kallikratisData?.find(k => k.id === group.kallikratis_id);
          const unit = unitsData?.find(u => u.id === group.monada_id);
          
          if (kallikratisEntry) {
            locationDetails.push({
              municipal_community: kallikratisEntry.onoma_dimotikis_enotitas || "",
              municipality: kallikratisEntry.onoma_neou_ota || "",
              regional_unit: kallikratisEntry.perifereiaki_enotita || "",
              region: kallikratisEntry.perifereia || "",
              implementing_agency: unit?.name || "",
              expenditure_types: group.expenditure_types,
            });
          }
        });
      }

      // If no location details exist, create default entry
      if (locationDetails.length === 0) {
        console.log('No project index data available, initializing with default location details');
        const defaultImplementingAgency = project.enhanced_unit?.name || "";
        console.log('Default location entry created with implementing agency:', defaultImplementingAgency);
        
        locationDetails.push({
          municipal_community: project.enhanced_kallikratis?.onoma_dimotikis_enotitas || "",
          municipality: project.enhanced_kallikratis?.onoma_neou_ota || "",
          regional_unit: project.enhanced_kallikratis?.perifereiaki_enotita || "",
          region: project.enhanced_kallikratis?.perifereia || "",
          implementing_agency: defaultImplementingAgency,
          expenditure_types: project.enhanced_expenditure_type?.id ? [project.enhanced_expenditure_type.id.toString()] : [],
        });
      }

      // Initialize formulation details
      const formulation = [];

      // Check if project has existing formulation details structure
      if (project.formulation_details && Array.isArray(project.formulation_details) && project.formulation_details.length > 0) {
        project.formulation_details.forEach((detail) => {
          formulation.push({
            sa: detail.sa || "ΝΑ853" as const,
            enumeration_code: detail.enumeration_code || "",
            protocol_number: detail.protocol_number || project.decisions?.kya?.[0] || "",
            ada: detail.ada || project.decisions?.ada?.[0] || "",
            decision_year: detail.decision_year || project.event_year?.[0] || "",
            project_budget: detail.project_budget || project.budget_e069.toString(),
            epa_version: detail.epa_version || "",
            total_public_expense: detail.total_public_expense || project.budget_e069.toString(),
            eligible_public_expense: detail.eligible_public_expense || project.budget_e069.toString(),
            decision_status: detail.decision_status || "Ενεργή" as const,
            change_type: detail.change_type || "Έγκριση" as const,
            connected_decisions: Array.isArray(detail.connected_decisions) ? detail.connected_decisions : [],
            comments: detail.comments || "",
          });
        });
      } else {
        // Create default formulation details from project data
        formulation.push({
          sa: "ΝΑ853" as const,
          enumeration_code: "",
          protocol_number: project.decisions?.kya?.[0] || "",
          ada: project.decisions?.ada?.[0] || "",
          decision_year: project.event_year?.[0] || "",
          project_budget: project.budget_e069.toString(),
          epa_version: "",
          total_public_expense: project.budget_e069.toString(),
          eligible_public_expense: project.budget_e069.toString(),
          decision_status: "Ενεργή" as const,
          change_type: "Έγκριση" as const,
          connected_decisions: [],
          comments: "",
        });
      }

      // If no decisions exist, create default entry
      if (formulation.length === 0) {
        formulation.push({
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
          comments: "",
        });
      }

      // Update form with initialized data
      form.reset({
        decisions,
        event_details: {
          event_name: project.enhanced_event_type?.name || "",
          event_year: project.event_year?.[0] || "",
        },
        location_details: locationDetails,
        project_details: {
          mis: project.mis?.toString() || "",
          sa: "ΝΑ853",
          enumeration_code: "",
          inclusion_year: project.event_year?.[0] || "",
          project_title: project.project_title || "",
          project_description: project.event_description || "",
          summary_description: project.project_title || "",
          expenses_executed: project.budget_e069?.toString() || "",
          project_status: "Συμπληρωμένο" as const,
        },
        previous_entries: [],
        formulation_details: formulation,
        changes: [{ description: "" }],
      });

      // Check if project has previous entries
      if (project.previous_entries && project.previous_entries.length > 0) {
        setHasPreviousEntries(true);
      }
    }
  }, [projectData, projectIndexData, kallikratisData, unitsData, form]);

  // Computed values
  const isLoading = projectLoading;
  const isDataReady = projectData && eventTypesData;

  // CONDITIONAL RENDERING AFTER ALL HOOKS
  if (projectError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-red-600 mb-2">Σφάλμα φόρτωσης</h3>
              <p className="text-gray-600 mb-4">Δεν ήταν δυνατή η φόρτωση των στοιχείων του έργου.</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Επανάληψη
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !isDataReady) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-blue-600 mb-4">Φόρτωση στοιχείων έργου...</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${projectData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Στοιχεία έργου {projectData ? '✓' : '...'}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${eventTypesData ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Τύποι συμβάντων {eventTypesData ? '✓' : '...'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (data: ComprehensiveFormData) => {
    console.log("Form submitted with data:", data);
    mutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Πλήρης Επεξεργασία Έργου - {projectData?.mis}</h1>
      
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">Περίληψη</TabsTrigger>
          <TabsTrigger value="edit">Επεξεργασία</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Περίληψη Έργου
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">MIS:</span> {projectData?.mis}
                </div>
                <div>
                  <span className="font-medium">Τίτλος:</span> {projectData?.project_title}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              
              {/* Section 1: Decisions that document the project */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    1. Αποφάσεις που τεκμηριώνουν το έργο
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {form.watch("decisions").map((_, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Αρ. Πρωτοκόλλου</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ΚΥΑ" className="text-sm" />
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
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.implementing_agency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Φορέας υλοποίησης</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε φορέα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unitsData?.map((unit) => (
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
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_budget`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Προϋπολογισμός</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Ποσό €" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`decisions.${index}.decision_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Τύπος Απόφασης</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                      <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                      <SelectItem value="Παράταση">Παράταση</SelectItem>
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
                      {form.watch("decisions").length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentDecisions = form.getValues("decisions");
                            form.setValue("decisions", currentDecisions.slice(0, -1));
                          }}
                          className="text-sm"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Αφαίρεση
                        </Button>
                      )}
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

              {/* Section 2b: Geographical Location Management */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    2β. Διαχείριση Τοποθεσιών & Φορέων
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {form.watch("location_details").map((_, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <FormField
                            control={form.control}
                            name={`location_details.${index}.region`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Περιφέρεια</FormLabel>
                                <FormControl>
                                  <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    // Clear dependent fields when region changes
                                    form.setValue(`location_details.${index}.regional_unit`, "");
                                    form.setValue(`location_details.${index}.municipality`, "");
                                    form.setValue(`location_details.${index}.municipal_community`, "");
                                  }} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε περιφέρεια" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from(new Set(kallikratisData?.map(k => k.perifereia))).map((region) => (
                                        <SelectItem key={region} value={region}>
                                          {region}
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
                            name={`location_details.${index}.regional_unit`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Περιφερειακή Ενότητα</FormLabel>
                                <FormControl>
                                  <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    // Clear dependent fields
                                    form.setValue(`location_details.${index}.municipality`, "");
                                    form.setValue(`location_details.${index}.municipal_community`, "");
                                  }} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε περιφερειακή ενότητα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from(new Set(
                                        kallikratisData
                                          ?.filter(k => k.perifereia === form.watch(`location_details.${index}.region`))
                                          .map(k => k.perifereiaki_enotita)
                                      )).map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {unit}
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
                            name={`location_details.${index}.municipality`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Δήμος</FormLabel>
                                <FormControl>
                                  <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue(`location_details.${index}.municipal_community`, "");
                                  }} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε δήμο" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from(new Set(
                                        kallikratisData
                                          ?.filter(k => 
                                            k.perifereia === form.watch(`location_details.${index}.region`) &&
                                            k.perifereiaki_enotita === form.watch(`location_details.${index}.regional_unit`)
                                          )
                                          .map(k => k.onoma_neou_ota)
                                      )).map((municipality) => (
                                        <SelectItem key={municipality} value={municipality}>
                                          {municipality}
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
                                <FormLabel className="text-xs font-medium">Φορέας Υλοποίησης</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Επιλέξτε φορέα" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unitsData?.map((unit) => (
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
                        
                        {/* Expenditure Types Multi-Select */}
                        <div className="mt-3">
                          <FormLabel className="text-xs font-medium mb-2 block">Τύποι Δαπανών</FormLabel>
                          <div className="grid grid-cols-4 gap-2">
                            {expenditureTypesData?.map((expType) => (
                              <div key={expType.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`exp-${index}-${expType.id}`}
                                  checked={form.watch(`location_details.${index}.expenditure_types`)?.includes(expType.id.toString()) || false}
                                  onChange={(e) => {
                                    const current = form.getValues(`location_details.${index}.expenditure_types`) || [];
                                    const expTypeId = expType.id.toString();
                                    if (e.target.checked) {
                                      form.setValue(`location_details.${index}.expenditure_types`, [...current, expTypeId]);
                                    } else {
                                      form.setValue(`location_details.${index}.expenditure_types`, current.filter(id => id !== expTypeId));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor={`exp-${index}-${expType.id}`} className="text-xs text-gray-700 cursor-pointer">
                                  {expType.expediture_types}
                                </label>
                                {form.watch(`location_details.${index}.expenditure_types`)?.includes(expType.id.toString()) && (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentLocations = form.getValues("location_details");
                          form.setValue("location_details", [
                            ...currentLocations,
                            { municipal_community: "", municipality: "", regional_unit: "", region: "", implementing_agency: "", expenditure_types: [] }
                          ]);
                        }}
                        className="text-sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Προσθήκη Τοποθεσίας
                      </Button>
                      {form.watch("location_details").length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentLocations = form.getValues("location_details");
                            form.setValue("location_details", currentLocations.slice(0, -1));
                          }}
                          className="text-sm"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Αφαίρεση
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Project Details */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    3. Στοιχεία Έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="project_details.mis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MIS</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="MIS κωδικός" />
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
                    <FormField
                      control={form.control}
                      name="project_details.project_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Περιγραφή Έργου</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Εισάγετε την περιγραφή του έργου" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name="project_details.project_title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τίτλος Έργου</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Εισάγετε τον τίτλο του έργου" rows={3} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: Formulation Details (Στοιχεία κατάρτισης έργου) */}
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-gradient-to-r from-red-50 to-pink-50 border-b border-gray-200">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    4. Στοιχεία κατάρτισης έργου
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {form.watch("formulation_details").map((_, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="grid grid-cols-6 gap-3 mb-3">
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.sa`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">ΣΑ</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
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
                            name={`formulation_details.${index}.protocol_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Αρ. Πρωτοκόλλου</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Πρωτόκολλο" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.ada`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">ΑΔΑ</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ΑΔΑ" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.decision_year`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Έτος</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Έτος" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.project_budget`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Προϋπολογισμός</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Ποσό €" className="text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`formulation_details.${index}.decision_status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">Κατάσταση</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Ενεργή">Ενεργή</SelectItem>
                                      <SelectItem value="Ανενεργή">Ανενεργή</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        {/* Connected Decisions Field - Multiple Selection */}
                        <div className="mt-3">
                          <FormLabel className="text-xs font-medium mb-2 block">Αποφάσεις που συνδέονται</FormLabel>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {form.watch("decisions").map((decision, decisionIndex) => {
                              if (!decision.protocol_number && !decision.fek && !decision.ada) return null;
                              const displayText = `${decision.protocol_number || 'Χωρίς ΚΥΑ'} | ${decision.fek || 'Χωρίς ΦΕΚ'} | ${decision.ada || 'Χωρίς ΑΔΑ'}`;
                              const decisionId = `${decisionIndex}-${decision.protocol_number}-${decision.fek}-${decision.ada}`;
                              
                              return (
                                <div key={decisionIndex} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`connected-${index}-${decisionIndex}`}
                                    checked={form.watch(`formulation_details.${index}.connected_decisions`)?.includes(decisionId) || false}
                                    onChange={(e) => {
                                      const current = form.getValues(`formulation_details.${index}.connected_decisions`) || [];
                                      if (e.target.checked) {
                                        form.setValue(`formulation_details.${index}.connected_decisions`, [...current, decisionId]);
                                      } else {
                                        form.setValue(`formulation_details.${index}.connected_decisions`, current.filter(id => id !== decisionId));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <label htmlFor={`connected-${index}-${decisionIndex}`} className="text-xs text-gray-700 cursor-pointer">
                                    {displayText}
                                  </label>
                                  {form.watch(`formulation_details.${index}.connected_decisions`)?.includes(decisionId) && (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  )}
                                </div>
                              );
                            })}
                            {form.watch("decisions").every(d => !d.protocol_number && !d.fek && !d.ada) && (
                              <p className="text-xs text-gray-500">Δεν υπάρχουν διαθέσιμες αποφάσεις από την Ενότητα 1</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentFormulation = form.getValues("formulation_details");
                          form.setValue("formulation_details", [
                            ...currentFormulation,
                            { sa: "ΝΑ853" as const, enumeration_code: "", protocol_number: "", ada: "", decision_year: "", project_budget: "", epa_version: "", total_public_expense: "", eligible_public_expense: "", decision_status: "Ενεργή" as const, change_type: "Έγκριση" as const, connected_decisions: [], comments: "" }
                          ]);
                        }}
                        className="text-sm"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Προσθήκη Στοιχείων
                      </Button>
                      {form.watch("formulation_details").length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentFormulation = form.getValues("formulation_details");
                            form.setValue("formulation_details", currentFormulation.slice(0, -1));
                          }}
                          className="text-sm"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Αφαίρεση
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 bg-gray-50 -mx-4 px-4 py-3 rounded-b-lg">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/projects/${mis}`)}
                  className="flex items-center gap-2 text-sm py-2 px-4"
                >
                  <X className="h-3 w-3" />
                  Ακύρωση
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2 text-sm py-2 px-4"
                  disabled={mutation.isPending}
                >
                  <Save className="h-3 w-3" />
                  {mutation.isPending ? "Αποθήκευση..." : "Αποθήκευση"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}