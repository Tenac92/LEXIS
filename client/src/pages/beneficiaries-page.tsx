import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Download, Upload, User } from "lucide-react";
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
  aa: z.number().optional(),
  region: z.string().optional(),
  adeia: z.number().optional(),
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  fathername: z.string().min(1, "Το πατρώνυμο είναι υποχρεωτικό"),
  freetext: z.string().optional(),
  amount: z.string().optional(),
  installment: z.string().optional(),
  afm: z.number().min(100000000, "Το ΑΦΜ πρέπει να έχει 9 ψηφία").max(999999999, "Το ΑΦΜ πρέπει να έχει 9 ψηφία"),
  type: z.string().optional(),
  date: z.string().optional(),
  monada: z.string().optional(),
  cengsur1: z.string().optional(),
  cengname1: z.string().optional(),
  cengsur2: z.string().optional(),
  cengname2: z.string().optional(),
  onlinefoldernumber: z.string().optional(),
});

type BeneficiaryFormData = z.infer<typeof beneficiaryFormSchema>;

interface BeneficiaryDialogProps {
  beneficiary?: Beneficiary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BeneficiaryDialog({ beneficiary, open, onOpenChange }: BeneficiaryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<BeneficiaryFormData>({
    resolver: zodResolver(beneficiaryFormSchema),
    defaultValues: beneficiary ? {
      aa: beneficiary.aa || undefined,
      region: beneficiary.region || "",
      adeia: beneficiary.adeia || undefined,
      surname: beneficiary.surname || "",
      name: beneficiary.name || "",
      fathername: beneficiary.fathername || "",
      freetext: beneficiary.freetext || "",
      amount: beneficiary.amount || "",
      installment: beneficiary.installment || "",
      afm: beneficiary.afm || undefined,
      type: beneficiary.type || "",
      date: beneficiary.date || "",
      monada: beneficiary.monada || "",
      cengsur1: beneficiary.cengsur1 || "",
      cengname1: beneficiary.cengname1 || "",
      cengsur2: beneficiary.cengsur2 || "",
      cengname2: beneficiary.cengname2 || "",
      onlinefoldernumber: beneficiary.onlinefoldernumber || "",
    } : {
      surname: "",
      name: "",
      fathername: "",
      afm: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: BeneficiaryFormData) => {
      if (beneficiary) {
        return apiRequest(`/api/beneficiaries/${beneficiary.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        return apiRequest("/api/beneficiaries", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      toast({
        title: "Επιτυχία!",
        description: beneficiary ? "Ο δικαιούχος ενημερώθηκε επιτυχώς" : "Ο δικαιούχος δημιουργήθηκε επιτυχώς",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Παρουσιάστηκε σφάλμα κατά την αποθήκευση",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BeneficiaryFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {beneficiary ? "Επεξεργασία Δικαιούχου" : "Νέος Δικαιούχος"}
          </DialogTitle>
          <DialogDescription>
            {beneficiary ? "Ενημερώστε τα στοιχεία του δικαιούχου" : "Εισάγετε τα στοιχεία του νέου δικαιούχου"}
          </DialogDescription>
        </DialogHeader>

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
                        placeholder="123456789"
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
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
                    <FormLabel>Περιφέρεια</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Περιφέρεια" />
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
                      <Input {...field} placeholder="Κωδικός μονάδας" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ποσό</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Δόση</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ΕΦΑΠΑΞ" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Τύπος</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Τύπος δικαιούχου" />
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
                      <Input {...field} placeholder="ΗΗ/ΜΜ/ΕΕΕΕ" />
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
                    <Textarea {...field} placeholder="Πρόσθετες πληροφορίες" className="min-h-[80px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Ακύρωση
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Αποθήκευση..." : "Αποθήκευση"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function BeneficiariesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch beneficiaries
  const { data: beneficiaries = [], isLoading } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
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

  const handleExport = () => {
    try {
      const headers = [
        'Α/Α', 'Επώνυμο', 'Όνομα', 'Πατρώνυμο', 'ΑΦΜ', 'Περιφέρεια', 
        'Άδεια', 'Ποσό', 'Δόση', 'Τύπος', 'Ημερομηνία', 'Μονάδα', 
        'Επώνυμο Απογραφής 1', 'Όνομα Απογραφής 1', 'Επώνυμο Απογραφής 2', 
        'Όνομα Απογραφής 2', 'Αριθμός Φακέλου', 'Ελεύθερο Κείμενο'
      ];
      
      const csvContent = [
        headers.join(','),
        ...beneficiaries.map(b => [
          b.aa || '', b.surname || '', b.name || '', b.fathername || '',
          b.afm || '', b.region || '', b.adeia || '', b.amount || '',
          b.installment || '', b.type || '', b.date || '', b.monada || '',
          b.cengsur1 || '', b.cengname1 || '', b.cengsur2 || '', 
          b.cengname2 || '', b.onlinefoldernumber || '', b.freetext || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `δικαιούχοι_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Επιτυχία",
        description: `Εξήχθησαν ${beneficiaries.length} δικαιούχοι`,
      });
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η εξαγωγή των δεδομένων",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Σφάλμα",
          description: "Το αρχείο πρέπει να περιέχει τουλάχιστον μία γραμμή δεδομένων",
          variant: "destructive",
        });
        return;
      }

      const dataLines = lines.slice(1);
      let imported = 0;
      
      for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim());
        if (values.length >= 4) {
          try {
            await apiRequest('/api/beneficiaries', {
              method: 'POST',
              body: JSON.stringify({
                aa: values[0] ? parseInt(values[0]) : undefined,
                surname: values[1] || '',
                name: values[2] || '',
                fathername: values[3] || '',
                afm: values[4] ? parseInt(values[4]) : undefined,
                region: values[5] || '',
                adeia: values[6] ? parseInt(values[6]) : undefined,
                amount: values[7] || '',
                installment: values[8] || '',
                type: values[9] || '',
                date: values[10] || '',
                monada: values[11] || '',
                cengsur1: values[12] || '',
                cengname1: values[13] || '',
                cengsur2: values[14] || '',
                cengname2: values[15] || '',
                onlinefoldernumber: values[16] || '',
                freetext: values[17] || ''
              }),
            });
            imported++;
          } catch (error) {
            console.error('Error importing row:', error);
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/beneficiaries'] });
      
      toast({
        title: "Επιτυχία",
        description: `Εισήχθησαν ${imported} δικαιούχοι από ${dataLines.length} γραμμές`,
      });
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η εισαγωγή των δεδομένων",
        variant: "destructive",
      });
    }
    
    event.target.value = '';
  };

  return (
    <>
      <Header />
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Διαχείριση Δικαιούχων</h1>
          <p className="text-muted-foreground">
            Διαχειριστείτε τους δικαιούχους και χρησιμοποιήστε τους στη δημιουργία εγγράφων
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImport}
            className="hidden"
            id="import-file"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => document.getElementById('import-file')?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Εισαγωγή
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Εξαγωγή
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Νέος Δικαιούχος
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Σύνολο Δικαιούχων</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{beneficiaries.length}</div>
            <p className="text-xs text-muted-foreground">
              Εγγεγραμμένοι δικαιούχοι
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Με Ποσό</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {beneficiaries.filter(b => b.amount && parseFloat(b.amount) > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Δικαιούχοι με καθορισμένο ποσό
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Αποτελέσματα Αναζήτησης</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredBeneficiaries.length}</div>
            <p className="text-xs text-muted-foreground">
              Αποτελέσματα με βάση τα κριτήρια
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Αναζήτηση Δικαιούχων</CardTitle>
          <CardDescription>
            Αναζητήστε δικαιούχους με βάση το όνομα, επώνυμο ή ΑΦΜ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Αναζήτηση δικαιούχων..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Beneficiaries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Λίστα Δικαιούχων</CardTitle>
          <CardDescription>
            {filteredBeneficiaries.length} από {beneficiaries.length} δικαιούχους
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Φόρτωση δικαιούχων...</div>
          ) : filteredBeneficiaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Δεν βρέθηκαν δικαιούχοι με αυτά τα κριτήρια" : "Δεν υπάρχουν δικαιούχοι"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Α/Α</TableHead>
                    <TableHead>Επώνυμο</TableHead>
                    <TableHead>Όνομα</TableHead>
                    <TableHead>Πατρώνυμο</TableHead>
                    <TableHead>ΑΦΜ</TableHead>
                    <TableHead>Περιφέρεια</TableHead>
                    <TableHead>Άδεια</TableHead>
                    <TableHead>Ποσό</TableHead>
                    <TableHead>Δόση</TableHead>
                    <TableHead>Τύπος</TableHead>
                    <TableHead>Ημ/νία</TableHead>
                    <TableHead>Μονάδα</TableHead>
                    <TableHead>Φάκελος</TableHead>
                    <TableHead>Ενέργειες</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBeneficiaries.map((beneficiary) => (
                    <TableRow key={beneficiary.id}>
                      <TableCell>{beneficiary.aa || "-"}</TableCell>
                      <TableCell className="font-medium">{beneficiary.surname || "-"}</TableCell>
                      <TableCell>{beneficiary.name || "-"}</TableCell>
                      <TableCell>{beneficiary.fathername || "-"}</TableCell>
                      <TableCell>
                        {beneficiary.afm ? (
                          <Badge variant="outline">{beneficiary.afm}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{beneficiary.region || "-"}</TableCell>
                      <TableCell>{beneficiary.adeia || "-"}</TableCell>
                      <TableCell>
                        {beneficiary.amount ? (
                          <Badge variant="secondary">{beneficiary.amount}€</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{beneficiary.installment || "-"}</TableCell>
                      <TableCell>
                        {beneficiary.type ? (
                          <Badge variant="outline">{beneficiary.type}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{beneficiary.date || "-"}</TableCell>
                      <TableCell className="text-sm">{beneficiary.monada || "-"}</TableCell>
                      <TableCell>{beneficiary.onlinefoldernumber || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(beneficiary)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(beneficiary)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Beneficiary Dialog */}
      <BeneficiaryDialog
        beneficiary={selectedBeneficiary}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
    </>
  );
}