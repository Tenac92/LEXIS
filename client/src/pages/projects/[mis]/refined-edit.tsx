import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  FileText, 
  Calendar, 
  CheckCircle, 
  Building2, 
  MapPin,
  Euro,
  Archive,
  Clock,
  AlertCircle,
  ArrowLeft,
  Eye,
  Edit3
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatEuropeanCurrency, parseEuropeanNumber, formatEuropeanNumber, formatNumberWhileTyping } from "@/lib/number-format";
import { LocationManager } from "@/components/projects/LocationManager";

// Form schema with better validation
const ProjectEditSchema = z.object({
  // Basic project info
  project_title: z.string().min(3, "Ο τίτλος πρέπει να έχει τουλάχιστον 3 χαρακτήρες"),
  event_description: z.string().min(10, "Η περιγραφή πρέπει να έχει τουλάχιστον 10 χαρακτήρες"),
  status: z.enum(["Ενεργό", "Ολοκληρωμένο", "Αναστολή", "Ακυρωμένο"]).default("Ενεργό"),
  
  // Budget information with proper validation
  budget_na853: z.string().optional(),
  budget_na271: z.string().optional(),
  budget_e069: z.string().optional(),
  
  // Event details
  event_year: z.string().optional(),
  event_type: z.string().optional(),
  
  // Administrative codes
  na853: z.string().optional(),
  na271: z.string().optional(),
  e069: z.string().optional(),
  
  // Implementation details
  implementing_agency: z.string().optional(),
  expenditure_types: z.array(z.string()).default([]),
  
  // Location information
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
  
  // Project notes and comments
  comments: z.string().optional(),
});

type ProjectEditFormData = z.infer<typeof ProjectEditSchema>;

export default function RefinedProjectEdit() {
  const { mis } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [formProgress, setFormProgress] = useState(0);

  // Form setup
  const form = useForm<ProjectEditFormData>({
    resolver: zodResolver(ProjectEditSchema),
    defaultValues: {
      project_title: "",
      event_description: "",
      status: "Ενεργό",
      budget_na853: "",
      budget_na271: "",
      budget_e069: "",
      event_year: "",
      event_type: "",
      na853: "",
      na271: "",
      e069: "",
      implementing_agency: "",
      expenditure_types: [],
      location_details: [],
      comments: "",
    },
  });

  // Data queries
  const { data: projectData, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: [`/api/projects/${mis}/complete`],
    enabled: !!mis,
  });

  const { data: eventTypesData } = useQuery({
    queryKey: ['/api/lookup/event-types'],
  });

  const { data: unitsData } = useQuery({
    queryKey: ['/api/lookup/units'],
  });

  const { data: expenditureTypesData } = useQuery({
    queryKey: ['/api/lookup/expenditure-types'],
  });

  const { data: kallikratisData } = useQuery({
    queryKey: ['/api/lookup/kallikratis'],
  });

  // Form mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ProjectEditFormData) => {
      // Convert budget strings to numbers
      const budgetData = {
        budget_na853: data.budget_na853 ? parseEuropeanNumber(data.budget_na853) : null,
        budget_na271: data.budget_na271 ? parseEuropeanNumber(data.budget_na271) : null,
        budget_e069: data.budget_e069 ? parseEuropeanNumber(data.budget_e069) : null,
      };

      return apiRequest(`/api/projects/${mis}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          ...budgetData,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Το έργο ενημερώθηκε επιτυχώς",
      });
      setUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
    },
    onError: (error) => {
      toast({
        title: "Σφάλμα",
        description: "Παρουσιάστηκε σφάλμα κατά την ενημέρωση",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });

  // Initialize form with project data
  useEffect(() => {
    if (projectData?.project) {
      const project = projectData.project;
      
      form.reset({
        project_title: project.project_title || "",
        event_description: project.event_description || "",
        status: project.status || "Ενεργό",
        budget_na853: project.budget_na853 ? formatEuropeanNumber(project.budget_na853) : "",
        budget_na271: project.budget_na271 ? formatEuropeanNumber(project.budget_na271) : "",
        budget_e069: project.budget_e069 ? formatEuropeanNumber(project.budget_e069) : "",
        event_year: project.event_year?.toString() || "",
        event_type: project.enhanced_event_type?.name || "",
        na853: project.na853 || "",
        na271: project.na271 || "",
        e069: project.e069 || "",
        implementing_agency: project.enhanced_unit?.name || "",
        expenditure_types: project.enhanced_expenditure_type?.expenditure_types ? [project.enhanced_expenditure_type.expenditure_types] : [],
        location_details: [], // Will be populated from index data
        comments: "",
      });
    }
  }, [projectData, form]);

  // Calculate form completion progress
  useEffect(() => {
    const watchedValues = form.watch();
    const totalFields = Object.keys(watchedValues).length;
    const filledFields = Object.values(watchedValues).filter(value => 
      value !== "" && value !== null && value !== undefined && 
      (Array.isArray(value) ? value.length > 0 : true)
    ).length;
    
    setFormProgress(Math.round((filledFields / totalFields) * 100));
  }, [form.watch()]);

  // Track unsaved changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSubmit = (data: ProjectEditFormData) => {
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    if (unsavedChanges) {
      if (confirm("Έχετε μη αποθηκευμένες αλλαγές. Θέλετε να συνεχίσετε;")) {
        setLocation(`/projects/${mis}`);
      }
    } else {
      setLocation(`/projects/${mis}`);
    }
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Φόρτωση στοιχείων έργου...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projectError || !projectData?.project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
              <p className="text-destructive">Σφάλμα κατά τη φόρτωση του έργου</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setLocation('/projects')}
              >
                Επιστροφή στα Έργα
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = projectData.project;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Πίσω
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Επεξεργασία Έργου</h1>
                <p className="text-sm text-muted-foreground">MIS: {project.mis}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {unsavedChanges && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Μη αποθηκευμένο
                </Badge>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/projects/${mis}`)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Προβολή
              </Button>
              
              <Button
                onClick={form.handleSubmit(handleSubmit)}
                disabled={updateMutation.isPending || !form.formState.isValid}
                className="gap-2"
              >
                {updateMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Αποθήκευση
              </Button>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Πρόοδος Φόρμας:</span>
              <span className="font-medium">{formProgress}%</span>
            </div>
            <Progress value={formProgress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Επισκόπηση
                </TabsTrigger>
                <TabsTrigger value="details" className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  Λεπτομέρειες
                </TabsTrigger>
                <TabsTrigger value="budget" className="gap-2">
                  <Euro className="h-4 w-4" />
                  Προϋπολογισμός
                </TabsTrigger>
                <TabsTrigger value="location" className="gap-2">
                  <MapPin className="h-4 w-4" />
                  Τοποθεσία
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Βασικά Στοιχεία
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="project_title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τίτλος Έργου *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Εισάγετε τον τίτλο του έργου" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="event_description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Περιγραφή Συμβάντος *</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Περιγράψτε το συμβάν που οδήγησε στη δημιουργία του έργου"
                                rows={4}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Κατάσταση Έργου</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Ενεργό">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    Ενεργό
                                  </div>
                                </SelectItem>
                                <SelectItem value="Ολοκληρωμένο">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    Ολοκληρωμένο
                                  </div>
                                </SelectItem>
                                <SelectItem value="Αναστολή">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    Αναστολή
                                  </div>
                                </SelectItem>
                                <SelectItem value="Ακυρωμένο">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    Ακυρωμένο
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Στοιχεία Συμβάντος
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="event_type"
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="event_year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Έτος Συμβάντος</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="π.χ. 2024" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="implementing_agency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Φορέας Υλοποίησης</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε φορέα" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {unitsData?.map((unit: any) => (
                                  <SelectItem key={unit.id} value={unit.name || unit.unit}>
                                    {unit.name || unit.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Archive className="h-5 w-5" />
                      Κωδικοί ΣΑ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="na853"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ΝΑ853</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Κωδικός ΝΑ853" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="na271"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ΝΑ271</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Κωδικός ΝΑ271" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="e069"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E069</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Κωδικός E069" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Τύποι Δαπανών</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {expenditureTypesData?.map((expenditure: any) => (
                        <FormField
                          key={expenditure.id}
                          control={form.control}
                          name="expenditure_types"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(expenditure.expenditure_types)}
                                  onCheckedChange={(checked) => {
                                    const updatedTypes = checked
                                      ? [...(field.value || []), expenditure.expenditure_types]
                                      : field.value?.filter((type) => type !== expenditure.expenditure_types) || [];
                                    field.onChange(updatedTypes);
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {expenditure.expenditure_types}
                                </FormLabel>
                                {expenditure.expenditure_types_minor && (
                                  <p className="text-xs text-muted-foreground">
                                    {expenditure.expenditure_types_minor}
                                  </p>
                                )}
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Επιπλέον Σημειώσεις</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Σχόλια και Παρατηρήσεις</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Προσθέστε επιπλέον σημειώσεις ή σχόλια για το έργο"
                              rows={4}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Budget Tab */}
              <TabsContent value="budget" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Euro className="h-5 w-5" />
                      Προϋπολογισμοί
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="budget_na853"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Προϋπολογισμός ΝΑ853</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="0,00 €"
                                onChange={(e) => {
                                  const formatted = formatNumberWhileTyping(e.target.value);
                                  field.onChange(formatted);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="budget_na271"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Προϋπολογισμός ΝΑ271</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="0,00 €"
                                onChange={(e) => {
                                  const formatted = formatNumberWhileTyping(e.target.value);
                                  field.onChange(formatted);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="budget_e069"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Προϋπολογισμός E069</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="0,00 €"
                                onChange={(e) => {
                                  const formatted = formatNumberWhileTyping(e.target.value);
                                  field.onChange(formatted);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Budget Summary */}
                    <Separator className="my-6" />
                    <div className="space-y-3">
                      <h4 className="font-medium">Σύνοψη Προϋπολογισμού</h4>
                      <div className="grid gap-3 text-sm">
                        {form.watch("budget_na853") && (
                          <div className="flex justify-between">
                            <span>ΝΑ853:</span>
                            <span className="font-medium">
                              {formatEuropeanCurrency(parseEuropeanNumber(form.watch("budget_na853") || "0"))}
                            </span>
                          </div>
                        )}
                        {form.watch("budget_na271") && (
                          <div className="flex justify-between">
                            <span>ΝΑ271:</span>
                            <span className="font-medium">
                              {formatEuropeanCurrency(parseEuropeanNumber(form.watch("budget_na271") || "0"))}
                            </span>
                          </div>
                        )}
                        {form.watch("budget_e069") && (
                          <div className="flex justify-between">
                            <span>E069:</span>
                            <span className="font-medium">
                              {formatEuropeanCurrency(parseEuropeanNumber(form.watch("budget_e069") || "0"))}
                            </span>
                          </div>
                        )}
                        
                        {(form.watch("budget_na853") || form.watch("budget_na271") || form.watch("budget_e069")) && (
                          <>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                              <span>Συνολικός Προϋπολογισμός:</span>
                              <span>
                                {formatEuropeanCurrency(
                                  parseEuropeanNumber(form.watch("budget_na853") || "0") +
                                  parseEuropeanNumber(form.watch("budget_na271") || "0") +
                                  parseEuropeanNumber(form.watch("budget_e069") || "0")
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Location Tab */}
              <TabsContent value="location" className="space-y-6">
                <LocationManager
                  form={form}
                  eventTypesData={eventTypesData}
                  unitsData={unitsData}
                  expenditureTypesData={expenditureTypesData}
                  kallikratisData={kallikratisData}
                />
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>
    </div>
  );
}