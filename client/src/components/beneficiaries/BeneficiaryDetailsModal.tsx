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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  User, 
  MapPin, 
  FileText, 
  Calendar, 
  Euro,
  Building2,
  Hash,
  Phone,
  Mail,
  X,
  CreditCard,
  DollarSign,
  Copy,
  TrendingUp,
  Clock,
  Receipt,
  Edit3,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  HardHat,
  Search,
  ChevronsUpDown,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Beneficiary } from "@shared/schema";
import { insertBeneficiarySchema } from "@shared/schema";
import { z } from "zod";
import { SmartGeographicMultiSelect } from "@/components/forms/SmartGeographicMultiSelect";
import { convertGeographicDataToKallikratis } from "@shared/utils/geographic-utils";

interface BeneficiaryDetailsModalProps {
  beneficiary: Beneficiary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditMode?: boolean;
  onCreateBeneficiary?: (data: any) => void;
}

// Form schema for editing beneficiaries (omit auto-generated fields)
const beneficiaryEditSchema = insertBeneficiarySchema.omit({ 
  id: true, 
  created_at: true, 
  updated_at: true 
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
const formatRegiondet = (regiondet: Record<string, unknown> | null | undefined): { regions: string[], regionalUnits: string[], municipalities: string[] } => {
  if (!regiondet || typeof regiondet !== 'object') return { regions: [], regionalUnits: [], municipalities: [] };
  
  const result = { regions: [] as string[], regionalUnits: [] as string[], municipalities: [] as string[] };
  
  // Extract region names
  if (regiondet.regions && Array.isArray(regiondet.regions)) {
    regiondet.regions.forEach((region: any) => {
      if (region.name) {
        result.regions.push(region.name);
      }
    });
  }
  
  // Extract regional unit names
  if (regiondet.regional_units && Array.isArray(regiondet.regional_units)) {
    regiondet.regional_units.forEach((unit: any) => {
      if (unit.name) {
        result.regionalUnits.push(unit.name);
      }
    });
  }
  
  // Extract municipality names
  if (regiondet.municipalities && Array.isArray(regiondet.municipalities)) {
    regiondet.municipalities.forEach((muni: any) => {
      if (muni.name) {
        result.municipalities.push(muni.name);
      }
    });
  }
  
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
}

interface EngineerComboboxProps {
  engineers: any[];
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  testId?: string;
}

function EngineerCombobox({ engineers, value, onValueChange, placeholder = "Επιλέξτε...", testId }: EngineerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const selectedEngineer = engineers.find((eng) => eng.id === value);
  
  const filteredEngineers = useMemo(() => {
    if (!searchTerm) return engineers;
    const term = searchTerm.toLowerCase();
    return engineers.filter((eng: any) => 
      `${eng.surname} ${eng.name}`.toLowerCase().includes(term) ||
      `${eng.name} ${eng.surname}`.toLowerCase().includes(term)
    );
  }, [engineers, searchTerm]);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid={testId}
        >
          {selectedEngineer 
            ? `${selectedEngineer.surname} ${selectedEngineer.name}`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Αναζήτηση μηχανικού..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>Δεν βρέθηκαν μηχανικοί</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                  setSearchTerm("");
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Κανένας
              </CommandItem>
              {filteredEngineers.map((eng: any) => (
                <CommandItem
                  key={eng.id}
                  value={eng.id.toString()}
                  onSelect={() => {
                    onValueChange(eng.id);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === eng.id ? "opacity-100" : "opacity-0")} />
                  {eng.surname} {eng.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function BeneficiaryDetailsModal({ 
  beneficiary, 
  open, 
  onOpenChange,
  initialEditMode = false,
  onCreateBeneficiary
}: BeneficiaryDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Determine if this is a create operation (no beneficiary provided)
  const isCreateMode = !beneficiary;
  
  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  
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

  // Fetch all employees and filter for engineers (attribute = "Μηχανικός")
  const { data: employeesResponse } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await fetch('/api/employees', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch employees');
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: open,
  });

  // Filter employees to only show engineers (attribute = "Μηχανικός")
  const engineers = useMemo(() => {
    // Handle nested response structure: { success: true, data: [...], count: N }
    const employeesData = employeesResponse?.data || employeesResponse || [];
    if (!Array.isArray(employeesData)) return [];
    return employeesData.filter((emp: any) => emp.attribute === "Μηχανικός")
      .sort((a: any, b: any) => `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`, 'el'));
  }, [employeesResponse]);

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
      } else {
        // Create new beneficiary - start with empty form
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

  // Fetch all payments for this specific beneficiary
  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/beneficiary-payments"],
    enabled: open
  });

  // Filter payments for this specific beneficiary
  const payments = Array.isArray(allPayments) && beneficiary ? 
    allPayments.filter((payment: any) => payment.beneficiary_id === beneficiary.id) : [];

  // Fetch geographic data for region selection
  const { data: geographicData } = useQuery({
    queryKey: ['/api/geographic-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    enabled: open, // Only fetch when modal is open
  });

  // Get region data directly from geographic data for code/name mapping
  const availableRegions = useMemo(() => {
    if (!geographicData) return [];
    
    // Handle geographic data safely with type assertion
    const data = geographicData as any;
    const regions = data?.regions;
    
    if (!Array.isArray(regions)) return [];
    
    return regions
      .map((r: any) => ({ code: String(r.code), name: r.name }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'el'));
  }, [geographicData]);

  // Convert geographic data to kallikratis format for SmartGeographicMultiSelect
  const kallikratisData = useMemo(() => {
    if (!geographicData) return [];
    const data = geographicData as any;
    return convertGeographicDataToKallikratis({
      regions: data?.regions || [],
      regionalUnits: data?.regionalUnits || [],
      municipalities: data?.municipalities || []
    });
  }, [geographicData]);

  // Helper function to get region name from region code (for display)
  const getRegionNameFromCode = (regionCode: string | null | undefined): string => {
    if (!regionCode || !availableRegions.length) return regionCode || 'Δεν έχει καθοριστεί';
    
    // Look up region name by code
    const region = availableRegions.find(r => r.code === regionCode);
    return region?.name || regionCode;
  };

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
    onSuccess: () => {
      // More granular cache invalidation for immediate UI reflection
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries", beneficiary?.id] });
      setIsEditing(false);
      toast({
        title: "Επιτυχία",
        description: "Τα στοιχεία του δικαιούχου ενημερώθηκαν επιτυχώς",
      });
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

  const handleAddNewPayment = () => {
    if (!beneficiary?.id) return;
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

  // Parse financial data (legacy support)
  let financialData = null;
  try {
    const oikonomika = beneficiary ? (beneficiary as any).oikonomika : null;
    if (oikonomika && typeof oikonomika === 'string') {
      financialData = JSON.parse(oikonomika);
    } else if (oikonomika && typeof oikonomika === 'object') {
      financialData = oikonomika;
    }
  } catch (error) {
    console.error('Error parsing financial data:', error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                    <Save className="w-3 h-3 mr-1" />
                    {isCreateMode ? "Δημιουργία" : "Αποθήκευση"}
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
              <form id="beneficiary-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                const regionData = formatRegiondet(beneficiary?.regiondet as Record<string, unknown> | null | undefined);
                const hasRegionData = regionData.regions.length > 0 || regionData.regionalUnits.length > 0 || regionData.municipalities.length > 0;
                
                // Always show in edit mode, or when there's data to display
                if (!isEditing && !hasRegionData) return null;
                
                return (
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Γεωγραφικές Πληροφορίες
                    </h3>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="geographic_areas"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <SmartGeographicMultiSelect
                                value={field.value || []}
                                onChange={field.onChange}
                                kallikratisData={kallikratisData}
                                placeholder="Επιλέξτε γεωγραφικές περιοχές..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {regionData.regions.length > 0 && (
                          <div className="bg-white/70 p-4 rounded-lg border border-indigo-200">
                            <label className="text-sm font-medium text-indigo-700 block mb-2">
                              Περιφέρειες:
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {regionData.regions.map((region, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-indigo-100 text-indigo-800 text-xs">
                                  {region}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {regionData.regionalUnits.length > 0 && (
                          <div className="bg-white/70 p-4 rounded-lg border border-indigo-200">
                            <label className="text-sm font-medium text-indigo-700 block mb-2">
                              Περιφ. Ενότητες:
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {regionData.regionalUnits.map((unit, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                  {unit}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {regionData.municipalities.length > 0 && (
                          <div className="bg-white/70 p-4 rounded-lg border border-indigo-200">
                            <label className="text-sm font-medium text-indigo-700 block mb-2">
                              Δήμοι:
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {regionData.municipalities.map((muni, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-teal-100 text-teal-800 text-xs">
                                  {muni}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
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
              {Array.isArray(payments) && payments.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-green-200 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-green-900">{payments.length}</div>
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
                            <Badge className={`${getFinancialStatusColor(payment.status)} border`}>
                              {payment.status === 'paid' ? 'Πληρωμένη' : 
                               payment.status === 'submitted' ? 'Υποβλημένη' : 'Εκκρεμής'}
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

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
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
                          <label className="text-gray-600 font-medium">Καταχωρήθηκε:</label>
                          <p className="text-gray-900">
                            {new Date(payment.created_at).toLocaleDateString('el-GR')}
                          </p>
                        </div>
                      </div>
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}