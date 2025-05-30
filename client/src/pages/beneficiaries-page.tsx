import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Download, Upload, User, FileText, Building, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Beneficiary, InsertBeneficiary } from "@shared/schema";
import { Header } from "@/components/header";

// Form validation schema
const beneficiaryFormSchema = z.object({
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  fathername: z.string().min(1, "Το πατρώνυμο είναι υποχρεωτικό"),
  afm: z.number().min(100000000, "Το ΑΦΜ πρέπει να έχει 9 ψηφία").max(999999999, "Το ΑΦΜ πρέπει να έχει 9 ψηφία"),
  project: z.number().min(1, "Επιλέξτε έργο"),
  aa: z.number().optional(),
  region: z.string().optional(),
  adeia: z.number().optional(),
  date: z.string().optional(),
  monada: z.string().optional(),
  onlinefoldernumber: z.string().optional(),
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
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      setDialogOpen(false);
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Header />
        <div className="text-center">Φόρτωση...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Header />
        <div className="text-center text-red-500">Σφάλμα φόρτωσης δεδομένων</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Header />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Διαχείριση Δικαιούχων
          </CardTitle>
          <CardDescription>
            Διαχειριστείτε τους δικαιούχους των έργων
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <Input
                placeholder="Αναζήτηση δικαιούχων..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleNew}>
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBeneficiaries.map((beneficiary) => (
              <Card key={beneficiary.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-blue-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
                <CardHeader className="pb-4 pl-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl font-bold text-gray-900 leading-tight">
                        {beneficiary.surname} {beneficiary.name}
                        {beneficiary.fathername && (
                          <span className="text-sm font-normal text-gray-600 italic ml-2">
                            του {beneficiary.fathername}
                          </span>
                        )}
                      </CardTitle>
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
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="Διαγραφή"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pl-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
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
                  
                  {beneficiary.oikonomika && typeof beneficiary.oikonomika === 'object' && Object.keys(beneficiary.oikonomika).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-semibold text-gray-800 text-sm">Οικονομικά Στοιχεία</span>
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          try {
                            const oikonomika = beneficiary.oikonomika as Record<string, any>;
                            
                            // Helper function to get status-based colors
                            const getStatusColors = (status: string | null) => {
                              if (!status || status === null) {
                                return {
                                  bg: 'bg-yellow-50',
                                  border: 'border-yellow-200',
                                  typeColor: 'text-yellow-800',
                                  installmentColor: 'text-yellow-700',
                                  amountBg: 'bg-yellow-100',
                                  amountColor: 'text-yellow-900'
                                };
                              }
                              if (status === 'διαβιβάστηκε') {
                                return {
                                  bg: 'bg-blue-50',
                                  border: 'border-blue-200',
                                  typeColor: 'text-blue-800',
                                  installmentColor: 'text-blue-700',
                                  amountBg: 'bg-blue-100',
                                  amountColor: 'text-blue-900'
                                };
                              }
                              if (status === 'πληρώθηκε') {
                                return {
                                  bg: 'bg-green-50',
                                  border: 'border-green-200',
                                  typeColor: 'text-green-800',
                                  installmentColor: 'text-green-700',
                                  amountBg: 'bg-green-100',
                                  amountColor: 'text-green-900'
                                };
                              }
                              // Default for unknown status
                              return {
                                bg: 'bg-gray-50',
                                border: 'border-gray-200',
                                typeColor: 'text-gray-800',
                                installmentColor: 'text-gray-700',
                                amountBg: 'bg-gray-100',
                                amountColor: 'text-gray-900'
                              };
                            };

                            return Object.entries(oikonomika).map(([type, data]) => {
                              // Get the dominant status for this type
                              let dominantStatus = null;
                              if (data && typeof data === 'object') {
                                const statuses = Object.values(data as Record<string, any>).map(d => (d as any)?.status);
                                if (statuses.some(s => s === 'πληρώθηκε')) dominantStatus = 'πληρώθηκε';
                                else if (statuses.some(s => s === 'διαβιβάστηκε')) dominantStatus = 'διαβιβάστηκε';
                                else dominantStatus = null;
                              }
                              
                              const colors = getStatusColors(dominantStatus);
                              
                              return (
                                <div key={type} className={`${colors.bg} p-3 rounded-lg border ${colors.border}`}>
                                  <div className={`font-semibold ${colors.typeColor} text-sm mb-2`}>{type}</div>
                                  {data && typeof data === 'object' && Object.entries(data as Record<string, any>).map(([installment, details]) => {
                                    const installmentColors = getStatusColors((details as any)?.status);
                                    return (
                                      <div key={installment} className="flex justify-between items-center text-sm mb-1">
                                        <span className={`${installmentColors.installmentColor} font-medium`}>{installment}</span>
                                        <div className="flex items-center gap-2">
                                          <span className={`${installmentColors.amountBg} ${installmentColors.amountColor} px-2 py-1 rounded border font-mono text-xs`}>
                                            {(details as any)?.amount ? `€${(details as any).amount}` : '-'}
                                          </span>
                                          {(details as any)?.status && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${installmentColors.amountBg} ${installmentColors.amountColor}`}>
                                              {(details as any).status}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            });
                          } catch (e) {
                            return <div className="text-sm text-gray-500 bg-gray-100 p-2 rounded">Σφάλμα ανάγνωσης οικονομικών στοιχείων</div>;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredBeneficiaries.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Δεν βρέθηκαν δικαιούχοι
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Beneficiary dialog component
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
      afm: beneficiary?.afm || 0,
      project: beneficiary?.project || 0,
      aa: beneficiary?.aa || undefined,
      region: beneficiary?.region || "",
      adeia: beneficiary?.adeia || undefined,
      date: beneficiary?.date || "",
      monada: beneficiary?.monada || "",
      onlinefoldernumber: beneficiary?.onlinefoldernumber || "",
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
    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
      <DialogHeader className="pb-6">
        <DialogTitle className="text-2xl font-bold text-gray-900">
          {beneficiary ? "Επεξεργασία Δικαιούχου" : "Νέος Δικαιούχος"}
        </DialogTitle>
        <DialogDescription className="text-gray-600">
          Συμπληρώστε προσεκτικά όλα τα απαραίτητα στοιχεία του δικαιούχου
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Προσωπικά Στοιχεία
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
                    <FormLabel className="text-sm font-medium text-gray-700">Πατρώνυμο *</FormLabel>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <FormField
                control={form.control}
                name="afm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">ΑΦΜ *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="123456789"
                        className="bg-white font-mono"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">9 ψηφία χωρίς κενά</p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Έργο (MIS) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="5188985"
                        className="bg-white font-mono"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">Κωδικός MIS του έργου</p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Α/Α</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="001"
                        className="bg-white"
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">Αριθμός μητρώου (προαιρετικό)</p>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Περιφέρεια</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="π.χ. Αττικής" className="bg-white" />
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
                    <FormLabel className="text-sm font-medium text-gray-700">Αριθμός Άδειας</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="12345"
                        className="bg-white"
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Ημερομηνία</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="bg-white" />
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
                    <p className="text-xs text-gray-500">Κωδικός οργανικής μονάδας</p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="onlinefoldernumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Αριθμός Online Φακέλου</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ONL-2024-001234" className="bg-white" />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">Κωδικός ηλεκτρονικού φακέλου</p>
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