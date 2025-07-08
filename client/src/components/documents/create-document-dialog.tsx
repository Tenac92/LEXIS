import * as React from "react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { NumberInput } from "@/components/ui/number-input";
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
  Lightbulb,
  Star
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

// Import constants from dedicated file
import { 
  DKA_TYPES, 
  DKA_INSTALLMENTS, 
  ALL_INSTALLMENTS, 
  HOUSING_ALLOWANCE_TYPE, 
  HOUSING_QUARTERS, 
  STANDARD_QUARTER_AMOUNT,
  STEPS,
  STEP_TITLES 
} from "./constants";
import { useDebounce } from "./hooks/useDebounce";
import { EsdianFieldsWithSuggestions } from "./components/EsdianFieldsWithSuggestions";
import { ProjectSelect } from "./components/ProjectSelect";
import { StepIndicator } from "./components/StepIndicator";

// Main project interface - simplified as components are now extracted
interface Project {
  id: string;
  mis?: string;
  name: string;
  expenditure_types: string[];
}

// Components are now extracted to separate files
// Main dialog component interface

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

// Main create document schema and validation starts below
// All extracted components are now in separate files for better organization

// Budget and expenditure configuration constants

// Data validation schemas

// Χρησιμοποιούμε τον ίδιο τύπο για συμβατότητα
interface BudgetData extends BaseBudgetData {}

// Use the interface from the imported BudgetIndicator component

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

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

// StepIndicator component extracted to separate file

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

const signatureSchema = z.object({
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  order: z.string().min(1, "Η εντολή είναι υποχρεωτική"),
  title: z.string().min(1, "Ο τίτλος είναι υποχρεωτικός"),
  degree: z.string().optional().default(""),
  prepose: z.string().optional().default(""),
});

const createDocumentSchema = z.object({
  unit: z.union([z.string(), z.number()]).transform(val => String(val)),
  project_id: z.string().min(1, "Το έργο είναι υποχρεωτικό"),
  region: z.string().optional(),
  expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
  recipients: z.array(recipientSchema).optional().default([]),
  total_amount: z.number().optional(),
  status: z.string().default("draft"),
  selectedAttachments: z.array(z.string()).optional().default([]),
  esdian_field1: z.string().optional().default(""),
  esdian_field2: z.string().optional().default(""),
  director_signature: signatureSchema.optional(),
});

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
        
        // Preserve form state during step transitions
        
        // Create a timeout to push these updates outside the current render cycle
        // This prevents the Maximum update depth exceeded error
        setTimeout(() => {
          // Save form values to context during step changes
          updateFormData({
            unit: formValues.unit,
            project_id: formValues.project_id,
            region: formValues.region,
            expenditure_type: formValues.expenditure_type,
            recipients: formValues.recipients,
            status: formValues.status || "draft",
            selectedAttachments: formValues.selectedAttachments,
            esdian_field1: formValues.esdian_field1 || "",
            esdian_field2: formValues.esdian_field2 || ""
          });
          
          if (formValues.project_id) {
            // Only broadcast budget updates if we have a project ID and when moving to recipient step
            if (step === 2 && budgetData && broadcastUpdate) {
              try {
                if (broadcastUpdate) {
                  broadcastUpdate(currentAmount || 0);
                }
              } catch (e) {

              }
            }
          }
        }, 0);
      } catch (err) {

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
    unit: formData.unit || 0,
    project_id: formData.project_id || "",
    region: formData.region || "",
    expenditure_type: formData.expenditure_type || "",
    recipients: formData.recipients || [],
    status: formData.status || "draft",
    selectedAttachments: formData.selectedAttachments || [],
    esdian_field1: formData.esdian_field1 || "",
    esdian_field2: formData.esdian_field2 || "",
    director_signature: formData.director_signature || undefined,
  }), []);
  
  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: formDefaultValues,
  });
  
  // Fetch available directors and department managers
  const { data: monada = [] } = useQuery({
    queryKey: ["monada-data"],
    queryFn: async () => {
      const response = await fetch("/api/public/monada", {
        method: "GET",
        headers: {
          "Accept": "application/json",
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch monada data: ${response.status}`);
      }
      return response.json();
    },
  });

  // Process available directors from monada data - filtered by selected unit
  const availableDirectors = useMemo(() => {
    const selectedUnit = form.watch("unit");
    if (!selectedUnit) return [];
    
    // Convert selectedUnit to number for comparison since monada data uses numeric unit IDs
    const selectedUnitNumber = typeof selectedUnit === 'string' ? parseInt(selectedUnit) : selectedUnit;
    
    return monada
      .filter((unit: any) => unit.unit === selectedUnitNumber && unit.director && unit.director.name)
      .map((unit: any) => ({
        unit: unit.unit,
        director: unit.director
      }));
  }, [monada, form.watch("unit")]);

  // Process available department managers from monada data - filtered by selected unit
  const availableDepartmentManagers = useMemo(() => {
    const selectedUnit = form.watch("unit");
    if (!selectedUnit) return [];
    
    // Convert selectedUnit to number for comparison since monada data uses numeric unit IDs
    const selectedUnitNumber = typeof selectedUnit === 'string' ? parseInt(selectedUnit) : selectedUnit;
    
    const managers: any[] = [];
    monada.forEach((unit: any) => {
      if (unit.unit === selectedUnitNumber && unit.parts && typeof unit.parts === 'object') {
        Object.entries(unit.parts).forEach(([key, value]: [string, any]) => {
          if (value && typeof value === 'object' && value.manager && value.manager.name) {
            managers.push({
              unit: unit.unit,
              department: value.tmima || key,
              manager: value.manager
            });
          }
        });
      }
    });
    return managers;
  }, [monada, form.watch("unit")]);

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
          throw new Error(`Failed to fetch units: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data)) {

          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive",
          });
          return [];
        }

        // Units fetched successfully - processing data
        
        // Enhanced data transformation
        
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
        if (user?.unit_id?.length === 1) {
          // Convert unit ID to unit name by finding matching unit
          const userUnitData = data.find((item: any) => item.id === user.unit_id[0]);
          userSingleUnit = userUnitData?.unit || "";
        }
        
        const processedUnits = data.map((item: any) => {
          // For debugging purposes
          if (!item.unit && !item.id) {

          }
          
          // First handle the ID
          let unitId = item.id || item.unit || '';
          
          // Ensure the unit ID matches the expected format if it's abbreviated
          const userHasAccessToUnit = user?.unit_id?.includes(item.id);
          if (userHasAccessToUnit || Object.keys(unitAbbreviations).includes(unitId)) {
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

      return;
    }
    
    // CRITICAL: Block reinitialization if dialog is already open and in use
    if (open && currentStep > 0) {

      return;
    }
    
    // Prevent duplicate initializations
    if (dialogInitializationRef.current.isInitializing) {
      return;
    }
    
    // Only reset for truly new documents (when there's no saved state in context)
    const hasExistingFormData = formData?.project_id || formData?.expenditure_type || 
                               (formData?.recipients && formData.recipients.length > 0);
    
    if (!hasExistingFormData) {

      
      // Don't reset the unit if user has one assigned - preserve auto-selection
      let defaultUnit = "";
      if (user?.unit_id && user.unit_id.length > 0) {
        // Convert user's unit ID to unit name for form
        const userUnitData = data.find((item: any) => item.id === user.unit_id[0]);
        defaultUnit = userUnitData?.unit || "";
      }
      
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

      }
    } else {

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

      }
      
      if (!refreshedUser) {

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
        selectedAttachments: Array.isArray(formData?.selectedAttachments) ? [...formData.selectedAttachments] : [],
        esdian_field1: formData?.esdian_field1 || "",
        esdian_field2: formData?.esdian_field2 || ""
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
  }, [open]); // Removed handleDialogOpen from dependencies to break infinite loop

  // CRITICAL FIX: Completely redesigned unit default-setting mechanism
  // Uses a separate reference to track unit initialization to prevent duplicate operations
  const unitInitializationRef = useRef({
    isCompleted: false,
    attemptCount: 0,
    defaultUnit: '',
  });
  
  // Enhanced unit auto-selection with proper persistence
  const unitAutoSelectionRef = useRef<{
    hasSelected: boolean;
    selectedUnit: string;
  }>({ hasSelected: false, selectedUnit: "" });
  
  useEffect(() => {
    // Ensure unit auto-selection happens at the right time and persists
    if (!user || !open) return;
    
    const currentUnit = form.getValues().unit;
    // Convert user's unit ID to unit name for auto-selection
    let userUnit = "";
    if (user?.unit_id && user.unit_id.length > 0) {
      const userUnitData = units.find((unit: any) => unit.id === user.unit_id[0]);
      userUnit = userUnitData?.unit || "";
    }
    
    // Auto-select if no unit is selected but user has a unit assigned
    if (!currentUnit && userUnit && !unitAutoSelectionRef.current.hasSelected) {
      // Auto-selected user's unit
      
      // Set in form with immediate effect
      form.setValue("unit", userUnit, { shouldValidate: false });
      
      // Track selection to prevent overrides
      unitAutoSelectionRef.current = {
        hasSelected: true,
        selectedUnit: userUnit
      };
      
      // Force the form to maintain this value
      setTimeout(() => {
        const currentValue = form.getValues().unit;
        if (!currentValue || currentValue !== userUnit) {
          form.setValue("unit", userUnit, { shouldValidate: false });
          // Re-enforced unit selection
        }
      }, 500);
    }
    
    // Re-enforce selection if it was cleared but should be maintained
    if (unitAutoSelectionRef.current.hasSelected && 
        unitAutoSelectionRef.current.selectedUnit && 
        !currentUnit) {
      form.setValue("unit", unitAutoSelectionRef.current.selectedUnit, { shouldValidate: false });
      // Restored cleared unit
    }
  }, [user, open, form]);
  
  // Reset selection tracking when dialog closes
  useEffect(() => {
    if (!open) {
      unitAutoSelectionRef.current = { hasSelected: false, selectedUnit: "" };
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
  const esdianField1 = form.watch("esdian_field1") || "";
  const esdianField2 = form.watch("esdian_field2") || "";

  // Use a reference to store the timeout ID for debouncing
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Flag to prevent circular updates
  const isUpdatingFromContext = useRef(false);
  
  // Flag to completely prevent dialog resets during autocomplete
  const isAutocompletingRef = useRef(false);
  
  // REMOVED: Memoized form state that was causing infinite loops
  // Form state is now accessed directly from form.getValues() when needed
  
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

  // COMPLETELY REWORKED: Simple sync function without dependencies to prevent infinite loops
  const syncFormToContext = useCallback(() => {
    // Skip updates when we're loading from context to prevent circular updates
    if (isUpdatingFromContext.current) {
      return;
    }
    
    // Get current form values directly from form instance
    const formValues = form.getValues();
    
    // Create state object
    const newState = {
      unit: formValues.unit || "",
      project_id: formValues.project_id || "",
      region: formValues.region || "",
      expenditure_type: formValues.expenditure_type || "",
      recipients: formValues.recipients || [],
      status: "draft",
      selectedAttachments: formValues.selectedAttachments || [],
      esdian_field1: formValues.esdian_field1 || "",
      esdian_field2: formValues.esdian_field2 || "",
    };
    
    // Update context with new state
    updateFormData(newState);
  }, [form, updateFormData]);
  
  // Effect to trigger form sync when state changes - COMPLETELY DISABLED TO PREVENT INFINITE LOOP
  // The form state will only sync when explicitly called by user actions (form submission, step changes)
  // This prevents the circular dependency that was causing infinite re-renders
  // Removed redundant useEffect that was disabled and causing infinite loops

  const currentAmount = recipients.reduce((sum: number, r) => {
    return sum + (typeof r.amount === "number" ? r.amount : 0);
  }, 0);

  // Removed redundant logging useEffect for recipients updates

  // Add this function to get available installments based on expenditure type
  const getAvailableInstallments = (expenditureType: string) => {
    if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
      return HOUSING_QUARTERS;
    }
    return DKA_TYPES.includes(expenditureType)
      ? DKA_INSTALLMENTS
      : ALL_INSTALLMENTS;
  };

  // Helper function to check if an installment is already processed
  const checkInstallmentConflict = (beneficiary: any, expenditureType: string, installment: string) => {
    if (!beneficiary?.oikonomika || !expenditureType || !installment) return false;
    
    const expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || typeof expenditureData !== 'object') return false;
    
    // Handle object format like: { "Α": { "status": "διαβιβάστηκε", ... } }
    if (expenditureData[installment]) {
      const record = expenditureData[installment];
      return record.status === 'διαβιβάστηκε' || record.status === 'διαβιβαστηκε';
    }
    
    return false;
  };

  // Helper function to check if installments are in sequence
  const areInstallmentsInSequence = (installments: string[], expenditureType: string) => {
    if (installments.length <= 1) return true;
    
    // For housing allowance, quarters must be consecutive
    if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
      const quarterNumbers = installments
        .map(q => parseInt(q.replace("ΤΡΙΜΗΝΟ ", "")))
        .sort((a, b) => a - b);
      
      // Check if quarters are consecutive
      for (let i = 1; i < quarterNumbers.length; i++) {
        if (quarterNumbers[i] - quarterNumbers[i - 1] !== 1) {
          return false;
        }
      }
      return true;
    }
    
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
      // Check if this installment conflicts with existing beneficiary data
      const expenditureType = form.watch("expenditure_type");
      if (currentRecipient && 'oikonomika' in currentRecipient && expenditureType) {
        const hasConflict = checkInstallmentConflict(currentRecipient, expenditureType, installment);
        if (hasConflict) {
          toast({
            title: "Προειδοποίηση",
            description: `Η δόση ${installment} για τον τύπο δαπάνης "${expenditureType}" έχει ήδη διαβιβαστεί για αυτόν τον δικαιούχο.`,
            variant: "destructive",
          });
          return; // Prevent selection of conflicting installment
        }
      }
      
      // Create a copy of current installments
      let newInstallments = [...selectedInstallments];
      
      // Handle housing allowance quarters
      if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
        // For housing allowance, enforce consecutive quarter selection
        if (newInstallments.includes(installment)) {
          // If clicking on already selected quarter, remove it
          newInstallments = newInstallments.filter(i => i !== installment);
        } else {
          // Try adding the quarter and check if it maintains consecutiveness
          const testInstallments = [...newInstallments, installment];
          if (areInstallmentsInSequence(testInstallments, expenditureType)) {
            newInstallments = testInstallments;
          } else {
            // If not consecutive, offer to start fresh from this quarter
            const quarterNumber = parseInt(installment.replace("ΤΡΙΜΗΝΟ ", ""));
            if (!isNaN(quarterNumber)) {
              // Clear existing selection and start with the new quarter
              newInstallments = [installment];
              toast({
                title: "Νέα επιλογή τριμήνου",
                description: `Η επιλογή άλλαξε σε ${installment}. Μπορείτε να προσθέσετε διαδοχικά τρίμηνα.`,
                variant: "default",
              });
            } else {
              toast({
                title: "Μη έγκυρη επιλογή τριμήνων",
                description: "Τα τρίμηνα πρέπει να είναι διαδοχικά (π.χ. ΤΡΙΜΗΝΟ 1, 2, 3)",
                variant: "destructive",
              });
              return;
            }
          }
        }
        
        // Ensure at least one quarter is selected
        if (newInstallments.length === 0) {
          newInstallments = ["ΤΡΙΜΗΝΟ 1"];
        }
      } else {
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
          if (!areInstallmentsInSequence(newInstallments, expenditureType) && newInstallments.length > 1) {
            toast({
              title: "Μη έγκυρες δόσεις",
              description: "Οι δόσεις πρέπει να είναι διαδοχικές (π.χ. Α+Β ή Β+Γ, όχι Α+Γ)",
              variant: "destructive",
            });
            return;
          }
        }
      }
      
      // Sort installments in proper order
      if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
        // Sort quarters numerically
        newInstallments.sort((a, b) => {
          const aNum = parseInt(a.replace("ΤΡΙΜΗΝΟ ", ""));
          const bNum = parseInt(b.replace("ΤΡΙΜΗΝΟ ", ""));
          return aNum - bNum;
        });
      } else {
        // Sort standard installments: ΕΦΑΠΑΞ first, then Α, Β, Γ
        newInstallments.sort((a, b) => {
          const order = { "Α": 1, "Β": 2, "Γ": 3, "ΕΦΑΠΑΞ": 0 };
          return (order[a as keyof typeof order] || 99) - (order[b as keyof typeof order] || 99);
        });
      }
      
      // Block context updates during this operation
      isUpdatingFromContext.current = true;
      
      try {
        // Create a new payment amounts object
        const newAmounts: Record<string, number> = {};
        
        // Copy over existing amounts for selected installments
        newInstallments.forEach(inst => {
          if (expenditureType === HOUSING_ALLOWANCE_TYPE && inst.startsWith("ΤΡΙΜΗΝΟ ")) {
            // Set standard amount for housing allowance quarters
            newAmounts[inst] = installmentAmounts[inst] || STANDARD_QUARTER_AMOUNT;
          } else {
            newAmounts[inst] = installmentAmounts[inst] || 0;
          }
        });
        
        // Calculate total amount for recipient
        const totalRecipientAmount = Object.values(newAmounts).reduce((sum, amount) => sum + (amount || 0), 0);
        
        // Set ΕΦΑΠΑΞ amount to total if it's the only option
        if (newInstallments.length === 1 && newInstallments[0] === "ΕΦΑΠΑΞ") {
          newAmounts["ΕΦΑΠΑΞ"] = currentRecipient?.amount || 0;
        }
        
        // Log for debugging
        // Updated installments and amounts
        
        // Update form values immediately
        form.setValue(`recipients.${index}.installments`, newInstallments);
        form.setValue(`recipients.${index}.installmentAmounts`, newAmounts);
        form.setValue(`recipients.${index}.amount`, totalRecipientAmount);
        
        // Wait a bit then update context to ensure changes are saved
        setTimeout(() => {
          // Only update if we're still on the same recipient
          if (form.getValues(`recipients.${index}`)) {
            const updatedRecipients = [...recipients];
            
            // Ensure we make a deep copy of the object to avoid reference issues
            if (updatedRecipients[index]) {
              updatedRecipients[index] = {
                ...updatedRecipients[index],
                amount: totalRecipientAmount,
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
        
        // For housing allowance, ensure the installment field is updated for compatibility
        const expenditureType = form.watch("expenditure_type");
        if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
          const currentInstallments = form.getValues(`recipients.${index}.installments`) || [];
          if (currentInstallments.length > 0) {
            form.setValue(`recipients.${index}.installment`, currentInstallments[0]);
          }
        }
        
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
            
            // Update form context with updated recipients
            updateFormData({ recipients: manuallyUpdatedRecipients });
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
        <div className="mb-2">
          <label className="text-sm font-medium mb-2 block">
            {expenditureType === HOUSING_ALLOWANCE_TYPE ? "Τρίμηνα:" : "Δόσεις:"}
          </label>
          
          {expenditureType === HOUSING_ALLOWANCE_TYPE ? (
            // Housing allowance quarter selection - compact design
            <div className="space-y-3">
              <div className="grid grid-cols-8 gap-1.5">
                {availableInstallments.map((quarter) => {
                  const quarterNum = quarter.replace("ΤΡΙΜΗΝΟ ", "");
                  return (
                    <Button
                      key={quarter}
                      type="button"
                      variant={
                        selectedInstallments.includes(quarter)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => handleInstallmentToggle(quarter)}
                      className="h-7 px-1 text-xs font-medium"
                    >
                      {quarterNum}
                    </Button>
                  );
                })}
              </div>
              
              {selectedInstallments.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-700 font-medium">
                      Επιλογή: {selectedInstallments.sort((a, b) => {
                        const aNum = parseInt(a.replace("ΤΡΙΜΗΝΟ ", ""));
                        const bNum = parseInt(b.replace("ΤΡΙΜΗΝΟ ", ""));
                        return aNum - bNum;
                      }).map(q => q.replace("ΤΡΙΜΗΝΟ ", "")).join("-")}
                    </span>
                    <span className="text-blue-600">
                      {selectedInstallments.length} τρίμηνα
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Standard installment selection
            <div className="flex flex-row gap-1 flex-wrap">
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
          )}
        </div>

        {selectedInstallments.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              {selectedInstallments.map((installment) => (
                <div key={installment} className="flex items-center gap-1.5">
                  <div className="font-medium text-xs bg-muted px-2 py-1 rounded min-w-[60px] text-center">
                    {expenditureType === HOUSING_ALLOWANCE_TYPE 
                      ? installment.replace("ΤΡΙΜΗΝΟ ", "Τ")
                      : installment
                    }
                  </div>
                  <div className="relative flex-1">
                    <NumberInput
                      value={installmentAmounts[installment] || ''}
                      onChange={(formatted, numeric) =>
                        handleInstallmentAmountChange(
                          installment,
                          numeric || 0,
                        )
                      }
                      className="pr-6 h-8 text-sm"
                      placeholder={expenditureType === HOUSING_ALLOWANCE_TYPE ? "900,00" : "Ποσό"}
                      decimals={2}
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
          // Process expenditure types - handle both legacy and optimized schema
          let expenditureTypes: string[] = [];
          
          // Try optimized schema first (expenditure_types array)
          if (item.expenditure_types && Array.isArray(item.expenditure_types)) {
            expenditureTypes = item.expenditure_types;
            console.log(`[Projects] Using optimized schema expenditure_types for ${item.mis}:`, expenditureTypes);
          }
          // Fallback to legacy format (expenditure_type string/array)
          else if (item.expenditure_type) {
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
  } = useBudgetUpdates(selectedProjectId || formData.project_id, 0); // Fixed: Use static value to prevent infinite loop
  
  console.log("[DocumentValidation] useBudgetUpdates inputs:", {
    projectId: selectedProjectId || formData.project_id,
    amount: 0,
    isBudgetLoading,
    isValidationLoading,
    budgetError,
    validationError
  });
  
  // Budget data validation and tracking - DISABLED to prevent infinite loops
  /*
  useEffect(() => {
    // This useEffect was causing infinite loops - disabled
  }, []);
  */

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

  // Fix validation logic: Allow submission if validation is null/undefined (no validation needed)
  // Only block if validation explicitly says error or canCreate is false
  const isSubmitDisabled = validationResult?.status === "error" || (validationResult?.canCreate === false);
    
  // Debug validation issues
  console.log("[DocumentValidation] Validation result:", validationResult);
  console.log("[DocumentValidation] Submit disabled:", isSubmitDisabled);
  console.log("[DocumentValidation] Recipients length:", recipients.length);
  console.log("[DocumentValidation] Loading state:", loading);
  console.log("[DocumentValidation] Budget data:", budgetData);
  console.log("[DocumentValidation] Selected project ID:", selectedProjectId);
  console.log("[DocumentValidation] Form project ID:", formData.project_id);

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
        return !areInstallmentsInSequence(r.installments, data.expenditure_type);
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
        recipients: data.recipients.map((r) => {
          // For housing allowance, ensure proper data structure for export
          if (data.expenditure_type === HOUSING_ALLOWANCE_TYPE && r.installmentAmounts) {
            // Calculate total from quarter amounts
            const quarterTotal = Object.values(r.installmentAmounts).reduce((sum, amount) => sum + (amount || 0), 0);
            
            // Convert quarter names to numbers for storage
            const quarterNumbers = r.installments.map(q => q.replace("ΤΡΙΜΗΝΟ ", ""));
            const quarterAmountsWithNumbers: Record<string, number> = {};
            
            // Map quarter amounts to numeric keys
            Object.entries(r.installmentAmounts).forEach(([key, value]) => {
              const quarterNum = key.replace("ΤΡΙΜΗΝΟ ", "");
              quarterAmountsWithNumbers[quarterNum] = value;
            });
            
            // For housing allowance, use numeric quarter format for storage
            return {
              firstname: r.firstname.trim(),
              lastname: r.lastname.trim(),
              fathername: r.fathername.trim(),
              afm: r.afm.trim(),
              amount: quarterTotal,
              secondary_text: r.secondary_text?.trim() || "",
              installment: quarterNumbers.length === 1 ? quarterNumbers[0] : `${quarterNumbers.length} τρίμηνα`,
              installments: quarterNumbers,
              installmentAmounts: quarterAmountsWithNumbers,
            };
          }
          
          // Standard structure for other expenditure types
          return {
            firstname: r.firstname.trim(),
            lastname: r.lastname.trim(),
            fathername: r.fathername.trim(),
            afm: r.afm.trim(),
            amount: parseFloat(r.amount.toString()),
            secondary_text: r.secondary_text?.trim() || "",
            installment: r.installment || (r.installments && r.installments[0]) || "ΕΦΑΠΑΞ",
            installments: r.installments,
            installmentAmounts: r.installmentAmounts || {},
          };
        }),
        total_amount: totalAmount,
        status: "draft",
        attachments: data.selectedAttachments || [],
        esdian: [data.esdian_field1 || "", data.esdian_field2 || ""].filter(field => field.trim() !== ""),
        director_signature: data.director_signature || null,
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

        // Reset entire form after successful document creation
        // Convert user's unit ID to unit name for form default
        let defaultUnit = "";
        if (user?.unit_id && user.unit_id.length > 0 && units.length > 0) {
          const userUnitData = units.find((unit: any) => unit.id === user.unit_id[0]);
          defaultUnit = userUnitData?.unit || "";
        }
        
        form.reset({
          unit: defaultUnit,
          project_id: "",
          region: "",
          expenditure_type: "",
          recipients: [],
          status: "draft",
          selectedAttachments: [],
          esdian_field1: "",
          esdian_field2: ""
        });
        
        // Reset context state completely for new document
        updateFormData({
          unit: defaultUnit,
          project_id: "",
          region: "",
          expenditure_type: "",
          recipients: [],
          status: "draft",
          selectedAttachments: [],
          esdian_field1: "",
          esdian_field2: ""
        });
        
        // Reset to first step
        setCurrentStep(0);
        
        // Form completely reset after successful document creation
        
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
          "Δεν μπορείτε να προσθέσετε περισσότερους από 10 δικαιούχους.",
        variant: "destructive",
      });
      return;
    }

    const expenditureType = form.watch("expenditure_type");
    
    // Set default installments and amounts based on expenditure type
    let defaultInstallments: string[];
    let defaultInstallmentAmounts: Record<string, number>;
    let defaultAmount: number = 0;

    if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
      // For housing allowance, default to first quarter with standard amount
      defaultInstallments = ["ΤΡΙΜΗΝΟ 1"];
      defaultInstallmentAmounts = { "ΤΡΙΜΗΝΟ 1": STANDARD_QUARTER_AMOUNT };
      defaultAmount = STANDARD_QUARTER_AMOUNT;
    } else {
      // For other expenditure types, use ΕΦΑΠΑΞ
      defaultInstallments = ["ΕΦΑΠΑΞ"];
      defaultInstallmentAmounts = { ΕΦΑΠΑΞ: 0 };
      defaultAmount = 0;
    }

    form.setValue("recipients", [
      ...currentRecipients,
      {
        firstname: "",
        lastname: "",
        fathername: "",
        afm: "",
        amount: defaultAmount,
        secondary_text: "",
        installment: defaultInstallments[0], // Διατηρούμε το παλιό πεδίο για συμβατότητα
        installments: defaultInstallments,
        installmentAmounts: defaultInstallmentAmounts,
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
      // Auto-selected the only available unit
      form.setValue("unit", units[0].id);
    } else if (user?.unit_id?.length === 1 && units?.length > 0) {
      // If user has only one assigned unit, find its matching unit object and select it
      const userUnitId = user?.unit_id?.[0] || "";
      const matchingUnit = units.find((unit) => unit.id === userUnitId);
      if (matchingUnit) {
        // Auto-selected user's unit
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

        // Handle the actual API response format
        try {
          let processedRegions: Array<{
            id: string;
            name: string;
            type: string;
          }> = [];
          const typedResponse = response as Record<string, any>;

          // Handle the standard regions API response format: {"regions": [...]}
          if (typedResponse.regions && Array.isArray(typedResponse.regions)) {
            // Processing regions from API response
            
            for (const regionItem of typedResponse.regions) {
              if (regionItem && typeof regionItem === "object") {
                // Extract region information based on available fields
                const regionName = regionItem.name || regionItem.regional_unit || regionItem.region;
                const regionId = regionItem.id || regionName;
                
                if (regionName) {
                  // Determine type based on the level field or available data
                  let regionType = "region";
                  if (regionItem.level === "municipality" || regionItem.regional_unit) {
                    regionType = "regional_unit";
                  }
                  
                  processedRegions.push({
                    id: String(regionId),
                    name: String(regionName),
                    type: regionType,
                  });
                }
              }
            }
          }

          // If we found any regions, return them
          if (processedRegions.length > 0) {
            // Successfully processed region data
            return processedRegions;
          }

          // No valid regions were found
          // No regions found for project
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
      // Moving to next step
      
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
      setCurrentStep(Math.min(currentStep + 1, 4));
      
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
      if (currentStep === 4) {
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
    // Moving to previous step
    
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
                            <SelectItem value="no-units" disabled>
                              Δεν βρέθηκαν μονάδες
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {field.value && <p className="text-xs text-muted-foreground mt-1 font-medium">
                        Επιλεγμένη μονάδα: {Array.isArray(units) && units.length > 0 
                          ? (units.find((u: any) => u.id === field.value)?.name || 
                             (user?.unit_id?.length === 1 ? 
                               (units.find(u => u.id === user.unit_id[0])?.unit || field.value) : field.value))
                          : (user?.unit_id?.length === 1 ? 
                               (units.find(u => u.id === user.unit_id[0])?.unit || field.value) : field.value)}
                      </p>}
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Budget debug logging */}
                {console.log('[CreateDocument] Budget debug:', { 
                  budgetData: budgetData, 
                  selectedProjectId: selectedProjectId, 
                  formDataProjectId: formData.project_id,
                  isBudgetLoading: isBudgetLoading,
                  budgetError: budgetError
                })}
                
                {/* Always show budget indicator - handle null data inside component */}
                <BudgetIndicator
                  budgetData={budgetData}
                  currentAmount={currentAmount}
                />

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="project_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Έργο</FormLabel>
                        <ProjectSelect
                          selectedUnit={selectedUnit || ""}
                          onProjectSelect={(project) => {
                            // Project selection handler called
                            
                            if (project) {
                              // Update the form field
                              field.onChange(project.id);
                              
                              // Update the form context to ensure state persistence
                              updateFormData({
                                ...formData,
                                project_id: project.id
                              });
                              
                              // Project selected successfully
                            } else {
                              // Clear selection
                              field.onChange("");
                              updateFormData({
                                ...formData,
                                project_id: ""
                              });
                              
                              // Project selection cleared
                            }
                          }}
                          value={field.value}
                          placeholder="Επιλέξτε έργο..."
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
                          {regions
                            .filter((region) => region.id && String(region.id).trim() !== '')
                            .map((region) => (
                            <SelectItem key={region.id} value={String(region.id)}>
                              {region.name}
                            </SelectItem>
                          ))}
                          {regions.length === 0 && (
                            <SelectItem value="no-regions" disabled>
                              Δεν υπάρχουν διαθέσιμες περιοχές
                            </SelectItem>
                          )}
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
                                  value="no-expenditure-types"
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

                  <div className="space-y-3">
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
                              userUnit={selectedUnit || ""}
                              projectNa853={selectedProject?.mis || ""}
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
                                  
                                  // Use smart autocomplete data if available from enhanced AFM component
                                  const enhancedData = personData as any;
                                  let installmentsList: string[] = ["ΕΦΑΠΑΞ"];
                                  let installmentAmounts: Record<string, number> = { "ΕΦΑΠΑΞ": 0 };
                                  let totalAmount = 0;
                                  
                                  console.log("[AFMAutocomplete] Enhanced person data:", enhancedData);
                                  
                                  // Check if we have smart autocomplete suggestions
                                  if (enhancedData.suggestedInstallments && enhancedData.suggestedInstallmentAmounts) {
                                    installmentsList = enhancedData.suggestedInstallments;
                                    installmentAmounts = enhancedData.suggestedInstallmentAmounts;
                                    totalAmount = enhancedData.suggestedAmount || 0;
                                    
                                    console.log("[SmartAutocomplete] Using suggested data:", {
                                      installments: installmentsList,
                                      amounts: installmentAmounts,
                                      total: totalAmount
                                    });
                                  }
                                  // Fallback to legacy structure if no smart suggestions
                                  else if (enhancedData.oikonomika && typeof enhancedData.oikonomika === 'object') {
                                    console.log("[AFMAutocomplete] Fallback to legacy extraction from JSONB oikonomika");
                                    
                                    // Get the current expenditure type to match against oikonomika keys
                                    const currentExpenditureType = form.getValues("expenditure_type");
                                    
                                    // Find matching expenditure type in oikonomika
                                    for (const [expType, paymentsList] of Object.entries(enhancedData.oikonomika)) {
                                      if (Array.isArray(paymentsList) && paymentsList.length > 0) {
                                        const firstPayment = paymentsList[0];
                                        
                                        if (firstPayment && typeof firstPayment === 'object') {
                                          // Extract amount (handle Greek number formatting)
                                          let amountStr = String(firstPayment.amount || "0");
                                          
                                          // Handle Greek formatting (periods as thousands separators)
                                          if (amountStr.includes('.') && amountStr.split('.').length === 3) {
                                            const parts = amountStr.split('.');
                                            amountStr = parts[0] + parts[1] + '.' + parts[2];
                                          } else if (amountStr.includes(',')) {
                                            amountStr = amountStr.replace(',', '.');
                                          }
                                          
                                          const amount = parseFloat(amountStr) || 0;
                                          const installments = firstPayment.installment || ["ΕΦΑΠΑΞ"];
                                          
                                          if (Array.isArray(installments) && installments.length > 0) {
                                            installmentsList = installments;
                                            totalAmount = amount;
                                            
                                            // Create installment amounts object
                                            installmentAmounts = {};
                                            if (installments.length === 1) {
                                              installmentAmounts[installments[0]] = amount;
                                            } else {
                                              const amountPerInstallment = amount / installments.length;
                                              installments.forEach(inst => {
                                                installmentAmounts[inst] = amountPerInstallment;
                                              });
                                            }
                                            
                                            console.log("[AFMAutocomplete] Legacy extraction:", installmentsList, "amounts:", installmentAmounts);
                                            break;
                                          }
                                        }
                                      }
                                    }
                                  } 
                                  // Fallback to old structure for employees
                                  else {
                                    const installmentValue = enhancedData.installment || "";
                                    const amountValue = parseFloat(enhancedData.amount || "0") || 0;
                                    
                                    if (installmentValue && amountValue) {
                                      installmentsList = [installmentValue];
                                      installmentAmounts = { [installmentValue]: amountValue };
                                      totalAmount = amountValue;
                                    }
                                  }
                                  
                                  // Update the recipient data directly in the current form state
                                  const currentRecipients = form.getValues("recipients");
                                  currentRecipients[index] = {
                                    ...currentRecipients[index],
                                    firstname: personData.name || "",
                                    lastname: personData.surname || "",
                                    fathername: personData.fathername || "",
                                    afm: String(personData.afm || ""),
                                    secondary_text: (personData as any).freetext || (personData as any).attribute || "",
                                    amount: totalAmount,
                                    installments: installmentsList,
                                    installmentAmounts: installmentAmounts
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
                                  
                                  console.log("[AFMAutocomplete] Successfully updated all fields for recipient", index, "with data:", {
                                    amount: totalAmount,
                                    installments: installmentsList,
                                    installmentAmounts: installmentAmounts
                                  });
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
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Επιλογή Υπογραφής</h3>
                  
                  {/* Single Signature Selection */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="director_signature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Επιλογή Υπογραφούντος</FormLabel>
                          <Select
                            value={field.value ? JSON.stringify(field.value) : undefined}
                            onValueChange={(value) => {
                              if (value && value !== "no-signature") {
                                field.onChange(JSON.parse(value));
                              } else {
                                field.onChange(null);
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Επιλέξτε υπογραφούντα" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Directors */}
                              {availableDirectors.map((director: any) => (
                                <SelectItem 
                                  key={`director-${director.unit}`} 
                                  value={JSON.stringify({...director.director, type: 'director', unit: director.unit})}
                                >
                                  {director.director.name} - Διευθυντής ({director.unit})
                                </SelectItem>
                              ))}
                              
                              {/* Department Managers */}
                              {availableDepartmentManagers.map((manager, index) => (
                                <SelectItem 
                                  key={`manager-${manager.unit}-${index}`} 
                                  value={JSON.stringify({...manager.manager, type: 'manager', unit: manager.unit, department: manager.department})}
                                >
                                  {manager.manager.name} - Προϊστάμενος ({manager.department})
                                </SelectItem>
                              ))}
                              
                              {/* Fallback for empty signature lists */}
                              {availableDirectors.length === 0 && availableDepartmentManagers.length === 0 && (
                                <SelectItem value="no-signature" disabled>
                                  Δεν υπάρχουν διαθέσιμοι υπογραφούντες
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Συνημμένα Έγγραφα</h3>
                    {/* Select All functionality - only show when there are valid attachments */}
                    {!attachmentsLoading && attachments.length > 0 && 
                     attachments.some(att => att.file_type !== "none") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Get all valid attachment IDs (excluding error/no-data entries)
                          const validAttachmentIds = attachments
                            .filter(att => att.file_type !== "none")
                            .map(att => att.id);
                          
                          const currentSelections = form.watch("selectedAttachments") || [];
                          
                          // Check if all valid attachments are already selected
                          const allSelected = validAttachmentIds.every(id => 
                            currentSelections.includes(id)
                          );
                          
                          let newSelections;
                          if (allSelected) {
                            // Deselect all - remove all valid attachment IDs from current selection
                            newSelections = currentSelections.filter(id => 
                              !validAttachmentIds.includes(id)
                            );
                            console.log("[SelectAll] Deselecting all attachments");
                          } else {
                            // Select all - merge current selections with all valid attachment IDs
                            newSelections = [...new Set([...currentSelections, ...validAttachmentIds])];
                            console.log("[SelectAll] Selecting all attachments");
                          }
                          
                          console.log("[SelectAll] New selections:", newSelections);
                          
                          // Update form
                          form.setValue("selectedAttachments", newSelections);
                          
                          // Update context
                          setTimeout(() => {
                            updateFormData({
                              selectedAttachments: newSelections
                            });
                          }, 100);
                        }}
                      >
                        {(() => {
                          const validAttachmentIds = attachments
                            .filter(att => att.file_type !== "none")
                            .map(att => att.id);
                          const currentSelections = form.watch("selectedAttachments") || [];
                          const allSelected = validAttachmentIds.every(id => 
                            currentSelections.includes(id)
                          );
                          return allSelected ? "Αποεπιλογή Όλων" : "Επιλογή Όλων";
                        })()}
                      </Button>
                    )}
                  </div>
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

                {/* ESDIAN Fields for Internal Distribution with Suggestions */}
                <EsdianFieldsWithSuggestions 
                  form={form} 
                  user={user}
                />

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
                    onClick={() => {
                      console.log("[DocumentSubmit] Submit button clicked");
                      console.log("[DocumentSubmit] Recipients count:", recipients.length);
                      console.log("[DocumentSubmit] Loading state:", loading);
                      console.log("[DocumentSubmit] Recipients data:", recipients);
                      form.handleSubmit(handleSubmit)();
                    }}
                    disabled={loading || recipients.length === 0}
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
        {currentStep < 4 && (
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
    if (user?.unit_id?.length === 1 && !unitInitializedRef.current) {
      unitInitializedRef.current = true;
      
      // Set the unit value immediately without delay
      // Convert user's unit ID to unit name for display
      const userUnitData = units.find(u => u.id === user.unit_id[0]);
      const unitValue = userUnitData?.unit || "";
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
      
      // Auto-selected the only available unit
    }
  }, [user?.units]); // Removed form, formData, updateFormData from dependencies

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

  // Budget data availability tracking (removed excessive logging for performance)

  // Add an effect for enhanced dialog close handling with form state preservation
  useEffect(() => {
    // Function to preserve form state before closing
    const preserveFormStateAndClose = () => {
      try {
        // Get current form values
        const formValues = form.getValues();
        
        // Save all form state to context before closing
        updateFormData({
          unit: formValues.unit,
          project_id: formValues.project_id,
          region: formValues.region,
          expenditure_type: formValues.expenditure_type,
          recipients: formValues.recipients,
          status: formValues.status || "draft",
          selectedAttachments: formValues.selectedAttachments,
          esdian_field1: formValues.esdian_field1 || "",
          esdian_field2: formValues.esdian_field2 || ""
        });
        
        // Form state preserved on dialog close
      } catch (error) {
        console.error("[CreateDocument] Error preserving form state on close:", error);
      }
    };

    // Handler to help force close the dialog when escape is pressed
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        // Preserve form state before closing
        preserveFormStateAndClose();
        
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
          // Preserve form state before closing
          preserveFormStateAndClose();
          
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
  }, [open, onOpenChange, onClose, form, updateFormData, currentStep]);

  // Create a custom handler for dialog close that preserves form state
  const handleDialogOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && open) {
      // Dialog is being closed, preserve form state first
      try {
        const formValues = form.getValues();
        
        // Save all form state to context before closing
        updateFormData({
          unit: formValues.unit,
          project_id: formValues.project_id,
          region: formValues.region,
          expenditure_type: formValues.expenditure_type,
          recipients: formValues.recipients,
          status: formValues.status || "draft",
          selectedAttachments: formValues.selectedAttachments,
          esdian_field1: formValues.esdian_field1 || "",
          esdian_field2: formValues.esdian_field2 || ""
        });
        
        // Form state preserved on dialog close (click outside)
      } catch (error) {
        console.error("[CreateDocument] Error preserving form state on dialog close:", error);
      }
    }
    
    // Call the original handler
    onOpenChange(newOpen);
  }, [open, onOpenChange, form, updateFormData, currentStep]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Δημιουργία Εγγράφου</DialogTitle>
          <DialogDescription>
            Φόρμα δημιουργίας νέου εγγράφου με βήματα για την επιλογή μονάδας,
            έργου, και δικαιούχων
          </DialogDescription>
        </DialogHeader>
        <StepIndicator currentStep={currentStep} />
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <div className="space-y-6">{renderStepContent()}</div>
          </Form>
        </div>
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
