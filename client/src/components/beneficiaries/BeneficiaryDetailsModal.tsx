import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  MapPin, 
  FileText, 
  Calendar, 
  Hash,
  X,
  CreditCard,
  DollarSign,
  Copy,
  Receipt,
  Edit3,
  Save,
  Plus,
  AlertCircle,
  HardHat,
  Search,
  ChevronsUpDown,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import type { Beneficiary } from "@shared/schema";
import { insertBeneficiarySchema } from "@shared/schema";
import { z } from "zod";
import { BeneficiaryGeoSelector } from "@/components/documents/components/BeneficiaryGeoSelector";
import {
  isRegiondetComplete,
  mergeRegiondetPreservingPayments,
  normalizeRegiondetEntry,
  type RegiondetSelection,
} from "@/components/documents/utils/beneficiary-geo";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";

interface BeneficiaryDetailsModalProps {
  beneficiary: Beneficiary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditMode?: boolean;
  onCreateBeneficiary?: (data: any) => void;
  onCreatePaymentDocument?: (beneficiaryData: { firstname: string; lastname: string; fathername: string; afm: string; beneficiaryId?: number; regiondet?: RegiondetSelection | null }) => void;
}

// Form schema for editing beneficiaries (omit auto-generated fields)
const beneficiaryEditSchema = insertBeneficiarySchema.omit({ 
  id: true, 
  created_at: true, 
  updated_at: true,
  afm_hash: true, // afm_hash is computed server-side, not required in form
  date: true, // date is auto-generated
  regiondet: true, // regiondet is computed from geographic_areas
}).extend({
  fathername: z.string().optional(), // Allow optional fathername
  adeia: z.number().optional(), // Allow optional adeia (license number)
  ceng1: z.number().nullable().optional(), // Engineer 1 foreign key
  ceng2: z.number().nullable().optional(), // Engineer 2 foreign key
  onlinefoldernumber: z.string().optional(),
  freetext: z.string().optional(),
  geographic_areas: z.array(z.string()).optional(), // Geographic selections for regiondet
});

type BeneficiaryEditForm = z.infer<typeof beneficiaryEditSchema>;

// Helper function to format regiondet JSONB data for display
const formatRegiondet = (regiondet: any): { regions: string[], regionalUnits: string[], municipalities: string[] } => {
  if (!regiondet) return { regions: [], regionalUnits: [], municipalities: [] };
  
  const result = { regions: [] as string[], regionalUnits: [] as string[], municipalities: [] as string[] };
  const regiondetArray = Array.isArray(regiondet) ? regiondet : [regiondet];
  
  // Use Sets to avoid duplicates when merging multiple entries
  const regionSet = new Set<string>();
  const unitSet = new Set<string>();
  const municSet = new Set<string>();
  
  regiondetArray.forEach((entry: any) => {
    if (!entry || typeof entry !== 'object') return;
    
    // Extract region names
    if (entry.regions && Array.isArray(entry.regions)) {
      entry.regions.forEach((region: any) => {
        if (region.name) {
          regionSet.add(region.name);
        }
      });
    }
    
    // Extract regional unit names
    if (entry.regional_units && Array.isArray(entry.regional_units)) {
      entry.regional_units.forEach((unit: any) => {
        if (unit.name) {
          unitSet.add(unit.name);
        }
      });
    }
    
    // Extract municipality names
    if (entry.municipalities && Array.isArray(entry.municipalities)) {
      entry.municipalities.forEach((muni: any) => {
        if (muni.name) {
          municSet.add(muni.name);
        }
      });
    }
  });
  
  result.regions = Array.from(regionSet);
  result.regionalUnits = Array.from(unitSet);
  result.municipalities = Array.from(municSet);
  
  return result;
};

interface PaymentRecord {
  id: number;
  beneficiary_id: number;
  installment: string;
  amount: string;
  status: string;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
  expenditure_type?: string;
  protocol?: string;
  freetext?: string | null;
}

interface EngineerComboboxProps {
  engineers: any[];
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  testId?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

function EngineerCombobox({ engineers, value, onValueChange, placeholder = "Επιλέξτε...", testId, isLoading = false, error = null, onRetry }: EngineerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const selectedEngineer = value && engineers?.length > 0 
    ? engineers.find((eng) => eng?.id === value)
    : null;
  
  const filteredEngineers = useMemo(() => {
    if (!Array.isArray(engineers) || engineers.length === 0) return [];
    if (!searchTerm) return engineers;
    
    const term = searchTerm.toLowerCase();
    return engineers.filter((eng: any) => {
      const fullName = `${eng?.surname || ''} ${eng?.name || ''}`.toLowerCase();
      const reverseName = `${eng?.name || ''} ${eng?.surname || ''}`.toLowerCase();
      return fullName.includes(term) || reverseName.includes(term);
    });
  }, [engineers, searchTerm]);

  const handleSelect = useCallback((engId: number | null) => {
    onValueChange(engId);
    setIsOpen(false);
    setSearchTerm("");
  }, [onValueChange]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className="w-full justify-between"
        data-testid={testId}
        onClick={handleToggle}
        disabled={isLoading}
      >
        <span className="truncate">
          {isLoading 
            ? "Φόρτωση μηχανικών..."
            : selectedEngineer 
              ? `${selectedEngineer.surname} ${selectedEngineer.name}`
              : placeholder}
        </span>
        {isLoading ? (
          <div className="ml-2 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-lg z-[9999]">
          {error ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Σφάλμα φόρτωσης μηχανικών</span>
              </div>
              {onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="w-full"
                >
                  Επανάληψη
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Αναζήτηση μηχανικού..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsOpen(false);
                      setSearchTerm("");
                    }
                  }}
                  className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {!Array.isArray(engineers) || engineers.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Φόρτωση μηχανικών...
                  </div>
                ) : filteredEngineers.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Δεν βρέθηκαν μηχανικοί
                  </div>
                ) : (
                  <div className="p-1">
                    <button
                      type="button"
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      onClick={() => handleSelect(null)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                      Κανένας
                    </button>
                    {filteredEngineers.map((eng: any) => (
                      <button
                        type="button"
                        key={eng.id}
                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                        onClick={() => handleSelect(eng.id)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", value === eng.id ? "opacity-100" : "opacity-0")} />
                        {eng.surname} {eng.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function BeneficiaryDetailsModal({ 
  beneficiary, 
  open, 
  onOpenChange,
  initialEditMode = false,
  onCreateBeneficiary,
  onCreatePaymentDocument
}: BeneficiaryDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Retry function for engineer loading (IMPORTANT #6: Error handling)
  const handleRetryLoadEngineers = useCallback(() => {
    queryClient.refetchQueries({ queryKey: ["/api/employees/engineers"] });
  }, [queryClient]);
  
  // Determine if this is a create operation (no beneficiary provided)
  const isCreateMode = !beneficiary;
  
  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [regiondetSelection, setRegiondetSelection] = useState<RegiondetSelection | null>(null);
  const regiondetSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRegiondetValueRef = useRef<RegiondetSelection | null>(null);
  const [regiondetStatus, setRegiondetStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [regiondetError, setRegiondetError] = useState<string | null>(null);
  
  // Document modal state
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<any>(null);
  
  // Initialize form with react-hook-form (MOVED BEFORE CONDITIONAL RETURN)
  const form = useForm<BeneficiaryEditForm>({
    resolver: zodResolver(beneficiaryEditSchema),
    mode: "onBlur", // Enable real-time validation on field blur
    reValidateMode: "onChange", // Re-validate on change after first validation
    defaultValues: {
      afm: "",
      surname: "",
      name: "",
      fathername: "",
      adeia: undefined,
      ceng1: null,
      ceng2: null,
      freetext: "",
      geographic_areas: [],
    },
  });

  // Fetch the full beneficiary data with unmasked AFM when modal opens
  const { data: fullBeneficiaryData } = useQuery({
    queryKey: ["/api/beneficiaries", beneficiary?.id],
    queryFn: async () => {
      if (!beneficiary?.id) return null;
      const response = await fetch(`/api/beneficiaries/${beneficiary.id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch beneficiary");
      return response.json();
    },
    enabled: open && !!beneficiary?.id,
    staleTime: 0, // Always fetch fresh data for unmasked AFM
  });

  // Fetch engineers directly from optimized endpoint (already filtered and sorted server-side)
  // Data is prefetched on the beneficiaries page, so this uses cached data
  const { data: engineersResponse, isLoading: isEngineersLoading, error: engineersError } = useQuery({
    queryKey: ["/api/employees/engineers"],
    queryFn: async () => {
      const response = await fetch('/api/employees/engineers', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch engineers');
      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes cache - engineers list changes rarely
    gcTime: 60 * 60 * 1000, // 1 hour cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use existing cache
  });

  // Extract engineers from response (already filtered and sorted server-side)
  const engineers = useMemo(() => {
    const engineersData = engineersResponse?.data || [];
    if (!Array.isArray(engineersData)) return [];
    return engineersData;
  }, [engineersResponse]);

  // Initialize form values when modal opens or beneficiary changes
  // Use fullBeneficiaryData when available (has unmasked AFM)
  useEffect(() => {
    if (open) {
      // Use fullBeneficiaryData if available (has decrypted AFM), otherwise use passed beneficiary
      const dataSource = fullBeneficiaryData || beneficiary;
      
      if (dataSource) {
        // Edit existing beneficiary - use unmasked AFM from full data
        // Convert regiondet to geographic_areas format for form
        // regiondet can be an array (one entry per project_index_id) or a single object
        const rawRegiondet = dataSource.regiondet;
        const geographicAreas: string[] = [];
        
        if (rawRegiondet) {
          // Handle array format: merge all entries
          const regiondetEntries = Array.isArray(rawRegiondet) ? rawRegiondet : [rawRegiondet];
          
          // Use Sets to avoid duplicates when merging multiple project entries
          const seenRegions = new Set<string>();
          const seenRegionalUnits = new Set<string>();
          const seenMunicipalities = new Set<string>();
          
          regiondetEntries.forEach((regiondet: any) => {
            if (!regiondet || typeof regiondet !== 'object') return;
            
            // Convert stored regions to selection format
            if (Array.isArray(regiondet.regions)) {
              regiondet.regions.forEach((r: any) => {
                if (r.name) {
                  const key = `${r.name}||`;
                  if (!seenRegions.has(key)) {
                    seenRegions.add(key);
                    geographicAreas.push(key);
                  }
                }
              });
            }
            if (Array.isArray(regiondet.regional_units)) {
              regiondet.regional_units.forEach((ru: any) => {
                if (ru.name && ru.region_name) {
                  const key = `${ru.region_name}|${ru.name}|`;
                  if (!seenRegionalUnits.has(key)) {
                    seenRegionalUnits.add(key);
                    geographicAreas.push(key);
                  }
                }
              });
            }
            if (Array.isArray(regiondet.municipalities)) {
              regiondet.municipalities.forEach((m: any) => {
                if (m.name && m.regional_unit_name && m.region_name) {
                  const key = `${m.region_name}|${m.regional_unit_name}|${m.name}`;
                  if (!seenMunicipalities.has(key)) {
                    seenMunicipalities.add(key);
                    geographicAreas.push(key);
                  }
                }
              });
            }
          });
        }
        const regiondetValue = normalizeRegiondetEntry(
          (dataSource as any).regiondet,
        );
        setRegiondetSelection(regiondetValue as RegiondetSelection | null);
        lastRegiondetValueRef.current = regiondetValue as RegiondetSelection | null;
        setRegiondetStatus("idle");
        setRegiondetError(null);
        form.reset({
          afm: dataSource.afm || "",
          surname: dataSource.surname || "",
          name: dataSource.name || "",
          fathername: dataSource.fathername || "",
          adeia: dataSource.adeia || undefined,
          ceng1: dataSource.ceng1 ?? null,
          ceng2: dataSource.ceng2 ?? null,
          freetext: dataSource.freetext || "",
          geographic_areas: geographicAreas,
        });
        // Trigger validation after reset to ensure form isValid updates
        setTimeout(() => form.trigger(), 100);
      } else {
        // Create new beneficiary - start with empty form
        setRegiondetSelection(null);
        lastRegiondetValueRef.current = null;
        form.reset({
          afm: "",
          surname: "",
          name: "",
          fathername: "",
          adeia: undefined,
          ceng1: null,
          ceng2: null,
          freetext: "",
          geographic_areas: [],
        });
      }
      // Set edit mode based on initialEditMode prop or create mode
      setIsEditing(initialEditMode || isCreateMode);
      setEditingPayment(null);
    }
  }, [beneficiary, fullBeneficiaryData, open, form, initialEditMode, isCreateMode]);

  // Fetch payments only for this beneficiary to avoid pulling the whole table
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/beneficiary-payments", beneficiary?.id],
    queryFn: async () => {
      if (!beneficiary?.id) return [];
      return apiRequest(`/api/beneficiary-payments?beneficiaryIds=${beneficiary.id}`);
    },
    enabled: open && !!beneficiary?.id,
  }) as { data: PaymentRecord[]; isLoading: boolean };

  // Fetch geographic data for region selection
  const { data: geographicData } = useQuery({
    queryKey: ['/api/geographic-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    enabled: open, // Only fetch when modal is open
  });

  const regionOptions = useMemo(() => {
    const data = geographicData as any;
    return Array.isArray(data?.regions)
      ? data.regions
          .map((r: any) => ({
            code: String(r.code || r.region_code),
            name: r.name,
          }))
          .filter((r: any) => r.code && r.name)
      : [];
  }, [geographicData]);

  const regionalUnitOptions = useMemo(() => {
    const data = geographicData as any;
    return Array.isArray(data?.regionalUnits)
      ? data.regionalUnits
          .map((u: any) => ({
            code: String(u.code || u.unit_code),
            name: u.name,
            region_code: u.region_code,
          }))
          .filter((u: any) => u.code && u.name)
      : [];
  }, [geographicData]);

  const municipalityOptions = useMemo(() => {
    const data = geographicData as any;
    return Array.isArray(data?.municipalities)
      ? data.municipalities
          .map((m: any) => ({
            id: m.id,
            code: String(m.code || m.muni_code),
            name: m.name,
            unit_code: m.unit_code,
          }))
          .filter((m: any) => m.code && m.name)
      : [];
  }, [geographicData]);

  // Helper function to get engineer name from ID (for display)
  const getEngineerName = (engineerId: number | null | undefined): string => {
    if (!engineerId) return 'Δεν έχει καθοριστεί';
    const engineer = engineers.find((e: any) => e.id === engineerId);
    return engineer ? `${engineer.surname} ${engineer.name}` : 'Δεν έχει καθοριστεί';
  };

  // Update beneficiary mutation with react-hook-form integration
  const updateBeneficiaryMutation = useMutation({
    mutationFn: async (formData: BeneficiaryEditForm) => {
      if (!beneficiary?.id) throw new Error("No beneficiary ID available");
      const response = await fetch(`/api/beneficiaries/${beneficiary.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to update beneficiary");
      return response.json();
    },
    onSuccess: async () => {
      // More granular cache invalidation for immediate UI reflection
      await queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries", beneficiary?.id] });
      setIsEditing(false);
      toast({
        title: "Επιτυχία",
        description: "Τα στοιχεία του δικαιούχου ενημερώθηκαν επιτυχώς",
      });
      // Close the modal after successful save to avoid UI freeze from slow background queries
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία ενημέρωσης στοιχείων δικαιούχου",
        variant: "destructive",
      });
    },
  });

  // Form submission handler with data normalization
  const onSubmit = (data: BeneficiaryEditForm) => {
    console.log("Form submission data (before normalization):", data);
    
    // Normalize data types and empty values for consistent backend handling
    const normalizedData = {
      ...data,
      afm: String(data.afm ?? "").trim(), // Ensure AFM is always string
    };
    
    console.log("Form submission data (after normalization):", normalizedData);
    
    if (isCreateMode && onCreateBeneficiary) {
      // Create new beneficiary using the callback
      onCreateBeneficiary(normalizedData);
    } else {
      // Update existing beneficiary
      updateBeneficiaryMutation.mutate(normalizedData as BeneficiaryEditForm);
    }
  };

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, data }: { paymentId: number; data: Partial<PaymentRecord> }) => {
      const response = await fetch(`/api/beneficiary-payments/${paymentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiary-payments"] });
      setEditingPayment(null);
      toast({
        title: "Επιτυχία",
        description: "Η πληρωμή ενημερώθηκε επιτυχώς",
      });
    },
    onError: () => {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία ενημέρωσης πληρωμής",
        variant: "destructive",
      });
    },
  });

  // Add new payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async (data: Omit<PaymentRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await fetch("/api/beneficiary-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiary-payments"] });
      toast({
        title: "Επιτυχία",
        description: "Η νέα πληρωμή προστέθηκε επιτυχώς",
      });
    },
    onError: () => {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία προσθήκης νέας πληρωμής",
        variant: "destructive",
      });
    },
  });

  // Handler functions
  const handleCancelEdit = () => {
    if (isCreateMode) {
      // In create mode, cancel closes the modal
      onOpenChange(false);
    } else {
      // In edit mode, cancel reverts to view mode
      form.reset();
      setIsEditing(false);
      setEditingPayment(null);
    }
  };

  const handleUpdatePayment = (paymentId: number, data: Partial<PaymentRecord>) => {
    updatePaymentMutation.mutate({ paymentId, data });
  };

  const handleAddNewPayment = async () => {
    if (!beneficiary) return;
    
    // If callback provided, open create document dialog with prefilled beneficiary
    if (onCreatePaymentDocument) {
      let dataSource = fullBeneficiaryData || beneficiary;
      
      // Ensure we have full data (unmasked AFM) before opening the document dialog
      if (!fullBeneficiaryData && beneficiary?.id) {
        try {
          const fetched = await queryClient.fetchQuery({
            queryKey: ["/api/beneficiaries", beneficiary.id],
            queryFn: async () => {
              const response = await fetch(`/api/beneficiaries/${beneficiary.id}`, {
                credentials: "include",
              });
              if (!response.ok) throw new Error("Failed to fetch beneficiary");
              return response.json();
            },
          });
          if (fetched) {
            dataSource = fetched;
          }
        } catch (error) {
          toast({
            title: "Προειδοποίηση",
            description: "Δεν ήταν δυνατή η φόρτωση πλήρων στοιχείων δικαιούχου. Χρησιμοποιούνται τα διαθέσιμα δεδομένα.",
            variant: "destructive",
          });
        }
      }
      
      onCreatePaymentDocument({
        firstname: dataSource.name || "",
        lastname: dataSource.surname || "",
        fathername: dataSource.fathername || "",
        afm: String(dataSource.afm || "").trim(),
        beneficiaryId: typeof dataSource.id === "number" ? dataSource.id : beneficiary?.id,
        regiondet: (dataSource as any).regiondet || beneficiary?.regiondet || null,
      });
      // Close the beneficiary modal so user can focus on document creation
      onOpenChange(false);
      return;
    }
    
    // Fallback: create payment record directly (legacy behavior)
    const newPayment = {
      beneficiary_id: beneficiary.id,
      installment: "ΕΦΑΠΑΞ",
      amount: "0.00",
      status: "pending",
      payment_date: null,
    };
    addPaymentMutation.mutate(newPayment);
  };

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return '€0,00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numAmount);
  };

  const getFinancialStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Αντιγράφηκε",
        description: `Το ${label} αντιγράφηκε στο πρόχειρο`,
      });
    }).catch(() => {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία αντιγραφής στο πρόχειρο",
        variant: "destructive",
      });
    });
  };

  const handleRegiondetChange = (next: RegiondetSelection | null) => {
    const merged = mergeRegiondetPreservingPayments(
      next as RegiondetSelection,
      normalizeRegiondetEntry(regiondetSelection),
    );
    setRegiondetSelection(merged);
    lastRegiondetValueRef.current = merged;
    if (!beneficiary?.id) return;
    if (regiondetSaveTimerRef.current) {
      clearTimeout(regiondetSaveTimerRef.current);
    }
    regiondetSaveTimerRef.current = setTimeout(async () => {
      try {
        setRegiondetStatus("saving");
        setRegiondetError(null);
        await apiRequest(`/api/beneficiaries/${beneficiary.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regiondet: merged }),
        });
        setRegiondetStatus("saved");
        queryClient.invalidateQueries({
          queryKey: ["/api/beneficiaries", beneficiary.id],
        });
      } catch (error: any) {
        setRegiondetStatus("error");
        setRegiondetError(
          error?.message || "Failed to save geographical selection",
        );
      }
    }, 400);
  };

  const retryRegiondetSave = () => {
    if (!beneficiary?.id || !lastRegiondetValueRef.current) return;
    setRegiondetStatus("saving");
    setRegiondetError(null);
    apiRequest(`/api/beneficiaries/${beneficiary.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regiondet: lastRegiondetValueRef.current }),
    })
      .then(() => {
        setRegiondetStatus("saved");
        queryClient.invalidateQueries({
          queryKey: ["/api/beneficiaries", beneficiary.id],
        });
      })
      .catch((error: any) => {
        setRegiondetStatus("error");
        setRegiondetError(
          error?.message || "Failed to save geographical selection",
        );
      });
  };

  // Calculate total amount from payments
  const totalAmount = Array.isArray(payments) ? 
    payments.reduce((sum: number, payment: any) => sum + (parseFloat(payment.amount) || 0), 0) : 0;

  // Group payments by expenditure type
  const groupedPayments = Array.isArray(payments) ? 
    payments.reduce((acc: any, payment: any) => {
      const type = payment.expenditure_type || 'Άλλο';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(payment);
      return acc;
    }, {}) : {};

  // IMPORTANT #7: Handle unsaved changes confirmation when closing modal
  const handleDialogOpenChange = useCallback((newOpen: boolean) => {
    // If closing (newOpen = false) and form is dirty, show confirmation dialog
    if (!newOpen && isEditing && form.formState.isDirty) {
      const confirmed = window.confirm(
        'Έχετε αναπόσταστες αλλαγές. Σίγουρα θέλετε να κλείσετε χωρίς να αποθηκεύσετε;'
      );
      if (!confirmed) {
        return; // Don't close the modal
      }
    }
    onOpenChange(newOpen);
  }, [isEditing, form.formState.isDirty, onOpenChange]);

    useEffect(() => {
    return () => {
      if (regiondetSaveTimerRef.current) {
        clearTimeout(regiondetSaveTimerRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <User className="w-7 h-7 text-blue-600" />
                {isCreateMode ? "Νέος Δικαιούχος" : "Λεπτομέρειες & Επεξεργασία Δικαιούχου"}
              </DialogTitle>
              <DialogDescription className="text-gray-600 mt-2">
                {isCreateMode ? (
                  "Συμπληρώστε τα στοιχεία για τον νέο δικαιούχο"
                ) : (
                  <>
                    Προβολή και επεξεργασία στοιχείων για{" "}
                    <span className="font-semibold text-gray-800">
                      {beneficiary?.surname} {beneficiary?.name}
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isCreateMode && beneficiary && (
                <>
                  <Badge variant="outline" className="text-sm">
                    ID: {beneficiary.id}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(beneficiary.afm, "ΑΦΜ")}
                    className="text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    ΑΦΜ
                  </Button>
                </>
              )}
              {isEditing ? (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={updateBeneficiaryMutation.isPending}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Ακύρωση
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    form="beneficiary-edit-form"
                    disabled={updateBeneficiaryMutation.isPending}
                  >
                    {updateBeneficiaryMutation.isPending ? (
                      <div className="w-3 h-3 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 mr-1" />
                    )}
                    {updateBeneficiaryMutation.isPending 
                      ? "Αποθήκευση..." 
                      : (isCreateMode ? "Δημιουργία" : "Αποθήκευση")}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Επεξεργασία
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Στοιχεία Δικαιούχου
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Πληρωμές
              {payments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {payments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-y-auto">
            <Form {...form}>
              <form id="beneficiary-edit-form" onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.log("[BeneficiaryDetailsModal] Form validation errors:", errors);
                console.log("[BeneficiaryDetailsModal] Current form values:", form.getValues());
              })} className="space-y-6">
              {/* Personal Information */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Προσωπικά Στοιχεία
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                    <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Επώνυμο:
                    </label>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="surname"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} className="mt-1" data-testid="input-surname" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="text-blue-900 font-semibold text-lg mt-1">{beneficiary?.surname}</p>
                    )}
                  </div>
                  <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                    <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Όνομα:
                    </label>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} className="mt-1" data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="text-blue-900 font-semibold text-lg mt-1">{beneficiary?.name}</p>
                    )}
                  </div>
                  <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                    <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Πατρώνυμο:
                    </label>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="fathername"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} className="mt-1" placeholder="Προαιρετικό" data-testid="input-fathername" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="text-blue-900 font-medium mt-1">{beneficiary?.fathername || 'Δεν έχει καθοριστεί'}</p>
                    )}
                  </div>
                  <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                    <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                      <Hash className="w-4 h-4" />
                      ΑΦΜ:
                    </label>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="afm"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} className="mt-1 font-mono" placeholder="9 ψηφία" data-testid="input-afm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="text-blue-900 font-mono font-bold text-lg mt-1">{beneficiary?.afm}</p>
                    )}
                  </div>
                  <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                    <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Ημερομηνία Εγγραφής:
                    </label>
                    <p className="text-blue-900 font-medium mt-1">
                      {beneficiary?.date ? new Date(beneficiary.date).toLocaleDateString('el-GR') : 'Δεν έχει καθοριστεί'}
                    </p>
                  </div>
                </div>
              </div>

                            {/* Geographic Information - Show in edit mode or when data exists */}
              {(() => {
                const regionData = formatRegiondet(
                  (regiondetSelection as any) ||
                    (beneficiary?.regiondet as
                      | Record<string, unknown>
                      | null
                      | undefined),
                );
                const hasRegionData =
                  regionData.regions.length > 0 ||
                  regionData.regionalUnits.length > 0 ||
                  regionData.municipalities.length > 0;

                if (!isEditing && !hasRegionData) return null;

                return (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 shadow-sm">
                    <h3 className="text-base font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Γεωγραφικά Στοιχεία
                    </h3>
                    {isEditing ? (
                      <BeneficiaryGeoSelector
                        regions={regionOptions}
                        regionalUnits={regionalUnitOptions}
                        municipalities={municipalityOptions}
                        value={regiondetSelection as RegiondetSelection}
                        onChange={handleRegiondetChange}
                        required
                        loading={regiondetStatus === 'saving'}
                        error={regiondetError || undefined}
                        onRetry={
                          regiondetStatus === 'error' ? retryRegiondetSave : undefined
                        }
                      />
                    ) : (
                      <div className="bg-white/70 p-3 rounded-lg border border-green-200">
                        {(() => {
                          const formatted = formatRegiondet(
                            (regiondetSelection as any) || beneficiary?.regiondet,
                          );
                          if (
                            formatted.regions.length === 0 &&
                            formatted.regionalUnits.length === 0 &&
                            formatted.municipalities.length === 0
                          ) {
                            return (
                              <div className="text-xs text-green-700 flex items-center gap-2">
                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                Δεν έχει επιλεγεί περιοχή
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-1 text-xs">
                              {formatted.regions.length > 0 && (
                                <div className="font-semibold text-green-800">
                                  {formatted.regions.join(', ')}
                                </div>
                              )}
                              {formatted.regionalUnits.length > 0 && (
                                <div className="text-green-700">
                                  ΠΕ: {formatted.regionalUnits.join(', ')}
                                </div>
                              )}
                              {formatted.municipalities.length > 0 && (
                                <div className="text-green-700">
                                  Δήμοι: {formatted.municipalities.join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Administrative Information */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Διοικητικά Στοιχεία
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/70 p-4 rounded-lg border border-gray-200">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Receipt className="w-4 h-4" />
                      Αρ. Άδειας:
                    </label>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="adeia"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                className="mt-1"
                                placeholder="Αριθμός άδειας"
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                data-testid="input-adeia"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="text-gray-900 font-mono font-medium text-lg mt-1">
                        {beneficiary?.adeia || 'Δεν έχει καθοριστεί'}
                      </p>
                    )}
                  </div>
                  <div className="bg-white/70 p-4 rounded-lg border border-gray-200">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Hash className="w-4 h-4" />
                      Αρ. Διαδικτυακού Φακέλου:
                    </label>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="onlinefoldernumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} className="mt-1" placeholder="Αριθμός διαδικτυακού φακέλου" data-testid="input-onlinefoldernumber" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="text-gray-900 font-mono font-medium text-lg mt-1">
                        {beneficiary?.onlinefoldernumber || 'Δεν έχει καθοριστεί'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Engineering Information - Always show in edit mode, or when engineers are assigned */}
              {(isEditing || beneficiary?.ceng1 || beneficiary?.ceng2) && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                    <HardHat className="w-5 h-5" />
                    Μηχανικοί {engineers.length > 0 && <span className="text-sm font-normal text-orange-600">({engineers.length} διαθέσιμοι)</span>}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/70 p-4 rounded-lg border border-orange-200">
                      <label className="text-sm font-medium text-orange-700 flex items-center gap-1">
                        <HardHat className="w-4 h-4" />
                        Μηχανικός 1:
                      </label>
                      {isEditing ? (
                        <FormField
                          control={form.control}
                          name="ceng1"
                          render={({ field }) => (
                            <FormItem className="flex flex-col mt-1">
                              <EngineerCombobox
                                engineers={engineers}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Επιλέξτε μηχανικό..."
                                testId="select-ceng1"
                                isLoading={isEngineersLoading}
                                error={engineersError}
                                onRetry={handleRetryLoadEngineers}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <p className="text-orange-900 font-medium mt-1">
                          {getEngineerName(beneficiary?.ceng1)}
                        </p>
                      )}
                    </div>
                    <div className="bg-white/70 p-4 rounded-lg border border-orange-200">
                      <label className="text-sm font-medium text-orange-700 flex items-center gap-1">
                        <HardHat className="w-4 h-4" />
                        Μηχανικός 2:
                      </label>
                      {isEditing ? (
                        <FormField
                          control={form.control}
                          name="ceng2"
                          render={({ field }) => (
                            <FormItem className="flex flex-col mt-1">
                              <EngineerCombobox
                                engineers={engineers}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Επιλέξτε μηχανικό..."
                                testId="select-ceng2"
                                isLoading={isEngineersLoading}
                                error={engineersError}
                                onRetry={handleRetryLoadEngineers}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <p className="text-orange-900 font-medium mt-1">
                          {getEngineerName(beneficiary?.ceng2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Free Text */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm">
                <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Ελεύθερο Κείμενο / Σημειώσεις
                </h3>
                <div className="bg-white/70 p-4 rounded-lg border border-purple-200">
                  {isEditing ? (
                    <FormField
                      control={form.control}
                      name="freetext"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Προσθέστε σημειώσεις ή επιπλέον πληροφορίες..."
                              className="min-h-[100px]"
                              data-testid="textarea-freetext"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <p className="text-purple-900 whitespace-pre-wrap min-h-[60px]">
                      {beneficiary?.freetext || 'Δεν υπάρχουν σημειώσεις'}
                    </p>
                  )}
                </div>
              </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="payments" className="flex-1 overflow-y-auto">
            <div className="space-y-6">
              {/* Payments Header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                <div>
                  <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Διαχείριση Πληρωμών
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Προβολή και επεξεργασία όλων των πληρωμών του δικαιούχου
                  </p>
                </div>
                <Button
                  onClick={handleAddNewPayment}
                  size="sm"
                  disabled={addPaymentMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Νέα Πληρωμή
                </Button>
              </div>

              {/* Payments Summary */}
              {Array.isArray(payments) && (payments as any[]).length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-green-200 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-green-900">{(payments as any[]).length}</div>
                      <div className="text-sm text-green-700 font-medium">Συνολικές Πληρωμές</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-blue-900">{Object.keys(groupedPayments).length}</div>
                      <div className="text-sm text-blue-700 font-medium">Τύποι Δαπανών</div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-emerald-900">{formatCurrency(totalAmount)}</div>
                      <div className="text-sm text-emerald-700 font-medium">Συνολικό Ποσό</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payments List */}
              {paymentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="text-green-700 mt-4">Φόρτωση πληρωμών...</p>
                  </div>
                </div>
              ) : Array.isArray(payments) && payments.length > 0 ? (
                <div className="space-y-4">
                  {payments.map((payment: any) => (
                    <div key={payment.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={`${getFinancialStatusColor((payment.eps || payment.freetext) ? 'paid' : payment.status)} border`}>
                              {payment.status === 'paid' ? 'Πληρωμένη' : 
                               payment.status === 'submitted' ? 'Υποβλημένη' : 
                               (payment.eps || payment.freetext) ? 'Έχει Πληρωθεί' : 'Εκκρεμής'}
                            </Badge>
                            <span className="text-sm text-gray-600">ID: {payment.id}</span>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            Δόση: {payment.installment || 'ΕΦΑΠΑΞ'}
                          </h4>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            {formatCurrency(payment.amount)}
                          </div>
                          {editingPayment === payment.id ? (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingPayment(null)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpdatePayment(payment.id, payment)}
                                disabled={updatePaymentMutation.isPending}
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPayment(payment.id)}
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Επεξεργασία
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <label className="text-gray-600 font-medium">Τύπος Δαπάνης:</label>
                          <p className="text-gray-900">{payment.expenditure_type || 'Δ/Υ'}</p>
                        </div>
                        <div>
                          <label className="text-gray-600 font-medium">Ημερομηνία Πληρωμής:</label>
                          <p className="text-gray-900">
                            {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('el-GR') : 'Δ/Υ'}
                          </p>
                        </div>
                        <div>
                          <label className="text-gray-600 font-medium">EPS:</label>
                          <p className="text-gray-900 truncate">{payment.eps || payment.freetext || 'Δεν έχει πραγματοποιηθεί η πληρωμή'}</p>
                        </div>
                        <div>
                          <label className="text-gray-600 font-medium">Καταχωρήθηκε:</label>
                          <p className="text-gray-900">
                            {new Date(payment.created_at).toLocaleDateString('el-GR')}
                          </p>
                        </div>
                      </div>
                      
                      {/* Document Link */}
                      {payment.document_id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <label className="text-gray-600 font-medium text-sm">Έγγραφο:</label>
                          <button
                            onClick={async () => {
                              try {
                                const doc = await apiRequest(`/api/documents/${payment.document_id}`);
                                setSelectedDocumentForView(doc);
                                setDocumentModalOpen(true);
                              } catch (error) {
                                console.error('Error fetching document:', error);
                              }
                            }}
                            className="ml-2 text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            Άνοιγμα εγγράφου #{payment.document_id}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Δεν υπάρχουν πληρωμές</h3>
                  <p className="text-gray-600 mb-4">Δεν έχουν καταχωρηθεί πληρωμές για αυτόν τον δικαιούχο</p>
                  <Button
                    onClick={handleAddNewPayment}
                    disabled={addPaymentMutation.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Προσθήκη Πληρωμής
                  </Button>
                </div>
              )}
              
              {/* CRITICAL #3: Geographic info - READ-ONLY in Payments tab, editable in Details tab */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-700" />
                    <h4 className="text-base font-semibold text-blue-900">Γεωγραφικά Στοιχεία</h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("details")}
                    className="text-xs h-7 px-2"
                  >
                    Επεξεργασία
                  </Button>
                </div>
                
                {/* READ-ONLY display - click to edit in Details tab */}
                <div className="bg-white p-3 rounded-lg border border-blue-100 cursor-pointer hover:border-blue-300 transition-colors">
                  {(() => {
                    const formatted = formatRegiondet((regiondetSelection as any) || beneficiary?.regiondet);
                    if (formatted.regions.length === 0 && formatted.regionalUnits.length === 0 && formatted.municipalities.length === 0) {
                      return <p className="text-xs text-blue-700 text-muted-foreground">Δεν έχουν επιλεγεί περιοχές</p>;
                    }
                    return (
                      <div className="space-y-1 text-xs text-blue-900">
                        {formatted.regions.length > 0 && <div><strong>Περ.:</strong> {formatted.regions.join(", ")}</div>}
                        {formatted.regionalUnits.length > 0 && <div><strong>ΠΕ:</strong> {formatted.regionalUnits.join(", ")}</div>}
                        {formatted.municipalities.length > 0 && <div><strong>Δήμ.:</strong> {formatted.municipalities.join(", ")}</div>}
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      {/* Document Details Modal */}
      <DocumentDetailsModal
        open={documentModalOpen}
        onOpenChange={setDocumentModalOpen}
        document={selectedDocumentForView}
      />
    </Dialog>
  );
}
