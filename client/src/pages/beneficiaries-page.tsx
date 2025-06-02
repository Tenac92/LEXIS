import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Info, Users, LayoutGrid, List, User, FileText, Building } from "lucide-react";
import { Header } from "@/components/header";
import { BeneficiaryDetailsModal } from "@/components/beneficiaries/BeneficiaryDetailsModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Beneficiary } from "@/shared/schema";

const beneficiaryFormSchema = z.object({
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  fathername: z.string().min(1, "Το πατρώνυμο είναι υποχρεωτικό"),
  afm: z.string().min(9, "Το ΑΦΜ πρέπει να είναι 9 ψηφία").max(9, "Το ΑΦΜ πρέπει να είναι 9 ψηφία"),
  project: z.string().optional(),
  region: z.string().optional(),
  monada: z.string().optional(),
  adeia: z.string().optional(),
  cengsur1: z.string().optional(),
  cengname1: z.string().optional(),
  cengsur2: z.string().optional(),
  cengname2: z.string().optional(),
  freetext: z.string().optional(),
});

type BeneficiaryFormData = z.infer<typeof beneficiaryFormSchema>;

export default function BeneficiariesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsBeneficiary, setDetailsBeneficiary] = useState<Beneficiary | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch beneficiaries
  const { data: beneficiaries = [], isLoading, error } = useQuery({
    queryKey: ["/api/beneficiaries"],
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
    if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε τον δικαιούχο ${beneficiary.name} ${beneficiary.surname};`)) {
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
    setFlippedCards(prev => {
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
    [beneficiary.name, beneficiary.surname, beneficiary.afm?.toString(), beneficiary.region]
      .some((field) => field?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBeneficiaries = filteredBeneficiaries.slice(startIndex, endIndex);

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
              <div className="text-center text-red-500">Σφάλμα φόρτωσης δεδομένων</div>
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
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-none"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                <Button onClick={handleNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Νέος Δικαιούχος
                </Button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Αναζήτηση</label>
                <Input
                  placeholder="Αναζήτηση κατά όνομα, επώνυμο, ΑΦΜ, περιοχή..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Results */}
            {isLoading ? (
              <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {[...Array(6)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="h-48 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredBeneficiaries.length > 0 ? (
              <>
                <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
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
                      if (!(e.target as HTMLElement).closest('button')) {
                        toggleCardFlip(beneficiary.id);
                      }
                    };

                    return (
                      <div key={beneficiary.id} className="flip-card" onClick={handleCardClick}>
                        <div className={`flip-card-inner ${isFlipped ? 'rotate-y-180' : ''}`}>
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
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleShowDetails(beneficiary)}
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
                                    <span className="text-xs text-gray-600">Έργο (MIS)</span>
                                    <span className="text-gray-900 font-mono">{beneficiary.project}</span>
                                  </div>
                                )}
                                {beneficiary.region && (
                                  <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                                    <span className="text-xs text-gray-600">Περιοχή</span>
                                    <span className="text-gray-900">{beneficiary.region}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Financial Status Summary */}
                              {(beneficiary as any).oikonomika && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <h4 className="text-sm font-medium text-blue-800 mb-2">Οικονομικά Στοιχεία</h4>
                                  <div className="space-y-1">
                                    {typeof (beneficiary as any).oikonomika === 'object' && 
                                     Object.entries((beneficiary as any).oikonomika).map(([paymentType, data]: [string, any]) => (
                                      <div key={paymentType} className="text-xs">
                                        <span className="font-medium text-blue-800">{paymentType}:</span>
                                        {typeof data === 'object' && data !== null && (
                                          <div className="ml-2 space-y-0.5">
                                            {Object.entries(data).map(([installment, info]: [string, any]) => (
                                              <div key={installment} className="flex justify-between">
                                                <span className="text-blue-700">{installment}:</span>
                                                <span className="text-blue-900">
                                                  {typeof info === 'object' && info !== null ? 
                                                    `€${info.amount || 0} - ${info.status || 'Εκκρεμεί'}` :
                                                    String(info)
                                                  }
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
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
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-600"></div>
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
                                    <span className="text-blue-700 font-medium text-sm">Άδεια:</span>
                                    <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                      {beneficiary.adeia}
                                    </p>
                                  </div>
                                )}
                                {beneficiary.cengsur1 && (
                                  <div className="space-y-1">
                                    <span className="text-blue-700 font-medium text-sm">Κέντρο Επιτώπου 1:</span>
                                    <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                      {beneficiary.cengsur1} {beneficiary.cengname1}
                                    </p>
                                  </div>
                                )}
                                {beneficiary.cengsur2 && (
                                  <div className="space-y-1">
                                    <span className="text-blue-700 font-medium text-sm">Κέντρο Επιτώπου 2:</span>
                                    <p className="text-blue-900 text-sm bg-blue-100 p-2 rounded border">
                                      {beneficiary.cengsur2} {beneficiary.cengname2}
                                    </p>
                                  </div>
                                )}
                                {beneficiary.freetext && (
                                  <div className="space-y-1">
                                    <span className="text-blue-700 font-medium text-sm">Ελεύθερο Κείμενο:</span>
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
                      Εμφάνιση {startIndex + 1}-{Math.min(endIndex, filteredBeneficiaries.length)} από {filteredBeneficiaries.length} δικαιούχους
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
                  {searchTerm && <p className="text-sm">Δοκιμάστε διαφορετικούς όρους αναζήτησης</p>}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedBeneficiary ? "Επεξεργασία Δικαιούχου" : "Νέος Δικαιούχος"}
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
  onSubmit 
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
      afm: beneficiary?.afm || "",
      project: beneficiary?.project || "",
      region: beneficiary?.region || "",
      monada: beneficiary?.monada || "",
      adeia: beneficiary?.adeia || "",
      cengsur1: beneficiary?.cengsur1 || "",
      cengname1: beneficiary?.cengname1 || "",
      cengsur2: beneficiary?.cengsur2 || "",
      cengname2: beneficiary?.cengname2 || "",
      freetext: beneficiary?.freetext || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="surname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Επώνυμο *</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} />
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
                <FormLabel>Πατρώνυμο *</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>ΑΦΜ *</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={9} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="project"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Έργο</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} />
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
                <FormLabel>Μονάδα</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="adeia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Άδεια</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="freetext"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ελεύθερο Κείμενο</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-2">
          <Button type="submit">
            {beneficiary ? "Ενημέρωση" : "Δημιουργία"}
          </Button>
        </div>
      </form>
    </Form>
  );
}