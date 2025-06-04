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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import type { Beneficiary } from "../../../shared/schema";

// Define an interface for units
interface Unit {
  id: string;
  name: string;
}

const beneficiaryFormSchema = z.object({
  // Basic Information
  surname: z.string().min(2, "Το επώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες").max(50, "Το επώνυμο δεν μπορεί να υπερβαίνει τους 50 χαρακτήρες"),
  name: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες").max(50, "Το όνομα δεν μπορεί να υπερβαίνει τους 50 χαρακτήρες"),
  fathername: z.string().min(2, "Το πατρώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες").max(50, "Το πατρώνυμο δεν μπορεί να υπερβαίνει τους 50 χαρακτήρες"),
  afm: z
    .string()
    .regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να είναι ακριβώς 9 ψηφία")
    .refine((val) => {
      // Basic AFM validation algorithm
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
  
  // Financial Information
  paymentType: z.string().optional(),
  amount: z.string().optional(),
  installment: z.string().optional(),
  
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: BeneficiaryFormData) =>
      apiRequest("/api/beneficiaries", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      setDialogOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      setDialogOpen(false);
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
      apiRequest(`/api/beneficiaries/${id}`, {
        method: "DELETE",
      }),
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

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleEdit = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setDialogOpen(true);
  };

  const handleDelete = (beneficiary: Beneficiary) => {
    if (
      confirm(
        `Είστε σίγουροι ότι θέλετε να διαγράψετε τον δικαιούχο ${beneficiary.name} ${beneficiary.surname};`,
      )
    ) {
      deleteMutation.mutate(beneficiary.id);
    }
  };

  const handleNew = () => {
    setSelectedBeneficiary(undefined);
    setDialogOpen(true);
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

  // Compute values after all hooks
  const filteredBeneficiaries = beneficiaries.filter((beneficiary) =>
    [
      beneficiary.name,
      beneficiary.surname,
      beneficiary.afm?.toString(),
      beneficiary.region,
    ].some((field) => field?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBeneficiaries = filteredBeneficiaries.slice(
    startIndex,
    endIndex,
  );

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-6 pb-8">
          <Card className="bg-card">
            <div className="p-4">
              <div className="text-center">Φόρτωση...</div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-6 pb-8">
          <Card className="bg-card">
            <div className="p-4">
              <div className="text-center text-red-500">
                Σφάλμα φόρτωσης δεδομένων
              </div>
            </div>
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
                      <List className="mr-2 h-4 w-4" /> Λίστα
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="mr-2 h-4 w-4" /> Κάρτες
                    </>
                  )}
                </Button>
                <Button onClick={handleNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Νέος Δικαιούχος
                </Button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Αναζήτηση
                </label>
                <Input
                  placeholder="Αναζήτηση κατά όνομα, επώνυμο, ΑΦΜ, περιοχή..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Results */}
            {isLoading ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                    : "space-y-4"
                }
              >
                {[...Array(6)].map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="h-48 rounded-lg bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : filteredBeneficiaries.length > 0 ? (
              <>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
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
                                    {beneficiary.project && (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <FileText className="w-4 h-4" />
                                        <span>{beneficiary.project}</span>
                                      </div>
                                    )}
                                    {beneficiary.monada && (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Building className="w-4 h-4" />
                                        <span>{beneficiary.monada}</span>
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

                    // Grid view (flip cards matching other pages)
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
                                    <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-base font-mono font-semibold bg-blue-100 text-blue-900 border border-blue-200 select-all cursor-copy">
                                      ΑΦΜ: {beneficiary.afm}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className="flex gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleShowDetails(beneficiary)
                                    }
                                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    title="Λεπτομέρειες"
                                  >
                                    <Info className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(beneficiary)}
                                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    title="Επεξεργασία"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(beneficiary)}
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    title="Διαγραφή"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                                {beneficiary.project && (
                                  <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                                    <span className="text-xs text-gray-600">
                                      Έργο (MIS)
                                    </span>
                                    <span className="text-gray-900 font-mono">
                                      {beneficiary.project}
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
                              </div>

                              {/* Financial Status Summary */}
                              {(beneficiary as any).oikonomika && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <h4 className="text-sm font-medium text-blue-800 mb-2">
                                    Οικονομικά Στοιχεία
                                  </h4>
                                  <div className="space-y-1">
                                    {typeof (beneficiary as any).oikonomika ===
                                      "object" &&
                                      Object.entries(
                                        (beneficiary as any).oikonomika,
                                      ).map(
                                        ([paymentType, data]: [
                                          string,
                                          any,
                                        ]) => (
                                          <div
                                            key={paymentType}
                                            className="text-xs"
                                          >
                                            <span className="font-medium text-blue-800">
                                              {paymentType}:
                                            </span>
                                            {typeof data === "object" &&
                                              data !== null && (
                                                <div className="ml-2 space-y-0.5">
                                                  {Object.entries(data).map(
                                                    ([installment, info]: [
                                                      string,
                                                      any,
                                                    ]) => (
                                                      <div
                                                        key={installment}
                                                        className="flex justify-between"
                                                      >
                                                        <span className="text-blue-700">
                                                          {installment}:
                                                        </span>
                                                        <span className="text-blue-900">
                                                          {typeof info ===
                                                            "object" &&
                                                          info !== null
                                                            ? `${new Intl.NumberFormat("el-GR", {
                                                                style: "currency",
                                                                currency: "EUR",
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                              }).format(info.amount || 0)} - ${info.status || "Εκκρεμεί"}`
                                                            : String(info)}
                                                        </span>
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                          </div>
                                        ),
                                      )}
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
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <Info className="w-4 h-4 mr-2" />
                                  Περισσότερα στοιχεία
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Back of card */}
                          <div className="flip-card-back">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
                            <div className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="space-y-2 flex-1">
                                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                                    {beneficiary.surname} {beneficiary.name}
                                  </h3>
                                  <div className="text-sm text-gray-600">
                                    Επιπλέον Στοιχεία
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
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

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Εμφάνιση {startIndex + 1}-
                      {Math.min(endIndex, filteredBeneficiaries.length)} από{" "}
                      {filteredBeneficiaries.length} δικαιούχους
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Προηγούμενη
                      </Button>
                      <span className="text-sm">
                        Σελίδα {currentPage} από {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                      >
                        Επόμενη
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
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
      project: beneficiary?.project?.toString() || "",
      expenditure_type: "", // Not in current schema, will be handled separately
      region: beneficiary?.region || "",
      monada: beneficiary?.monada || "",
      adeia: beneficiary?.adeia?.toString() || "",
      onlinefoldernumber: beneficiary?.onlinefoldernumber || "",
      cengsur1: beneficiary?.cengsur1 || "",
      cengname1: beneficiary?.cengname1 || "",
      cengsur2: beneficiary?.cengsur2 || "",
      cengname2: beneficiary?.cengname2 || "",
      paymentType: "", // Will be populated from expenditure_type selection
      amount: "",
      installment: "",
      freetext: beneficiary?.freetext || "",
      date: beneficiary?.date || new Date().toISOString().split('T')[0],
    },
  });

  const [activeTab, setActiveTab] = useState("basic");

  // Fetch units for dropdown
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/public/units"],
  });

  // Fetch projects for dropdown 
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  // Define expenditure types as per user requirements
  const expenditureTypes = [
    "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ",
    "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ", 
    "ΔΚΑ ΕΠΙΣΚΕΥΗ",
    "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ"
  ];

  // Define installment types
  const installmentTypes = [
    "ΕΦΑΠΑΞ",
    "Α", 
    "Β",
    "Γ",
    "Δ"
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Βασικά Στοιχεία
            </TabsTrigger>
            <TabsTrigger value="project" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Έργο & Τοποθεσία
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Οικονομικά Στοιχεία
            </TabsTrigger>
            <TabsTrigger value="engineers" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Μηχανικοί
            </TabsTrigger>
            <TabsTrigger value="additional" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Επιπλέον Στοιχεία
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Προσωπικά Στοιχεία</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="surname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <span>Επώνυμο</span>
                      <Badge variant="destructive" className="text-xs">Υποχρεωτικό</Badge>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Εισάγετε το επώνυμο"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
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
                    <FormLabel className="flex items-center gap-2">
                      <span>Όνομα</span>
                      <Badge variant="destructive" className="text-xs">Υποχρεωτικό</Badge>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Εισάγετε το όνομα"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
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
                    <FormLabel className="flex items-center gap-2">
                      <span>Πατρώνυμο</span>
                      <Badge variant="destructive" className="text-xs">Υποχρεωτικό</Badge>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Εισάγετε το πατρώνυμο"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="afm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <span>Α.Φ.Μ.</span>
                      <Badge variant="destructive" className="text-xs">Υποχρεωτικό</Badge>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          {...field} 
                          maxLength={9}
                          placeholder="123456789"
                          className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 font-mono"
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                          }}
                        />
                        {field.value && field.value.length === 9 && (
                          <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Εισάγετε 9 ψηφία χωρίς κενά ή παύλες
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Ημερομηνία Καταχώρησης
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="date"
                      className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="project" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Στοιχεία Έργου & Τοποθεσίας</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Κωδικός NA853 Έργου
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Επιλέξτε κωδικό NA853" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {projects
                          .filter((project: any) => project.budget_na853)
                          .map((project: any) => (
                          <SelectItem key={project.mis || project.id} value={project.mis?.toString() || project.id?.toString()}>
                            <div className="flex flex-col">
                              <span className="font-mono text-sm font-semibold">
                                {project.budget_na853}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                {project.title?.length > 50 ? `${project.title.substring(0, 50)}...` : project.title}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Επιλέξτε έργο με βάση τον κωδικό NA853
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expenditure_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Τύπος Δαπάνης
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Επιλέξτε τύπο δαπάνης" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenditureTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Κατηγορία δαπάνης για τον δικαιούχο
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
                      <Building className="w-4 h-4" />
                      Περιοχή
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="π.χ. Αθήνα, Θεσσαλονίκη"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Μονάδα
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Επιλέξτε μονάδα" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
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
                name="adeia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Αριθμός Άδειας
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="π.χ. 12345"
                        className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="onlinefoldernumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Αριθμός Ηλεκτρονικού Φακέλου
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Εισάγετε τον αριθμό ηλεκτρονικού φακέλου"
                      className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Οικονομικά Στοιχεία</h3>
            </div>

            <Card className="p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Στοιχεία Πληρωμής
                </CardTitle>
                <CardDescription>
                  Εισάγετε τα οικονομικά στοιχεία για τον επιλεγμένο τύπο δαπάνης
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Τύπος Πληρωμής
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Auto-populate from expenditure_type if selected
                            const selectedExpenditureType = form.getValues("expenditure_type");
                            if (selectedExpenditureType && !value) {
                              field.onChange(selectedExpenditureType);
                            }
                          }} 
                          value={field.value || form.getValues("expenditure_type")}
                        >
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                              <SelectValue placeholder="Επιλέξτε τύπο πληρωμής" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {expenditureTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Αυτόματα συμπληρώνεται από τον τύπο δαπάνης
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="installment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Δόση
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-blue-500">
                              <SelectValue placeholder="Επιλέξτε δόση" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {installmentTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type === "ΕΦΑΠΑΞ" ? "Εφάπαξ" : `Δόση ${type}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Επιλέξτε τη δόση πληρωμής
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Ποσό (€)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            placeholder="π.χ. 10.286,06"
                            className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 font-mono text-right pr-8"
                            onChange={(e) => {
                              // Allow European number format (dots for thousands, comma for decimal)
                              const value = e.target.value;
                              if (/^[\d.,]*$/.test(value)) {
                                field.onChange(value);
                              }
                            }}
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                            €
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Εισάγετε το ποσό σε ευρώ (χρησιμοποιήστε κόμμα για δεκαδικά)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Πληροφορίες Οικονομικών Στοιχείων</h4>
                      <p className="text-sm text-blue-700 mb-2">
                        Τα οικονομικά στοιχεία αποθηκεύονται με τη μορφή JSON στη βάση δεδομένων:
                      </p>
                      <code className="text-xs bg-blue-100 p-2 rounded block">
                        {`{"[Τύπος Δαπάνης]":{"[Δόση]":{"amount":[Ποσό],"status":null,"protocol":null,"date":null}}}`}
                      </code>
                      <p className="text-sm text-blue-700 mt-2">
                        Παράδειγμα: ΔΚΑ ΕΠΙΣΚΕΥΗ με Εφάπαξ πληρωμή 10.286,06€
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engineers" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Στοιχεία Μηχανικών</h3>
            </div>

            <Card className="p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Πρώτος Μηχανικός
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cengsur1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Επώνυμο Μηχανικού</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Επώνυμο"
                            className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                          />
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
                        <FormLabel>Όνομα Μηχανικού</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Όνομα"
                            className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Δεύτερος Μηχανικός
                </CardTitle>
                <CardDescription>
                  Προαιρετικά στοιχεία δεύτερου μηχανικού
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cengsur2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Επώνυμο Μηχανικού</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Επώνυμο (προαιρετικό)"
                            className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                          />
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
                        <FormLabel>Όνομα Μηχανικού</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Όνομα (προαιρετικό)"
                            className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="additional" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Επιπλέον Πληροφορίες</h3>
            </div>

            <FormField
              control={form.control}
              name="freetext"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Ελεύθερο Κείμενο / Σχόλια
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Εισάγετε επιπλέον πληροφορίες, σχόλια ή παρατηρήσεις..."
                      className="min-h-[120px] transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                      rows={6}
                    />
                  </FormControl>
                  <FormDescription>
                    Μέγιστος αριθμός χαρακτήρων: 500
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Πληροφορίες</h4>
                  <p className="text-sm text-blue-700">
                    Τα στοιχεία που εισάγετε θα χρησιμοποιηθούν για τη δημιουργία εγγράφων και την παρακολούθηση των δικαιούχων. 
                    Βεβαιωθείτε ότι όλα τα υποχρεωτικά πεδία έχουν συμπληρωθεί σωστά.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">
            * Υποχρεωτικά πεδία
          </div>
          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => form.reset()}
            >
              Επαναφορά
            </Button>
            <Button 
              type="submit"
              className="flex items-center gap-2"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Επεξεργασία...
                </>
              ) : (
                <>
                  {beneficiary ? (
                    <>
                      <Edit className="w-4 h-4" />
                      Ενημέρωση Δικαιούχου
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Δημιουργία Δικαιούχου
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
