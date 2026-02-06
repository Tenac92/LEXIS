import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Info,
  Users,
  LayoutGrid,
  List,
  User,
  FileText,
  Building,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Briefcase,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Hash,
  X,
  MapPin,
  Building2,
  Shield,
  Copy,
  Filter,
} from "lucide-react";
import { Header } from "@/components/header";
import { BeneficiaryDetailsModal } from "@/components/beneficiaries/BeneficiaryDetailsModal";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FAB } from "@/components/ui/fab";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { parseEuropeanNumber } from "@/lib/number-format";
import { useWebSocketUpdates } from "@/hooks/use-websocket-updates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
// Beneficiary type definition
interface Beneficiary {
  id: number;
  afm: string;
  afm_hash: string;
  surname: string;
  name: string;
  fathername: string | null;
  adeia: number | null;
  ceng1: number | null;
  ceng2: number | null;
  regiondet: Record<string, unknown> | null;
  onlinefoldernumber: string | null;
  freetext: string | null;
  date: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

interface Unit {
  id: string;
  name: string;
}

// Form validation schema for beneficiaries
const beneficiaryFormSchema = z.object({
  // Personal Information
  surname: z.string().min(2, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(2, "Το όνομα είναι υποχρεωτικό"),
  fathername: z.string().optional(),

  // Tax Information with Greek AFM validation
  afm: z
    .string()
    .length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    .regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να περιέχει μόνο αριθμούς")
    .refine((val) => {
      // Greek AFM validation algorithm
      const digits = val.split("").map(Number);
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += digits[i] * Math.pow(2, 8 - i);
      }
      const remainder = sum % 11;
      const checkDigit = remainder < 2 ? remainder : 11 - remainder;
      return checkDigit === digits[8];
    }, "Το ΑΦΜ δεν είναι έγκυρο (αποτυχία ελέγχου checksum)"),

  // Project & Location Information
  project: z.string().optional(),
  expenditure_type: z.string().optional(),
  monada: z.string().optional(),

  // License Information
  adeia: z.string().optional(),
  onlinefoldernumber: z.string().optional(),

  // Engineer Information (foreign keys to Employees table)
  ceng1: z.number().nullable().optional(),
  ceng2: z.number().nullable().optional(),

  // Financial Information - Multiple payment entries with complex structure
  selectedUnit: z.string().optional(),
  selectedNA853: z.string().optional(),
  amount: z.string().optional(),
  installment: z.string().optional(),
  protocol: z.string().optional(),

  // Additional Information
  freetext: z
    .string()
    .max(
      500,
      "Το ελεύθερο κείμενο δεν μπορεί να υπερβαίνει τους 500 χαρακτήρες",
    )
    .optional(),
  date: z.string().optional(),
});
interface User {
  id: number;
  role: string;
  unit_id?: number[];
  name?: string;
}

type BeneficiaryFormData = z.infer<typeof beneficiaryFormSchema>;

export default function BeneficiariesPage() {
  const { user } = useAuth() as { user: User };
  // Enable real-time updates via WebSocket
  useWebSocketUpdates();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<
    Beneficiary | undefined
  >();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsBeneficiary, setDetailsBeneficiary] =
    useState<Beneficiary | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsInitialEditMode, setDetailsInitialEditMode] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1); // 1-based indexing for proper offset calculation
  const [itemsPerPage] = useState(24); // Reduced from 60 to 24 for better performance
  const [existingPaymentsModalOpen, setExistingPaymentsModalOpen] =
    useState(false);
  const [selectedBeneficiaryForPayments, setSelectedBeneficiaryForPayments] =
    useState<Beneficiary | null>(null);
  // State for create document dialog with prefilled beneficiary
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const [initialBeneficiaryForDocument, setInitialBeneficiaryForDocument] = useState<{
    firstname: string;
    lastname: string;
    fathername: string;
    afm: string;
  } | undefined>(undefined);
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState({
    unit: "",
    project: "",
    expenditureType: "",
    amountFrom: "",
    amountTo: "",
    dateFrom: "",
    dateTo: "",
    region: "",
    adeia: "",
    ceng1: "",
    hasPayments: "all", // "all" | "yes" | "no"
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Prefetch engineers data in the background for modal use
  // This ensures engineers are cached before any modal opens
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["/api/employees/engineers"],
      queryFn: async () => {
        const response = await fetch('/api/employees/engineers', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch engineers');
        return response.json();
      },
      staleTime: 30 * 60 * 1000, // 30 minutes cache
    });
  }, [queryClient]);

  // Fetch ALL beneficiaries (client-side pagination and filtering is applied later)
  const {
    data: beneficiaries = [],
    isLoading,
    error,
  } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
    queryFn: async () => {
      const response = await fetch(
        `/api/beneficiaries`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch beneficiaries');
      const data = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes cache retention
    refetchOnWindowFocus: false,
  });

  // IMPORTANT #1: Fetch engineers for card display resolution
  const { data: engineersResponse, error: engineersError, isLoading: engineersLoading } = useQuery({
    queryKey: ["/api/employees/engineers"],
    queryFn: async () => {
      const response = await fetch('/api/employees/engineers', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch engineers');
      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes cache
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Fetch units data for filters
  const { data: allUnits = [], error: unitsError, isLoading: unitsLoading } = useQuery({
    queryKey: ["/api/public/units"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch projects data for filters
  const { data: allProjects = [], error: projectsError, isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // IMPORTANT #1: Memoized map for fast engineer name lookups on cards
  const engineerMap = useMemo(() => {
    const map = new Map();
    const engineers = engineersResponse?.data || [];
    if (Array.isArray(engineers)) {
      engineers.forEach((eng: any) => {
        if (eng?.id) {
          map.set(eng.id, eng);
        }
      });
    }
    return map;
  }, [engineersResponse]);

  // Fetch units for dropdown with aggressive caching
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/public/units"],
    staleTime: 30 * 60 * 1000, // 30 minutes cache
    gcTime: 60 * 60 * 1000, // 1 hour cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Fetch projects for dropdown with caching
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    refetchOnWindowFocus: false,
  });

  // Helper function to format regiondet JSONB data for display
  const formatRegiondet = useCallback((regiondet: Record<string, unknown> | null): string[] => {
    if (!regiondet || typeof regiondet !== 'object') return [];
    
    const regionNames: string[] = [];
    
    // regiondet structure: { regions: [...], regional_units: [...], municipalities: [...] }
    // Extract region names
    if (regiondet.regions && Array.isArray(regiondet.regions)) {
      regiondet.regions.forEach((region: any) => {
        if (region.name) {
          regionNames.push(region.name);
        }
      });
    }
    
    return regionNames;
  }, []);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: BeneficiaryFormData) =>
      apiRequest("/api/beneficiaries", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // CRITICAL #2: Reset queries to force immediate refetch and clear stale cache
      queryClient.resetQueries({ queryKey: ["/api/beneficiaries"] });
      queryClient.resetQueries({ queryKey: ["/api/beneficiary-payments"] });
      setDialogOpen(false);
      setSelectedBeneficiary(undefined);
      toast({
        title: "Επιτυχία",
        description: "Ο δικαιούχος δημιουργήθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Αποτυχία δημιουργίας δικαιούχου",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BeneficiaryFormData }) =>
      apiRequest(`/api/beneficiaries/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // CRITICAL #2: Reset queries to force immediate refetch and clear stale cache
      queryClient.resetQueries({ queryKey: ["/api/beneficiaries"] });
      queryClient.resetQueries({ queryKey: ["/api/beneficiary-payments"] });
      setDialogOpen(false);
      setSelectedBeneficiary(undefined);
      toast({
        title: "Επιτυχία",
        description: "Ο δικαιούχος ενημερώθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Αποτυχία ενημέρωσης δικαιούχου",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/beneficiaries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      // CRITICAL #2: Reset queries to force immediate refetch and clear stale cache
      queryClient.resetQueries({ queryKey: ["/api/beneficiaries"] });
      queryClient.resetQueries({ queryKey: ["/api/beneficiary-payments"] });
      toast({
        title: "Επιτυχία",
        description: "Ο δικαιούχος διαγράφηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Αποτυχία διαγραφής δικαιούχου",
        variant: "destructive",
      });
    },
  });

  // Helper to copy AFM to clipboard
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

  // Helper to mask AFM for display (show last 5 digits)
  const maskAFM = (afm: string): string => {
    if (!afm || afm.length < 5) return afm;
    return `...${afm.slice(-5)}`;
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    // Open Details Modal with edit mode active
    setDetailsBeneficiary(beneficiary);
    setDetailsInitialEditMode(true);
    setDetailsModalOpen(true);
  };

  const handleDelete = (beneficiary: Beneficiary) => {
    if (
      confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον δικαιούχο;")
    ) {
      deleteMutation.mutate(beneficiary.id);
    }
  };

  const handleShowDetails = (beneficiary: Beneficiary) => {
    setDetailsBeneficiary(beneficiary);
    setDetailsInitialEditMode(false);  // Open in view mode
    setDetailsModalOpen(true);
  };

  const handleCreateNewBeneficiary = () => {
    setDetailsBeneficiary(null);  // No beneficiary = create mode
    setDetailsInitialEditMode(true);  // Start in edit mode for new entry
    setDetailsModalOpen(true);
  };

  const toggleCardFlip = (beneficiaryId: number) => {
    setFlippedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(beneficiaryId)) {
        newSet.delete(beneficiaryId);
      } else {
        newSet.add(beneficiaryId);
      }
      return newSet;
    });
  };

  // Server-side AFM search query - only triggers when AFM is 9 digits
  const { data: afmSearchResults } = useQuery<Beneficiary[]>({
    queryKey: ['/api/beneficiaries/search', searchTerm],
    queryFn: async () => {
      const response = await apiRequest<{ success: boolean; data: Beneficiary[]; count: number }>(`/api/beneficiaries/search?afm=${searchTerm}`);
      return response.data; // Extract the data array from the response object
    },
    enabled: searchTerm.length === 9 && /^\d{9}$/.test(searchTerm),
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Check if advanced filters that need payment data are active
  const hasPaymentFilters = Boolean(
    advancedFilters.hasPayments !== "all" ||
    advancedFilters.amountFrom ||
    advancedFilters.amountTo ||
    advancedFilters.project ||
    advancedFilters.expenditureType ||
    advancedFilters.unit ||
    advancedFilters.dateFrom ||
    advancedFilters.dateTo
  );

  // Fetch ALL beneficiary IDs for payment-based filtering
  const allBeneficiaryIds = useMemo(
    () => beneficiaries.map((b) => b.id),
    [beneficiaries]
  );

  // Fetch payments - either for all beneficiaries (when filters are active) or for visible ones
  const { data: beneficiaryPayments = [], isFetching: paymentsLoading } = useQuery({
    queryKey: ["/api/beneficiary-payments", { ids: hasPaymentFilters ? allBeneficiaryIds : [] }],
    queryFn: async () => {
      if (allBeneficiaryIds.length === 0) return [];
      const idParam = allBeneficiaryIds.join(",");
      return apiRequest(`/api/beneficiary-payments?beneficiaryIds=${idParam}`);
    },
    enabled: Boolean(hasPaymentFilters && allBeneficiaryIds.length > 0),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // PERFORMANCE: Memoized payment data for O(1) lookups in filtering and rendering
  const beneficiaryPaymentData = useMemo(() => {
    if (!Array.isArray(beneficiaryPayments)) return new Map();

    const paymentMap = new Map();

    beneficiaryPayments.forEach((payment: any) => {
      const id = payment.beneficiary_id;
      if (!paymentMap.has(id)) {
        paymentMap.set(id, {
          payments: [],
          totalAmount: 0,
          expenditureTypes: new Set(),
        });
      }

      const data = paymentMap.get(id);
      data.payments.push(payment);
      data.totalAmount += parseEuropeanNumber(payment.amount) || 0;
      if (payment.expenditure_type) {
        data.expenditureTypes.add(payment.expenditure_type);
      }
    });

    return paymentMap;
  }, [beneficiaryPayments]);

  // PERFORMANCE OPTIMIZATION: Memoized search and pagination to prevent unnecessary filtering
  const filteredBeneficiaries = useMemo(() => {
    // If AFM search results are available (9-digit AFM), use them
    if (afmSearchResults) {
      console.log(`[Beneficiaries] Using server-side AFM search results: ${afmSearchResults.length} beneficiaries`);
      return afmSearchResults;
    }

    // Otherwise, do client-side filtering (for non-AFM searches)
    let baseList = !searchTerm.trim()
      ? beneficiaries
      : beneficiaries.filter((beneficiary) => {
          const searchLower = searchTerm.toLowerCase();
          return (
            beneficiary.surname?.toLowerCase().includes(searchLower) ||
            beneficiary.name?.toLowerCase().includes(searchLower)
          );
        });

    // Apply advanced filters
    if (advancedFilters.adeia) {
      baseList = baseList.filter((b) => 
        b.adeia?.toString().includes(advancedFilters.adeia)
      );
    }

    if (advancedFilters.ceng1) {
      baseList = baseList.filter((b) => 
        b.ceng1?.toString() === advancedFilters.ceng1
      );
    }

    if (advancedFilters.region) {
      baseList = baseList.filter((b) => {
        if (!b.regiondet) return false;
        const regionStr = JSON.stringify(b.regiondet).toLowerCase();
        return regionStr.includes(advancedFilters.region.toLowerCase());
      });
    }

    if (advancedFilters.hasPayments !== "all") {
      // When filtering by payment status, we need payment data
      // If data is still loading for the first time, don't filter yet
      // Note: beneficiaryPaymentData can legitimately be empty if no beneficiaries have payments
      if (paymentsLoading) {
        console.log('[Beneficiaries] Payment data still loading, temporarily showing all beneficiaries');
        // Don't apply filter while loading - show all for now
      } else {
        console.log(`[Beneficiaries] Applying hasPayments filter: ${advancedFilters.hasPayments}, payment data size: ${beneficiaryPaymentData.size}`);
        baseList = baseList.filter((b) => {
          const payments = beneficiaryPaymentData.get(b.id)?.payments || [];
          // Consider a beneficiary as "having payments" only if they have payment records with EPS data
          const hasPayments = payments.some((p: any) => p.eps || p.freetext);
          const result = advancedFilters.hasPayments === "yes" ? hasPayments : !hasPayments;
          return result;
        });
        console.log(`[Beneficiaries] After hasPayments filter: ${baseList.length} beneficiaries remaining`);
      }
    }

    // Filter by amount range (requires payment data)
    if (advancedFilters.amountFrom || advancedFilters.amountTo) {
      baseList = baseList.filter((b) => {
        const total = beneficiaryPaymentData.get(b.id)?.totalAmount || 0;
        const amountFrom = advancedFilters.amountFrom ? parseEuropeanNumber(advancedFilters.amountFrom) || 0 : 0;
        const amountTo = advancedFilters.amountTo ? parseEuropeanNumber(advancedFilters.amountTo) || Infinity : Infinity;
        return total >= amountFrom && total <= amountTo;
      });
    }

    // Filter by project and expenditure type (requires payment data)
    if (advancedFilters.project || advancedFilters.expenditureType || advancedFilters.unit) {
      baseList = baseList.filter((b) => {
        const payments = beneficiaryPaymentData.get(b.id)?.payments || [];
        if (payments.length === 0 && (advancedFilters.project || advancedFilters.expenditureType || advancedFilters.unit)) {
          return false;
        }
        
        return payments.some((payment: any) => {
          let matches = true;
          if (advancedFilters.project && payment.na853 !== advancedFilters.project) {
            matches = false;
          }
          if (advancedFilters.expenditureType && payment.expenditure_type !== advancedFilters.expenditureType) {
            matches = false;
          }
          if (advancedFilters.unit && payment.unit?.toString() !== advancedFilters.unit) {
            matches = false;
          }
          return matches;
        });
      });
    }

    // Filter by date range (requires payment data)
    if (advancedFilters.dateFrom || advancedFilters.dateTo) {
      baseList = baseList.filter((b) => {
        const payments = beneficiaryPaymentData.get(b.id)?.payments || [];
        if (payments.length === 0) return false;
        
        return payments.some((payment: any) => {
          if (!payment.payment_date) return false;
          const paymentDate = new Date(payment.payment_date).getTime();
          const dateFrom = advancedFilters.dateFrom ? new Date(advancedFilters.dateFrom).getTime() : 0;
          const dateTo = advancedFilters.dateTo ? new Date(advancedFilters.dateTo).getTime() : Infinity;
          return paymentDate >= dateFrom && paymentDate <= dateTo;
        });
      });
    }

    // Deduplicate by beneficiary ID to avoid duplicate keys in the list/grid
    const seen = new Set<number>();
    return baseList.filter((beneficiary) => {
      if (seen.has(beneficiary.id)) return false;
      seen.add(beneficiary.id);
      return true;
    });
  }, [beneficiaries, searchTerm, afmSearchResults, advancedFilters, beneficiaryPaymentData, paymentsLoading]);

  // PERFORMANCE OPTIMIZATION: Memoized pagination
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedBeneficiaries = filteredBeneficiaries.slice(
      startIndex,
      startIndex + itemsPerPage,
    );

    return { totalPages, paginatedBeneficiaries };
  }, [filteredBeneficiaries, currentPage, itemsPerPage]);

  const { totalPages, paginatedBeneficiaries } = paginationData;

  // IDs of beneficiaries currently visible (for fetching visible payments when no filters)
  const visibleBeneficiaryIds = useMemo(
    () => paginatedBeneficiaries.map((b) => b.id),
    [paginatedBeneficiaries],
  );

  // Fetch payments for visible beneficiaries only when no payment filters are active
  const { data: visiblePayments = [] } = useQuery({
    queryKey: ["/api/beneficiary-payments", { ids: visibleBeneficiaryIds }],
    queryFn: async () => {
      if (visibleBeneficiaryIds.length === 0) return [];
      const idParam = visibleBeneficiaryIds.join(",");
      return apiRequest(`/api/beneficiary-payments?beneficiaryIds=${idParam}`);
    },
    enabled: Boolean(!hasPaymentFilters && visibleBeneficiaryIds.length > 0),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Merge payment data - use all payments when filters active, visible only otherwise
  const allPaymentData = useMemo(() => {
    const payments = hasPaymentFilters ? beneficiaryPayments : visiblePayments;
    if (!Array.isArray(payments)) return new Map();

    const paymentMap = new Map();

    payments.forEach((payment: any) => {
      const id = payment.beneficiary_id;
      if (!paymentMap.has(id)) {
        paymentMap.set(id, {
          payments: [],
          totalAmount: 0,
          expenditureTypes: new Set(),
        });
      }

      const data = paymentMap.get(id);
      data.payments.push(payment);
      data.totalAmount += parseEuropeanNumber(payment.amount) || 0;
      if (payment.expenditure_type) {
        data.expenditureTypes.add(payment.expenditure_type);
      }
    });

    return paymentMap;
  }, [beneficiaryPayments, visiblePayments, hasPaymentFilters]);

  // Optimized helper functions using memoized data
  const getPaymentsForBeneficiary = (beneficiaryId: number) => {
    return allPaymentData.get(beneficiaryId)?.payments || [];
  };

  const getTotalAmountForBeneficiary = (beneficiaryId: number) => {
    return allPaymentData.get(beneficiaryId)?.totalAmount || 0;
  };

  const getExpenditureTypesForBeneficiary = (beneficiaryId: number) => {
    const types = allPaymentData.get(beneficiaryId)?.expenditureTypes;
    return types ? Array.from(types) : [];
  };

  // Get latest payment (by payment_date desc, then created_at desc)
  const getLatestPaymentForBeneficiary = (beneficiaryId: number) => {
    const payments = getPaymentsForBeneficiary(beneficiaryId);
    if (!payments || payments.length === 0) return null;

    const sorted = [...payments].sort((a: any, b: any) => {
      const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
      const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA;
    });

    return sorted[0];
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-6 pb-8">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">
                  Φόρτωση δικαιούχων...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-6 pb-8">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">Σφάλμα φόρτωσης δικαιούχων</p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="mt-4"
                >
                  Επανάληψη
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            {/* Header with Actions */}
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
              <h1 className="text-2xl font-bold text-foreground">Δικαιούχοι</h1>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setViewMode(viewMode === "grid" ? "list" : "grid")
                  }
                >
                  {viewMode === "grid" ? (
                    <>
                      <List className="w-4 h-4 mr-2" />
                      Λίστα
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="w-4 h-4 mr-2" />
                      Πλέγμα
                    </>
                  )}
                </Button>
                <Button onClick={handleCreateNewBeneficiary}>
                  <Plus className="w-4 h-4 mr-2" />
                  Νέος Δικαιούχος
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <Input
                  placeholder="Αναζήτηση δικαιούχων (όνομα, επώνυμο, ΑΦΜ)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 max-w-md"
                />
                
                {/* Advanced Filters Sheet */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex justify-between items-center gap-2"
                    >
                      <span className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Προχωρημένα Φίλτρα
                      </span>
                      {(advancedFilters.unit ||
                        advancedFilters.project ||
                        advancedFilters.expenditureType ||
                        advancedFilters.amountFrom ||
                        advancedFilters.amountTo ||
                        advancedFilters.dateFrom ||
                        advancedFilters.dateTo ||
                        advancedFilters.region ||
                        advancedFilters.adeia ||
                        advancedFilters.ceng1 ||
                        advancedFilters.hasPayments !== "all") && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                          Ενεργά
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Προχωρημένα Φίλτρα</SheetTitle>
                    </SheetHeader>
                    <div className="grid gap-4 py-4">
                      {/* Unit Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Μονάδα</label>
                        <Select
                          value={advancedFilters.unit}
                          onValueChange={(value) =>
                            setAdvancedFilters((prev) => ({ ...prev, unit: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Επιλέξτε μονάδα" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Όλες οι μονάδες</SelectItem>
                            {Array.isArray(allUnits) &&
                              allUnits.map((unit: any) => (
                                <SelectItem
                                  key={unit.id}
                                  value={unit.id.toString()}
                                >
                                  {unit.unit} - {unit.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Project Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Έργο (NA853)</label>
                        <Select
                          value={advancedFilters.project}
                          onValueChange={(value) =>
                            setAdvancedFilters((prev) => ({ ...prev, project: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Επιλέξτε έργο" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Όλα τα έργα</SelectItem>
                            {Array.isArray(allProjects) &&
                              allProjects
                                .filter((p: any) => p.na853)
                                .map((project: any) => (
                                  <SelectItem
                                    key={project.id}
                                    value={project.na853}
                                  >
                                    {project.na853} - {project.project_name}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expenditure Type Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Τύπος Δαπάνης</label>
                        <Input
                          placeholder="Αναζήτηση τύπου δαπάνης"
                          value={advancedFilters.expenditureType}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              expenditureType: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Amount Range */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Εύρος Ποσού</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Από
                            </label>
                            <Input
                              type="text"
                              placeholder="0,00"
                              value={advancedFilters.amountFrom}
                              onChange={(e) =>
                                setAdvancedFilters((prev) => ({
                                  ...prev,
                                  amountFrom: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Έως
                            </label>
                            <Input
                              type="text"
                              placeholder="0,00"
                              value={advancedFilters.amountTo}
                              onChange={(e) =>
                                setAdvancedFilters((prev) => ({
                                  ...prev,
                                  amountTo: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Date Range */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Εύρος Ημερομηνιών Πληρωμής
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Από
                            </label>
                            <Input
                              type="date"
                              value={advancedFilters.dateFrom}
                              onChange={(e) =>
                                setAdvancedFilters((prev) => ({
                                  ...prev,
                                  dateFrom: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Έως
                            </label>
                            <Input
                              type="date"
                              value={advancedFilters.dateTo}
                              onChange={(e) =>
                                setAdvancedFilters((prev) => ({
                                  ...prev,
                                  dateTo: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Region Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Περιοχή</label>
                        <Input
                          placeholder="Αναζήτηση περιοχής"
                          value={advancedFilters.region}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              region: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* License Number */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Αρ. Άδειας</label>
                        <Input
                          placeholder="Αναζήτηση αριθμού άδειας"
                          value={advancedFilters.adeia}
                          onChange={(e) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              adeia: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Engineer Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Μηχανικός</label>
                        <Select
                          value={advancedFilters.ceng1}
                          onValueChange={(value) =>
                            setAdvancedFilters((prev) => ({ ...prev, ceng1: value }))
                          }
                          disabled={engineersLoading || engineersError ? true : false}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={engineersLoading ? "Φόρτωση..." : engineersError ? "Σφάλμα φόρτωσης" : "Επιλέξτε μηχανικό"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Όλοι</SelectItem>
                            {engineersError && (
                              <div className="px-2 py-1.5 text-xs text-red-600">Σφάλμα: δεν ήταν δυνατή η φόρτωση</div>
                            )}
                            {Array.isArray(engineersResponse?.data) &&
                              engineersResponse.data.map((engineer: any) => (
                                <SelectItem
                                  key={engineer.id}
                                  value={engineer.id.toString()}
                                >
                                  {engineer.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Has Payments Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Κατάσταση Πληρωμών</label>
                        <Select
                          value={advancedFilters.hasPayments}
                          onValueChange={(value) =>
                            setAdvancedFilters((prev) => ({
                              ...prev,
                              hasPayments: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Επιλέξτε κατάσταση" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Όλοι</SelectItem>
                            <SelectItem value="yes">Με πληρωμές</SelectItem>
                            <SelectItem value="no">Χωρίς πληρωμές</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Filter Actions */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setAdvancedFilters({
                            unit: "",
                            project: "",
                            expenditureType: "",
                            amountFrom: "",
                            amountTo: "",
                            dateFrom: "",
                            dateTo: "",
                            region: "",
                            adeia: "",
                            ceng1: "",
                            hasPayments: "all",
                          });
                          setCurrentPage(1);
                        }}
                      >
                        Καθαρισμός
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Active Filters Display */}
              {(advancedFilters.unit ||
                advancedFilters.project ||
                advancedFilters.expenditureType ||
                advancedFilters.amountFrom ||
                advancedFilters.amountTo ||
                advancedFilters.dateFrom ||
                advancedFilters.dateTo ||
                advancedFilters.region ||
                advancedFilters.adeia ||
                advancedFilters.ceng1 ||
                advancedFilters.hasPayments !== "all") && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Ενεργά φίλτρα:</span>
                  {advancedFilters.unit && advancedFilters.unit !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Μονάδα: {(allUnits as any[]).find((u: any) => u.id.toString() === advancedFilters.unit)?.unit}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({ ...prev, unit: "" }))
                        }
                      />
                    </Badge>
                  )}
                  {advancedFilters.project && advancedFilters.project !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Έργο: {advancedFilters.project}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({ ...prev, project: "" }))
                        }
                      />
                    </Badge>
                  )}
                  {advancedFilters.expenditureType && (
                    <Badge variant="secondary" className="gap-1">
                      Τύπος: {advancedFilters.expenditureType}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({ ...prev, expenditureType: "" }))
                        }
                      />
                    </Badge>
                  )}
                  {advancedFilters.hasPayments !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {advancedFilters.hasPayments === "yes" ? "Με πληρωμές" : "Χωρίς πληρωμές"}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({ ...prev, hasPayments: "all" }))
                        }
                      />
                    </Badge>
                  )}
                  {(advancedFilters.amountFrom || advancedFilters.amountTo) && (
                    <Badge variant="secondary" className="gap-1">
                      Ποσό: {advancedFilters.amountFrom || "0"} - {advancedFilters.amountTo || "∞"}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({
                            ...prev,
                            amountFrom: "",
                            amountTo: "",
                          }))
                        }
                      />
                    </Badge>
                  )}
                  {advancedFilters.region && (
                    <Badge variant="secondary" className="gap-1">
                      Περιοχή: {advancedFilters.region}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({ ...prev, region: "" }))
                        }
                      />
                    </Badge>
                  )}
                  {advancedFilters.adeia && (
                    <Badge variant="secondary" className="gap-1">
                      Άδεια: {advancedFilters.adeia}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() =>
                          setAdvancedFilters((prev) => ({ ...prev, adeia: "" }))
                        }
                      />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Loading indicator for payment data */}
            {paymentsLoading && hasPaymentFilters && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                Φόρτωση δεδομένων πληρωμών...
              </div>
            )}

            {/* Beneficiaries Display */}
            {paginatedBeneficiaries.length > 0 ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : "space-y-4"
                }
              >
                {paginatedBeneficiaries.map((beneficiary) => {
                  if (viewMode === "list") {
                    return (
                      <Card
                        key={beneficiary.id}
                        className="transition-shadow hover:shadow-lg flex cursor-pointer border-l-4 border-l-purple-500"
                        onClick={() => handleShowDetails(beneficiary)}
                      >
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-foreground">
                                  {beneficiary.surname} {beneficiary.name}
                                  {beneficiary.fathername && (
                                    <span className="text-sm font-normal text-muted-foreground ml-2">
                                      του {beneficiary.fathername}
                                    </span>
                                  )}
                                </h3>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="w-4 h-4" />
                                    <span className="font-mono">ΑΦΜ: {maskAFM(beneficiary.afm)}</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {getExpenditureTypesForBeneficiary(
                                    beneficiary.id,
                                  ).length > 0 && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <FileText className="w-4 h-4 flex-shrink-0" />
                                      <span
                                        className="truncate"
                                        title={getExpenditureTypesForBeneficiary(
                                          beneficiary.id,
                                        ).join(", ")}
                                      >
                                        {getExpenditureTypesForBeneficiary(
                                          beneficiary.id,
                                        )
                                          .slice(0, 2)
                                          .join(", ")}
                                        {getExpenditureTypesForBeneficiary(
                                          beneficiary.id,
                                        ).length > 2 &&
                                          ` +${getExpenditureTypesForBeneficiary(beneficiary.id).length - 2} άλλοι`}
                                      </span>
                                    </div>
                                  )}
                                  {(() => {
                                    const latest = getLatestPaymentForBeneficiary(beneficiary.id);
                                    return (
                                      <div className="space-y-0.5 text-muted-foreground text-xs">
                                        {latest?.payment_date && (
                                          <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 flex-shrink-0" />
                                            <span>
                                              {new Date(latest.payment_date).toLocaleDateString("el-GR")}
                                            </span>
                                          </div>
                                        )}
                                        {latest?.freetext && (
                                          <div className="flex items-center gap-2">
                                            <Hash className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate" title={latest.freetext}>
                                              {latest.freetext.substring(0, 25)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {formatRegiondet(beneficiary.regiondet).length > 0 && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <MapPin className="w-4 h-4 flex-shrink-0 text-blue-600" />
                                      <span
                                        className="truncate text-blue-700"
                                        title={formatRegiondet(beneficiary.regiondet).join(", ")}
                                      >
                                        {formatRegiondet(beneficiary.regiondet)
                                          .slice(0, 2)
                                          .join(", ")}
                                        {formatRegiondet(beneficiary.regiondet).length > 2 &&
                                          ` +${formatRegiondet(beneficiary.regiondet).length - 2} άλλες`}
                                      </span>
                                    </div>
                                  )}
                                  {getTotalAmountForBeneficiary(
                                    beneficiary.id,
                                  ) > 0 && (
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-sm font-medium border border-green-200">
                                        <CreditCard className="w-4 h-4 flex-shrink-0" />
                                        <span>
                                          {new Intl.NumberFormat("el-GR", {
                                            style: "currency",
                                            currency: "EUR",
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0,
                                          }).format(
                                            getTotalAmountForBeneficiary(
                                              beneficiary.id,
                                            ),
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-medium border border-blue-200">
                                        <span>
                                          {
                                            getPaymentsForBeneficiary(
                                              beneficiary.id,
                                            ).length
                                          }
                                        </span>
                                        <span className="text-xs">
                                          πληρωμές
                                        </span>
                                      </div>
                                      
                                      {/* IMPORTANT #2: Payment status breakdown */}
                                      {(() => {
                                        const payments = getPaymentsForBeneficiary(beneficiary.id);
                                        const byStatus = payments.reduce((acc: any, p: any) => {
                                          acc[p.status] = (acc[p.status] || 0) + 1;
                                          return acc;
                                        }, {} as Record<string, number>);
                                        
                                        if (Object.keys(byStatus).length === 0) return null;
                                        
                                        return (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            {byStatus.paid > 0 && (
                                              <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs">{byStatus.paid} πληρ</Badge>
                                            )}
                                            {byStatus.submitted > 0 && (
                                              <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs">{byStatus.submitted} υποβ</Badge>
                                            )}
                                            {byStatus.pending > 0 && (
                                              <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200 text-xs">{byStatus.pending} εκκρ</Badge>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShowDetails(beneficiary);
                                }}
                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                              >
                                <Info className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(beneficiary);
                                }}
                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(beneficiary);
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  }

                  // Grid view (flip cards)
                  const isFlipped = flippedCards.has(beneficiary.id);

                  const handleCardClick = (e: React.MouseEvent) => {
                    // Allow flipping anywhere on the card except buttons
                    if (!(e.target as HTMLElement).closest("button")) {
                      toggleCardFlip(beneficiary.id);
                    }
                  };

                  return (
                    <div
                      key={beneficiary.id}
                      className="flip-card"
                      onClick={handleCardClick}
                    >
                      <div
                        className={`flip-card-inner ${isFlipped ? "rotate-y-180" : ""}`}
                      >
                        {/* Front of card */}
                        <div className="flip-card-front">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-purple-600"></div>
                          <div className="p-6 h-full flex flex-col">
                            {/* Header with name and actions */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="space-y-1 flex-1">
                                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                  {beneficiary.surname} {beneficiary.name}
                                </h3>
                                {beneficiary.fathername && (
                                  <p className="text-sm text-gray-600 italic">
                                    του {beneficiary.fathername}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <User className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                    ΑΦΜ: {beneficiary.afm}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-purple-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(beneficiary.afm, "ΑΦΜ");
                                    }}
                                    title="Αντιγραφή ΑΦΜ"
                                  >
                                    <Copy className="h-3 w-3 text-purple-600" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-purple-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowDetails(beneficiary);
                                  }}
                                >
                                  <Info className="h-4 w-4 text-purple-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-purple-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(beneficiary);
                                  }}
                                >
                                  <Edit className="h-4 w-4 text-purple-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-red-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(beneficiary);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>

                            {/* Key Information Section */}
                            <div className="flex-1 space-y-3">
                              {/* Financial Summary - Most Prominent */}
                              {getTotalAmountForBeneficiary(beneficiary.id) >
                                0 && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="w-5 h-5 text-green-600" />
                                      <span className="text-sm font-medium text-green-800">
                                        Συνολικό Ποσό
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xl font-bold text-green-900">
                                        {new Intl.NumberFormat("el-GR", {
                                          style: "currency",
                                          currency: "EUR",
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }).format(
                                          getTotalAmountForBeneficiary(
                                            beneficiary.id,
                                          ),
                                        )}
                                      </div>
                                      <div className="text-xs text-green-700">
                                        {
                                          getPaymentsForBeneficiary(
                                            beneficiary.id,
                                          ).length
                                        }{" "}
                                        πληρωμές
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Location and Project Info */}
                              <div className="grid grid-cols-1 gap-2">
                                {getExpenditureTypesForBeneficiary(
                                  beneficiary.id,
                                ).length > 0 && (
                                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <FileText className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs text-amber-600 font-medium">
                                        Τύποι Δαπάνης
                                      </span>
                                      <p className="text-sm text-amber-900 font-medium leading-tight">
                                        {getExpenditureTypesForBeneficiary(
                                          beneficiary.id,
                                        )
                                          .slice(0, 2)
                                          .join(", ")}
                                        {getExpenditureTypesForBeneficiary(
                                          beneficiary.id,
                                        ).length > 2 &&
                                          ` +${getExpenditureTypesForBeneficiary(beneficiary.id).length - 2} άλλοι`}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Latest payment info */}
                                {(() => {
                                  const latest = getLatestPaymentForBeneficiary(beneficiary.id);
                                  return (
                                    <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                      <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                                      <div className="min-w-0 flex-1">
                                        <span className="text-xs text-purple-600 font-medium">
                                          Πληρωμή & EPS
                                        </span>
                                        <p className="text-sm text-purple-900 font-medium leading-tight">
                                          Πληρωμή: {latest?.payment_date
                                            ? new Date(latest.payment_date).toLocaleDateString("el-GR")
                                            : "—"}
                                        </p>
                                        <p className="text-xs text-purple-800 truncate" title={latest?.freetext || "—"}>
                                          EPS: {latest?.freetext || "Δεν έχει πραγματοποιηθεί η πληρωμή"}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* IMPORTANT #3: Empty state indicator */}
                                {getTotalAmountForBeneficiary(
                                  beneficiary.id,
                                ) === 0 && (
                                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                    <AlertCircle className="w-4 h-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">Δεν υπάρχουν πληρωμές</span>
                                  </div>
                                )}

                                {/* Region Info from regiondet */}
                                {formatRegiondet(beneficiary.regiondet).length > 0 && (
                                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Περιφέρειες
                                      </span>
                                      <p className="text-sm text-blue-900 font-medium leading-tight">
                                        {formatRegiondet(beneficiary.regiondet)
                                          .slice(0, 2)
                                          .join(", ")}
                                        {formatRegiondet(beneficiary.regiondet).length > 2 &&
                                          ` +${formatRegiondet(beneficiary.regiondet).length - 2} άλλες`}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Administrative Info */}
                                {(beneficiary.adeia ||
                                  beneficiary.onlinefoldernumber) && (
                                  <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <Shield className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs text-slate-600 font-medium">
                                        Διοικητικά Στοιχεία
                                      </span>
                                      {beneficiary.adeia && (
                                        <p className="text-sm text-slate-900 font-medium">
                                          Άδεια: {beneficiary.adeia}
                                        </p>
                                      )}
                                      {beneficiary.onlinefoldernumber && (
                                        <p className="text-sm text-slate-900 font-medium">
                                          Φάκελος:{" "}
                                          {beneficiary.onlinefoldernumber}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div
                              className="flex items-center justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleCardFlip(beneficiary.id)}
                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                              >
                                <Info className="w-4 h-4 mr-2" />
                                Περισσότερα στοιχεία
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Back of card */}
                        <div className="flip-card-back bg-purple-50">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-purple-600"></div>
                          <div className="p-6 h-full flex flex-col">
                            <div className="flex items-start justify-between mb-4 flex-shrink-0">
                              <div className="space-y-1">
                                <h3 className="text-lg font-bold text-purple-900">
                                  Λεπτομέρειες Δικαιούχου
                                </h3>
                                <p className="text-purple-700 text-sm">
                                  {beneficiary.surname} {beneficiary.name}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCardFlip(beneficiary.id);
                                }}
                                className="text-purple-600 hover:bg-purple-100 flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Scrollable content area */}
                            <div className="flex-1 overflow-y-auto space-y-4 text-sm custom-scrollbar">
                              {/* Financial Overview */}
                              {(() => {
                                const payments = getPaymentsForBeneficiary(
                                  beneficiary.id,
                                );
                                const totalAmount =
                                  getTotalAmountForBeneficiary(beneficiary.id);

                                if (payments.length === 0) return null;

                                // Group payments by expenditure type
                                const groupedPayments = payments.reduce(
                                  (acc: any, payment: any) => {
                                    const type =
                                      payment.expenditure_type || "Άλλο";
                                    if (!acc[type]) {
                                      acc[type] = { payments: [], total: 0 };
                                    }
                                    acc[type].payments.push(payment);
                                    acc[type].total += parseFloat(
                                      payment.amount || 0,
                                    );
                                    return acc;
                                  },
                                  {},
                                );

                                return (
                                  <div className="space-y-3">
                                    <div className="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 rounded-lg p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <CreditCard className="w-5 h-5 text-green-700" />
                                        <span className="font-semibold text-green-800">
                                          Οικονομική Επισκόπηση
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-white/70 p-3 rounded border">
                                          <div className="text-xs text-green-600 font-medium">
                                            Συνολικό Ποσό
                                          </div>
                                          <div className="text-lg font-bold text-green-900">
                                            {new Intl.NumberFormat("el-GR", {
                                              style: "currency",
                                              currency: "EUR",
                                            }).format(totalAmount)}
                                          </div>
                                        </div>
                                        <div className="bg-white/70 p-3 rounded border">
                                          <div className="text-xs text-green-600 font-medium">
                                            Πληρωμές
                                          </div>
                                          <div className="text-lg font-bold text-green-900">
                                            {payments.length}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Payment breakdown by type */}
                                      <div className="space-y-2">
                                        <div className="text-xs text-green-700 font-medium">
                                          Κατανομή ανά Τύπο:
                                        </div>
                                        {Object.entries(groupedPayments).map(
                                          ([type, data]: [string, any]) => (
                                            <div
                                              key={type}
                                              className="bg-white/70 p-2 rounded border flex justify-between items-center"
                                            >
                                              <div>
                                                <div className="text-xs font-medium text-green-800">
                                                  {type}
                                                </div>
                                                <div className="text-xs text-green-600">
                                                  {data.payments.length}{" "}
                                                  πληρωμές
                                                </div>
                                              </div>
                                              <div className="font-semibold text-green-900 text-sm">
                                                {new Intl.NumberFormat(
                                                  "el-GR",
                                                  {
                                                    style: "currency",
                                                    currency: "EUR",
                                                  },
                                                ).format(data.total)}
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>

                                      {/* IMPORTANT #2: Payment status breakdown by state - only show if there are non-paid payments */}
                                      {(() => {
                                        const statusCounts = payments.reduce((acc: any, p: any) => {
                                          acc[p.status] = (acc[p.status] || 0) + 1;
                                          return acc;
                                        }, {} as Record<string, number>);
                                        
                                        // Only show status section if there are unpaid/submitted payments
                                        const hasNonPaidPayments = (statusCounts.submitted || 0) > 0 || (statusCounts.pending || 0) > 0;
                                        if (!hasNonPaidPayments) return null;
                                        
                                        return (
                                          <div className="space-y-2 mt-3 pt-3 border-t border-green-200">
                                            <div className="text-xs text-green-700 font-medium">
                                              Κατάσταση Πληρωμών:
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                              {statusCounts.submitted > 0 && (
                                                <div className="bg-blue-200/50 px-2 py-1 rounded border border-blue-300 text-xs font-medium text-blue-800">
                                                  ⬆ {statusCounts.submitted} υποβλημένες
                                                </div>
                                              )}
                                              {statusCounts.pending > 0 && (
                                                <div className="bg-yellow-200/50 px-2 py-1 rounded border border-yellow-300 text-xs font-medium text-yellow-800">
                                                  ⏳ {statusCounts.pending} εκκρεμείς
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Administrative Information */}
                              {(beneficiary.adeia ||
                                beneficiary.onlinefoldernumber) && (
                                <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Shield className="w-5 h-5 text-slate-600" />
                                    <span className="font-semibold text-slate-700">
                                      Διοικητικά Στοιχεία
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {beneficiary.adeia && (
                                      <div className="bg-white/70 p-3 rounded border">
                                        <div className="text-xs text-slate-600 font-medium">
                                          Αριθμός Άδειας
                                        </div>
                                        <div className="font-mono text-sm text-slate-900">
                                          {beneficiary.adeia}
                                        </div>
                                      </div>
                                    )}
                                    {beneficiary.onlinefoldernumber && (
                                      <div className="bg-white/70 p-3 rounded border">
                                        <div className="text-xs text-slate-600 font-medium">
                                          Διαδικτυακός Φάκελος
                                        </div>
                                        <div className="font-mono text-sm text-slate-900">
                                          {beneficiary.onlinefoldernumber}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Engineering Information */}
                              {(beneficiary.ceng1 ||
                                beneficiary.ceng2) && (
                                <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Building2 className="w-5 h-5 text-orange-600" />
                                    <span className="font-semibold text-orange-700">
                                      Στοιχεία Μηχανικών
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {beneficiary.ceng1 && (
                                      <div className="bg-white/70 p-3 rounded border">
                                        <div className="text-xs text-orange-600 font-medium">
                                          Μηχανικός 1
                                        </div>
                                        <div className="text-sm text-orange-900 font-medium">
                                          {engineerMap.has(beneficiary.ceng1)
                                            ? `${engineerMap.get(beneficiary.ceng1)?.surname} ${engineerMap.get(beneficiary.ceng1)?.name}`
                                            : `ID: ${beneficiary.ceng1}`}
                                        </div>
                                      </div>
                                    )}
                                    {beneficiary.ceng2 && (
                                      <div className="bg-white/70 p-3 rounded border">
                                        <div className="text-xs text-orange-600 font-medium">
                                          Μηχανικός 2
                                        </div>
                                        <div className="text-sm text-orange-900 font-medium">
                                          {engineerMap.has(beneficiary.ceng2)
                                            ? `${engineerMap.get(beneficiary.ceng2)?.surname} ${engineerMap.get(beneficiary.ceng2)?.name}`
                                            : `ID: ${beneficiary.ceng2}`}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Additional Notes */}
                              {beneficiary.freetext && (
                                <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    <span className="font-semibold text-purple-700">
                                      Επιπλέον Πληροφορίες
                                    </span>
                                  </div>
                                  <div className="bg-white/70 p-3 rounded border">
                                    <p className="text-sm text-purple-900 leading-relaxed break-words">
                                      {beneficiary.freetext}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Creation Date */}
                              {beneficiary.created_at && (
                                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-600" />
                                    <div>
                                      <div className="text-xs text-gray-600 font-medium">
                                        Ημερομηνία Δημιουργίας
                                      </div>
                                      <div className="text-sm text-gray-900">
                                        {new Date(
                                          beneficiary.created_at,
                                        ).toLocaleDateString("el-GR", {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-muted-foreground space-y-2">
                  <Users className="h-8 w-8" />
                  <p>Δεν βρέθηκαν δικαιούχοι</p>
                  {searchTerm && (
                    <p className="text-sm">
                      Δοκιμάστε διαφορετικούς όρους αναζήτησης
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Προηγούμενη
                </Button>
                <span className="text-sm text-muted-foreground">
                  Σελίδα {currentPage} από {totalPages} • {paginatedBeneficiaries.length} δικαιούχοι
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Επόμενη
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Details Modal - also handles create and edit */}
      <BeneficiaryDetailsModal
        beneficiary={
          detailsBeneficiary
            ? {
                ...detailsBeneficiary,
                fathername: detailsBeneficiary.fathername || null,
              }
            : null
        }
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        initialEditMode={detailsInitialEditMode}
        onCreateBeneficiary={(data) => {
          createMutation.mutate(data);
          setDetailsModalOpen(false);
        }}
        onCreatePaymentDocument={(beneficiaryData) => {
          setInitialBeneficiaryForDocument(beneficiaryData);
          setCreateDocumentOpen(true);
        }}
      />

      {/* Create Document Dialog with prefilled beneficiary */}
      <CreateDocumentDialog
        open={createDocumentOpen}
        onOpenChange={(open) => {
          setCreateDocumentOpen(open);
          if (!open) {
            setInitialBeneficiaryForDocument(undefined);
          }
        }}
        onClose={() => {
          setCreateDocumentOpen(false);
          setInitialBeneficiaryForDocument(undefined);
        }}
        initialBeneficiary={initialBeneficiaryForDocument}
      />

      {/* Existing Payments Modal */}
      <Dialog
        open={existingPaymentsModalOpen}
        onOpenChange={setExistingPaymentsModalOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Υπάρχουσες Πληρωμές
              {selectedBeneficiaryForPayments && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {selectedBeneficiaryForPayments.surname}{" "}
                  {selectedBeneficiaryForPayments.name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Προβολή όλων των καταχωρημένων πληρωμών για τον επιλεγμένο
              δικαιούχο
            </DialogDescription>
          </DialogHeader>
          {selectedBeneficiaryForPayments && (
            <ExistingPaymentsDisplay
              beneficiary={selectedBeneficiaryForPayments}
            />
          )}
        </DialogContent>
      </Dialog>
      {user && <FAB />}
    </div>
  );
}

function ExistingPaymentsDisplay({
  beneficiary,
}: {
  beneficiary: Beneficiary;
}) {
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/beneficiary-payments", beneficiary.id],
    enabled: !!beneficiary.id,
  });
  
  const handleDocumentClick = async (documentId: number) => {
    try {
      const doc = await apiRequest(`/api/documents/${documentId}`);
      setSelectedDocument(doc);
      setShowDocumentModal(true);
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!Array.isArray(payments) || payments.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">
          <DollarSign className="h-8 w-8 mx-auto mb-2" />
          <p>Δεν βρέθ;�καν καταχωρημένες πληρωμές για αυτόν τον δικαιούχο</p>
        </div>
      </div>
    );
  }

  const totalAmount = payments.reduce(
    (sum: number, payment: any) => sum + (parseEuropeanNumber(payment.amount) || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <span className="text-sm font-medium text-muted-foreground">
            Συνολικές Πληρωμές
          </span>
          <p className="text-lg font-bold">{payments.length}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">
            Συνολικό Ποσό
          </span>
          <p className="text-lg font-bold text-green-700">
            {totalAmount.toLocaleString("el-GR")} €
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">ΑΦΜ</span>
          <p className="text-lg font-mono">{beneficiary.afm}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <h4 className="font-medium">Λεπτομέρειες Πληρωμών</h4>
        </div>
        <div className="divide-y">
          {payments.map((payment: any, index: number) => (
            <div key={payment.id || index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">
                    Μονάδα
                  </span>
                  <span className="text-sm">{payment.unit_code}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">
                    Κωδικός ΝΑ853
                  </span>
                  <span className="font-mono text-sm">
                    {payment.na853_code}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">
                    Τύπος Δαπάνης
                  </span>
                  <span className="text-sm">{payment.expenditure_type}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">
                    Δόση
                  </span>
                  <span className="text-sm">{payment.installment}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">
                    Ποσό (€)
                  </span>
                  <span className="font-semibold text-green-700 text-sm">
                    {parseEuropeanNumber(payment.amount).toLocaleString("el-GR")} €
                  </span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">
                    Αρ. Πρωτοκόλλου
                  </span>
                  <span className="font-mono text-sm">
                    {payment.protocol_number || "—"}
                  </span>
                </div>
              </div>
              {payment.payment_date && (
                <div className="mt-2 pt-2 border-t border-muted">
                  <span className="text-xs text-muted-foreground">
                    Ημερομηνία Πληρωμής:{" "}
                  </span>
                  <span className="text-xs">
                    {new Date(payment.payment_date).toLocaleDateString("el-GR")}
                  </span>
                </div>
              )}
              
              {/* EPS Field */}
              <div className="mt-2 pt-2 border-t border-muted">
                <span className="text-xs text-muted-foreground">
                  EPS:{" "}
                </span>
                <span className="text-xs font-mono">
                  {payment.eps || payment.freetext || "Δεν έχει πραγματοποιηθεί η πληρωμή"}
                </span>
              </div>
              
              {/* Document Link */}
              {payment.document_id && (
                <div className="mt-2 pt-2 border-t border-muted">
                  <span className="text-xs text-muted-foreground">
                    Έγγραφο:{" "}
                  </span>
                  <button
                    onClick={() => handleDocumentClick(payment.document_id)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Άνοιγμα εγγράφου #{payment.document_id}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Document Details Modal */}
      <DocumentDetailsModal
        open={showDocumentModal}
        onOpenChange={setShowDocumentModal}
        document={selectedDocument}
      />
    </div>
  );
}

function BeneficiaryForm({
  beneficiary,
  onSubmit,
  onCancel,
  dialogOpen,
}: {
  beneficiary?: Beneficiary;
  onSubmit: (data: BeneficiaryFormData) => void;
  onCancel?: () => void;
  dialogOpen: boolean;
}) {
  const [payments, setPayments] = useState<
    Array<{
      unit: string;
      expenditure_type: string;
      na853: string;
      amount: string;
      installment: string;
      protocol: string;
      status: string;
    }>
  >([]);
  const [existingPaymentsModalOpen, setExistingPaymentsModalOpen] =
    useState(false);
  const [selectedBeneficiaryForPayments, setSelectedBeneficiaryForPayments] =
    useState<Beneficiary | null>(null);

  const { data: userData } = useQuery({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: unitsData, isLoading: unitsLoading } = useQuery({
    queryKey: ["/api/public/units"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["/api/projects"],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: existingPayments } = useQuery({
    queryKey: ["/api/beneficiary-payments", beneficiary?.id],
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false,
    enabled: !!beneficiary?.id,
  });

  const form = useForm<BeneficiaryFormData>({
    resolver: zodResolver(beneficiaryFormSchema),
    defaultValues: {
      surname: beneficiary?.surname || "",
      name: beneficiary?.name || "",
      fathername: beneficiary?.fathername || "",
      afm: beneficiary?.afm?.toString() || "",
      project: "",
      expenditure_type: "",
      monada: "",
      adeia: beneficiary?.adeia?.toString() || "",
      ceng1: beneficiary?.ceng1 ?? null,
      ceng2: beneficiary?.ceng2 ?? null,
      selectedUnit: "",
      selectedNA853: "",
      amount: "",
      installment: "",
      protocol: "",
      freetext: beneficiary?.freetext || "",
      date: beneficiary?.date?.toString() || "",
    },
  });

  // Track initialization state to prevent excessive re-renders
  const initializationRef = useRef({
    hasAutoSelected: false,
    lastSelectedUnit: "",
    isInitialized: false,
  });

  // Get user's available units with optimized filtering
  const userUnits = useMemo(() => {
    const userUnitsArray = (userData as any)?.user?.units;

    if (
      !userUnitsArray ||
      !Array.isArray(userUnitsArray) ||
      !Array.isArray(unitsData)
    ) {
      return [];
    }

    const filtered = unitsData.filter((unit: any) =>
      userUnitsArray.includes(unit.id),
    );
    return filtered;
  }, [userData, unitsData]);

  // Optimized auto-selection logic to prevent WebSocket connectivity issues
  const handleAutoUnitSelection = useCallback(() => {
    if (
      !userData ||
      unitsLoading ||
      initializationRef.current.hasAutoSelected
    ) {
      return;
    }

    if (userUnits.length === 1) {
      const currentUnit = form.getValues("selectedUnit");
      if (!currentUnit || currentUnit === "") {
        const unitToSelect = userUnits[0].id;
        form.setValue("selectedUnit", unitToSelect, { shouldValidate: false });
        initializationRef.current.hasAutoSelected = true;
        initializationRef.current.lastSelectedUnit = unitToSelect;
      }
    }
  }, [userUnits, form, userData, unitsLoading]);

  // Single effect for auto-selection with proper cleanup
  useEffect(() => {
    if (!unitsLoading && userData && userUnits.length > 0) {
      handleAutoUnitSelection();
    }
  }, [handleAutoUnitSelection, unitsLoading, userData, userUnits.length]);

  // Reset form when dialog opens - optimized to prevent excessive re-renders
  const handleFormReset = useCallback(() => {
    if (!userUnits.length) return;

    const defaultValues = {
      surname: "",
      name: "",
      fathername: "",
      afm: "",
      project: "",
      expenditure_type: "",
      monada: "",
      adeia: "",
      ceng1: null,
      ceng2: null,
      selectedUnit: userUnits.length === 1 ? userUnits[0].id : "",
      selectedNA853: "",
      amount: "",
      installment: "",
      protocol: "",
      freetext: "",
      date: "",
    };

    form.reset(defaultValues);
    initializationRef.current.isInitialized = true;
  }, [form, userUnits]);

  // Reset form when modal opens for new beneficiary
  useEffect(() => {
    if (
      dialogOpen &&
      !beneficiary &&
      userUnits.length > 0 &&
      !initializationRef.current.isInitialized
    ) {
      handleFormReset();
    }

    // Reset initialization state when dialog closes
    if (!dialogOpen) {
      initializationRef.current.hasAutoSelected = false;
      initializationRef.current.isInitialized = false;
    }
  }, [dialogOpen, beneficiary, userUnits.length, handleFormReset]);

  // Optimized field dependency management to prevent WebSocket issues
  const watchedUnit = form.watch("selectedUnit");
  const watchedNA853 = form.watch("selectedNA853");

  useEffect(() => {
    // Only clear dependent fields when unit actually changes
    if (
      initializationRef.current.lastSelectedUnit &&
      initializationRef.current.lastSelectedUnit !== watchedUnit
    ) {
      form.setValue("selectedNA853", "", { shouldValidate: false });
      form.setValue("expenditure_type", "", { shouldValidate: false });
    }
    initializationRef.current.lastSelectedUnit = watchedUnit || "";
  }, [watchedUnit, form]);

  useEffect(() => {
    // Clear expenditure type when NA853 changes
    if (watchedNA853) {
      form.setValue("expenditure_type", "", { shouldValidate: false });
    }
  }, [watchedNA853, form]);

  // Get projects for selected unit with stable reference to prevent WebSocket issues
  const availableProjects = useMemo(() => {
    if (!watchedUnit || !Array.isArray(projectsData)) {
      return [];
    }

    // Filter by implementing_agency array which contains the unit
    const filtered = projectsData.filter(
      (project: any) =>
        project.implementing_agency &&
        Array.isArray(project.implementing_agency) &&
        project.implementing_agency.includes(watchedUnit) &&
        project.na853,
    );

    return filtered;
  }, [projectsData, watchedUnit]);

  // Get expenditure types for selected NA853 with stable reference
  const availableExpenditureTypes = useMemo(() => {
    if (!watchedNA853 || !Array.isArray(projectsData)) return [];

    const project = projectsData.find((p: any) => p.na853 === watchedNA853);
    if (!project?.expenditure_type) return [];

    // Parse expenditure types - handle both string and array formats
    let types: string[] = [];
    if (typeof project.expenditure_type === "string") {
      try {
        types = JSON.parse(project.expenditure_type);
      } catch {
        types = [project.expenditure_type];
      }
    } else if (Array.isArray(project.expenditure_type)) {
      types = project.expenditure_type;
    }

    return types.filter((type) => type && type.trim());
  }, [projectsData, watchedNA853]);

  // Format number to European format with proper comma support
  const formatEuropeanNumber = (value: string) => {
    // Allow only digits and comma
    const cleanValue = value.replace(/[^\d,]/g, "");

    // Handle multiple commas - only keep the first one
    const commaIndex = cleanValue.indexOf(",");
    const beforeComma = cleanValue.substring(
      0,
      commaIndex === -1 ? cleanValue.length : commaIndex,
    );
    const afterComma =
      commaIndex === -1
        ? ""
        : cleanValue.substring(commaIndex + 1).replace(/,/g, "");

    // Format whole part with thousand separators (dots)
    const formattedWhole = beforeComma.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    // Return formatted number with proper decimal handling
    if (afterComma) {
      return `${formattedWhole},${afterComma.slice(0, 2)}`; // Limit to 2 decimal places
    }
    return formattedWhole;
  };

  const addPayment = () => {
    const selectedUnit = form.getValues("selectedUnit");
    const expenditure_type = form.getValues("expenditure_type");
    const selectedNA853 = form.getValues("selectedNA853");
    const amount = form.getValues("amount");
    const installment = form.getValues("installment");
    const protocol = form.getValues("protocol");

    if (selectedUnit && expenditure_type && amount) {
      setPayments((prev) => [
        ...prev,
        {
          unit: selectedUnit,
          expenditure_type,
          na853: selectedNA853 || "",
          amount,
          installment: installment || "ΕΦΑΠΑΞ",
          protocol: protocol || "",
          status: "νέα",
        },
      ]);

      // Clear the form fields
      form.setValue("selectedUnit", "");
      form.setValue("expenditure_type", "");
      form.setValue("selectedNA853", "");
      form.setValue("amount", "");
      form.setValue("installment", "");
      form.setValue("protocol", "");
    }
  };

  const removePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/public/units"],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Fetch geographic data for region selection
  const { data: geographicData } = useQuery({
    queryKey: ["/api/geographic-data"],
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="surname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Επώνυμο *</FormLabel>
                <FormControl>
                  <Input placeholder="Επώνυμο" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Όνομα *</FormLabel>
                <FormControl>
                  <Input placeholder="Όνομα" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fathername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Πατρώνυμο</FormLabel>
                <FormControl>
                  <Input placeholder="Πατρώνυμο" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Tax Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="afm"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600" />
                  ΑΦΜ *
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="123456789"
                      {...field}
                      maxLength={9}
                      className="pl-8 font-mono"
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        field.onChange(value);
                      }}
                    />
                    <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                      <span className="text-xs text-muted-foreground">#</span>
                    </div>
                  </div>
                </FormControl>
                <FormDescription className="text-xs">
                  Εισάγετε έγκυρο ελληνικό ΑΦΜ (9 ψηφία)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* License Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="adeia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Αριθμός Άδειας</FormLabel>
                <FormControl>
                  <Input placeholder="Αριθμός άδειας" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Note: onlinefoldernumber field removed due to database schema compatibility issues */}
        </div>

        {/* Engineer Information - Now uses employee foreign keys */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Στοιχεία Μηχανικών</h3>
          <p className="text-sm text-muted-foreground">
            Οι μηχανικοί συνδέονται μέσω του πίνακα υπαλλήλων.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ceng1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Μηχανικού 1</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="ID μηχανικού" 
                      value={field.value ?? ""} 
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ceng2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Μηχανικού 2</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="ID μηχανικού" 
                      value={field.value ?? ""} 
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Payment Management Section */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            Διαχείριση Πληρωμών
          </h3>
          <p className="text-sm text-muted-foreground">
            Προσθήκη οικονομικών στοιχείων για τον δικαιούχο. Μπορείτε να
            προσθέσετε πολλαπλούς τύπους δαπάνης και κωδικούς ΝΑ853.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="selectedUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Μονάδα</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={unitsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            unitsLoading
                              ? "Φόρτωση μονάδων..."
                              : userUnits.length === 0
                                ? "Δεν υπάρχουν διαθέσιμες μονάδες"
                                : "Επιλέξτε μονάδα"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {unitsLoading ? (
                        <SelectItem value="loading" disabled>
                          Φόρτωση...
                        </SelectItem>
                      ) : userUnits.length > 0 ? (
                        userUnits.map((unit: any) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))
                      ) : unitsData && Array.isArray(unitsData) ? (
                        unitsData.map((unit: any) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Δεν υπάρχουν διαθέσιμες μονάδες
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selectedNA853"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Κωδικός ΝΑ853</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("expenditure_type", "");
                    }}
                    value={field.value}
                    disabled={
                      !form.watch("selectedUnit") ||
                      availableProjects.length === 0
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            form.watch("selectedUnit")
                              ? availableProjects.length > 0
                                ? "Επιλέξτε κωδικό ΝΑ853"
                                : "Δεν υπάρχουν διαθέσιμα έργα"
                              : "Πρώτα επιλέξτε μονάδα"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableProjects.map((project: any) => (
                        <SelectItem
                          key={project.id || project.mis}
                          value={project.na853 || ""}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{project.na853}</span>
                            <span className="text-xs text-muted-foreground">
                              {project.title ||
                                project.event_description ||
                                project.name ||
                                `MIS: ${project.mis}`}
                            </span>
                          </div>
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
              name="expenditure_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Τύπος Δαπάνης</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!form.watch("selectedNA853")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            form.watch("selectedNA853")
                              ? "Επιλέξτε τύπο δαπάνης"
                              : "Πρώτα επιλέξτε κωδικό ΝΑ853"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableExpenditureTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="installment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Δόση</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Επιλέξτε δόση" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {form.watch("expenditure_type") ===
                      "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ" ? (
                        <>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i + 1} value={`ΤΡΙΜΗΝΟ ${i + 1}`}>
                              ΤΡΙΜΗΝΟ {i + 1}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <>
                          <SelectItem value="ΕΦΑΠΑΞ">ΕΦΑΠΑΞ</SelectItem>
                          <SelectItem value="Α ΔΟΣΗ">Α ΔΟΣΗ</SelectItem>
                          <SelectItem value="Β ΔΟΣΗ">Β ΔΟΣΗ</SelectItem>
                          <SelectItem value="Γ ΔΟΣΗ">Γ ΔΟΣΗ</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ποσό (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => {
                        const formattedValue = formatEuropeanNumber(
                          e.target.value,
                        );
                        field.onChange(formattedValue);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="protocol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Αρ. Πρωτοκόλλου</FormLabel>
                  <FormControl>
                    <Input placeholder="Αριθμός πρωτοκόλλου" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPayment}
              disabled={
                !form.getValues("selectedUnit") ||
                !form.getValues("expenditure_type") ||
                !form.getValues("amount")
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Προσθήκη Πληρωμής
            </Button>
            {beneficiary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBeneficiaryForPayments(beneficiary);
                  setExistingPaymentsModalOpen(true);
                }}
                disabled={
                  !Array.isArray(existingPayments) ||
                  existingPayments.length === 0
                }
              >
                <FileText className="w-4 h-4 mr-2" />
                Προβολή Υπαρχουσών (
                {Array.isArray(existingPayments) ? existingPayments.length : 0})
              </Button>
            )}
          </div>
          {/* Payment Entries Table */}
          {payments.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <h4 className="font-medium text-sm">Καταχωρημένες Πληρωμές</h4>
              </div>
              <div className="divide-y">
                {payments.map((payment, index) => (
                  <div
                    key={index}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 flex-1 text-sm">
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">
                          Μονάδα
                        </span>
                        <span>{payment.unit}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">
                          Κωδικός ΝΑ853
                        </span>
                        <span className="font-mono">
                          {payment.na853 || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">
                          Τύπος Δαπάνης
                        </span>
                        <span>{payment.expenditure_type}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">
                          Δόση
                        </span>
                        <span>{payment.installment}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">
                          Ποσό (€)
                        </span>
                        <span className="font-semibold text-green-700">
                          {payment.amount} €
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">
                          Αρ. Πρωτοκόλλου
                        </span>
                        <span className="font-mono">
                          {payment.protocol || "—"}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayment(index)}
                      className="ml-2 text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Additional Information */}
        <FormField
          control={form.control}
          name="freetext"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ελεύθερο Κείμενο</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Πρόσθετες πληροφορίες..."
                  {...field}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              setPayments([]);
              if (onCancel) {
                onCancel();
              }
            }}
          >
            Ακύρωση
          </Button>
          <Button type="submit">
            {beneficiary ? "Ενημέρωση" : "Δημιουργία"}
          </Button>
        </div>
      </form>
    </Form>
    
    {/* Existing Payments Modal inside form */}
    <Dialog
      open={existingPaymentsModalOpen}
      onOpenChange={setExistingPaymentsModalOpen}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-5 w-5" />
            Υπάρχουσες Πληρωμές
            {selectedBeneficiaryForPayments && (
              <span className="text-sm font-normal text-muted-foreground">
                {selectedBeneficiaryForPayments.surname}{" "}
                {selectedBeneficiaryForPayments.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Προβολή όλων των καταχωρημένων πληρωμών για τον επιλεγμένο
            δικαιούχο
          </DialogDescription>
        </DialogHeader>
        {selectedBeneficiaryForPayments && (
          <ExistingPaymentsDisplay
            beneficiary={selectedBeneficiaryForPayments}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
