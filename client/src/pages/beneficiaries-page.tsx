import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Download, Upload, User, FileText, Building, UserCheck, RotateCcw, Info } from "lucide-react";
import { BeneficiaryDetailsModal } from "@/components/beneficiaries/BeneficiaryDetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import type { Beneficiary } from "@/../../shared/schema";

const beneficiaryFormSchema = z.object({
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  fathername: z.string().min(1, "Το όνομα πατρός είναι υποχρεωτικό"),
  afm: z.string().min(9, "Το ΑΦΜ πρέπει να έχει τουλάχιστον 9 ψηφία"),
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch beneficiaries
  const { data: beneficiaries = [], isLoading, error } = useQuery({
    queryKey: ["/api/beneficiaries"],
    queryFn: () => apiRequest<Beneficiary[]>("/api/beneficiaries"),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: BeneficiaryFormData) => 
      apiRequest("/api/beneficiaries", {
        method: "POST",
        body: data,
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
        body: data,
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Φόρτωση...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">Σφάλμα φόρτωσης δεδομένων</div>
      </div>
    );
  }

  const filteredBeneficiaries = beneficiaries.filter((beneficiary) =>
    [beneficiary.name, beneficiary.surname, beneficiary.afm?.toString(), beneficiary.region]
      .some((field) => field?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Διαχείριση Δικαιούχων</h1>
          <p className="text-gray-600 mt-2">Προβολή και διαχείριση όλων των δικαιούχων</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Αναζήτηση δικαιούχων..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" />
            Νέος Δικαιούχος
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredBeneficiaries.map((beneficiary) => {
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
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardFlip(beneficiary.id);
                          }}
                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Περισσότερα στοιχεία"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(beneficiary);
                          }}
                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Επεξεργασία"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(beneficiary);
                          }}
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
                </div>
                    
                    {/* Financial Status Summary */}
                    {beneficiary.oikonomika && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Οικονομικά Στοιχεία</h4>
                        <div className="space-y-1">
                          {typeof beneficiary.oikonomika === 'object' && 
                           Object.entries(beneficiary.oikonomika).map(([paymentType, data]: [string, any]) => (
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
                    
                    <div className="flex items-center justify-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCardFlip(beneficiary.id);
                        }}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Info className="w-4 h-4 mr-2" />
                        Περισσότερα στοιχεία
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Back of card */}
                <div className="flip-card-back bg-blue-50">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
                  <div className="p-6 h-full overflow-y-auto">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-blue-900">
                          Λεπτομέρειες Δικαιούχου
                        </h3>
                        <p className="text-blue-700 text-sm">
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
                        className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                        title="Επιστροφή"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {beneficiary.region && (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700 font-medium">Περιφέρεια:</span>
                            <span className="text-blue-900">{beneficiary.region}</span>
                          </div>
                        )}
                        {beneficiary.monada && (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700 font-medium">Μονάδα:</span>
                            <span className="text-blue-900">{beneficiary.monada}</span>
                          </div>
                        )}
                        {beneficiary.adeia && (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700 font-medium">Άδεια:</span>
                            <span className="text-blue-900">{beneficiary.adeia}</span>
                          </div>
                        )}
                        {beneficiary.onlinefoldernumber && (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700 font-medium">Αρ. Online Φακέλου:</span>
                            <span className="text-blue-900">{beneficiary.onlinefoldernumber}</span>
                          </div>
                        )}
                        {beneficiary.cengsur1 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700 font-medium">Μηχανικός 1:</span>
                            <span className="text-blue-900">{beneficiary.cengsur1} {beneficiary.cengname1}</span>
                          </div>
                        )}
                        {beneficiary.cengsur2 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700 font-medium">Μηχανικός 2:</span>
                            <span className="text-blue-900">{beneficiary.cengsur2} {beneficiary.cengname2}</span>
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
                      
                      {beneficiary.oikonomika && (
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <h4 className="text-blue-900 font-semibold mb-3">Οικονομικά Στοιχεία</h4>
                          <div className="space-y-2">
                            {typeof beneficiary.oikonomika === 'object' && 
                             Object.entries(beneficiary.oikonomika).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-blue-700 font-medium">{key}:</span>
                                <span className="text-blue-900">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
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

      {filteredBeneficiaries.length === 0 && (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Δεν βρέθηκαν δικαιούχοι</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης' : 'Ξεκινήστε προσθέτοντας έναν νέο δικαιούχο'}
          </p>
        </div>
      )}

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
            <DialogDescription>
              {selectedBeneficiary 
                ? "Επεξεργαστείτε τα στοιχεία του δικαιούχου" 
                : "Συμπληρώστε τα στοιχεία του νέου δικαιούχου"}
            </DialogDescription>
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
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BeneficiaryForm({ 
  beneficiary, 
  onSubmit, 
  onCancel 
}: {
  beneficiary?: Beneficiary;
  onSubmit: (data: BeneficiaryFormData) => void;
  onCancel: () => void;
}) {
  const form = useForm<BeneficiaryFormData>({
    resolver: zodResolver(beneficiaryFormSchema),
    defaultValues: {
      surname: beneficiary?.surname?.toString() || "",
      name: beneficiary?.name?.toString() || "",
      fathername: beneficiary?.fathername?.toString() || "",
      afm: beneficiary?.afm?.toString() || "",
      project: beneficiary?.project?.toString() || "",
      region: beneficiary?.region || "",
      monada: beneficiary?.monada || "",
      adeia: beneficiary?.adeia?.toString() || "",
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
                <FormLabel>Επώνυμο</FormLabel>
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
                <FormLabel>Όνομα</FormLabel>
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
                <FormLabel>Πατρώνυμο</FormLabel>
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
                <FormLabel>ΑΦΜ</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
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