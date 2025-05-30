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
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";

const beneficiarySchema = z.object({
  // Personal Information (required)
  name: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  surname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  fathername: z.string().min(1, "Το πατρώνυμο είναι υποχρεωτικό"),
  afm: z.string()
    .min(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    .max(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
    .regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να περιέχει μόνο ψηφία"),
  
  // Administrative Information (optional)
  aa: z.number().optional(),
  region: z.string().optional(),
  adeia: z.string().optional(), // Changed to string and optional
  date: z.string().optional(),
  monada: z.string().optional(),
  onlinefoldernumber: z.string().optional(),
  freetext: z.string().optional(),
  
  // Project Information
  project: z.number().optional(),
  
  // Engineers Information (optional)
  cengsur1: z.string().optional(),
  cengname1: z.string().optional(),
  cengsur2: z.string().optional(),
  cengname2: z.string().optional(),
  
  // Financial Information (for new payments)
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
      aa: undefined,
      region: "",
      adeia: undefined,
      date: "",
      monada: "",
      onlinefoldernumber: "",
      freetext: "",
      project: undefined,
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
          let oikonomika = beneficiary.oikonomika;
          
          // Handle different data formats and clean escaped JSON
          if (typeof oikonomika === 'string') {
            oikonomika = oikonomika.replace(/\\"/g, '"');
            oikonomika = JSON.parse(oikonomika);
          }
          
          // Get the first payment type and its details
          const firstPaymentType = Object.keys(oikonomika)[0];
          if (firstPaymentType) {
            paymentType = firstPaymentType;
            const installmentData = oikonomika[firstPaymentType];
            
            // Handle different installment data structures
            if (installmentData) {
              const firstInstallmentKey = Object.keys(installmentData)[0];
              const paymentDetails = installmentData[firstInstallmentKey];
              
              if (paymentDetails) {
                // Extract amount and format it for European display
                let rawAmount = paymentDetails.amount || "";
                if (rawAmount && typeof rawAmount === 'string') {
                  // Convert from database format to European display format
                  const numAmount = parseFloat(rawAmount);
                  if (!isNaN(numAmount)) {
                    amount = numAmount.toLocaleString('el-GR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    });
                  } else {
                    amount = rawAmount;
                  }
                } else {
                  amount = rawAmount;
                }
                
                // Extract installment
                if (paymentDetails.installment && Array.isArray(paymentDetails.installment)) {
                  installment = paymentDetails.installment[0] || firstInstallmentKey;
                } else {
                  installment = firstInstallmentKey;
                }
              }
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
        afm: beneficiary.afm ? String(beneficiary.afm) : "",
        project: beneficiary.project || undefined,
        date: beneficiary.date || "",
        onlinefoldernumber: beneficiary.onlinefoldernumber || "",
        adeia: beneficiary.adeia ? String(beneficiary.adeia) : "",
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

  const { user } = useAuth();
  
  const { data: allProjects = [] } = useQuery({
    queryKey: ['/api/projects'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter projects by user's unit
  const projects = (allProjects as Project[]).filter(project => {
    if (!user?.units?.[0]) return true; // Show all if no unit specified
    const userUnit = user.units[0];
    return project.implementing_agency?.includes(userUnit);
  });

  const mutation = useMutation({
    mutationFn: async (data: BeneficiaryFormData) => {
      if (beneficiary) {
        // Update existing beneficiary
        return apiRequest(`/api/beneficiaries/${beneficiary.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } else {
        // Create new beneficiary
        return apiRequest('/api/beneficiaries', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/beneficiaries'] });
      toast({
        title: "Επιτυχία",
        description: beneficiary ? "Τα στοιχεία ενημερώθηκαν επιτυχώς" : "Νέος δικαιούχος δημιουργήθηκε επιτυχώς",
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
                        <Input 
                          {...field} 
                          placeholder="123456789"
                          maxLength={9}
                          onChange={(e) => {
                            // Only allow digits and limit to 9 characters
                            const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                            field.onChange(value);
                          }}
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
                      onValueChange={(value) => {
                        const numValue = Number(value);
                        field.onChange(numValue);
                      }} 
                      value={field.value ? String(field.value) : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε έργο...">
                            {field.value && (() => {
                              const selectedProject = projects.find(p => Number(p.mis) === field.value);
                              if (selectedProject) {
                                return `MIS: ${selectedProject.mis} - ${selectedProject.event_description?.slice(0, 50) || selectedProject.project_title?.slice(0, 50) || 'Χωρίς περιγραφή'}...`;
                              }
                              return null;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="p-2">
                          <Input 
                            placeholder="Αναζήτηση με MIS κωδικό..."
                            onChange={(e) => {
                              const searchValue = e.target.value.toLowerCase();
                              const matchingProject = projects.find(project => 
                                project.mis?.toLowerCase().includes(searchValue) ||
                                project.event_description?.toLowerCase().includes(searchValue)
                              );
                              if (matchingProject && searchValue.length > 2) {
                                field.onChange(Number(matchingProject.mis));
                              }
                            }}
                            className="mb-2"
                          />
                        </div>
                        {projects
                          .sort((a, b) => Number(a.mis || 0) - Number(b.mis || 0))
                          .map((project) => (
                          <SelectItem key={project.mis} value={project.mis}>
                            <div className="flex flex-col items-start">
                              <span className="font-semibold text-blue-600">
                                MIS: {project.mis}
                              </span>
                              <span className="text-sm text-gray-600">
                                {project.event_description?.slice(0, 80) || project.project_title?.slice(0, 80) || 'Χωρίς περιγραφή'}...
                              </span>
                            </div>
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
                <FileText className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-800">Οικονομικά Στοιχεία</h3>
              </div>
              
              {/* Display existing financial data if editing */}
              {beneficiary?.oikonomika && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Υπάρχοντα Οικονομικά Στοιχεία:</h4>
                  {(() => {
                    try {
                      let oikonomika = beneficiary.oikonomika;
                      if (typeof oikonomika === 'string') {
                        oikonomika = oikonomika.replace(/\\"/g, '"');
                        oikonomika = JSON.parse(oikonomika);
                      }
                      
                      return Object.entries(oikonomika).map(([paymentType, installments]: [string, any]) => (
                        <div key={paymentType} className="mb-4">
                          <div className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">{paymentType}</div>
                          {Object.entries(installments).map(([installmentType, details]: [string, any]) => (
                            <div key={installmentType} className="grid grid-cols-2 gap-4 py-2 text-sm border-l-2 border-gray-300 pl-3 mb-2">
                              <div>
                                <span className="text-gray-600">Δόση:</span>
                                <span className="ml-2 font-semibold">{installmentType}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Ποσό:</span>
                                <span className="ml-2 font-bold text-lg">€{details.amount}</span>
                              </div>
                              {details.status && (
                                <div>
                                  <span className="text-gray-600">Κατάσταση:</span>
                                  <span className="ml-2 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">{details.status}</span>
                                </div>
                              )}
                              {details.protocol && (
                                <div>
                                  <span className="text-gray-600">Πρωτόκολλο:</span>
                                  <span className="ml-2 font-mono text-sm">{details.protocol}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ));
                    } catch (e) {
                      return <div className="text-sm text-red-600">Σφάλμα ανάγνωσης οικονομικών στοιχείων</div>;
                    }
                  })()}
                </div>
              )}

              <div className="p-4 border border-dashed border-gray-300 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Προσθήκη Νέου Οικονομικού Στοιχείου:</h4>
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
                        <Input 
                          {...field} 
                          type="text" 
                          placeholder="π.χ. 10.286,06"
                          onChange={(e) => {
                            // Allow European decimal formatting (commas and periods)
                            const value = e.target.value;
                            if (value === '' || /^[\d\.,]+$/.test(value)) {
                              field.onChange(value);
                            }
                          }}
                        />
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

  const filteredBeneficiaries = (beneficiaries as Beneficiary[] || []).filter((beneficiary: Beneficiary) =>
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
    <div className="min-h-screen bg-gray-50">
      <Header />
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
                    {beneficiary.fathername && (
                      <span className="text-base font-normal text-gray-700 ml-1">
                        ΤΟΥ {beneficiary.fathername}
                      </span>
                    )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
                {beneficiary.project && (
                  <div><span className="font-medium">Έργο:</span> {beneficiary.project}</div>
                )}
                {beneficiary.date && (
                  <div><span className="font-medium">Ημερομηνία:</span> {beneficiary.date}</div>
                )}
                {beneficiary.region && (
                  <div><span className="font-medium">Περιοχή:</span> {beneficiary.region}</div>
                )}
                {(beneficiary.cengsur1 || beneficiary.cengname1) && (
                  <div><span className="font-medium">Μηχανικός 1:</span> {beneficiary.cengsur1} {beneficiary.cengname1}</div>
                )}
                {(beneficiary.cengsur2 || beneficiary.cengname2) && (
                  <div><span className="font-medium">Μηχανικός 2:</span> {beneficiary.cengsur2} {beneficiary.cengname2}</div>
                )}
                {beneficiary.freetext && (
                  <div className="md:col-span-2"><span className="font-medium">Σημειώσεις:</span> {beneficiary.freetext}</div>
                )}
              </div>
              
              {/* Financial Information Display */}
              {beneficiary.oikonomika && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-gray-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Οικονομικά Στοιχεία</h4>
                  </div>
                  {(() => {
                    try {
                      let oikonomika = beneficiary.oikonomika;
                      
                      // Handle different data formats
                      if (typeof oikonomika === 'string') {
                        // Clean and parse JSON - handle escaped quotes properly
                        oikonomika = oikonomika.replace(/\\"/g, '"');
                        oikonomika = JSON.parse(oikonomika);
                      }
                      
                      if (!oikonomika || typeof oikonomika !== 'object') {
                        return <div className="text-sm text-gray-500 italic">Δεν υπάρχουν οικονομικά στοιχεία</div>;
                      }
                      
                      return Object.entries(oikonomika).map(([paymentType, installments]: [string, any]) => {

                        return (
                          <div key={paymentType} className="mb-4">
                            <div className="text-sm font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-200">{paymentType}</div>
                            {Object.entries(installments).map(([installmentType, details]: [string, any]) => {

                              const amount = details.amount || 'Δεν έχει οριστεί';
                              const status = details.status || null;
                              const protocol = details.protocol || details.protocol_number || null;
                              
                              return (
                                <div key={installmentType} className="grid grid-cols-2 gap-4 py-2 text-sm border-l-2 border-gray-300 pl-3 mb-2">
                                  <div>
                                    <span className="text-gray-600">Δόση:</span>
                                    <span className="ml-2 font-semibold text-gray-900">{installmentType}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Ποσό:</span>
                                    <span className="ml-2 font-bold text-lg text-gray-900">
                                      €{typeof amount === 'number' ? amount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}
                                    </span>
                                  </div>
                                  {status && (
                                    <div>
                                      <span className="text-gray-600">Κατάσταση:</span>
                                      <span className="ml-2 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">
                                        {status}
                                      </span>
                                    </div>
                                  )}
                                  {protocol && (
                                    <div>
                                      <span className="text-gray-600">Πρωτόκολλο:</span>
                                      <span className="ml-2 text-gray-800 font-mono text-sm">
                                        {protocol}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    } catch (e) {
                      console.error('Error parsing oikonomika:', e, beneficiary.oikonomika);
                      return (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          <strong>Σφάλμα ανάγνωσης:</strong> {String(e)}
                          <div className="mt-1 text-xs">Raw data: {String(beneficiary.oikonomika)}</div>
                        </div>
                      );
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
    </div>
  );
}