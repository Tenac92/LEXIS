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
    connected_decisions: z.string().default(""),
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
      formulation_details: [{ sa: "ΝΑ853", enumeration_code: "", protocol_number: "", ada: "", decision_year: "", project_budget: "", epa_version: "", total_public_expense: "", eligible_public_expense: "", decision_status: "Ενεργή", change_type: "Έγκριση", connected_decisions: "", comments: "" }],
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
      return await apiRequest(`/api/projects/${mis}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
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
      // Form initialization logic here
    }
  }, [projectData, form]);

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
              {/* Simple form for testing */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Βασικά Στοιχεία
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <FormField
                    control={form.control}
                    name="project_details.project_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Τίτλος Έργου</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Εισάγετε τον τίτλο του έργου" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
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