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
  project: z.number().optional(),
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
  
  // Fetch user's projects for dropdown
  const { data: userResponse } = useQuery({
    queryKey: ["/api/auth/me"],
  });
  
  const userUnits = userResponse?.user?.units?.[0];
  
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects-working", userUnits],
    enabled: open && !!userUnits, // Only fetch when dialog is open and user units available
  });
  
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
      amount: "",
      installment: "",
      afm: beneficiary.afm || undefined,
      type: "",
      date: beneficiary.date || "",
      monada: beneficiary.monada || "",
      cengsur1: beneficiary.cengsur1 || "",
      cengname1: beneficiary.cengname1 || "",
      cengsur2: beneficiary.cengsur2 || "",
      cengname2: beneficiary.cengname2 || "",
      onlinefoldernumber: beneficiary.onlinefoldernumber || "",
      project: beneficiary.project || undefined,
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Προσωπικά Στοιχεία</h3>
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
            </div>

            {/* Financial Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Οικονομικά Στοιχεία</h3>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">
                    Προσθέστε πληρωμές για αυτόν τον δικαιούχο. Μπορεί να έχει πολλαπλούς τύπους πληρωμών και δόσεις.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Τύπος Πληρωμής</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε τύπο" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ΔΚΑ ΕΠΙΣΚΕΥΗ">ΔΚΑ ΕΠΙΣΚΕΥΗ</SelectItem>
                          <SelectItem value="ΔΚΑ ΑΠΟΚΑΤΑΣΤΑΣΗ">ΔΚΑ ΑΠΟΚΑΤΑΣΤΑΣΗ</SelectItem>
                          <SelectItem value="ΣΤΕΓΑΣΤΙΚΗ ΣΥΝΔΡΟΜΗ">ΣΤΕΓΑΣΤΙΚΗ ΣΥΝΔΡΟΜΗ</SelectItem>
                          <SelectItem value="ΕΠΙΧΕΙΡΗΜΑΤΙΚΗ ΣΥΝΔΡΟΜΗ">ΕΠΙΧΕΙΡΗΜΑΤΙΚΗ ΣΥΝΔΡΟΜΗ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Ποσό</label>
                      <Input placeholder="π.χ. 10.286.06" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Δόση</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε δόση" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ΕΦΑΠΑΞ">ΕΦΑΠΑΞ</SelectItem>
                          <SelectItem value="Α">Α΄ ΔΟΣΗ</SelectItem>
                          <SelectItem value="Β">Β΄ ΔΟΣΗ</SelectItem>
                          <SelectItem value="Γ">Γ΄ ΔΟΣΗ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <Button type="button" variant="outline" size="sm">
                      + Προσθήκη Πληρωμής
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Μετά την αποθήκευση, τα οικονομικά στοιχεία θα αποθηκευτούν στη νέα δομή JSONB.
                  Η κατάσταση και ο αριθμός πρωτοκόλλου θα ενημερώνονται αυτόματα από τα παραγόμενα έγγραφα.
                </div>
              </div>
            </div>

            {/* Administrative Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Διοικητικά Στοιχεία</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          placeholder="1"
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
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
                        <Input {...field} placeholder="ΗΗ.ΜΜ.ΕΕΕΕ" />
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
                        <Input {...field} placeholder="Μονάδα" />
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
                      <FormLabel>Έργο (MIS Κωδικός)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field}
                            type="number"
                            placeholder="π.χ. 5222792"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="pr-10"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                            MIS
                          </div>
                        </div>
                      </FormControl>
                      <div className="text-xs text-muted-foreground mt-1">
                        Εισάγετε τον κωδικό MIS του έργου (π.χ. 5222792)
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="onlinefoldernumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Αριθμός Φακέλου</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Αριθμός online φακέλου" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Engineers Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Στοιχεία Μηχανικών</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ΜΗΧΑΝΙΚΌΣ 1</label>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="cengsur1"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Επώνυμο" />
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
                          <FormControl>
                            <Input {...field} placeholder="Όνομα" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">ΜΗΧΑΝΙΚΌΣ 2</label>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="cengsur2"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Επώνυμο" />
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
                          <FormControl>
                            <Input {...field} placeholder="Όνομα" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
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
        'Άδεια', 'Ποσό', 'Δόση', 'Τύπος', 'Ημερομηνία', 'Μονάδα', 'Έργο',
        'Επώνυμο Απογραφής 1', 'Όνομα Απογραφής 1', 'Επώνυμο Απογραφής 2', 
        'Όνομα Απογραφής 2', 'Αριθμός Φακέλου', 'Ελεύθερο Κείμενο'
      ];
      
      const csvContent = [
        headers.join(','),
        ...beneficiaries.map(b => {
          // Extract financial data from oikonomika JSONB field
          let amount = '';
          let installment = '';
          let type = '';
          
          if (b.oikonomika && typeof b.oikonomika === 'object') {
            const expenditureTypes = Object.keys(b.oikonomika);
            if (expenditureTypes.length > 0) {
              type = expenditureTypes[0];
              const payments = (b.oikonomika as any)[type];
              if (Array.isArray(payments) && payments.length > 0) {
                const firstPayment = payments[0];
                amount = firstPayment.amount || '';
                if (Array.isArray(firstPayment.installment) && firstPayment.installment.length > 0) {
                  installment = firstPayment.installment.join(', ');
                }
              }
            }
          }
          
          return [
            b.aa || '', b.surname || '', b.name || '', b.fathername || '',
            b.afm || '', b.region || '', b.adeia || '', amount,
            installment, type, b.date || '', b.monada || '',
            b.project || '', b.cengsur1 || '', b.cengname1 || '', b.cengsur2 || '', 
            b.cengname2 || '', b.onlinefoldernumber || '', b.freetext || ''
          ].join(',');
        })
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
                project: values[12] ? parseInt(values[12]) : undefined,
                cengsur1: values[13] || '',
                cengname1: values[14] || '',
                cengsur2: values[15] || '',
                cengname2: values[16] || '',
                onlinefoldernumber: values[17] || '',
                freetext: values[18] || ''
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
              {beneficiaries.filter(b => {
                if (b.oikonomika && typeof b.oikonomika === 'object') {
                  const expenditureTypes = Object.keys(b.oikonomika);
                  return expenditureTypes.some(type => {
                    const payments = b.oikonomika[type];
                    return Array.isArray(payments) && payments.some(payment => 
                      payment.amount && parseFloat(payment.amount.replace(',', '.')) > 0
                    );
                  });
                }
                return false;
              }).length}
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
            <div className="grid gap-4">
              {filteredBeneficiaries.map((beneficiary) => (
                <Card key={beneficiary.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Primary Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-base text-muted-foreground">Στοιχεία</span>
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{beneficiary.surname} {beneficiary.name}</p>
                            <p className="text-base text-muted-foreground">Πατρώνυμο: {beneficiary.fathername || "-"}</p>
                            {beneficiary.afm && (
                              <Badge variant="outline" className="mt-1 text-sm">ΑΦΜ: {beneficiary.afm}</Badge>
                            )}
                          </div>
                        </div>

                        {/* Financial Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-base text-muted-foreground">Οικονομικά</span>
                          </div>
                          <div className="space-y-1">
                            {beneficiary.oikonomika && typeof beneficiary.oikonomika === 'object' ? (
                              Object.entries(beneficiary.oikonomika as Record<string, any>).map(([paymentType, records]) => (
                                <div key={paymentType} className="space-y-1">
                                  <Badge variant="secondary" className="text-sm font-medium">{paymentType}</Badge>
                                  {Array.isArray(records) && records.map((record: any, index: number) => (
                                    <div key={index} className="ml-2 space-y-1">
                                      <div className="flex gap-1 flex-wrap">
                                        <Badge variant="outline" className="text-xs">{record.amount}€</Badge>
                                        {Array.isArray(record.installment) && record.installment.map((inst: string) => (
                                          <Badge key={inst} variant="outline" className="text-xs">{inst}</Badge>
                                        ))}
                                      </div>
                                      <div className="flex gap-1 flex-wrap">
                                        {record.protocol_number && (
                                          <Badge variant="default" className="text-xs">Πρωτ.: {record.protocol_number}</Badge>
                                        )}
                                        {record.status && (
                                          <Badge 
                                            variant={record.status.includes('διαβιβάστηκε') || record.status.includes('διαβιβαστηκε') ? "destructive" : "secondary"} 
                                            className="text-xs"
                                          >
                                            {record.status}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">Δεν υπάρχουν οικονομικά στοιχεία</p>
                            )}
                          </div>
                        </div>

                        {/* Administrative Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-base text-muted-foreground">Διοικητικά</span>
                          </div>
                          <div className="space-y-1 text-base">
                            {beneficiary.aa && <p>Α/Α: {beneficiary.aa}</p>}
                            {beneficiary.region && <p>Περιφέρεια: {beneficiary.region}</p>}
                            {beneficiary.adeia && <p>Άδεια: {beneficiary.adeia}</p>}
                            {beneficiary.date && <p>Ημερομηνία: {beneficiary.date}</p>}
                            {beneficiary.monada && <p>Μονάδα: {beneficiary.monada}</p>}
                            {beneficiary.project && <p>Έργο: <Badge variant="outline" className="text-sm">{beneficiary.project}</Badge></p>}
                            {beneficiary.onlinefoldernumber && <p>Φάκελος: {beneficiary.onlinefoldernumber}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(beneficiary)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(beneficiary)}
                          disabled={deleteMutation.isPending}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Additional Details - Hidden by default, can be expanded */}
                    {(beneficiary.cengsur1 || beneficiary.cengname1 || beneficiary.cengsur2 || beneficiary.cengname2 || beneficiary.freetext) && (
                      <div className="mt-4 pt-4 border-t border-muted">
                        <details className="text-base">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                            Πρόσθετες Πληροφορίες
                          </summary>
                          <div className="mt-2 space-y-1">
                            {beneficiary.cengsur1 && <p>ΜΗΧΑΝΙΚΌΣ 1: {beneficiary.cengsur1} {beneficiary.cengname1}</p>}
                            {beneficiary.cengsur2 && <p>ΜΗΧΑΝΙΚΌΣ 2: {beneficiary.cengsur2} {beneficiary.cengname2}</p>}
                            {beneficiary.freetext && <p>Σημειώσεις: {beneficiary.freetext}</p>}
                          </div>
                        </details>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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