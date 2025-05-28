import * as React from "react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileText,
  FileX,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnimatePresence, motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SimpleAFMAutocomplete } from "@/components/ui/simple-afm-autocomplete";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { useBudgetUpdates } from "@/hooks/use-budget-updates";
import type {
  BudgetValidationResponse,
  Project as ProjectType,
  Unit,
  Recipient as RecipientType,
  ApiResponse,
} from "@/lib/types";
import { BudgetIndicator } from "@/components/ui/budget-indicator";
import { useDocumentForm } from "@/contexts/document-form-context";

// Constants
const DKA_TYPES = ["ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ", "ΔΚΑ ΕΠΙΣΚΕΥΗ", "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ"];
const DKA_INSTALLMENTS = ["ΕΦΑΠΑΞ", "Α", "Β", "Γ"];
const ALL_INSTALLMENTS = ["ΕΦΑΠΑΞ", "Α", "Β", "Γ"];

// Project selection component
interface Project {
  id: string;
  mis?: string;
  name: string;
  expenditure_types: string[];
}

interface ProjectSelectProps {
  value?: string;
  onChange: (value: string) => void;
  projects: Project[];
  disabled?: boolean;
}

function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Optimized project select component with better search performance and error handling
const ProjectSelect = React.forwardRef<HTMLButtonElement, ProjectSelectProps>(
  function ProjectSelect(props, ref) {
    const { value, onChange, projects, disabled } = props;
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const commandRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Only log in development mode if needed for debugging
    useEffect(() => {
      if (process.env.NODE_ENV === 'development' && value) {
        // Debug logging removed in production
      }
    }, [value, projects, disabled]);

    // Cache the selected project to prevent unnecessary lookups
    const selectedProject = useMemo(() => 
      projects.find((project) => project.id === value),
    [projects, value]);

    // Use a 300ms debounce for search to prevent UI lag
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Text normalization helper for more accurate search results
    const normalizeText = useCallback((text: string) => {
      // Avoid operations on empty text
      if (!text) return "";
      
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .trim();
    }, []);

    // Extract NA853 code from project names for better display
    const extractNA853Info = useCallback((name: string) => {
      if (!name) return null;
      
      // Look for patterns like 2024ΝΑ85300016 or 2024NA85300016
      const match = name.match(/\d{4}(?:NA|ΝΑ)853\d+/i);
      if (!match) return null;
      
      const code = match[0];
      const parts = name.split(" - ");
      
      return {
        full: code,
        displayText: parts.length > 1 ? parts.slice(1).join(" - ") : name, // Handle missing separator
        numbers: code.replace(/\D/g, ""), // Extract all numbers from the code
        originalMatch: match,
      };
    }, []);

    // Memoized filtered projects list with improved error handling
    const filteredProjects = useMemo(() => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set searching state with a small delay to prevent flashing UI
      setIsSearching(true);
      setError(null);

      try {
        // Return all projects if search is empty
        if (!debouncedSearchQuery.trim()) {
          searchTimeoutRef.current = setTimeout(() => setIsSearching(false), 100);
          return projects;
        }

        const searchTerm = normalizeText(debouncedSearchQuery);
        const isNumericSearch = /^\d+$/.test(searchTerm);
        
        // Remove all debug logging for cleaner console

        // Improved search algorithm with better error tolerance
        const results = projects.filter((project) => {
          // Guard against undefined projects
          if (!project || !project.name || !project.id) return false;
          
          const normalizedProjectName = normalizeText(project.name);
          const normalizedProjectId = normalizeText(project.id);
          
          // Match project ID for NA853 codes
          if (normalizedProjectId.includes(searchTerm)) {
            return true;
          }
          
          // For numeric searches, try to match MIS field too
          if (isNumericSearch && project.mis) {
            const normalizedMis = normalizeText(project.mis);
            if (normalizedMis.includes(searchTerm)) {
              return true;
            }
          }
          
          // Finally check project name
          return normalizedProjectName.includes(searchTerm);
        });

        // Show meaningful error message if no results
        if (results.length === 0) {
          setError(
            `Δεν βρέθηκαν έργα που να ταιριάζουν με "${debouncedSearchQuery}"`,
          );
        }

        return results;
      } catch (error) {
        console.error("Project search error:", error);
        setError("Σφάλμα κατά την αναζήτηση. Παρακαλώ δοκιμάστε ξανά.");
        return projects;
      } finally {
        // Clear searching state with a slight delay to prevent UI flicker
        searchTimeoutRef.current = setTimeout(() => setIsSearching(false), 100);
      }
    }, [projects, debouncedSearchQuery, normalizeText]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
      // Reset search query when selection changes
      if (selectedProject && !isFocused) {
        const na853Info = extractNA853Info(selectedProject.name);
        const displayText = na853Info
          ? `${na853Info.full} - ${na853Info.displayText}`
          : selectedProject.name;
        setSearchQuery(displayText);
      }
    }, [selectedProject, isFocused, extractNA853Info]);

    const handleFocus = () => {
      setIsFocused(true);
      setSearchQuery("");
    };

    const handleBlur = () => {
      setTimeout(() => {
        if (selectedProject && !searchQuery.trim()) {
          const na853Info = extractNA853Info(selectedProject.name);
          const displayText = na853Info
            ? `${na853Info.full} - ${na853Info.displayText}`
            : selectedProject.name;
          setSearchQuery(displayText);
        }
        setIsFocused(false);
      }, 200);
    };

    return (
      <div className="relative w-full min-w-[500px]">
        <Command
          className="relative rounded-lg border shadow-md w-full min-w-[500px] overflow-visible"
          ref={commandRef}
        >
          <div className="flex items-center px-4 py-3 gap-3 bg-background w-full">
            <Search className="h-5 w-5 shrink-0 opacity-50" />
            <CommandInput
              ref={inputRef}
              value={searchQuery}
              onValueChange={setSearchQuery}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Αναζήτηση με NA853 ή όνομα έργου"
              className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground focus:ring-0 h-auto py-1 w-full min-w-[500px]"
            />
            {isSearching && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            )}
            {/* <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"></kbd> */}
          </div>

          {isFocused && (
            <>
              {error ? (
                <div className="p-4 text-center">
                  <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-6 text-center text-sm">
                    Δεν βρέθηκαν έργα
                  </CommandEmpty>

                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                    {filteredProjects.map((project) => {
                      const na853Info = extractNA853Info(project.name);
                      const displayName = na853Info
                        ? na853Info.displayText
                        : project.name;
                      return (
                        <CommandItem
                          key={project.id}
                          value={project.id}
                          onSelect={(value) => {
                            onChange(value);
                            setIsFocused(false);
                          }}
                          className={cn(
                            "cursor-pointer py-3 px-4 hover:bg-accent",
                            project.id === value && "bg-accent",
                          )}
                        >
                          <div className="flex flex-col gap-1 w-full">
                            <Badge
                              variant="outline"
                              className="text-xs w-fit mb-1"
                            >
                              {na853Info?.full || project.id}
                            </Badge>
                            <span className="text-sm break-words">
                              {displayName}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </Command>
      </div>
    );
  },
);

ProjectSelect.displayName = "ProjectSelect";

// Interfaces
// Εισαγωγή του τύπου BudgetData από το lib/types
import type { BudgetData as BaseBudgetData } from "@/lib/types";

// Χρησιμοποιούμε τον ίδιο τύπο για συμβατότητα
interface BudgetData extends BaseBudgetData {}

// Use the interface from the imported BudgetIndicator component

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

// Animation variants
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
  }),
};

// Step Indicator Component
const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { title: "Επιλογή Μονάδας", icon: <User className="h-4 w-4" /> },
    { title: "Στοιχεία Έργου", icon: <FileText className="h-4 w-4" /> },
    { title: "Δικαιούχοι", icon: <User className="h-4 w-4" /> },
    { title: "Συνημμένα", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`flex items-center justify-center ${
              index <= currentStep ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                index === currentStep
                  ? "border-primary bg-primary/10"
                  : index < currentStep
                    ? "border-primary bg-primary text-background"
                    : "border-muted"
              }`}
            >
              {index < currentStep ? <Check className="h-4 w-4" /> : step.icon}
            </div>
            <span className="ml-2 text-sm font-medium hidden md:block">
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <ChevronDown
              className={`mx-2 h-4 w-4 rotate-[-90deg] ${
                index < currentStep ? "text-primary" : "text-muted-foreground"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// Removed: Local BudgetIndicator Component - now importing from @/components/ui/budget-indicator

// Schemas
const recipientSchema = z.object({
  firstname: z
    .string()
    .min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  lastname: z
    .string()
    .min(2, "Το επώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  fathername: z.string().optional().default(""), // Made optional with empty string default
  afm: z.string().length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία"),
  amount: z.number().min(0.01, "Το ποσό πρέπει να είναι μεγαλύτερο από 0"),
  // Νέο πεδίο για δευτερεύον κείμενο - default empty string
  secondary_text: z.string().default(""),
  // Για συμβατότητα με το API (παλιά μορφή)
  installment: z.string().optional().default("Α"),
  // Νέο schema για πολλαπλές δόσεις ανά παραλήπτη
  installments: z
    .array(z.string())
    .min(1, "Πρέπει να επιλέξετε τουλάχιστον μία δόση"),
  // Installment amounts map - keys are installment names (e.g., "Α", "Β", "ΕΦΑΠΑΞ"), values are amounts
  installmentAmounts: z.record(z.string(), z.number()).optional().default({}),
});

const createDocumentSchema = z.object({
  unit: z.string().min(1, "Η μονάδα είναι υποχρεωτική"),
  project_id: z.string().min(1, "Το έργο είναι υποχρεωτικό"),
  region: z.string().optional(),
  expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
  recipients: z.array(recipientSchema).optional().default([]),
  total_amount: z.number().optional(),
  status: z.string().default("draft"),
  selectedAttachments: z.array(z.string()).optional().default([]),
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

// Main component
export function CreateDocumentDialog({
  open,
  onOpenChange,
  onClose,
}: CreateDocumentDialogProps) {
  // Get form state from context
  const { formData, updateFormData, currentStep: savedStep, setCurrentStep: setSavedStep } = useDocumentForm();
  
  // Basic state
  const [currentStep, setLocalCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formReset, setFormReset] = useState(false);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  // References
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const dialogCloseRef = React.useRef<HTMLButtonElement>(null);
  
  // Set current step using the context
  // COMPLETE REWRITE: Advanced form step management with guaranteed state preservation
  // This ensures all form values are saved before any step transition occurs
  const setCurrentStep = (step: number) => {
    // Skip if step hasn't changed to prevent unnecessary renders
    if (step === currentStep) {
      return;
    }
    
    // CRITICAL FIX: Capture and preserve *all* form values before changing step
    const captureFormState = () => {
      try {
        // Skip if we're not mounted yet or form isn't available
        if (!form) {
          return;
        }
        
        // Get current values directly from the form
        const formValues = form.getValues();
        
        // Removed debug logging for better performance
        
        // Create a timeout to push these updates outside the current render cycle
        // This prevents the Maximum update depth exceeded error
        setTimeout(() => {
          // Always save ALL form field values to context before changing steps
          // This is the critical fix for the unit reset issue
          updateFormData({
            unit: formValues.unit,
            project_id: formValues.project_id,
            region: formValues.region,
            expenditure_type: formValues.expenditure_type,
            recipients: formValues.recipients,
            status: formValues.status || "draft",
            selectedAttachments: formValues.selectedAttachments
          });
          
          if (formValues.project_id) {
            // Only broadcast budget updates if we have a project ID and when moving to recipient step
            if (step === 2 && budgetData && broadcastUpdate) {
              try {
                if (broadcastUpdate) {
                  broadcastUpdate(currentAmount || 0);
                }
              } catch (e) {
                console.error("[CreateDocument] Error broadcasting budget update:", e);
              }
            }
          }
        }, 0);
      } catch (err) {
        console.error("[CreateDocument] Error preserving form state:", err);
      }
    };
    
    // Always preserve form state during step changes
    captureFormState();
    
    // Then update step state in a consistent order but with a small delay
    // to ensure we're not updating state during a render cycle
    setTimeout(() => {
      // First update the context step
      setSavedStep(step);
      // Then update local step 
      setLocalCurrentStep(step);
    }, 0);
  };
  
  // CRITICAL FIX: Υλοποίηση σωστού συγχρονισμού του context με τη φόρμα
  // Διασφάλιση ότι οι τιμές που έρχονται από το context δεν θα χαθούν με χρήση useEffect
  const formDefaultValues = useMemo(() => ({
    unit: formData.unit || "",
    project_id: formData.project_id || "",
    region: formData.region || "",
    expenditure_type: formData.expenditure_type || "",
    recipients: formData.recipients || [],
    status: formData.status || "draft",
    selectedAttachments: formData.selectedAttachments || [],
  }), []);
  
  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: formDefaultValues,
  });
  
  // OPTIMIZED: Units query defined early to avoid reference errors
  const { 
    data: units = [], 
    isLoading: unitsLoading,
    refetch: refetchUnits 
  } = useQuery({
    queryKey: ["public-units"],
    queryFn: async () => {
      try {
        // Fetch units using public endpoint
        
        // Use the new public endpoint which doesn't require authentication
        // Use fetch directly to bypass the API request function's authentication handling
        const response = await fetch("/api/public/units", {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "X-Request-ID": `units-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          }
        });

        if (!response.ok) {
          console.error(`[CreateDocument] Units fetch error: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch units: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data)) {
          console.error("[CreateDocument] Error fetching units: Invalid response format", data);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive",
          });
          return [];
        }

        // Units fetched successfully - processing data
        
        // Enhanced data transformation with additional debugging
        console.log("[CreateDocument] Processing units data:", JSON.stringify(data));
        
        // Process abbreviated unit IDs mapping
        const unitAbbreviations: Record<string, string> = {
          "ΔΑΕΦΚ-ΚΕ": "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
          "ΔΑΕΦΚ-ΒΕ": "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΒΟΡΕΙΑΣ ΕΛΛΑΔΟΣ",
          "ΔΑΕΦΚ-ΔΕ": "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΕΛΛΑΔΟΣ",
          "ΤΑΕΦΚ-ΑΑ": "ΤΜΗΜΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ",
          "ΤΑΕΦΚ-ΔΑ": "ΤΜΗΜΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΑΤΤΙΚΗΣ"
        };
        
        // If the user only has access to one unit, track it for auto-selection
        let userSingleUnit = "";
        if (user?.units?.length === 1) {
          userSingleUnit = user.units[0];
        }
        
        const processedUnits = data.map((item: any) => {
          // For debugging purposes
          if (!item.unit && !item.id) {
            console.warn("[CreateDocument] Unit missing id/unit field:", item);
          }
          
          // First handle the ID
          let unitId = item.id || item.unit || '';
          
          // Ensure the unit ID matches the expected format if it's abbreviated
          if (user?.units?.includes(unitId) || Object.keys(unitAbbreviations).includes(unitId)) {
            // Keep the unit ID as is - it's already in the correct format
          } else if (unitId.length > 20) {
            // For long unit IDs, try to find the abbreviated form
            const abbrevEntry = Object.entries(unitAbbreviations).find(([abbrev, fullName]) => 
              fullName === unitId || unitId.includes(fullName)
            );
            
            if (abbrevEntry) {
              unitId = abbrevEntry[0]; // Use the abbreviated form
            }
          }
          
          // Then handle the display name with proper fallbacks
          let unitName = '';
          
          // Case 1: Direct name property
          if (item.name) {
            unitName = item.name;
          } 
          // Case 2: unit_name is a string
          else if (typeof item.unit_name === 'string') {
            unitName = item.unit_name;
          } 
          // Case 3: unit_name is an object with name property
          else if (item.unit_name && typeof item.unit_name === 'object' && item.unit_name.name) {
            unitName = item.unit_name.name;
          }
          // Case 4: Look up the full name from abbreviations
          else if (unitAbbreviations[unitId]) {
            unitName = unitAbbreviations[unitId];
          }
          // Case 5: Fall back to unit value if nothing else
          else {
            unitName = String(item.unit || unitId || 'Άγνωστη Μονάδα');
          }
          
          return {
            id: unitId,
            name: unitName,
          };
        });
        
        return processedUnits;
      } catch (error) {
        console.error("[CreateDocument] Units fetch error:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive",
        });
        return [];
      }
    },
    retry: 2,
  });

  // COMPLETE REWRITE: Multi-stage dialog initialization for complete flicker prevention
  // Uses advanced state management and form reconciliation techniques
  const dialogInitializationRef = useRef<{
    isInitializing: boolean;
    hasPreservedUnit: boolean; 
    initialUnit: string;
    initialFormState: any;
  }>({
    isInitializing: false,
    hasPreservedUnit: false,
    initialUnit: '',
    initialFormState: null
  });

  const handleDialogOpen = useCallback(async () => {
    // CRITICAL: Block dialog reinitialization during autocomplete operations
    if (isAutocompletingRef.current) {
      console.log("[CreateDocument] Blocked dialog reinitialization during autocomplete");
      return;
    }
    
    // CRITICAL: Block reinitialization if dialog is already open and in use
    if (open && currentStep > 0) {
      console.log("[CreateDocument] Blocked reinitialization - dialog already in use at step:", currentStep);
      return;
    }
    
    // Prevent duplicate initializations
    if (dialogInitializationRef.current.isInitializing) {
      return;
    }
    
    // Only reset for truly new documents (when dialog first opens)
    if (!open) {
      console.log("[CreateDocument] Starting fresh document creation");
      
      // Don't reset the unit if user has one assigned - preserve auto-selection
      const defaultUnit = user?.units && user.units.length > 0 ? user.units[0] : "";
      
      // Reset form to default values for new document, but preserve unit
      form.reset({
        unit: defaultUnit,
        project_id: "",
        region: "",
        expenditure_type: "",
        recipients: [],
        status: "draft",
        selectedAttachments: []
      });
      
      // Reset context state with preserved unit
      updateFormData({
        unit: defaultUnit,
        project_id: "",
        region: "",
        expenditure_type: "",
        recipients: [],
        status: "draft",
        selectedAttachments: []
      });
      setCurrentStep(0);
      
      if (defaultUnit) {
        console.log("[CreateDocument] Preserved user unit during reset:", defaultUnit);
      }
    }
    
    // Dialog initialization - form and units data will be refreshed
    
    // ANTI-FLICKER: Capture initial state before any operations
    dialogInitializationRef.current = {
      isInitializing: true,
      hasPreservedUnit: !!formData?.unit,
      initialUnit: formData?.unit || '',
      initialFormState: { ...formData }
    };
    
    // Prevent form-context sync during initialization
    isUpdatingFromContext.current = true;
    setFormReset(true);
    
    try {
      // STAGE 1: Authenticate and prefetch data silently - don't touch the form yet
      // Fetch user data only - we'll refresh units through queryClient instead
      const refreshedUser = await refreshUser();
      
      // Refresh units via query invalidation - more reliable and avoids reference issues
      try {
        // Force refresh units data through query invalidation
        queryClient.invalidateQueries({ queryKey: ["public-units"] });
        // Units query invalidated to refresh data
      } catch (err) {
        console.warn("[CreateDocument] Non-critical error refreshing units:", err);
      }
      
      if (!refreshedUser) {
        console.warn("[CreateDocument] No authenticated user found, dialog may not function properly");
        toast({
          title: "Προειδοποίηση σύνδεσης",
          description: "Η συνεδρία σας ενδέχεται να έχει λήξει. Αν αντιμετωπίσετε προβλήματα, ανανεώστε τη σελίδα.",
          duration: 6000,
        });
      }
      
      // STAGE 2: Prepare form values with complete fallbacks to prevent undefined
      // This also ensures we don't lose any values from context
      const formValues = {
        unit: formData?.unit || "",
        project_id: formData?.project_id || "",
        region: formData?.region || "",
        expenditure_type: formData?.expenditure_type || "",
        recipients: Array.isArray(formData?.recipients) ? [...formData.recipients] : [],
        status: formData?.status || "draft",
        selectedAttachments: Array.isArray(formData?.selectedAttachments) ? [...formData.selectedAttachments] : []
      };
      
      // STAGE 3: Apply all form values in a single atomic operation
      // This reduces form re-render & prevents flicker during initialization
      await form.reset(formValues, { keepDefaultValues: false });
      
      // STAGE 4: Restore step from context if valid (without triggering additional updates)
      if (typeof savedStep === 'number' && savedStep >= 0 && currentStep !== savedStep) {
        setLocalCurrentStep(savedStep);
      }
      
      // STAGE 5: Force data refresh in the background
      queryClient.invalidateQueries({ queryKey: ["public-units"] });
      
      // Only log if we actually had data to restore
      if (formData?.unit || formData?.project_id) {
        // Form initialized from context successfully
      }
    } catch (error) {
      // Error handling without console noise
      toast({
        title: "Σφάλμα",
        description: "Προέκυψε σφάλμα κατά την προετοιμασία της φόρμας. Παρακαλώ δοκιμάστε ξανά.",
        variant: "destructive",
      });
    } finally {
      // STAGE 6: Carefully re-enable updates with strategic delays
      // This prevents race conditions that cause flickering
      const resetTimeout = setTimeout(() => {
        // First reset the form reset flag
        setFormReset(false);
        
        // Then after a small delay, re-enable context updates
        const updateTimeout = setTimeout(() => {
          isUpdatingFromContext.current = false;
          dialogInitializationRef.current.isInitializing = false;
        }, 200);
        
        return () => clearTimeout(updateTimeout);
      }, 300);
      
      return () => clearTimeout(resetTimeout);
    }
  }, [form, formData, queryClient, refreshUser, savedStep, toast, currentStep]);
  
  // Effect to handle dialog open state - FIXED: Remove handleDialogOpen from dependencies to prevent infinite loop
  useEffect(() => {
    if (open && !dialogInitializationRef.current.isInitializing) {
      handleDialogOpen();
    }
  }, [open]); // Removed handleDialogOpen from dependencies

  // CRITICAL FIX: Completely redesigned unit default-setting mechanism
  // Uses a separate reference to track unit initialization to prevent duplicate operations
  const unitInitializationRef = useRef({
    isCompleted: false,
    attemptCount: 0,
    defaultUnit: '',
  });
  
  // Fixed unit auto-selection with proper dependency management
  const hasAutoSelectedUnit = useRef(false);
  
  useEffect(() => {
    // Simple, stable unit auto-selection 
    if (!user || !open || hasAutoSelectedUnit.current) return;
    
    // Only set default unit if no unit is currently selected
    const currentUnit = form.getValues().unit;
    if (!currentUnit && user?.units && user.units.length > 0) {
      const defaultUnit = user.units[0];
      console.log("[CreateDocument] Auto-selected user's unit:", defaultUnit);
      
      // Set the unit in the form
      form.setValue("unit", defaultUnit);
      hasAutoSelectedUnit.current = true;
    }
  }, [user, open, form]); // Restore proper dependencies but use ref to prevent duplicate selections
  
  // Reset the auto-selection flag when dialog closes
  useEffect(() => {
    if (!open) {
      hasAutoSelectedUnit.current = false;
    }
  }, [open]);

  // Function to handle dialog closing with multiple fallback mechanisms
  const closeDialogCompletely = useCallback(() => {
    // No need to reset form data - we preserve state when closing

    // Direct click approach using ref
    if (dialogCloseRef.current) {
      dialogCloseRef.current.click();
    }

    // Use the provided callback functions
    onClose();
    onOpenChange(false);

    // Fallback with Escape key
    setTimeout(() => {
      if (open) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          }),
        );
      }
    }, 100);
  }, [onOpenChange, onClose, open]);

  const selectedUnit = form.watch("unit");
  const selectedProjectId = form.watch("project_id");
  const recipients = form.watch("recipients") || [];
  const selectedRegion = form.watch("region");
  const selectedExpenditureType = form.watch("expenditure_type");
  const selectedAttachments = form.watch("selectedAttachments") || [];

  // Use a reference to store the timeout ID for debouncing
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Flag to prevent circular updates
  const isUpdatingFromContext = useRef(false);
  
  // Flag to completely prevent dialog resets during autocomplete
  const isAutocompletingRef = useRef(false);
  
  // Memoized form state to prevent unnecessary re-renders
  const currentFormState = useMemo(() => {
    return {
      unit: selectedUnit,
      project_id: selectedProjectId,
      region: selectedRegion,
      expenditure_type: selectedExpenditureType,
      recipients: recipients,
      status: "draft",
      selectedAttachments: selectedAttachments,
    };
  }, [selectedUnit, selectedProjectId, selectedRegion, selectedExpenditureType, recipients, selectedAttachments]);
  
  // MAJOR OPTIMIZATION: State caching and deep comparison optimization 
  // This will dramatically reduce flicker by preventing needless updates
  const stateCache = useRef<{
    lastSyncedState?: any; // Last form state that was synced to context
    logCounter: number;  // Counter for reducing log frequency
    lastSyncTime: number;  // Timestamp of last sync
    pendingUpdates: number; // Track number of pending updates
  }>({
    logCounter: 0,
    lastSyncTime: 0,
    pendingUpdates: 0
  });

  // Major performance optimization: Stabilize form updates with advanced throttling
  const syncFormToContext = useCallback(() => {
    // Skip updates when we're loading from context to prevent circular updates
    if (isUpdatingFromContext.current) {
      return; // Silent skip for better performance
    }
    
    // Implement hard rate limiting - max 1 update per 1000ms
    const now = Date.now();
    const timeSinceLastSync = now - stateCache.current.lastSyncTime;
    
    // If we've synced very recently and have pending updates, skip this update
    // This prevents rapid-fire updates when typing quickly
    if (timeSinceLastSync < 200 && stateCache.current.pendingUpdates > 0) {
      stateCache.current.pendingUpdates++;
      return;
    }
    
    // Clear any existing timeout for better debounce control
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Deep comparison with memoization to avoid unnecessary updates
    const prevFormState = stateCache.current?.lastSyncedState;
    
    // Perform deep equality check to prevent unnecessary updates
    // This is critical for reducing flickering - we only update if data really changed
    let formStateChanged = !prevFormState;
    
    if (!formStateChanged && prevFormState) {
      try {
        // Use stable keys for comparison to avoid order-based differences
        const prevKeys = Object.keys(prevFormState).sort();
        const currentKeys = Object.keys(currentFormState).sort();
        
        // Quick length check first (faster)
        if (prevKeys.length !== currentKeys.length) {
          formStateChanged = true;
        } else {
          // Check if keys match
          formStateChanged = prevKeys.some((key, i) => key !== currentKeys[i]);
          
          // If keys match, check values deeply but efficiently
          if (!formStateChanged) {
            // Special handling for recipients to reduce deep comparison cost
            if (prevFormState.recipients && currentFormState.recipients && 
                prevFormState.recipients.length === currentFormState.recipients.length) {
              // Only check recipient length and first/last items for efficiency
              // This is a performance optimization that works well enough in practice
              if (prevFormState.recipients.length > 0) {
                // Check just count and a sample of content
                const prevFirst = JSON.stringify(prevFormState.recipients[0]);
                const currFirst = JSON.stringify(currentFormState.recipients[0]);
                
                if (prevFirst !== currFirst) {
                  formStateChanged = true;
                } else if (prevFormState.recipients.length > 1) {
                  // Check last item too if multiple recipients
                  const lastIndex = prevFormState.recipients.length - 1;
                  const prevLast = JSON.stringify(prevFormState.recipients[lastIndex]);
                  const currLast = JSON.stringify(currentFormState.recipients[lastIndex]);
                  formStateChanged = prevLast !== currLast;
                }
              }
            } else {
              // For all other properties, do a standard string comparison
              formStateChanged = JSON.stringify(prevFormState) !== JSON.stringify(currentFormState);
            }
          }
        }
      } catch (e) {
        // Fallback if comparison throws (for safety)
        formStateChanged = true;
      }
    }
    
    // Only proceed if the state actually changed
    if (!formStateChanged) {
      return;
    }
    
    // Adaptive delay based on how recently we did an update
    const updateDelay = timeSinceLastSync < 2000 ? 1000 : 500; 
    
    // Set a new timeout to update the context after a delay
    updateTimeoutRef.current = setTimeout(() => {
      // Update tracking state
      stateCache.current.lastSyncTime = Date.now();
      stateCache.current.pendingUpdates = 0;
      
      // Store the current state for future comparisons
      stateCache.current.lastSyncedState = JSON.parse(JSON.stringify(currentFormState));
      
      // Save to context with special flag to prevent circular updates
      updateFormData(currentFormState);
      
      // Log only very occasionally to reduce console noise
      if (stateCache.current.logCounter % 10 === 0) {
        // Form state saved to context for persistence
      }
      stateCache.current.logCounter++;
    }, updateDelay);
    
    // Track that we have a pending update
    stateCache.current.pendingUpdates++;
  }, [currentFormState, updateFormData, isUpdatingFromContext]);
  
  // Effect to trigger form sync when state changes - with optimized dependency list
  useEffect(() => {
    // Skip the initial render
    if (formReset) return;
    
    // Add a small delay to prevent immediate execution during render cycle
    const timer = setTimeout(() => {
      syncFormToContext();
    }, 0);
    
    // Cleanup function to clear timeout on unmount
    return () => {
      clearTimeout(timer);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [formReset]); // Remove syncFormToContext from dependencies to break infinite loop

  const currentAmount = recipients.reduce((sum: number, r) => {
    return sum + (typeof r.amount === "number" ? r.amount : 0);
  }, 0);

  // Debug log only occasionally to reduce console noise
  useEffect(() => {
    if (recipients.length > 0) {
      // Only log when recipients change and at a reasonable frequency
      // Recipients updated in budget form
    }
  }, [recipients.length]);

  // Add this function to get available installments based on expenditure type
  const getAvailableInstallments = (expenditureType: string) => {
    return DKA_TYPES.includes(expenditureType)
      ? DKA_INSTALLMENTS
      : ALL_INSTALLMENTS;
  };

  // Helper function to check if installments are in sequence
  const areInstallmentsInSequence = (installments: string[]) => {
    if (installments.length <= 1) return true;
    if (installments.includes("ΕΦΑΠΑΞ") && installments.length > 1)
      return false;

    // Filter out ΕΦΑΠΑΞ and get only the Greek letter installments
    const letters = installments.filter((i) => i !== "ΕΦΑΠΑΞ");

    // Create a map of letter to index
    const letterOrder = ALL_INSTALLMENTS.reduce<Record<string, number>>(
      (acc, letter, idx) => {
        acc[letter] = idx;
        return acc;
      },
      {},
    );

    // Sort by the order of letters in ALL_INSTALLMENTS
    const sortedLetters = [...letters].sort(
      (a, b) => letterOrder[a] - letterOrder[b],
    );

    // Check if the letters are consecutive in ALL_INSTALLMENTS
    for (let i = 1; i < sortedLetters.length; i++) {
      const prevIdx = letterOrder[sortedLetters[i - 1]];
      const currIdx = letterOrder[sortedLetters[i]];
      if (currIdx - prevIdx !== 1) return false;
    }

    return true;
  };

  // Update the recipients section rendering
  const renderRecipientInstallments = (index: number) => {
    const expenditureType = form.watch("expenditure_type");
    const availableInstallments = getAvailableInstallments(expenditureType);
    const currentRecipient = form.watch(`recipients.${index}`);
    const selectedInstallments = currentRecipient?.installments || [];
    const installmentAmounts = currentRecipient?.installmentAmounts || {};

    // Control function to toggle an installment selection - simplified version
    const handleInstallmentToggle = (installment: string) => {
      // Toggling installment selection
      
      // Create a copy of current installments
      let newInstallments = [...selectedInstallments];
      
      // Handle ΕΦΑΠΑΞ special case (mutually exclusive)
      if (installment === "ΕΦΑΠΑΞ") {
        // Special case - if ΕΦΑΠΑΞ is already selected and clicked again, do nothing
        if (newInstallments.length === 1 && newInstallments[0] === "ΕΦΑΠΑΞ") {
          return;
        }
        
        // If ΕΦΑΠΑΞ is clicked, it should be the only option
        newInstallments = ["ΕΦΑΠΑΞ"];
      } else {
        // For any other option:
        
        // 1. Remove ΕΦΑΠΑΞ if present
        newInstallments = newInstallments.filter(i => i !== "ΕΦΑΠΑΞ");
        
        // 2. Toggle the selected installment
        if (newInstallments.includes(installment)) {
          // If already selected, remove it
          newInstallments = newInstallments.filter(i => i !== installment);
        } else {
          // If not selected, add it
          newInstallments.push(installment);
        }
        
        // 3. If no installments are left, fall back to ΕΦΑΠΑΞ
        if (newInstallments.length === 0) {
          newInstallments = ["ΕΦΑΠΑΞ"];
        }
        
        // 4. Validate installments are in sequence
        if (!areInstallmentsInSequence(newInstallments) && newInstallments.length > 1) {
          toast({
            title: "Μη έγκυρες δόσεις",
            description: "Οι δόσεις πρέπει να είναι διαδοχικές (π.χ. Α+Β ή Β+Γ, όχι Α+Γ)",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Sort installments in proper order: ΕΦΑΠΑΞ first, then Α, Β, Γ
      newInstallments.sort((a, b) => {
        const order = { "Α": 1, "Β": 2, "Γ": 3, "ΕΦΑΠΑΞ": 0 };
        return (order[a as keyof typeof order] || 99) - (order[b as keyof typeof order] || 99);
      });
      
      // Block context updates during this operation
      isUpdatingFromContext.current = true;
      
      try {
        // Create a new payment amounts object
        const newAmounts: Record<string, number> = {};
        
        // Copy over existing amounts for selected installments
        newInstallments.forEach(inst => {
          newAmounts[inst] = installmentAmounts[inst] || 0;
        });
        
        // Set ΕΦΑΠΑΞ amount to total if it's the only option
        if (newInstallments.length === 1 && newInstallments[0] === "ΕΦΑΠΑΞ") {
          newAmounts["ΕΦΑΠΑΞ"] = currentRecipient?.amount || 0;
        }
        
        // Log for debugging
        // Updated installments and amounts
        
        // Update form values immediately
        form.setValue(`recipients.${index}.installments`, newInstallments);
        form.setValue(`recipients.${index}.installmentAmounts`, newAmounts);
        
        // Wait a bit then update context to ensure changes are saved
        setTimeout(() => {
          // Only update if we're still on the same recipient
          if (form.getValues(`recipients.${index}`)) {
            const updatedRecipients = [...recipients];
            
            // Ensure we make a deep copy of the object to avoid reference issues
            if (updatedRecipients[index]) {
              updatedRecipients[index] = {
                ...updatedRecipients[index],
                installments: [...newInstallments],
                installmentAmounts: {...newAmounts}
              };
              
              updateFormData({
                recipients: updatedRecipients
              });
            }
          }
        }, 100);
      } finally {
        // Reset update flag with delay to prevent race conditions
        setTimeout(() => {
          isUpdatingFromContext.current = false;
        }, 150);
      }
    };

    // Handle changing the amount for an installment
    const handleInstallmentAmountChange = (
      installment: string,
      amount: number,
    ) => {
      // Updating installment amount
      
      // Set a flag to temporarily prevent context updates from reflecting back
      isUpdatingFromContext.current = true;
      
      try {
        // CRITICAL FIX: Guard against extremely large numbers that cause display issues
        // Check if the number is unreasonably large (more than 1 billion)
        // This prevents scientific notation or overflow display issues
        if (!isFinite(amount) || amount > 1000000000) {
          console.warn("[Budget Form] Prevented invalid amount entry:", amount);
          // Show a warning toast to user
          toast({
            title: "Μη έγκυρο ποσό",
            description:
              "Το ποσό που εισάγατε είναι πολύ μεγάλο και έχει διορθωθεί.",
            variant: "destructive",
          });
          amount = 0;
        }

        // Create a deep copy of current installment amounts - use a fresh new object
        // to prevent any reference issues
        const currentInstallmentAmounts = JSON.parse(JSON.stringify(installmentAmounts || {}));
        
        // Set the new amount for this installment
        currentInstallmentAmounts[installment] = amount;

        // Update total amount based on installment amounts - make sure we only sum numbers
        const totalAmount = Object.values(currentInstallmentAmounts).reduce<number>(
          (sum, val) => sum + (typeof val === 'number' ? val : 0),
          0,
        );

        // Apply the same check to the total amount as a safety measure
        const safeTotal =
          !isFinite(totalAmount) || totalAmount > 1000000000 ? 0 : totalAmount;

        // Updated recipient total amount
          
        // First, update the form's local state - use a specific order to avoid racing conditions
        form.setValue(
          `recipients.${index}.installmentAmounts`,
          currentInstallmentAmounts,
        );
        
        form.setValue(`recipients.${index}.amount`, safeTotal);
        
        // Updated installment amount and recalculated total recipient amount
          
        // Wait a small amount of time before updating context to avoid race conditions
        setTimeout(() => {
          // Make a deep copy of the recipients array to prevent reference issues
          const manuallyUpdatedRecipients = JSON.parse(JSON.stringify(recipients));
          
          if (manuallyUpdatedRecipients[index]) {
            // Update with a completely fresh object to avoid any reference issues
            manuallyUpdatedRecipients[index] = {
              ...manuallyUpdatedRecipients[index],
              amount: safeTotal,
              installmentAmounts: {...currentInstallmentAmounts}
            };
            
            // Updating form context with modified recipient data
            
            // Update form context directly with this single change
            // but don't trigger the normal useEffect
            updateFormData({
              recipients: manuallyUpdatedRecipients
            });
          }
        }, 100);
      } finally {
        // Reset flag after a longer delay to ensure all React updates complete
        setTimeout(() => {
          isUpdatingFromContext.current = false;
        }, 150);
      }
    };

    return (
      <div className="w-full">
        <div className="mb-2 flex items-center">
          <label className="text-sm font-medium mr-2 whitespace-nowrap">
            Δόσεις:
          </label>
          <div className="flex flex-row gap-1">
            {availableInstallments.map((installment) => (
              <Button
                key={installment}
                type="button"
                variant={
                  selectedInstallments.includes(installment)
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => handleInstallmentToggle(installment)}
                className="h-7 px-2 min-w-[32px]"
              >
                {installment}
              </Button>
            ))}
          </div>
        </div>

        {selectedInstallments.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              {selectedInstallments.map((installment) => (
                <div key={installment} className="flex items-center gap-1.5">
                  <div className="font-medium text-xs bg-muted px-2 py-1 rounded min-w-[60px] text-center">
                    {installment}
                  </div>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={installmentAmounts[installment] || 0}
                      onChange={(e) =>
                        handleInstallmentAmountChange(
                          installment,
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="pr-5 h-8 text-sm"
                      placeholder="Ποσό"
                    />
                    <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                      €
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs font-medium flex justify-between pt-1.5 border-t">
              <span>Συνολικό ποσό:</span>
              <span className="text-primary">
                {Object.values(installmentAmounts)
                  .reduce((sum: number, amount: number) => sum + (amount || 0), 0)
                  .toLocaleString("el-GR", {
                    style: "currency",
                    currency: "EUR",
                  })}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Queries below for other data using the units query defined at top of component

  const { data: projects = [], isLoading: projectsLoading } = useQuery<
    Project[]
  >({
    queryKey: ["projects", selectedUnit],
    queryFn: async (): Promise<Project[]> => {
      if (!selectedUnit) {
        // No unit selected, returning empty projects array
        return [];
      }

      try {
        // Fetching projects for the selected unit using working endpoint
        const url = `/api/projects-working/${encodeURIComponent(selectedUnit)}?t=${Date.now()}`;
        
        const response = await apiRequest<any>(url);

        // Force response to be an array with better error checking
        let projectsArray: any[] = [];

        if (!response) {
          console.error(
            "[Projects] Error fetching projects: No response received",
          );
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive",
          });
          return [];
        }

        // Determine if we have a valid response
        if (Array.isArray(response)) {
          projectsArray = response;
        } else if (
          response &&
          typeof response === "object" &&
          response.data &&
          Array.isArray(response.data)
        ) {
          // Handle wrapped API response {data: [...]}
          projectsArray = response.data;
        } else {
          console.error(
            "[Projects] Error fetching projects: Invalid response format",
            response,
          );
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης έργων. Μη έγκυρη μορφή απάντησης.",
            variant: "destructive",
          });
          return [];
        }

        // Handle empty array case
        if (projectsArray.length === 0) {
          // No projects found for the selected unit
          toast({
            title: "Πληροφορία",
            description: "Δεν βρέθηκαν έργα για την επιλεγμένη μονάδα.",
            variant: "destructive",
          });
          return [];
        }

        // Found projects for the selected unit

        // Map and transform the projects data
        const validProjects = projectsArray.filter(
          (item) => item !== null && item !== undefined,
        );

        return validProjects.map((item: any) => {
          // Process expenditure types
          let expenditureTypes: string[] = [];
          if (item.expenditure_type) {
            try {
              if (typeof item.expenditure_type === "string") {
                expenditureTypes = JSON.parse(item.expenditure_type);
              } else if (Array.isArray(item.expenditure_type)) {
                expenditureTypes = item.expenditure_type;
              }
            } catch (e) {
              console.error(
                "[Projects] Error parsing expenditure_type for project:",
                item.mis,
                e,
              );
            }
          }

          // Store both MIS and NA853 for proper querying
          const projectId = item.na853 || String(item.mis);
          const name = item.na853
            ? `${item.na853} - ${item.event_description || item.project_title || "No description"}`
            : item.event_description || item.project_title || "No description";

          return {
            id: projectId,
            mis: String(item.mis), // Store MIS separately
            name,
            expenditure_types: expenditureTypes || [],
          };
        });
      } catch (error) {
        console.error("[Projects] Projects fetch error:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: Boolean(selectedUnit),
  });

  // Use our custom budget updates hook that handles both API and WebSocket updates
  const {
    budgetData,
    validationResult,
    isBudgetLoading,
    isValidationLoading,
    budgetError,
    validationError,
    websocketConnected,
    broadcastUpdate,
  // ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Αν το selectedProjectId είναι κενό, χρησιμοποιούμε το project_id από το context!
  // Αυτό διορθώνει το πρόβλημα όπου το προϋπολογισμός δε φαίνεται στο βήμα 2 (παραλήπτες)
  } = useBudgetUpdates(selectedProjectId || formData.project_id, currentAmount);
  
  // Budget data validation and tracking (debug logging removed)
  useEffect(() => {
    // Effect will silently track budget data state without console logs
    // This helps with performance and keeps the console clean
  }, [budgetData, selectedProjectId, formData.project_id, currentAmount, currentStep]);

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ["attachments", form.watch("expenditure_type")],
    queryFn: async () => {
      try {
        const expenditureType = form.watch("expenditure_type");

        if (!expenditureType) {
          return [];
        }

        // Use direct fetch instead of apiRequest to prevent authentication issues
        const response = await fetch(
          `/api/attachments/${encodeURIComponent(expenditureType)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-Request-ID": `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            },
            credentials: "include",
          },
        );

        // Handle authentication errors (401)
        if (response.status === 401) {
          console.warn("Authentication required for attachments");
          // Show authentication error message instead of hardcoded defaults
          return [
            {
              id: "auth-error",
              title: "Απαιτείται σύνδεση",
              file_type: "none",
              description:
                "Παρακαλώ συνδεθείτε ξανά για να δείτε τα διαθέσιμα συνημμένα.",
            },
          ];
        }

        // Handle other errors
        if (!response.ok) {
          console.error("Attachments request failed:", response.status);
          // Show error message instead of hardcoded defaults
          return [
            {
              id: "server-error",
              title: "Σφάλμα εύρεσης συνημμένων",
              file_type: "none",
              description: `Σφάλμα διακομιστή: ${response.status}. Παρακαλώ δοκιμάστε ξανά αργότερα.`,
            },
          ];
        }

        // Process successful response
        const data = await response.json();
        if (!data) {
          // Return a message about empty data response instead of hardcoded defaults
          return [
            {
              id: "empty-response",
              title: "Δεν βρέθηκαν συνημμένα",
              file_type: "none",
              description: "Ο διακομιστής δεν επέστρεψε δεδομένα συνημμένων.",
            },
          ];
        }

        // Check if the response has a message about no attachments found
        if (
          data.status === "success" &&
          data.message &&
          Array.isArray(data.attachments) &&
          data.attachments.length === 0
        ) {
          // No attachments found with message

          // Return a special "no attachments" entry that will be displayed differently in the UI
          return [
            {
              id: "no-attachments",
              title: "Δεν βρέθηκαν συνημμένα",
              file_type: "none",
              description:
                data.message ||
                "Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.",
            },
          ];
        }

        // Check if the response has attachments in the standard API format
        if (
          data.status === "success" &&
          Array.isArray(data.attachments) &&
          data.attachments.length > 0
        ) {
          // Found attachments in standard format

          // Convert each attachment title to our display format
          return data.attachments.map((title: string) => ({
            id: title, // Use the title as the ID for selection
            title,
            file_type: "document",
            description: `Απαιτείται για ${expenditureType}`,
          }));
        }

        // Fallback for legacy format or unexpected response format
        // Unexpected format, trying fallback extraction

        // For safety, attempt to extract attachments from any response format
        let extractedAttachments: string[] = [];

        // Try to extract from data.attachments if it exists
        if (data.attachments && Array.isArray(data.attachments)) {
          extractedAttachments = data.attachments;
        }
        // Try to extract from root array
        else if (Array.isArray(data)) {
          extractedAttachments = data;
        }

        if (extractedAttachments.length > 0) {
          return extractedAttachments.map((title: string) => ({
            id: title,
            title,
            file_type: "document",
            description: `Απαιτείται για ${expenditureType}`,
          }));
        }

        // If we couldn't extract anything, return a "no attachments" message
        return [
          {
            id: "no-attachments-fallback",
            title: "Δεν βρέθηκαν συνημμένα",
            file_type: "none",
            description: "Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.",
          },
        ];
      } catch (error) {
        console.error("Error fetching attachments:", error);
        // Return a message about the error instead of hardcoded defaults
        return [
          {
            id: "fetch-error",
            title: "Σφάλμα εύρεσης συνημμένων",
            file_type: "none",
            description:
              "Παρουσιάστηκε σφάλμα κατά την αναζήτηση συνημμένων. Παρακαλώ επικοινωνήστε με τον διαχειριστή.",
          },
        ];
      }
    },
    enabled: Boolean(form.watch("expenditure_type")),
  });

  // Show toast notifications for validation status
  useEffect(() => {
    if (validationResult) {
      if (validationResult.status === "warning" && validationResult.message) {
        toast({
          title: "Προειδοποίηση προϋπολογισμού",
          description: validationResult.message,
          variant: "warning",
        });
      } else if (
        validationResult.status === "error" &&
        validationResult.message
      ) {
        toast({
          title: "Σφάλμα προϋπολογισμού",
          description: validationResult.message,
          variant: "destructive",
        });
      } else if (
        validationResult.status === "success" &&
        validationResult.message
      ) {
        toast({
          title: "Επιτυχής έλεγχος προϋπολογισμού",
          description: validationResult.message,
          variant: "default",
        });
      }
    }
  }, [validationResult, toast]);

  const isSubmitDisabled =
    validationResult?.status === "error" || !validationResult?.canCreate;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleSubmit = async (data: CreateDocumentForm) => {
    try {
      // Begin form submission process

      // Basic form validation
      if (!data.project_id) {
        throw new Error("Πρέπει να επιλέξετε έργο");
      }

      if (!data.recipients?.length) {
        throw new Error("Απαιτείται τουλάχιστον ένας δικαιούχος");
      }

      const invalidRecipients = data.recipients.some(
        (r) =>
          !r.firstname ||
          !r.lastname ||
          !r.afm ||
          typeof r.amount !== "number" ||
          !r.installments ||
          r.installments.length === 0,
      );

      if (invalidRecipients) {
        throw new Error("Όλα τα πεδία δικαιούχου πρέπει να συμπληρωθούν");
      }

      // Validate that all installments are in sequence
      const hasInvalidSequence = data.recipients.some((r) => {
        if (r.installments.length <= 1) return false;
        return !areInstallmentsInSequence(r.installments);
      });

      if (hasInvalidSequence) {
        throw new Error(
          "Οι δόσεις πρέπει να είναι διαδοχικές (π.χ. Α+Β ή Β+Γ, όn�ι Α+Γ)",
        );
      }

      // Validate that all installments have amounts entered
      const missingInstallmentAmounts = data.recipients.some((recipient) => {
        return recipient.installments.some((installment) => {
          return (
            !recipient.installmentAmounts ||
            typeof recipient.installmentAmounts[installment] !== "number" ||
            recipient.installmentAmounts[installment] <= 0
          );
        });
      });

      if (missingInstallmentAmounts) {
        throw new Error("Κάθε δόση πρέπει να έχει ποσό μεγαλύτερο από 0");
      }

      setLoading(true);

      // Find project to get MIS
      const projectForSubmission = projects.find(
        (p) => p.id === data.project_id,
      );
      if (!projectForSubmission?.mis) {
        throw new Error("Δεν βρέθηκε το MIS του έργου");
      }

      console.log("Found project for submission:", {
        id: projectForSubmission.id,
        mis: projectForSubmission.mis,
      });

      const totalAmount = data.recipients.reduce<number>((sum, r) => sum + r.amount, 0);

      // Validate budget with our own fetch to prevent auth redirects
      try {
        // Making manual budget validation request for submit
        const budgetValidationResponse = await fetch("/api/budget/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          },
          credentials: "include",
          body: JSON.stringify({
            mis: projectForSubmission.mis,
            amount: totalAmount.toString(),
            sessionId:
              sessionStorage.getItem("clientSessionId") ||
              `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          }),
        });

        // Handle authorization issues gracefully
        if (budgetValidationResponse.status === 401) {
          console.warn("Auth warning for budget validation during submit");
          toast({
            title: "Προειδοποίηση",
            description:
              "Απαιτείται επαναλογίνση για πλήρη έλεγχο προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive",
          });
        }
        // Handle other errors gracefully
        else if (!budgetValidationResponse.ok) {
          console.error(
            "Budget validation failed:",
            budgetValidationResponse.status,
          );
          toast({
            title: "Προειδοποίηση",
            description:
              "Αδυναμία ελέγχου προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive",
          });
        }
        // Process successful validation
        else {
          const budgetValidation = await budgetValidationResponse.json();

          if (!budgetValidation.canCreate) {
            throw new Error(
              budgetValidation.message ||
                "Δεν είναι δυνατή η δημιουργία εγγράφου λόγω περιορισμών προϋπολογισμού",
            );
          }
        }
      } catch (validationError) {
        console.error("Budget validation error:", validationError);
        toast({
          title: "Προειδοποίηση",
          description:
            "Σφάλμα κατά τον έλεγχο προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
          variant: "destructive",
        });
      }

      // Note: We've removed the manual budget update section because the document creation endpoint will handle budget updates
      // This prevents duplicate budget history entries

      // Prepare payload with project MIS
      const payload = {
        unit: data.unit,
        project_id: data.project_id,
        project_mis: projectForSubmission.mis,
        region: data.region,
        expenditure_type: data.expenditure_type,
        recipients: data.recipients.map((r) => ({
          firstname: r.firstname.trim(),
          lastname: r.lastname.trim(),
          fathername: r.fathername.trim(),
          afm: r.afm.trim(),
          amount: parseFloat(r.amount.toString()),
          secondary_text: r.secondary_text?.trim() || "",
          installments: r.installments,
          installmentAmounts: r.installmentAmounts || {},
        })),
        total_amount: totalAmount,
        status: "draft",
        attachments: data.selectedAttachments || [],
      };

      console.log("Sending payload to create document:", payload);

      // Attempt document creation with v2 API endpoint
      try {
        // Prepare enhanced payload with project MIS
        const enhancedPayload = {
          ...payload,
          project_mis: projectForSubmission.mis, // Ensure we always pass project_mis
        };

        // Use the v2-documents endpoint which handles document creation with proper error handling
        const response = (await apiRequest("/api/v2-documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(enhancedPayload),
        })) as { id?: number; message?: string };

        if (!response || typeof response !== "object" || !response.id) {
          throw new Error(
            "Σφάλμα δημιουργίας εγγράφου: Μη έγκυρη απάντηση από τον διακομιστή",
          );
        }

        console.log("Document created successfully with ID:", response.id);

        // Invalidate queries and show success message before returning
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["documents"] }),
          queryClient.invalidateQueries({ queryKey: ["budget"] }),
          queryClient.invalidateQueries({
            queryKey: ["budget", data.project_id],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              "budget-validation",
              projectForSubmission.mis,
              totalAmount,
            ],
          }),
        ]);

        toast({
          title: "Επιτυχία",
          description: "Το έγγραφο δημιουργήθηκε επιτυχώς",
        });

        // No longer reset form - data is preserved in context
        // Just close the dialog and the data will persist in our context
        
        // Force close the dialog
        onClose();
        onOpenChange(false);

        if (dialogCloseRef.current) {
          dialogCloseRef.current.click();
        }

        // Return response after dialog closing logic
        return response;
      } catch (error) {
        console.error("Document creation failed:", error);
        throw new Error(
          error instanceof Error
            ? error.message
            : "Αποτυχία δημιουργίας εγγράφου. Παρακαλώ προσπαθήστε ξανά αργότερα.",
        );
      }

      // Nothing needed here as the document creation logic
      // and dialog closing are all handled in the try-catch block above
    } catch (error) {
      console.error("Document creation error:", error);
      toast({
        title: "Σφάλμα",
        description:
          error instanceof Error
            ? error.message
            : "Αποτυχία δημιουργίας εγγράφου",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = () => {
    const currentRecipients = form.watch("recipients") || [];
    if (currentRecipients.length >= 10) {
      toast({
        title: "Μέγιστος Αριθμός Δικαιούχων",
        description:
          "Δεν μπορείτε να προσθέσετε περιp�σότερους από 10 δικαιούχους.",
        variant: "destructive",
      });
      return;
    }

    form.setValue("recipients", [
      ...currentRecipients,
      {
        firstname: "",
        lastname: "",
        fathername: "",
        afm: "",
        amount: 0,
        secondary_text: "",
        installment: "ΕΦΑΠΑΞ", // Διατηρούμε το παλιό πεδίο για συμβατότητα
        installments: ["ΕΦΑΠΑΞ"], // Default to ΕΦΑΠΑΞ for new recipients
        installmentAmounts: { ΕΦΑΠΑΞ: 0 }, // Initialize installment amount
      },
    ]);
  };

  const removeRecipient = (index: number) => {
    console.log("[RemoveRecipient] Removing recipient at index:", index);
    const currentRecipients = form.watch("recipients") || [];
    console.log("[RemoveRecipient] Current recipients before removal:", currentRecipients.length);
    form.setValue(
      "recipients",
      currentRecipients.filter((_, i) => i !== index),
    );
  };

  useEffect(() => {
    if (selectedUnit) {
      form.setValue("project_id", "");
      form.setValue("expenditure_type", "");
      form.setValue("region", "");
    }
  }, [selectedUnit, form]);

  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId);
      if (project) {
        form.setValue("expenditure_type", "");
      }
    }
  }, [selectedProjectId, projects, form]);

  useEffect(() => {
    // Only auto-select unit if the dialog is open and no unit is already selected
    if (!open) return;
    
    const currentUnit = form.getValues("unit");
    if (currentUnit) return; // Don't override existing selection
    
    // Auto-select unit based on available options (stabilized to prevent infinite loops)
    if (units?.length === 1) {
      console.log("[CreateDocument] Auto-selected the only available unit:", units[0].id);
      form.setValue("unit", units[0].id);
    } else if (user?.units?.length === 1 && units?.length > 0) {
      // If user has only one assigned unit, find its matching unit object and select it
      const userUnit = user?.units?.[0] || "";
      const matchingUnit = units.find((unit) => unit.id === userUnit);
      if (matchingUnit) {
        console.log("[CreateDocument] Auto-selected user's unit:", matchingUnit.id);
        form.setValue("unit", matchingUnit.id);
      }
    }
  }, [units?.length, user?.units?.[0], open]); // Stabilized dependencies

  const { data: regions = [], isLoading: regionsLoading } = useQuery({
    queryKey: ["regions", selectedProjectId],
    queryFn: async () => {
      // If no project selected, return empty array
      if (!selectedProjectId) {
        return [];
      }

      try {
        // Find the project to get its MIS
        const project = projects.find((p) => p.id === selectedProjectId);
        if (!project) {
          console.error("Project not found:", selectedProjectId);
          return [];
        }

        console.log("Fetching regions for project:", {
          id: selectedProjectId,
          mis: project.mis,
        });

        // Fetch regions data from API
        const response = await apiRequest(
          `/api/projects/${encodeURIComponent(project.mis || "")}/regions`,
        );
        console.log("Region API response:", response);

        // Handle invalid response
        if (!response || typeof response !== "object") {
          console.log("Invalid response format:", response);
          return [];
        }

        // Handle the nested structure of the response
        try {
          let processedRegions: Array<{
            id: string;
            name: string;
            type: string;
          }> = [];
          const typedResponse = response as Record<string, any>;

          // Handle object with nested arrays
          if (typedResponse.region && Array.isArray(typedResponse.region)) {
            console.log(
              "Processing region data with format:",
              typeof typedResponse.region[0],
            );

            // Handle case where typedResponse.region contains region objects
            if (
              typedResponse.region.length > 0 &&
              typeof typedResponse.region[0] === "object"
            ) {
              // Extract and flatten the regional_unit values if available
              for (const regionItem of typedResponse.region as Record<
                string,
                any
              >[]) {
                if (
                  regionItem.regional_unit &&
                  Array.isArray(regionItem.regional_unit)
                ) {
                  // Process regional_unit values first (preferred)
                  for (const unit of regionItem.regional_unit as string[]) {
                    if (typeof unit === "string" && unit.trim()) {
                      processedRegions.push({
                        id: unit,
                        name: unit,
                        type: "regional_unit",
                      });
                    }
                  }
                }

                // If no regional_unit found, fall back to region values
                if (
                  processedRegions.length === 0 &&
                  regionItem.region &&
                  Array.isArray(regionItem.region)
                ) {
                  for (const region of regionItem.region as string[]) {
                    if (typeof region === "string" && region.trim()) {
                      processedRegions.push({
                        id: region,
                        name: region,
                        type: "region",
                      });
                    }
                  }
                }
              }
            }
            // Handle case where typedResponse.region is a direct array of strings
            else if (
              typedResponse.region.length > 0 &&
              typeof typedResponse.region[0] === "string"
            ) {
              for (const region of typedResponse.region as string[]) {
                if (typeof region === "string" && region.trim()) {
                  processedRegions.push({
                    id: region,
                    name: region,
                    type: "region",
                  });
                }
              }
            }
          }

          // Also check for regional_unit at the top level
          if (
            processedRegions.length === 0 &&
            typedResponse.regional_unit &&
            Array.isArray(typedResponse.regional_unit)
          ) {
            for (const unit of typedResponse.regional_unit as string[]) {
              if (typeof unit === "string" && unit.trim()) {
                processedRegions.push({
                  id: unit,
                  name: unit,
                  type: "regional_unit",
                });
              }
            }
          }

          // If we found any regions in any format, return them
          if (processedRegions.length > 0) {
            console.log("Processed region data:", processedRegions);
            return processedRegions;
          }

          // No valid regions were found
          console.log("No regions found for project:", project.mis);
          return [];
        } catch (err) {
          console.error("Error processing region data:", err);
          return [];
        }

        // Shouldn't reach here due to earlier check, but just in case
        console.log("No valid region or regional_unit data found");
        return [];
      } catch (error) {
        // Handle any errors
        console.error("Error fetching regions:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης περιοχών",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: Boolean(selectedProjectId) && projects.length > 0,
  });

  const handleNext = async () => {
    try {
      // SIMPLIFIED: Basic validation only - allow more flexible navigation
      console.log("[CreateDocument] Moving to next step from:", currentStep);
      
      // Save current form state before proceeding
      const formValues = form.getValues();
      updateFormData({
        unit: formValues.unit,
        project_id: formValues.project_id,
        region: formValues.region,
        expenditure_type: formValues.expenditure_type,
        recipients: formValues.recipients,
        status: formValues.status,
        selectedAttachments: formValues.selectedAttachments
      });
      
      // Simple step validation
      switch (currentStep) {
        case 0:
          if (!formValues.unit) {
            toast({
              title: "Επιλέξτε Μονάδα",
              description: "Παρακαλώ επιλέξτε μονάδα για να συνεχίσετε",
              variant: "destructive",
            });
            return;
          }
          break;
        case 1:
          if (!formValues.project_id || !formValues.expenditure_type) {
            toast({
              title: "Συμπληρώστε Στοιχεία Έργου",
              description: "Παρακαλώ επιλέξτε έργο και τύπο δαπάνης",
              variant: "destructive",
            });
            return;
          }
          break;
        case 2:
          if (!formValues.recipients || formValues.recipients.length === 0) {
            toast({
              title: "Προσθέστε Δικαιούχους",
              description: "Παρακαλώ προσθέστε τουλάχιστον έναν δικαιούχο",
              variant: "destructive",
            });
            return;
          }
          break;
      }
      
      // Move to next step
      setDirection(1);
      setCurrentStep(Math.min(currentStep + 1, 3));
      
    } catch (error) {
      console.error("Navigation error:", error);
      toast({
        title: "Σφάλμα",
        description: "Προέκυψε σφάλμα κατά την μετάβαση στο επόμενο βήμα",
        variant: "destructive",
      });
    }
  };

  const handleNextOrSubmit = async () => {
    try {
      if (currentStep === 3) {
        const isValid = await form.trigger();
        if (isValid) {
          await form.handleSubmit(handleSubmit)();
        } else {
          toast({
            title: "Σφάλμα Επικύρωσης",
            description:
              "Παρακαλώ ελέγξτε ότι όλα τα πεδία είναι συμπληρωμένα σωστά",
            variant: "destructive",
          });
        }
      } else {
        await handleNext();
      }
    } catch (error) {
      console.error("Form navigation/submission error:", error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Προέκυψε σφάλμα",
        variant: "destructive",
      });
    }
  };

  const handlePrevious = () => {
    console.log("[CreateDocument] Moving to previous step from:", currentStep);
    
    // Save form state when going back
    const formValues = form.getValues();
    updateFormData({
      unit: formValues.unit,
      project_id: formValues.project_id,
      region: formValues.region,
      expenditure_type: formValues.expenditure_type,
      recipients: formValues.recipients,
      status: formValues.status,
      selectedAttachments: formValues.selectedAttachments
    });
    
    // Simple step transition
    setDirection(-1);
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  const renderStepContent = () => {
    return (
      <div className="space-y-6">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {currentStep === 0 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Επιλογή Μονάδας</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          try {
                            // First update the field directly for immediate UI update
                            field.onChange(value);
                            
                            // Log to help with debugging
                            console.log("[UnitSelect] Unit selected:", value);
                            
                            // Mark unit initialization as completed to prevent overriding user selection
                            if (!unitInitializationRef.current.isCompleted) {
                              unitInitializationRef.current.isCompleted = true;
                            }
                            
                            // Always save the form context after unit change
                            const formValues = form.getValues();
                            updateFormData({
                              ...formValues,
                              unit: value,
                              // Clear project when unit changes to avoid invalid combinations
                              project_id: ""
                            });
                            
                            // Force a refresh of projects data
                            setTimeout(() => {
                              // Invalidate projects to force a refresh with the new unit
                              queryClient.invalidateQueries({ queryKey: ["projects", value] });
                            }, 100);
                          } catch (error) {
                            console.error("[UnitSelect] Error during unit selection:", error);
                          }
                        }}
                        value={field.value}
                        disabled={unitsLoading || user?.units?.length === 1}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue 
                              placeholder="Επιλέξτε μονάδα" 
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(units) && units.length > 0 ? (
                            units.map((unit: any) => (
                              <SelectItem key={unit.id || unit.name} value={unit.id}>
                                {unit.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>
                              Δεν βρέθηκαν μονάδες
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {field.value && <p className="text-xs text-muted-foreground mt-1 font-medium">
                        Επιλεγμένη μονάδα: {Array.isArray(units) && units.length > 0 
                          ? (units.find((u: any) => u.id === field.value)?.name || 
                             (user?.units?.length === 1 ? user.units[0] : field.value))
                          : (user?.units?.length === 1 ? user.units[0] : field.value)}
                      </p>}
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Logs moved to useEffect for proper debugging */}
                {budgetData && (
                  <BudgetIndicator
                    budgetData={budgetData}
                    currentAmount={currentAmount}
                  />
                )}

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="project_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Έργο</FormLabel>
                        <ProjectSelect
                          value={field.value}
                          onChange={field.onChange}
                          projects={projects}
                          disabled={!selectedUnit || projectsLoading}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {regions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {regions[0]?.type === "regional_unit"
                          ? "Περιφερειακή Ενότητα"
                          : "Περιφέρεια"}
                      </label>
                      <Select
                        value={form.watch("region")}
                        onValueChange={(value) =>
                          form.setValue("region", value)
                        }
                        disabled={regions.length === 1 || regionsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              regions[0]?.type === "regional_unit"
                                ? "Επιλέξτε Περιφερειακή Ενότητα"
                                : "Επιλέξτε Περιφέρεια"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((region) => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {currentStep === 1 && selectedProject && (
                    <FormField
                      control={form.control}
                      name="expenditure_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Τύπος Δαπάνης</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedProjectId}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Επιλέξτε τύπο δαπάνης" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedProject?.expenditure_types?.length >
                              0 ? (
                                selectedProject.expenditure_types.map(
                                  (type: string) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ),
                                )
                              ) : (
                                <SelectItem
                                  key="no-expenditure-types"
                                  value=""
                                  disabled
                                >
                                  Δεν υπάρχουν διαθέσιμοι τύποι δαπάνης
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                {/* Always show budget indicator for recipient step, with conditional rendering inside component */}
                <BudgetIndicator
                  budgetData={budgetData}
                  currentAmount={currentAmount}
                />

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-medium">Δικαιούχοι</h3>
                      <p className="text-sm text-muted-foreground">
                        Προσθήκη έως 10 δικαιούχων
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={addRecipient}
                      disabled={recipients.length >= 10 || loading}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Προσθήκη Δικαιούχου
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[calc(70vh-150px)] overflow-y-auto pr-2">
                    {recipients.map((recipient, index) => (
                      <Card key={index} className="p-4 relative">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 w-full">
                          {/* Όνομα */}
                          <Input
                            {...form.register(`recipients.${index}.firstname`)}
                            placeholder="Όνομα"
                            className="md:col-span-2 md:row-span-1"
                            autoComplete="off"
                          />

                          {/* Επώνυμο */}
                          <Input
                            {...form.register(`recipients.${index}.lastname`)}
                            placeholder="Επώνυμο"
                            className="md:col-span-2 md:row-span-1"
                            autoComplete="off"
                          />

                          {/* Πατρώνυμο */}
                          <Input
                            {...form.register(`recipients.${index}.fathername`)}
                            placeholder="Πατρώνυμο"
                            className="md:col-span-2 md:row-span-1"
                            autoComplete="off"
                          />

                          {/* ΑΦΜ με έξυπνη αυτόματη συμπλήρωση */}
                          <div className="md:col-span-2 md:row-span-1">
                            <SimpleAFMAutocomplete
                              expenditureType={form.getValues("expenditure_type") || ""}
                              value={form.watch(`recipients.${index}.afm`) || ""}
                              onChange={(value) => {
                                // Update the AFM field in the form when user types
                                form.setValue(`recipients.${index}.afm`, value);
                              }}
                              onSelectPerson={(personData) => {
                                if (personData) {
                                  console.log("[AFMAutocomplete] Selection made for index:", index, "personData:", personData);
                                  
                                  // COMPLETELY BLOCK DIALOG RESETS DURING AUTOCOMPLETE
                                  isAutocompletingRef.current = true;
                                  dialogInitializationRef.current.isInitializing = false;
                                  isUpdatingFromContext.current = true;
                                  
                                  // Get installment and amount from beneficiary data
                                  const installmentValue = (personData as any).installment || "";
                                  const amountValue = parseFloat((personData as any).amount || "0") || 0;
                                  
                                  // Update the recipient data directly in the current form state
                                  const currentRecipients = form.getValues("recipients");
                                  currentRecipients[index] = {
                                    ...currentRecipients[index],
                                    firstname: personData.name || "",
                                    lastname: personData.surname || "",
                                    fathername: personData.fathername || "",
                                    afm: String(personData.afm || ""),
                                    secondary_text: (personData as any).freetext || (personData as any).attribute || "",
                                    amount: amountValue,
                                    installments: installmentValue ? [installmentValue] : ["ΕΦΑΠΑΞ"],
                                    installmentAmounts: installmentValue && amountValue ? { [installmentValue]: amountValue } : { "ΕΦΑΠΑΞ": amountValue }
                                  };
                                  
                                  // Use setValue and trigger validation to ensure form recognizes the changes
                                  form.setValue("recipients", currentRecipients, { shouldDirty: true, shouldValidate: true });
                                  
                                  // Trigger form validation after autocomplete to ensure save button works
                                  setTimeout(async () => {
                                    await form.trigger(`recipients.${index}`);
                                    await form.trigger("recipients");
                                    isUpdatingFromContext.current = false;
                                    isAutocompletingRef.current = false;
                                  }, 200);
                                  
                                  console.log("[AFMAutocomplete] Successfully updated all fields for recipient", index);
                                }
                              }}
                              placeholder="ΑΦΜ"
                              className="w-full"
                            />
                          </div>

                          {/* renderRecipientInstallments(index) */}
                          <div className="md:col-span-3 md:row-span-2 flex items-start">
                            <div className="flex-1">
                              {renderRecipientInstallments(index)}
                            </div>
                          </div>

                          {/* Delete Button - same row as the inputs */}
                          <div className="md:col-span-1 md:col-start-12 md:row-start-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRecipient(index)}
                              className="shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          {/* Ελεύθερο Κείμενο */}
                          <Input
                            {...form.register(
                              `recipients.${index}.secondary_text`,
                            )}
                            placeholder="Ελεύθερο Κείμενο"
                            className="md:col-span-8 md:row-start-2"
                            autoComplete="off"
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Συνημμένα Έγγραφα</h3>
                  {attachmentsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <FileText className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map(
                        (attachment: {
                          id: string;
                          file_type: string;
                          title: string;
                          description?: string;
                        }) =>
                          attachment.file_type === "none" ? (
                            // Display message for no attachments found
                            <div
                              key={attachment.id}
                              className="flex flex-col items-center justify-center py-8 text-muted-foreground"
                            >
                              <FileX className="h-12 w-12 mb-4" />
                              <p className="font-medium">{attachment.title}</p>
                              <p className="text-sm">
                                {attachment.description}
                              </p>
                            </div>
                          ) : (
                            // Display regular attachments with checkboxes
                            <div
                              key={attachment.id}
                              className="flex items-center space-x-2 rounded-lg border p-3"
                            >
                              <Checkbox
                                checked={form
                                  .watch("selectedAttachments")
                                  ?.includes(attachment.id)}
                                onCheckedChange={(checked) => {
                                  console.log("[Attachment] Toggle attachment:", attachment.id, checked ? "checked" : "unchecked");
                                  
                                  // Get current selection with a fresh copy
                                  const current = [...(form.watch("selectedAttachments") || [])];
                                  
                                  // Create a new array
                                  let newSelections;
                                  
                                  if (checked) {
                                    // Add the attachment ID if checked
                                    newSelections = [...current, attachment.id];
                                    console.log("[Attachment] Adding attachment:", attachment.id);
                                  } else {
                                    // Remove the attachment ID if unchecked
                                    newSelections = current.filter(id => id !== attachment.id);
                                    console.log("[Attachment] Removing attachment:", attachment.id);
                                  }
                                  
                                  console.log("[Attachment] New selections:", newSelections);
                                  
                                  // Set in the form
                                  form.setValue("selectedAttachments", newSelections);
                                  
                                  // Also update form context to ensure selections persist
                                  setTimeout(() => {
                                    console.log("[Attachment] Updating context with:", newSelections);
                                    updateFormData({
                                      selectedAttachments: newSelections
                                    });
                                  }, 100);
                                }}
                              />
                              <span>{attachment.title}</span>
                            </div>
                          ),
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4" />
                      <p>Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης</p>
                    </div>
                  )}
                </div>

                {/* Navigation buttons for final step */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={loading}
                  >
                    Προηγούμενο
                  </Button>
                  <Button
                    type="button"
                    onClick={() => form.handleSubmit(handleSubmit)()}
                    disabled={loading || !form.formState.isValid}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                        <span>Αποθήκευση...</span>
                      </>
                    ) : (
                      "Αποθήκευση"
                    )}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons for non-final steps */}
        {currentStep < 3 && (
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0 || loading}
            >
              Προηγούμενο
            </Button>
            <Button type="button" onClick={handleNext} disabled={loading}>
              Επόμενο
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Immediate unit selection when there's only one unit available
  const unitInitializedRef = useRef(false);
  
  useEffect(() => {
    // Only run this once to avoid infinite loops
    if (user?.units?.length === 1 && !unitInitializedRef.current) {
      unitInitializedRef.current = true;
      
      // Set the unit value immediately without delay
      const unitValue = user.units[0];
      form.setValue("unit", unitValue, { 
        shouldDirty: false,
        shouldValidate: false
      });
      
      // Also update form context data to ensure consistency
      updateFormData({
        ...formData,
        unit: unitValue
      });
      
      // Mark unit initialization as completed to prevent overrides
      if (unitInitializationRef.current) {
        unitInitializationRef.current.isCompleted = true;
        unitInitializationRef.current.defaultUnit = unitValue;
      }
      
      console.log("[CreateDocument] Auto-selected the only available unit:", unitValue);
    }
  }, [user?.units, form, formData, updateFormData]);

  useEffect(() => {
    if (regions.length === 1) {
      form.setValue("region", regions[0].id);
    }
  }, [regions, form]);

  // Call broadcastUpdate whenever the amount changes to update other users in real-time
  useEffect(() => {
    // Only broadcast if we have a valid project ID and amount > 0
    if (selectedProjectId && broadcastUpdate && currentAmount > 0) {
      // Debounce broadcast to prevent excessive updates during typing
      const broadcastTimeout = setTimeout(() => {
        broadcastUpdate(currentAmount);
        console.log("[Budget] Broadcasting amount update:", currentAmount);
      }, 300); // 300ms debounce

      return () => clearTimeout(broadcastTimeout);
    }
  }, [selectedProjectId, currentAmount, broadcastUpdate]);

  // Add budget debugging effect
  useEffect(() => {
    // This is a safe place to log budget data (won't cause React rendering issues)
    console.log("[Budget Debug] budgetData state:", {
      available: !!budgetData,
      currentStep,
      projectId: selectedProjectId,
      currentAmount,
    });

    if (budgetData) {
      console.log("[Budget Debug] Budget data details:", budgetData);
    }
  }, [budgetData, currentStep, selectedProjectId, currentAmount]);

  // Add an effect for enhanced dialog close handling
  useEffect(() => {
    // Handler to help force close the dialog when escape is pressed
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        // Close dialog when Escape key is pressed
        if (dialogCloseRef.current) {
          dialogCloseRef.current.click();
        }
        onOpenChange(false);
        onClose();
      }
    };

    // Get any close buttons after render to allow additional close mechanisms
    const setupCloseHandlers = () => {
      const closeButtons = document.querySelectorAll(
        '[data-dialog-close="true"], .dialog-close',
      );
      closeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          // Handle dialog close button click
          onOpenChange(false);
          onClose();
        });
      });
    };

    // Setup handlers after a short delay to ensure DOM is ready
    if (open) {
      setTimeout(setupCloseHandlers, 100);
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange, onClose]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl"
        aria-describedby="dialog-description"
      >
        <DialogHeader>
          <DialogTitle>Δημιουργία Εγγράφου</DialogTitle>
        </DialogHeader>
        <span id="dialog-description" className="sr-only">
          Φόρμα δημιουργίας νέου εγγράφου με βήματα για την επιλογή μονάδας,
          έργου, και δικαιούχων
        </span>
        <StepIndicator currentStep={currentStep} />
        <Form {...form}>
          <div className="space-y-6">{renderStepContent()}</div>
        </Form>
        {/* Hidden close button with ref for programmatic closing */}
        <DialogClose
          ref={dialogCloseRef}
          className="hidden"
          data-dialog-close="true"
        />
      </DialogContent>
    </Dialog>
  );
}
