import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  X,
} from "lucide-react";
import { Header } from "@/components/header";
import { BeneficiaryDetailsModal } from "@/components/beneficiaries/BeneficiaryDetailsModal";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { useMemo } from "react";
// Beneficiary type definition
interface Beneficiary {
  id: number;
  afm: string;
  surname: string;
  name: string;
  fathername: string | null;
  region: string | null;
  adeia: number | null;
  cengsur1: string | null;
  cengname1: string | null;
  cengsur2: string | null;
  cengname2: string | null;
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
  afm: z.string()
    .length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    .regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να περιέχει μόνο αριθμούς")
    .refine((val) => {
      // Greek AFM validation algorithm
      const digits = val.split('').map(Number);
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += digits[i] * Math.pow(2, 8 - i);
      }
      const remainder = sum % 11;
      const checkDigit = remainder < 2 ? remainder : 11 - remainder;
      return checkDigit === digits[8];
    }, "Μη έγκυρο ΑΦΜ"),
  
  // Project & Location Information
  project: z.string().optional(),
  expenditure_type: z.string().optional(),
  region: z.string().optional(),
  monada: z.string().optional(),
  
  // License Information
  adeia: z.string().optional(),
  onlinefoldernumber: z.string().optional(),
  
  // Engineer Information
  cengsur1: z.string().optional(),
  cengname1: z.string().optional(),
  cengsur2: z.string().optional(),
  cengname2: z.string().optional(),
  
  // Financial Information - Multiple payment entries with complex structure
  selectedUnit: z.string().optional(),
  selectedNA853: z.string().optional(),
  amount: z.string().optional(),
  installment: z.string().optional(),
  protocol: z.string().optional(),
  
  // Additional Information
  freetext: z.string().max(500, "Το ελεύθερο κείμενο δεν μπορεί να υπερβαίνει τους 500 χαρακτήρες").optional(),
  date: z.string().optional(),
});

type BeneficiaryFormData = z.infer<typeof beneficiaryFormSchema>;

export default function BeneficiariesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<
    Beneficiary | undefined
  >();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsBeneficiary, setDetailsBeneficiary] =
    useState<Beneficiary | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(60);
  const [existingPaymentsModalOpen, setExistingPaymentsModalOpen] = useState(false);
  const [selectedBeneficiaryForPayments, setSelectedBeneficiaryForPayments] = useState<Beneficiary | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch beneficiaries
  const {
    data: beneficiaries = [],
    isLoading,
    error,
  } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  // Fetch units for dropdown
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/public/units"],
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Fetch beneficiary payments for enhanced display
  const {
    data: beneficiaryPayments = [],
  } = useQuery({
    queryKey: ["/api/beneficiary-payments"],
    enabled: beneficiaries.length > 0,
  });

  // Helper function to get payments for a specific beneficiary
  const getPaymentsForBeneficiary = (beneficiaryId: number) => {
    if (!Array.isArray(beneficiaryPayments)) return [];
    return beneficiaryPayments.filter((payment: any) => payment.beneficiary_id === beneficiaryId);
  };

  // Helper function to calculate total amount for a beneficiary
  const getTotalAmountForBeneficiary = (beneficiaryId: number) => {
    const payments = getPaymentsForBeneficiary(beneficiaryId);
    return payments.reduce((sum: number, payment: any) => sum + (parseFloat(payment.amount) || 0), 0);
  };

  // Helper function to get unique expenditure types for a beneficiary
  const getExpenditureTypesForBeneficiary = (beneficiaryId: number) => {
    const payments = getPaymentsForBeneficiary(beneficiaryId);
    const types = payments.map((payment: any) => payment.expenditure_type).filter(Boolean);
    return Array.from(new Set(types));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: BeneficiaryFormData) =>
      fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
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
      fetch(`/api/beneficiaries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
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
      fetch(`/api/beneficiaries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
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

  const handleEdit = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setDialogOpen(true);
  };

  const handleDelete = (beneficiary: Beneficiary) => {
    if (confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον δικαιούχο;")) {
      deleteMutation.mutate(beneficiary.id);
    }
  };

  const handleShowDetails = (beneficiary: Beneficiary) => {
    setDetailsBeneficiary(beneficiary);
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

  // Filter beneficiaries based on search
  const filteredBeneficiaries = beneficiaries.filter((beneficiary) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      beneficiary.surname?.toLowerCase().includes(searchLower) ||
      beneficiary.name?.toLowerCase().includes(searchLower) ||
      beneficiary.afm?.toString().includes(searchLower) ||
      beneficiary.region?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBeneficiaries = filteredBeneficiaries.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

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
                <p className="mt-4 text-muted-foreground">Φόρτωση δικαιούχων...</p>
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
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setSelectedBeneficiary(undefined);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Νέος Δικαιούχος
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <Input
                placeholder="Αναζήτηση δικαιούχων (όνομα, επώνυμο, ΑΦΜ, περιοχή)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

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
                                    <span>ΑΦΜ: {beneficiary.afm}</span>
                                  </div>
                                  {beneficiary.region && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Building className="w-4 h-4" />
                                      <span>{beneficiary.region}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {getExpenditureTypesForBeneficiary(beneficiary.id).length > 0 && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <FileText className="w-4 h-4" />
                                      <span>{getExpenditureTypesForBeneficiary(beneficiary.id).join(", ")}</span>
                                    </div>
                                  )}
                                  {getTotalAmountForBeneficiary(beneficiary.id) > 0 && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <DollarSign className="w-4 h-4" />
                                      <span>{getTotalAmountForBeneficiary(beneficiary.id).toLocaleString("el-GR")} €</span>
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
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="space-y-2 flex-1">
                                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                                  {beneficiary.surname} {beneficiary.name}
                                  {beneficiary.fathername && (
                                    <span className="text-sm font-normal text-gray-600 italic ml-2">
                                      του {beneficiary.fathername}
                                    </span>
                                  )}
                                </h3>
                                <div className="flex items-center gap-2 mt-3">
                                  <User className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm font-mono text-gray-700">
                                    ΑΦΜ: {beneficiary.afm}
                                  </span>
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

                            <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                              {getExpenditureTypesForBeneficiary(beneficiary.id).length > 0 && (
                                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                                  <span className="text-xs text-gray-600">
                                    Τύποι Δαπάνης
                                  </span>
                                  <span className="text-gray-900 text-xs">
                                    {getExpenditureTypesForBeneficiary(beneficiary.id).join(", ")}
                                  </span>
                                </div>
                              )}
                              {beneficiary.region && (
                                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                                  <span className="text-xs text-gray-600">
                                    Περιοχή
                                  </span>
                                  <span className="text-gray-900">
                                    {beneficiary.region}
                                  </span>
                                </div>
                              )}
                              {getTotalAmountForBeneficiary(beneficiary.id) > 0 && (
                                <div className="flex flex-col py-1.5 px-2 bg-green-50 rounded col-span-2">
                                  <span className="text-xs text-green-600">
                                    Συνολικό Ποσό
                                  </span>
                                  <span className="text-green-900 font-semibold">
                                    {getTotalAmountForBeneficiary(beneficiary.id).toLocaleString("el-GR")} €
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Payment Details Summary */}
                            {getPaymentsForBeneficiary(beneficiary.id).length > 0 && (
                              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <h4 className="text-sm font-medium text-purple-800 mb-2">
                                  Οικονομικά Στοιχεία
                                </h4>
                                <div className="space-y-1">
                                  {getPaymentsForBeneficiary(beneficiary.id).map((payment: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center text-xs">
                                      <span className="text-purple-700">{payment.expenditure_type}</span>
                                      <div className="text-right">
                                        <div className="font-medium">{parseFloat(payment.amount || 0).toLocaleString("el-GR")} €</div>
                                        <div className="text-purple-600">{payment.installment || 'ΕΦΑΠΑΞ'}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

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
                          <div className="p-6 h-full overflow-y-auto">
                            <div className="flex items-start justify-between mb-4">
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
                                className="text-purple-600 hover:bg-purple-100"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="space-y-4 text-sm">
                              {beneficiary.adeia && (
                                <div className="space-y-1">
                                  <span className="text-purple-700 font-medium text-sm">
                                    Άδεια:
                                  </span>
                                  <p className="text-purple-900 text-sm bg-purple-100 p-2 rounded border">
                                    {beneficiary.adeia}
                                  </p>
                                </div>
                              )}
                              {beneficiary.onlinefoldernumber && (
                                <div className="space-y-1">
                                  <span className="text-purple-700 font-medium text-sm">
                                    Αρ. Online Φακέλου:
                                  </span>
                                  <p className="text-purple-900 text-sm bg-purple-100 p-2 rounded border">
                                    {beneficiary.onlinefoldernumber}
                                  </p>
                                </div>
                              )}
                              {beneficiary.cengsur1 && (
                                <div className="space-y-1">
                                  <span className="text-purple-700 font-medium text-sm">
                                    Μηχανικός 1:
                                  </span>
                                  <p className="text-purple-900 text-sm bg-purple-100 p-2 rounded border">
                                    {beneficiary.cengsur1}{" "}
                                    {beneficiary.cengname1}
                                  </p>
                                </div>
                              )}
                              {beneficiary.cengsur2 && (
                                <div className="space-y-1">
                                  <span className="text-purple-700 font-medium text-sm">
                                    Μηχανικός 2:
                                  </span>
                                  <p className="text-purple-900 text-sm bg-purple-100 p-2 rounded border">
                                    {beneficiary.cengsur2}{" "}
                                    {beneficiary.cengname2}
                                  </p>
                                </div>
                              )}
                              {beneficiary.freetext && (
                                <div className="space-y-1">
                                  <span className="text-purple-700 font-medium text-sm">
                                    Ελεύθερο Κείμενο:
                                  </span>
                                  <p className="text-purple-900 text-sm bg-purple-100 p-2 rounded border">
                                    {beneficiary.freetext}
                                  </p>
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
                  Σελίδα {currentPage} από {totalPages}
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

      {/* Details Modal */}
      <BeneficiaryDetailsModal
        beneficiary={detailsBeneficiary ? {
          ...detailsBeneficiary,
          fathername: detailsBeneficiary.fathername || null
        } : null}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />

      {/* Create/Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedBeneficiary ? (
                <>
                  <Edit className="w-5 h-5 text-blue-600" />
                  Επεξεργασία Δικαιούχου
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-green-600" />
                  Νέος Δικαιούχος
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <BeneficiaryForm
            beneficiary={selectedBeneficiary}
            onSubmit={(data) => {
              if (selectedBeneficiary) {
                updateMutation.mutate({ id: selectedBeneficiary.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setDialogOpen(false);
              setSelectedBeneficiary(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Existing Payments Modal */}
      <Dialog open={existingPaymentsModalOpen} onOpenChange={setExistingPaymentsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Υπάρχουσες Πληρωμές
              {selectedBeneficiaryForPayments && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {selectedBeneficiaryForPayments.surname} {selectedBeneficiaryForPayments.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedBeneficiaryForPayments && (
            <ExistingPaymentsDisplay beneficiary={selectedBeneficiaryForPayments} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExistingPaymentsDisplay({ beneficiary }: { beneficiary: Beneficiary }) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/beneficiary-payments", beneficiary.id],
    enabled: !!beneficiary.id
  });

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
          <p>Δεν βρέθηκαν καταχωρημένες πληρωμές για αυτόν τον δικαιούχο</p>
        </div>
      </div>
    );
  }

  const totalAmount = payments.reduce((sum: number, payment: any) => 
    sum + (parseFloat(payment.amount) || 0), 0
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <span className="text-sm font-medium text-muted-foreground">Συνολικές Πληρωμές</span>
          <p className="text-lg font-bold">{payments.length}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">Συνολικό Ποσό</span>
          <p className="text-lg font-bold text-green-700">{totalAmount.toLocaleString("el-GR")} €</p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">ΑΦΜ</span>
          <p className="text-lg font-mono">{beneficiary.afm}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">Περιοχή</span>
          <p className="text-lg">{beneficiary.region || "—"}</p>
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
                  <span className="font-medium text-xs text-muted-foreground block">Μονάδα</span>
                  <span className="text-sm">{payment.unit_code}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">Κωδικός ΝΑ853</span>
                  <span className="font-mono text-sm">{payment.na853_code}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">Τύπος Δαπάνης</span>
                  <span className="text-sm">{payment.expenditure_type}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">Δόση</span>
                  <span className="text-sm">{payment.installment}</span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">Ποσό (€)</span>
                  <span className="font-semibold text-green-700 text-sm">
                    {parseFloat(payment.amount).toLocaleString("el-GR")} €
                  </span>
                </div>
                <div>
                  <span className="font-medium text-xs text-muted-foreground block">Αρ. Πρωτοκόλλου</span>
                  <span className="font-mono text-sm">{payment.protocol_number || "—"}</span>
                </div>
              </div>
              {payment.payment_date && (
                <div className="mt-2 pt-2 border-t border-muted">
                  <span className="text-xs text-muted-foreground">Ημερομηνία Πληρωμής: </span>
                  <span className="text-xs">
                    {new Date(payment.payment_date).toLocaleDateString("el-GR")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BeneficiaryForm({
  beneficiary,
  onSubmit,
  onCancel,
}: {
  beneficiary?: Beneficiary;
  onSubmit: (data: BeneficiaryFormData) => void;
  onCancel?: () => void;
}) {
  const [payments, setPayments] = useState<Array<{
    unit: string;
    expenditure_type: string;
    na853: string;
    amount: string;
    installment: string;
    protocol: string;
    status: string;
  }>>([]);
  const [existingPaymentsModalOpen, setExistingPaymentsModalOpen] = useState(false);
  const [selectedBeneficiaryForPayments, setSelectedBeneficiaryForPayments] = useState<Beneficiary | null>(null);

  const { data: userData } = useQuery({ 
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  const { data: unitsData, isLoading: unitsLoading } = useQuery({ 
    queryKey: ["/api/public/units"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  
  const { data: projectsData } = useQuery({ 
    queryKey: ["/api/projects"],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  
  const { data: existingPayments } = useQuery({ 
    queryKey: ["/api/beneficiary-payments", beneficiary?.id], 
    enabled: !!beneficiary?.id 
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
      region: beneficiary?.region || "",
      monada: "", 
      adeia: beneficiary?.adeia?.toString() || "",
      onlinefoldernumber: beneficiary?.onlinefoldernumber || "",
      cengsur1: beneficiary?.cengsur1 || "",
      cengname1: beneficiary?.cengname1 || "",
      cengsur2: beneficiary?.cengsur2 || "",
      cengname2: beneficiary?.cengname2 || "",
      selectedUnit: "",
      selectedNA853: "",
      amount: "",
      installment: "",
      protocol: "",
      freetext: beneficiary?.freetext || "",
      date: beneficiary?.date?.toString() || "",
    },
  });

  // Get user's available units with debugging
  const userUnits = useMemo(() => {
    const userUnitsArray = (userData as any)?.user?.units;
    
    if (!userUnitsArray || !Array.isArray(userUnitsArray) || !Array.isArray(unitsData)) {
      return [];
    }
    
    const filtered = unitsData.filter((unit: any) => userUnitsArray.includes(unit.id));
    console.log('[Beneficiary Form] Filtered units:', filtered);
    return filtered;
  }, [userData, unitsData]);

  // Auto-select unit if user has only one and data is loaded
  useEffect(() => {
    if (userUnits.length === 1 && !form.getValues("selectedUnit") && !unitsLoading) {
      console.log('[Beneficiary Form] Auto-selecting unit:', userUnits[0].id);
      form.setValue("selectedUnit", userUnits[0].id);
    }
  }, [userUnits, form, unitsLoading]);

  // Reset dependent fields when unit changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "selectedUnit") {
        // Clear NA853 and expenditure type when unit changes
        form.setValue("selectedNA853", "");
        form.setValue("expenditure_type", "");
      } else if (name === "selectedNA853") {
        // Clear expenditure type when NA853 changes
        form.setValue("expenditure_type", "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Get projects for selected unit
  const availableProjects = useMemo(() => {
    const selectedUnit = form.watch("selectedUnit");
    if (!selectedUnit || !Array.isArray(projectsData)) {
      const projectsLength = Array.isArray(projectsData) ? projectsData.length : (projectsData && typeof projectsData === 'object' ? Object.keys(projectsData).length : 0);
      console.log('[Beneficiary Form] No projects available:', { selectedUnit, projectsDataLength: projectsLength });
      return [];
    }
    
    // Filter by implementing_agency array which contains the unit
    const filtered = projectsData.filter((project: any) => 
      project.implementing_agency && 
      Array.isArray(project.implementing_agency) &&
      project.implementing_agency.includes(selectedUnit) &&
      project.na853
    );
    
    console.log('[Beneficiary Form] Found', filtered.length, 'projects for unit', selectedUnit);
    return filtered;
  }, [projectsData, form.watch("selectedUnit")]);

  // Get expenditure types for selected NA853
  const availableExpenditureTypes = useMemo(() => {
    const selectedNA853 = form.watch("selectedNA853");
    if (!selectedNA853 || !Array.isArray(projectsData)) return [];
    
    const project = projectsData.find((p: any) => p.na853 === selectedNA853);
    if (!project?.expenditure_type) return [];
    
    // Parse expenditure types - handle both string and array formats
    let types: string[] = [];
    if (typeof project.expenditure_type === 'string') {
      try {
        types = JSON.parse(project.expenditure_type);
      } catch {
        types = [project.expenditure_type];
      }
    } else if (Array.isArray(project.expenditure_type)) {
      types = project.expenditure_type;
    }
    
    return types.filter(type => type && type.trim());
  }, [projectsData, form.watch("selectedNA853")]);

  // Format number to European format
  const formatEuropeanNumber = (value: string) => {
    // Remove all non-digit characters except comma
    const cleanValue = value.replace(/[^\d,]/g, '');
    
    // Split by comma to handle decimal part
    const parts = cleanValue.split(',');
    let wholePart = parts[0] || '';
    const decimalPart = parts[1] || '';
    
    // Add thousand separators (dots) to whole part
    wholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Return formatted number
    if (decimalPart) {
      return `${wholePart},${decimalPart.slice(0, 2)}`; // Limit to 2 decimal places
    }
    return wholePart;
  };

  const addPayment = () => {
    const selectedUnit = form.getValues("selectedUnit");
    const expenditure_type = form.getValues("expenditure_type");
    const selectedNA853 = form.getValues("selectedNA853");
    const amount = form.getValues("amount");
    const installment = form.getValues("installment");
    const protocol = form.getValues("protocol");

    if (selectedUnit && expenditure_type && amount) {
      setPayments(prev => [...prev, {
        unit: selectedUnit,
        expenditure_type,
        na853: selectedNA853 || "",
        amount,
        installment: installment || "ΕΦΑΠΑΞ",
        protocol: protocol || "",
        status: "νέα"
      }]);

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
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/public/units"],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  return (
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
                        const value = e.target.value.replace(/\D/g, '');
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
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-purple-600" />
                  Περιοχή
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="π.χ. Αθήνα, Θεσσαλονίκη" 
                    {...field}
                    className="capitalize"
                  />
                </FormControl>
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
          <FormField
            control={form.control}
            name="onlinefoldernumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Αρ. Online Φακέλου</FormLabel>
                <FormControl>
                  <Input placeholder="Αριθμός online φακέλου" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Engineer Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Στοιχεία Μηχανικών</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cengsur1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Επώνυμο Μηχανικού 1</FormLabel>
                  <FormControl>
                    <Input placeholder="Επώνυμο μηχανικού" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cengname1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Όνομα Μηχανικού 1</FormLabel>
                  <FormControl>
                    <Input placeholder="Όνομα μηχανικού" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cengsur2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Επώνυμο Μηχανικού 2</FormLabel>
                  <FormControl>
                    <Input placeholder="Επώνυμο μηχανικού" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cengname2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Όνομα Μηχανικού 2</FormLabel>
                  <FormControl>
                    <Input placeholder="Όνομα μηχανικού" {...field} />
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
            Προσθήκη οικονομικών στοιχείων για τον δικαιούχο. Μπορείτε να προσθέσετε πολλαπλούς τύπους δαπάνης και κωδικούς ΝΑ853.
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
                    disabled={unitsLoading || userUnits.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          unitsLoading 
                            ? "Φόρτωση μονάδων..." 
                            : userUnits.length === 0 
                              ? "Δεν υπάρχουν διαθέσιμες μονάδες"
                              : "Επιλέξτε μονάδα"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userUnits.map((unit: any) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
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
                    disabled={!form.watch("selectedUnit") || availableProjects.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          form.watch("selectedUnit") 
                            ? availableProjects.length > 0 
                              ? "Επιλέξτε κωδικό ΝΑ853" 
                              : "Δεν υπάρχουν διαθέσιμα έργα"
                            : "Πρώτα επιλέξτε μονάδα"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableProjects.map((project: any) => (
                        <SelectItem key={project.id || project.mis} value={project.na853 || ""}>
                          <div className="flex flex-col">
                            <span className="font-medium">{project.na853}</span>
                            <span className="text-xs text-muted-foreground">
                              {project.title || project.event_description || project.name || `MIS: ${project.mis}`}
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
                        <SelectValue placeholder={
                          form.watch("selectedNA853") 
                            ? "Επιλέξτε τύπο δαπάνης" 
                            : "Πρώτα επιλέξτε κωδικό ΝΑ853"
                        } />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Επιλέξτε δόση" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {form.watch("expenditure_type") === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ" ? (
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
                          <SelectItem value="Δ ΔΟΣΗ">Δ ΔΟΣΗ</SelectItem>
                          <SelectItem value="Ε ΔΟΣΗ">Ε ΔΟΣΗ</SelectItem>
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
                        const formattedValue = formatEuropeanNumber(e.target.value);
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
              disabled={!form.getValues("selectedUnit") || !form.getValues("expenditure_type") || !form.getValues("amount")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Προσθήκη Πληρωμής
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (beneficiary && Array.isArray(existingPayments) && existingPayments.length > 0) {
                  setSelectedBeneficiaryForPayments(beneficiary);
                  setExistingPaymentsModalOpen(true);
                }
              }}
              disabled={!beneficiary || !Array.isArray(existingPayments) || existingPayments.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              Προβολή Υπαρχουσών ({Array.isArray(existingPayments) ? existingPayments.length : 0})
            </Button>
          </div>

          {/* Payment Entries Table - no longer needed as we have the button above */}
          {payments.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <h4 className="font-medium text-sm">Καταχωρημένες Πληρωμές</h4>
              </div>
              <div className="divide-y">
                {payments.map((payment, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 flex-1 text-sm">
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Μονάδα</span>
                        <span>{payment.unit}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Κωδικός ΝΑ853</span>
                        <span className="font-mono">{payment.na853 || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Τύπος Δαπάνης</span>
                        <span>{payment.expenditure_type}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Δόση</span>
                        <span>{payment.installment}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Ποσό (€)</span>
                        <span className="font-semibold text-green-700">{payment.amount} €</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Αρ. Πρωτοκόλλου</span>
                        <span className="font-mono">{payment.protocol || "—"}</span>
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
          
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addPayment}
              disabled={!form.getValues("selectedUnit") || !form.getValues("expenditure_type") || !form.getValues("amount")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Προσθήκη Πληρωμής
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (beneficiary && Array.isArray(existingPayments) && existingPayments.length > 0) {
                  setSelectedBeneficiaryForPayments(beneficiary);
                  setExistingPaymentsModalOpen(true);
                }
              }}
              disabled={!beneficiary || !Array.isArray(existingPayments) || existingPayments.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              Προβολή Υπαρχουσών ({Array.isArray(existingPayments) ? existingPayments.length : 0})
            </Button>
          </div>

          {/* Payment Entries Table */}
          {payments.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <h4 className="font-medium text-sm">Καταχωρημένες Πληρωμές</h4>
              </div>
              <div className="divide-y">
                {payments.map((payment, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 flex-1 text-sm">
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Μονάδα</span>
                        <span>{payment.unit}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Κωδικός ΝΑ853</span>
                        <span className="font-mono">{payment.na853 || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Τύπος Δαπάνης</span>
                        <span>{payment.expenditure_type}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Δόση</span>
                        <span>{payment.installment}</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Ποσό (€)</span>
                        <span className="font-semibold text-green-700">{parseFloat(payment.amount).toLocaleString("el-GR")} €</span>
                      </div>
                      <div>
                        <span className="font-medium text-xs text-muted-foreground block">Αρ. Πρωτοκόλλου</span>
                        <span className="font-mono">{payment.protocol || "—"}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayment(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 px-4 py-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Συνολικό Ποσό:</span>
                  <span className="font-bold text-green-700">
                    {payments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString("el-GR")} €
                  </span>
                </div>
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
  );
}