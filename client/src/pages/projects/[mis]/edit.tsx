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
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertProjectSchema, type Project, type BudgetNA853Split } from "@shared/schema";
import { z } from "zod";

// Create an extended schema for updates - all fields are optional
const updateProjectSchema = insertProjectSchema.partial();
type UpdateFormData = z.infer<typeof updateProjectSchema>;

// Interface for combined project and budget data
interface ProjectWithBudget {
  project: Project;
  budget?: BudgetNA853Split;
}

// Interface for project lines with detailed region structure
interface ProjectLine {
  id?: string;
  implementing_agency: string;
  region: {
    perifereia: string;
    perifereiaki_enotita: string;
    dimos: string;
    dimotiki_enotita: string;
  };
  expenditure_types: string[];
}

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

export default function EditProjectPage() {
  const { mis } = useParams<{ mis: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("project-info");
  const [projectLines, setProjectLines] = useState<ProjectLine[]>([]);
  
  console.log("Edit Project Page - MIS Parameter:", mis);

  // Fetch the project data
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery<Project>({
    queryKey: [`/api/projects/${mis}`],
    queryFn: async (): Promise<Project> => {
      const response = await apiRequest(`/api/projects/${mis}`);
      return response as Project;
    },
    enabled: !!mis,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    cacheTime: 15 * 60 * 1000, // 15 minutes cache
  });

  // Fetch the budget data only when budget tab is active for faster loading
  const { data: budgetData, isLoading: isBudgetLoading } = useQuery<BudgetNA853Split>({
    queryKey: [`/api/budget/${mis}`],
    queryFn: async (): Promise<BudgetNA853Split> => {
      const response = await apiRequest(`/api/budget/${mis}`);
      // The API returns a complex object with status and data
      if (response.data) {
        return response.data as BudgetNA853Split;
      }
      return response as BudgetNA853Split;
    },
    enabled: !!mis && activeTab === 'budget-info', // Only load when budget tab is active
    staleTime: 3 * 60 * 1000, // 3 minutes cache
    cacheTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Fetch reference data for project lines with immediate caching
  const { data: unitsData, isLoading: isUnitsLoading } = useQuery({
    queryKey: ['/api/public/units'],
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    cacheTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const { data: kallikratisData, isLoading: isKallikratisLoading } = useQuery<KallikratisEntry[]>({
    queryKey: ['/api/kallikratis'],
    staleTime: 15 * 60 * 1000, // 15 minutes cache
    cacheTime: 60 * 60 * 1000, // 1 hour cache
    enabled: activeTab === 'project-lines', // Only load when needed
  });

  // Initialize the form with all possible fields from the SQL export
  const form = useForm<any>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      // Project core fields
      title: "",
      mis: "",
      e069: "",
      na271: "",
      na853: "",
      event_description: "",
      project_title: "",
      event_type: [],
      event_year: [],
      region: {},
      implementing_agency: [],
      expenditure_type: [],
      
      // Budget fields in Projects table
      budget_e069: "",
      budget_na271: "",
      budget_na853: "",
      
      // Document fields
      kya: [],
      fek: [],
      ada: [],
      ada_import_sana271: [],
      ada_import_sana853: [],
      budget_decision: [],
      funding_decision: [],
      allocation_decision: [],
      
      // Status field
      status: "active",
      
      // Budget NA853 Split fields
      ethsia_pistosi: "",
      q1: "",
      q2: "",
      q3: "",
      q4: "",
      katanomes_etous: "",
      user_view: "",
      proip: "",
    },
  });

  // Update form values when project and budget data are loaded
  useEffect(() => {
    if (project) {
      // First update with project data
      form.reset({
        // Project core fields
        title: project.title || "",
        mis: project.mis || "",
        e069: project.e069 || "",
        na271: project.na271 || "",
        na853: project.na853 || "",
        event_description: project.event_description || "",
        project_title: project.project_title || "",
        event_type: project.event_type || [],
        event_year: project.event_year || [],
        region: project.region || {},
        implementing_agency: project.implementing_agency || [],
        expenditure_type: project.expenditure_type || [],
        
        // Budget fields in Projects table
        budget_e069: project.budget_e069 || "",
        budget_na271: project.budget_na271 || "",
        budget_na853: project.budget_na853 || "",
        
        // Document fields
        kya: project.kya || [],
        fek: project.fek || [],
        ada: project.ada || [],
        ada_import_sana271: project.ada_import_sana271 || [],
        ada_import_sana853: project.ada_import_sana853 || [],
        budget_decision: project.budget_decision || [],
        funding_decision: project.funding_decision || [],
        allocation_decision: project.allocation_decision || [],
        
        // Status field
        status: project.status || "active",
        
        // Initialize budget fields (will be overwritten if budget data is available)
        ethsia_pistosi: "",
        q1: "",
        q2: "",
        q3: "",
        q4: "",
        katanomes_etous: "",
        user_view: "",
        proip: "",
      });
      
      console.log("Loaded project data:", project);
    }
  }, [project, form]);

  // Update budget fields when budget data is loaded
  useEffect(() => {
    if (budgetData && project) {
      // Get current values from form
      const currentValues = form.getValues();
      
      // Merge budget data with current values
      form.reset({
        ...currentValues,
        ethsia_pistosi: budgetData.ethsia_pistosi ? budgetData.ethsia_pistosi.toString() : "",
        q1: budgetData.q1 ? budgetData.q1.toString() : "",
        q2: budgetData.q2 ? budgetData.q2.toString() : "",
        q3: budgetData.q3 ? budgetData.q3.toString() : "",
        q4: budgetData.q4 ? budgetData.q4.toString() : "",
        katanomes_etous: budgetData.katanomes_etous ? budgetData.katanomes_etous.toString() : "",
        user_view: budgetData.user_view ? budgetData.user_view.toString() : "",
        proip: budgetData.proip ? budgetData.proip.toString() : "",
      });
    }
  }, [budgetData, form, project]);

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      setLoading(true);
      try {
        console.log(`Updating project ${mis} with data:`, data);
        const response = await apiRequest(`/api/projects/${mis}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });

        if (!response) {
          throw new Error("Failed to update project");
        }

        return response;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/budget/${mis}`] });
      
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      
      // Navigate back to project details
      navigate(`/projects/${mis}`);
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update project",
        variant: "destructive",
      });
    },
  });

  // Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async (data: any) => {
      setLoading(true);
      try {
        console.log(`Updating budget for MIS ${mis} with data:`, data);
        // Extract only budget fields, excluding user_view which shouldn't be modified directly
        const budgetData = {
          ethsia_pistosi: data.ethsia_pistosi,
          q1: data.q1,
          q2: data.q2,
          q3: data.q3,
          q4: data.q4,
          katanomes_etous: data.katanomes_etous,
          // user_view is excluded as it's read-only
          proip: data.proip,
        };
        
        const response = await apiRequest(`/api/budget/${mis}`, {
          method: "PATCH",
          body: JSON.stringify(budgetData),
        });

        if (!response) {
          throw new Error("Failed to update budget");
        }

        return response;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget/${mis}`] });
      
      toast({
        title: "Success",
        description: "Budget updated successfully",
      });
    },
    onError: (error) => {
      console.error("Error updating budget:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update budget",
        variant: "destructive",
      });
    },
  });

  // Project lines management functions
  const addProjectLine = () => {
    const newLine: ProjectLine = {
      id: Date.now().toString(),
      implementing_agency: "",
      region: {
        perifereia: "",
        perifereiaki_enotita: "",
        dimos: "",
        dimotiki_enotita: ""
      },
      expenditure_types: []
    };
    setProjectLines([...projectLines, newLine]);
  };

  const updateProjectLine = (id: string, field: keyof ProjectLine, value: any) => {
    setProjectLines(projectLines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const updateProjectLineRegion = (id: string, regionField: keyof ProjectLine["region"], value: string) => {
    const finalValue = value === "__clear__" ? "" : value;
    setProjectLines(projectLines.map(line => 
      line.id === id ? { 
        ...line, 
        region: { 
          ...line.region, 
          [regionField]: finalValue,
          // Reset dependent fields when parent changes
          ...(regionField === 'perifereia' && {
            perifereiaki_enotita: "",
            dimos: "",
            dimotiki_enotita: ""
          }),
          ...(regionField === 'perifereiaki_enotita' && {
            dimos: "",
            dimotiki_enotita: ""
          }),
          ...(regionField === 'dimos' && {
            dimotiki_enotita: ""
          })
        } 
      } : line
    ));
  };

  const removeProjectLine = (id: string) => {
    setProjectLines(projectLines.filter(line => line.id !== id));
  };

  // Helper functions for cascading dropdowns
  const getFilteredOptions = (level: keyof ProjectLine["region"], lineId: string) => {
    if (!kallikratisData) return [];
    
    const currentLine = projectLines.find(line => line.id === lineId);
    if (!currentLine) return [];

    let filtered = kallikratisData;

    switch (level) {
      case 'perifereia':
        // Get unique perifereia values
        return Array.from(new Set(filtered.map(item => item.perifereia)))
          .filter(Boolean)
          .sort();

      case 'perifereiaki_enotita':
        if (!currentLine.region.perifereia) return [];
        filtered = filtered.filter(item => item.perifereia === currentLine.region.perifereia);
        return Array.from(new Set(filtered.map(item => item.perifereiaki_enotita)))
          .filter(Boolean)
          .sort();

      case 'dimos':
        if (!currentLine.region.perifereiaki_enotita) return [];
        filtered = filtered.filter(item => 
          item.perifereia === currentLine.region.perifereia &&
          item.perifereiaki_enotita === currentLine.region.perifereiaki_enotita
        );
        return Array.from(new Set(filtered.map(item => `${item.eidos_neou_ota} ${item.onoma_neou_ota}`.trim())))
          .filter(Boolean)
          .sort();

      case 'dimotiki_enotita':
        if (!currentLine.region.dimos) return [];
        filtered = filtered.filter(item => 
          item.perifereia === currentLine.region.perifereia &&
          item.perifereiaki_enotita === currentLine.region.perifereiaki_enotita &&
          `${item.eidos_neou_ota} ${item.onoma_neou_ota}`.trim() === currentLine.region.dimos
        );
        return Array.from(new Set(filtered.map(item => `${item.eidos_koinotitas} ${item.onoma_dimotikis_enotitas}`.trim())))
          .filter(Boolean)
          .sort();



      default:
        return [];
    }
  };

  // Initialize project lines from project data
  useEffect(() => {
    if (project && projectLines.length === 0) {
      const initialLines: ProjectLine[] = [{
        id: 'default-1',
        implementing_agency: "",
        region: {
          perifereia: "",
          perifereiaki_enotita: "",
          dimos: "",
          dimotiki_enotita: ""
        },
        expenditure_types: []
      }];
      
      setProjectLines(initialLines);
    }
  }, [project]);

  // Only show loading for project data (critical path)
  const isLoading = isProjectLoading;
  
  // Show loading skeleton immediately after all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Form submission handler
  const onSubmit = (data: any) => {
    // Determine which data to update based on active tab
    if (activeTab === "project-info") {
      // Extract project-related fields from the SQL export
      const projectData = {
        // Core fields
        title: data.title,
        e069: data.e069,
        na271: data.na271,
        na853: data.na853,
        event_description: data.event_description,
        project_title: data.project_title,
        event_type: data.event_type,
        event_year: data.event_year,
        region: data.region,
        implementing_agency: data.implementing_agency,
        expenditure_type: data.expenditure_type,
        
        // Budget fields in Projects table
        budget_e069: data.budget_e069,
        budget_na271: data.budget_na271,
        budget_na853: data.budget_na853,
        
        // Document fields
        kya: data.kya,
        fek: data.fek,
        ada: data.ada,
        ada_import_sana271: data.ada_import_sana271,
        ada_import_sana853: data.ada_import_sana853,
        budget_decision: data.budget_decision,
        funding_decision: data.funding_decision,
        allocation_decision: data.allocation_decision,
        
        // Status field
        status: data.status,
      };
      console.log('Submitting project data:', projectData);
      updateMutation.mutate(projectData);
    } else if (activeTab === "budget-info") {
      // Extract budget-related fields, excluding user_view which is read-only
      const budgetData = {
        ethsia_pistosi: data.ethsia_pistosi,
        q1: data.q1,
        q2: data.q2,
        q3: data.q3,
        q4: data.q4,
        katanomes_etous: data.katanomes_etous,
        // user_view is excluded as it's read-only
        proip: data.proip,
      };
      console.log('Submitting budget data:', budgetData);
      updateBudgetMutation.mutate(budgetData);
    }
  };

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Project Not Found</h1>
              <Button variant="outline" asChild>
                <a href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </a>
              </Button>
            </div>
            <Card className="p-6 bg-red-50">
              <p className="text-red-600">
                The requested project could not be found or you don't have permission to edit it.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Edit Project</h1>
            <Button variant="outline" onClick={() => navigate(`/projects/${mis}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Project Details - MIS: {mis}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="project-lines" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="project-lines">Project Configuration</TabsTrigger>
                  <TabsTrigger value="budget-info">Budget Allocation</TabsTrigger>
                </TabsList>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    
                    {/* Loading indicators for different sections */}
                    {(isBudgetLoading && activeTab === 'budget-info') && (
                      <div className="text-sm text-gray-500 mb-4">
                        Loading budget data...
                      </div>
                    )}
                    <TabsContent value="project-info">
                      <div className="grid grid-cols-1 gap-6">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Project title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                          
                        {/* Project Title (additional field) */}
                        <FormField
                          control={form.control}
                          name="project_title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Project Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Full project title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Event Description */}
                        <FormField
                          control={form.control}
                          name="event_description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Event Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Event description" 
                                  className="min-h-[100px]"
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
                              <FormLabel>Status</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="pending_reallocation">Pending Reallocation</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="mis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MIS</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="MIS code" readOnly />
                              </FormControl>
                              <FormDescription>
                                MIS cannot be changed after creation
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Event Type */}
                        <FormField
                          control={form.control}
                          name="event_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Event Type</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Event Type"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Fiscal Year and Region */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="event_year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fiscal Year</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Fiscal Year"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="region"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Region</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Region"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Agency and Expenditure Type */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="implementing_agency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Implementing Agency</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Implementing Agency"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="expenditure_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expenditure Type</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Expenditure Type"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Primary Codes Section */}
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Primary Codes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField
                            control={form.control}
                            name="na853"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ΝΑ853</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="NA853 Code"
                                  />
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
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="NA271 Code"
                                  />
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
                                <FormLabel>Ε069</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="E069 Code"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Budget Allocation Section */}
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Budget Allocation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField
                            control={form.control}
                            name="budget_na853"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Budget NA853</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Budget NA853"
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
                                <FormLabel>Budget NA271</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Budget NA271"
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
                                <FormLabel>Budget E069</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Budget E069"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      {/* Document Fields Section */}
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Document References</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="kya"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ΚΥΑ</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="ΚΥΑ"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="fek"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ΦΕΚ</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="ΦΕΚ"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <FormField
                            control={form.control}
                            name="ada"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ΑΔΑ</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="ΑΔΑ"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="ada_import_sana271"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ΑΔΑ Εισαγωγής ΣΑΝ271</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="ΑΔΑ Εισαγωγής ΣΑΝ271"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <FormField
                            control={form.control}
                            name="ada_import_sana853"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ΑΔΑ Εισαγωγής ΣΑΝ853</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="ΑΔΑ Εισαγωγής ΣΑΝ853"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="budget_decision"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Απόφαση Προϋπολογισμού</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Απόφαση Προϋπολογισμού"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <FormField
                            control={form.control}
                            name="funding_decision"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Απόφαση Χρηματοδότησης</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Απόφαση Χρηματοδότησης"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="allocation_decision"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Απόφαση Κατανομής</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Απόφαση Κατανομής"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="project-lines">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium">Project Lines Management</h3>
                          <Button type="button" onClick={addProjectLine} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add New Line
                          </Button>
                        </div>
                        
                        <div className="space-y-4">
                          {projectLines.map((line, index) => (
                            <Card key={line.id} className="p-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-medium">Line {index + 1}</h4>
                                {projectLines.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeProjectLine(line.id!)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <div className="space-y-4">
                                {/* Implementing Agency */}
                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Implementing Agency
                                  </label>
                                  <Select
                                    value={line.implementing_agency}
                                    onValueChange={(value) => updateProjectLine(line.id!, 'implementing_agency', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select agency..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unitsData?.map((unit: any) => (
                                        <SelectItem key={unit.unit} value={unit.unit_name}>
                                          {unit.unit_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* 5-Level Cascading Region Selection */}
                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Geographical Region Selection
                                  </label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {/* Περιφέρεια (Region) */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Περιφέρεια</label>
                                      <Select
                                        value={line.region.perifereia}
                                        onValueChange={(value) => updateProjectLineRegion(line.id!, 'perifereia', value)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {getFilteredOptions('perifereia', line.id!).map((option, index) => (
                                            <SelectItem key={`${line.id}-perifereia-${index}-${option}`} value={option} className="text-xs">
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Περιφερειακή Ενότητα (Regional Unit) */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Περιφ. Ενότητα</label>
                                      <Select
                                        value={line.region.perifereiaki_enotita}
                                        onValueChange={(value) => updateProjectLineRegion(line.id!, 'perifereiaki_enotita', value)}
                                        disabled={!line.region.perifereia}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem key={`${line.id}-clear-perifereiaki`} value="__clear__" className="text-xs italic text-gray-500">
                                            -- Clear Selection --
                                          </SelectItem>
                                          {getFilteredOptions('perifereiaki_enotita', line.id!).map((option, index) => (
                                            <SelectItem key={`${line.id}-perifereiaki-${index}-${option}`} value={option} className="text-xs">
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Δήμος (Municipality) */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Δήμος</label>
                                      <Select
                                        value={line.region.dimos}
                                        onValueChange={(value) => updateProjectLineRegion(line.id!, 'dimos', value)}
                                        disabled={!line.region.perifereiaki_enotita}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__clear__" className="text-xs italic text-gray-500">
                                            -- Clear Selection --
                                          </SelectItem>
                                          {getFilteredOptions('dimos', line.id!).map((option) => (
                                            <SelectItem key={option} value={option} className="text-xs">
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Δημ. Ενότητα (Municipal Unit) */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Δημ. Ενότητα</label>
                                      <Select
                                        value={line.region.dimotiki_enotita}
                                        onValueChange={(value) => updateProjectLineRegion(line.id!, 'dimotiki_enotita', value)}
                                        disabled={!line.region.dimos}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__clear__" className="text-xs italic text-gray-500">
                                            -- Clear Selection --
                                          </SelectItem>
                                          {getFilteredOptions('dimotiki_enotita', line.id!).map((option) => (
                                            <SelectItem key={option} value={option} className="text-xs">
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>


                                  </div>
                                </div>
                                
                                {/* Expenditure Types with Multi-Select */}
                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Expenditure Types (Τύπος Δαπάνης)
                                  </label>
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                      {['ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ', 'ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ', 'ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ', 'ΔΚΑ ΕΠΙΣΚΕΥΗ', 
                                        'ΕΚΤΟΣ ΕΔΡΑΣ', 'ΣΥΜΒΑΤΙΚΕΣ ΥΠΟΧΡΕΩΣΕΙΣ', 'ΠΕΡΙΒΑΛΛΟΝΤΕΣ ΧΩΡΟΙ', 'ΕΠΙΔΟΤΗΣΗ ΚΑΤΕΔΑΦΙΣΗΣ'].map((type) => (
                                        <button
                                          key={type}
                                          type="button"
                                          onClick={() => {
                                            const currentTypes = line.expenditure_types || [];
                                            const newTypes = currentTypes.includes(type)
                                              ? currentTypes.filter(t => t !== type)
                                              : [...currentTypes, type];
                                            updateProjectLine(line.id!, 'expenditure_types', newTypes);
                                          }}
                                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                                            line.expenditure_types?.includes(type)
                                              ? 'bg-blue-100 border-blue-300 text-blue-800'
                                              : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                                          }`}
                                        >
                                          {type}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </Card>
                          ))}
                        </div>
                        
                        {projectLines.length > 0 && (
                          <div className="flex justify-end pt-4">
                            <Button
                              type="button"
                              onClick={() => {
                                // Save project lines logic would go here
                                toast({
                                  title: "Success",
                                  description: "Project lines saved successfully",
                                });
                              }}
                            >
                              Save Project Lines
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="budget-info">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="ethsia_pistosi"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ετήσια Πίστωση</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Ετήσια Πίστωση"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="user_view"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Σύνολο Διαβίβασης</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Σύνολο Διαβίβασης"
                                  readOnly
                                  className="bg-gray-100"
                                />
                              </FormControl>
                              <FormDescription>
                                Το πεδίο Σύνολο Διαβίβασης δεν μπορεί να τροποποιηθεί άμεσα
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="proip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ΠΡΟΪΠ</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="ΠΡΟΪΠ"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="katanomes_etous"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Κατανομές Έτους</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Κατανομές Έτους"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                        <FormField
                          control={form.control}
                          name="q1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Α' Τρίμηνο</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Q1"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="q2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Β' Τρίμηνο</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Q2"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="q3"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Γ' Τρίμηνο</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Q3"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="q4"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Δ' Τρίμηνο</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="Q4"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    <div className="flex justify-end mt-6">
                      <Button
                        type="submit"
                        disabled={loading}
                      >
                        {loading ? "Updating..." : "Update Project"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}