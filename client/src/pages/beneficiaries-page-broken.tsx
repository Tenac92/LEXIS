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
  registryNumber: z.string().optional(),
  monada: z.string().optional(),
  adeia: z.string().optional(),
  online_folder_number: z.string().optional(),
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch beneficiaries
  const { data: beneficiaries = [], isLoading, error } = useQuery({
    queryKey: ["/api/beneficiaries"],
    queryFn: () => apiRequest<Beneficiary[]>("/api/beneficiaries"),
  });

  // Create/Update beneficiary mutation
  const mutation = useMutation({
    mutationFn: async (data: BeneficiaryFormData) => {
      const url = selectedBeneficiary 
        ? `/api/beneficiaries/${selectedBeneficiary.id}`
        : "/api/beneficiaries";
      const method = selectedBeneficiary ? "PUT" : "POST";
      
      return apiRequest(url, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      setDialogOpen(false);
      setSelectedBeneficiary(undefined);
      toast({
        title: "Επιτυχία!",
        description: selectedBeneficiary 
          ? "Ο δικαιούχος ενημερώθηκε επιτυχώς" 
          : "Ο δικαιούχος δημιουργήθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Παρουσιάστηκε σφάλμα",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/beneficiaries/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      toast({
        title: "Επιτυχία!",
        description: "Ο δικαιούχος διαγράφηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Παρουσιάστηκε σφάλμα κατά τη διαγραφή",
        variant: "destructive",
      });
    },
  });

  // Filter beneficiaries based on search term
  const filteredBeneficiaries = beneficiaries.filter((beneficiary) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      beneficiary.surname?.toLowerCase().includes(searchLower) ||
      beneficiary.name?.toLowerCase().includes(searchLower) ||
      beneficiary.fathername?.toLowerCase().includes(searchLower) ||
      beneficiary.afm?.toString().includes(searchTerm)
    );
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Νέος Δικαιούχος
              </Button>
            </DialogTrigger>
            <BeneficiaryDialog
              beneficiary={selectedBeneficiary}
              onOpenChange={setDialogOpen}
              mutation={mutation}
            />
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredBeneficiaries.map((beneficiary) => {
          return (
            <div key={beneficiary.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
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
                      onClick={() => handleShowDetails(beneficiary)}
                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="Περισσότερα στοιχεία"
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
                      {beneficiary.region && (
                        <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                          <span className="text-xs text-gray-600">Περιφέρεια</span>
                          <span className="text-gray-900 font-medium">{beneficiary.region}</span>
                        </div>
                      )}
                      {beneficiary.project && (
                        <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                          <span className="text-xs text-gray-600">Έργο (MIS)</span>
                          <span className="text-gray-900 font-mono">{beneficiary.project}</span>
                        </div>
                      )}
                      {beneficiary.monada && (
                        <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                          <span className="text-xs text-gray-600">Μονάδα</span>
                          <span className="text-gray-900">{beneficiary.monada}</span>
                        </div>
                      )}
                      {beneficiary.adeia && (
                        <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                          <span className="text-xs text-gray-600">Άδεια</span>
                          <span className="text-gray-900">{beneficiary.adeia}</span>
                        </div>
                      )}
                    </div>
                    
                    
                    {/* Financial Status Summary */}
                    {beneficiary.oikonomika && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Οικονομικά Στοιχεία</h4>
                        <div className="text-xs text-blue-700">
                          Διαθέσιμα στοιχεία για προβολή στα λεπτομερή
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleShowDetails(beneficiary)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Info className="w-4 h-4 mr-2" />
                        Λεπτομέρειες
                      </Button>
                    </div>
                </div>
            </div>
          );
        })}
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
      online_folder_number: beneficiary?.onlinefoldernumber || "",
                            <span className="text-purple-900">{beneficiary.cengsur1} {beneficiary.cengname1}</span>
                          </div>
                        )}
                        {beneficiary.cengsur2 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-purple-700 font-medium">Μηχανικός 2:</span>
                            <span className="text-purple-900">{beneficiary.cengsur2} {beneficiary.cengname2}</span>
                          </div>
                        )}
                        {beneficiary.freetext && (
                          <div className="pt-2 border-t border-purple-200">
                            <span className="text-purple-700 font-medium text-sm">Σχόλια:</span>
                            <p className="text-purple-900 text-sm mt-1">{beneficiary.freetext}</p>
                          </div>
                        )}
                      </div>

                      {/* Financial Data */}
                      {beneficiary.oikonomika && typeof beneficiary.oikonomika === 'object' && Object.keys(beneficiary.oikonomika).length > 0 && (
                        <div className="pt-4 border-t border-purple-200">
                          <h4 className="font-semibold text-purple-800 text-sm mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            Οικονομικά Στοιχεία
                          </h4>
                          <div className="space-y-2">
                            {(() => {
                              try {
                                const oikonomika = beneficiary.oikonomika as Record<string, any>;
                                
                                const getStatusColors = (status: string | null) => {
                                  if (!status || status === null) {
                                    return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
                                  }
                                  if (status === 'διαβιβάστηκε') {
                                    return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
                                  }
                                  if (status === 'πληρώθηκε') {
                                    return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
                                  }
                                  return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
                                };

                                return Object.entries(oikonomika).map(([type, data]) => (
                                  <div key={type} className="bg-white p-2 rounded border border-purple-200">
                                    <div className="font-medium text-purple-800 text-xs mb-1">{type}</div>
                                    {data && typeof data === 'object' && Object.entries(data as Record<string, any>).map(([installment, details]) => {
                                      const colors = getStatusColors((details as any)?.status);
                                      return (
                                        <div key={installment} className="flex justify-between items-center text-xs">
                                          <span className="text-purple-700">{installment}</span>
                                          <div className="flex items-center gap-1">
                                            <span className={`${colors.bg} ${colors.text} px-1 py-0.5 rounded text-xs`}>
                                              {(details as any)?.amount ? `€${(details as any).amount}` : '-'}
                                            </span>
                                            {(details as any)?.status && (
                                              <span className={`px-1 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                                                {(details as any).status}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ));
                              } catch (e) {
                                return <div className="text-xs text-purple-600 bg-purple-100 p-2 rounded">Σφάλμα ανάγνωσης οικονομικών στοιχείων</div>;
                              }
                            })()}
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
        <div className="text-center py-8">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Δεν βρέθηκαν δικαιούχοι</h3>
          <p className="mt-1 text-sm text-gray-500">
            Ξεκινήστε δημιουργώντας έναν νέο δικαιούχο.
          </p>
        </div>
      )}
    </div>
  );
}

function BeneficiaryDialog({
  beneficiary,
  onOpenChange,
  mutation,
}: {
  beneficiary?: Beneficiary;
  onOpenChange: (open: boolean) => void;
  mutation: any;
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
      registryNumber: beneficiary?.registryNumber || "",
      monada: beneficiary?.monada || "",
      adeia: beneficiary?.adeia || "",
      online_folder_number: beneficiary?.online_folder_number || "",
      cengsur1: beneficiary?.cengsur1 || "",
      cengname1: beneficiary?.cengname1 || "",
      cengsur2: beneficiary?.cengsur2 || "",
      cengname2: beneficiary?.cengname2 || "",
      freetext: beneficiary?.freetext || "",
    },
  });

  const onSubmit = (data: BeneficiaryFormData) => {
    mutation.mutate(data);
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {beneficiary ? "Επεξεργασία Δικαιούχου" : "Νέος Δικαιούχος"}
        </DialogTitle>
        <DialogDescription>
          {beneficiary
            ? "Επεξεργαστείτε τα στοιχεία του δικαιούχου"
            : "Συμπληρώστε τα στοιχεία για τον νέο δικαιούχο"}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              Προσωπικά Στοιχεία *
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="surname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Επώνυμο *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. Παπαδόπουλος" className="bg-white" />
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
                    <FormLabel className="text-sm font-medium text-gray-700">Όνομα *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. Γιάννης" className="bg-white" />
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
                    <FormLabel className="text-sm font-medium text-gray-700">Όνομα Πατρός *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. Δημήτριος" className="bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Administrative Information Section */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Διοικητικά Στοιχεία
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="afm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">ΑΦΜ *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. 123456789" className="bg-white font-mono" />
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
                    <FormLabel className="text-sm font-medium text-gray-700">Κωδικός Έργου (MIS)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. 5188985" className="bg-white font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registryNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Αριθμός Μητρώου</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. 12345" className="bg-white" />
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
                    <FormLabel className="text-sm font-medium text-gray-700">Περιφέρεια</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. ΤΡΙΚΑΛΑ" className="bg-white" />
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
                    <FormLabel className="text-sm font-medium text-gray-700">Άδεια</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. 1040" className="bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Organization Information Section */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-green-600" />
              Στοιχεία Οργανισμού
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Μονάδα</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. ΔΑΕΦΚ-ΚΕ" className="bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="online_folder_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Αρ. Online Φακέλου</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. OF-2024-001" className="bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Engineers Information Section */}
          <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-yellow-600" />
              Στοιχεία Μηχανικών
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-yellow-300">
                  <h4 className="font-medium text-gray-800 mb-3">Πρώτος Μηχανικός</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="cengsur1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Επώνυμο</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="π.χ. Γεωργίου" className="bg-gray-50" />
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
                          <FormLabel className="text-sm font-medium text-gray-700">Όνομα</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="π.χ. Κωνσταντίνος" className="bg-gray-50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-white rounded-lg border border-yellow-300">
                  <h4 className="font-medium text-gray-800 mb-3">Δεύτερος Μηχανικός</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="cengsur2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Επώνυμο</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="π.χ. Δημητρίου" className="bg-gray-50" />
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
                          <FormLabel className="text-sm font-medium text-gray-700">Όνομα</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="π.χ. Μαρία" className="bg-gray-50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600">Τα στοιχεία των μηχανικών είναι προαιρετικά</p>
            </div>
          </div>

          {/* Additional Comments Section */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Επιπλέον Πληροφορίες
            </h3>
            <FormField
              control={form.control}
              name="freetext"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Σχόλια και Παρατηρήσεις</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="w-full p-3 border border-gray-300 rounded-md resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder="Προσθέστε οποιαδήποτε επιπλέον πληροφορία, παρατηρήσεις ή ειδικές οδηγίες..."
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500 mt-1">Αυτό το πεδίο είναι προαιρετικό</p>
                </FormItem>
              )}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Τα πεδία με * είναι υποχρεωτικά
            </p>
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="px-6"
              >
                Ακύρωση
              </Button>
              <Button 
                type="submit" 
                className="px-6 bg-blue-600 hover:bg-blue-700"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Αποθήκευση..." : (beneficiary ? "Ενημέρωση" : "Δημιουργία")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}