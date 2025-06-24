import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Plus, X, Trash2, Calendar, Info, MapPin, FileText, Building, CheckCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { z } from "zod";

// Form schema for comprehensive project editing
const comprehensiveProjectSchema = z.object({
  // Section 1: Decisions
  decisions: z.array(z.object({
    protocol_number: z.string().optional(),
    fek: z.string().optional(),
    ada: z.string().optional(),
    implementing_agency: z.string().optional(),
    decision_budget: z.string().optional(),
    expenses_covered: z.string().optional(),
    decision_type: z.string().optional(),
    is_included: z.string().optional(),
  })).optional(),
  
  // Section 2: Event Details (Simplified)
  event_details: z.object({
    event_name: z.string().optional(),
    event_year: z.string().optional(),
  }).optional(),
  
  // Section 3: Project Details
  project_details: z.object({
    mis: z.string(),
    project_title: z.string().optional(),
    project_description: z.string().optional(),
    project_summary: z.string().optional(),
  }).optional(),
  
  // Section 4: Formulation Details
  formulation_details: z.array(z.object({
    sa: z.string().optional(),
    project_budget: z.string().optional(),
    decision_protocol: z.string().optional(),
    epa_version: z.string().optional(),
  })).optional(),
  
  // Section 5: Changes
  changes: z.array(z.object({
    change_description: z.string().optional(),
    change_date: z.string().optional(),
  })).optional(),
});

type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

// Project Line interface for advanced region/agency management
interface ProjectLine {
  id: string;
  implementing_agency: string;
  event_type: string;
  region: {
    perifereia: string;
    perifereiaki_enotita: string;
    dimos: string;
    dimotiki_enotita: string;
    kallikratis_id?: number;
  };
  expenditure_types: string[];
}

export default function ComprehensiveEditProjectPage() {
  const params = useParams();
  const mis = params.mis;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  
  // Project Lines Management
  const [projectLines, setProjectLines] = useState<ProjectLine[]>([]);

  // Form setup
  const form = useForm<ComprehensiveFormData>({
    resolver: zodResolver(comprehensiveProjectSchema),
    defaultValues: {
      decisions: [{}],
      event_details: {},
      project_details: {},
      formulation_details: [{}],
      changes: [{}],
    },
  });

  // Data queries
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ["/api/projects", mis],
    enabled: !!mis,
    gcTime: 5 * 60 * 1000,
  });

  const { data: projectIndexData } = useQuery({
    queryKey: ["/api/projects", mis, "index"],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${mis}/index`);
      return response;
    },
    enabled: !!mis,
    gcTime: 5 * 60 * 1000,
  });

  const { data: kallikratisData } = useQuery({
    queryKey: ["/api/kallikratis"],
    gcTime: 10 * 60 * 1000,
  });

  const { data: unitsData } = useQuery({
    queryKey: ["/api/public/units"],
    gcTime: 10 * 60 * 1000,
  });

  const { data: eventTypesData } = useQuery({
    queryKey: ["/api/event-types"],
    gcTime: 10 * 60 * 1000,
  });

  const { data: expenditureTypesData } = useQuery({
    queryKey: ["/api/expenditure-types"],
    gcTime: 10 * 60 * 1000,
  });

  // Initialize form with project data and project index data
  useEffect(() => {
    if (projectData && kallikratisData && unitsData && projectIndexData) {
      const project = projectData;
      
      // Initialize project lines from project_index data if available
      const projectLines: ProjectLine[] = [];
      
      if (projectIndexData && Array.isArray(projectIndexData) && projectIndexData.length > 0) {
        // Group project index entries by common attributes to create consolidated project lines
        const groupedEntries = new Map<string, any>();
        
        projectIndexData.forEach((indexEntry: any) => {
          const key = `${indexEntry.unit_id}-${indexEntry.event_type_name}-${indexEntry.kallikratis_id}`;
          
          if (groupedEntries.has(key)) {
            // Add expenditure type to existing group
            const existing = groupedEntries.get(key);
            if (indexEntry.expenditure_type_name && !existing.expenditure_types.includes(indexEntry.expenditure_type_name)) {
              existing.expenditure_types.push(indexEntry.expenditure_type_name);
            }
          } else {
            // Create new group
            groupedEntries.set(key, {
              unit_id: indexEntry.unit_id,
              event_type_name: indexEntry.event_type_name,
              kallikratis_id: indexEntry.kallikratis_id,
              kallikratis: indexEntry.kallikratis,
              expenditure_types: indexEntry.expenditure_type_name ? [indexEntry.expenditure_type_name] : []
            });
          }
        });

        // Create project lines from grouped entries
        Array.from(groupedEntries.values()).forEach((groupedEntry: any, idx: number) => {
          const kallikratisEntry = groupedEntry.kallikratis || kallikratisData.find((entry: any) => entry.id === groupedEntry.kallikratis_id);
          
          const projectLine: ProjectLine = {
            id: (idx + 1).toString(),
            implementing_agency: groupedEntry.unit_id || "",
            event_type: groupedEntry.event_type_name || "",
            region: {
              perifereia: kallikratisEntry?.perifereia || "",
              perifereiaki_enotita: kallikratisEntry?.perifereiaki_enotita || "",
              dimos: kallikratisEntry ? `${kallikratisEntry.eidos_neou_ota || ""} ${kallikratisEntry.onoma_neou_ota || ""}`.trim() : "",
              dimotiki_enotita: kallikratisEntry ? `${kallikratisEntry.eidos_koinotitas || ""} ${kallikratisEntry.onoma_dimotikis_enotitas || ""}`.trim() : "",
              kallikratis_id: groupedEntry.kallikratis_id
            },
            expenditure_types: groupedEntry.expenditure_types || []
          };
          
          projectLines.push(projectLine);
        });
      } else {
        // Fallback: create one project line from main project data
        const kallikratisEntry = kallikratisData.find((entry: any) => entry.id === project.enhanced_kallikratis?.id);
        
        const initialProjectLine: ProjectLine = {
          id: "1",
          implementing_agency: project.enhanced_unit?.id || "",
          event_type: project.enhanced_event_type?.name || "",
          region: {
            perifereia: kallikratisEntry?.perifereia || "",
            perifereiaki_enotita: kallikratisEntry?.perifereiaki_enotita || "",
            dimos: kallikratisEntry ? `${kallikratisEntry.eidos_neou_ota || ""} ${kallikratisEntry.onoma_neou_ota || ""}`.trim() : "",
            dimotiki_enotita: kallikratisEntry ? `${kallikratisEntry.eidos_koinotitas || ""} ${kallikratisEntry.onoma_dimotikis_enotitas || ""}`.trim() : "",
            kallikratis_id: kallikratisEntry?.id
          },
          expenditure_types: project.enhanced_expenditure_type?.name ? [project.enhanced_expenditure_type.name] : []
        };
        
        projectLines.push(initialProjectLine);
      }

      setProjectLines(projectLines);

      // Populate form fields
      form.setValue("project_details.mis", project.mis?.toString() || "");
      form.setValue("project_details.project_title", project.project_title || "");
      form.setValue("project_details.project_description", project.event_description || "");
      form.setValue("event_details.event_name", project.enhanced_event_type?.name || "");
      form.setValue("event_details.event_year", project.event_year?.[0] || "");

      // Populate decisions
      if (project.kya?.[0]) form.setValue("decisions.0.protocol_number", project.kya[0]);
      if (project.fek?.[0]) form.setValue("decisions.0.fek", project.fek[0]);
      if (project.ada?.[0]) form.setValue("decisions.0.ada", project.ada[0]);

      // Populate budget
      if (project.budget_na853) {
        form.setValue("formulation_details.0.project_budget", project.budget_na853.toString());
        form.setValue("formulation_details.0.sa", "ΝΑ853");
      }
    }
  }, [projectData, projectIndexData, kallikratisData, unitsData, form]);

  // Project Lines Management Functions
  const addProjectLine = () => {
    const newLine: ProjectLine = {
      id: Date.now().toString(),
      implementing_agency: "",
      event_type: "",
      region: {
        perifereia: "",
        perifereiaki_enotita: "",
        dimos: "",
        dimotiki_enotita: "",
      },
      expenditure_types: []
    };
    setProjectLines([...projectLines, newLine]);
  };

  const removeProjectLine = (id: string) => {
    setProjectLines(projectLines.filter(line => line.id !== id));
  };

  const updateProjectLine = (id: string, field: keyof ProjectLine, value: any) => {
    setProjectLines(lines => lines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const updateProjectLineRegion = (id: string, field: keyof ProjectLine['region'], value: string) => {
    setProjectLines(lines => lines.map(line => {
      if (line.id === id) {
        const newRegion = { ...line.region, [field]: value === "__clear__" ? "" : value };
        
        // Clear dependent fields when parent changes
        if (field === 'perifereia') {
          newRegion.perifereiaki_enotita = "";
          newRegion.dimos = "";
          newRegion.dimotiki_enotita = "";
        } else if (field === 'perifereiaki_enotita') {
          newRegion.dimos = "";
          newRegion.dimotiki_enotita = "";
        } else if (field === 'dimos') {
          newRegion.dimotiki_enotita = "";
        }
        
        return { ...line, region: newRegion };
      }
      return line;
    }));
  };

  const toggleExpenditureType = (lineId: string, expenditureType: string) => {
    setProjectLines(lines => lines.map(line => {
      if (line.id === lineId) {
        const current = line.expenditure_types || [];
        const updated = current.includes(expenditureType)
          ? current.filter(type => type !== expenditureType)
          : [...current, expenditureType];
        return { ...line, expenditure_types: updated };
      }
      return line;
    }));
  };

  // Get filtered options for cascading dropdowns
  const getFilteredOptions = (level: string, lineId: string): string[] => {
    if (!kallikratisData) return [];
    
    const line = projectLines.find(l => l.id === lineId);
    if (!line) return [];

    const data = kallikratisData as any[];

    switch (level) {
      case 'perifereia':
        return [...new Set(data.map(item => item.perifereia).filter(Boolean))];
      
      case 'perifereiaki_enotita':
        if (!line.region.perifereia) return [];
        return [...new Set(data
          .filter(item => item.perifereia === line.region.perifereia)
          .map(item => item.perifereiaki_enotita)
          .filter(Boolean))];
      
      case 'dimos':
        if (!line.region.perifereiaki_enotita) return [];
        return [...new Set(data
          .filter(item => 
            item.perifereia === line.region.perifereia && 
            item.perifereiaki_enotita === line.region.perifereiaki_enotita
          )
          .map(item => `${item.eidos_neou_ota || ""} ${item.onoma_neou_ota || ""}`.trim())
          .filter(Boolean))];
      
      case 'dimotiki_enotita':
        if (!line.region.dimos) return [];
        return [...new Set(data
          .filter(item => {
            const dimos = `${item.eidos_neou_ota || ""} ${item.onoma_neou_ota || ""}`.trim();
            return item.perifereia === line.region.perifereia && 
                   item.perifereiaki_enotita === line.region.perifereiaki_enotita && 
                   dimos === line.region.dimos;
          })
          .map(item => `${item.eidos_koinotitas || ""} ${item.onoma_dimotikis_enotitas || ""}`.trim())
          .filter(Boolean))];
      
      default:
        return [];
    }
  };

  // Update mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: ComprehensiveFormData) => {
      setLoading(true);
      try {
        const allExpenditureTypes = projectLines.flatMap(line => line.expenditure_types || []);
        const uniqueExpenditureTypes = Array.from(new Set(allExpenditureTypes));
        const primaryLine = projectLines[0];

        const transformedData = {
          title: data.project_details?.project_title || '',
          project_title: data.project_details?.project_title || '',
          event_description: data.project_details?.project_description || '',
          mis: data.project_details?.mis || '',
          event_type: projectLines.map(line => line.event_type).filter(Boolean),
          event_year: data.event_details?.event_year ? [data.event_details.event_year] : [],
          implementing_agency: projectLines.map(line => line.implementing_agency).filter(Boolean),
          expenditure_type: uniqueExpenditureTypes,
          region: primaryLine ? {
            perifereia: primaryLine.region.perifereia || '',
            perifereiaki_enotita: primaryLine.region.perifereiaki_enotita || '',
            dimos: primaryLine.region.dimos || '',
            dimotiki_enotita: primaryLine.region.dimotiki_enotita || ''
          } : {},
          kya: data.decisions?.map(d => d.protocol_number).filter(Boolean) || [],
          fek: data.decisions?.map(d => d.fek).filter(Boolean) || [],
          ada: data.decisions?.map(d => d.ada).filter(Boolean) || [],
          budget_na853: data.formulation_details?.find(fd => fd.sa === 'ΝΑ853')?.project_budget || '',
          budget_na271: data.formulation_details?.find(fd => fd.sa === 'ΝΑ271')?.project_budget || '',
          budget_e069: data.formulation_details?.find(fd => fd.sa === 'Ε069')?.project_budget || '',
          project_lines: projectLines.map(line => ({
            implementing_agency: line.implementing_agency,
            event_type: line.event_type,
            expenditure_types: line.expenditure_types,
            region: {
              perifereia: line.region.perifereia,
              perifereiaki_enotita: line.region.perifereiaki_enotita,
              dimos: line.region.dimos,
              dimotiki_enotita: line.region.dimotiki_enotita,
              kallikratis_id: line.region.kallikratis_id
            }
          }))
        };

        return apiRequest(`/api/projects/${mis}`, {
          method: "PATCH",
          body: JSON.stringify(transformedData),
        });
      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Το έργο ενημερώθηκε επιτυχώς",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", mis, "index"] });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Παρουσιάστηκε σφάλμα κατά την ενημέρωση",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ComprehensiveFormData) => {
    updateProjectMutation.mutate(data);
  };

  // Helper functions for form arrays
  const addDecision = () => {
    const current = form.getValues("decisions") || [];
    form.setValue("decisions", [...current, {}]);
  };

  const removeDecision = (index: number) => {
    const current = form.getValues("decisions") || [];
    form.setValue("decisions", current.filter((_, i) => i !== index));
  };

  const addFormulationDetail = () => {
    const current = form.getValues("formulation_details") || [];
    form.setValue("formulation_details", [...current, {}]);
  };

  const removeFormulationDetail = (index: number) => {
    const current = form.getValues("formulation_details") || [];
    form.setValue("formulation_details", current.filter((_, i) => i !== index));
  };

  const addChange = () => {
    const current = form.getValues("changes") || [];
    form.setValue("changes", [...current, {}]);
  };

  const removeChange = (index: number) => {
    const current = form.getValues("changes") || [];
    form.setValue("changes", current.filter((_, i) => i !== index));
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">Φόρτωση...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/projects")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Επιστροφή
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Επεξεργασία Έργου {mis}
              </h1>
              <p className="text-gray-600">{projectData?.project_title}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Περίληψη</TabsTrigger>
            <TabsTrigger value="edit">Επεξεργασία</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Βασικά Στοιχεία</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div><strong>MIS:</strong> {projectData?.mis}</div>
                    <div><strong>Τίτλος:</strong> {projectData?.project_title}</div>
                    <div><strong>Περιγραφή:</strong> {projectData?.event_description}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Οικονομικά Στοιχεία</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div><strong>Προϋπολογισμός ΝΑ853:</strong> {projectData?.budget_na853?.toLocaleString()}€</div>
                    <div><strong>Προϋπολογισμός ΝΑ271:</strong> {projectData?.budget_na271?.toLocaleString()}€</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Στοιχεία Έργου</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div><strong>Τύπος Συμβάντος:</strong> {projectData?.enhanced_event_type?.name}</div>
                    <div><strong>Τύπος Δαπάνης:</strong> {projectData?.enhanced_expenditure_type?.name}</div>
                    <div><strong>Φορέας:</strong> {projectData?.enhanced_unit?.name}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                
                {/* Section 1: Decisions */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <FileText className="h-5 w-5" />
                      1️⃣ Αποφάσεις
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200 rounded-lg">
                        <thead>
                          <tr className="bg-blue-50">
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Αρ. Πρωτοκόλλου</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">ΦΕΚ</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">ΑΔΑ</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Ενέργειες</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.watch("decisions") || [{}]).map((_, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 p-2">
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
                              <td className="border border-gray-200 p-2">
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
                              <td className="border border-gray-200 p-2">
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
                              <td className="border border-gray-200 p-2 text-center">
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
                        Προσθήκη απόφασης
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 2: Event Details (Simplified) */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <Calendar className="h-5 w-5" />
                      2️⃣ Στοιχεία συμβάντος
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="event_details.event_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Τύπος Συμβάντος</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10">
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
                            <FormLabel className="text-sm font-medium text-gray-700">Έτος εκδήλωσης συμβάντος</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-10" placeholder="π.χ. 2024" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <Info className="inline h-4 w-4 mr-1" />
                        Η λεπτομερής διαχείριση περιοχών και φορέων υλοποίησης γίνεται στην ενότητα "Γραμμές Έργου" παρακάτω.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 3: Project Details */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <Building className="h-5 w-5" />
                      3️⃣ Στοιχεία έργου
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 gap-6">
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
                        name="project_details.project_title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τίτλος έργου</FormLabel>
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
                              <Textarea {...field} rows={3} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Section 4: Formulation Details */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      4️⃣ Στοιχεία διαμόρφωσης
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200 rounded-lg">
                        <thead>
                          <tr className="bg-blue-50">
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">ΣΑ</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Προϋπολογισμός έργου</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Ενέργειες</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.watch("formulation_details") || [{}]).map((_, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 p-2">
                                <FormField
                                  control={form.control}
                                  name={`formulation_details.${index}.sa`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
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
                              <td className="border border-gray-200 p-2">
                                <FormField
                                  control={form.control}
                                  name={`formulation_details.${index}.project_budget`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input {...field} type="number" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-200 p-2 text-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeFormulationDetail(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button type="button" onClick={addFormulationDetail} className="mt-4 bg-green-600 hover:bg-green-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη στοιχείου
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 5: Changes */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      5️⃣ Αλλαγές
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200 rounded-lg">
                        <thead>
                          <tr className="bg-blue-50">
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Περιγραφή αλλαγής</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Ημερομηνία</th>
                            <th className="border border-gray-200 p-3 text-sm font-medium text-gray-700">Ενέργειες</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.watch("changes") || [{}]).map((_, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 p-2">
                                <FormField
                                  control={form.control}
                                  name={`changes.${index}.change_description`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Textarea {...field} rows={2} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-200 p-2">
                                <FormField
                                  control={form.control}
                                  name={`changes.${index}.change_date`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input {...field} type="date" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-200 p-2 text-center">
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
                        Προσθήκη αλλαγής
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 6: Project Lines (Advanced Management) */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b">
                    <CardTitle className="flex items-center gap-2 text-green-900">
                      <MapPin className="h-5 w-5" />
                      6️⃣ Γραμμές Έργου (Προηγμένη Διαχείριση)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-6">
                      {projectLines.map((line) => (
                        <div key={line.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-lg font-medium text-gray-900">Γραμμή Έργου #{line.id}</h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeProjectLine(line.id!)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-6 mb-6">
                            {/* Implementing Agency */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">Φορέας Υλοποίησης</label>
                              <Select
                                value={line.implementing_agency}
                                onValueChange={(value) => updateProjectLine(line.id!, 'implementing_agency', value)}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Επιλέξτε φορέα" />
                                </SelectTrigger>
                                <SelectContent>
                                  {unitsData?.map((unit: any) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Event Type */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">Τύπος Συμβάντος</label>
                              <Select
                                value={line.event_type}
                                onValueChange={(value) => updateProjectLine(line.id!, 'event_type', value)}
                              >
                                <SelectTrigger className="h-10">
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
                            </div>
                          </div>

                          {/* 4-Level Geographic Hierarchy */}
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Γεωγραφική Ιεραρχία</label>
                            <div className="grid grid-cols-4 gap-4">
                              {/* Περιφέρεια */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Περιφέρεια</label>
                                <Select
                                  value={line.region.perifereia}
                                  onValueChange={(value) => updateProjectLineRegion(line.id!, 'perifereia', value)}
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Επιλογή" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="text-gray-500">
                                      -- Καθαρισμός --
                                    </SelectItem>
                                    {getFilteredOptions('perifereia', line.id!).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Περιφερειακή Ενότητα */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Π.Ε.</label>
                                <Select
                                  value={line.region.perifereiaki_enotita}
                                  onValueChange={(value) => updateProjectLineRegion(line.id!, 'perifereiaki_enotita', value)}
                                  disabled={!line.region.perifereia}
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Επιλογή" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="text-gray-500">
                                      -- Καθαρισμός --
                                    </SelectItem>
                                    {getFilteredOptions('perifereiaki_enotita', line.id!).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Δήμος */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Δήμος</label>
                                <Select
                                  value={line.region.dimos}
                                  onValueChange={(value) => updateProjectLineRegion(line.id!, 'dimos', value)}
                                  disabled={!line.region.perifereiaki_enotita}
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Επιλογή" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="text-gray-500">
                                      -- Καθαρισμός --
                                    </SelectItem>
                                    {getFilteredOptions('dimos', line.id!).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Δημοτική Ενότητα */}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Δημ. Ενότητα</label>
                                <Select
                                  value={line.region.dimotiki_enotita}
                                  onValueChange={(value) => updateProjectLineRegion(line.id!, 'dimotiki_enotita', value)}
                                  disabled={!line.region.dimos}
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Επιλογή" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__" className="text-gray-500">
                                      -- Καθαρισμός --
                                    </SelectItem>
                                    {getFilteredOptions('dimotiki_enotita', line.id!).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Expenditure Types Multi-Select */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Τύποι Δαπάνης</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {expenditureTypesData?.map((expenditureType: any) => (
                                <div key={expenditureType.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${line.id}-${expenditureType.id}`}
                                    checked={line.expenditure_types?.includes(expenditureType.expediture_types) || false}
                                    onCheckedChange={() => toggleExpenditureType(line.id!, expenditureType.expediture_types)}
                                  />
                                  <label 
                                    htmlFor={`${line.id}-${expenditureType.id}`}
                                    className="text-sm text-gray-700 cursor-pointer flex items-center gap-1"
                                  >
                                    {expenditureType.expediture_types}
                                    {line.expenditure_types?.includes(expenditureType.expediture_types) && (
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    )}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        type="button" 
                        onClick={addProjectLine} 
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη γραμμής έργου
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/projects")}
                  >
                    Ακύρωση
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || updateProjectMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading || updateProjectMutation.isPending ? "Αποθήκευση..." : "Αποθήκευση αλλαγών"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}