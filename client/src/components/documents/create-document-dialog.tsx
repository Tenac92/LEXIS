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
import { parseEuropeanNumber } from "@/lib/number-format";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  FileX,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  User,
  Lightbulb,
  Star,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnimatePresence, motion } from "framer-motion";

// Development logging helper
const isDev = import.meta.env.DEV;
const devLog = (label: string, ...args: any[]) => {
  if (isDev) console.log(`[CreateDocument:${label}]`, ...args);
};
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SimpleAFMAutocomplete } from "@/components/ui/simple-afm-autocomplete";
import { MonthRangePicker } from "@/components/common/MonthRangePicker";
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
  EKTOS_EDRAS_TYPE,
  GREEK_MONTHS,
  AVAILABLE_YEARS,
  DEFAULT_PRICE_PER_KM,
  STEPS,
  STEP_TITLES,
} from "./constants";
import { useDebounce } from "./hooks/useDebounce";
import { EsdianFieldsWithSuggestions } from "./components/EsdianFieldsWithSuggestions";
import { ProjectSelect } from "./components/ProjectSelect";
import { SubprojectSelect } from "./components/SubprojectSelect";
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

interface InitialBeneficiaryData {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
}

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  initialBeneficiary?: InitialBeneficiaryData;
}

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

// Main create document schema and validation starts below
// All extracted components are now in separate files for better organization

// Budget and expenditure configuration constants

// Data validation schemas

// Define interface for budget data to resolve type error
interface BudgetData {
  totalBudget?: number;
  usedBudget?: number;
  remainingBudget?: number;
  status?: string;
}

// Use the interface from the imported BudgetIndicator component

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
  // ΕΚΤΟΣ ΕΔΡΑΣ-specific fields (all optional, only used for ΕΚΤΟΣ ΕΔΡΑΣ)
  employee_id: z.number().optional(),
  month: z.string().optional(),
  days: z.number().optional().default(1),
  daily_compensation: z.number().optional().default(0),
  accommodation_expenses: z.number().optional().default(0),
  kilometers_traveled: z.number().optional().default(0),
  price_per_km: z.number().optional().default(DEFAULT_PRICE_PER_KM),
  tickets_tolls_rental: z.number().optional().default(0),
  tickets_tolls_rental_entries: z.array(z.number()).optional().default([]), // Array of individual amounts
  has_2_percent_deduction: z.boolean().optional().default(false),
  total_expense: z.number().optional(),
  deduction_2_percent: z.number().optional(),
  net_payable: z.number().optional(),
});

const signatureSchema = z.object({
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  order: z.string().min(1, "Η εντολή είναι υποχρεωτική"),
  title: z.string().min(1, "Ο τίτλος είναι υποχρεωτικός"),
  degree: z.string().optional().default(""),
  prepose: z.string().optional().default(""),
});

const createDocumentSchema = z
  .object({
    unit: z.union([z.string(), z.number()]).transform((val) => String(val)),
    project_id: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .refine(
        (val) => val && val.trim().length > 0,
        "Το έργο είναι υποχρεωτικό",
      ),
    subproject_id: z.string().optional(),
    region: z.string().optional(),
    for_yl_id: z.coerce.number().optional().nullable(),
    expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
    recipients: z.array(recipientSchema).optional().default([]),
    total_amount: z.number().optional(),
    status: z.string().default("draft"),
    selectedAttachments: z.array(z.string()).optional().default([]),
    esdian_fields: z.array(z.string()).optional().default([""]),
    // Keep old fields for backward compatibility during transition
    esdian_field1: z.string().optional().default(""),
    esdian_field2: z.string().optional().default(""),
    director_signature: signatureSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Validate ΕΚΤΟΣ ΕΔΡΑΣ recipients have required fields
    if (data.expenditure_type === EKTOS_EDRAS_TYPE && data.recipients) {
      data.recipients.forEach((recipient, index) => {
        if (!recipient.month) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ο μήνας είναι υποχρεωτικός για ΕΚΤΟΣ ΕΔΡΑΣ",
            path: ["recipients", index, "month"],
          });
        }
        if (!recipient.net_payable || recipient.net_payable <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Το καθαρό πληρωτέο ποσό πρέπει να είναι μεγαλύτερο από 0",
            path: ["recipients", index, "net_payable"],
          });
        }
      });
    }
  });

// Main component
export function CreateDocumentDialog({
  open,
  onOpenChange,
  onClose,
  initialBeneficiary,
}: CreateDocumentDialogProps) {
  // Get form state from context
  const {
    formData,
    updateFormData,
    currentStep: savedStep,
    setCurrentStep: setSavedStep,
  } = useDocumentForm();

  // Basic state
  const [currentStep, setLocalCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formReset, setFormReset] = useState(false);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  
  // LOCAL BUDGET VALIDATION STATE - independent of hook to prevent infinite loops
  // This stores the real-time validation result when amounts change
  const [localBudgetValidation, setLocalBudgetValidation] = useState<{
    status: 'success' | 'warning' | 'error';
    canCreate: boolean;
    allowDocx: boolean;
    message: string;
    budgetType?: 'pistosi' | 'katanomi' | null; // Which budget limit is being exceeded
  } | null>(null);
  const [validationTimeout, setValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Track which recipient indices have their housing allowance quarter details expanded
  const [expandedQuarterDetails, setExpandedQuarterDetails] = useState<Set<number>>(new Set());

  // Memoize user unit IDs to avoid duplicate key warnings and improve performance
  const userUnitIds = useMemo(
    () => (user?.unit_id ?? []).map(String),
    [user?.unit_id],
  );

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
            subproject_id: formValues.subproject_id,
            region: formValues.region,
            for_yl_id: formValues.for_yl_id || null,
            expenditure_type: formValues.expenditure_type,
            recipients: formValues.recipients,
            status: formValues.status || "draft",
            selectedAttachments: formValues.selectedAttachments,
            esdian_fields: formValues.esdian_fields || [""],
            // Keep old fields for backward compatibility during transition
            esdian_field1: formValues.esdian_field1 || "",
            esdian_field2: formValues.esdian_field2 || "",
          });

          if (formValues.project_id) {
            // Only broadcast budget updates if we have a project ID and when moving to recipient step
            if (step === 2 && budgetData && broadcastUpdate) {
              try {
                if (broadcastUpdate) {
                  broadcastUpdate(currentAmount || 0);
                }
              } catch (e) {
                // Silent catch for broadcast errors
              }
            }
          }
        }, 0);
      } catch (err) {}
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
  const formDefaultValues = useMemo(
    () => ({
      unit: formData.unit || "", // Fix: unit should be string, not number
      project_id: formData.project_id ? String(formData.project_id) : "", // Ensure string conversion
      subproject_id: formData.subproject_id || "",
      region: formData.region || "",
      for_yl_id: formData.for_yl_id || null,
      expenditure_type: formData.expenditure_type || "",
      recipients: formData.recipients || [],
      status: formData.status || "draft",
      selectedAttachments: formData.selectedAttachments || [],
      esdian_fields:
        formData.esdian_fields ||
        (formData.esdian_field1 || formData.esdian_field2
          ? [formData.esdian_field1 || "", formData.esdian_field2 || ""].filter(
              Boolean,
            )
          : [""]),
      // Keep old fields for backward compatibility during transition
      esdian_field1: formData.esdian_field1 || "",
      esdian_field2: formData.esdian_field2 || "",
      director_signature: formData.director_signature || undefined,
    }),
    [formData],
  ); // Fix: add dependencies to useMemo

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
          Accept: "application/json",
        },
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

    // Check if selectedUnit is a numeric ID
    const parsedUnitId = parseInt(String(selectedUnit));
    const isNumericUnit =
      !isNaN(parsedUnitId) &&
      String(parsedUnitId) === String(selectedUnit).trim();

    // Match by unit ID if numeric, or by unit code if text
    return monada
      .filter((unit: any) => {
        const matchCondition = isNumericUnit
          ? unit.id === parsedUnitId
          : unit.unit === selectedUnit;
        return matchCondition && unit.director && unit.director.name;
      })
      .map((unit: any) => ({
        unit: unit.unit, // Use the unit code, not the numeric ID
        director: unit.director,
      }));
  }, [monada, form.watch("unit")]);

  // Process available department managers from monada data - filtered by selected unit
  const availableDepartmentManagers = useMemo(() => {
    const selectedUnit = form.watch("unit");
    if (!selectedUnit) return [];

    const managers: any[] = [];

    // Add safety check for monada data
    if (!monada || !Array.isArray(monada)) {
      return [];
    }

    // Check if selectedUnit is a numeric ID
    const parsedUnitId = parseInt(String(selectedUnit));
    const isNumericUnit =
      !isNaN(parsedUnitId) &&
      String(parsedUnitId) === String(selectedUnit).trim();

    monada.forEach((unit: any) => {
      // Match by unit ID if numeric, or by unit code if text
      const matchCondition = isNumericUnit
        ? unit.id === parsedUnitId
        : unit.unit === selectedUnit;

      if (
        unit &&
        matchCondition &&
        unit.parts &&
        typeof unit.parts === "object"
      ) {
        Object.entries(unit.parts).forEach(([key, value]: [string, any]) => {
          if (
            value &&
            typeof value === "object" &&
            value.manager &&
            value.manager.name
          ) {
            managers.push({
              unit: unit.unit, // Use the unit code, not the numeric ID
              department: value.tmima || key,
              manager: value.manager,
              partKey: key,
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
    refetch: refetchUnits,
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
            Accept: "application/json",
            "X-Request-ID": `units-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch units: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (!data || !Array.isArray(data)) {
          console.error("Invalid units data received:", data);
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
          "ΔΑΕΦΚ-ΚΕ":
            "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΕΝΤΡΙΚΗΣ ΕΛΛΑΔΟΣ",
          "ΔΑΕΦΚ-ΒΕ":
            "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΒΟΡΕΙΑΣ ΕΛΛΑΔΟΣ",
          "ΔΑΕΦΚ-ΔΕ":
            "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΕΛΛΑΔΟΣ",
          "ΤΑΕΦΚ-ΑΑ":
            "ΤΜΗΜΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ",
          "ΤΑΕΦΚ-ΔΑ":
            "ΤΜΗΜΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΑΤΤΙΚΗΣ",
          "ΔΑΕΦΚ-ΑΚ":
            "ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΑΙΓΑΙΟΥ ΚΑΙ ΚΡΗΤΗΣ",
        };

        // If the user only has access to one unit, track it for auto-selection
        let userSingleUnit = "";
        if (userUnitIds.length === 1) {
          // Convert unit ID to unit name by finding matching unit
          const userUnitData = data.find(
            (item: any) => item.id === userUnitIds[0],
          );
          userSingleUnit = userUnitData?.unit || "";
        }

        // Filter units based on user's assigned unit_id array
        devLog(
          "UserUnits",
          "Allowed:",
          userUnitIds.length,
          "Available:",
          data.length,
        );

        const filteredUnits = data.filter((item: any) => {
          // If user has no unit restrictions, show all units (admin case)
          if (userUnitIds.length === 0) {
            return true;
          }

          // Check if the unit ID matches any of the user's allowed units
          // Handle type mismatches - both could be strings or numbers
          const itemId = Number(item.id);
          const matches = userUnitIds.some(
            (uid: any) => Number(uid) === itemId,
          );
          return matches;
        });

        devLog(
          "FilteredUnits",
          filteredUnits.length,
          "restrictions:",
          userUnitIds.length,
        );

        const processedUnits = filteredUnits.map((item: any) => {
          // For debugging purposes
          if (!item.unit && !item.id) {
            console.warn("Unit item missing both unit and id:", item);
          }

          // First handle the ID
          let unitId = item.id || item.unit || "";

          // Ensure the unit ID matches the expected format if it's abbreviated
          const userHasAccessToUnit = userUnitIds.includes(item.id);
          if (
            userHasAccessToUnit ||
            Object.keys(unitAbbreviations).includes(unitId)
          ) {
            // Keep the unit ID as is - it's already in the correct format
          } else if (unitId.length > 20) {
            // For long unit IDs, try to find the abbreviated form
            const abbrevEntry = Object.entries(unitAbbreviations).find(
              ([abbrev, fullName]) =>
                fullName === unitId || unitId.includes(fullName),
            );

            if (abbrevEntry) {
              unitId = abbrevEntry[0]; // Use the abbreviated form
            }
          }

          // Then handle the display name with proper fallbacks
          let unitName = "";

          // Case 1: Direct name property
          if (item.name) {
            unitName = item.name;
          }
          // Case 2: unit_name is a string
          else if (typeof item.unit_name === "string") {
            unitName = item.unit_name;
          }
          // Case 3: unit_name is an object with name property
          else if (
            item.unit_name &&
            typeof item.unit_name === "object" &&
            item.unit_name.name
          ) {
            unitName = item.unit_name.name;
          }
          // Case 4: Look up the full name from abbreviations
          else if (unitAbbreviations[unitId]) {
            unitName = unitAbbreviations[unitId];
          }
          // Case 5: Fall back to unit value if nothing else
          else {
            unitName = String(item.unit || unitId || "Άγνωστη Μονάδα");
          }

          return {
            id: unitId,
            name: unitName,
          };
        });

        return processedUnits;
      } catch (error) {
        console.error("Error fetching units:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive",
        });
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache for better performance (units rarely change)
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Fetch for_yl (delegated implementing agencies) data
  // Only fetch when user is authenticated to avoid HTML login page response
  const { data: forYlData = [] } = useQuery({
    queryKey: ["for-yl"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/units/for-yl", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          console.warn("[ForYl] Failed to fetch for_yl data:", response.status);
          return [];
        }

        const data = await response.json();
        console.log("[ForYl] Fetched data:", data);
        console.log("[ForYl] Data type:", typeof data, "Is array:", Array.isArray(data), "Length:", Array.isArray(data) ? data.length : "N/A");
        return data || [];
      } catch (error) {
        console.error("[ForYl] Error fetching for_yl:", error);
        return [];
      }
    },
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
    initialUnit: "",
    initialFormState: null,
  });

  const handleDialogOpen = useCallback(async () => {
    // Prevent duplicate initializations - use ref only to avoid temporal dead zone issues
    if (dialogInitializationRef.current.isInitializing) {
      return;
    }

    // CRITICAL: Block reinitialization if dialog is already open and in use
    // Use formData from context (not form.getValues()) since form may not be initialized yet
    // Only block when we have meaningful form data AND dialog is currently in use
    if (open && currentStep > 0 && !initialBeneficiary) {
      return;
    }

    // Only reset for truly new documents (when there's no saved state in context)
    // EXCEPTION: Always reset when initialBeneficiary is provided (from beneficiary page)
    const hasExistingFormData =
      formData?.project_id ||
      formData?.expenditure_type ||
      (formData?.recipients && formData.recipients.length > 0);

    // Force reset when initialBeneficiary is provided, even if there's existing form data
    const shouldResetForm = !hasExistingFormData || !!initialBeneficiary;

    if (shouldResetForm) {
      // Don't reset the unit if user has one assigned - preserve auto-selection
      let defaultUnit = "";
      if (userUnitIds.length > 0 && units && units.length > 0) {
        // Convert user's unit ID to unit name for form
        devLog(
          "UserSetup",
          "unit_id:",
          userUnitIds,
          "available:",
          units.length,
        );
        const userUnitIdStr = String(userUnitIds[0]);
        const userUnitData = units.find(
          (item: any) => item.id === userUnitIdStr,
        );
        if (userUnitData) {
          defaultUnit = userUnitData.id; // Use unit ID, not unit name
          devLog("AutoSelect", defaultUnit, "for ID:", userUnitIds[0]);
        } else {
          devLog("NoMatch", "No unit found for ID:", userUnitIds[0]);
        }
      }

      // Create initial recipients array with prefilled beneficiary if provided
      const initialRecipients = initialBeneficiary ? [{
        firstname: initialBeneficiary.firstname,
        lastname: initialBeneficiary.lastname,
        fathername: initialBeneficiary.fathername || "",
        afm: initialBeneficiary.afm,
        amount: 0,
        secondary_text: "",
        installment: "ΕΦΑΠΑΞ",
        installments: ["ΕΦΑΠΑΞ"],
        installmentAmounts: {},
        // ΕΚΤΟΣ ΕΔΡΑΣ-specific fields with defaults
        days: 1,
        daily_compensation: 0,
        accommodation_expenses: 0,
        kilometers_traveled: 0,
        price_per_km: DEFAULT_PRICE_PER_KM,
        tickets_tolls_rental: 0,
        tickets_tolls_rental_entries: [],
        has_2_percent_deduction: false,
      }] : [];

      // Reset form to default values for new document, but preserve unit
      form.reset({
        unit: defaultUnit,
        project_id: "",
        region: "",
        for_yl_id: null,
        expenditure_type: "",
        recipients: initialRecipients,
        status: "draft",
        selectedAttachments: [],
      });

      // Reset context state with preserved unit
      updateFormData({
        unit: defaultUnit,
        project_id: "",
        region: "",
        for_yl_id: null,
        expenditure_type: "",
        recipients: initialRecipients,
        status: "draft",
        selectedAttachments: [],
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
      initialUnit: formData?.unit || "",
      initialFormState: { ...formData },
    };

    // Prevent form-context sync during initialization
    setIsFormSyncing(true);
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
      } catch (err) {}

      if (!refreshedUser) {
        toast({
          title: "Προειδοποίηση σύνδεσης",
          description:
            "Η συνεδρία σας ενδέχεται να έχει λήξει. Αν αντιμετωπίσετε προβλήματα, ανανεώστε τη σελίδα.",
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
        recipients: Array.isArray(formData?.recipients)
          ? [...formData.recipients]
          : [],
        status: formData?.status || "draft",
        selectedAttachments: Array.isArray(formData?.selectedAttachments)
          ? [...formData.selectedAttachments]
          : [],
        esdian_field1: formData?.esdian_field1 || "",
        esdian_field2: formData?.esdian_field2 || "",
      };

      // STAGE 3: Apply all form values in a single atomic operation
      // This reduces form re-render & prevents flicker during initialization
      await form.reset(formValues, { keepDefaultValues: false });

      // STAGE 4: Restore step from context if valid (without triggering additional updates)
      if (
        typeof savedStep === "number" &&
        savedStep >= 0 &&
        currentStep !== savedStep
      ) {
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
        description:
          "Προέκυψε σφάλμα κατά την προετοιμασία της φόρμας. Παρακαλώ δοκιμάστε ξανά.",
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
          setIsFormSyncing(false);
          dialogInitializationRef.current.isInitializing = false;
        }, 200);

        return () => clearTimeout(updateTimeout);
      }, 300);

      return () => clearTimeout(resetTimeout);
    }
  }, [form, formData, queryClient, refreshUser, savedStep, toast, currentStep, initialBeneficiary, units, userUnitIds, updateFormData, setCurrentStep, open]);

  // Effect to handle dialog open state - triggers on open or when initialBeneficiary changes
  useEffect(() => {
    if (open && !dialogInitializationRef.current.isInitializing) {
      handleDialogOpen();
    }
  }, [open, initialBeneficiary]); // Also trigger when initialBeneficiary changes to prefill data

  // SEPARATE EFFECT: Apply initialBeneficiary data directly to recipients without full form reset
  // This ensures beneficiary prefill works even if dialog was previously used
  const lastAppliedBeneficiaryRef = useRef<string | null>(null);
  
  // Reset the applied beneficiary ref when dialog closes or initialBeneficiary is cleared
  useEffect(() => {
    if (!open || !initialBeneficiary) {
      // Reset when dialog closes or beneficiary is cleared, so it can be applied again next time
      lastAppliedBeneficiaryRef.current = null;
      return;
    }
    
    // Create a unique key for this beneficiary to avoid duplicate applications
    const beneficiaryKey = `${initialBeneficiary.afm}-${initialBeneficiary.firstname}-${initialBeneficiary.lastname}`;
    
    // Skip if we already applied this exact beneficiary
    if (lastAppliedBeneficiaryRef.current === beneficiaryKey) {
      return;
    }
    
    console.log("[CreateDocument] Applying initialBeneficiary directly:", initialBeneficiary);
    
    // Create the recipient object from beneficiary data with all required fields
    const newRecipient = {
      firstname: initialBeneficiary.firstname,
      lastname: initialBeneficiary.lastname,
      fathername: initialBeneficiary.fathername || "",
      afm: initialBeneficiary.afm,
      amount: 0,
      secondary_text: "",
      installment: "ΕΦΑΠΑΞ",
      installments: ["ΕΦΑΠΑΞ"],
      installmentAmounts: {},
      // ΕΚΤΟΣ ΕΔΡΑΣ-specific fields with defaults
      days: 1,
      daily_compensation: 0,
      accommodation_expenses: 0,
      kilometers_traveled: 0,
      price_per_km: DEFAULT_PRICE_PER_KM,
      tickets_tolls_rental: 0,
      tickets_tolls_rental_entries: [],
      has_2_percent_deduction: false,
    };
    
    // Apply to form - replace recipients with the prefilled beneficiary
    form.setValue("recipients", [newRecipient], { shouldValidate: false });
    
    // Also update the form context
    updateFormData({
      ...formData,
      recipients: [newRecipient],
    });
    
    // Mark as applied to prevent duplicate applications
    lastAppliedBeneficiaryRef.current = beneficiaryKey;
    
    console.log("[CreateDocument] Beneficiary applied successfully");
  }, [open, initialBeneficiary, form, formData, updateFormData]);

  // CRITICAL FIX: Completely redesigned unit default-setting mechanism
  // Uses a separate reference to track unit initialization to prevent duplicate operations
  const unitInitializationRef = useRef({
    isCompleted: false,
    attemptCount: 0,
    defaultUnit: "",
  });

  // Enhanced unit auto-selection with proper persistence
  const unitAutoSelectionRef = useRef<{
    hasSelected: boolean;
    selectedUnit: string;
  }>({ hasSelected: false, selectedUnit: "" });

  useEffect(() => {
    // Ensure unit auto-selection happens at the right time and persists
    if (!user || !open || !units || units.length === 0) return;

    const currentUnit = form.getValues().unit;

    // Auto-select if no unit is selected and we haven't already auto-selected
    if (!currentUnit && !unitAutoSelectionRef.current.hasSelected) {
      let unitToSelect = "";

      // Case 1: Only one unit available - auto-select it
      if (units.length === 1) {
        unitToSelect = units[0].id;
        devLog("AutoUnit", unitToSelect);
      }
      // Case 2: User has only one assigned unit - auto-select it
      else if (userUnitIds.length === 1) {
        const userUnitData = units.find(
          (unit: any) => unit.id === userUnitIds[0],
        );
        if (userUnitData) {
          unitToSelect = userUnitData.id;
          devLog("AssignedUnit", unitToSelect);
        }
      }

      // Apply the auto-selection
      if (unitToSelect) {
        // Set in form with immediate effect
        form.setValue("unit", unitToSelect, { shouldValidate: false });

        // Update form context as well
        updateFormData({
          ...formData,
          unit: unitToSelect,
        });

        // Track selection to prevent overrides
        unitAutoSelectionRef.current = {
          hasSelected: true,
          selectedUnit: unitToSelect,
        };

        // Force the form to maintain this value
        setTimeout(() => {
          const currentValue = form.getValues().unit;
          if (!currentValue || currentValue !== unitToSelect) {
            form.setValue("unit", unitToSelect, { shouldValidate: false });
            devLog("ReEnforce", unitToSelect);
          }
        }, 500);
      }
    }

    // Re-enforce selection if it was cleared but should be maintained
    if (
      unitAutoSelectionRef.current.hasSelected &&
      unitAutoSelectionRef.current.selectedUnit &&
      !currentUnit
    ) {
      form.setValue("unit", unitAutoSelectionRef.current.selectedUnit, {
        shouldValidate: false,
      });
      devLog("Restore", unitAutoSelectionRef.current.selectedUnit);
    }
  }, [user, open, units, form, formData, updateFormData]);

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
  const selectedForYlId = form.watch("for_yl_id");

  // Effect to validate for_yl_id when unit or forYlData changes
  // Clear for_yl_id if it no longer belongs to the available options for the selected unit
  useEffect(() => {
    // Skip if no for_yl_id is selected (handles null, undefined, 0)
    const currentForYlId = selectedForYlId;
    if (!currentForYlId || !selectedUnit || !forYlData?.length) return;
    
    // Filter for_yl options by the selected unit
    const availableForYl = forYlData.filter(
      (fy: any) => fy.monada_id && String(fy.monada_id) === String(selectedUnit)
    );
    
    // Check if the current for_yl_id is in the available options (handle both number and string comparisons)
    const isValidSelection = availableForYl.some((fy: any) => 
      fy.id === currentForYlId || String(fy.id) === String(currentForYlId)
    );
    
    if (!isValidSelection) {
      console.log("[ForYlValidation] Clearing invalid for_yl_id:", currentForYlId, "for unit:", selectedUnit);
      form.setValue("for_yl_id", null);
      // Only update for_yl_id in context, preserving other values from form
      updateFormData({ for_yl_id: null });
    }
  }, [selectedUnit, forYlData, selectedForYlId, form, updateFormData]);

  // Simplified state management - replace complex ref-based blocking
  const [isDialogInitializing, setIsDialogInitializing] = useState(false);
  const [isFormSyncing, setIsFormSyncing] = useState(false);

  // Simplified form-to-context sync without complex ref blocking
  const syncFormToContext = useCallback(() => {
    if (isFormSyncing) return; // Simple state-based blocking instead of ref

    setIsFormSyncing(true);

    try {
      const formValues = form.getValues();

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

      updateFormData(newState);
    } finally {
      setIsFormSyncing(false);
    }
  }, [form, updateFormData, isFormSyncing]);

  // Effect to trigger form sync when state changes - COMPLETELY DISABLED TO PREVENT INFINITE LOOP
  // The form state will only sync when explicitly called by user actions (form submission, step changes)
  // This prevents the circular dependency that was causing infinite re-renders
  // Removed redundant useEffect that was disabled and causing infinite loops

  const currentAmount = recipients.reduce((sum: number, r) => {
    return sum + (typeof r.amount === "number" ? r.amount : 0);
  }, 0);

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
  const checkInstallmentConflict = (
    beneficiary: any,
    expenditureType: string,
    installment: string,
  ) => {
    if (!beneficiary?.oikonomika || !expenditureType || !installment)
      return false;

    const expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || typeof expenditureData !== "object") return false;

    // Handle object format like: { "Α": { "status": "διαβιβάστηκε", ... } }
    if (expenditureData[installment]) {
      const record = expenditureData[installment];
      return (
        record.status === "διαβιβάστηκε" || record.status === "διαβιβαστηκε"
      );
    }

    return false;
  };

  // Helper function to check if installments are in sequence
  const areInstallmentsInSequence = (
    installments: string[],
    expenditureType: string,
  ) => {
    if (installments.length <= 1) return true;

    // For housing allowance, quarters must be consecutive
    if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
      const quarterNumbers = installments
        .map((q) => parseInt(q.replace("ΤΡΙΜΗΝΟ ", "")))
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

    // Check for conflicts: can't have both regular and supplementary of same letter
    const baseLetters = ["Α", "Β", "Γ"];
    for (const letter of baseLetters) {
      const hasRegular = installments.includes(letter);
      const hasSupplementary = installments.includes(
        `${letter} συμπληρωματική`,
      );
      if (hasRegular && hasSupplementary) {
        return false; // Can't have both Α and Α συμπληρωματική
      }
    }

    // Collect all installment letters (both regular and supplementary)
    const letterOrder: Record<string, number> = { Α: 0, Β: 1, Γ: 2 };
    const usedLetters = new Set<string>();

    for (const inst of installments) {
      if (inst === "ΕΦΑΠΑΞ") continue;
      const letter = inst.replace(" συμπληρωματική", "");
      if (letterOrder[letter] !== undefined) {
        usedLetters.add(letter);
      }
    }

    // Check if used letters are consecutive
    if (usedLetters.size > 1) {
      const sortedIndices = Array.from(usedLetters)
        .map((l) => letterOrder[l])
        .sort((a, b) => a - b);

      for (let i = 1; i < sortedIndices.length; i++) {
        if (sortedIndices[i] - sortedIndices[i - 1] !== 1) {
          return false; // Not consecutive
        }
      }
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

    // Use component-level state for showing/hiding quarter details
    const showQuarterDetails = expandedQuarterDetails.has(index);
    const toggleQuarterDetails = () => {
      setExpandedQuarterDetails((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        return newSet;
      });
    };

    // Control function to toggle an installment selection - simplified version
    const handleInstallmentToggle = (installment: string) => {
      // Check if this installment conflicts with existing beneficiary data
      const expenditureType = form.watch("expenditure_type");
      if (
        currentRecipient &&
        "oikonomika" in currentRecipient &&
        expenditureType
      ) {
        const hasConflict = checkInstallmentConflict(
          currentRecipient,
          expenditureType,
          installment,
        );
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
          newInstallments = newInstallments.filter((i) => i !== installment);
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
                description:
                  "Τα τρίμηνα πρέπει να είναι διαδοχικά (π.χ. ΤΡΙΜΗΝΟ 1, 2, 3)",
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
          newInstallments = newInstallments.filter((i) => i !== "ΕΦΑΠΑΞ");

          // 2. Toggle the selected installment
          if (newInstallments.includes(installment)) {
            // If already selected, remove it
            newInstallments = newInstallments.filter((i) => i !== installment);
          } else {
            // If not selected, add it
            newInstallments.push(installment);
          }

          // 3. If no installments are left, fall back to ΕΦΑΠΑΞ
          if (newInstallments.length === 0) {
            newInstallments = ["ΕΦΑΠΑΞ"];
          }

          // 4. Validate installments are in sequence
          if (!areInstallmentsInSequence(newInstallments, expenditureType)) {
            // Check for specific conflict types
            const baseLetters = ["Α", "Β", "Γ"];
            let conflictFound = false;

            // Check for regular + supplementary conflict
            for (const letter of baseLetters) {
              const hasRegular = newInstallments.includes(letter);
              const hasSupplementary = newInstallments.includes(
                `${letter} συμπληρωματική`,
              );
              if (hasRegular && hasSupplementary) {
                toast({
                  title: "Μη έγκυρη επιλογή",
                  description: `Δεν μπορείτε να έχετε και "${letter}" και "${letter} συμπληρωματική" στο ίδιο έγγραφο`,
                  variant: "destructive",
                });
                conflictFound = true;
                break;
              }
            }

            if (!conflictFound && newInstallments.length > 1) {
              toast({
                title: "Μη έγκυρες δόσεις",
                description:
                  "Οι δόσεις πρέπει να είναι διαδοχικές (π.χ. Α+Β ή Β+Γ, όχι Α+Γ)",
                variant: "destructive",
              });
            }
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
        // Sort standard installments: ΕΦΑΠΑΞ first, then Α, Α ΣΥΜ, Β, Β ΣΥΜ, Γ, Γ ΣΥΜ
        newInstallments.sort((a, b) => {
          const getOrder = (inst: string) => {
            if (inst === "ΕΦΑΠΑΞ") return 0;
            if (inst === "Α") return 1;
            if (inst === "Α συμπληρωματική") return 2;
            if (inst === "Β") return 3;
            if (inst === "Β συμπληρωματική") return 4;
            if (inst === "Γ") return 5;
            if (inst === "Γ συμπληρωματική") return 6;
            return 99;
          };
          return getOrder(a) - getOrder(b);
        });
      }

      // Block context updates during this operation
      setIsFormSyncing(true);

      try {
        // Create a new payment amounts object
        const newAmounts: Record<string, number> = {};

        // Copy over existing amounts for selected installments
        newInstallments.forEach((inst) => {
          if (
            expenditureType === HOUSING_ALLOWANCE_TYPE &&
            inst.startsWith("ΤΡΙΜΗΝΟ ")
          ) {
            // Set standard amount for housing allowance quarters
            newAmounts[inst] =
              installmentAmounts[inst] || STANDARD_QUARTER_AMOUNT;
          } else {
            newAmounts[inst] = installmentAmounts[inst] || 0;
          }
        });

        // Calculate total amount for recipient
        const totalRecipientAmount = Object.values(newAmounts).reduce(
          (sum, amount) => sum + (amount || 0),
          0,
        );

        // Set ΕΦΑΠΑΞ amount to total if it's the only option
        if (newInstallments.length === 1 && newInstallments[0] === "ΕΦΑΠΑΞ") {
          newAmounts["ΕΦΑΠΑΞ"] = currentRecipient?.amount || 0;
        }

        // Log for debugging
        // Updated installments and amounts

        // Update form values immediately
        form.setValue(`recipients.${index}.installments`, newInstallments);
        form.setValue(`recipients.${index}.installmentAmounts`, newAmounts);
        form.setValue(
          `recipients.${index}.amount`,
          Number(totalRecipientAmount),
        );

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
                installmentAmounts: { ...newAmounts },
              };

              updateFormData({
                recipients: updatedRecipients,
              });
            }
          }
        }, 100);
      } finally {
        // Reset update flag with delay to prevent race conditions
        setTimeout(() => {
          setIsFormSyncing(false);
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
      setIsFormSyncing(true);

      try {
        // CRITICAL FIX: Guard against extremely large numbers that cause display issues
        // Check if the number is unreasonably large (more than 1 billion)
        // This prevents scientific notation or overflow display issues
        if (!isFinite(amount) || amount > 1000000000) {
          // Budget form warning logging removed for cleaner console
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
        const currentInstallmentAmounts = JSON.parse(
          JSON.stringify(installmentAmounts || {}),
        );

        // Set the new amount for this installment
        currentInstallmentAmounts[installment] = amount;

        // Update total amount based on installment amounts - make sure we only sum numbers
        const totalAmount = Object.values(
          currentInstallmentAmounts,
        ).reduce<number>(
          (sum, val) => sum + (typeof val === "number" ? val : 0),
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
          const currentInstallments =
            form.getValues(`recipients.${index}.installments`) || [];
          if (currentInstallments.length > 0) {
            form.setValue(
              `recipients.${index}.installment`,
              currentInstallments[0],
            );
          }
        }

        // Updated installment amount and recalculated total recipient amount

        // Wait a small amount of time before updating context to avoid race conditions
        setTimeout(() => {
          // Make a deep copy of the recipients array to prevent reference issues
          const manuallyUpdatedRecipients = JSON.parse(
            JSON.stringify(recipients),
          );

          if (manuallyUpdatedRecipients[index]) {
            // Update with a completely fresh object to avoid any reference issues
            manuallyUpdatedRecipients[index] = {
              ...manuallyUpdatedRecipients[index],
              amount: safeTotal,
              installmentAmounts: { ...currentInstallmentAmounts },
            };

            // Updating form context with modified recipient data

            // Update form context with updated recipients
            updateFormData({ recipients: manuallyUpdatedRecipients });
          }
        }, 100);
      } finally {
        // Reset flag after a longer delay to ensure all React updates complete
        setTimeout(() => {
          setIsFormSyncing(false);
        }, 150);
      }
    };

    // Calculate total for display
    const totalAmount = Object.values(installmentAmounts).reduce(
      (sum: number, amount: number) => sum + (amount || 0),
      0,
    );

    // ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ - Sophisticated Range Selector Layout
    if (expenditureType === HOUSING_ALLOWANCE_TYPE) {
      // Extract from/to quarters from selected installments
      const quarterNumbers = selectedInstallments
        .map((q) => parseInt(q.replace("ΤΡΙΜΗΝΟ ", "")))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      
      const fromQuarter = quarterNumbers.length > 0 ? quarterNumbers[0] : 1;
      const toQuarter = quarterNumbers.length > 0 ? quarterNumbers[quarterNumbers.length - 1] : 1;
      const quarterCount = quarterNumbers.length;

      // Check if any amounts differ from STANDARD_QUARTER_AMOUNT (canonical baseline)
      const hasCustomAmounts = selectedInstallments.some(
        (q) => (installmentAmounts[q] || STANDARD_QUARTER_AMOUNT) !== STANDARD_QUARTER_AMOUNT
      );
      
      // Calculate a "representative" amount for display (first quarter or standard)
      const displayAmount = selectedInstallments.length > 0 
        ? (installmentAmounts[selectedInstallments[0]] || STANDARD_QUARTER_AMOUNT)
        : STANDARD_QUARTER_AMOUNT;
      
      // Check if all amounts are uniform (same value, even if custom)
      const allAmounts = selectedInstallments.map((q) => installmentAmounts[q] || STANDARD_QUARTER_AMOUNT);
      const areAllUniform = allAmounts.length > 0 && allAmounts.every((a) => a === allAmounts[0]);

      // Handler for changing the quarter range - ALWAYS use STANDARD_QUARTER_AMOUNT for new quarters
      const handleRangeChange = (newFrom: number, newTo: number) => {
        if (newFrom > newTo || newFrom < 1) return;
        
        setIsFormSyncing(true);
        try {
          const newInstallments: string[] = [];
          const newAmounts: Record<string, number> = {};
          
          // Build new range - preserve existing amounts only for quarters in new range
          for (let i = newFrom; i <= newTo; i++) {
            const quarterKey = `ΤΡΙΜΗΝΟ ${i}`;
            newInstallments.push(quarterKey);
            // Only keep existing amount if quarter was previously selected, otherwise use standard
            if (selectedInstallments.includes(quarterKey) && installmentAmounts[quarterKey]) {
              newAmounts[quarterKey] = installmentAmounts[quarterKey];
            } else {
              newAmounts[quarterKey] = STANDARD_QUARTER_AMOUNT;
            }
          }

          const newTotal = Object.values(newAmounts).reduce((sum, a) => sum + a, 0);

          form.setValue(`recipients.${index}.installments`, newInstallments);
          form.setValue(`recipients.${index}.installmentAmounts`, newAmounts);
          form.setValue(`recipients.${index}.amount`, newTotal);

          setTimeout(() => {
            const updatedRecipients = JSON.parse(JSON.stringify(recipients));
            if (updatedRecipients[index]) {
              updatedRecipients[index] = {
                ...updatedRecipients[index],
                installments: newInstallments,
                installmentAmounts: newAmounts,
                amount: newTotal,
              };
              updateFormData({ recipients: updatedRecipients });
            }
          }, 100);
        } finally {
          setTimeout(() => setIsFormSyncing(false), 150);
        }
      };

      // Handler for changing the default amount (applies uniformly to ALL current quarters)
      const handleDefaultAmountChange = (newAmount: number) => {
        if (selectedInstallments.length === 0) return;
        
        setIsFormSyncing(true);
        try {
          const newAmounts: Record<string, number> = {};
          // Apply new amount to ALL selected installments
          selectedInstallments.forEach((q) => {
            newAmounts[q] = newAmount;
          });

          const newTotal = newAmount * selectedInstallments.length;

          form.setValue(`recipients.${index}.installmentAmounts`, newAmounts);
          form.setValue(`recipients.${index}.amount`, newTotal);

          setTimeout(() => {
            const updatedRecipients = JSON.parse(JSON.stringify(recipients));
            if (updatedRecipients[index]) {
              updatedRecipients[index] = {
                ...updatedRecipients[index],
                installmentAmounts: newAmounts,
                amount: newTotal,
              };
              updateFormData({ recipients: updatedRecipients });
            }
          }, 100);
        } finally {
          setTimeout(() => setIsFormSyncing(false), 150);
        }
      };

      // Handler for resetting all quarters to the canonical STANDARD_QUARTER_AMOUNT
      const handleResetToUniform = () => {
        handleDefaultAmountChange(STANDARD_QUARTER_AMOUNT);
      };

      return (
        <div className="w-full space-y-2">
          {/* Compact main row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* From Quarter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Από Τρίμηνο</label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fromQuarter > 1) {
                      handleRangeChange(fromQuarter - 1, toQuarter);
                    }
                  }}
                  disabled={fromQuarter <= 1}
                  className="h-8 w-8 p-0 rounded-r-none border-r-0"
                >
                  −
                </Button>
                <Input
                  type="text"
                  value={fromQuarter}
                  onChange={(e) => {
                    const newFrom = parseInt(e.target.value) || 1;
                    if (newFrom >= 1) {
                      handleRangeChange(newFrom, Math.max(newFrom, toQuarter));
                    }
                  }}
                  className="w-12 h-8 text-sm text-center px-1 rounded-none border-x-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newFrom = fromQuarter + 1;
                    handleRangeChange(newFrom, Math.max(newFrom, toQuarter));
                  }}
                  className="h-8 w-8 p-0 rounded-l-none border-l-0"
                >
                  +
                </Button>
              </div>
            </div>

            {/* To Quarter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Έως Τρίμηνο</label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (toQuarter > fromQuarter) {
                      handleRangeChange(fromQuarter, toQuarter - 1);
                    }
                  }}
                  disabled={toQuarter <= fromQuarter}
                  className="h-8 w-8 p-0 rounded-r-none border-r-0"
                >
                  −
                </Button>
                <Input
                  type="text"
                  value={toQuarter}
                  onChange={(e) => {
                    const newTo = parseInt(e.target.value) || fromQuarter;
                    handleRangeChange(fromQuarter, Math.max(fromQuarter, newTo));
                  }}
                  className="w-12 h-8 text-sm text-center px-1 rounded-none border-x-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRangeChange(fromQuarter, toQuarter + 1)}
                  className="h-8 w-8 p-0 rounded-l-none border-l-0"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-border" />

            {/* Default Amount per Quarter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Ποσό/τρίμηνο</label>
              <div className="relative">
                <NumberInput
                  value={areAllUniform ? displayAmount : ""}
                  onChange={(formatted, numeric) => handleDefaultAmountChange(numeric || 0)}
                  className="w-24 h-8 text-sm pr-5"
                  placeholder={areAllUniform ? "900,00" : "Διάφορα"}
                  decimals={2}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-md ml-auto">
              <span className="text-xs text-muted-foreground">{quarterCount} τρίμ.</span>
              <span className="text-sm font-bold text-primary">
                {totalAmount.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}
              </span>
            </div>

            {/* Customize button */}
            <Button
              type="button"
              variant={showQuarterDetails ? "secondary" : "ghost"}
              size="sm"
              onClick={toggleQuarterDetails}
              className="h-8 px-2 text-xs"
            >
              {showQuarterDetails ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Κλείσιμο
                </>
              ) : (
                <>
                  <Settings2 className="h-3 w-3 mr-1" />
                  Προσαρμογή
                </>
              )}
            </Button>
          </div>

          {/* Expanded per-quarter details */}
          {showQuarterDetails && (
            <div className="border rounded-md p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Ποσά ανά τρίμηνο</span>
                {hasCustomAmounts && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetToUniform}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Επαναφορά σε {STANDARD_QUARTER_AMOUNT}€
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedInstallments.map((quarter) => {
                  const quarterNum = quarter.replace("ΤΡΙΜΗΝΟ ", "");
                  const amount = installmentAmounts[quarter] || STANDARD_QUARTER_AMOUNT;
                  // Highlight if amount differs from STANDARD_QUARTER_AMOUNT
                  const isCustom = amount !== STANDARD_QUARTER_AMOUNT;
                  
                  return (
                    <div
                      key={quarter}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                        isCustom ? "bg-amber-100 dark:bg-amber-900/30 ring-1 ring-amber-300" : "bg-background"
                      }`}
                    >
                      <span className="text-xs font-medium w-6">Τ{quarterNum}</span>
                      <div className="relative">
                        <NumberInput
                          value={amount}
                          onChange={(formatted, numeric) =>
                            handleInstallmentAmountChange(quarter, numeric || 0)
                          }
                          className="w-20 h-7 text-xs pr-4"
                          placeholder="900"
                          decimals={2}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Regular Installments (ΔΚΑ, etc.) - Horizontal Layout
    return (
      <div className="w-full">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Left side: Installment buttons */}
          <div className="flex-shrink-0">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Δόσεις</label>
            <div className="flex flex-wrap items-center gap-2">
              {availableInstallments
                .filter((inst) => !inst.includes("συμπληρωματική"))
                .map((installment) => {
                  const isRegularSelected = selectedInstallments.includes(installment);
                  const supplementaryVersion = `${installment} συμπληρωματική`;
                  const isSupplementarySelected = selectedInstallments.includes(supplementaryVersion);
                  const isDKA = DKA_TYPES.includes(expenditureType);
                  const canHaveSupplementary = isDKA && installment !== "ΕΦΑΠΑΞ";

                  if (!canHaveSupplementary) {
                    return (
                      <Button
                        key={installment}
                        type="button"
                        variant={isRegularSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleInstallmentToggle(installment)}
                        className="h-9 px-4"
                        data-testid={`installment-${installment}`}
                      >
                        {installment}
                      </Button>
                    );
                  }

                  return (
                    <div key={installment} className="inline-flex rounded-md border border-input overflow-hidden" role="group">
                      <Button
                        type="button"
                        variant={isRegularSelected ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          if (isSupplementarySelected) {
                            handleInstallmentToggle(supplementaryVersion);
                            handleInstallmentToggle(installment);
                          } else {
                            handleInstallmentToggle(installment);
                          }
                        }}
                        className={`h-9 px-3 rounded-none ${isRegularSelected ? "" : "hover:bg-accent"}`}
                        data-testid={`installment-regular-${installment}`}
                      >
                        {installment}
                      </Button>
                      <div className="w-px bg-border" />
                      <Button
                        type="button"
                        variant={isSupplementarySelected ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          if (isRegularSelected) {
                            handleInstallmentToggle(installment);
                            handleInstallmentToggle(supplementaryVersion);
                          } else {
                            handleInstallmentToggle(supplementaryVersion);
                          }
                        }}
                        className={`h-9 px-2 rounded-none text-xs ${isSupplementarySelected ? "" : "hover:bg-accent"}`}
                        data-testid={`installment-supplementary-${installment}`}
                      >
                        ΣΥΜ.
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right side: Amount inputs */}
          {selectedInstallments.length > 0 && (
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Ποσά</label>
              <div className="flex flex-wrap items-center gap-3">
                {selectedInstallments.map((installment) => (
                  <div key={installment} className="flex items-center gap-1.5 bg-muted/50 rounded-md pl-2 pr-1 py-1">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {installment.includes("συμπληρωματική")
                        ? installment.replace(" συμπληρωματική", " ΣΥΜ.")
                        : installment}
                    </span>
                    <div className="relative w-24">
                      <NumberInput
                        value={installmentAmounts[installment] || ""}
                        onChange={(formatted, numeric) =>
                          handleInstallmentAmountChange(installment, numeric || 0)
                        }
                        className="h-8 text-sm pr-5"
                        placeholder="0,00"
                        decimals={2}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                    </div>
                  </div>
                ))}
                
                {/* Total display inline */}
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-md ml-auto">
                  <span className="text-sm text-muted-foreground">Σύνολο:</span>
                  <span className="text-base font-bold text-primary">
                    {totalAmount.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
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
          // Error logging removed for cleaner console output
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
          // Error logging removed for cleaner console output
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
            // Debug logging removed for cleaner console output
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
              // Error logging removed for cleaner console output
            }
          }

          const name =
            item.project_title ||
            item.event_description ||
            `Project ${item.mis}`;

          return {
            id: item.id, // Use the numeric project_id from database
            mis: String(item.mis), // Store MIS separately
            name,
            expenditure_types: expenditureTypes || [],
          };
        });
      } catch (error) {
        // Error logging removed for cleaner console output
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive",
        });
        return [];
      }
    },
    staleTime: 3 * 60 * 1000, // 3 minutes cache for better performance
    gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false,
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

  // Debug logging removed for cleaner console output

  // Budget data validation and tracking - DISABLED to prevent infinite loops
  /*
  useEffect(() => {
    // This useEffect was causing infinite loops - disabled
  }, []);
  */

  // DEBOUNCED BUDGET VALIDATION - validates when amounts change in Step 2
  // This checks BOTH Πίστωση and Κατανομή έτους limits
  useEffect(() => {
    // Only validate when on Step 2 (recipients) and we have a project and amount
    const projectId = selectedProjectId || formData.project_id;
    
    if (currentStep !== 2 || !projectId || currentAmount <= 0) {
      // Reset validation when conditions aren't met
      if (currentAmount === 0 && localBudgetValidation !== null) {
        setLocalBudgetValidation(null);
      }
      return;
    }

    // Clear any existing timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    // Debounce validation by 500ms
    const timeout = setTimeout(async () => {
      try {
        console.log('[BudgetValidation] Validating amount:', currentAmount, 'for project:', projectId);
        
        const response = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mis: projectId,
            amount: currentAmount,
          })
        });
        
        if (!response.ok) {
          console.warn('[BudgetValidation] API error:', response.status);
          return;
        }
        
        const data = await response.json();
        console.log('[BudgetValidation] Response:', data);
        
        // Determine which budget type is being exceeded based on the response
        // The backend should return budget_indicators with details
        const budgetIndicators = data.metadata?.budget_indicators || {};
        const available = Number(budgetIndicators.available_budget) || Number(budgetData?.available_budget) || 0;
        const katanomesEtous = Number(budgetData?.katanomes_etous) || 0;
        const ethsiaPistosi = Number(budgetData?.ethsia_pistosi) || 0;
        const userView = Number(budgetData?.user_view) || 0;
        
        // Calculate what's being exceeded
        // Πίστωση check: if userView + currentAmount > ethsia_pistosi
        // Κατανομή check: if userView + currentAmount > katanomes_etous
        const willExceedPistosi = (userView + currentAmount) > ethsiaPistosi;
        const willExceedKatanomi = (userView + currentAmount) > katanomesEtous;
        
        // PRIORITY: Πίστωση ALWAYS takes precedence because it's a hard limit
        // If Πίστωση is exceeded, user CANNOT proceed - requires Ανακατανομή
        // If only Κατανομή is exceeded, user can save but DOCX is blocked - requires Χρηματοδότηση
        let budgetType: 'pistosi' | 'katanomi' | null = null;
        if (willExceedPistosi) {
          // Πίστωση exceeded = HARD BLOCK, need ανακατανομή (regardless of katanomi status)
          budgetType = 'pistosi';
        } else if (willExceedKatanomi) {
          // Only Κατανομή exceeded (pistosi OK) = SOFT BLOCK, can save but no DOCX, need χρηματοδότηση
          budgetType = 'katanomi';
        }
        
        setLocalBudgetValidation({
          status: data.status || (data.canCreate ? 'success' : 'error'),
          canCreate: data.canCreate ?? true,
          allowDocx: data.allowDocx ?? true,
          message: data.message || '',
          budgetType,
        });
        
      } catch (error) {
        console.error('[BudgetValidation] Error:', error);
      }
    }, 500);
    
    setValidationTimeout(timeout);
    
    // Cleanup
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentAmount, currentStep, selectedProjectId, formData.project_id, budgetData]);

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ["attachments", form.watch("expenditure_type")],
    staleTime: 5 * 60 * 1000, // 5 minutes cache for better performance
    gcTime: 15 * 60 * 1000, // 15 minutes cache retention
    refetchOnWindowFocus: false,
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
          // Authentication warning logging removed for cleaner console
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
          // Attachments request error logging removed for cleaner console
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
        // Error logging removed for cleaner console output
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
  // Only block if Πίστωση is exceeded (pistosi type) - hard block
  // Κατανομή exceeded (katanomi type) allows saving but blocks DOCX
  const isSubmitDisabled =
    localBudgetValidation?.budgetType === 'pistosi'; // Only pistosi is a hard block

  // Debug validation issues - logging removed for cleaner console

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleSubmit = async (data: CreateDocumentForm) => {
    try {
      devLog("Submit", "Starting submission", {
        project_id: data.project_id,
        recipients: data.recipients?.length,
        unit: data.unit,
        type: data.expenditure_type,
      });

      // Begin form submission process

      // Basic form validation
      if (!data.project_id) {
        throw new Error("Πρέπει να επιλέξετε έργο");
      }

      if (!data.recipients?.length) {
        throw new Error("Απαιτείται τουλάχιστον ένας δικαιούχος");
      }

      // Detailed validation for each recipient
      for (let index = 0; index < data.recipients.length; index++) {
        const r = data.recipients[index];
        const isEktosEdras = data.expenditure_type === EKTOS_EDRAS_TYPE;

        // Check required fields with specific error messages
        if (!r.firstname || r.firstname.trim() === "") {
          throw new Error(
            `Δικαιούχος #${index + 1}: Το όνομα είναι υποχρεωτικό. Παρακαλώ αναζητήστε και επιλέξτε δικαιούχο με βάση το ΑΦΜ.`,
          );
        }
        if (!r.lastname || r.lastname.trim() === "") {
          throw new Error(
            `Δικαιούχος #${index + 1}: Το επώνυμο είναι υποχρεωτικό. Παρακαλώ αναζητήστε και επιλέξτε δικαιούχο με βάση το ΑΦΜ.`,
          );
        }
        if (!r.afm || r.afm.trim() === "") {
          throw new Error(
            `Δικαιούχος #${index + 1}: Το ΑΦΜ είναι υποχρεωτικό.`,
          );
        }
        if (r.afm.trim().length !== 9) {
          throw new Error(
            `Δικαιούχος #${index + 1}: Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.`,
          );
        }
        if (typeof r.amount !== "number" || r.amount <= 0) {
          throw new Error(
            `Δικαιούχος #${index + 1}: Το ποσό πρέπει να είναι μεγαλύτερο από 0.`,
          );
        }
        if (!isEktosEdras && (!r.installments || r.installments.length === 0)) {
          throw new Error(
            `Δικαιούχος #${index + 1}: Πρέπει να επιλέξετε τουλάχιστον μία δόση.`,
          );
        }
      }

      // Validate that all installments are in sequence (skip for ΕΚΤΟΣ ΕΔΡΑΣ)
      if (data.expenditure_type !== EKTOS_EDRAS_TYPE) {
        console.log("[HandleSubmit] Checking installment sequences...");
        const hasInvalidSequence = data.recipients.some((r, index) => {
          if (r.installments.length <= 1) return false;
          const isValid = areInstallmentsInSequence(
            r.installments,
            data.expenditure_type,
          );
          console.log(
            `[Validation] Checking installment sequence for recipient ${index}:`,
            {
              installments: r.installments,
              expenditureType: data.expenditure_type,
              isValid: isValid,
            },
          );
          return !isValid;
        });

        console.log(
          "[HandleSubmit] Invalid sequence found:",
          hasInvalidSequence,
        );
        if (hasInvalidSequence) {
          throw new Error(
            "Οι δόσεις πρέπει να είναι διαδοχικές (π.χ. Α+Β ή Β+Γ, όχι Α+Γ)",
          );
        }
      }

      // Validate that all installments have amounts entered (skip for ΕΚΤΟΣ ΕΔΡΑΣ)
      if (data.expenditure_type !== EKTOS_EDRAS_TYPE) {
        console.log("[HandleSubmit] Checking installment amounts...");

        // Find recipients with missing installment amounts
        const recipientsWithMissingAmounts: {
          index: number;
          missingInstallments: string[];
        }[] = [];

        data.recipients.forEach((recipient, index) => {
          console.log(
            `[HandleSubmit] Checking installment amounts for recipient ${index}:`,
            {
              installments: recipient.installments,
              installmentAmounts: recipient.installmentAmounts,
            },
          );

          const missingInstallments: string[] = [];
          recipient.installments.forEach((installment) => {
            const hasAmount =
              recipient.installmentAmounts &&
              typeof recipient.installmentAmounts[installment] === "number" &&
              recipient.installmentAmounts[installment] > 0;

            console.log(
              `[HandleSubmit] Installment ${installment} validation:`,
              {
                hasAmounts: !!recipient.installmentAmounts,
                value: recipient.installmentAmounts?.[installment],
                type: typeof recipient.installmentAmounts?.[installment],
                hasAmount: hasAmount,
              },
            );

            if (!hasAmount) {
              missingInstallments.push(installment);
            }
          });

          if (missingInstallments.length > 0) {
            recipientsWithMissingAmounts.push({ index, missingInstallments });
          }
        });

        console.log(
          "[HandleSubmit] Recipients with missing amounts:",
          recipientsWithMissingAmounts,
        );

        if (recipientsWithMissingAmounts.length > 0) {
          const firstMissing = recipientsWithMissingAmounts[0];
          const recipientName = `${data.recipients[firstMissing.index].firstname} ${data.recipients[firstMissing.index].lastname}`;
          const missingList = firstMissing.missingInstallments.join(", ");
          throw new Error(
            `Ο δικαιούχος "${recipientName}" έχει επιλεγμένες δόσεις χωρίς ποσά: ${missingList}. Παρακαλώ συμπληρώστε το ποσό για κάθε δόση.`,
          );
        }
      }

      console.log(
        "[HandleSubmit] All validations passed, setting loading state...",
      );

      setLoading(true);

      // Find project to get MIS
      console.log(
        "[HandleSubmit] Looking for project with ID:",
        data.project_id,
        "type:",
        typeof data.project_id,
      );
      console.log(
        "[HandleSubmit] Available projects:",
        projects.map((p) => ({ id: p.id, mis: p.mis })),
      );
      const projectForSubmission = projects.find(
        (p) => String(p.id) === String(data.project_id),
      );
      console.log("[HandleSubmit] Found project:", projectForSubmission);
      if (!projectForSubmission?.mis) {
        throw new Error("Δεν βρέθηκε το MIS του έργου");
      }

      // Project validation logging removed for cleaner console

      const totalAmount = data.recipients.reduce<number>(
        (sum, r) => sum + r.amount,
        0,
      );

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
            mis: data.project_id, // Use project_id (not MIS code) - backend expects project_id for budget lookup
            amount: totalAmount.toString(),
            sessionId:
              sessionStorage.getItem("clientSessionId") ||
              `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          }),
        });

        // Handle authorization issues gracefully - allow to continue with warning
        if (budgetValidationResponse.status === 401) {
          console.warn("[Budget] Authorization issue during validation - continuing with reservation");
          toast({
            title: "Προειδοποίηση",
            description:
              "Απαιτείται επαναλογίνση για πλήρη έλεγχο προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive",
          });
        }
        // Handle other HTTP errors gracefully - allow to continue with warning
        else if (!budgetValidationResponse.ok) {
          console.warn("[Budget] HTTP error during validation - continuing with reservation");
          toast({
            title: "Προειδοποίηση",
            description:
              "Αδυναμία ελέγχου προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive",
          });
        }
        // Process successful validation response
        else {
          const budgetValidation = await budgetValidationResponse.json();

          // If budget validation explicitly says cannot create, this is a legitimate budget issue
          // Do NOT catch this - let it propagate to block the save
          if (!budgetValidation.canCreate) {
            const budgetErrorMessage = budgetValidation.message ||
              "Δεν είναι δυνατή η δημιουργία εγγράφου λόγω περιορισμών προϋπολογισμού";
            toast({
              title: "Σφάλμα Προϋπολογισμού",
              description: budgetErrorMessage,
              variant: "destructive",
            });
            throw new Error(`BUDGET_BLOCK: ${budgetErrorMessage}`);
          }
          // If validation passed, optionally show success info
          console.log("[Budget] Validation passed - proceeding with document creation");
        }
      } catch (validationError: any) {
        // If this is a legitimate budget block error, re-throw it to stop the save
        if (validationError?.message?.startsWith("BUDGET_BLOCK:")) {
          throw validationError;
        }
        // For unexpected technical errors (network issues, JSON parsing, etc.), 
        // show warning and allow to continue with reservation
        console.warn("[Budget] Unexpected error during validation:", validationError);
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
      const projectId = parseInt(data.project_id);

      // Validate numeric project_id
      if (isNaN(projectId)) {
        throw new Error("Μη έγκυρο ID έργου. Παρακαλώ επιλέξτε έργο.");
      }

      console.log(
        "[PAYLOAD DEBUG] expenditure_type value:",
        data.expenditure_type,
      );
      console.log(
        "[PAYLOAD DEBUG] EKTOS_EDRAS_TYPE constant:",
        EKTOS_EDRAS_TYPE,
      );
      console.log(
        "[PAYLOAD DEBUG] Are they equal?",
        data.expenditure_type === EKTOS_EDRAS_TYPE,
      );

      // Validate and get for_yl title if selected
      // Only include for_yl if it belongs to the available options for the selected unit
      const availableForYlForPayload = forYlData?.filter(
        (fy: any) => fy.monada_id && String(fy.monada_id) === String(data.unit)
      ) || [];
      // Normalize for_yl_id to number for consistent comparison
      // Handle both number and string types (form may return either)
      const normalizedForYlId = data.for_yl_id != null && String(data.for_yl_id) !== "" 
        ? Number(data.for_yl_id) 
        : null;
      // Find matching for_yl using normalized numeric comparison
      const selectedForYl = normalizedForYlId != null
        ? availableForYlForPayload.find((fy: any) => {
            const fyId = typeof fy.id === 'string' ? Number(fy.id) : fy.id;
            return fyId === normalizedForYlId;
          })
        : null;
      // Only include for_yl if valid (belongs to available options for selected unit)
      // If selectedForYl is null (not found in filtered options), submit null to clear stale values
      const validForYlId = selectedForYl ? normalizedForYlId : null;

      const payload = {
        unit: data.unit,
        project_id: projectId, // Convert to numeric ID for v2 endpoint
        project_mis: projectForSubmission.mis,
        region: data.region,
        for_yl_id: validForYlId,
        for_yl_title: selectedForYl?.title || null,
        expenditure_type: data.expenditure_type,
        recipients: data.recipients.map((r) => {
          // For housing allowance, ensure proper data structure for export
          if (
            data.expenditure_type === HOUSING_ALLOWANCE_TYPE &&
            r.installmentAmounts
          ) {
            // Calculate total from quarter amounts
            const quarterTotal = Object.values(r.installmentAmounts).reduce(
              (sum, amount) => sum + (amount || 0),
              0,
            );

            // Convert quarter names to numbers for storage
            const quarterNumbers = r.installments.map((q) =>
              q.replace("ΤΡΙΜΗΝΟ ", ""),
            );

            // Rebuild installmentAmounts from ONLY the selected installments
            // This prevents stale data from previously selected but now unselected installments
            const quarterAmountsWithNumbers: Record<string, number> = {};
            r.installments.forEach((installment) => {
              const quarterNum = installment.replace("ΤΡΙΜΗΝΟ ", "");
              const amount = r.installmentAmounts?.[installment];
              if (typeof amount === "number" && amount > 0) {
                quarterAmountsWithNumbers[quarterNum] = amount;
              }
            });

            // For housing allowance, use numeric quarter format for storage
            // Validation ensures firstname, lastname, afm are present, so trim() is safe
            return {
              firstname: r.firstname.trim(),
              lastname: r.lastname.trim(),
              fathername: r.fathername?.trim() || "",
              afm: r.afm.trim(),
              amount: quarterTotal,
              secondary_text: r.secondary_text?.trim() || "",
              installment:
                quarterNumbers.length === 1
                  ? quarterNumbers[0]
                  : `${quarterNumbers.length} τρίμηνα`,
              installments: quarterNumbers,
              installmentAmounts: quarterAmountsWithNumbers,
            };
          }

          // For ΕΚΤΟΣ ΕΔΡΑΣ, include employee-based payment fields
          if (data.expenditure_type === EKTOS_EDRAS_TYPE) {
            // Validation ensures firstname, lastname, afm are present, so trim() is safe
            return {
              firstname: r.firstname.trim(),
              lastname: r.lastname.trim(),
              fathername: r.fathername?.trim() || "",
              afm: r.afm.trim(),
              employee_id: r.employee_id,
              month: r.month,
              days: r.days,
              daily_compensation: r.daily_compensation || 0,
              accommodation_expenses: r.accommodation_expenses || 0,
              kilometers_traveled: r.kilometers_traveled || 0,
              tickets_tolls_rental: r.tickets_tolls_rental || 0,
              tickets_tolls_rental_entries:
                r.tickets_tolls_rental_entries || [], // Include array of entries
              net_payable:
                r.net_payable !== undefined && r.net_payable !== null
                  ? r.net_payable
                  : parseFloat(r.amount.toString()),
              amount: parseFloat(r.amount.toString()),
              secondary_text: r.secondary_text?.trim() || "",
              installment:
                r.installment ||
                (r.installments && r.installments[0]) ||
                "ΕΦΑΠΑΞ",
              installments: r.installments,
              // Rebuild installmentAmounts from ONLY selected installments to avoid stale data
              installmentAmounts: Object.fromEntries(
                r.installments
                  .map((inst) => [inst, r.installmentAmounts?.[inst]])
                  .filter(
                    ([, amount]) => typeof amount === "number" && amount > 0,
                  ),
              ),
            };
          }

          // Standard structure for other expenditure types
          // Validation ensures firstname, lastname, afm are present, so trim() is safe
          return {
            firstname: r.firstname.trim(),
            lastname: r.lastname.trim(),
            fathername: r.fathername?.trim() || "",
            afm: r.afm.trim(),
            amount: parseFloat(r.amount.toString()),
            secondary_text: r.secondary_text?.trim() || "",
            installment:
              r.installment ||
              (r.installments && r.installments[0]) ||
              "ΕΦΑΠΑΞ",
            installments: r.installments,
            // Rebuild installmentAmounts from ONLY selected installments to avoid stale data
            installmentAmounts: Object.fromEntries(
              r.installments
                .map((inst) => [inst, r.installmentAmounts?.[inst]])
                .filter(
                  ([, amount]) => typeof amount === "number" && amount > 0,
                ),
            ),
          };
        }),
        total_amount: totalAmount,
        status: "draft",
        attachments: data.selectedAttachments || [],
        esdian:
          data.esdian_fields && data.esdian_fields.length > 0
            ? data.esdian_fields.filter((field) => field && field.trim() !== "")
            : [data.esdian_field1 || "", data.esdian_field2 || ""].filter(
                (field) => field.trim() !== "",
              ),
        director_signature: data.director_signature || null,
        // BUDGET FLAG: Set to true if document is saved while exceeding Κατανομή έτους
        // This blocks DOCX export until χρηματοδότηση is approved
        needs_xrimatodotisi: localBudgetValidation?.budgetType === 'katanomi' || false,
      };

      // Debug logging for ΕΚΤΟΣ ΕΔΡΑΣ
      if (data.expenditure_type === EKTOS_EDRAS_TYPE) {
        console.log(
          "[ΕΚΤΟΣ ΕΔΡΑΣ] DEBUG - Full payload:",
          JSON.stringify(payload, null, 2),
        );
        console.log(
          "[ΕΚΤΟΣ ΕΔΡΑΣ] DEBUG - Recipients array:",
          payload.recipients,
        );
        payload.recipients.forEach((r, idx) => {
          console.log(`[ΕΚΤΟΣ ΕΔΡΑΣ] DEBUG - Recipient ${idx} month:`, r.month);
          console.log(
            `[ΕΚΤΟΣ ΕΔΡΑΣ] DEBUG - Recipient ${idx} employee_id:`,
            r.employee_id,
          );
        });
      }

      // Attempt document creation with v2 API endpoint
      try {
        console.log(
          "[HandleSubmit] About to make API call to /api/documents/v2 with payload:",
          payload,
        );
        console.log("[HandleSubmit] Making API request now...");

        // Use the v2-documents endpoint which handles document creation with proper error handling
        const response = (await apiRequest("/api/documents/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })) as { id?: number; message?: string; budget_warning?: boolean; budget_warning_message?: string; budget_type?: string };

        console.log("[HandleSubmit] API request completed successfully!");

        console.log("[HandleSubmit] API response received:", response);
        console.log(
          "[HandleSubmit] Response type:",
          typeof response,
          "Has ID:",
          !!response?.id,
        );

        if (!response || typeof response !== "object" || !response.id) {
          throw new Error(
            "Σφάλμα δημιουργίας εγγράφου: Μη έγκυρη απάντηση από τον διακομιστή",
          );
        }

        // Success logging removed for cleaner console output

        // Invalidate queries and show success message before returning
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/documents"] }),
          queryClient.invalidateQueries({ queryKey: ["documents"] }),
          queryClient.invalidateQueries({ queryKey: ["budget"] }),
          queryClient.invalidateQueries({
            queryKey: ["budget", data.project_id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["budget-validation", data.project_id, totalAmount],
          }),
        ]);

        // Show appropriate toast based on budget status
        if (response.budget_warning && response.budget_type === 'katanomi') {
          // Document saved with budget warning (κατανομή exceeded)
          toast({
            title: "Έγγραφο Αποθηκεύτηκε με Προειδοποίηση",
            description: "Υπέρβαση κατανομής έτους - Απαιτείται χρηματοδότηση. Το έγγραφο αποθηκεύτηκε επιτυχώς.",
            variant: "warning",
          });
        } else {
          toast({
            title: "Επιτυχία",
            description: "Το έγγραφο δημιουργήθηκε επιτυχώς",
          });
        }

        // Reset entire form after successful document creation
        // Convert user's unit ID to unit name for form default
        let defaultUnit = "";
        if (userUnitIds.length > 0 && units.length > 0) {
          const userUnitData = units.find(
            (unit: any) => unit.id === userUnitIds[0],
          );
          defaultUnit = userUnitData?.name || "";
        }

        form.reset({
          unit: defaultUnit,
          project_id: "",
          region: "",
          expenditure_type: "",
          recipients: [],
          status: "draft",
          selectedAttachments: [],
          esdian_fields: [""],
          esdian_field1: "",
          esdian_field2: "",
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
          esdian_fields: [""],
          esdian_field1: "",
          esdian_field2: "",
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
        // Error logging removed for cleaner console output
        throw new Error(
          error instanceof Error
            ? error.message
            : "Αποτυχία δημιουργίας εγγράφου. Παρακαλώ προσπαθήστε ξανά αργότερα.",
        );
      }

      // Nothing needed here as the document creation logic
      // and dialog closing are all handled in the try-catch block above
    } catch (error: any) {
      // Skip showing toast for BUDGET_BLOCK errors - they already showed a specific toast
      if (!error?.message?.startsWith("BUDGET_BLOCK:")) {
        toast({
          title: "Σφάλμα",
          description:
            error instanceof Error
              ? error.message
              : "Αποτυχία δημιουργίας εγγράφου",
          variant: "destructive",
        });
      }
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
        // ΕΚΤΟΣ ΕΔΡΑΣ fields with defaults
        employee_id: undefined,
        month: "",
        days: 1,
        daily_compensation: 0,
        accommodation_expenses: 0,
        kilometers_traveled: 0,
        price_per_km: DEFAULT_PRICE_PER_KM,
        tickets_tolls_rental: 0,
        tickets_tolls_rental_entries: [0], // Initialize with one empty entry
        has_2_percent_deduction: false,
      },
    ]);
  };

  const removeRecipient = (index: number) => {
    devLog("RemoveRecipient", "Removing at index:", index);
    const currentRecipients = form.watch("recipients") || [];
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
    } else if (userUnitIds.length === 1 && units?.length > 0) {
      // If user has only one assigned unit, find its matching unit object and select it
      const userUnitId = userUnitIds[0] || "";
      const matchingUnit = units.find((unit) => unit.id === userUnitId);
      if (matchingUnit) {
        // Auto-selected user's unit
        form.setValue("unit", matchingUnit.id);
      }
    }
  }, [units?.length, user?.units?.[0], open]); // Stabilized dependencies

  // Geographic data query using the new normalized structure
  const { data: geographicData, isLoading: geographicDataLoading } = useQuery({
    queryKey: ["geographic-data"],
    queryFn: async () => {
      const response = await apiRequest("/api/geographic-data");
      console.log("[CreateDocument] Geographic data loaded:", response);
      return response;
    },
  });

  // Project-specific geographic areas
  const { data: projectGeographicAreas = [], isLoading: regionsLoading } =
    useQuery({
      queryKey: ["project-geographic-areas", selectedProjectId],
      queryFn: async () => {
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

          console.log("Fetching geographic areas for project:", {
            id: selectedProjectId,
          });

          // Fetch project complete data which includes geographic relationships
          const response = await apiRequest(
            `/api/projects/${encodeURIComponent(project.id || "")}/complete`,
          );

          if (!response || !geographicData) {
            return [];
          }

          // Extract project-specific geographic areas (correct nested structure)
          const projectRegions =
            (response as any)?.projectGeographicData?.regions || [];
          const projectUnits =
            (response as any)?.projectGeographicData?.regionalUnits || [];
          const projectMunicipalities =
            (response as any)?.projectGeographicData?.municipalities || [];

          console.log("[CreateDocument] Project-specific geographic data:", {
            regions: projectRegions.length,
            units: projectUnits.length,
            municipalities: projectMunicipalities.length,
          });

          // Debug: Check actual data structure and duplicates
          console.log("[CreateDocument] Sample data structures:", {
            sampleRegion: projectRegions[0],
            sampleUnit: projectUnits[0],
            sampleMunicipality: projectMunicipalities[0],
          });

          console.log("[CreateDocument] All raw data for duplicate analysis:", {
            allRegions: projectRegions,
            allUnits: projectUnits,
            allMunicipalities: projectMunicipalities,
          });

          // Return structured data for smart hierarchical selection
          // Backend returns joined data: { region_code: "...", regions: { code: "...", name: "..." } }
          // Remove duplicates by using a Set based on code
          const uniqueRegions = Array.from(
            new Map(
              projectRegions.map((item: any) => [
                item.region_code || item.regions?.code,
                item,
              ]),
            ).values(),
          );

          const uniqueUnits = Array.from(
            new Map(
              projectUnits.map((item: any) => [
                item.unit_code || item.regional_units?.code,
                item,
              ]),
            ).values(),
          );

          const uniqueMunicipalities = Array.from(
            new Map(
              projectMunicipalities.map((item: any) => [
                item.muni_code || item.municipalities?.code,
                item,
              ]),
            ).values(),
          );

          console.log("[CreateDocument] After deduplication:", {
            regions: uniqueRegions.length,
            units: uniqueUnits.length,
            municipalities: uniqueMunicipalities.length,
          });

          const smartGeographicData = {
            availableRegions: uniqueRegions.map((item: any) => ({
              id: `region-${item.region_code || item.regions?.code}`,
              code: item.region_code || item.regions?.code,
              name: item.regions?.name || item.name,
              type: "region",
            })),
            availableUnits: uniqueUnits.map((item: any) => ({
              id: `unit-${item.unit_code || item.regional_units?.code}`,
              code: item.unit_code || item.regional_units?.code,
              name: item.regional_units?.name || item.name,
              type: "regional_unit",
              region_code: item.regional_units?.region_code,
            })),
            availableMunicipalities: uniqueMunicipalities.map((item: any) => ({
              id: `municipality-${item.muni_code || item.municipalities?.code}`,
              code: item.muni_code || item.municipalities?.code,
              name: item.municipalities?.name || item.name,
              type: "municipality",
              unit_code: item.municipalities?.unit_code,
            })),
          };

          console.log(
            "[CreateDocument] Smart geographic data:",
            smartGeographicData,
          );
          return smartGeographicData;
        } catch (error) {
          console.error("Error fetching project geographic areas:", error);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης περιοχών",
            variant: "destructive",
          });
          return [];
        }
      },
      enabled:
        Boolean(selectedProjectId) && projects.length > 0 && !!geographicData,
    });

  // Smart cascading selection state
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("");
  const [selectedMunicipalityId, setSelectedMunicipalityId] =
    useState<string>("");

  // Computed available options based on current selections
  const availableRegions =
    (projectGeographicAreas as any)?.availableRegions || [];
  const availableUnits = selectedRegionFilter
    ? ((projectGeographicAreas as any)?.availableUnits || []).filter(
        (unit: any) => unit.region_code === selectedRegionFilter,
      )
    : (projectGeographicAreas as any)?.availableUnits || [];
  const availableMunicipalities = selectedUnitFilter
    ? ((projectGeographicAreas as any)?.availableMunicipalities || []).filter(
        (municipality: any) => municipality.unit_code === selectedUnitFilter,
      )
    : selectedRegionFilter
      ? ((projectGeographicAreas as any)?.availableMunicipalities || []).filter(
          (municipality: any) => {
            const unit = (
              (projectGeographicAreas as any)?.availableUnits || []
            ).find((u: any) => u.code === municipality.unit_code);
            return unit?.region_code === selectedRegionFilter;
          },
        )
      : (projectGeographicAreas as any)?.availableMunicipalities || [];

  // All available options for the region dropdown (flattened for backward compatibility)
  const regions = [
    ...availableRegions,
    ...availableUnits,
    ...availableMunicipalities,
  ];

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
        selectedAttachments: formValues.selectedAttachments,
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
          
          // Budget validation check - ONLY block if ΠΙΣΤΩΣΗ is exceeded (hard block)
          // Κατανομή exceeded allows proceeding but blocks DOCX generation later
          if (localBudgetValidation?.budgetType === 'pistosi') {
            toast({
              title: "Υπέρβαση Πίστωσης",
              description: "Δεν μπορείτε να συνεχίσετε. Το ποσό υπερβαίνει την ετήσια πίστωση. Παρακαλώ αιτηθείτε ανακατανομή.",
              variant: "destructive",
            });
            return;
          }
          
          // Show warning for katanomi but allow proceeding
          if (localBudgetValidation?.budgetType === 'katanomi') {
            toast({
              title: "Προειδοποίηση Κατανομής",
              description: "Το ποσό υπερβαίνει την κατανομή έτους. Μπορείτε να αποθηκεύσετε αλλά δεν θα μπορέσετε να εξάγετε DOCX μέχρι να εγκριθεί η χρηματοδότηση.",
              variant: "warning",
            });
            // Don't return - allow proceeding
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
      selectedAttachments: formValues.selectedAttachments,
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

                            // CRITICAL: Also update unitAutoSelectionRef to track manual selections
                            // This ensures the selection persists through session refresh
                            unitAutoSelectionRef.current = {
                              hasSelected: true,
                              selectedUnit: value,
                            };

                            // Always save the form context after unit change
                            const formValues = form.getValues();
                            // Clear for_yl when unit changes (for_yl options are unit-specific)
                            form.setValue("for_yl_id", null);
                            updateFormData({
                              ...formValues,
                              unit: value,
                              // Clear project and for_yl when unit changes to avoid invalid combinations
                              project_id: "",
                              for_yl_id: null,
                            });

                            // Force a refresh of projects data
                            setTimeout(() => {
                              // Invalidate projects to force a refresh with the new unit
                              queryClient.invalidateQueries({
                                queryKey: ["projects", value],
                              });
                            }, 100);
                          } catch (error) {
                            console.error(
                              "[UnitSelect] Error during unit selection:",
                              error,
                            );
                          }
                        }}
                        value={field.value}
                        disabled={unitsLoading || (units && units.length <= 1)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                units && units.length === 1
                                  ? "Αυτόματη επιλογή μονάδας"
                                  : "Επιλέξτε μονάδα"
                              }
                            >
                              {field.value &&
                              Array.isArray(units) &&
                              units.length > 0
                                ? units.find((u: any) => u.id === field.value)
                                    ?.name || field.value
                                : undefined}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(units) && units.length > 0 ? (
                            units.map((unit: any) => (
                              <SelectItem
                                key={unit.id || unit.name}
                                value={unit.id}
                              >
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
                      {field.value && (
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          Επιλεγμένη μονάδα:{" "}
                          {Array.isArray(units) && units.length > 0
                            ? units.find((u: any) => u.id === field.value)
                                ?.name ||
                              (userUnitIds.length === 1
                                ? units.find((u) => u.id === userUnitIds[0])
                                    ?.name || field.value
                                : field.value)
                            : userUnitIds.length === 1
                              ? units.find((u) => u.id === userUnitIds[0])
                                  ?.name || field.value
                              : field.value}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Budget debug logging removed for production */}

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
                                project_id: String(project.id),
                              });

                              // Project selected successfully
                            } else {
                              // Clear selection
                              field.onChange("");
                              updateFormData({
                                ...formData,
                                project_id: "",
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

                  {/* Subproject Selection */}
                  {/* <FormField
                    control={form.control}
                    name="subproject_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Υποέργο (Προαιρετικό)</FormLabel>
                        <SubprojectSelect
                          projectId={form.watch("project_id")}
                          onSubprojectSelect={(subproject) => {
                            if (subproject) {
                              field.onChange(String(subproject.id));
                              updateFormData({
                                ...formData,
                                subproject_id: String(subproject.id),
                              });
                            } else {
                              field.onChange("");
                              updateFormData({
                                ...formData,
                                subproject_id: "",
                              });
                            }
                          }}
                          selectedSubprojectId={field.value}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  /> */}

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

                  {/* Smart Hierarchical Geographic Selection */}
                  {(availableRegions.length > 0 ||
                    availableUnits.length > 0 ||
                    availableMunicipalities.length > 0) && (
                    <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                      <h3 className="text-xs font-medium text-gray-700">
                        Γεωγραφική Περιοχή Διαβιβαστίκου
                      </h3>

                      {/* Filter by Region */}
                      {availableRegions.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium text-gray-600 whitespace-nowrap min-w-[140px]">
                            Φίλτρο Περιφέρειας
                          </label>
                          <div className="flex-1">
                            <Select
                              value={selectedRegionFilter}
                              onValueChange={(value) => {
                                const regionCode = value === "all" ? "" : value;
                                setSelectedRegionFilter(regionCode);
                                setSelectedUnitFilter(""); // Reset unit filter when region changes

                                // Set as final selected region for document (last hierarchy choice)
                                if (regionCode) {
                                  const selectedRegionName =
                                    availableRegions.find(
                                      (r: any) => r.code === regionCode,
                                    )?.name || "";
                                  // Build hierarchy: Region|| (region only, no unit or municipality)
                                  const regionHierarchy = `${selectedRegionName}||`;
                                  form.setValue("region", regionHierarchy);
                                  setSelectedMunicipalityId(""); // Clear municipality selection
                                  console.log(
                                    "[Geographic] Selected region as final choice:",
                                    regionHierarchy,
                                  );
                                } else {
                                  form.setValue("region", "");
                                  setSelectedMunicipalityId("");
                                }
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Όλες οι περιφέρειες" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  Όλες οι περιφέρειες
                                </SelectItem>
                                {availableRegions.map((region: any) => (
                                  <SelectItem
                                    key={`region-${region.code}`}
                                    value={region.code}
                                  >
                                    {region.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Filter by Regional Unit */}
                      {availableUnits.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium text-gray-600 whitespace-nowrap min-w-[140px]">
                            Φίλτρο Περιφερειακής Ενότητας
                            {selectedRegionFilter && (
                              <span className="text-gray-500">
                                (στην{" "}
                                {
                                  availableRegions.find(
                                    (r: any) => r.code === selectedRegionFilter,
                                  )?.name
                                }
                                )
                              </span>
                            )}
                          </label>
                          <div className="flex-1">
                            <Select
                              value={selectedUnitFilter}
                              onValueChange={(value) => {
                                const unitCode = value === "all" ? "" : value;
                                setSelectedUnitFilter(unitCode);

                                // Set as final selected region for document (last hierarchy choice)
                                if (unitCode) {
                                  const selectedUnit = availableUnits.find(
                                    (u: any) => u.code === unitCode,
                                  );

                                  if (selectedUnit) {
                                    let regionHierarchy = selectedUnit.name;

                                    // Auto-complete: Fill region filter
                                    if (selectedUnit.region_code) {
                                      setSelectedRegionFilter(
                                        selectedUnit.region_code,
                                      );

                                      // Find the region name to build hierarchy
                                      const parentRegion =
                                        availableRegions.find(
                                          (r: any) =>
                                            r.code === selectedUnit.region_code,
                                        );

                                      if (parentRegion) {
                                        // Build hierarchy: Region|RegionalUnit|
                                        regionHierarchy = `${parentRegion.name}|${selectedUnit.name}|`;
                                      } else {
                                        // Fallback: if no region found, use unit only
                                        regionHierarchy = `|${selectedUnit.name}|`;
                                      }
                                    }

                                    form.setValue("region", regionHierarchy);
                                    setSelectedMunicipalityId(""); // Clear municipality selection
                                    console.log(
                                      "[Geographic] Selected regional unit as final choice:",
                                      regionHierarchy,
                                    );
                                  }
                                } else if (!selectedRegionFilter) {
                                  form.setValue("region", "");
                                  setSelectedMunicipalityId("");
                                }
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Όλες οι περιφερειακές ενότητες" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  Όλες οι περιφερειακές ενότητες
                                </SelectItem>
                                {availableUnits.map((unit: any) => (
                                  <SelectItem
                                    key={`unit-${unit.code}`}
                                    value={unit.code}
                                  >
                                    {unit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Final Municipality Selection */}
                      {availableMunicipalities.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium whitespace-nowrap min-w-[140px]">
                            Τελική Επιλογή Δήμου/Κοινότητας
                            {(selectedRegionFilter || selectedUnitFilter) && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({availableMunicipalities.length} διαθέσιμες
                                επιλογές)
                              </span>
                            )}
                          </label>
                          <div className="flex-1">
                            <Select
                              value={selectedMunicipalityId}
                              onValueChange={(value) => {
                                // Set as final selected region for document (last hierarchy choice - municipality)
                                const selectedMunicipality =
                                  availableMunicipalities.find(
                                    (m: any) => m.id === value,
                                  );
                                if (selectedMunicipality) {
                                  // Auto-complete: Find the parent unit and region
                                  const parentUnit = (
                                    (projectGeographicAreas as any)
                                      ?.availableUnits || []
                                  ).find(
                                    (u: any) =>
                                      u.code === selectedMunicipality.unit_code,
                                  );

                                  let regionHierarchy =
                                    selectedMunicipality.name;

                                  if (parentUnit) {
                                    // Auto-fill regional unit filter
                                    setSelectedUnitFilter(parentUnit.code);

                                    // Auto-fill region filter
                                    if (parentUnit.region_code) {
                                      setSelectedRegionFilter(
                                        parentUnit.region_code,
                                      );

                                      // Find the region name to build full hierarchy
                                      const parentRegion =
                                        availableRegions.find(
                                          (r: any) =>
                                            r.code === parentUnit.region_code,
                                        );

                                      if (parentRegion) {
                                        // Build hierarchy: Region|RegionalUnit|Municipality
                                        regionHierarchy = `${parentRegion.name}|${parentUnit.name}|${selectedMunicipality.name}`;
                                      } else {
                                        // Fallback: if no region found, use unit and municipality
                                        regionHierarchy = `|${parentUnit.name}|${selectedMunicipality.name}`;
                                      }
                                    }
                                  }

                                  form.setValue("region", regionHierarchy);
                                  setSelectedMunicipalityId(value); // Store ID for dropdown
                                  console.log(
                                    "[Geographic] Selected municipality as final choice:",
                                    regionHierarchy,
                                  );
                                }
                              }}
                              disabled={regionsLoading}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Επιλέξτε δήμο/κοινότητα" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {availableMunicipalities
                                  .filter(
                                    (municipality: any) =>
                                      municipality.code && municipality.name,
                                  )
                                  .map((municipality: any) => (
                                    <SelectItem
                                      key={`municipality-${municipality.code}`}
                                      value={municipality.id}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {municipality.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          Δήμος/Κοινότητα
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                {availableMunicipalities.length === 0 && (
                                  <SelectItem
                                    value="no-municipalities"
                                    disabled
                                  >
                                    Δεν υπάρχουν διαθέσιμοι δήμοι
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Show current selection path */}
                      {(selectedRegionFilter ||
                        selectedUnitFilter ||
                        selectedMunicipalityId) && (
                        <div className="text-xs text-gray-500 bg-blue-50 p-1.5 rounded mt-1">
                          <span className="text-gray-600">
                            Επιλεγμένη περιοχή:
                          </span>
                          {selectedRegionFilter && (
                            <span className="ml-1 font-medium">
                              {
                                availableRegions.find(
                                  (r: any) => r.code === selectedRegionFilter,
                                )?.name
                              }
                            </span>
                          )}
                          {selectedUnitFilter && (
                            <span className="ml-1 font-medium">
                              {selectedRegionFilter && " › "}
                              {
                                availableUnits.find(
                                  (u: any) => u.code === selectedUnitFilter,
                                )?.name
                              }
                            </span>
                          )}
                          {selectedMunicipalityId && (
                            <span className="ml-1 font-medium">
                              {(selectedRegionFilter || selectedUnitFilter) &&
                                " › "}
                              {
                                availableMunicipalities.find(
                                  (m: any) => m.id === selectedMunicipalityId,
                                )?.name
                              }
                            </span>
                          )}
                        </div>
                      )}
                    </div>
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

                {/* ΠΙΣΤΩΣΗ EXCEEDED - Hard block, cannot proceed, needs Ανακατανομή */}
                {localBudgetValidation?.budgetType === 'pistosi' && currentAmount > 0 && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-800 font-semibold text-base">
                          Υπέρβαση Πίστωσης - Δεν Μπορείτε να Συνεχίσετε
                        </h4>
                        <p className="text-red-700 text-sm mt-2">
                          Το ποσό <strong>{currentAmount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</strong> υπερβαίνει 
                          την ετήσια πίστωση ({Number(budgetData?.ethsia_pistosi || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}).
                        </p>
                        <p className="text-red-600 text-sm mt-2 font-medium">
                          Πρέπει να ζητήσετε ανακατανομή προϋπολογισμού για να συνεχίσετε.
                        </p>
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/notifications/request-reallocation', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    project_id: selectedProjectId,
                                    request_type: 'ανακατανομή',
                                    requested_amount: currentAmount,
                                    available_budget: Number(budgetData?.available_budget) || 0,
                                    shortage: currentAmount - (Number(budgetData?.available_budget) || 0),
                                  })
                                });
                                if (response.ok) {
                                  toast({
                                    title: "Αίτημα Ανακατανομής Απεστάλη",
                                    description: "Το αίτημα στάλθηκε στον διαχειριστή για έγκριση.",
                                  });
                                } else {
                                  throw new Error('Failed');
                                }
                              } catch (error) {
                                toast({ title: "Σφάλμα", description: "Αποτυχία αποστολής.", variant: "destructive" });
                              }
                            }}
                          >
                            <svg className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            Αίτημα Ανακατανομής
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ΚΑΤΑΝΟΜΗ ΕΤΟΥΣ EXCEEDED - Soft block, can save but no DOCX, needs Χρηματοδότηση */}
                {localBudgetValidation?.budgetType === 'katanomi' && currentAmount > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="h-6 w-6 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-amber-800 font-semibold text-base">
                          Υπέρβαση Κατανομής Έτους - Απαιτείται Χρηματοδότηση
                        </h4>
                        <p className="text-amber-700 text-sm mt-2">
                          Το ποσό <strong>{currentAmount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</strong> υπερβαίνει 
                          την κατανομή έτους ({Number(budgetData?.katanomes_etous || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}).
                        </p>
                        <p className="text-amber-600 text-sm mt-2">
                          <strong>Μπορείτε να αποθηκεύσετε το έγγραφο</strong>, αλλά δεν θα μπορέσετε να εξάγετε το DOCX μέχρι να εγκριθεί η χρηματοδότηση.
                        </p>
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-white border-amber-400 text-amber-700 hover:bg-amber-50"
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/notifications/request-reallocation', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    project_id: selectedProjectId,
                                    request_type: 'χρηματοδότηση',
                                    requested_amount: currentAmount,
                                    available_budget: Number(budgetData?.katanomes_etous) || 0,
                                    shortage: currentAmount - (Number(budgetData?.katanomes_etous) || 0) + (Number(budgetData?.user_view) || 0),
                                  })
                                });
                                if (response.ok) {
                                  toast({
                                    title: "Αίτημα Χρηματοδότησης Απεστάλη",
                                    description: "Το αίτημα στάλθηκε στον διαχειριστή για έγκριση.",
                                  });
                                } else {
                                  throw new Error('Failed');
                                }
                              } catch (error) {
                                toast({ title: "Σφάλμα", description: "Αποτυχία αποστολής.", variant: "destructive" });
                              }
                            }}
                          >
                            <svg className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            Αίτημα Χρηματοδότησης
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generic budget exceeded warning (fallback when budgetType not determined) */}
                {localBudgetValidation && !localBudgetValidation.canCreate && !localBudgetValidation.budgetType && currentAmount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-800 font-medium text-sm">
                          Υπέρβαση Προϋπολογισμού
                        </h4>
                        <p className="text-red-700 text-sm mt-1">
                          {localBudgetValidation.message || 'Το ποσό υπερβαίνει τον διαθέσιμο προϋπολογισμό.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                          <div className="md:col-span-2 md:row-span-1">
                            <FormField
                              control={form.control}
                              name={`recipients.${index}.firstname`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Όνομα"
                                      autoComplete="off"
                                      data-testid={`input-recipient-${index}-firstname`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Επώνυμο */}
                          <div className="md:col-span-2 md:row-span-1">
                            <FormField
                              control={form.control}
                              name={`recipients.${index}.lastname`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Επώνυμο"
                                      autoComplete="off"
                                      data-testid={`input-recipient-${index}-lastname`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Πατρώνυμο */}
                          <div className="md:col-span-2 md:row-span-1">
                            <FormField
                              control={form.control}
                              name={`recipients.${index}.fathername`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Πατρώνυμο"
                                      autoComplete="off"
                                      data-testid={`input-recipient-${index}-fathername`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* ΑΦΜ με έξυπνη αυτόματη συμπλήρωση */}
                          <div className="md:col-span-2 md:row-span-1">
                            <SimpleAFMAutocomplete
                              expenditureType={
                                form.getValues("expenditure_type") || ""
                              }
                              value={
                                form.watch(`recipients.${index}.afm`) || ""
                              }
                              userUnit={selectedUnit || ""}
                              projectNa853={selectedProject?.mis || ""}
                              onChange={(value) => {
                                // Update the AFM field in the form when user types
                                form.setValue(`recipients.${index}.afm`, value);
                              }}
                              onSelectPerson={(personData) => {
                                if (personData) {
                                  console.log(
                                    "[AFMAutocomplete] Selection made for index:",
                                    index,
                                    "personData:",
                                    personData,
                                  );

                                  // COMPLETELY BLOCK DIALOG RESETS DURING AUTOCOMPLETE
                                  setIsDialogInitializing(true);
                                  dialogInitializationRef.current.isInitializing =
                                    false;
                                  setIsFormSyncing(true);

                                  // Check if this is ΕΚΤΟΣ ΕΔΡΑΣ (employee) vs beneficiary
                                  const isEktosEdras =
                                    form.getValues("expenditure_type") ===
                                    EKTOS_EDRAS_TYPE;

                                  // Use smart autocomplete data if available from enhanced AFM component
                                  const enhancedData = personData as any;
                                  let installmentsList: string[] = ["ΕΦΑΠΑΞ"];
                                  let installmentAmounts: Record<
                                    string,
                                    number
                                  > = { ΕΦΑΠΑΞ: 0 };
                                  let totalAmount = 0;

                                  console.log(
                                    "[AFMAutocomplete] Enhanced person data:",
                                    enhancedData,
                                    "isEktosEdras:",
                                    isEktosEdras,
                                  );

                                  // For ΕΚΤΟΣ ΕΔΡΑΣ (employees), skip installment logic entirely
                                  if (!isEktosEdras) {
                                    // Check if we have smart autocomplete suggestions
                                    if (
                                      enhancedData.suggestedInstallments &&
                                      enhancedData.suggestedInstallmentAmounts
                                    ) {
                                      installmentsList =
                                        enhancedData.suggestedInstallments;
                                      installmentAmounts =
                                        enhancedData.suggestedInstallmentAmounts;
                                      totalAmount =
                                        enhancedData.suggestedAmount || 0;
                                    }
                                    // Fallback to legacy structure if no smart suggestions
                                    else if (
                                      enhancedData.oikonomika &&
                                      typeof enhancedData.oikonomika ===
                                        "object"
                                    ) {
                                      console.log(
                                        "[AFMAutocomplete] Fallback to legacy extraction from JSONB oikonomika",
                                      );

                                      // Get the current expenditure type to match against oikonomika keys
                                      const currentExpenditureType =
                                        form.getValues("expenditure_type");

                                      // Find matching expenditure type in oikonomika
                                      for (const [
                                        expType,
                                        paymentsList,
                                      ] of Object.entries(
                                        enhancedData.oikonomika,
                                      )) {
                                        if (
                                          Array.isArray(paymentsList) &&
                                          paymentsList.length > 0
                                        ) {
                                          const firstPayment = paymentsList[0];

                                          if (
                                            firstPayment &&
                                            typeof firstPayment === "object"
                                          ) {
                                            // Extract amount (handle Greek number formatting)
                                            let amountStr = String(
                                              firstPayment.amount || "0",
                                            );

                                            // Handle Greek formatting (periods as thousands separators)
                                            if (
                                              amountStr.includes(".") &&
                                              amountStr.split(".").length === 3
                                            ) {
                                              const parts =
                                                amountStr.split(".");
                                              amountStr =
                                                parts[0] +
                                                parts[1] +
                                                "." +
                                                parts[2];
                                            } else if (
                                              amountStr.includes(",")
                                            ) {
                                              amountStr = amountStr.replace(
                                                ",",
                                                ".",
                                              );
                                            }

                                            const amount =
                                              parseEuropeanNumber(amountStr) ||
                                              0;
                                            const installments =
                                              firstPayment.installment || [
                                                "ΕΦΑΠΑΞ",
                                              ];

                                            if (
                                              Array.isArray(installments) &&
                                              installments.length > 0
                                            ) {
                                              installmentsList = installments;
                                              totalAmount = amount;

                                              // Create installment amounts object
                                              installmentAmounts = {};
                                              if (installments.length === 1) {
                                                installmentAmounts[
                                                  installments[0]
                                                ] = amount;
                                              } else {
                                                const amountPerInstallment =
                                                  amount / installments.length;
                                                installments.forEach((inst) => {
                                                  installmentAmounts[inst] =
                                                    amountPerInstallment;
                                                });
                                              }

                                              console.log(
                                                "[AFMAutocomplete] Legacy extraction:",
                                                installmentsList,
                                                "amounts:",
                                                installmentAmounts,
                                              );
                                              break;
                                            }
                                          }
                                        }
                                      }
                                    }
                                    // Fallback to old structure for employees
                                    else {
                                      const installmentValue =
                                        enhancedData.installment || "";
                                      const amountValue =
                                        parseEuropeanNumber(
                                          enhancedData.amount || "0",
                                        ) || 0;

                                      if (installmentValue && amountValue) {
                                        installmentsList = [installmentValue];
                                        installmentAmounts = {
                                          [installmentValue]: amountValue,
                                        };
                                        totalAmount = amountValue;
                                      }
                                    }
                                  } // End of if (!isEktosEdras) - installment logic

                                  // Update the recipient data directly in the current form state
                                  const currentRecipients =
                                    form.getValues("recipients");

                                  currentRecipients[index] = {
                                    ...currentRecipients[index],
                                    firstname: personData.name || "",
                                    lastname: personData.surname || "",
                                    fathername: personData.fathername || "",
                                    afm: String(personData.afm || ""),
                                    secondary_text:
                                      (personData as any).freetext ||
                                      (personData as any).attribute ||
                                      "",
                                    amount: totalAmount,
                                    installments: installmentsList,
                                    installmentAmounts: installmentAmounts,
                                    ...(isEktosEdras && {
                                      employee_id: (personData as any).id,
                                    }),
                                  };

                                  // Use setValue and trigger validation to ensure form recognizes the changes
                                  form.setValue(
                                    "recipients",
                                    currentRecipients,
                                    { shouldDirty: true, shouldValidate: true },
                                  );

                                  // Trigger form validation after autocomplete to ensure save button works
                                  setTimeout(async () => {
                                    await form.trigger(`recipients.${index}`);
                                    await form.trigger("recipients");
                                    setIsFormSyncing(false);
                                    setIsDialogInitializing(false);
                                  }, 200);

                                  console.log(
                                    "[AFMAutocomplete] Successfully updated all fields for recipient",
                                    index,
                                    "with data:",
                                    {
                                      amount: totalAmount,
                                      installments: installmentsList,
                                      installmentAmounts: installmentAmounts,
                                    },
                                  );
                                }
                              }}
                              placeholder="ΑΦΜ"
                              className="w-full"
                            />
                          </div>

                          {/* ΕΚΤΟΣ ΕΔΡΑΣ Month Range - in first row next to AFM */}
                          <div className="md:col-span-3">
                            {form.getValues("expenditure_type") ===
                              EKTOS_EDRAS_TYPE && (
                              <FormField
                                control={form.control}
                                name={`recipients.${index}.month`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <MonthRangePicker
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        testIdPrefix={`recipient-${index}-month`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>

                          {/* ΕΚΤΟΣ ΕΔΡΑΣ-specific expense fields */}
                          {form.getValues("expenditure_type") ===
                            EKTOS_EDRAS_TYPE && (
                            <>
                              {/* All Expense Fields in One Row */}
                              <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                                {/* Days Input */}
                                <FormField
                                  control={form.control}
                                  name={`recipients.${index}.days`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">
                                        Αριθμός Ημερών
                                      </FormLabel>
                                      <FormControl>
                                        <NumberInput
                                          {...field}
                                          onChange={(value) => {
                                            if (
                                              value === "" ||
                                              value === null ||
                                              value === undefined
                                            ) {
                                              field.onChange(1);
                                              return;
                                            }
                                            const numValue = Number(value);
                                            field.onChange(
                                              Number.isFinite(numValue)
                                                ? Math.floor(numValue)
                                                : 1,
                                            );
                                          }}
                                          min={1}
                                          step={1}
                                          placeholder="1"
                                          data-testid={`input-recipient-${index}-days`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Daily Compensation */}
                                <FormField
                                  control={form.control}
                                  name={`recipients.${index}.daily_compensation`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">
                                        Ημερήσια Αποζημίωση
                                      </FormLabel>
                                      <FormControl>
                                        <NumberInput
                                          {...field}
                                          onChange={(
                                            displayValue,
                                            numericValue,
                                          ) => {
                                            field.onChange(numericValue);
                                            // Trigger recalculation
                                            const recipient = form.getValues(
                                              `recipients.${index}`,
                                            );
                                            const totalExpense =
                                              numericValue +
                                              (typeof recipient.accommodation_expenses ===
                                              "number"
                                                ? recipient.accommodation_expenses
                                                : parseEuropeanNumber(
                                                    recipient.accommodation_expenses as string,
                                                  ) || 0) +
                                              (typeof recipient.kilometers_traveled ===
                                              "number"
                                                ? recipient.kilometers_traveled
                                                : parseEuropeanNumber(
                                                    recipient.kilometers_traveled as string,
                                                  ) || 0) *
                                                (recipient.price_per_km ||
                                                  DEFAULT_PRICE_PER_KM) +
                                              (typeof recipient.tickets_tolls_rental ===
                                              "number"
                                                ? recipient.tickets_tolls_rental
                                                : parseEuropeanNumber(
                                                    recipient.tickets_tolls_rental as string,
                                                  ) || 0);
                                            const deduction =
                                              recipient.has_2_percent_deduction
                                                ? totalExpense * 0.02
                                                : 0;
                                            const netPayable =
                                              totalExpense - deduction;
                                            form.setValue(
                                              `recipients.${index}.total_expense`,
                                              totalExpense,
                                            );
                                            form.setValue(
                                              `recipients.${index}.deduction_2_percent`,
                                              deduction,
                                            );
                                            form.setValue(
                                              `recipients.${index}.net_payable`,
                                              netPayable,
                                            );
                                            form.setValue(
                                              `recipients.${index}.amount`,
                                              netPayable,
                                            );
                                          }}
                                          min={0}
                                          step={0.01}
                                          placeholder="0.00"
                                          data-testid={`input-recipient-${index}-daily-compensation`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Accommodation Expenses */}
                                <FormField
                                  control={form.control}
                                  name={`recipients.${index}.accommodation_expenses`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">
                                        Δαπάνες Διαμονής
                                      </FormLabel>
                                      <FormControl>
                                        <NumberInput
                                          {...field}
                                          onChange={(
                                            displayValue,
                                            numericValue,
                                          ) => {
                                            field.onChange(numericValue);
                                            // Trigger recalculation
                                            const recipient = form.getValues(
                                              `recipients.${index}`,
                                            );
                                            const totalExpense =
                                              (typeof recipient.daily_compensation ===
                                              "number"
                                                ? recipient.daily_compensation
                                                : parseEuropeanNumber(
                                                    recipient.daily_compensation as string,
                                                  ) || 0) +
                                              numericValue +
                                              (typeof recipient.kilometers_traveled ===
                                              "number"
                                                ? recipient.kilometers_traveled
                                                : parseEuropeanNumber(
                                                    recipient.kilometers_traveled as string,
                                                  ) || 0) *
                                                (recipient.price_per_km ||
                                                  DEFAULT_PRICE_PER_KM) +
                                              (typeof recipient.tickets_tolls_rental ===
                                              "number"
                                                ? recipient.tickets_tolls_rental
                                                : parseEuropeanNumber(
                                                    recipient.tickets_tolls_rental as string,
                                                  ) || 0);
                                            const deduction =
                                              recipient.has_2_percent_deduction
                                                ? totalExpense * 0.02
                                                : 0;
                                            const netPayable =
                                              totalExpense - deduction;
                                            form.setValue(
                                              `recipients.${index}.total_expense`,
                                              totalExpense,
                                            );
                                            form.setValue(
                                              `recipients.${index}.deduction_2_percent`,
                                              deduction,
                                            );
                                            form.setValue(
                                              `recipients.${index}.net_payable`,
                                              netPayable,
                                            );
                                            form.setValue(
                                              `recipients.${index}.amount`,
                                              netPayable,
                                            );
                                          }}
                                          min={0}
                                          step={0.01}
                                          placeholder="0.00"
                                          data-testid={`input-recipient-${index}-accommodation`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Kilometers Traveled */}
                                <FormField
                                  control={form.control}
                                  name={`recipients.${index}.kilometers_traveled`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm">
                                        Χιλιόμετρα (€{DEFAULT_PRICE_PER_KM}/χλμ)
                                      </FormLabel>
                                      <FormControl>
                                        <NumberInput
                                          {...field}
                                          onChange={(
                                            displayValue,
                                            numericValue,
                                          ) => {
                                            field.onChange(numericValue);
                                            // Trigger recalculation
                                            const recipient = form.getValues(
                                              `recipients.${index}`,
                                            );
                                            const totalExpense =
                                              (typeof recipient.daily_compensation ===
                                              "number"
                                                ? recipient.daily_compensation
                                                : parseEuropeanNumber(
                                                    recipient.daily_compensation as string,
                                                  ) || 0) +
                                              (typeof recipient.accommodation_expenses ===
                                              "number"
                                                ? recipient.accommodation_expenses
                                                : parseEuropeanNumber(
                                                    recipient.accommodation_expenses as string,
                                                  ) || 0) +
                                              numericValue *
                                                (recipient.price_per_km ||
                                                  DEFAULT_PRICE_PER_KM) +
                                              (typeof recipient.tickets_tolls_rental ===
                                              "number"
                                                ? recipient.tickets_tolls_rental
                                                : parseEuropeanNumber(
                                                    recipient.tickets_tolls_rental as string,
                                                  ) || 0);
                                            const deduction =
                                              recipient.has_2_percent_deduction
                                                ? totalExpense * 0.02
                                                : 0;
                                            const netPayable =
                                              totalExpense - deduction;
                                            form.setValue(
                                              `recipients.${index}.total_expense`,
                                              totalExpense,
                                            );
                                            form.setValue(
                                              `recipients.${index}.deduction_2_percent`,
                                              deduction,
                                            );
                                            form.setValue(
                                              `recipients.${index}.net_payable`,
                                              netPayable,
                                            );
                                            form.setValue(
                                              `recipients.${index}.amount`,
                                              netPayable,
                                            );
                                          }}
                                          min={0}
                                          placeholder="0"
                                          data-testid={`input-recipient-${index}-kilometers`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Tickets/Tolls/Rental - Dynamic Fields */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="text-sm">
                                      Εισιτήρια/Διόδια/Ενοικίαση
                                    </FormLabel>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const currentEntries =
                                          form.getValues(
                                            `recipients.${index}.tickets_tolls_rental_entries`,
                                          ) || [];
                                        form.setValue(
                                          `recipients.${index}.tickets_tolls_rental_entries`,
                                          [...currentEntries, 0],
                                        );
                                      }}
                                      className="h-6 w-6 p-0"
                                      data-testid={`button-add-ticket-entry-${index}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {(() => {
                                    const entries =
                                      form.watch(
                                        `recipients.${index}.tickets_tolls_rental_entries`,
                                      ) || [];

                                    // If no entries exist, initialize with one empty field
                                    if (entries.length === 0) {
                                      form.setValue(
                                        `recipients.${index}.tickets_tolls_rental_entries`,
                                        [0],
                                      );
                                      return null;
                                    }

                                    return (
                                      <div className="space-y-1">
                                        {entries.map((entry, entryIndex) => (
                                          <div
                                            key={entryIndex}
                                            className="flex gap-1"
                                          >
                                            <NumberInput
                                              value={entry}
                                              onChange={(
                                                displayValue,
                                                numericValue,
                                              ) => {
                                                const currentEntries =
                                                  form.getValues(
                                                    `recipients.${index}.tickets_tolls_rental_entries`,
                                                  ) || [];
                                                const newEntries = [
                                                  ...currentEntries,
                                                ];
                                                newEntries[entryIndex] =
                                                  numericValue;
                                                form.setValue(
                                                  `recipients.${index}.tickets_tolls_rental_entries`,
                                                  newEntries,
                                                );

                                                // Calculate sum and update tickets_tolls_rental
                                                const sum = newEntries.reduce(
                                                  (a, b) => a + b,
                                                  0,
                                                );
                                                form.setValue(
                                                  `recipients.${index}.tickets_tolls_rental`,
                                                  sum,
                                                );

                                                // Trigger recalculation
                                                const recipient =
                                                  form.getValues(
                                                    `recipients.${index}`,
                                                  );
                                                const totalExpense =
                                                  (typeof recipient.daily_compensation ===
                                                  "number"
                                                    ? recipient.daily_compensation
                                                    : parseEuropeanNumber(
                                                        recipient.daily_compensation as string,
                                                      ) || 0) +
                                                  (typeof recipient.accommodation_expenses ===
                                                  "number"
                                                    ? recipient.accommodation_expenses
                                                    : parseEuropeanNumber(
                                                        recipient.accommodation_expenses as string,
                                                      ) || 0) +
                                                  (typeof recipient.kilometers_traveled ===
                                                  "number"
                                                    ? recipient.kilometers_traveled
                                                    : parseEuropeanNumber(
                                                        recipient.kilometers_traveled as string,
                                                      ) || 0) *
                                                    (recipient.price_per_km ||
                                                      DEFAULT_PRICE_PER_KM) +
                                                  sum;
                                                const deduction =
                                                  recipient.has_2_percent_deduction
                                                    ? totalExpense * 0.02
                                                    : 0;
                                                const netPayable =
                                                  totalExpense - deduction;
                                                form.setValue(
                                                  `recipients.${index}.total_expense`,
                                                  totalExpense,
                                                );
                                                form.setValue(
                                                  `recipients.${index}.deduction_2_percent`,
                                                  deduction,
                                                );
                                                form.setValue(
                                                  `recipients.${index}.net_payable`,
                                                  netPayable,
                                                );
                                                form.setValue(
                                                  `recipients.${index}.amount`,
                                                  netPayable,
                                                );
                                              }}
                                              min={0}
                                              step={0.01}
                                              placeholder="0.00"
                                              className="flex-1"
                                              data-testid={`input-recipient-${index}-ticket-entry-${entryIndex}`}
                                            />
                                            {entries.length > 1 && (
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const currentEntries =
                                                    form.getValues(
                                                      `recipients.${index}.tickets_tolls_rental_entries`,
                                                    ) || [];
                                                  const newEntries =
                                                    currentEntries.filter(
                                                      (_, i) =>
                                                        i !== entryIndex,
                                                    );
                                                  form.setValue(
                                                    `recipients.${index}.tickets_tolls_rental_entries`,
                                                    newEntries,
                                                  );

                                                  // Calculate sum and update tickets_tolls_rental
                                                  const sum = newEntries.reduce(
                                                    (a, b) => a + b,
                                                    0,
                                                  );
                                                  form.setValue(
                                                    `recipients.${index}.tickets_tolls_rental`,
                                                    sum,
                                                  );

                                                  // Trigger recalculation
                                                  const recipient =
                                                    form.getValues(
                                                      `recipients.${index}`,
                                                    );
                                                  const totalExpense =
                                                    (typeof recipient.daily_compensation ===
                                                    "number"
                                                      ? recipient.daily_compensation
                                                      : parseEuropeanNumber(
                                                          recipient.daily_compensation as string,
                                                        ) || 0) +
                                                    (typeof recipient.accommodation_expenses ===
                                                    "number"
                                                      ? recipient.accommodation_expenses
                                                      : parseEuropeanNumber(
                                                          recipient.accommodation_expenses as string,
                                                        ) || 0) +
                                                    (typeof recipient.kilometers_traveled ===
                                                    "number"
                                                      ? recipient.kilometers_traveled
                                                      : parseEuropeanNumber(
                                                          recipient.kilometers_traveled as string,
                                                        ) || 0) *
                                                      (recipient.price_per_km ||
                                                        DEFAULT_PRICE_PER_KM) +
                                                    sum;
                                                  const deduction =
                                                    recipient.has_2_percent_deduction
                                                      ? totalExpense * 0.02
                                                      : 0;
                                                  const netPayable =
                                                    totalExpense - deduction;
                                                  form.setValue(
                                                    `recipients.${index}.total_expense`,
                                                    totalExpense,
                                                  );
                                                  form.setValue(
                                                    `recipients.${index}.deduction_2_percent`,
                                                    deduction,
                                                  );
                                                  form.setValue(
                                                    `recipients.${index}.net_payable`,
                                                    netPayable,
                                                  );
                                                  form.setValue(
                                                    `recipients.${index}.amount`,
                                                    netPayable,
                                                  );
                                                }}
                                                className="h-8 w-8 p-0"
                                                data-testid={`button-remove-ticket-entry-${index}-${entryIndex}`}
                                              >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                        {entries.length > 1 && (
                                          <div className="text-xs text-muted-foreground pt-1 border-t">
                                            Σύνολο: €
                                            {entries
                                              .reduce((a, b) => a + b, 0)
                                              .toFixed(2)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* 2% Deduction Checkbox */}
                              <div className="md:col-span-12">
                                <FormField
                                  control={form.control}
                                  name={`recipients.${index}.has_2_percent_deduction`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={(checked) => {
                                            field.onChange(checked);
                                            // Trigger recalculation
                                            const recipient = form.getValues(
                                              `recipients.${index}`,
                                            );
                                            const totalExpense =
                                              (typeof recipient.daily_compensation ===
                                              "number"
                                                ? recipient.daily_compensation
                                                : parseFloat(
                                                    recipient.daily_compensation as string,
                                                  ) || 0) +
                                              (typeof recipient.accommodation_expenses ===
                                              "number"
                                                ? recipient.accommodation_expenses
                                                : parseFloat(
                                                    recipient.accommodation_expenses as string,
                                                  ) || 0) +
                                              (typeof recipient.kilometers_traveled ===
                                              "number"
                                                ? recipient.kilometers_traveled
                                                : parseFloat(
                                                    recipient.kilometers_traveled as string,
                                                  ) || 0) *
                                                (recipient.price_per_km ||
                                                  DEFAULT_PRICE_PER_KM) +
                                              (typeof recipient.tickets_tolls_rental ===
                                              "number"
                                                ? recipient.tickets_tolls_rental
                                                : parseFloat(
                                                    recipient.tickets_tolls_rental as string,
                                                  ) || 0);
                                            const deduction = checked
                                              ? totalExpense * 0.02
                                              : 0;
                                            const netPayable =
                                              totalExpense - deduction;
                                            form.setValue(
                                              `recipients.${index}.deduction_2_percent`,
                                              deduction,
                                            );
                                            form.setValue(
                                              `recipients.${index}.net_payable`,
                                              netPayable,
                                            );
                                            form.setValue(
                                              `recipients.${index}.amount`,
                                              netPayable,
                                            );
                                          }}
                                          data-testid={`checkbox-recipient-${index}-2-percent-deduction`}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        Παρακράτηση 2%
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Calculated Fields Display */}
                              <div className="md:col-span-12 space-y-2 p-4 bg-muted/50 rounded-md">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium">
                                    ΣΥΝΟΛΟ ΔΑΠΑΝΗΣ:
                                  </span>
                                  <span
                                    className="text-sm font-semibold"
                                    data-testid={`text-recipient-${index}-total-expense`}
                                  >
                                    €
                                    {(
                                      form.watch(
                                        `recipients.${index}.total_expense`,
                                      ) || 0
                                    ).toFixed(2)}
                                  </span>
                                </div>
                                {form.watch(
                                  `recipients.${index}.has_2_percent_deduction`,
                                ) && (
                                  <div className="flex justify-between items-center text-destructive">
                                    <span className="text-sm">
                                      Παρακράτηση 2%:
                                    </span>
                                    <span
                                      className="text-sm"
                                      data-testid={`text-recipient-${index}-deduction`}
                                    >
                                      -€
                                      {(
                                        form.watch(
                                          `recipients.${index}.deduction_2_percent`,
                                        ) || 0
                                      ).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t">
                                  <span className="font-semibold">
                                    ΚΑΘΑΡΟ ΠΛΗΡΩΤΕΟ:
                                  </span>
                                  <span
                                    className="font-bold text-lg"
                                    data-testid={`text-recipient-${index}-net-payable`}
                                  >
                                    €
                                    {(
                                      form.watch(
                                        `recipients.${index}.net_payable`,
                                      ) || 0
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}

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

                          {/* Installments Section - Full width row for non-ΕΚΤΟΣ ΕΔΡΑΣ */}
                          {form.getValues("expenditure_type") !==
                            EKTOS_EDRAS_TYPE && (
                            <div className="md:col-span-12 md:row-start-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                              {renderRecipientInstallments(index)}
                            </div>
                          )}

                          {/* Ελεύθερο Κείμενο - Only show for non-ΕΚΤΟΣ ΕΔΡΑΣ */}
                          {form.getValues("expenditure_type") !==
                            EKTOS_EDRAS_TYPE && (
                            <Input
                              {...form.register(
                                `recipients.${index}.secondary_text`,
                              )}
                              placeholder="Ελεύθερο Κείμενο (προαιρετικό)"
                              className="md:col-span-12 md:row-start-3"
                              autoComplete="off"
                            />
                          )}
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

                  {/* Helpful info about signature availability */}
                  {form.watch("unit") &&
                    availableDirectors.length === 0 &&
                    availableDepartmentManagers.length === 0 && (
                      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        <p>
                          Η επιλεγμένη μονάδα δεν έχει διαθέσιμα στοιχεία
                          υπογράφοντων στη βάση δεδομένων.
                        </p>
                        <p className="mt-1">
                          Μονάδες με διαθέσιμους υπογράφοντες: ΔΑΕΦΚ-ΚΕ,
                          ΔΑΕΦΚ-ΑΚ, ΔΑΕΦΚ-ΔΕ
                        </p>
                      </div>
                    )}

                  {/* Single Signature Selection */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="director_signature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Επιλογή Υπογράφοντος
                            {availableDirectors.length === 0 &&
                              availableDepartmentManagers.length === 0 &&
                              form.watch("unit") && (
                                <span className="text-sm text-muted-foreground ml-2">
                                  (Δεν διατίθενται υπογραφές για αυτή τη μονάδα)
                                </span>
                              )}
                          </FormLabel>
                          <Select
                            value={
                              field.value
                                ? JSON.stringify(field.value)
                                : undefined
                            }
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
                                <SelectValue placeholder="Επιλέξτε υπογράφοντα" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Directors */}
                              {availableDirectors.map((director: any) => (
                                <SelectItem
                                  key={`director-${director.unit}`}
                                  value={JSON.stringify({
                                    ...director.director,
                                    type: "director",
                                    unit: director.unit,
                                  })}
                                >
                                  {director.director.name} - Διευθυντής (
                                  {director.unit})
                                </SelectItem>
                              ))}

                              {/* Department Managers */}
                              {availableDepartmentManagers.map(
                                (manager, index) => (
                                  <SelectItem
                                    key={`manager-${manager.unit}-${index}`}
                                    value={JSON.stringify({
                                      ...manager.manager,
                                      type: "manager",
                                      unit: manager.unit,
                                      department: manager.department,
                                    })}
                                  >
                                    {manager.manager.name} - Προϊστάμενος (
                                    {manager.department})
                                  </SelectItem>
                                ),
                              )}

                              {/* Fallback for empty signature lists */}
                              {availableDirectors.length === 0 &&
                                availableDepartmentManagers.length === 0 && (
                                  <SelectItem value="no-signature" disabled>
                                    Δεν υπάρχουν διαθέσιμοι υπογράφοντες για την
                                    επιλεγμένη μονάδα
                                  </SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* For YL (delegated implementing agency) dropdown - only show if options exist for selected unit */}
                  {(() => {
                    const selectedUnitValue = form.watch("unit");
                    if (!selectedUnitValue) return null;
                    
                    // Filter for_yl by the selected unit's monada_id
                    const availableForYl = forYlData?.filter(
                      (fy: any) => fy.monada_id && String(fy.monada_id) === String(selectedUnitValue)
                    ) || [];
                    
                    // Only show dropdown if there are for_yl options for this unit
                    if (availableForYl.length === 0) return null;
                    
                    return (
                      <FormField
                        control={form.control}
                        name="for_yl_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Φορέας Υλοποίησης (προαιρετικό)</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                              value={field.value ? String(field.value) : "none"}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-for-yl">
                                  <SelectValue placeholder="Επιλέξτε φορέα (προαιρετικό)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Κανένας (χρήση μονάδας)</SelectItem>
                                {availableForYl.map((forYl: any) => (
                                  <SelectItem
                                    key={forYl.id}
                                    value={String(forYl.id)}
                                  >
                                    {forYl.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                              Επιλέξτε αν ο φορέας υλοποίησης διαφέρει από τη μονάδα
                            </p>
                          </FormItem>
                        )}
                      />
                    );
                  })()}
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Συνημμένα Έγγραφα</h3>
                    {/* Select All functionality - only show when there are valid attachments */}
                    {!attachmentsLoading &&
                      attachments.length > 0 &&
                      attachments.some(
                        (att: any) => att.file_type !== "none",
                      ) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Get all valid attachment IDs (excluding error/no-data entries)
                            const validAttachmentIds = attachments
                              .filter((att: any) => att.file_type !== "none")
                              .map((att: any) => att.id);

                            const currentSelections =
                              form.watch("selectedAttachments") || [];

                            // Check if all valid attachments are already selected
                            const allSelected = validAttachmentIds.every(
                              (id: any) => currentSelections.includes(id),
                            );

                            let newSelections;
                            if (allSelected) {
                              // Deselect all - remove all valid attachment IDs from current selection
                              newSelections = currentSelections.filter(
                                (id: any) => !validAttachmentIds.includes(id),
                              );
                              console.log(
                                "[SelectAll] Deselecting all attachments",
                              );
                            } else {
                              // Select all - merge current selections with all valid attachment IDs
                              newSelections = Array.from(
                                new Set([
                                  ...currentSelections,
                                  ...validAttachmentIds,
                                ]),
                              );
                              console.log(
                                "[SelectAll] Selecting all attachments",
                              );
                            }

                            console.log(
                              "[SelectAll] New selections:",
                              newSelections,
                            );

                            // Update form
                            form.setValue("selectedAttachments", newSelections);

                            // Update context
                            setTimeout(() => {
                              updateFormData({
                                selectedAttachments: newSelections,
                              });
                            }, 100);
                          }}
                        >
                          {(() => {
                            const validAttachmentIds = attachments
                              .filter((att: any) => att.file_type !== "none")
                              .map((att: any) => att.id);
                            const currentSelections =
                              form.watch("selectedAttachments") || [];
                            const allSelected = validAttachmentIds.every(
                              (id: any) => currentSelections.includes(id),
                            );
                            return allSelected
                              ? "Αποεπιλογή Όλων"
                              : "Επιλογή Όλων";
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
                                  console.log(
                                    "[Attachment] Toggle attachment:",
                                    attachment.id,
                                    checked ? "checked" : "unchecked",
                                  );

                                  // Get current selection with a fresh copy
                                  const current = [
                                    ...(form.watch("selectedAttachments") ||
                                      []),
                                  ];

                                  // Create a new array
                                  let newSelections;

                                  if (checked) {
                                    // Add the attachment ID if checked
                                    newSelections = [...current, attachment.id];
                                    console.log(
                                      "[Attachment] Adding attachment:",
                                      attachment.id,
                                    );
                                  } else {
                                    // Remove the attachment ID if unchecked
                                    newSelections = current.filter(
                                      (id) => id !== attachment.id,
                                    );
                                    console.log(
                                      "[Attachment] Removing attachment:",
                                      attachment.id,
                                    );
                                  }

                                  console.log(
                                    "[Attachment] New selections:",
                                    newSelections,
                                  );

                                  // Set in the form
                                  form.setValue(
                                    "selectedAttachments",
                                    newSelections,
                                  );

                                  // Also update form context to ensure selections persist
                                  setTimeout(() => {
                                    console.log(
                                      "[Attachment] Updating context with:",
                                      newSelections,
                                    );
                                    updateFormData({
                                      selectedAttachments: newSelections,
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
                <EsdianFieldsWithSuggestions form={form} user={user} />

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
                    onClick={async () => {
                      console.log("[DocumentSubmit] Submit button clicked");
                      console.log(
                        "[DocumentSubmit] Recipients count:",
                        recipients.length,
                      );
                      console.log("[DocumentSubmit] Loading state:", loading);
                      console.log(
                        "[DocumentSubmit] Recipients data:",
                        recipients,
                      );
                      console.log(
                        "[DocumentSubmit] Form errors:",
                        form.formState.errors,
                      );
                      console.log(
                        "[DocumentSubmit] Form is valid:",
                        form.formState.isValid,
                      );
                      console.log(
                        "[DocumentSubmit] Form values:",
                        form.getValues(),
                      );

                      // First trigger form validation
                      const isValid = await form.trigger();
                      console.log(
                        "[DocumentSubmit] Form validation result:",
                        isValid,
                      );

                      if (!isValid) {
                        console.log(
                          "[DocumentSubmit] Form validation failed, showing errors",
                        );
                        console.log(
                          "[DocumentSubmit] Specific field errors:",
                          form.formState.errors,
                        );

                        // Show specific validation errors
                        const errors = form.formState.errors;
                        let errorMessage =
                          "Παρακαλώ ελέγξτε ότι όλα τα πεδία είναι συμπληρωμένα σωστά";

                        if (
                          errors.recipients &&
                          Array.isArray(errors.recipients)
                        ) {
                          errorMessage =
                            "Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία των δικαιούχων (Όνομα, Επώνυμο, ΑΦΜ)";
                        }

                        toast({
                          title: "Σφάλμα Επικύρωσης",
                          description: errorMessage,
                          variant: "destructive",
                        });
                        return;
                      }

                      console.log(
                        "[DocumentSubmit] Form is valid, calling handleSubmit",
                      );
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
    // Wait for units to load before attempting auto-selection
    if (unitsLoading || !units || units.length === 0) {
      return;
    }

    // Only run this once to avoid infinite loops
    if (userUnitIds.length === 1 && !unitInitializedRef.current) {
      unitInitializedRef.current = true;

      // Convert numeric unit ID to string for matching
      const userUnitIdStr = String(userUnitIds[0]);

      // Set the unit value immediately without delay
      // Convert user's unit ID to unit name for display
      const userUnitData = units.find((u: any) => u.id === userUnitIdStr);
      const unitValue = userUnitData?.id || "";

      if (unitValue) {
        form.setValue("unit", unitValue, {
          shouldDirty: false,
          shouldValidate: false,
        });

        // Also update form context data to ensure consistency
        updateFormData({
          ...formData,
          unit: unitValue,
        });

        // Mark unit initialization as completed to prevent overrides
        if (unitInitializationRef.current) {
          unitInitializationRef.current.isCompleted = true;
          unitInitializationRef.current.defaultUnit = unitValue;
        }
      }
    }
  }, [units, unitsLoading, userUnitIds, form, formData, updateFormData]); // Wait for units to be loaded

  useEffect(() => {
    if (regions.length === 1) {
      form.setValue("region", regions[0].id);
    }
  }, [regions, form]);

  // NOTE: Budget broadcasting is now handled by useBudgetUpdates hook with proper debouncing
  // This duplicate effect was causing performance issues and has been removed

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
          esdian_field2: formValues.esdian_field2 || "",
        });

        // Form state preserved on dialog close
      } catch (error) {
        console.error(
          "[CreateDocument] Error preserving form state on close:",
          error,
        );
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
  const handleDialogOpenChange = useCallback(
    (newOpen: boolean) => {
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
            esdian_field2: formValues.esdian_field2 || "",
          });

          // Form state preserved on dialog close (click outside)
        } catch (error) {
          console.error(
            "[CreateDocument] Error preserving form state on dialog close:",
            error,
          );
        }
      }

      // Call the original handler
      onOpenChange(newOpen);
    },
    [open, onOpenChange, form, updateFormData, currentStep],
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] max-h-[98vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Δημιουργία Εγγράφου</DialogTitle>
          <DialogDescription>
            Φόρμα δημιουργίας νέου διαβιβαστικού πληρωμών για το επιλεγμένο
            έργο.
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
