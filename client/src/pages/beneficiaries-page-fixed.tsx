import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, User, FileText, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const beneficiarySchema = z.object({
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  fathername: z.string().optional(),
  afm: z.string().min(1, "Το ΑΦΜ είναι υποχρεωτικό"),
  project: z.number().optional(),
  date: z.string().optional(),
  onlinefoldernumber: z.string().optional(),
  adeia: z.string().optional(),
  region: z.string().optional(),
  freetext: z.string().optional(),
  cengsur1: z.string().optional(),
  cengname1: z.string().optional(),
  cengsur2: z.string().optional(),
  cengname2: z.string().optional(),
  paymentType: z.string().optional(),
  amount: z.string().optional(),
  installment: z.string().optional(),
});

type BeneficiaryFormData = z.infer<typeof beneficiarySchema>;

interface Beneficiary {
  id: number;
  name: string;
  surname: string;
  fathername?: string;
  afm: string;
  unit: string;
  project?: number;
  date?: string;
  onlinefoldernumber?: string;
  adeia?: string;
  region?: string;
  freetext?: string;
  cengsur1?: string;
  cengname1?: string;
  cengsur2?: string;
  cengname2?: string;
  installments?: any;
  oikonomika?: any;
}

interface Project {
  id: string;
  mis: string;
  project_title: string;
  event_description: string;
  expenditure_type: string[];
  region: string;
  implementing_agency: string[];
}

function BeneficiaryDialog({ beneficiary, open, onOpenChange }: {
  beneficiary?: Beneficiary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BeneficiaryFormData>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: {
      name: "",
      surname: "",
      fathername: "",
      afm: "",
      project: undefined,
      date: "",
      onlinefoldernumber: "",
      adeia: "",
      region: "",
      freetext: "",
      cengsur1: "",
      cengname1: "",
      cengsur2: "",
      cengname2: "",
      paymentType: "",
      amount: "",
      installment: "",
    },
  });

  // Reset form when beneficiary data changes
  useEffect(() => {
    if (beneficiary) {
      // Extract financial data from oikonomika JSON
      let paymentType = "";
      let amount = "";
      let installment = "";
      
      if (beneficiary.oikonomika) {
        try {
          const oikonomika = typeof beneficiary.oikonomika === 'string' 
            ? JSON.parse(beneficiary.oikonomika) 
            : beneficiary.oikonomika;
          
          // Get the first payment type and its details
          const firstPaymentType = Object.keys(oikonomika)[0];
          if (firstPaymentType) {
            paymentType = firstPaymentType;
            const paymentDetails = oikonomika[firstPaymentType][0];
            if (paymentDetails) {
              amount = paymentDetails.amount || "";
              installment = paymentDetails.installment?.[0] || "";
            }
          }
        } catch (e) {
          console.log("Could not parse oikonomika data:", e);
        }
      }
      
      form.reset({
        name: beneficiary.name || "",
        surname: beneficiary.surname || "",
        fathername: beneficiary.fathername || "",
        afm: beneficiary.afm || "",
        project: beneficiary.project || undefined,
        date: beneficiary.date || "",
        onlinefoldernumber: beneficiary.onlinefoldernumber || "",
        adeia: beneficiary.adeia || "",
        region: beneficiary.region || "",
        freetext: beneficiary.freetext || "",
        cengsur1: beneficiary.cengsur1 || "",
        cengname1: beneficiary.cengname1 || "",
        cengsur2: beneficiary.cengsur2 || "",
        cengname2: beneficiary.cengname2 || "",
        paymentType: paymentType,
        amount: amount,
        installment: installment,
      });
    } else {
      form.reset({
        name: "",
        surname: "",
        fathername: "",
        afm: "",
        project: undefined,
        date: "",
        onlinefoldernumber: "",
        adeia: "",
        region: "",
        freetext: "",
        cengsur1: "",
        cengname1: "",
        cengsur2: "",
        cengname2: "",
        paymentType: "",
        amount: "",
        installment: "",
      });
    }
  }, [beneficiary, form]);

  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const mutation = useMutation({
    mutationFn: async (data: BeneficiaryFormData) => {
      const url = beneficiary ? `/api/beneficiaries/${beneficiary.id}` : '/api/beneficiaries';
      const method = beneficiary ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save beneficiary');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/beneficiaries'] });
      toast({
        title: "Επιτυχία",
        description: beneficiary ? "Τα στοιχεία ενημερώθηκαν" : "Νέος δικαιούχος δημιουργήθηκε",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Σφάλμα",
        description: "Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BeneficiaryFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Προσωπικά Στοιχεία</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Όνομα *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Όνομα δικαιούχου" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Επώνυμο *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Επώνυμο δικαιούχου" />
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
                        <Input {...field} placeholder="123456789" />
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
                      <FormLabel>Ημερομηνία Αίτησης</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
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
                      <FormLabel>Αριθμός Φακέλου</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Αριθμός φακέλου" />
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
                        <Input {...field} placeholder="Αριθμός άδειας" />
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
                        <Input {...field} placeholder="π.χ. ΛΑΡΙΣΑ" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Engineers Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold">Στοιχεία Μηχανικών</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ΜΗΧΑΝΙΚΟΣ 1</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cengsur1"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Επώνυμο μηχανικού 1" />
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
                            <Input {...field} placeholder="Όνομα μηχανικού 1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">ΜΗΧΑΝΙΚΟΣ 2</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cengsur2"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Επώνυμο μηχανικού 2" />
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
                            <Input {...field} placeholder="Όνομα μηχανικού 2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Project Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Στοιχεία Έργου</h3>
              </div>
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Έργο</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(Number(value))} 
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε έργο..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(projects as Project[]).map((project) => (
                          <SelectItem key={project.mis} value={project.mis}>
                            {project.mis} - {project.project_title?.slice(0, 60) || project.event_description?.slice(0, 60) || 'Χωρίς τίτλο'}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Financial Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-semibold">Οικονομικά Στοιχεία</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Τύπος Πληρωμής</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Επιλέξτε τύπο" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ">ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ</SelectItem>
                          <SelectItem value="ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ">ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ</SelectItem>
                          <SelectItem value="ΔΚΑ ΕΠΙΣΚΕΥΗ">ΔΚΑ ΕΠΙΣΚΕΥΗ</SelectItem>
                          <SelectItem value="ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ">ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ</SelectItem>
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
                        <Input {...field} type="number" step="0.01" placeholder="π.χ. 10286.06" />
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Επιλέξτε δόση" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ΕΦΑΠΑΞ">ΕΦΑΠΑΞ</SelectItem>
                          <SelectItem value="Α">Α΄ ΔΟΣΗ</SelectItem>
                          <SelectItem value="Β">Β΄ ΔΟΣΗ</SelectItem>
                          <SelectItem value="Γ">Γ΄ ΔΟΣΗ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="freetext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ελεύθερο Κείμενο</FormLabel>
                    <FormControl>
                      <textarea 
                        {...field} 
                        placeholder="Προαιρετικό ελεύθερο κείμενο..." 
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Αποθήκευση..." : beneficiary ? "Ενημέρωση" : "Δημιουργία"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function BeneficiariesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();

  const { data: beneficiaries = [], isLoading } = useQuery({
    queryKey: ['/api/beneficiaries'],
  });

  const filteredBeneficiaries = beneficiaries.filter((beneficiary: Beneficiary) =>
    beneficiary.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    beneficiary.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(beneficiary.afm || '').includes(searchTerm)
  );

  const handleEdit = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedBeneficiary(undefined);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Φόρτωση...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Δικαιούχοι</h1>
          <p className="text-muted-foreground">
            Διαχείριση δικαιούχων και στοιχείων πληρωμών
            {user?.units?.[0] && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
                Μονάδα: {user.units[0]}
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Νέος Δικαιούχος
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Αναζήτηση δικαιούχου..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4">
        {filteredBeneficiaries.map((beneficiary: Beneficiary) => (
          <Card key={beneficiary.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {beneficiary.name} {beneficiary.surname}
                  </CardTitle>
                  <CardDescription>
                    ΑΦΜ: {beneficiary.afm} • Μονάδα: {beneficiary.unit}
                    {beneficiary.onlinefoldernumber && ` • Φάκελος: ${beneficiary.onlinefoldernumber}`}
                    {beneficiary.adeia && ` • Άδεια: ${beneficiary.adeia}`}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleEdit(beneficiary)}>
                  Επεξεργασία
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {beneficiary.fathername && (
                  <Badge variant="secondary">Πατρώνυμο: {beneficiary.fathername}</Badge>
                )}
                {beneficiary.project && (
                  <Badge variant="outline">Έργο: {beneficiary.project}</Badge>
                )}
                {beneficiary.date && (
                  <Badge variant="outline">Ημερομηνία: {beneficiary.date}</Badge>
                )}
                {beneficiary.region && (
                  <Badge variant="outline">Περιοχή: {beneficiary.region}</Badge>
                )}
                {(beneficiary.cengsur1 || beneficiary.cengname1) && (
                  <Badge variant="secondary">
                    Μηχανικός 1: {beneficiary.cengsur1} {beneficiary.cengname1}
                  </Badge>
                )}
                {(beneficiary.cengsur2 || beneficiary.cengname2) && (
                  <Badge variant="secondary">
                    Μηχανικός 2: {beneficiary.cengsur2} {beneficiary.cengname2}
                  </Badge>
                )}
                {beneficiary.freetext && (
                  <Badge variant="outline">Σημειώσεις: {beneficiary.freetext.substring(0, 50)}...</Badge>
                )}
              </div>
              
              {/* Financial Information Display */}
              {beneficiary.oikonomika && (
                <div className="mt-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                  <h4 className="text-sm font-semibold text-orange-800 mb-2">Οικονομικά Στοιχεία</h4>
                  {(() => {
                    try {
                      let oikonomika = beneficiary.oikonomika;
                      
                      // Handle different data formats
                      if (typeof oikonomika === 'string') {
                        // Remove any escape characters and parse
                        oikonomika = oikonomika.replace(/\\/g, '');
                        oikonomika = JSON.parse(oikonomika);
                      }
                      
                      if (!oikonomika || typeof oikonomika !== 'object') {
                        return <div className="text-xs text-orange-600">Δεν υπάρχουν οικονομικά στοιχεία</div>;
                      }
                      
                      return Object.entries(oikonomika).map(([paymentType, payments]: [string, any]) => (
                        <div key={paymentType} className="mb-2">
                          <div className="text-sm font-medium text-orange-700">{paymentType}</div>
                          {Array.isArray(payments) && payments.map((payment: any, index: number) => (
                            <div key={index} className="text-xs text-orange-600 ml-2">
                              • Ποσό: {payment.amount || 'Δεν έχει οριστεί'} 
                              | Δόση: {payment.installment?.[0] || payment.installment || 'Δεν έχει οριστεί'}
                              {payment.status && ` | Κατάσταση: ${payment.status}`}
                              {payment.protocol_number && ` | Πρωτόκολλο: ${payment.protocol_number}`}
                            </div>
                          ))}
                        </div>
                      ));
                    } catch (e) {
                      console.error('Error parsing oikonomika:', e, beneficiary.oikonomika);
                      return <div className="text-xs text-orange-600">Σφάλμα ανάγνωσης: {String(e)}</div>;
                    }
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <BeneficiaryDialog
        beneficiary={selectedBeneficiary}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}