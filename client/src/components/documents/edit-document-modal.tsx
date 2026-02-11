import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Save,
  X,
  User,
  Euro,
  Hash,
  FileText,
  Plus,
  Trash2,
  Users,
  AlertCircle,
} from "lucide-react";
import type { GeneratedDocument } from "@shared/schema";
import { editDocumentSchema, correctionDocumentSchema } from "@shared/schema";
import { SimpleAFMAutocomplete } from "@/components/ui/simple-afm-autocomplete";
import { MonthRangePicker } from "@/components/common/MonthRangePicker";
import {
  EKTOS_EDRAS_TYPE,
  DKA_INSTALLMENTS,
  DKA_TYPES,
  HOUSING_ALLOWANCE_TYPE,
  HOUSING_QUARTERS,
  ALL_INSTALLMENTS,
} from "./constants";
import { EsdianFieldsWithSuggestions } from "./components/EsdianFieldsWithSuggestions";
import { BeneficiaryGeoSelector } from "./components/BeneficiaryGeoSelector";
import {
  isRegiondetComplete,
  mergeRegiondetPreservingPayments,
  normalizeRegiondetEntry,
  type RegiondetSelection,
} from "./utils/beneficiary-geo";

// Extend schemas to carry dynamic ESDIAN fields as well
const editSchemaWithEsdian = editDocumentSchema.extend({
  esdian_fields: z.array(z.string().optional()).optional(),
});
const correctionSchemaWithEsdian = correctionDocumentSchema.extend({
  esdian_fields: z.array(z.string().optional()).optional(),
});

// Use editDocumentSchema as base type - includes all fields with optional correction_reason
// The zodResolver enforces correct validation based on mode (edit vs correction)
type DocumentForm = z.infer<typeof editSchemaWithEsdian>;

interface EditDocumentModalProps {
  document: GeneratedDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "edit" | "correction";
  onCorrectionSuccess?: (documentId: number) => void; // Callback to open protocol modal after correction
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Προσχέδιο", color: "bg-gray-100 text-gray-800" },
  {
    value: "pending",
    label: "Εκκρεμεί",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "approved",
    label: "Εγκεκριμένο",
    color: "bg-green-100 text-green-800",
  },
  { value: "rejected", label: "Απορρίφθηκε", color: "bg-red-100 text-red-800" },
  {
    value: "completed",
    label: "Ολοκληρώθηκε",
    color: "bg-blue-100 text-blue-800",
  },
];

// Helper function to get available installments based on expenditure type
const getAvailableInstallments = (expenditureTypeName?: string): string[] => {
  if (!expenditureTypeName) return [ALL_INSTALLMENTS[0]]; // Default to ΕΦΑΠΑΞ

  if (expenditureTypeName === HOUSING_ALLOWANCE_TYPE) {
    return HOUSING_QUARTERS;
  }

  if (DKA_TYPES.some((dka) => expenditureTypeName.includes(dka))) {
    return DKA_INSTALLMENTS;
  }

  return ALL_INSTALLMENTS;
};

// Helper to normalize installment value for housing allowance
const normalizeInstallmentValue = (
  value: string | number | undefined,
  expenditureTypeName?: string,
): string => {
  if (!value) return "";
  const strValue = String(value).trim();

  // If it's housing allowance and value is just a number, convert to ΤΡΙΜΗΝΟ format
  if (
    expenditureTypeName === HOUSING_ALLOWANCE_TYPE &&
    /^\d+$/.test(strValue)
  ) {
    return `ΤΡΙΜΗΝΟ ${strValue}`;
  }

  return strValue;
};

const normalizeRegiondet = (
  value: any,
  paymentId?: number | string,
): RegiondetSelection | null => {
  return normalizeRegiondetEntry(
    value as RegiondetSelection | RegiondetSelection[] | null,
    paymentId,
  ) as RegiondetSelection | null;
};

const hasPaymentMatch = (
  entry: any,
  paymentId?: number | string,
): boolean => {
  if (!entry || typeof entry !== "object" || paymentId === undefined) {
    return false;
  }

  const ids: Array<string | number> = [];
  if (entry.payment_id !== undefined && entry.payment_id !== null) {
    ids.push(entry.payment_id);
  }
  if (Array.isArray(entry.payment_ids)) {
    ids.push(...entry.payment_ids);
  }

  return ids.map(String).includes(String(paymentId));
};

const normalizeRegiondetForPaymentContext = ({
  value,
  paymentId,
  projectIndexId,
}: {
  value: any;
  paymentId?: number | string;
  projectIndexId?: number | string | null;
}): RegiondetSelection | null => {
  if (!value) return null;

  const entries = Array.isArray(value) ? value : [value];
  const validEntries = entries.filter(
    (entry) => entry && typeof entry === "object",
  );

  if (paymentId !== undefined) {
    const paymentMatch = validEntries.find((entry) =>
      hasPaymentMatch(entry, paymentId),
    );
    if (paymentMatch) {
      return normalizeRegiondet(paymentMatch, paymentId);
    }
  }

  if (projectIndexId !== undefined && projectIndexId !== null) {
    const projectMatch = validEntries.find(
      (entry: any) =>
        entry.project_index_id !== undefined &&
        String(entry.project_index_id) === String(projectIndexId),
    );
    if (projectMatch) {
      return normalizeRegiondet(projectMatch, paymentId);
    }
  }

  return normalizeRegiondet(value, paymentId);
};

export function EditDocumentModal({
  document,
  open,
  onOpenChange,
  mode = "edit",
  onCorrectionSuccess,
}: EditDocumentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const isCorrection = mode === "correction";

  const oldProtocolNumber = useMemo(() => {
    if (!document) return "";
    const raw =
      document.protocol_number_input ||
      (document as any).original_protocol_number ||
      "";
    return raw?.toString?.() || "";
  }, [document]);

  const originalProtocolDateDisplay = useMemo(() => {
    if (!document) return "";
    const rawDate = document.protocol_date || document.original_protocol_date;
    if (!rawDate) return "";
    const parsed = new Date(rawDate as any);
    return isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("el-GR");
  }, [document]);

  const correctionReasonTemplate = useMemo(
    () => `Ορθή επανάληψη του εγγράφου με αρ πρωτ ${oldProtocolNumber} λόγω `,
    [oldProtocolNumber],
  );

  // Memoize user unit IDs for filtering units dropdown
  const userUnitIds = useMemo(
    () => (user?.unit_id ?? []).map(String),
    [user?.unit_id],
  );

  // Initialize form with document data using the appropriate schema
  const form = useForm<DocumentForm>({
    resolver: zodResolver(
      isCorrection ? correctionSchemaWithEsdian : editSchemaWithEsdian,
    ),
    defaultValues: {
      protocol_number_input: "",
      protocol_date: "",
      status: "pending",
      comments: "",
      total_amount: 0,
      esdian_field1: "",
      esdian_field2: "",
      esdian_fields: [],
      is_correction: false,
      original_protocol_number: "",
      original_protocol_date: "",
      correction_reason: "",
      recipients: [],
    },
  });
  // Keep the initially loaded recipients so we can fall back if the form array is emptied
  const initialRecipientsRef = useRef<any[]>([]);

  // Fetch beneficiary payments for this document
  const {
    data: beneficiaryPayments,
    refetch: refetchPayments,
    isLoading: beneficiariesLoading,
  } = useQuery({
    queryKey: ["/api/documents", document?.id, "beneficiaries"],
    queryFn: async () => {
      if (!document?.id) return [];
      const response = await apiRequest(
        `/api/documents/${document.id}/beneficiaries`,
      );
      return response || [];
    },
    enabled: !!document?.id && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch units for dropdown (filtered to user's assigned units)
  const { data: rawUnits = [], isLoading: unitsLoading } = useQuery<any[]>({
    queryKey: ["/api/public/units"],
    staleTime: 60 * 60 * 1000, // 1 hour cache
    enabled: open,
  });

  // Filter units to only show user's assigned units (matching create dialog behavior)
  const units = useMemo(() => {
    if (!rawUnits || rawUnits.length === 0) return [];

    // If user has no unit restrictions, show all units (admin case)
    if (userUnitIds.length === 0) {
      return rawUnits;
    }

    // Filter units based on user's assigned unit_id array
    // IMPORTANT: Match by item.id (numeric ID), NOT item.unit (text code)
    const filteredUnits = rawUnits.filter((item: any) => {
      const itemId = Number(item.id);
      const matches = userUnitIds.some((uid: string) => Number(uid) === itemId);
      return matches;
    });

    console.log(
      "[EditDocument] Units filtered:",
      filteredUnits.length,
      "from",
      rawUnits.length,
      "total, user units:",
      userUnitIds,
    );

    return filteredUnits;
  }, [rawUnits, userUnitIds]);

  // Watch selected unit_id from form (numeric)
  const selectedUnitId = form.watch("unit_id");

  // For initial load, use document's unit_id; after form is populated, use form value
  const unitIdForProjectsQuery = selectedUnitId || document?.unit_id;

  // Fetch projects based on document or form unit_id
  // IMPORTANT: Use String() to match ProjectSelect's cache key format for cache sharing
  const { data: projects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: [
      "projects-working",
      unitIdForProjectsQuery ? String(unitIdForProjectsQuery) : "",
    ],
    queryFn: async () => {
      if (!unitIdForProjectsQuery) return [];
      const response = await apiRequest(
        `/api/projects-working/${unitIdForProjectsQuery}`,
      );
      return Array.isArray(response) ? response : [];
    },
    enabled: !!unitIdForProjectsQuery && open,
    staleTime: 5 * 60 * 1000,
  });

  // Track selected project and expenditure type from document
  // MUST be declared before queries that use these values
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [selectedExpenditureTypeId, setSelectedExpenditureTypeId] = useState<
    number | null
  >(null);

  // Fetch ALL expenditure types (for lookup reference)
  const { data: allExpenditureTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/public/expenditure-types"],
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  // Check if this is an ΕΚΤΟΣ ΕΔΡΑΣ document
  // Use the selected expenditure type from dropdown if available, otherwise use document's original type
  const docAny = document as any;
  const selectedExpenditureName = allExpenditureTypes.find(
    (type: any) => type.id === selectedExpenditureTypeId,
  )?.expenditure_types;
  const isEktosEdras = selectedExpenditureName
    ? selectedExpenditureName === EKTOS_EDRAS_TYPE
    : docAny?.expenditure_type === EKTOS_EDRAS_TYPE;

  // Fetch valid expenditure types for the selected project from project_index
  // This is the ONLY source for the dropdown - no fallback to all types
  const { data: expenditureTypes = [] } = useQuery<any[]>({
    queryKey: [
      "project-expenditure-types",
      selectedProjectId,
      selectedUnitId,
      allExpenditureTypes?.length ?? 0,
    ],
    queryFn: async () => {
      if (!selectedProjectId || !selectedUnitId) return [];

      // Wait for allExpenditureTypes to be available
      if (!allExpenditureTypes || allExpenditureTypes.length === 0) {
        console.log(
          "[EditDocument] Waiting for allExpenditureTypes to load...",
        );
        return [];
      }

      // Fetch all project_index entries for this project+unit combination
      const response = await apiRequest(
        `/api/project-index/project/${selectedProjectId}/${selectedUnitId}`,
      );

      if (!response || !Array.isArray(response)) {
        console.log(
          "[EditDocument] No project_index entries found for project:",
          selectedProjectId,
          "unit:",
          selectedUnitId,
        );
        return [];
      }

      // Extract unique expenditure_type_id values
      const expenditureTypeIds = Array.from(
        new Set(response.map((pi: any) => pi.expenditure_type_id)),
      );
      console.log(
        "[EditDocument] Valid expenditure_type_ids from project_index:",
        expenditureTypeIds,
      );

      // Filter allExpenditureTypes to only include valid ones from project_index
      const filtered = allExpenditureTypes.filter((type: any) =>
        expenditureTypeIds.includes(type.id),
      );
      console.log(
        "[EditDocument] Filtered expenditure types:",
        filtered.length,
        "types",
      );
      return filtered;
    },
    enabled: !!selectedProjectId && !!selectedUnitId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch project_index record to resolve actual project_id from project_index_id
  const { data: projectIndexData, isLoading: projectIndexLoading } =
    useQuery<any>({
      queryKey: ["project-index", document?.project_index_id],
      queryFn: async () => {
        if (!document?.project_index_id) return null;
        console.log(
          "[EditDocument] Fetching project_index record:",
          document.project_index_id,
        );
        const response = await apiRequest(
          `/api/project-index/${document.project_index_id}`,
        );
        console.log("[EditDocument] Project_index data:", response);
        return response;
      },
      enabled: !!document?.project_index_id && open,
      staleTime: 5 * 60 * 1000,
    });

  // Extract actual project_id and expenditure_type_id from project_index data
  const actualProjectId = useMemo(() => {
    if (!projectIndexData) return null;
    return projectIndexData.project_id;
  }, [projectIndexData]);

  // Track the expenditure_type_id from the document's project_index
  const documentExpenditureTypeId = useMemo(() => {
    if (!projectIndexData) return null;
    return projectIndexData.expenditure_type_id;
  }, [projectIndexData]);

  // Track if form has been initialized to prevent re-resetting on user changes
  // Using STATE instead of ref so changes trigger re-renders for geographic init
  const [formInitialized, setFormInitialized] = useState(false);

  // Per-beneficiary geographic selection state
  const [regiondetErrors, setRegiondetErrors] = useState<
    Record<number, string>
  >({});
  const regiondetSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const [regiondetSaveState, setRegiondetSaveState] = useState<
    Record<
      string,
      { status: "idle" | "saving" | "saved" | "error"; message?: string }
    >
  >({});
  const lastRegiondetByBeneficiary = useRef<
    Record<string, RegiondetSelection | null>
  >({});

  // Geographic data query using the new normalized structure
  const { data: geographicData } = useQuery({
    queryKey: ["geographic-data"],
    queryFn: async () => {
      const response = await apiRequest("/api/geographic-data");
      console.log("[EditDocument] Geographic data loaded:", response);
      return response;
    },
    enabled: open,
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

          // Extract project-specific geographic areas
          const projectRegions =
            (response as any)?.projectGeographicData?.regions || [];
          const projectUnits =
            (response as any)?.projectGeographicData?.regionalUnits || [];
          const projectMunicipalities =
            (response as any)?.projectGeographicData?.municipalities || [];

          console.log("[EditDocument] Project-specific geographic data:", {
            regions: projectRegions.length,
            units: projectUnits.length,
            municipalities: projectMunicipalities.length,
          });

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
            "[EditDocument] Smart geographic data:",
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
        Boolean(selectedProjectId) &&
        projects.length > 0 &&
        !!geographicData &&
        open,
    });

  // Computed available options based on current selections
  const availableRegions =
    (projectGeographicAreas as any)?.availableRegions || [];
  const availableUnits = (projectGeographicAreas as any)?.availableUnits || [];
  const availableMunicipalities =
    (projectGeographicAreas as any)?.availableMunicipalities || [];

  const regiondetMutation = useMutation({
    mutationFn: async ({
      beneficiaryId,
      regiondet,
    }: {
      beneficiaryId: number;
      regiondet: RegiondetSelection | null;
    }) => {
      return apiRequest(`/api/beneficiaries/${beneficiaryId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regiondet }),
      });
    },
    onSuccess: (_data, variables) => {
      const key = String(variables.beneficiaryId);
      setRegiondetSaveState((prev) => ({
        ...prev,
        [key]: { status: "saved" },
      }));
    },
    onError: (error: any, variables) => {
      const key = String(variables.beneficiaryId);
      setRegiondetSaveState((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          message:
            (error as any)?.message || "Failed to save geographical selection",
        },
      }));
    },
  });

  const scheduleRegiondetSave = (
    beneficiaryId: number | undefined,
    nextValue: RegiondetSelection | null,
  ) => {
    if (!beneficiaryId) return;
    const key = String(beneficiaryId);
    lastRegiondetByBeneficiary.current[key] = nextValue;
    if (regiondetSaveTimers.current[key]) {
      clearTimeout(regiondetSaveTimers.current[key]);
    }
    regiondetSaveTimers.current[key] = setTimeout(() => {
      setRegiondetSaveState((prev) => ({
        ...prev,
        [key]: { status: "saving" },
      }));
      regiondetMutation.mutate({ beneficiaryId, regiondet: nextValue });
    }, 400);
  };

  const retryRegiondetSave = (beneficiaryId: number) => {
    const key = String(beneficiaryId);
    const lastValue = lastRegiondetByBeneficiary.current[key];
    if (!lastValue) return;
    setRegiondetSaveState((prev) => ({
      ...prev,
      [key]: { status: "saving" },
    }));
    regiondetMutation.mutate({ beneficiaryId, regiondet: lastValue });
  };

  const validateBeneficiaryRegions = () => {
    const recipients = form.getValues("recipients") || [];
    const missing: Record<number, string> = {};

    recipients.forEach((recipient: any, idx: number) => {
      if (recipient?.employee_id) return;
      if (!isRegiondetComplete(recipient?.regiondet as RegiondetSelection)) {
        missing[idx] = "Geographical selection is required";
      }
    });

    setRegiondetErrors(missing);

    if (Object.keys(missing).length > 0) {
      toast({
        title: "Geography required",
        description:
          "Select a region, unit, or municipality for every beneficiary before continuing.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleRecipientGeoChange = (
    index: number,
    nextValue: RegiondetSelection | null,
  ) => {
    setRegiondetErrors((prev) => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });

    const recipients = form.getValues("recipients") || [];
    const target = recipients[index] || {};
    const merged = mergeRegiondetPreservingPayments(
      nextValue as RegiondetSelection,
      normalizeRegiondet(
        target?.regiondet,
        target?.id as number | string | undefined,
      ) as RegiondetSelection,
    );

    form.setValue(`recipients.${index}.regiondet` as any, merged, {
      shouldDirty: true,
      shouldValidate: false,
    });

    const beneficiaryId =
      typeof target?.beneficiary_id === "number"
        ? (target as any).beneficiary_id
        : undefined;
    scheduleRegiondetSave(beneficiaryId, merged as any);
  };

  // Watch recipients and auto-calculate total
  // Use subscription-based watch for deep reactivity
  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value, { name }) => {
      // Check if any recipient amount changed
      if (name?.startsWith("recipients.") && name?.endsWith(".amount")) {
        const recipients = value.recipients || [];
        const total = recipients.reduce((sum: number, recipient: any) => {
          return sum + (parseFloat(recipient.amount) || 0);
        }, 0);

        // Round to 2 decimal places to avoid floating point precision errors
        const roundedTotal = Math.round(total * 100) / 100;

        // Only update if total has changed to prevent infinite loops
        const currentTotal = form.getValues("total_amount");
        if (roundedTotal !== currentTotal) {
          console.log("[EditDocument] Auto-updating total_amount:", {
            from: currentTotal,
            to: roundedTotal,
          });
          form.setValue("total_amount", roundedTotal, {
            shouldValidate: false,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-calculate employee payment fields (ΕΚΤΟΣ ΕΔΡΑΣ)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value, { name }) => {
      // Check if any employee payment field changed
      if (
        name?.startsWith("recipients.") &&
        (name.includes(".days") ||
          name.includes(".daily_compensation") ||
          name.includes(".accommodation_expenses") ||
          name.includes(".kilometers_traveled") ||
          name.includes(".tickets_tolls_rental") ||
          name.includes(".has_2_percent_deduction"))
      ) {
        // Extract the recipient index from the field name
        const match = name.match(/recipients\.(\d+)\./);
        if (!match) return;

        const index = parseInt(match[1]);
        const recipient = value.recipients?.[index];
        if (!recipient) return;

        // Calculate total_expense
        const days = parseFloat(recipient.days?.toString() || "0") || 0;
        const dailyComp =
          parseFloat(recipient.daily_compensation?.toString() || "0") || 0;
        const accommodation =
          parseFloat(recipient.accommodation_expenses?.toString() || "0") || 0;
        const kilometers =
          parseFloat(recipient.kilometers_traveled?.toString() || "0") || 0;
        const pricePerKm =
          parseFloat(recipient.price_per_km?.toString() || "0.2") || 0.2;
        const tickets =
          parseFloat(recipient.tickets_tolls_rental?.toString() || "0") || 0;

        const totalExpense =
          dailyComp + accommodation + kilometers * pricePerKm + tickets;

        // Calculate deduction if applicable
        // For ΕΚΤΟΣ ΕΔΡΑΣ: 2% withholding applies ONLY to daily compensation (total amount)
        const has2PercentDeduction = recipient.has_2_percent_deduction ?? false;
        const withholdingBase = isEktosEdras ? dailyComp : totalExpense;
        const deduction = has2PercentDeduction ? withholdingBase * 0.02 : 0;
        const netPayable = totalExpense - deduction;

        // Update the form values
        const currentTotalExpense = form.getValues(
          `recipients.${index}.total_expense` as any,
        );
        const currentDeduction = form.getValues(
          `recipients.${index}.deduction_2_percent` as any,
        );
        const currentNetPayable = form.getValues(
          `recipients.${index}.net_payable` as any,
        );
        const currentAmount = form.getValues(
          `recipients.${index}.amount` as any,
        );

        // Only update if values have changed
        if (totalExpense !== currentTotalExpense) {
          form.setValue(
            `recipients.${index}.total_expense` as any,
            totalExpense,
            { shouldValidate: false },
          );
        }
        if (deduction !== currentDeduction) {
          form.setValue(
            `recipients.${index}.deduction_2_percent` as any,
            deduction,
            { shouldValidate: false },
          );
        }
        if (netPayable !== currentNetPayable) {
          form.setValue(`recipients.${index}.net_payable` as any, netPayable, {
            shouldValidate: false,
          });
        }
        // Update the amount field to match net_payable (this will trigger total recalculation)
        if (netPayable !== currentAmount) {
          form.setValue(`recipients.${index}.amount` as any, netPayable, {
            shouldValidate: false,
          });
        }

        console.log("[EditDocument] Auto-calculated employee payment:", {
          index,
          days,
          dailyComp,
          accommodation,
          kilometers,
          tickets,
          totalExpense,
          has2PercentDeduction,
          deduction,
          netPayable,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isEktosEdras]);

  useEffect(() => {
    if (!open) return;

    const recipients = (form.getValues("recipients") as any[]) || [];
    recipients.forEach((recipient, index) => {
      if (!recipient) return;

      const dailyComp =
        parseFloat(recipient.daily_compensation?.toString() || "0") || 0;
      const accommodation =
        parseFloat(recipient.accommodation_expenses?.toString() || "0") || 0;
      const kilometers =
        parseFloat(recipient.kilometers_traveled?.toString() || "0") || 0;
      const pricePerKm =
        parseFloat(recipient.price_per_km?.toString() || "0.2") || 0.2;
      const tickets =
        parseFloat(recipient.tickets_tolls_rental?.toString() || "0") || 0;

      const totalExpense =
        dailyComp + accommodation + kilometers * pricePerKm + tickets;

      const has2PercentDeduction = recipient.has_2_percent_deduction ?? false;
      const withholdingBase = isEktosEdras ? dailyComp : totalExpense;
      const deduction = has2PercentDeduction ? withholdingBase * 0.02 : 0;
      const netPayable = totalExpense - deduction;

      const currentTotalExpense = form.getValues(
        `recipients.${index}.total_expense` as any,
      );
      const currentDeduction = form.getValues(
        `recipients.${index}.deduction_2_percent` as any,
      );
      const currentNetPayable = form.getValues(
        `recipients.${index}.net_payable` as any,
      );
      const currentAmount = form.getValues(
        `recipients.${index}.amount` as any,
      );

      if (totalExpense !== currentTotalExpense) {
        form.setValue(`recipients.${index}.total_expense` as any, totalExpense, {
          shouldValidate: false,
        });
      }
      if (deduction !== currentDeduction) {
        form.setValue(
          `recipients.${index}.deduction_2_percent` as any,
          deduction,
          { shouldValidate: false },
        );
      }
      if (netPayable !== currentNetPayable) {
        form.setValue(`recipients.${index}.net_payable` as any, netPayable, {
          shouldValidate: false,
        });
      }
      if (netPayable !== currentAmount) {
        form.setValue(`recipients.${index}.amount` as any, netPayable, {
          shouldValidate: false,
        });
      }
    });
  }, [form, isEktosEdras, open]);

  useEffect(() => {
    const timers = regiondetSaveTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);

  // Reset initialization flag when modal closes or document changes
  useEffect(() => {
    // Reset when modal closes OR when document ID changes
    setFormInitialized(false);

    // Note: Do NOT reset selectedExpenditureTypeId here to avoid dropdown flicker
    // It will be properly reset when a new document loads via the form reset logic

    console.log("[EditDocument] Resetting initialization flag:", {
      open,
      documentId: document?.id,
    });
  }, [open, document?.id]);

  // Populate selectedProjectId and selectedExpenditureTypeId from projectIndexData when modal opens
  useEffect(() => {
    if (
      projectIndexData &&
      projectIndexData.project_id &&
      projectIndexData.expenditure_type_id
    ) {
      console.log(
        "[EditDocument] Populating project and expenditure type from projectIndexData:",
        {
          projectId: projectIndexData.project_id,
          expenditureTypeId: projectIndexData.expenditure_type_id,
        },
      );
      setSelectedProjectId(projectIndexData.project_id);
      setSelectedExpenditureTypeId(projectIndexData.expenditure_type_id);
    }
  }, [projectIndexData]);

  // Reset form when document changes - WITH LOADING GATES (ONLY ONCE)
  useEffect(() => {
    if (!document || !open) return;

    // Don't reset if already initialized (prevents overwriting user changes)
    if (formInitialized) {
      console.log("[EditDocument] Form already initialized, skipping reset");
      return;
    }

    // CRITICAL: Wait for all required data to load before populating form
    // This ensures dropdowns have their options available when values are set

    // Check if queries are still loading
    if (unitsLoading || beneficiariesLoading) {
      console.log("[EditDocument] Still loading basic data:", {
        unitsLoading,
        beneficiariesLoading,
      });
      return;
    }

    // If document has unit_id, also wait for projects to load
    if (document.unit_id && projectsLoading) {
      console.log(
        "[EditDocument] Still loading projects for unit:",
        document.unit_id,
      );
      return;
    }

    // If document has project_index_id, wait for project_index data to load
    if (document.project_index_id && projectIndexLoading) {
      console.log(
        "[EditDocument] Still loading project_index data:",
        document.project_index_id,
      );
      return;
    }

    console.log("[EditDocument] All data loaded, resetting form ONCE");

    const protocolDate = document.protocol_date
      ? new Date(document.protocol_date).toISOString().split("T")[0]
      : "";

    const originalProtocolDate = document.original_protocol_date
      ? new Date(document.original_protocol_date).toISOString().split("T")[0]
      : "";

    // Extract ESDIAN fields (preserve all entries)
    const esdianFieldsArray = Array.isArray(document.esdian)
      ? document.esdian
          .filter((value) => typeof value === "string" && value.trim() !== "")
          .map((value) => value.trim())
      : [];
    const esdianField1 = esdianFieldsArray[0] || "";
    const esdianField2 = esdianFieldsArray[1] || "";

    // Calculate initial recipients from beneficiary or employee payments
    const initialRecipients = (
      Array.isArray(beneficiaryPayments) ? beneficiaryPayments : []
    ).map((payment: any) => {
      // Check if this is employee payment data (has month field)
      if (payment.month) {
        // ΕΚΤΟΣ ΕΔΡΑΣ employee payment
        return {
          id: payment.id,
          employee_id: payment.employee_id,
          firstname: payment.firstname || "",
          lastname: payment.lastname || "",
          fathername: payment.fathername || "",
          afm: payment.afm || "",
          amount: parseFloat(payment.amount) || 0,
          month: payment.month || "",
          days: payment.days || 0,
          daily_compensation: payment.daily_compensation || 0,
          accommodation_expenses: payment.accommodation_expenses || 0,
          kilometers_traveled: payment.kilometers_traveled || 0,
          price_per_km: payment.price_per_km || 0.2,
          tickets_tolls_rental: payment.tickets_tolls_rental || 0,
          tickets_tolls_rental_entries:
            payment.tickets_tolls_rental_entries ||
            (payment.tickets_tolls_rental > 0
              ? [payment.tickets_tolls_rental]
              : []),
          net_payable: parseFloat(payment.amount) || 0,
          status: payment.status || "pending",
          secondary_text: payment.secondary_text || "",
          installment: "Προκαταβολή",
          installments: ["Προκαταβολή"],
          installmentAmounts: { Προκαταβολή: parseFloat(payment.amount) || 0 },
          regiondet: normalizeRegiondetForPaymentContext({
            value: payment.regiondet,
            paymentId: payment.id,
            projectIndexId:
              payment.project_index_id ?? document.project_index_id ?? null,
          }),
        };
      }

      // Standard beneficiary payment
      const beneficiaryData = Array.isArray(payment.beneficiaries)
        ? payment.beneficiaries[0]
        : payment.beneficiaries;
      const installmentKey = payment.installment || "Προκαταβολή";
      return {
        id: payment.id,
        beneficiary_id: payment.beneficiary_id,
        firstname: beneficiaryData?.name || "",
        lastname: beneficiaryData?.surname || "",
        fathername: beneficiaryData?.fathername || "",
        afm: beneficiaryData?.afm || "",
        amount: parseFloat(payment.amount) || 0,
        installment: installmentKey,
        installments: [installmentKey],
        installmentAmounts: {
          [installmentKey]: parseFloat(payment.amount) || 0,
        } as Record<string, number>,
        tickets_tolls_rental_entries: [],
        status: payment.status || "pending",
        secondary_text: payment.freetext || "",
        regiondet: normalizeRegiondetForPaymentContext({
          value:
            beneficiaryData?.regiondet ??
            (payment as any)?.regiondet ??
            null,
          paymentId: payment.id,
          projectIndexId:
            payment.project_index_id ?? document.project_index_id ?? null,
        }),
      };
    });

    // Fallback to document.recipients if payments were not fetched (avoid losing recipients on correction)
    const recipientsFromDocument =
      initialRecipients.length === 0 && Array.isArray(docAny?.recipients)
        ? (docAny.recipients as any[]).map((r) => {
            const amountNumber =
              typeof r.amount === "string"
                ? parseFloat(r.amount) || 0
                : Number(r.amount) || 0;
            const key = r.installment || r.month || "ΝΣΧΝΣΟΝΤΏΟΑ";
            return {
              ...r,
              amount: amountNumber,
              installment: key,
              installments: r.installments || [key],
              installmentAmounts: r.installmentAmounts || {
                [key]: amountNumber,
              },
              regiondet: normalizeRegiondetForPaymentContext({
                value: r.regiondet || (r as any).region || null,
                paymentId: r.id as number | string | undefined,
                projectIndexId:
                  (r as any).project_index_id ??
                  document.project_index_id ??
                  null,
              }),
            };
          })
        : [];

    const hydratedRecipients =
      initialRecipients.length > 0 ? initialRecipients : recipientsFromDocument;

    // Cache initial recipients for fallback usage during submission
    initialRecipientsRef.current = hydratedRecipients;

    // Calculate initial total from recipients or document
    const initialTotal =
      hydratedRecipients.length > 0
        ? hydratedRecipients.reduce(
            (sum: number, r: any) => sum + (parseFloat(r.amount) || 0),
            0,
          )
        : parseFloat(document.total_amount?.toString() || "0") || 0;

    // For correction mode, prepare to archive current protocol info
    const formData: Partial<DocumentForm> = {
      protocol_number_input: isCorrection
        ? ""
        : document.protocol_number_input || "",
      protocol_date: isCorrection ? "" : protocolDate,
      status: isCorrection ? "pending" : (document.status as any) || "draft",
      comments: document.comments || "",
      total_amount: initialTotal,
      esdian_field1: esdianField1,
      esdian_field2: esdianField2,
      esdian_fields: esdianFieldsArray,
      is_correction: isCorrection ? true : Boolean(document.is_correction),
      original_protocol_number: isCorrection
        ? document.protocol_number_input || ""
        : document.original_protocol_number || "",
      original_protocol_date: isCorrection
        ? protocolDate
        : originalProtocolDate,
      correction_reason: (document as any)?.correction_reason || "",
      recipients: hydratedRecipients,
      project_index_id: document.project_index_id || undefined, // KEEP original project_index.id for backend
      // Use document.unit_id if available, otherwise fall back to projectIndexData.monada_id
      unit_id: document.unit_id
        ? Number(document.unit_id)
        : projectIndexData?.monada_id
          ? Number(projectIndexData.monada_id)
          : undefined,
      expenditure_type_id: documentExpenditureTypeId || undefined, // Set expenditure type for dropdown display
    };

    const resolvedUnitId = document.unit_id
      ? Number(document.unit_id)
      : projectIndexData?.monada_id
        ? Number(projectIndexData.monada_id)
        : undefined;
    console.log("[EditDocument] Form data:", formData);
    console.log("[EditDocument] Unit ID resolution:", {
      documentUnitId: document.unit_id,
      projectIndexMonadaId: projectIndexData?.monada_id,
      resolvedUnitId: resolvedUnitId,
      source: document.unit_id
        ? "document.unit_id"
        : projectIndexData?.monada_id
          ? "projectIndexData.monada_id"
          : "none",
    });
    console.log(
      "[EditDocument] Document project_index_id:",
      document.project_index_id,
      "resolved project_id:",
      actualProjectId,
    );
    console.log(
      "[EditDocument] Units available:",
      units?.length,
      "first unit:",
      units?.[0],
    );
    form.reset(formData);

    // Force re-render of unit_id field by triggering watch
    setTimeout(() => {
      const currentValue = form.getValues("unit_id");
      console.log(
        "[EditDocument] After reset, unit_id value:",
        currentValue,
        "expected:",
        resolvedUnitId,
      );
    }, 0);

    // Set selectedProjectId and selectedExpenditureTypeId for dropdowns and queries
    if (actualProjectId) {
      setSelectedProjectId(actualProjectId);
      console.log(
        "[EditDocument] Set selectedProjectId to resolved project.id:",
        actualProjectId,
        "for geographic queries and dropdown display",
      );
    }

    if (documentExpenditureTypeId && !isNaN(documentExpenditureTypeId)) {
      setSelectedExpenditureTypeId(documentExpenditureTypeId);
      console.log(
        "[EditDocument] Set selectedExpenditureTypeId:",
        documentExpenditureTypeId,
      );
    }

    // CRITICAL FIX: Mark as initialized AFTER state is fully set to prevent race conditions
    // This ensures findAndUpdateProjectIndex has correct values when user changes dropdowns
    setFormInitialized(true);
  }, [
    document,
    open,
    form,
    isCorrection,
    unitsLoading,
    beneficiariesLoading,
    projectsLoading,
    projectIndexLoading,
    actualProjectId,
    beneficiaryPayments,
    units,
    projectIndexData,
    correctionReasonTemplate,
    docAny?.recipients,
    documentExpenditureTypeId,
    formInitialized,
  ]);

  // Initialize geographic selection dropdowns from document's region JSONB

  // Update or create correction mutation
  const updateMutation = useMutation({
    mutationFn: async (data: DocumentForm) => {
      if (!document?.id) throw new Error("No document ID");

      // Preserve recipients; only use fallback if recipients field is missing entirely (undefined/null)
      const recipientsPayload =
        data.recipients !== undefined && data.recipients !== null
          ? data.recipients
          : initialRecipientsRef.current || [];

      // Prefer dynamic esdian_fields; fall back to legacy fields if needed
      const esdianSource =
        Array.isArray(data.esdian_fields) && data.esdian_fields.length > 0
          ? data.esdian_fields
          : [data.esdian_field1, data.esdian_field2];

      const esdianCombined = esdianSource
        .map((value) => (value ?? "").trim())
        .filter((value) => value !== "");

      if (isCorrection) {
        // Correction mode: Create new corrected document
        const correctionPayload = {
          document_id: document.id,
          correction_reason: data.correction_reason || "",
          protocol_number_input: data.protocol_number_input || null,
          protocol_date: data.protocol_date || null,
          status: "pending",
          comments: data.comments || null,
          total_amount: data.total_amount,
          esdian: esdianCombined,
          recipients: recipientsPayload,
          project_index_id: data.project_index_id,
          unit_id: data.unit_id,
        };

        return await apiRequest(`/api/documents/${document.id}/correction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(correctionPayload),
        });
      } else {
        const validRecipients = (recipientsPayload || []).filter(
          (r) =>
            r.id ||
            r.firstname ||
            r.lastname ||
            r.afm ||
            (r.amount && r.amount > 0),
        );

        if (validRecipients.length === 0) {
          throw new Error("At least one recipient is required");
        }

        // Regular edit mode: Update existing document
        const documentPayload = {
          protocol_number_input: data.protocol_number_input || null,
          protocol_date: data.protocol_date || null,
          status: data.status,
          comments: data.comments || null,
          total_amount: data.total_amount,
          esdian: esdianCombined,
          is_correction: data.is_correction,
          original_protocol_number: data.original_protocol_number || null,
          original_protocol_date: data.original_protocol_date || null,
          updated_at: new Date().toISOString(),
          project_index_id: data.project_index_id,
          unit_id: data.unit_id,
        };

        // Update document first
        await apiRequest(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(documentPayload),
        });

        console.log(
          "[EditDocument] Sending recipients to backend:",
          JSON.stringify(validRecipients, null, 2),
        );
        await apiRequest(`/api/documents/${document.id}/beneficiaries`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipients: validRecipients }),
        });
      }
    },
    onSuccess: () => {
      setIsLoading(false);
      toast({
        title: "Επιτυχία",
        description: isCorrection
          ? "Η ορθή επανάληψη δημιουργήθηκε επιτυχώς. Προσθέστε τώρα το νέο πρωτόκολλο."
          : "Το έγγραφο ενημερώθηκε επιτυχώς",
      });

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/documents", document?.id, "beneficiaries"],
      });
      refetchPayments();

      // For corrections, trigger the protocol modal callback before closing
      if (isCorrection && onCorrectionSuccess && document?.id) {
        onCorrectionSuccess(document.id);
      }

      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error(
        `Error ${isCorrection ? "creating correction" : "updating document"}:`,
        error,
      );
      setIsLoading(false);
      toast({
        title: "Σφάλμα",
        description:
          error?.message ||
          `Παρουσιάστηκε σφάλμα κατά ${isCorrection ? "τη δημιουργία της διόρθωσης" : "την ενημέρωση του εγγράφου"}`,
        variant: "destructive",
      });
    },
  });

  // Function to find matching project_index entry and update form
  const findAndUpdateProjectIndex = async (
    projectId: number,
    unitId: number,
    expenditureTypeId: number,
  ) => {
    try {
      console.log("[EditDocument] Finding project_index for:", {
        projectId,
        unitId,
        expenditureTypeId,
      });

      const response = (await apiRequest(
        `/api/project-index/find/${projectId}/${unitId}/${expenditureTypeId}`,
      )) as {
        id: number;
        project_id: number;
        monada_id: number;
        expenditure_type_id: number;
      };

      if (response && response.id) {
        console.log(
          "[EditDocument] Found matching project_index:",
          response.id,
        );
        form.setValue("project_index_id", response.id);
        return response.id;
      } else {
        // Clear project_index_id if no match found
        form.setValue("project_index_id", undefined);
        return null;
      }
    } catch (error: any) {
      console.error("[EditDocument] Error finding project_index:", error);
      // Clear project_index_id to prevent saving with stale data
      form.setValue("project_index_id", undefined);
      toast({
        title: "Σφάλμα",
        description:
          error?.details ||
          "Δεν βρέθηκε αντίστοιχο έργο για αυτόν τον συνδυασμό. Επιλέξτε άλλο έργο ή τύπο δαπάνης.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = (data: DocumentForm) => {
    console.log("[EditDocument] ========== FORM SUBMIT ATTEMPT ==========");
    console.log(
      "[EditDocument] Form validation errors:",
      form.formState.errors,
    );
    console.log("[EditDocument] Form isValid:", form.formState.isValid);
    console.log("[EditDocument] Form isDirty:", form.formState.isDirty);
    console.log(
      "[EditDocument] Form isSubmitting:",
      form.formState.isSubmitting,
    );
    console.log("[EditDocument] Submitting data:", data);
    console.log(
      "[EditDocument] project_index_id in data:",
      data.project_index_id,
    );
    console.log("[EditDocument] =============================================");
    if (!validateBeneficiaryRegions()) {
      return;
    }
    if (!isCorrection) {
      const recipients = Array.isArray(data.recipients) ? data.recipients : [];
      const validRecipients = recipients.filter(
        (r: any) =>
          r?.id ||
          r?.firstname ||
          r?.lastname ||
          r?.afm ||
          (r?.amount && r.amount > 0),
      );
      if (validRecipients.length === 0) {
        toast({
          title: "Σφάλμα",
          description: "Πρέπει να υπάρχει τουλάχιστον ένας δικαιούχος.",
          variant: "destructive",
        });
        return;
      }
    }
    setIsLoading(true);
    updateMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  // Add recipient
  const addRecipient = () => {
    const currentRecipients = form.getValues("recipients") || [];

    if (currentRecipients.length >= 15) {
      toast({
        title: "Προσοχή",
        description: "Μέγιστος αριθμός δικαιούχων: 15",
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
        installment: "ΕΦΑΠΑΞ",
        installments: ["ΕΦΑΠΑΞ"],
        installmentAmounts: { ΕΦΑΠΑΞ: 0 },
        tickets_tolls_rental_entries: [],
        secondary_text: "",
        regiondet: null,
      },
    ]);
  };

  // Remove recipient
  const removeRecipient = (index: number) => {
    const recipients = form.getValues("recipients") || [];
    recipients.splice(index, 1);
    form.setValue("recipients", [...recipients]);
  };

  const currentStatus = form.watch("status");
  const statusOption = STATUS_OPTIONS.find(
    (option) => option.value === currentStatus,
  );

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {isCorrection ? (
              <>
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Δημιουργία Ορθής Επανάληψης
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Επεξεργασία Εγγράφου
              </>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">#{document.id}</span>
              {document.protocol_number_input && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm font-mono truncate max-w-xs">
                    {document.protocol_number_input}
                  </span>
                </>
              )}
              {statusOption && (
                <Badge className={statusOption.color} variant="secondary">
                  {statusOption.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isCorrection
                ? "Συμπληρώστε τα στοιχεία για τη δημιουργία ορθής επανάληψης του εγγράφου"
                : "Επεξεργασία στοιχείων και μεταδεδομένων του εγγράφου"}
            </p>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Error Summary */}
              {Object.keys(form.formState.errors).length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Σφάλματα φόρμας</AlertTitle>
                  <AlertDescription>
                    <p className="text-sm mb-2">
                      Παρακαλώ διορθώστε τα παρακάτω πεδία:
                    </p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {Object.entries(form.formState.errors).map(
                        ([key, error]) => (
                          <li key={key}>
                            <span className="font-medium">
                              {key.replace(/_/g, " ")}:
                            </span>{" "}
                            {error.message?.toString() || "Μη έγκυρη τιμή"}
                          </li>
                        ),
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {(isCorrection || form.watch("is_correction")) && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-700">
                      Στοιχεία Αρχικού Εγγράφου
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="original_protocol_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Αρχικός Αριθμός Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                readOnly={isCorrection}
                                className={
                                  isCorrection
                                    ? "bg-muted cursor-not-allowed"
                                    : ""
                                }
                                data-testid="input-original-protocol-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="original_protocol_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Αρχική Ημερομηνία Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                readOnly={isCorrection}
                                className={
                                  isCorrection
                                    ? "bg-muted cursor-not-allowed"
                                    : ""
                                }
                                data-testid="input-original-protocol-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {isCorrection && (
                <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 border-amber-200">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-900">
                      <AlertCircle className="w-4 h-4" />
                      Λόγος Διόρθωσης
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge
                        variant="outline"
                        className="bg-white text-orange-700 border-orange-200"
                      >
                        Πρωτόκολλο προς διόρθωση:{" "}
                        {oldProtocolNumber || "Δεν έχει οριστεί"}
                      </Badge>
                      {originalProtocolDateDisplay ? (
                        <Badge
                          variant="outline"
                          className="bg-white text-orange-700 border-orange-200"
                        >
                          Ημ/νία πρωτοκόλλου: {originalProtocolDateDisplay}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        Χρησιμοποίησε το έτοιμο κείμενο και συνέχισε την
                        αιτιολόγηση.
                      </span>
                    </div>
                    <FormField
                      control={form.control}
                      name="correction_reason"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-3">
                            <FormLabel className="mb-0">
                              Αιτιολογία Ορθής Επανάληψης *
                            </FormLabel>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 px-3"
                              onClick={() =>
                                form.setValue(
                                  "correction_reason",
                                  correctionReasonTemplate,
                                  { shouldDirty: true },
                                )
                              }
                            >
                              Χρήση προτύπου
                            </Button>
                          </div>
                          <FormControl>
                            <Textarea
                              {...field}
                              className="min-h-[100px]"
                              placeholder={
                                correctionReasonTemplate ||
                                "Εισάγετε τον λόγο για τον οποίο δημιουργείται η ορθή επανάληψη..."
                              }
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Το πεδίο ξεκινά με το πρότυπο κείμενο για το παλιό
                            πρωτόκολλο· συνέχισε με τα αίτια της ορθής
                            επανάληψης.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Document Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Στοιχεία Εγγράφου
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Protocol fields: Only show in edit mode, not in correction mode */}
                  {!isCorrection && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="protocol_number_input"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="π.χ. 12345/2025"
                                {...field}
                                data-testid="input-protocol-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="protocol_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ημερομηνία Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-protocol-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Κατάσταση</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Επιλέξτε κατάσταση">
                                  {statusOption && (
                                    <Badge className={statusOption.color}>
                                      {statusOption.label}
                                    </Badge>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  <Badge className={option.color}>
                                    {option.label}
                                  </Badge>
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
                      name="total_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm">
                            <Euro className="w-4 h-4" />
                            Συνολικό Ποσό
                          </FormLabel>
                          <div className="flex items-center h-10 px-3 py-2 rounded-md border border-input bg-muted">
                            <span className="text-lg font-bold text-primary">
                              € {(field.value || 0).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Υπολογίζεται αυτόματα από τα ποσά των δικαιούχων
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Project and Unit Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Έργο & Μονάδα</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Επιλέξτε τη μονάδα, το έργο και τον τύπο δαπάνης
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="unit_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Μονάδα</FormLabel>
                          <Select
                            key={`unit-select-${document?.id}-${formInitialized}`}
                            onValueChange={(value) => {
                              const numericValue = parseInt(value);
                              field.onChange(numericValue);
                              // Clear project and expenditure type selection when unit changes
                              form.setValue("project_index_id", undefined);
                              setSelectedProjectId(null);
                              setSelectedExpenditureTypeId(null);
                              // Invalidate projects query to fetch new projects
                              queryClient.invalidateQueries({
                                queryKey: ["projects-working", numericValue],
                              });
                            }}
                            value={
                              field.value !== undefined && field.value !== null
                                ? String(field.value)
                                : ""
                            }
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-unit">
                                <SelectValue placeholder="Επιλέξτε μονάδα" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {units &&
                                Array.isArray(units) &&
                                units.map((unit: any) => (
                                  <SelectItem
                                    key={unit.id}
                                    value={String(unit.id)}
                                  >
                                    {unit.name || unit.unit}
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
                      name="project_index_id"
                      render={() => (
                        <FormItem>
                          <FormLabel>Έργο</FormLabel>
                          <Select
                            onValueChange={async (value) => {
                              const projectId = parseInt(value);
                              setSelectedProjectId(projectId);

                              // Find and update project_index_id if we have all required values
                              const unitId = form.getValues("unit_id");
                              if (
                                projectId &&
                                unitId &&
                                selectedExpenditureTypeId
                              ) {
                                await findAndUpdateProjectIndex(
                                  projectId,
                                  unitId,
                                  selectedExpenditureTypeId,
                                );
                              }
                            }}
                            value={selectedProjectId?.toString() || ""}
                            disabled={!selectedUnitId}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-project">
                                <SelectValue
                                  placeholder={
                                    !selectedUnitId
                                      ? "Επιλέξτε πρώτα μονάδα"
                                      : "Επιλέξτε έργο"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects &&
                                Array.isArray(projects) &&
                                projects.map((project: any) => (
                                  <SelectItem
                                    key={project.id}
                                    value={project.id.toString()}
                                  >
                                    {project.event_description ||
                                      project.name ||
                                      project.project_title ||
                                      `Project ${project.mis}`}{" "}
                                    ({project.na853})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>Τύπος Δαπάνης</FormLabel>
                      <Select
                        onValueChange={async (value) => {
                          const expenditureTypeId = parseInt(value);
                          if (!isNaN(expenditureTypeId)) {
                            setSelectedExpenditureTypeId(expenditureTypeId);

                            // Find and update project_index_id if we have all required values
                            const unitId = form.getValues("unit_id");
                            if (
                              selectedProjectId &&
                              unitId &&
                              expenditureTypeId
                            ) {
                              await findAndUpdateProjectIndex(
                                selectedProjectId,
                                unitId,
                                expenditureTypeId,
                              );
                            }
                          }
                        }}
                        value={selectedExpenditureTypeId?.toString() || ""}
                        disabled={!selectedProjectId}
                        onOpenChange={(open) => {
                          if (open) {
                            console.log(
                              "[EditDocument] Expenditure Select opened:",
                              {
                                selectedExpenditureTypeId,
                                value: selectedExpenditureTypeId
                                  ? selectedExpenditureTypeId.toString()
                                  : undefined,
                                expenditureTypesCount: expenditureTypes?.length,
                                expenditureTypes,
                                hasMatchingItem: expenditureTypes?.some(
                                  (t: any) =>
                                    t.id === selectedExpenditureTypeId,
                                ),
                              },
                            );
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-expenditure-type">
                          <SelectValue
                            placeholder={
                              !selectedProjectId
                                ? "Επιλέξτε πρώτα έργο"
                                : "Επιλέξτε τύπο δαπάνης"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {expenditureTypes &&
                            Array.isArray(expenditureTypes) &&
                            expenditureTypes.map((type: any) => (
                              <SelectItem
                                key={type.id}
                                value={type.id.toString()}
                              >
                                {type.expenditure_types ||
                                  type.expenditure_types_minor ||
                                  `Τύπος #${type.id}`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Επιλέξτε τον τύπο δαπάνης για το έργο
                      </p>
                    </FormItem>
                  </div>
                </CardContent>
              </Card>

              {/* Beneficiaries Management Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Διαχείριση Δικαιούχων
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Προσθέστε ή επεξεργαστείτε τους δικαιούχους και τα ποσά
                        τους
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Επεξεργασία των στοιχείων των δικαιούχων (
                      {form.watch("recipients")?.length || 0})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addRecipient}
                      data-testid="button-add-recipient"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Προσθήκη Δικαιούχου
                    </Button>
                  </div>

                  <Separator />

                  {(!form.watch("recipients") ||
                    form.watch("recipients")?.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Δεν υπάρχουν δικαιούχοι</p>
                      <p className="text-sm">
                        Πατήστε &quot;Προσθήκη Δικαιούχου&quot; για να
                        προσθέσετε
                      </p>
                    </div>
                  )}

                  {form.watch("recipients")?.map((recipient, index) => (
                    <Card
                      key={index}
                      className={
                        "border-2 transition-shadow hover:shadow-md " +
                        (regiondetErrors[index] ? "border-destructive" : "")
                      }
                    >
                      <CardHeader className="pb-3 bg-muted/30">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {index + 1}
                            </div>
                            <CardTitle className="text-base font-semibold">
                              Δικαιούχος #{index + 1}
                            </CardTitle>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(index)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-remove-recipient-${index}`}
                            aria-label={`Αφαίρεση δικαιούχου ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Identity fields - compact row layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <FormField
                            control={form.control}
                            name={`recipients.${index}.firstname`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Όνομα *</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    data-testid={`input-recipient-firstname-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`recipients.${index}.lastname`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Επώνυμο *</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    data-testid={`input-recipient-lastname-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`recipients.${index}.fathername`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Πατρώνυμο</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    data-testid={`input-recipient-fathername-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div>
                            <FormLabel>ΑΦΜ *</FormLabel>
                            <SimpleAFMAutocomplete
                              expenditureType=""
                              value={
                                form.watch(`recipients.${index}.afm`) || ""
                              }
                              onChange={(afm) => {
                                form.setValue(`recipients.${index}.afm`, afm);
                              }}
                              onSelectPerson={(personData) => {
                                if (personData) {
                                  form.setValue(
                                    `recipients.${index}.firstname`,
                                    personData.name || "",
                                  );
                                  form.setValue(
                                    `recipients.${index}.lastname`,
                                    personData.surname || "",
                                  );
                                  form.setValue(
                                    `recipients.${index}.fathername`,
                                    personData.fathername || "",
                                  );
                                  const secondaryText =
                                    (personData as any).freetext ||
                                    (personData as any).attribute ||
                                    "";
                                  if (secondaryText) {
                                    form.setValue(
                                      `recipients.${index}.secondary_text`,
                                      secondaryText,
                                    );
                                  }
                                }
                              }}
                              placeholder="Αναζήτηση με ΑΦΜ..."
                              className="w-full"
                            />
                            <FormField
                              control={form.control}
                              name={`recipients.${index}.afm`}
                              render={() => (
                                <FormItem>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Amount and Installment fields - only for non-ΕΚΤΟΣ ΕΔΡΑΣ */}
                        {!isEktosEdras && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`recipients.${index}.amount`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-1">
                                    <Euro className="w-3 h-3" />
                                    Ποσό *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      onChange={(e) =>
                                        field.onChange(
                                          parseFloat(e.target.value) || 0,
                                        )
                                      }
                                      data-testid={`input-recipient-amount-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`recipients.${index}.installment`}
                              render={({ field }) => {
                                // Get the expenditure type name to determine available installments
                                const expenditureType = allExpenditureTypes?.find(
                                  (t: any) => t.id === selectedExpenditureTypeId,
                                );
                                const expenditureTypeName =
                                  expenditureType?.expenditure_types ||
                                  expenditureType?.expenditure_types_minor;
                                const availableInstallments =
                                  getAvailableInstallments(expenditureTypeName);
                                // Normalize the saved value for housing allowance (e.g., "12" → "ΤΡΙΜΗΝΟ 12")
                                const normalizedValue = normalizeInstallmentValue(
                                  field.value,
                                  expenditureTypeName,
                                );

                                return (
                                  <FormItem>
                                    <FormLabel>Δόση</FormLabel>
                                    <Select
                                      value={normalizedValue}
                                      onValueChange={(value) => {
                                        // When selecting, store as-is (either "ΤΡΙΜΗΝΟ 12" or "ΕΦΑΠΑΞ" etc.)
                                        field.onChange(value);
                                      }}
                                    >
                                      <FormControl>
                                        <SelectTrigger
                                          data-testid={`select-recipient-installment-${index}`}
                                        >
                                          <SelectValue placeholder="Επιλέξτε δόση" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {availableInstallments.map(
                                          (installment: string) => (
                                            <SelectItem
                                              key={installment}
                                              value={installment}
                                            >
                                              {installment}
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          </div>
                        )}

                        {/* Γεωγραφική επιλογή - shown outside ΕΚΤΟΣ ΕΔΡΑΣ section for non-ΕΚΤΟΣ ΕΔΡΑΣ documents */}
                        {!isEktosEdras && (() => {
                          const saveKey =
                            recipient?.beneficiary_id ?? recipient?.id;
                          const saveState = regiondetSaveState[
                            String(saveKey)
                          ] || { status: "idle" };
                          const geoError =
                            regiondetErrors[index] ||
                            (saveState.status === "error"
                              ? saveState.message
                              : undefined);
                          return (
                            <div className="md:col-span-3">
                              <BeneficiaryGeoSelector
                                regions={availableRegions}
                                regionalUnits={availableUnits}
                                municipalities={availableMunicipalities}
                                value={
                                  recipient?.regiondet as RegiondetSelection
                                }
                                onChange={(value) =>
                                  handleRecipientGeoChange(index, value)
                                }
                                required={!recipient?.employee_id}
                                loading={
                                  regionsLoading || regiondetMutation.isPending
                                }
                                error={geoError || undefined}
                                onRetry={
                                  saveState.status === "error" && saveKey
                                    ? () => retryRegiondetSave(Number(saveKey))
                                    : undefined
                                }
                              />
                            </div>
                          );
                        })()}

                        {/* ΕΚΤΟΣ ΕΔΡΑΣ specific fields */}
                        {isEktosEdras && (
                          <div className="space-y-6 mt-6 p-6 bg-emerald-50/50 rounded-lg border-2 border-emerald-200 border-l-4 border-l-emerald-500">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="h-8 w-1 bg-emerald-600 rounded-full" />
                              <h4 className="font-semibold text-emerald-900 text-base">
                                Στοιχεία Μετακίνησης
                              </h4>
                            </div>

                            {/* Γεωγραφική επιλογή - inside ΕΚΤΟΣ ΕΔΡΑΣ section */}
                            {(() => {
                              const saveKey =
                                recipient?.beneficiary_id ?? recipient?.id;
                              const saveState = regiondetSaveState[
                                String(saveKey)
                              ] || { status: "idle" };
                              const geoError =
                                regiondetErrors[index] ||
                                (saveState.status === "error"
                                  ? saveState.message
                                  : undefined);
                              return (
                                <div className="mb-4">
                                  <BeneficiaryGeoSelector
                                    regions={availableRegions}
                                    regionalUnits={availableUnits}
                                    municipalities={availableMunicipalities}
                                    value={
                                      recipient?.regiondet as RegiondetSelection
                                    }
                                    onChange={(value) =>
                                      handleRecipientGeoChange(index, value)
                                    }
                                    required={!recipient?.employee_id}
                                    loading={
                                      regionsLoading || regiondetMutation.isPending
                                    }
                                    error={geoError || undefined}
                                    onRetry={
                                      saveState.status === "error" && saveKey
                                        ? () => retryRegiondetSave(Number(saveKey))
                                        : undefined
                                    }
                                  />
                                </div>
                              );
                            })()}

                            {/* Period, Days, Daily Compensation - Responsive row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name={`recipients.${index}.month` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                      Περίοδος (Μήνες)
                                    </FormLabel>
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

                              <FormField
                                control={form.control}
                                name={`recipients.${index}.days` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Ημέρες</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min="0"
                                        onChange={(e) =>
                                          field.onChange(
                                            parseInt(e.target.value) || 0,
                                          )
                                        }
                                        data-testid={`input-recipient-days-${index}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={
                                  `recipients.${index}.daily_compensation` as any
                                }
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium whitespace-nowrap">
                                      Συνολική Ημερήσια Αποζημίωση (€)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        onChange={(e) =>
                                          field.onChange(
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        data-testid={`input-recipient-daily-compensation-${index}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Accommodation & Travel Section */}
                            <div>
                              <h5 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <div className="h-px flex-1 bg-border" />
                                Δαπάνες Διαμονής & Μετακίνησης
                                <div className="h-px flex-1 bg-border" />
                              </h5>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name={
                                  `recipients.${index}.accommodation_expenses` as any
                                }
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Δαπάνες Διαμονής (€)</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        onChange={(e) =>
                                          field.onChange(
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        data-testid={`input-recipient-accommodation-${index}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={
                                  `recipients.${index}.kilometers_traveled` as any
                                }
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Χιλιόμετρα</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        onChange={(e) =>
                                          field.onChange(
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        data-testid={`input-recipient-kilometers-${index}`}
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
                                    Εισιτήρια/Διόδια/Ενοικίαση (€)
                                  </FormLabel>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const currentEntries =
                                        form.getValues(
                                          `recipients.${index}.tickets_tolls_rental_entries` as any,
                                        ) || [];
                                      form.setValue(
                                        `recipients.${index}.tickets_tolls_rental_entries` as any,
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
                                      `recipients.${index}.tickets_tolls_rental_entries` as any,
                                    ) || [];

                                  // If no entries exist, check for legacy value to migrate
                                  if (entries.length === 0) {
                                    const singleValue = form.getValues(
                                      `recipients.${index}.tickets_tolls_rental` as any,
                                    );
                                    // Only initialize if there's a legacy value, otherwise show nothing
                                    if (singleValue && singleValue > 0) {
                                      form.setValue(
                                        `recipients.${index}.tickets_tolls_rental_entries` as any,
                                        [singleValue],
                                      );
                                      return null;
                                    }
                                    // Empty array - don't show any fields, user must click + to add
                                    return (
                                      <div className="text-xs text-muted-foreground italic">
                                        Κλικ στο + για προσθήκη
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="space-y-1">
                                      {entries.map(
                                        (entry: number, entryIndex: number) => (
                                          <div
                                            key={entryIndex}
                                            className="flex gap-1"
                                          >
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={entry}
                                              onChange={(e) => {
                                                const currentEntries =
                                                  form.getValues(
                                                    `recipients.${index}.tickets_tolls_rental_entries` as any,
                                                  ) || [];
                                                const newEntries = [
                                                  ...currentEntries,
                                                ];
                                                newEntries[entryIndex] =
                                                  parseFloat(e.target.value) ||
                                                  0;
                                                form.setValue(
                                                  `recipients.${index}.tickets_tolls_rental_entries` as any,
                                                  newEntries,
                                                );

                                                // Calculate sum and update tickets_tolls_rental
                                                const sum = newEntries.reduce(
                                                  (a: number, b: number) =>
                                                    a + b,
                                                  0,
                                                );
                                                form.setValue(
                                                  `recipients.${index}.tickets_tolls_rental` as any,
                                                  sum,
                                                );
                                              }}
                                              className="flex-1"
                                              data-testid={`input-recipient-ticket-entry-${index}-${entryIndex}`}
                                            />
                                            {entries.length > 1 && (
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const currentEntries =
                                                    form.getValues(
                                                      `recipients.${index}.tickets_tolls_rental_entries` as any,
                                                    ) || [];
                                                  const newEntries =
                                                    currentEntries.filter(
                                                      (_: any, i: number) =>
                                                        i !== entryIndex,
                                                    );
                                                  form.setValue(
                                                    `recipients.${index}.tickets_tolls_rental_entries` as any,
                                                    newEntries,
                                                  );

                                                  // Calculate sum and update tickets_tolls_rental
                                                  const sum = newEntries.reduce(
                                                    (a: number, b: number) =>
                                                      a + b,
                                                    0,
                                                  );
                                                  form.setValue(
                                                    `recipients.${index}.tickets_tolls_rental` as any,
                                                    sum,
                                                  );
                                                }}
                                                className="h-10 w-10 p-0"
                                                data-testid={`button-remove-ticket-entry-${index}-${entryIndex}`}
                                              >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                              </Button>
                                            )}
                                          </div>
                                        ),
                                      )}
                                      {entries.length > 1 && (
                                        <div className="text-xs text-muted-foreground pt-1 border-t">
                                          Σύνολο: €
                                          {entries
                                            .reduce(
                                              (a: number, b: number) => a + b,
                                              0,
                                            )
                                            .toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            <Separator className="my-4" />

                            {/* Tax Deduction Section */}
                            <div>
                              <h5 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <div className="h-px flex-1 bg-border" />
                                Φορολογικές Παρακρατήσεις
                                <div className="h-px flex-1 bg-border" />
                              </h5>

                              {/* 2% Withholding Tax Section */}
                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name={
                                    `recipients.${index}.has_2_percent_deduction` as any
                                  }
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={(checked) => {
                                            field.onChange(checked);
                                            // Trigger recalculation
                                            const recipient = form.getValues(
                                              `recipients.${index}` as any,
                                            );
                                            const days =
                                              parseFloat(
                                                recipient.days?.toString() || "0",
                                              ) || 0;
                                            const dailyComp =
                                              parseFloat(
                                                recipient.daily_compensation?.toString() ||
                                                  "0",
                                              ) || 0;
                                            const accommodation =
                                              parseFloat(
                                                recipient.accommodation_expenses?.toString() ||
                                                  "0",
                                              ) || 0;
                                            const kilometers =
                                              parseFloat(
                                                recipient.kilometers_traveled?.toString() ||
                                                  "0",
                                              ) || 0;
                                            const pricePerKm =
                                              parseFloat(
                                                recipient.price_per_km?.toString() || "0.2",
                                              ) || 0.2;
                                            const tickets =
                                              parseFloat(
                                                recipient.tickets_tolls_rental?.toString() ||
                                                  "0",
                                              ) || 0;

                                            const totalExpense =
                                              dailyComp +
                                              accommodation +
                                              kilometers * pricePerKm +
                                              tickets;

                                            const withholdingBase = isEktosEdras
                                              ? dailyComp
                                              : totalExpense;
                                            const deduction = checked
                                              ? withholdingBase * 0.02
                                              : 0;
                                            const netPayable =
                                              totalExpense - deduction;

                                            form.setValue(
                                              `recipients.${index}.total_expense` as any,
                                              totalExpense,
                                              { shouldValidate: false },
                                            );
                                            form.setValue(
                                              `recipients.${index}.deduction_2_percent` as any,
                                              deduction,
                                              { shouldValidate: false },
                                            );
                                            form.setValue(
                                              `recipients.${index}.net_payable` as any,
                                              netPayable,
                                              { shouldValidate: false },
                                            );
                                            form.setValue(
                                              `recipients.${index}.amount` as any,
                                              netPayable,
                                              { shouldValidate: false },
                                            );
                                          }}
                                          data-testid={`checkbox-2percent-${index}`}
                                        />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                        <FormLabel>
                                          Παρακράτηση 2% (Φόρος Προκαταβολής)
                                        </FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                          {isEktosEdras
                                            ? "Εφαρμογή παρακράτησης 2% μόνο στην ημερήσια αποζημίωση (συνολικό ποσό)"
                                            : "Εφαρμογή παρακράτησης 2% επί της συνολικής δαπάνης"}
                                        </p>
                                      </div>
                                    </FormItem>
                                  )}
                                />

                                {/* Calculated Fields Display */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-md border">
                                  <div>
                                    <FormLabel className="text-xs font-medium text-muted-foreground">
                                      Συνολική Δαπάνη
                                    </FormLabel>
                                    <div className="mt-1 flex items-center h-9 px-3 rounded-md bg-background border">
                                      <span className="font-semibold text-sm">
                                        €{" "}
                                        {(
                                          form.watch(
                                            `recipients.${index}.total_expense` as any,
                                          ) || 0
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <FormLabel className="text-xs font-medium text-muted-foreground">
                                      Παρακράτηση 2%
                                    </FormLabel>
                                    <div className="mt-1 flex items-center h-9 px-3 rounded-md bg-background border">
                                      <span className="font-semibold text-sm text-amber-700">
                                        €{" "}
                                        {(
                                          form.watch(
                                            `recipients.${index}.deduction_2_percent` as any,
                                          ) || 0
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <FormLabel className="text-xs font-medium text-muted-foreground">
                                      Καθαρό Πληρωτέο
                                    </FormLabel>
                                    <div className="mt-1 flex items-center h-9 px-3 rounded-md bg-emerald-100 border border-emerald-300">
                                      <span className="font-bold text-sm text-emerald-700">
                                        €{" "}
                                        {(
                                          form.watch(
                                            `recipients.${index}.net_payable` as any,
                                          ) || 0
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              {/* Εσωτερική Διανομή Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Εσωτερική Διανομή</CardTitle>
                </CardHeader>
                <CardContent>
                  <EsdianFieldsWithSuggestions form={form} user={user} />
                </CardContent>
              </Card>

              {/* Comments Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Σχόλια</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Σχόλια</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Προσθέστε επιπλέον πληροφορίες ή διευκρινίσεις για το έγγραφο."
                            className="min-h-[100px]"
                            {...field}
                            data-testid="textarea-comments"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </form>
          </Form>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 border-t bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="button-cancel"
            className="w-full sm:w-auto"
          >
            <X className="w-4 h-4 mr-2" />
            Ακύρωση
          </Button>
          <Button
            type="submit"
            disabled={isLoading || form.formState.isSubmitting}
            data-testid="button-save"
            className="w-full sm:w-auto"
            onClick={form.handleSubmit(handleSubmit)}
          >
            {isLoading || form.formState.isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>Αποθήκευση εγγράφου...</span>
                <span className="sr-only">Παρακαλώ περιμένετε</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isCorrection
                  ? "Δημιουργία Ορθής Επανάληψης"
                  : "Αποθήκευση Αλλαγών"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
