import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { createClient } from '@supabase/supabase-js';
import type { BudgetValidationResponse } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Check, ChevronRight, FileText, Plus, Trash2, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key must be defined in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

interface Project {
  id: string;
  name: string;
  expenditure_types: string[];
}

interface BudgetData {
  current_budget: number;
  total_budget: number;
  annual_budget: number;
  katanomes_etous: number;
}

interface BudgetIndicatorProps {
  budgetData: BudgetData;
  currentAmount: number;
}

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
};

const BudgetIndicator: React.FC<BudgetIndicatorProps> = ({ budgetData, currentAmount }) => {
  const availableBudget = budgetData.current_budget - currentAmount;
  const percentageUsed = (currentAmount / budgetData.current_budget) * 100;

  const getBadgeVariant = (percentage: number): BadgeVariant => {
    if (percentage > 90) return "destructive";
    if (percentage > 70) return "secondary";
    return "default";
  };

  return (
    <Card className="p-3 bg-gradient-to-br from-background/50 to-background border-primary/20">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Προϋπολογισμός</h3>
          <Badge variant={getBadgeVariant(percentageUsed)} className="text-sm">
            {percentageUsed.toFixed(1)}% Χρήση
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Διαθέσιμος</p>
            <p className="font-medium text-primary">
              {availableBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Συνολικός</p>
            <p className="font-medium">
              {budgetData.total_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Ετήσιος</p>
            <p className="font-medium">
              {budgetData.katanomes_etous.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>

        <div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-in-out"
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-right mt-1">
            Τρέχον: {currentAmount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>
    </Card>
  );
};

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { title: "Επιλογή Μονάδας", icon: <User className="h-4 w-4" /> },
    { title: "Στοιχεία Έργου", icon: <FileText className="h-4 w-4" /> },
    { title: "Παραλήπτες", icon: <User className="h-4 w-4" /> },
    { title: "Συνημμένα", icon: <FileText className="h-4 w-4" /> }
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className={`flex items-center justify-center ${
            index <= currentStep ? 'text-primary' : 'text-muted-foreground'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              index === currentStep ? 'border-primary bg-primary/10' :
                index < currentStep ? 'border-primary bg-primary text-background' :
                  'border-muted'
            }`}>
              {index < currentStep ? <Check className="h-4 w-4" /> : step.icon}
            </div>
            <span className="ml-2 text-sm font-medium hidden md:block">{step.title}</span>
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className={`mx-2 h-4 w-4 ${
              index < currentStep ? 'text-primary' : 'text-muted-foreground'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

const createDocumentSchema = z.object({
  unit: z.string().min(1, "Η μονάδα είναι υποχρεωτική"),
  project_id: z.string().min(1, "Το έργο είναι υποχρεωτικό"),
  expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
  recipients: z.array(z.object({
    firstname: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
    lastname: z.string().min(2, "Το επώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
    afm: z.string().length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία"),
    amount: z.number().min(0.01, "Το ποσό πρέπει να είναι μεγαλύτερο από 0"),
    installment: z.number().int().min(1).max(12, "Η δόση πρέπει να είναι μεταξύ 1 και 12")
  })).optional().default([]),
  total_amount: z.number().optional(),
  status: z.string().default("draft"),
  selectedAttachments: z.array(z.string()).optional().default([])
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function CreateDocumentDialog({ open, onOpenChange, onClose }: CreateDocumentDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      unit: "",
      project_id: "",
      expenditure_type: "",
      recipients: [],
      status: "draft",
      selectedAttachments: []
    }
  });

  const selectedUnit = form.watch("unit");
  const selectedProjectId = form.watch("project_id");
  const recipients = form.watch("recipients") || [];

  const currentAmount = recipients.reduce((sum, r) => {
    return sum + (typeof r.amount === 'number' ? r.amount : 0);
  }, 0);

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('unit_det')
          .select('unit, unit_name')
          .order('unit');

        if (error) {
          console.error('Error fetching units:', error);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive"
          });
          throw error;
        }

        return data.map((item: any) => ({
          id: item.unit,
          name: item.unit_name
        }));
      } catch (error) {
        console.error('Units fetch error:', error);
        throw error;
      }
    },
    retry: 2
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];

      try {
        const { data, error } = await supabase
          .from('project_catalog')
          .select('mis, na853, event_description, project_title, expenditure_type')
          .contains('implementing_agency', [selectedUnit])
          .order('mis');

        if (error) {
          console.error('Error fetching projects:', error);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive"
          });
          throw error;
        }

        return data.map((item: any) => {
          let expenditureTypes: string[] = [];
          try {
            if (item.expenditure_type) {
              if (Array.isArray(item.expenditure_type)) {
                expenditureTypes = item.expenditure_type;
              } else if (typeof item.expenditure_type === 'string') {
                expenditureTypes = item.expenditure_type
                  .replace(/[{}]/g, '')
                  .split(',')
                  .map((type: string) => type.trim())
                  .filter(Boolean);
              }
            }
          } catch (e) {
            console.error('Error parsing expenditure types:', e, item);
          }

          return {
            id: item.mis.toString(),
            name: `${item.na853} - ${item.event_description || item.project_title || 'No description'}`,
            expenditure_types: expenditureTypes
          };
        });

      } catch (error) {
        console.error('Projects fetch error:', error);
        throw error;
      }
    },
    enabled: Boolean(selectedUnit),
    retry: 2
  });

  const { data: budgetData, error: budgetError } = useQuery({
    queryKey: ["budget", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;

      try {
        const { data: budgetData, error } = await supabase
          .from('budget_na853_split')
          .select('user_view, proip, ethsia_pistosi, katanomes_etous')
          .eq('mis', selectedProjectId)
          .single();

        if (error) throw error;
        if (!budgetData) throw new Error('Budget data not found');

        return {
          current_budget: parseFloat(budgetData.user_view?.toString() || '0'),
          total_budget: parseFloat(budgetData.proip?.toString() || '0'),
          annual_budget: parseFloat(budgetData.ethsia_pistosi?.toString() || '0'),
          katanomes_etous: parseFloat(budgetData.katanomes_etous?.toString() || '0')
        };
      } catch (error) {
        console.error('Budget fetch error:', error);
        toast({
          title: "Σφάλμα",
          description: error instanceof Error ? error.message : "Αποτυχία φόρτωσης πληροφοριών προϋπολογισμού.",
          variant: "destructive"
        });
        return null;
      }
    },
    enabled: Boolean(selectedProjectId)
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ['attachments', form.watch('expenditure_type'), form.watch('recipients.0.installment')],
    queryFn: async () => {
      try {
        const expenditureType = form.watch('expenditure_type');
        const installment = form.watch('recipients.0.installment') || 1;

        if (!expenditureType) {
          return [];
        }

        const { data, error } = await supabase
          .from('attachments')
          .select('id, expediture_type, installment, attachments')
          .eq('expediture_type', expenditureType)
          .eq('installment', installment);

        if (error) {
          console.error('Error fetching attachments:', error);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης συνημμένων",
            variant: "destructive"
          });
          return [];
        }

        if (!data || !Array.isArray(data)) {
          return [];
        }

        return data.reduce((acc: any[], row) => {
          if (row.attachments && Array.isArray(row.attachments)) {
            const items = row.attachments.map((title: string) => ({
              id: `${row.id}-${title}`,
              title,
              file_type: 'document',
              description: `Required for ${row.expediture_type} - Installment ${row.installment}`
            }));
            return [...acc, ...items];
          }
          return acc;
        }, []);
      } catch (error) {
        console.error('Error fetching attachments:', error);
        return [];
      }
    },
    enabled: Boolean(form.watch('expenditure_type'))
  });

  const { data: validationResult } = useQuery<BudgetValidationResponse>({
    queryKey: ["budget-validation", selectedProjectId, currentAmount],
    queryFn: async () => {
      if (!selectedProjectId || currentAmount <= 0) {
        return { status: 'success', canCreate: true };
      }

      try {
        const response = await apiRequest<BudgetValidationResponse>('/api/budget/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mis: selectedProjectId,
            amount: currentAmount.toString()
          })
        });

        if (response.status === 'warning' && response.message) {
          toast({
            title: "Προειδοποίηση",
            description: response.message,
            variant: "destructive"
          });
        }

        return response;
      } catch (error) {
        console.error('Budget validation error:', error);
        toast({
          title: "Σφάλμα",
          description: error instanceof Error ? error.message : 'Αποτυχία επικύρωσης προϋπολογισμού',
          variant: "destructive"
        });
        return {
          status: 'error',
          canCreate: false,
          message: error instanceof Error ? error.message : 'Αποτυχία επικύρωσης προϋπολογισμού'
        };
      }
    },
    enabled: Boolean(selectedProjectId) && currentAmount > 0
  });

  const isSubmitDisabled = validationResult?.status === 'error' || !validationResult?.canCreate;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleSubmit = async (data: CreateDocumentForm) => {
    try {
      if (isSubmitDisabled) {
        toast({
          title: "Σφάλμα",
          description: validationResult?.message || "Δεν είναι δυνατή η υποβολή της φόρμας λόγω σφαλμάτων επικύρωσης",
          variant: "destructive"
        });
        return;
      }
      setLoading(true);

      if (!data.project_id) {
        toast({
          title: "Σφάλμα",
          description: "Πρέπει να επιλέξετε έργο",
          variant: "destructive"
        });
        return;
      }

      if (!data.recipients?.length) {
        toast({
          title: "Σφάλμα",
          description: "Απαιτείται τουλάχιστον ένας παραλήπτης",
          variant: "destructive"
        });
        return;
      }

      const invalidRecipients = data.recipients.some(r =>
        !r.firstname || !r.lastname || !r.afm || typeof r.amount !== 'number' || !r.installment
      );

      if (invalidRecipients) {
        toast({
          title: "Σφάλμα",
          description: "Όλα τα πεδία παραλήπτη πρέπει να συμπληρωθούν",
          variant: "destructive"
        });
        return;
      }

      const totalAmount = data.recipients.reduce((sum, r) => sum + r.amount, 0);

      const budgetUpdateResponse = await supabase
        .from('budget_na853_split')
        .update({
          user_view: budgetData ? budgetData.current_budget - totalAmount : 0
        })
        .eq('mis', data.project_id)
        .select();

      if (budgetUpdateResponse.error) {
        console.error('Budget update error:', budgetUpdateResponse.error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία ενημέρωσης προϋπολογισμού",
          variant: "destructive"
        });
        return;
      }

      const payload = {
        unit: data.unit,
        project_id: data.project_id,
        expenditure_type: data.expenditure_type,
        recipients: data.recipients.map(r => ({
          firstname: r.firstname.trim(),
          lastname: r.lastname.trim(),
          afm: r.afm.trim(),
          amount: parseFloat(r.amount.toString()),
          installment: parseInt(r.installment.toString())
        })),
        total_amount: totalAmount,
        status: "draft",
        attachments: data.selectedAttachments || []
      };

      const response = await apiRequest<{ id: string }>('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response || !response.id) {
        throw new Error('Failed to create document: Invalid response');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["budget"] }),
        queryClient.invalidateQueries({ queryKey: ["budget", data.project_id] }),
        queryClient.invalidateQueries({
          queryKey: ["budget-validation", data.project_id, totalAmount]
        })
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["budget", data.project_id] }),
        queryClient.refetchQueries({ queryKey: ["budget-validation", data.project_id, totalAmount] })
      ]);

      toast({
        title: "Επιτυχία",
        description: "Το έγγραφο δημιουργήθηκε επιτυχώς",
      });

      form.reset();
      setCurrentStep(0);
      onClose();
    } catch (error) {
      console.error('Document creation error:', error);

      let errorMessage = "Αποτυχία δημιουργίας εγγράφου";

      if (error instanceof Error) {
        errorMessage = error.message;

        if (error.message.includes('HTTP') && 'cause' in error) {
          try {
            const responseData = await (error.cause as Response).json();
            if (responseData && responseData.message) {
              errorMessage = responseData.message;
            }
            if (responseData && responseData.error) {
              errorMessage += `: ${responseData.error}`;
            }
          } catch (e) {
            console.error('Σφάλμα ανάλυσης απάντησης σφάλματος:', e);
          }
        }
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }

      toast({
        title: "Σφάλμα",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = () => {
    const currentRecipients = form.watch("recipients") || [];
    if (currentRecipients.length >= 10) {
      toast({
        title: "Μέγιστος Αριθμός Παραληπτών",
        description: "Δεν μπορείτε να προσθέσετε περισσότερους από 10 παραλήπτες.",
        variant: "destructive"
      });
      return;
    }

    form.setValue("recipients", [
      ...currentRecipients,
      { firstname: "", lastname: "", afm: "", amount: 0, installment: 1 }
    ]);
  };

  const removeRecipient = (index: number) => {
    const currentRecipients = form.watch("recipients") || [];
    form.setValue("recipients", currentRecipients.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (selectedUnit) {
      form.setValue("project_id", "");
      form.setValue("expenditure_type", "");
    }
  }, [selectedUnit, form]);

  useEffect(() => {
    if (selectedProjectId) {
      form.setValue("expenditure_type", "");
    }
  }, [selectedProjectId, form]);

  const handleNext = async () => {
    try {
      let fieldsToValidate: Array<keyof CreateDocumentForm> = [];

      form.clearErrors();

      switch (currentStep) {
        case 0:
          fieldsToValidate = ["unit"];
          break;
        case 1:
          fieldsToValidate = ["project_id", "expenditure_type"];
          break;
        case 2:
          fieldsToValidate = ["recipients"];
          const recipients = form.getValues("recipients");

          if (!recipients || recipients.length === 0) {
            toast({
              title: "Σφάλμα Επικύρωσης",
              description: "Παρακαλώ προσθέστε τουλάχιστον έναν παραλήπτη",
              variant: "destructive"
            });
            return;
          }

          const invalidRecipient = recipients.find(r =>
            !r.firstname?.trim() ||
            !r.lastname?.trim() ||
            !r.afm?.trim() ||
            typeof r.amount !== 'number' ||
            !r.amount ||
            !r.installment
          );

          if (invalidRecipient) {
            toast({
              title: "Σφάλμα Επικύρωσης",
              description: "Παρακαλώ συμπληρώστε όλα τα πεδία για κάθε παραλήπτη",
              variant: "destructive"
            });
            return;
          }
          break;
        case 3:
          break;
      }

      const isValid = await form.trigger(fieldsToValidate);

      if (isValid) {
        setDirection(1);
        setCurrentStep((prev) => Math.min(prev + 1, 3));
      } else {
        const errors = form.formState.errors;
        const errorFields = Object.keys(errors);
        const errorMessage = errorFields.length > 0
          ? `Παρακαλώ ελέγξτε τα πεδία: ${errorFields.join(", ")}`
          : "Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία";

        toast({
          title: "Σφάλμα Επικύρωσης",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      toast({
        title: "Σφάλμα",
        description: "Προέκυψε σφάλμα κατά την μετάβαση στο επόμενο βήμα",
        variant: "destructive"
      });
    }
  };

  const handleNextOrSubmit = async () => {
    try {
      if (currentStep === 3) {
        const isValid = await form.trigger();
        if (isValid) {
          await form.handleSubmit(handleSubmit)();
        } else {
          toast({
            title: "Σφάλμα Επικύρωσης",
            description: "Παρακαλώ ελέγξτε ότι όλα τα πεδία είναι συμπληρωμένα σωστά",
            variant: "destructive"
          });
        }
      } else {
        await handleNext();
      }
    } catch (error) {
      console.error('Form navigation/submission error:', error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Προέκυψε σφάλμα",
        variant: "destructive"
      });
    }
  };

  const handlePrevious = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const renderStepContent = () => {
    return (
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
        >
          {currentStep === 0 && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Επιλογή Μονάδας</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={unitsLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Επιλέξτε μονάδα" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit: any) => (
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
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              {budgetData && (
                <BudgetIndicator
                  budgetData={budgetData}
                  currentAmount={currentAmount}
                />
              )}

              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Έργο</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedUnit || projectsLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Επιλέξτε έργο" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedProject && (
                  <FormField
                    control={form.control}
                    name="expenditure_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Τύπος Δαπάνης</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedProject?.expenditure_types?.length}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Επιλέξτε τύπο" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedProject?.expenditure_types?.map((type: string) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {budgetData && (
                <BudgetIndicator
                  budgetData={budgetData}
                  currentAmount={currentAmount}
                />
              )}

              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Παραλήπτες</h3>
                    <p className="text-sm text-muted-foreground">Προσθήκη έως 10 παραληπτών</p>
                  </div>
                  <Button
                    type="button"
                    onClick={addRecipient}
                    disabled={recipients.length >= 10}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Προσθήκη Παραλήπτη
                  </Button>
                </div>

                <ScrollArea className="h-[calc(60vh-200px)] w-full pr-4">
                  <div className="space-y-3">
                    {recipients.map((_, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start gap-4">
                          <span className="text-sm font-medium min-w-[24px] text-center mt-2">{index + 1}</span>
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                            <Input
                              {...form.register(`recipients.${index}.firstname`)}
                              placeholder="Όνομα"
                              className="md:col-span-1"
                            />
                            <Input
                              {...form.register(`recipients.${index}.lastname`)}
                              placeholder="Επώνυμο"
                              className="md:col-span-1"
                            />
                            <Input
                              {...form.register(`recipients.${index}.afm`)}
                              placeholder="ΑΦΜ"
                              maxLength={9}
                              className="md:col-span-1"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              {...form.register(`recipients.${index}.amount`, {
                                valueAsNumber: true,
                                min: 0.01
                              })}
                              placeholder="Ποσό"
                              className="md:col-span-2"
                            />
                            <div className="flex items-center gap-2 md:col-span-1">
                              <Input
                                type="number"
                                min={1}
                                max={12}
                                {...form.register(`recipients.${index}.installment`, {
                                  valueAsNumber: true,
                                  min: 1,
                                  max: 12
                                })}
                                placeholder="Δόση"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRecipient(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium">Συνημμένα Έγγραφα</h3>
                  <p className="text-sm text-muted-foreground">Επιλέξτε τα απαιτούμενα έγγραφα</p>
                </div>
              </div>

              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={attachment.id}
                      checked={form.watch('selectedAttachments')?.includes(attachment.id)}
                      onCheckedChange={(checked) => {
                        const current = form.watch('selectedAttachments') || [];
                        if (checked) {
                          form.setValue('selectedAttachments', [...current, attachment.id]);
                        } else {
                          form.setValue('selectedAttachments', current.filter(id => id !== attachment.id));
                        }
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={attachment.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {attachment.title}
                      </label>
                      <p className="text-sm text-muted-foreground">
                        {attachment.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-6 gap-6">
        <DialogHeader>
          <DialogTitle>Δημιουργία Εγγράφου</DialogTitle>
          <DialogDescription>
            Συμπληρώστε τα απαραίτητα στοιχεία για τη δημιουργία του εγγράφου.
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={currentStep} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col gap-6">
            <ScrollArea className="flex-1" style={{ height: 'calc(70vh - 220px)' }}>
              <div className="pr-4 space-y-6">
                {currentStep === 2 && budgetData && (
                  <BudgetIndicator
                    budgetData={budgetData}
                    currentAmount={currentAmount}
                  />
                )}

                {currentStep === 0 && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Επιλογή Μονάδας</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={unitsLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Επιλέξτε μονάδα" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {units.map((unit: any) => (
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
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-6">
                    {budgetData && (
                      <BudgetIndicator
                        budgetData={budgetData}
                        currentAmount={currentAmount}
                      />
                    )}

                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="project_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Έργο</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={!selectedUnit || projectsLoading}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Επιλέξτε έργο" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedProject && (
                        <FormField
                          control={form.control}
                          name="expenditure_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Τύπος Δαπάνης</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={!selectedProject?.expenditure_types?.length}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε τύπο" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {selectedProject?.expenditure_types?.map((type: string) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium">Παραλήπτες</h3>
                        <p className="text-sm text-muted-foreground">Προσθήκη έως 10 παραληπτών</p>
                      </div>
                      <Button
                        type="button"
                        onClick={addRecipient}
                        disabled={recipients.length >= 10}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Παραλήπτη
                      </Button>
                    </div>

                    <ScrollArea className="h-[calc(60vh-200px)] w-full pr-4">
                      <div className="space-y-4">
                        {recipients.map((_, index) => (
                          <Card key={index} className="p-4">
                            <div className="flex items-start gap-4">
                              <span className="text-sm font-medium min-w-[24px] text-center mt-2">
                                {index + 1}
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                                <Input
                                  {...form.register(`recipients.${index}.firstname`)}
                                  placeholder="Όνομα"
                                  className="md:col-span-1"
                                />
                                <Input
                                  {...form.register(`recipients.${index}.lastname`)}
                                  placeholder="Επώνυμο"
                                  className="md:col-span-1"
                                />
                                <Input
                                  {...form.register(`recipients.${index}.afm`)}
                                  placeholder="ΑΦΜ"
                                  maxLength={9}
                                  className="md:col-span-1"
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`recipients.${index}.amount`, {
                                    valueAsNumber: true,
                                    min: 0.01
                                  })}
                                  placeholder="Ποσό"
                                  className="md:col-span-2"
                                />
                                <div className="flex items-center gap-2 md:col-span-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={12}
                                    {...form.register(`recipients.${index}.installment`, {
                                      valueAsNumber: true,
                                      min: 1,
                                      max: 12
                                    })}
                                    placeholder="Δόση"
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeRecipient(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Συνημμένα Έγγραφα</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {attachments.map((attachment) => (
                          <Card key={attachment.id} className="p-4">
                            <FormField
                              control={form.control}
                              name="selectedAttachments"
                              render={({ field }) => (
                                <FormItem className="flex items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(attachment.id)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const newValue = checked
                                          ? [...current, attachment.id]
                                          : current.filter((id) => id !== attachment.id);
                                        field.onChange(newValue);
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium">{attachment.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {attachment.description}
                                    </div>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0 || loading}
              >
                Προηγούμενο
              </Button>
              <Button
                type="button"
                onClick={handleNextOrSubmit}
                disabled={loading || (currentStep === 3 && isSubmitDisabled)}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Επεξεργασία...</span>
                  </div>
                ) : currentStep === 3 ? (
                  'Αποθήκευση'
                ) : (
                  'Επόμενο'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}