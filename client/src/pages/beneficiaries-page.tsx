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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Beneficiary } from "@/lib/types";

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
                        className="transition-shadow hover:shadow-lg flex cursor-pointer"
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
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
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
                                  <User className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-mono text-gray-700">
                                    ΑΦΜ: {beneficiary.afm}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowDetails(beneficiary);
                                  }}
                                >
                                  <Info className="h-4 w-4 text-blue-600" />
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
                              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">
                                  Οικονομικά Στοιχεία
                                </h4>
                                <div className="space-y-1">
                                  {getPaymentsForBeneficiary(beneficiary.id).map((payment: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center text-xs">
                                      <span className="text-blue-700">{payment.expenditure_type}</span>
                                      <div className="text-right">
                                        <div className="font-medium">{parseFloat(payment.amount || 0).toLocaleString("el-GR")} €</div>
                                        <div className="text-blue-600">{payment.installment || 'ΕΦΑΠΑΞ'}</div>
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
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(beneficiary);
                                  }}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Επεξεργασία
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(beneficiary);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Διαγραφή
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back of card */}
                        <div className="flip-card-back">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-600"></div>
                          <div className="p-6">
                            <div className="text-center mb-6">
                              <h3 className="text-lg font-bold text-gray-900 mb-2">
                                Λεπτομέρειες
                              </h3>
                              <p className="text-sm text-gray-600">
                                {beneficiary.surname} {beneficiary.name}
                              </p>
                            </div>

                            <div className="space-y-4 text-sm">
                              {beneficiary.adeia && (
                                <div className="space-y-1">
                                  <span className="text-blue-700 font-medium text-sm">
                                    Άδεια:
                                  </span>
                                  <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                    {beneficiary.adeia}
                                  </p>
                                </div>
                              )}
                              {beneficiary.onlinefoldernumber && (
                                <div className="space-y-1">
                                  <span className="text-blue-700 font-medium text-sm">
                                    Αρ. Online Φακέλου:
                                  </span>
                                  <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                    {beneficiary.onlinefoldernumber}
                                  </p>
                                </div>
                              )}
                              {beneficiary.cengsur1 && (
                                <div className="space-y-1">
                                  <span className="text-blue-700 font-medium text-sm">
                                    Μηχανικός 1:
                                  </span>
                                  <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                    {beneficiary.cengsur1}{" "}
                                    {beneficiary.cengname1}
                                  </p>
                                </div>
                              )}
                              {beneficiary.cengsur2 && (
                                <div className="space-y-1">
                                  <span className="text-blue-700 font-medium text-sm">
                                    Μηχανικός 2:
                                  </span>
                                  <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                    {beneficiary.cengsur2}{" "}
                                    {beneficiary.cengname2}
                                  </p>
                                </div>
                              )}
                              {beneficiary.freetext && (
                                <div className="space-y-1">
                                  <span className="text-blue-700 font-medium text-sm">
                                    Ελεύθερο Κείμενο:
                                  </span>
                                  <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
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
        beneficiary={detailsBeneficiary}
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
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BeneficiaryForm({
  beneficiary,
  onSubmit,
}: {
  beneficiary?: Beneficiary;
  onSubmit: (data: BeneficiaryFormData) => void;
}) {
  const form = useForm<BeneficiaryFormData>({
    resolver: zodResolver(beneficiaryFormSchema),
    defaultValues: {
      surname: beneficiary?.surname || "",
      name: beneficiary?.name || "",
      fathername: beneficiary?.fathername || "",
      afm: beneficiary?.afm?.toString() || "",
      project: "", // Will be set from payment data
      expenditure_type: "", // Not in current schema, will be handled separately
      region: beneficiary?.region || "",
      monada: "", // Will be set from payment data
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
                <FormLabel>ΑΦΜ *</FormLabel>
                <FormControl>
                  <Input placeholder="123456789" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Περιοχή</FormLabel>
                <FormControl>
                  <Input placeholder="Περιοχή" {...field} />
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
          <Button type="button" variant="outline">
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