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
  })).min(1, "Απαιτείται τουλάχιστον μία τοποθεσία"),
  
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

  // Debug logging for all data sources
  console.log("Event types data:", eventTypesData);
  console.log("Units data:", unitsData);
  console.log("Expenditure types data:", expenditureTypesData);
  console.log("Kallikratis data available:", kallikratisData?.length || 0, "entries");
  
  if (!kallikratisData || kallikratisData.length === 0) {
    console.log("No kallikratis data available");
  }

  // Initialize form with project data
  useEffect(() => {
    if (projectData) {
      console.log('Initializing comprehensive form with project data:', projectData);
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
        // Fallback to legacy direct project fields
        console.log('Loading decisions from legacy project fields');
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
      }

      form.setValue("decisions", decisions);

      // Event details
      form.setValue("event_details", {
        event_name: project.enhanced_event_type?.name || "",
        event_year: project.event_year?.[0] || "",
      });

      // Initialize with default empty location details - will be populated by separate effect
      form.setValue("location_details", [{
        municipal_community: "",
        municipality: "",
        regional_unit: "",
        region: "",
        implementing_agency: "",
        expenditure_types: []
      }]);

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

  // Separate effect to populate location details from project index data
  useEffect(() => {
    if (projectIndexData && Array.isArray(projectIndexData) && projectIndexData.length > 0) {
      console.log('Populating location details from project index data:', projectIndexData);
      
      const locationDetails = [];
      const locationGroups = new Map();
      
      projectIndexData.forEach(entry => {
        const key = `${entry.kallikratis_id}_${entry.unit_id}`;
        if (!locationGroups.has(key)) {
          // Extract geographic data from kallikratis object
          const kallikratis = entry.kallikratis || {};
          console.log('Processing kallikratis data:', kallikratis);
          
          // Geographic level is now determined automatically based on available data
          
          locationGroups.set(key, {
            municipal_community: kallikratis.onoma_dimotikis_enotitas || "",
            municipality: kallikratis.onoma_neou_ota || "",
            regional_unit: kallikratis.perifereiaki_enotita || "",
            region: kallikratis.perifereia || "",
            implementing_agency: entry.unit_name || "",
            expenditure_types: []
          });
        }
        
        // Add expenditure type to this location
        const location = locationGroups.get(key);
        if (entry.expenditure_type_name && !location.expenditure_types.includes(entry.expenditure_type_name)) {
          location.expenditure_types.push(entry.expenditure_type_name);
        }
      });
      
      locationGroups.forEach(location => {
        locationDetails.push(location);
      });
      
      console.log('Generated location details:', locationDetails);
      
      // Ensure we have at least one location detail entry
      if (locationDetails.length === 0) {
        const defaultImplementingAgency = projectData?.implementing_agency?.[0] || 
                                        (Array.isArray(projectData?.implementing_agency) ? projectData.implementing_agency[0] : projectData?.implementing_agency) || 
                                        "";
        
        locationDetails.push({
          municipal_community: "",
          municipality: "",
          regional_unit: "",
          region: "",
          implementing_agency: defaultImplementingAgency,
          expenditure_types: [],
          geographic_level: "municipality"
        });
        console.log('No valid location details found, added empty entry');
      }
      
      form.setValue("location_details", locationDetails);
      console.log('Location details populated in form with', locationDetails.length, 'entries');
    } else {
      // If no project index data, ensure we have at least one empty location detail
      console.log('No project index data available, initializing with default location details');
      const defaultImplementingAgency = projectData?.implementing_agency?.[0] || 
                                      (Array.isArray(projectData?.implementing_agency) ? projectData.implementing_agency[0] : projectData?.implementing_agency) || 
                                      "";
      
      form.setValue("location_details", [{
        municipal_community: "",
        municipality: "",
        regional_unit: "",
        region: "",
        implementing_agency: defaultImplementingAgency,
        expenditure_types: [],
        geographic_level: "municipality"
      }]);
      console.log('Default location entry created with implementing agency:', defaultImplementingAgency);
    }
  }, [projectIndexData, form]);

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
    form.setValue("location_details", [...current, { 
      municipal_community: "", 
      municipality: "", 
      regional_unit: "", 
      region: "", 
      implementing_agency: "", 
      expenditure_types: [],
      geographic_level: "municipality"
    }]);
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
    if (!kallikratisData) {
      console.log('No kallikratis data available');
      return [];
    }
    
    console.log('Kallikratis data sample:', kallikratisData.slice(0, 2));
    
    const currentLocation = form.watch("location_details")[locationIndex];
    if (!currentLocation) return [];

    let filtered = kallikratisData;

    switch (level) {
      case 'region':
        // Get unique region values (Περιφέρεια)
        const regions = Array.from(new Set(filtered.map(item => item.perifereia)))
          .filter(Boolean)
          .sort();
        console.log('Available regions:', regions);
        return regions;

      case 'regional_unit':
        if (!currentLocation.region) return [];
        filtered = filtered.filter(item => item.perifereia === currentLocation.region);
        const regionalUnits = Array.from(new Set(filtered.map(item => item.perifereiaki_enotita)))
          .filter(Boolean)
          .sort();
        console.log('Available regional units for', currentLocation.region, ':', regionalUnits);
        return regionalUnits;

      case 'municipality':
        if (!currentLocation.regional_unit) return [];
        filtered = filtered.filter(item => 
          item.perifereia === currentLocation.region &&
          item.perifereiaki_enotita === currentLocation.regional_unit
        );
        const municipalities = Array.from(new Set(filtered.map(item => item.onoma_neou_ota)))
          .filter(Boolean)
          .sort();
        console.log('Available municipalities:', municipalities);
        return municipalities;

      case 'municipal_community':
        if (!currentLocation.municipality) return [];
        filtered = filtered.filter(item => 
          item.perifereia === currentLocation.region &&
          item.perifereiaki_enotita === currentLocation.regional_unit &&
          item.onoma_neou_ota === currentLocation.municipality
        );
        const communities = Array.from(new Set(filtered.map(item => `${item.eidos_koinotitas} ${item.onoma_dimotikis_enotitas}`.trim())))
          .filter(Boolean)
          .sort();
        console.log('Available municipal communities:', communities);
        return communities;

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
    mutationFn: async (data: ComprehensiveFormData) => {
      console.log('=== MUTATION FUNCTION DEBUG ===');
      console.log('Original form data:', data);
      
      // Transform location details to project_lines format for project_index table updates
      const transformedData = {
        ...data,
        project_lines: data.location_details.map((location, index) => {
          // Find matching kallikratis entry for this location
          let kallikratisId = null;
          
          console.log(`\n=== Processing location ${index + 1} ===`);
          console.log('Location data:', location);
          console.log('Region:', location.region);
          console.log('Regional Unit:', location.regional_unit);
          console.log('Municipality:', location.municipality);
          console.log('Municipal Community:', location.municipal_community);
          
          if (kallikratisData) {
            // Clean up location data - treat "__clear__" as empty
            const cleanMunicipality = location.municipality === "__clear__" ? "" : location.municipality;
            const cleanMunicipalCommunity = location.municipal_community === "__clear__" ? "" : location.municipal_community;
            const cleanRegionalUnit = location.regional_unit === "__clear__" ? "" : location.regional_unit;
            const cleanRegion = location.region === "__clear__" ? "" : location.region;
            
            // Determine geographic level automatically based on available location data
            if (cleanRegion && cleanRegionalUnit && cleanMunicipality && cleanMunicipalCommunity) {
              // Municipal level with community - most specific (6 digits)
              console.log('Searching for Municipal Community level entry...');
              const municipalEntry = kallikratisData.find(entry =>
                entry.perifereia === cleanRegion &&
                entry.perifereiaki_enotita === cleanRegionalUnit &&
                entry.onoma_neou_ota === cleanMunicipality &&
                entry.onoma_dimotikis_enotitas === cleanMunicipalCommunity
              );
              kallikratisId = municipalEntry?.id || null;
              console.log('Municipal level (with community) - kallikratis_id:', kallikratisId, 'found entry:', municipalEntry);
            } else if (cleanRegion && cleanRegionalUnit && cleanMunicipality) {
              // Municipal level without community - use municipality code (6 digits)
              console.log('Searching for Municipality level entry...');
              const municipalEntry = kallikratisData.find(entry =>
                entry.perifereia === cleanRegion &&
                entry.perifereiaki_enotita === cleanRegionalUnit &&
                entry.onoma_neou_ota === cleanMunicipality
              );
              kallikratisId = municipalEntry?.id || null;
              console.log('Municipal level (municipality only) - kallikratis_id:', kallikratisId, 'found entry:', municipalEntry);
            } else if (cleanRegion && cleanRegionalUnit) {
              // Regional unit level - use regional unit code (3 digits)
              console.log('Searching for Regional Unit level entry...');
              const regionalUnitEntry = kallikratisData.find(entry =>
                entry.perifereia === cleanRegion &&
                entry.perifereiaki_enotita === cleanRegionalUnit
              );
              kallikratisId = regionalUnitEntry?.id || null;
              console.log('Regional unit level - kallikratis_id:', kallikratisId, 'found entry:', regionalUnitEntry);
            } else if (cleanRegion) {
              // Regional level - use region code (1 digit)
              console.log('Searching for Regional level entry...');
              const regionalEntry = kallikratisData.find(entry =>
                entry.perifereia === cleanRegion
              );
              kallikratisId = regionalEntry?.id || null;
              console.log('Regional level - kallikratis_id:', kallikratisId, 'found entry:', regionalEntry);
            }
          } else {
            console.log('No kallikratis data available');
          }
          
          return {
            implementing_agency: location.implementing_agency,
            event_type: data.event_details.event_name,
            expenditure_types: location.expenditure_types,
            region: {
              perifereia: cleanRegion,
              perifereiaki_enotita: cleanRegionalUnit,
              dimos: cleanMunicipality,
              dimotiki_enotita: cleanMunicipalCommunity,
              kallikratis_id: kallikratisId
            }
          };
        })
      };
      
      console.log('Transformed data for API:', transformedData);
      console.log('Making API request to:', `/api/projects/${mis}`);
      
      try {
        const response = await apiRequest(`/api/projects/${mis}`, {
          method: "PATCH",
          body: JSON.stringify(transformedData),
        });
        console.log('API response received:', response);
        return response;
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Επιτυχία", description: "Τα στοιχεία του έργου ενημερώθηκαν επιτυχώς" });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}/index`] });
      navigate(`/projects/${mis}`);
    },
    onError: () => {
      toast({ title: "Σφάλμα", description: "Παρουσιάστηκε σφάλμα κατά την ενημέρωση", variant: "destructive" });
    },
  });

  const handleSubmit = (data: ComprehensiveFormData) => {
    console.log('=== FORM SUBMISSION DEBUG ===');
    console.log('Form data received:', data);
    console.log('Form validation errors:', form.formState.errors);
    console.log('Form is valid:', form.formState.isValid);
    console.log('Mutation is pending:', mutation.isPending);
    
    // Check for specific validation errors and show detailed messages
    const errors = form.formState.errors;
    if (Object.keys(errors).length > 0) {
      console.error('Form validation failed with errors:', errors);
      
      // Create detailed error message
      let errorMessage = "Παρακαλώ συμπληρώστε τα υποχρεωτικά πεδία:\n";
      
      if (errors.event_details?.event_name) {
        errorMessage += "• Τύπος Συμβάντος\n";
      }
      if (errors.event_details?.event_year) {
        errorMessage += "• Έτος Συμβάντος\n";
      }
      if (errors.location_details) {
        errorMessage += "• Στοιχεία Τοποθεσίας\n";
      }
      if (errors.project_details) {
        errorMessage += "• Στοιχεία Έργου\n";
      }
      
      toast({ 
        title: "Απαιτούνται επιπλέον στοιχεία", 
        description: errorMessage,
        variant: "destructive" 
      });
      
      // Scroll to first error field
      const firstErrorElement = document.querySelector('[data-invalid="true"]');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      return;
    }
    
    console.log('Form validation passed, triggering mutation...');
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
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormControl>
                                  <Select 
                                    key={`event-type-${form.watch("event_details.event_name")}`}
                                    value={form.watch("event_details.event_name") || ""} 
                                    onValueChange={field.onChange}
                                  >
                                    <SelectTrigger 
                                      className={`border-0 ${fieldState.error ? "bg-red-50 text-red-700" : ""}`}
                                      data-invalid={fieldState.error ? "true" : "false"}
                                    >
                                      <SelectValue placeholder="Επιλέξτε συμβάν" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {eventTypesData?.map((eventType: any) => {
                                        console.log('Event type data:', eventType);
                                        return (
                                          <SelectItem key={eventType.id} value={eventType.name}>
                                            {eventType.name}
                                          </SelectItem>
                                        );
                                      })}
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
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    className={`border-0 ${fieldState.error ? "bg-red-50 text-red-700" : ""}`}
                                    placeholder="π.χ. 2024"
                                    data-invalid={fieldState.error ? "true" : "false"}
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <p className="text-red-600 text-xs mt-1">{fieldState.error.message}</p>
                                )}
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
                                  key={`region-${index}-${form.watch(`location_details.${index}.region`)}`}
                                  value={form.watch(`location_details.${index}.region`) || ""}
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
                                  key={`regional-unit-${index}-${form.watch(`location_details.${index}.regional_unit`)}`}
                                  value={form.watch(`location_details.${index}.regional_unit`) || ""}
                                  onValueChange={(value) => updateLocationField(index, 'regional_unit', value)}
                                  disabled={!form.watch(`location_details.${index}.region`)}
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
                                  key={`municipality-${index}-${form.watch(`location_details.${index}.municipality`)}`}
                                  value={form.watch(`location_details.${index}.municipality`) || ""}
                                  onValueChange={(value) => updateLocationField(index, 'municipality', value)}
                                  disabled={!form.watch(`location_details.${index}.regional_unit`)}
                                >
                                  <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors disabled:bg-gray-100">
                                    <SelectValue placeholder="Select municipality (optional for regional projects)..." />
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
                                  key={`municipal-community-${index}-${form.watch(`location_details.${index}.municipal_community`)}`}
                                  value={form.watch(`location_details.${index}.municipal_community`) || ""}
                                  onValueChange={(value) => updateLocationField(index, 'municipal_community', value)}
                                  disabled={!form.watch(`location_details.${index}.municipality`)}
                                >
                                  <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors disabled:bg-gray-100">
                                    <SelectValue placeholder="Select municipal community (optional)..." />
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
                              key={`implementing-agency-${index}-${form.watch(`location_details.${index}.implementing_agency`)}`}
                              value={form.watch(`location_details.${index}.implementing_agency`) || ""}
                              onValueChange={(value) => updateLocationField(index, 'implementing_agency', value)}
                            >
                              <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
                                <SelectValue placeholder="Select implementing agency..." />
                              </SelectTrigger>
                              <SelectContent>
                                {unitsData?.map((unit: any, unitIndex: number) => {
                                  const unitValue = unit.id; // Use the id field which contains the short unit code
                                  const unitDisplay = unit.name; // Use name field for display
                                  return (
                                    <SelectItem key={`unit-${index}-${unitIndex}`} value={unitValue}>
                                      {unitDisplay}
                                    </SelectItem>
                                  );
                                })}
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
                                  const currentExpenditureTypes = form.watch(`location_details.${index}.expenditure_types`) || [];
                                  const isSelected = currentExpenditureTypes.includes(expType.expediture_types);
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
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">MIS</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[80px]">ΣΑ</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[120px]">Κωδικός<br />ενάριθμος</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">Έτος<br />ένταξης</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[150px]">Τίτλος έργου<br />(σύστημα)</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[150px]">Περιγραφή<br />έργου</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[150px]">Συνοπτική<br />περιγραφή έργου</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[180px]">Δαπάνες που<br />εκτελούνται από<br />το έργο</th>
                        <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[120px]">Κατάσταση<br />έργου</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.mis"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.sa"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.enumeration_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.inclusion_year"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.project_title"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.project_description"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea {...field} rows={2} className="bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm resize-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.summary_description"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea {...field} rows={2} className="bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm resize-none" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.expenses_executed"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <FormField
                            control={form.control}
                            name="project_details.project_status"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
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
                      <table className="w-full border-collapse border border-gray-300 bg-white rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700">ΣΑ</th>
                            <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700">Κωδικός<br />Ενάριθμος</th>
                            <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700">Ενέργειες</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.watch("previous_entries").map((_, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 p-2">
                                <FormField
                                  control={form.control}
                                  name={`previous_entries.${index}.sa`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-300 p-2">
                                <FormField
                                  control={form.control}
                                  name={`previous_entries.${index}.enumeration_code`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border border-gray-300 p-2 text-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removePreviousEntry(index)}
                                  className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50 h-10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button type="button" onClick={addPreviousEntry} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow-sm hover:shadow transition-all duration-200">
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη γραμμής
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section 4: Formulation Details */}
              <div className="bg-white border border-gray-300 rounded-lg p-8 shadow-sm">
                <h3 className="text-xl font-semibold mb-6 text-gray-800 border-b border-gray-200 pb-4">
                  Section 4: Στοιχεία κατάρτισης έργου
                </h3>
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Σημείωση:</strong> Τα ποσά εισάγονται σε ευρώ με δεκαδικά ψηφία (π.χ. 1234,56). 
                    Η εφαρμογή χρησιμοποιεί το ελληνικό σύστημα νομισματικής μορφοποίησης.
                  </p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 bg-white rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700">ΣΑ</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[120px]">Κωδικός<br />ενάριθμος</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[140px]">Αρ. πρωτ.<br />Απόφασης</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">ΑΔΑ</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">Έτος<br />Απόφασης</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[140px]">Προϋπολογισμός<br />έργου</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">Έκδοση<br />ΕΠΑ</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[140px]">Συνολική<br />δημόσια δαπάνη</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[140px]">Επιλέξιμη<br />δημόσια δαπάνη</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[120px]">Κατάσταση<br />Απόφασης</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">Μεταβολή</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[160px]">Αποφάσεις που<br />συνδέονται</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700 min-w-[100px]">Σχόλια</th>
                          <th className="border border-gray-300 p-3 text-sm font-medium text-gray-700">Ενέργειες</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.watch("formulation_details").map((_, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.sa`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
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
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.enumeration_code`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
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
                                      <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
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
                                      <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
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
                                      <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
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
                                      <Input 
                                        {...field} 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm"
                                        placeholder="0,00 €"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          field.onChange(value ? parseFloat(value) : '');
                                        }}
                                        value={field.value || ''}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.epa_version`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.total_public_expense`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm"
                                        placeholder="0,00 €"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          field.onChange(value ? parseFloat(value) : '');
                                        }}
                                        value={field.value || ''}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.eligible_public_expense`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm"
                                        placeholder="0,00 €"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          field.onChange(value ? parseFloat(value) : '');
                                        }}
                                        value={field.value || ''}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.decision_status`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
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
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.change_type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors">
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
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.connected_decisions`}
                                render={({ field }) => {
                                  const decisions = form.watch("decisions") || [];
                                  const availableDecisions = decisions
                                    .filter(decision => decision.protocol_number || decision.fek || decision.ada)
                                    .map((decision, idx) => ({
                                      value: `${decision.protocol_number}-${decision.fek}-${decision.ada}`.replace(/^-+|-+$/g, '').replace(/-+/g, '-'),
                                      label: `${decision.protocol_number ? `Πρωτ: ${decision.protocol_number}` : ''}${decision.fek ? ` ΦΕΚ: ${decision.fek}` : ''}${decision.ada ? ` ΑΔΑ: ${decision.ada}` : ''}`.trim(),
                                      fullRef: decision
                                    }))
                                    .filter(item => item.label);

                                  return (
                                    <FormItem>
                                      <FormControl>
                                        <div className="space-y-2">
                                          <Select 
                                            value={field.value || ''} 
                                            onValueChange={(value) => {
                                              const selectedDecision = availableDecisions.find(d => d.value === value);
                                              if (selectedDecision) {
                                                field.onChange(selectedDecision.label);
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm">
                                              <SelectValue placeholder="Επιλέξτε σχετική απόφαση..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="">Καμία σύνδεση</SelectItem>
                                              {availableDecisions.map((decision) => (
                                                <SelectItem key={decision.value} value={decision.value}>
                                                  {decision.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Input 
                                            {...field} 
                                            className="h-8 bg-gray-50 border border-gray-200 text-xs" 
                                            placeholder="Ή εισάγετε χειροκίνητα..."
                                          />
                                        </div>
                                      </FormControl>
                                    </FormItem>
                                  );
                                }}
                              />
                            </td>
                            <td className="border border-gray-300 p-2">
                              <FormField
                                control={form.control}
                                name={`formulation_details.${index}.comments`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} className="h-10 bg-white border border-gray-300 hover:border-gray-400 transition-colors text-sm" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="border border-gray-300 p-2 text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeFormulationDetail(index)}
                                className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50 h-10"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Button type="button" onClick={addFormulationDetail} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow-sm hover:shadow transition-all duration-200">
                      <Plus className="h-4 w-4 mr-2" />
                      Προσθήκη γραμμής
                    </Button>
                  </div>
                </div>
              </div>

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