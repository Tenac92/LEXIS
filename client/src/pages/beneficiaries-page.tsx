import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Download, Upload, User, FileText } from "lucide-react";
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
                      </CardTitle>
                      {beneficiary.fathername && (
                        <CardDescription className="text-sm text-gray-600 italic">
                          {beneficiary.surname} του {beneficiary.fathername}
                        </CardDescription>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    {beneficiary.region && (
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Περιφέρεια</span>
                        <span className="text-gray-900 font-medium">{beneficiary.region}</span>
                      </div>
                    )}
                    {beneficiary.project && (
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Έργο (MIS)</span>
                        <span className="text-gray-900 font-mono">{beneficiary.project}</span>
                      </div>
                    )}
                    {beneficiary.monada && (
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Μονάδα</span>
                        <span className="text-gray-900">{beneficiary.monada}</span>
                      </div>
                    )}
                    {beneficiary.adeia && (
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Άδεια</span>
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
                            return Object.entries(oikonomika).map(([type, data]) => (
                              <div key={type} className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-200">
                                <div className="font-semibold text-green-800 text-sm mb-2">{type}</div>
                                {data && typeof data === 'object' && Object.entries(data as Record<string, any>).map(([installment, details]) => (
                                  <div key={installment} className="flex justify-between items-center text-sm">
                                    <span className="text-green-700 font-medium">{installment}</span>
                                    <span className="bg-white px-2 py-1 rounded border text-green-800 font-mono">
                                      {(details as any)?.amount ? `€${(details as any).amount}` : '-'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ));
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
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {beneficiary ? "Επεξεργασία Δικαιούχου" : "Νέος Δικαιούχος"}
        </DialogTitle>
        <DialogDescription>
          Συμπληρώστε τα στοιχεία του δικαιούχου
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="surname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Επώνυμο *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Επώνυμο" />
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
                    <Input {...field} placeholder="Όνομα" />
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
                    <Input {...field} placeholder="Πατρώνυμο" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="afm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ΑΦΜ *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="ΑΦΜ (9 ψηφία)"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
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
                  <FormLabel>Έργο (MIS) *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="Κωδικός MIS Έργου"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Α/Α</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="Αριθμός Μητρώου"
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
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
                  <FormLabel>Περιφέρεια</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="π.χ. Αττικής, Θεσσαλονίκης" />
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
                  <FormLabel>Αριθμός Άδειας</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="Αριθμός άδειας"
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
                  <FormLabel>Ημερομηνία</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="monada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Μονάδα</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="π.χ. ΔΑΕΦΚ-ΚΕ" />
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
                  <FormLabel>Αριθμός Online Φακέλου</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Αριθμός ηλεκτρονικού φακέλου" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Στοιχεία Μηχανικών</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="cengsur1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Επώνυμο Μηχανικού 1</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Επώνυμο 1ου μηχανικού" />
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
                      <Input {...field} placeholder="Όνομα 1ου μηχανικού" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cengsur2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Επώνυμο Μηχανικού 2</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Επώνυμο 2ου μηχανικού" />
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
                      <Input {...field} placeholder="Όνομα 2ου μηχανικού" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="freetext"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Επιπλέον Σχόλια</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    className="w-full p-2 border border-gray-300 rounded-md resize-none"
                    rows={3}
                    placeholder="Οποιαδήποτε επιπλέον πληροφορία ή σχόλια..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button type="submit">
              {beneficiary ? "Ενημέρωση" : "Δημιουργία"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}