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
import { Plus, Trash2, Save, X, FileText, Calendar, CheckCircle } from "lucide-react";
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

// Complete schema based on Greek government documentation
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
    project_status: z.enum(["Συνεχιζόμενο", "Ολοκληρωμένο", "Απενταγμένο"]).default("Συνεχιζόμενο"),
  }).default({
    mis: "", sa: "", enumeration_code: "", inclusion_year: "", project_title: "",
    project_description: "", summary_description: "", expenses_executed: "", project_status: "Συνεχιζόμενο" as const,
  }),
  
  // Section 3 Previous entries
  previous_entries: z.array(z.object({
    sa: z.string().default(""),
    enumeration_code: z.string().default(""),
  })).default([]),
  
  // Section 4: Project formulation details
  formulation_details: z.array(z.object({
    sa: z.enum(["ΝΑ853", "ΝΑ271", "Ε069"]).default("ΝΑ853"),
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
    connected_decisions: z.string().default(""),
    comments: z.string().default(""),
  })).default([]),
  
  // Section 5: Changes performed
  changes: z.array(z.object({
    description: z.string().default(""),
  })).default([]),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

export default function ComprehensiveEditNew() {
  const { mis } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasPreviousEntries, setHasPreviousEntries] = useState(false);

  // Form setup
  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    defaultValues: {
      decisions: [{ protocol_number: "", fek: "", ada: "", implementing_agency: "", decision_budget: "", expenses_covered: "", decision_type: "Έγκριση", is_included: true, comments: "" }],
      event_details: { event_name: "", event_year: "" },
      location_details: [{ municipal_community: "", municipality: "", regional_unit: "", region: "", implementing_agency: "", expenditure_types: [] }],
      project_details: { mis: "", sa: "", enumeration_code: "", inclusion_year: "", project_title: "", project_description: "", summary_description: "", expenses_executed: "", project_status: "Συνεχιζόμενο" },
      previous_entries: [],
      formulation_details: [{ sa: "ΝΑ853", enumeration_code: "", protocol_number: "", ada: "", decision_year: "", project_budget: "", epa_version: "", total_public_expense: "", eligible_public_expense: "", decision_status: "Ενεργή", change_type: "Έγκριση", connected_decisions: "", comments: "" }],
      changes: [{ description: "" }],
    },
  });

  // Data queries
  const { data: projectData } = useQuery({
    queryKey: [`/api/projects/${mis}`],
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

  // Debug logging for expenditure types
  console.log("Expenditure types data:", expenditureTypesData);

  // Initialize form with project data
  useEffect(() => {
    if (projectData) {
      console.log('Initializing comprehensive form with project data:', projectData);
      const project = projectData;

      // Initialize all sections with actual data
      const decisions = [];
      const maxDecisions = Math.max(
        project.kya?.length || 0,
        project.fek?.length || 0,
        project.ada?.length || 0
      );

      for (let i = 0; i < Math.max(1, maxDecisions); i++) {
        decisions.push({
          protocol_number: project.kya?.[i] || "",
          fek: project.fek?.[i] || "",
          ada: project.ada?.[i] || "",
          implementing_agency: "",
          decision_budget: "",
          expenses_covered: "",
          decision_type: "Έγκριση" as const,
          is_included: true,
          comments: "",
        });
      }

      form.setValue("decisions", decisions);

      // Event details
      form.setValue("event_details", {
        event_name: project.enhanced_event_type?.name || "",
        event_year: project.event_year?.[0] || "",
      });

      // Project details
      form.setValue("project_details", {
        mis: project.mis?.toString() || "",
        sa: project.na853 || project.na271 || project.e069 || "",
        enumeration_code: "",
        inclusion_year: project.event_year?.[0] || "",
        project_title: project.project_title || "",
        project_description: project.event_description || "",
        summary_description: "",
        expenses_executed: "",
        project_status: "Συνεχιζόμενο" as const,
      });

      // Formulation details
      const formulation = [];
      if (project.budget_na853) {
        formulation.push({
          sa: "ΝΑ853" as const,
          enumeration_code: project.na853 || "",
          protocol_number: project.kya?.[0] || "",
          ada: project.ada?.[0] || "",
          decision_year: project.event_year?.[0] || "",
          project_budget: project.budget_na853.toString(),
          epa_version: "",
          total_public_expense: project.budget_na853.toString(),
          eligible_public_expense: project.budget_na853.toString(),
          decision_status: "Ενεργή" as const,
          change_type: "Έγκριση" as const,
          connected_decisions: "",
          comments: "",
        });
      }
      if (project.budget_na271) {
        formulation.push({
          sa: "ΝΑ271" as const,
          enumeration_code: project.na271 || "",
          protocol_number: project.kya?.[1] || project.kya?.[0] || "",
          ada: project.ada?.[1] || project.ada?.[0] || "",
          decision_year: project.event_year?.[0] || "",
          project_budget: project.budget_na271.toString(),
          epa_version: "",
          total_public_expense: project.budget_na271.toString(),
          eligible_public_expense: project.budget_na271.toString(),
          decision_status: "Ενεργή" as const,
          change_type: "Έγκριση" as const,
          connected_decisions: "",
          comments: "",
        });
      }
      if (project.budget_e069) {
        formulation.push({
          sa: "Ε069" as const,
          enumeration_code: project.e069 || "",
          protocol_number: project.kya?.[2] || project.kya?.[0] || "",
          ada: project.ada?.[2] || project.ada?.[0] || "",
          decision_year: project.event_year?.[0] || "",
          project_budget: project.budget_e069.toString(),
          epa_version: "",
          total_public_expense: project.budget_e069.toString(),
          eligible_public_expense: project.budget_e069.toString(),
          decision_status: "Ενεργή" as const,
          change_type: "Έγκριση" as const,
          connected_decisions: "",
          comments: "",
        });
      }

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
          connected_decisions: "",
          comments: "",
        });
      }

      form.setValue("formulation_details", formulation);

      console.log('Form initialized with comprehensive data structure');
    }
  }, [projectData, form]);

  // Array management functions
  const addDecision = () => {
    const current = form.getValues("decisions");
    form.setValue("decisions", [...current, { protocol_number: "", fek: "", ada: "", implementing_agency: "", decision_budget: "", expenses_covered: "", decision_type: "Έγκριση", is_included: true, comments: "" }]);
  };

  const removeDecision = (index: number) => {
    const current = form.getValues("decisions");
    form.setValue("decisions", current.filter((_, i) => i !== index));
  };

  const addLocationDetail = () => {
    const current = form.getValues("location_details");
    form.setValue("location_details", [...current, { municipal_community: "", municipality: "", regional_unit: "", region: "", implementing_agency: "", expenditure_types: [] }]);
  };

  const removeLocationDetail = (index: number) => {
    const current = form.getValues("location_details");
    form.setValue("location_details", current.filter((_, i) => i !== index));
  };

  const addFormulationDetail = () => {
    const current = form.getValues("formulation_details");
    form.setValue("formulation_details", [...current, { sa: "ΝΑ853", enumeration_code: "", protocol_number: "", ada: "", decision_year: "", project_budget: "", epa_version: "", total_public_expense: "", eligible_public_expense: "", decision_status: "Ενεργή", change_type: "Έγκριση", connected_decisions: "", comments: "" }]);
  };

  const removeFormulationDetail = (index: number) => {
    const current = form.getValues("formulation_details");
    form.setValue("formulation_details", current.filter((_, i) => i !== index));
  };

  const addChange = () => {
    const current = form.getValues("changes");
    form.setValue("changes", [...current, { description: "" }]);
  };

  const removeChange = (index: number) => {
    const current = form.getValues("changes");
    form.setValue("changes", current.filter((_, i) => i !== index));
  };

  const addPreviousEntry = () => {
    const current = form.getValues("previous_entries");
    form.setValue("previous_entries", [...current, { sa: "", enumeration_code: "" }]);
  };

  const removePreviousEntry = (index: number) => {
    const current = form.getValues("previous_entries");
    form.setValue("previous_entries", current.filter((_, i) => i !== index));
  };

  // Helper functions for cascading dropdowns
  const getFilteredOptions = (level: string, locationIndex: number) => {
    if (!kallikratisData) return [];
    
    const currentLocation = form.watch("location_details")[locationIndex];
    if (!currentLocation) return [];

    let filtered = kallikratisData;

    switch (level) {
      case 'region':
        // Get unique region values (Περιφέρεια)
        return Array.from(new Set(filtered.map(item => item.perifereia)))
          .filter(Boolean)
          .sort();

      case 'regional_unit':
        if (!currentLocation.region) return [];
        filtered = filtered.filter(item => item.perifereia === currentLocation.region);
        return Array.from(new Set(filtered.map(item => item.perifereiaki_enotita)))
          .filter(Boolean)
          .sort();

      case 'municipality':
        if (!currentLocation.regional_unit) return [];
        filtered = filtered.filter(item => 
          item.perifereia === currentLocation.region &&
          item.perifereiaki_enotita === currentLocation.regional_unit
        );
        return Array.from(new Set(filtered.map(item => `${item.eidos_neou_ota} ${item.onoma_neou_ota}`.trim())))
          .filter(Boolean)
          .sort();

      case 'municipal_community':
        if (!currentLocation.municipality) return [];
        filtered = filtered.filter(item => 
          item.perifereia === currentLocation.region &&
          item.perifereiaki_enotita === currentLocation.regional_unit &&
          `${item.eidos_neou_ota} ${item.onoma_neou_ota}`.trim() === currentLocation.municipality
        );
        return Array.from(new Set(filtered.map(item => `${item.eidos_koinotitas} ${item.onoma_dimotikis_enotitas}`.trim())))
          .filter(Boolean)
          .sort();

      default:
        return [];
    }
  };

  // Update location field and clear dependent fields
  const updateLocationField = (locationIndex: number, field: string, value: string) => {
    const currentLocations = form.getValues("location_details");
    const updatedLocations = [...currentLocations];
    
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      [field]: value,
      // Clear dependent fields when parent changes
      ...(field === 'region' && {
        regional_unit: "",
        municipality: "",
        municipal_community: ""
      }),
      ...(field === 'regional_unit' && {
        municipality: "",
        municipal_community: ""
      }),
      ...(field === 'municipality' && {
        municipal_community: ""
      })
    };
    
    form.setValue("location_details", updatedLocations);
  };

  // Toggle expenditure type selection
  const toggleExpenditureType = (locationIndex: number, expenditureType: string) => {
    const currentLocations = form.getValues("location_details");
    const updatedLocations = [...currentLocations];
    const currentTypes = updatedLocations[locationIndex].expenditure_types || [];
    
    updatedLocations[locationIndex].expenditure_types = currentTypes.includes(expenditureType)
      ? currentTypes.filter(t => t !== expenditureType)
      : [...currentTypes, expenditureType];
    
    form.setValue("location_details", updatedLocations);
  };

  // Form submission
  const mutation = useMutation({
    mutationFn: (data: ComprehensiveFormData) => 
      apiRequest(`/api/projects/${mis}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Επιτυχία", description: "Τα στοιχεία του έργου ενημερώθηκαν επιτυχώς" });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      navigate(`/projects/${mis}`);
    },
    onError: () => {
      toast({ title: "Σφάλμα", description: "Παρουσιάστηκε σφάλμα κατά την ενημέρωση", variant: "destructive" });
    },
  });

  const handleSubmit = (data: ComprehensiveFormData) => {
    console.log('Submitting comprehensive form data:', data);
    mutation.mutate(data);
  };

  if (!projectData) {
    return <div className="flex justify-center items-center h-64">Φόρτωση...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Φόρμα Έργου - {projectData.project_title}</h1>
        <p className="text-gray-600">MIS: {projectData.mis}</p>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">📋 Καρτέλα Στοιχείων</TabsTrigger>
          <TabsTrigger value="edit">✏️ Καταχώρηση ή Τροποποίηση</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Καρτέλα στοιχείων (Στατική προβολή)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <strong>MIS:</strong> {projectData.mis}
                </div>
                <div>
                  <strong>Τίτλος:</strong> {projectData.project_title}
                </div>
                <div>
                  <strong>Περιγραφή:</strong> {projectData.event_description}
                </div>
                <div>
                  <strong>Προϋπολογισμός ΝΑ853:</strong> {projectData.budget_na853}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
              {/* Section 1: Decisions */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    1️⃣ Αποφάσεις που τεκμηριώνουν το έργο
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="border border-gray-300 p-2 text-sm">α.α.</th>
                          <th className="border border-gray-300 p-2 text-sm">Αρ. πρωτ. Απόφασης</th>
                          <th className="border border-gray-300 p-2 text-sm">ΦΕΚ</th>
                          <th className="border border-gray-300 p-2 text-sm">ΑΔΑ</th>
                          <th className="border border-gray-300 p-2 text-sm">Φορέας υλοποίησης</th>
                          <th className="border border-gray-300 p-2 text-sm">Προϋπολογισμός Απόφασης</th>
                          <th className="border border-gray-300 p-2 text-sm">Δαπάνες που αφορά</th>
                          <th className="border border-gray-300 p-2 text-sm">Είδος Απόφασης</th>
                          <th className="border border-gray-300 p-2 text-sm">Έχει συμπεριληφθεί</th>
                          <th className="border border-gray-300 p-2 text-sm">Σχόλια</th>
                          <th className="border border-gray-300 p-2 text-sm">Ενέργειες</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.watch("decisions").map((_, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 p-1 text-center">{index + 1}</td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.protocol_number`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.fek`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.ada`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.implementing_agency`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.decision_budget`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} type="number" className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.expenses_covered`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.decision_type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="border-0 p-1">
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
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.is_included`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value ? "Ναι" : "Όχι"} onValueChange={(value) => field.onChange(value === "Ναι")}>
                                        <SelectTrigger className="border-0 p-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Ναι">Ναι</SelectItem>
                                          <SelectItem value="Όχι">Όχι</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`decisions.${index}.comments`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1 text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeDecision(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Button type="button" onClick={addDecision} className="mt-4 bg-green-600 hover:bg-green-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Προσθήκη Απόφασης
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Event Details */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    2️⃣ Στοιχεία συμβάντος
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Basic event info */}
                  <table className="w-full border-collapse border border-gray-300 mb-4">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border border-gray-300 p-2">Συμβάν</th>
                        <th className="border border-gray-300 p-2">Έτος εκδήλωσης συμβάντος</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="event_details.event_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="border-0">
                                      <SelectValue placeholder="Επιλέξτε συμβάν" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {eventTypesData?.map((eventType: any) => (
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
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="event_details.event_year"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0" placeholder="π.χ. 2024" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Location details with 4-level cascading dropdowns and multi-select expenditure types */}
                  <div className="mt-8 space-y-8">
                    {form.watch("location_details").map((location, index) => (
                      <Card key={index} className="bg-white border border-gray-300 shadow-sm rounded-lg overflow-hidden">
                        <div className="bg-gray-100 border-b border-gray-300 p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-800">
                              Location Entry {index + 1}
                            </h4>
                            {form.watch("location_details").length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeLocationDetail(index)}
                                className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="p-8 space-y-8">

                          {/* 4-Level Cascading Geographic Hierarchy */}
                          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                            <h5 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-300 pb-2">
                              Geographic Hierarchy
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Περιφέρεια (Region) */}
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Region (Περιφέρεια)</label>
                                <Select
                                  value={location.region}
                                  onValueChange={(value) => updateLocationField(index, 'region', value)}
                                >
                                  <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
                                    <SelectValue placeholder="Select region..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getFilteredOptions('region', index).map((option, optIndex) => (
                                      <SelectItem key={`region-${index}-${optIndex}`} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                          {/* Περιφερειακή Ενότητα (Regional Unit) */}
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Regional Unit (Περιφερειακή Ενότητα)</label>
                                <Select
                                  value={location.regional_unit}
                                  onValueChange={(value) => updateLocationField(index, 'regional_unit', value)}
                                  disabled={!location.region}
                                >
                                  <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors disabled:bg-gray-100">
                                    <SelectValue placeholder="Select regional unit..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="italic text-gray-500">
                                      -- Clear Selection --
                                    </SelectItem>
                                    {getFilteredOptions('regional_unit', index).map((option, optIndex) => (
                                      <SelectItem key={`regional-unit-${index}-${optIndex}`} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                          {/* Δήμος (Municipality) */}
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Municipality (Δήμος)</label>
                                <Select
                                  value={location.municipality}
                                  onValueChange={(value) => updateLocationField(index, 'municipality', value)}
                                  disabled={!location.regional_unit}
                                >
                                  <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors disabled:bg-gray-100">
                                    <SelectValue placeholder="Select municipality..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="italic text-gray-500">
                                      -- Clear Selection --
                                    </SelectItem>
                                    {getFilteredOptions('municipality', index).map((option, optIndex) => (
                                      <SelectItem key={`municipality-${index}-${optIndex}`} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                          {/* Δημ. Ενότητα (Municipal Community) */}
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Municipal Community (Δημοτική Ενότητα)</label>
                                <Select
                                  value={location.municipal_community}
                                  onValueChange={(value) => updateLocationField(index, 'municipal_community', value)}
                                  disabled={!location.municipality}
                                >
                                  <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors disabled:bg-gray-100">
                                    <SelectValue placeholder="Select municipal community..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="italic text-gray-500">
                                      -- Clear Selection --
                                    </SelectItem>
                                    {getFilteredOptions('municipal_community', index).map((option, optIndex) => (
                                      <SelectItem key={`municipal-community-${index}-${optIndex}`} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Implementing Agency */}
                          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-3 border-b border-gray-300 pb-2">
                              Implementing Agency (Φορέας υλοποίησης)
                            </label>
                            <Select
                              value={location.implementing_agency}
                              onValueChange={(value) => updateLocationField(index, 'implementing_agency', value)}
                            >
                              <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
                                <SelectValue placeholder="Select implementing agency..." />
                              </SelectTrigger>
                              <SelectContent>
                                {unitsData?.map((unit: any, unitIndex: number) => (
                                  <SelectItem key={`unit-${index}-${unitIndex}`} value={unit.unit_name || unit.name}>
                                    {unit.unit_name || unit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Multi-Select Expenditure Types */}
                          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-3 border-b border-gray-300 pb-2">
                              Expenditure Types (Τύπος Δαπάνης)
                            </label>
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {expenditureTypesData?.map((expType: any) => {
                                  const isSelected = location.expenditure_types?.includes(expType.expediture_types);
                                  return (
                                    <button
                                      key={`${index}-${expType.id}`}
                                      type="button"
                                      onClick={() => toggleExpenditureType(index, expType.expediture_types)}
                                      className={`px-4 py-3 text-sm rounded-lg border transition-all duration-200 font-medium text-left ${
                                        isSelected
                                          ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm'
                                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {isSelected && <CheckCircle className="h-4 w-4 text-blue-600" />}
                                        <span>{expType.expediture_types}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              {location.expenditure_types?.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                  <p className="text-blue-800 font-medium">
                                    Selected: {location.expenditure_types.length} expenditure type(s)
                                  </p>
                                  <p className="text-sm text-blue-600 mt-1">
                                    {location.expenditure_types.join(", ")}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    
                    <Button 
                      type="button" 
                      onClick={addLocationDetail} 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg shadow-sm hover:shadow transition-all duration-200"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Location Entry
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Project Details */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle>3️⃣ Στοιχεία έργου</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border border-gray-300 p-2 text-sm">MIS</th>
                        <th className="border border-gray-300 p-2 text-sm">ΣΑ</th>
                        <th className="border border-gray-300 p-2 text-sm">Κωδικός ενάριθμος</th>
                        <th className="border border-gray-300 p-2 text-sm">Έτος ένταξης</th>
                        <th className="border border-gray-300 p-2 text-sm">Τίτλος έργου (σύστημα)</th>
                        <th className="border border-gray-300 p-2 text-sm">Περιγραφή έργου</th>
                        <th className="border border-gray-300 p-2 text-sm">Συνοπτική περιγραφή έργου</th>
                        <th className="border border-gray-300 p-2 text-sm">Δαπάνες που εκτελούνται από το έργο</th>
                        <th className="border border-gray-300 p-2 text-sm">Κατάσταση έργου</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.mis"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.sa"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.enumeration_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.inclusion_year"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.project_title"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.project_description"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea {...field} rows={2} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.summary_description"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea {...field} rows={2} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.expenses_executed"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="border-0 p-1" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <FormField
                            control={form.control}
                            name="project_details.project_status"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="border-0 p-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Συνεχιζόμενο">Συνεχιζόμενο</SelectItem>
                                      <SelectItem value="Ολοκληρωμένο">Ολοκληρωμένο</SelectItem>
                                      <SelectItem value="Απενταγμένο">Απενταγμένο</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Previous entries checkbox */}
                  <div className="mt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hasPreviousEntries}
                        onChange={(e) => {
                          setHasPreviousEntries(e.target.checked);
                          if (!e.target.checked) {
                            form.setValue("previous_entries", []);
                          } else {
                            form.setValue("previous_entries", [{ sa: "", enumeration_code: "" }]);
                          }
                        }}
                      />
                      Προηγούμενες εγγραφές έργου στο ΠΔΕ
                    </label>
                  </div>

                  {hasPreviousEntries && (
                    <div className="mt-4">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-blue-50">
                            <th className="border border-gray-300 p-2">ΣΑ</th>
                            <th className="border border-gray-300 p-2">Κωδικός Ενάριθμος</th>
                            <th className="border border-gray-300 p-2">Ενέργειες</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.watch("previous_entries").map((_, index) => (
                            <tr key={index}>
                              <td className="border border-gray-300 p-1">
                                <FormField
                                  control={form.control}
                                  name={`previous_entries.${index}.sa`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input {...field} className="border-0 p-1" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-300 p-1">
                                <FormField
                                  control={form.control}
                                  name={`previous_entries.${index}.enumeration_code`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input {...field} className="border-0 p-1" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-300 p-1 text-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removePreviousEntry(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button type="button" onClick={addPreviousEntry} className="mt-4 bg-green-600 hover:bg-green-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη γραμμής
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section 4: Formulation Details */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle>4️⃣ Στοιχεία κατάρτισης έργου</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="border border-gray-300 p-2 text-xs">ΣΑ</th>
                          <th className="border border-gray-300 p-2 text-xs">Κωδικός ενάριθμος</th>
                          <th className="border border-gray-300 p-2 text-xs">Αρ. πρωτ. Απόφασης</th>
                          <th className="border border-gray-300 p-2 text-xs">ΑΔΑ</th>
                          <th className="border border-gray-300 p-2 text-xs">Έτος Απόφασης</th>
                          <th className="border border-gray-300 p-2 text-xs">Προϋπολογισμός έργου</th>
                          <th className="border border-gray-300 p-2 text-xs">Έκδοση ΕΠΑ</th>
                          <th className="border border-gray-300 p-2 text-xs">Συνολική δημόσια δαπάνη</th>
                          <th className="border border-gray-300 p-2 text-xs">Επιλέξιμη δημόσια δαπάνη</th>
                          <th className="border border-gray-300 p-2 text-xs">Κατάσταση Απόφασης</th>
                          <th className="border border-gray-300 p-2 text-xs">Μεταβολή</th>
                          <th className="border border-gray-300 p-2 text-xs">Αποφάσεις που συνδέονται</th>
                          <th className="border border-gray-300 p-2 text-xs">Σχόλια</th>
                          <th className="border border-gray-300 p-2 text-xs">Ενέργειες</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.watch("formulation_details").map((_, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.sa`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="border-0 p-1 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ΝΑ853">ΝΑ853</SelectItem>
                                          <SelectItem value="ΝΑ271">ΝΑ271</SelectItem>
                                          <SelectItem value="Ε069">Ε069</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.enumeration_code`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.protocol_number`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.ada`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.decision_year`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.project_budget`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} type="number" className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.epa_version`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.total_public_expense`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} type="number" className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.eligible_public_expense`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} type="number" className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.decision_status`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="border-0 p-1 h-8">
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
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.change_type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="border-0 p-1 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                          <SelectItem value="Παράταση">Παράταση</SelectItem>
                                          <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.connected_decisions`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.comments`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="border-0 p-1 h-8 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-1 text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeFormulationDetail(index)}
                                className="text-red-600 hover:text-red-700 h-8"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Button type="button" onClick={addFormulationDetail} className="mt-4 bg-green-600 hover:bg-green-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Προσθήκη γραμμής
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: Changes */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle>5️⃣ Αλλαγές που επιτελέστηκαν</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border border-gray-300 p-2">Περιγραφή αλλαγής/Παρατήρηση</th>
                        <th className="border border-gray-300 p-2">Ενέργειες</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.watch("changes").map((_, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 p-1">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Textarea {...field} rows={3} className="border-0 p-1" placeholder="Περιγραφή αλλαγής/Παρατήρηση" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="border border-gray-300 p-1 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeChange(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Button type="button" onClick={addChange} className="mt-4 bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Προσθήκη γραμμής
                  </Button>
                </CardContent>
              </Card>

              {/* Action buttons */}
              <div className="flex gap-4 justify-end pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/projects/${mis}`)}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Ακύρωση
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                  disabled={mutation.isPending}
                >
                  <Save className="h-4 w-4" />
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