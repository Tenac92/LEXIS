import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Plus, X } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertProjectSchema, type Project } from "@shared/schema";
import { z } from "zod";

// Extended schema for comprehensive project editing
const comprehensiveProjectSchema = z.object({
  // Section 1: Decisions
  decisions: z.array(z.object({
    protocol_number: z.string().optional(),
    fek: z.string().optional(),
    ada: z.string().optional(),
    implementing_agency: z.string().optional(),
    decision_budget: z.string().optional(),
    expenses_covered: z.string().optional(),
    decision_type: z.enum(["Έγκριση", "Τροποποίηση", "Παράταση"]).optional(),
    is_included: z.enum(["Ναι", "Όχι"]).optional(),
    comments: z.string().optional(),
  })).optional(),
  
  // Section 2: Event details
  event_details: z.object({
    event_name: z.string().optional(),
    event_year: z.string().optional(),
    locations: z.array(z.object({
      municipal_community: z.string().optional(),
      municipality: z.string().optional(),
      regional_unit: z.string().optional(),
      region: z.string().optional(),
      implementing_agency: z.string().optional(),
    })).optional(),
  }).optional(),
  
  // Section 3: Project details
  project_details: z.object({
    mis: z.string().optional(),
    sa: z.string().optional(),
    enumeration_code: z.string().optional(),
    inclusion_year: z.string().optional(),
    project_title: z.string().optional(),
    project_description: z.string().optional(),
    project_summary: z.string().optional(),
    executed_expenses: z.string().optional(),
    project_status: z.enum(["Συνεχιζόμενο", "Ολοκληρωμένο", "Απενταγμένο"]).optional(),
    has_previous_entries: z.boolean().optional(),
    previous_entries: z.array(z.object({
      sa: z.string().optional(),
      enumeration_code: z.string().optional(),
    })).optional(),
  }).optional(),
  
  // Section 4: Project formulation details
  formulation_details: z.array(z.object({
    sa: z.enum(["ΝΑ853", "ΝΑ271", "Ε069"]).optional(),
    enumeration_code: z.string().optional(),
    protocol_number: z.string().optional(),
    ada: z.string().optional(),
    decision_year: z.string().optional(),
    project_budget: z.string().optional(),
    epa_version: z.string().optional(),
    total_public_expenditure: z.string().optional(),
    eligible_public_expenditure: z.string().optional(),
    decision_status: z.enum(["Ενεργή", "Ανενεργή"]).optional(),
    modification_type: z.enum(["Τροποποίηση", "Παράταση", "Έγκριση"]).optional(),
    connected_decisions: z.string().optional(),
    comments: z.string().optional(),
  })).optional(),
  
  // Section 5: Changes made
  changes: z.array(z.object({
    description: z.string().optional(),
  })).optional(),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

export default function ComprehensiveEditProjectPage() {
  const { mis } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("summary");

  console.log("Edit Project Page - MIS Parameter:", mis);

  // Fetch project data
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/projects', mis],
    enabled: !!mis,
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
  });

  // Fetch budget data
  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['/api/budget', mis],
    enabled: !!mis,
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  // Fetch reference data for dropdowns
  const { data: kallikratisData } = useQuery({
    queryKey: ['/api/kallikratis'],
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  const { data: unitsData } = useQuery({
    queryKey: ['/api/public/units'],
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  const { data: eventTypesData } = useQuery({
    queryKey: ['/api/event-types'],
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  const { data: expenditureTypesData } = useQuery({
    queryKey: ['/api/expenditure-types'],
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  console.log("Edit Project Page - MIS Parameter:", mis);
  console.log("Kallikratis data loaded:", kallikratisData?.length || 0, "entries");
  console.log("Units data loaded:", unitsData?.length || 0, "entries");
  console.log("Units data structure:", unitsData?.slice(0, 2));

  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    defaultValues: {
      decisions: [{}],
      event_details: {
        locations: [{}],
      },
      project_details: {
        has_previous_entries: false,
        previous_entries: [],
      },
      formulation_details: [{}],
      changes: [{}],
    },
  });

  // Update form values when project data loads
  useEffect(() => {
    if (projectData?.project) {
      const project = projectData.project;
      
      // Populate project details section
      form.setValue("project_details.mis", project.mis?.toString() || "");
      form.setValue("project_details.project_title", project.title || "");
      form.setValue("project_details.project_description", project.event_description || "");
      form.setValue("project_details.project_summary", project.project_title || "");
      
      // Populate event details if available
      if (project.event_type && Array.isArray(project.event_type) && project.event_type.length > 0) {
        form.setValue("event_details.event_name", project.event_type[0] || "");
      }
      
      if (project.event_year && Array.isArray(project.event_year) && project.event_year.length > 0) {
        form.setValue("event_details.event_year", project.event_year[0] || "");
      }

      // Populate implementing agency from existing data
      if (project.implementing_agency && Array.isArray(project.implementing_agency) && project.implementing_agency.length > 0) {
        form.setValue("event_details.locations.0.implementing_agency", project.implementing_agency[0] || "");
      }

      // Set budget fields if available
      if (budgetData) {
        form.setValue("project_details.budget_na853", budgetData.budget_na853?.toString() || "");
      }
      
      console.log("[Comprehensive Edit] Form populated with project data:", project.mis);
    }
  }, [projectData, budgetData, form]);

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ComprehensiveFormData) => {
      // Transform comprehensive form data for proper project updates
      const transformedData = {
        // Core project fields
        title: data.project_details?.project_title || '',
        project_title: data.project_details?.project_summary || '',
        event_description: data.project_details?.project_description || '',
        mis: data.project_details?.mis || '',
        
        // Event and type data
        event_type: data.event_details?.event_name ? [data.event_details.event_name] : [],
        event_year: data.event_details?.event_year ? [data.event_details.event_year] : [],
        
        // Implementing agency
        implementing_agency: data.event_details?.locations?.[0]?.implementing_agency ? 
          [data.event_details.locations[0].implementing_agency] : [],
        
        // Expenditure types from formulation details
        expenditure_type: data.formulation_details?.map(fd => fd.sa).filter(Boolean) || [],
        
        // Region data
        region: data.event_details?.locations?.[0] ? {
          perifereia: data.event_details.locations[0].region || '',
          perifereiaki_enotita: data.event_details.locations[0].regional_unit || '',
          dimos: data.event_details.locations[0].municipality || '',
          dimotiki_enotita: data.event_details.locations[0].municipal_community || ''
        } : {},
        
        // Document fields from decisions
        kya: data.decisions?.map(d => d.protocol_number).filter(Boolean) || [],
        fek: data.decisions?.map(d => d.fek).filter(Boolean) || [],
        ada: data.decisions?.map(d => d.ada).filter(Boolean) || [],
        
        // Budget fields from formulation details
        budget_na853: data.formulation_details?.find(fd => fd.sa === 'ΝΑ853')?.project_budget || '',
        budget_na271: data.formulation_details?.find(fd => fd.sa === 'ΝΑ271')?.project_budget || '',
        budget_e069: data.formulation_details?.find(fd => fd.sa === 'Ε069')?.project_budget || '',
        
        // Project lines for project_index table
        project_lines: [
          {
            implementing_agency: data.event_details?.locations?.[0]?.implementing_agency || '',
            event_type: data.event_details?.event_name || '',
            expenditure_types: data.formulation_details?.map(fd => fd.sa).filter(Boolean) || [],
            region: {
              perifereia: data.event_details?.locations?.[0]?.region || '',
              perifereiaki_enotita: data.event_details?.locations?.[0]?.regional_unit || '',
              dimos: data.event_details?.locations?.[0]?.municipality || '',
              dimotiki_enotita: data.event_details?.locations?.[0]?.municipal_community || ''
            }
          }
        ]
      };
      
      console.log('[Comprehensive Edit] Sending enhanced project data:', transformedData);
      
      return apiRequest(`/api/projects/${mis}`, {
        method: 'PATCH',
        body: JSON.stringify(transformedData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Το έργο ενημερώθηκε επιτυχώς",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Αποτυχία ενημέρωσης έργου",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComprehensiveFormData) => {
    updateProjectMutation.mutate(data);
  };

  // Helper functions for dynamic rows
  const addDecision = () => {
    const currentDecisions = form.getValues("decisions") || [];
    form.setValue("decisions", [...currentDecisions, {}]);
  };

  const removeDecision = (index: number) => {
    const currentDecisions = form.getValues("decisions") || [];
    form.setValue("decisions", currentDecisions.filter((_, i) => i !== index));
  };

  const addLocation = () => {
    const currentLocations = form.getValues("event_details.locations") || [];
    form.setValue("event_details.locations", [...currentLocations, {}]);
  };

  const addFormulationDetail = () => {
    const currentDetails = form.getValues("formulation_details") || [];
    form.setValue("formulation_details", [...currentDetails, {}]);
  };

  const addChange = () => {
    const currentChanges = form.getValues("changes") || [];
    form.setValue("changes", [...currentChanges, {}]);
  };

  const addPreviousEntry = () => {
    const currentEntries = form.getValues("project_details.previous_entries") || [];
    form.setValue("project_details.previous_entries", [...currentEntries, {}]);
  };

  if (projectLoading) {
    return (
      <div className="container mx-auto py-6">
        <Header />
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/projects")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Φόρτωση...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 bg-gray-50 min-h-screen">
      <Header />
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 p-6 border-b bg-blue-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/projects")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-blue-900">
              Φόρμα Έργου - {projectData?.project?.title || mis}
            </h1>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100">
              <TabsTrigger value="summary" className="text-blue-600">
                📋 Καρτέλα Στοιχείων
              </TabsTrigger>
              <TabsTrigger value="edit" className="text-blue-600">
                ✏️ Καταχώρηση ή Τροποποίηση
              </TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Καρτέλα στοιχείων (Στατική προβολή)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <strong>MIS:</strong> {projectData?.project?.mis}
                    </div>
                    <div>
                      <strong>Τίτλος:</strong> {projectData?.project?.title}
                    </div>
                    <div>
                      <strong>Περιγραφή:</strong> {projectData?.project?.description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Edit Tab */}
            <TabsContent value="edit" className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  {/* Section 1: Decisions */}
                  <Card>
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900">
                        1️⃣ Αποφάσεις που τεκμηριώνουν το έργο
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 mb-4">
                          <thead>
                            <tr className="bg-blue-100">
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
                            {(form.watch("decisions") || [{}]).map((_, index) => (
                              <tr key={index}>
                                <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.protocol_number`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.fek`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.ada`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.implementing_agency`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.decision_budget`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.expenses_covered`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.decision_type`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="w-full">
                                              <SelectValue />
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
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.is_included`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="w-full">
                                              <SelectValue />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="Ναι">Ναι</SelectItem>
                                            <SelectItem value="Όχι">Όχι</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.comments`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  {index > 0 && (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => removeDecision(index)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Button type="button" onClick={addDecision} className="bg-green-600 hover:bg-green-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Προσθήκη Απόφασης
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 2: Event Details */}
                  <Card>
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900">
                        2️⃣ Στοιχεία συμβάντος
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <FormField
                          control={form.control}
                          name="event_details.event_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Τύπος Συμβάντος</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε τύπο συμβάντος" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {eventTypesData?.map((eventType: any) => (
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
                              <FormLabel>Έτος εκδήλωσης συμβάντος</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 mb-4">
                          <thead>
                            <tr className="bg-blue-100">
                              <th className="border border-gray-300 p-2 text-sm">Δημοτική Κοινότητα</th>
                              <th className="border border-gray-300 p-2 text-sm">Δήμος</th>
                              <th className="border border-gray-300 p-2 text-sm">Περιφερειακή Ενότητα</th>
                              <th className="border border-gray-300 p-2 text-sm">Περιφέρεια</th>
                              <th className="border border-gray-300 p-2 text-sm">Φορέας υλοποίησης</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(form.watch("event_details.locations") || [{}]).map((_, index) => (
                              <tr key={index}>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`event_details.locations.${index}.municipal_community`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`event_details.locations.${index}.municipality`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`event_details.locations.${index}.regional_unit`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`event_details.locations.${index}.region`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`event_details.locations.${index}.implementing_agency`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="w-full">
                                              <SelectValue placeholder="Επιλέξτε φορέα" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {unitsData?.map((unit: any) => (
                                              <SelectItem key={unit.id} value={unit.name}>
                                                {unit.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Button type="button" onClick={addLocation} className="bg-green-600 hover:bg-green-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Προσθήκη γραμμής
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 3: Project Details */}
                  <Card>
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900">
                        3️⃣ Στοιχεία έργου
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <FormField
                          control={form.control}
                          name="project_details.mis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MIS</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="project_details.enumeration_code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Κωδικός ενάριθμος</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <FormField
                          control={form.control}
                          name="project_details.inclusion_year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Έτος ένταξης</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="project_details.project_status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Κατάσταση έργου</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Συνεχιζόμενο">Συνεχιζόμενο</SelectItem>
                                  <SelectItem value="Ολοκληρωμένο">Ολοκληρωμένο</SelectItem>
                                  <SelectItem value="Απενταγμένο">Απενταγμένο</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="project_details.project_title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Τίτλος έργου (σύστημα)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="project_details.project_description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Περιγραφή έργου</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="project_details.project_summary"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Συνοπτική περιγραφή έργου</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="project_details.executed_expenses"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Δαπάνες που εκτελούνται από το έργο</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="mt-4">
                        <FormField
                          control={form.control}
                          name="project_details.has_previous_entries"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Προηγούμενες εγγραφές έργου στο ΠΔΕ</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      {form.watch("project_details.has_previous_entries") && (
                        <div className="mt-4">
                          <table className="w-full border-collapse border border-gray-300 mb-4">
                            <thead>
                              <tr className="bg-blue-100">
                                <th className="border border-gray-300 p-2 text-sm">ΣΑ</th>
                                <th className="border border-gray-300 p-2 text-sm">Κωδικός Ενάριθμος</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(form.watch("project_details.previous_entries") || [{}]).map((_, index) => (
                                <tr key={index}>
                                  <td className="border border-gray-300 p-2">
                                    <FormField
                                      control={form.control}
                                      name={`project_details.previous_entries.${index}.sa`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input {...field} className="w-full" />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </td>
                                  <td className="border border-gray-300 p-2">
                                    <FormField
                                      control={form.control}
                                      name={`project_details.previous_entries.${index}.enumeration_code`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input {...field} className="w-full" />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Button type="button" onClick={addPreviousEntry} className="bg-green-600 hover:bg-green-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Προσθήκη γραμμής
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Section 4: Formulation Details */}
                  <Card>
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900">
                        4️⃣ Στοιχεία κατάρτισης έργου
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 mb-4 text-sm">
                          <thead>
                            <tr className="bg-blue-100">
                              <th className="border border-gray-300 p-2">ΣΑ</th>
                              <th className="border border-gray-300 p-2">Κωδικός ενάριθμος</th>
                              <th className="border border-gray-300 p-2">Αρ. πρωτ. Απόφασης</th>
                              <th className="border border-gray-300 p-2">ΑΔΑ</th>
                              <th className="border border-gray-300 p-2">Έτος Απόφασης</th>
                              <th className="border border-gray-300 p-2">Προϋπολογισμός έργου</th>
                              <th className="border border-gray-300 p-2">Έκδοση ΕΠΑ</th>
                              <th className="border border-gray-300 p-2">Συνολική δημόσια δαπάνη</th>
                              <th className="border border-gray-300 p-2">Επιλέξιμη δημόσια δαπάνη</th>
                              <th className="border border-gray-300 p-2">Κατάσταση Απόφασης</th>
                              <th className="border border-gray-300 p-2">Μεταβολή</th>
                              <th className="border border-gray-300 p-2">Αποφάσεις που συνδέονται</th>
                              <th className="border border-gray-300 p-2">Σχόλια</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(form.watch("formulation_details") || [{}]).map((_, index) => (
                              <tr key={index}>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`formulation_details.${index}.sa`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="w-full">
                                              <SelectValue placeholder="Επιλέξτε ΣΑ" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="ΝΑ853">ΝΑ853</SelectItem>
                                            <SelectItem value="ΝΑ271">ΝΑ271</SelectItem>
                                            <SelectItem value="Ε069">Ε069</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`formulation_details.${index}.enumeration_code`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" placeholder="Κωδικός" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`formulation_details.${index}.protocol_number`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" placeholder="Αρ. πρωτ." />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`formulation_details.${index}.ada`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" placeholder="ΑΔΑ" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`formulation_details.${index}.decision_year`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" placeholder="Έτος" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <FormField
                                    control={form.control}
                                    name={`formulation_details.${index}.project_budget`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input {...field} className="w-full" placeholder="Προϋπολογισμός" />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Button type="button" onClick={addFormulationDetail} className="bg-green-600 hover:bg-green-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Προσθήκη γραμμής
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 5: Changes */}
                  <Card>
                    <CardHeader className="bg-blue-50">
                      <CardTitle className="text-blue-900">
                        5️⃣ Αλλαγές που επιτελέστηκαν
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {(form.watch("changes") || [{}]).map((_, index) => (
                          <FormField
                            key={index}
                            control={form.control}
                            name={`changes.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Περιγραφή αλλαγής/Παρατήρηση"
                                    className="w-full"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        ))}
                        <Button type="button" onClick={addChange} className="bg-green-600 hover:bg-green-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Προσθήκη γραμμής
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6">
                    <Button
                      type="submit"
                      disabled={updateProjectMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updateProjectMutation.isPending ? "Αποθήκευση..." : "Αποθήκευση"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setLocation("/projects")}
                    >
                      Ακύρωση
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}