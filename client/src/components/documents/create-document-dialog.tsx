import * as React from "react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
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
import type { BudgetValidationResponse } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, ChevronDown, FileText, Plus, Search, Trash2, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnimatePresence, motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";

// Constants
const DKA_TYPES = ['ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ', 'ΔΚΑ ΕΠΙΣΚΕΥΗ', 'ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ'];
const DKA_INSTALLMENTS = ['Α', 'Β', 'Γ', 'Δ'];
const ALL_INSTALLMENTS = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ'];

// Project selection component
interface Project {
  id: string;
  mis?: string;
  name: string;
  expenditure_types: string[];
}

interface ProjectSelectProps {
  value?: string;
  onChange: (value: string) => void;
  projects: Project[];
  disabled?: boolean;
}

function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

const ProjectSelect = React.forwardRef<HTMLButtonElement, ProjectSelectProps>(
  function ProjectSelect(props, ref) {
    const { value, onChange, projects, disabled } = props;
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const commandRef = useRef<HTMLDivElement>(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const selectedProject = projects.find(project => project.id === value);

    const normalizeText = useCallback((text: string) => {
      return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .trim();
    }, []);

    const extractNA853Info = useCallback((name: string) => {
      // Look for patterns like 2024ΝΑ85300016 or 2024NA85300016
      const match = name.match(/\d{4}(?:NA|ΝΑ)853\d+/i);
      if (!match) return null;
      const code = match[0];
      const parts = name.split(' - ');
      return {
        full: code,
        displayText: parts.slice(1).join(' - '), // Everything after the NA853 code
        numbers: code.replace(/\D/g, ''), // Extract all numbers from the code
        originalMatch: match
      };
    }, []);

    const filteredProjects = useMemo(() => {
      setIsSearching(true);
      setError(null);

      try {
        if (!debouncedSearchQuery.trim()) {
          return projects;
        }

        const searchTerm = normalizeText(debouncedSearchQuery);
        const isNumericSearch = /^\d+$/.test(searchTerm);

        console.log('Search debug:', {
          searchTerm,
          isNumericSearch,
          projectCount: projects.length
        });

        const results = projects.filter(project => {
          const normalizedProjectName = normalizeText(project.name);
          const na853Match = project.id.toLowerCase().includes(searchTerm.toLowerCase());

          // For numeric searches, match NA853 code
          if (isNumericSearch) {
            console.log('Numeric search:', {
              projectName: project.name,
              projectId: project.id,
              searchTerm,
              matches: project.id.includes(searchTerm)
            });
            if (project.id.includes(searchTerm)) {
              return true;
            }
          }

          return na853Match || normalizedProjectName.includes(searchTerm);
        });

        console.log('Search results:', {
          searchTerm,
          resultCount: results.length,
          results: results.map(r => r.name)
        });

        if (results.length === 0) {
          setError(`Δεν βρέθηκαν έργα που να ταιριάζουν με "${debouncedSearchQuery}"`);
        }

        return results;
      } catch (error) {
        console.error('Search error:', error);
        setError('Σφάλμα κατά την αναζήτηση');
        return projects;
      } finally {
        setIsSearching(false);
      }
    }, [projects, debouncedSearchQuery, normalizeText]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
      // Reset search query when selection changes
      if (selectedProject && !isFocused) {
        const na853Info = extractNA853Info(selectedProject.name);
        const displayText = na853Info ?
          `${na853Info.full} - ${na853Info.displayText}` :
          selectedProject.name;
        setSearchQuery(displayText);
      }
    }, [selectedProject, isFocused, extractNA853Info]);

    const handleFocus = () => {
      setIsFocused(true);
      setSearchQuery('');
    };

    const handleBlur = () => {
      setTimeout(() => {
        if (selectedProject && !searchQuery.trim()) {
          const na853Info = extractNA853Info(selectedProject.name);
          const displayText = na853Info ?
            `${na853Info.full} - ${na853Info.displayText}` :
            selectedProject.name;
          setSearchQuery(displayText);
        }
        setIsFocused(false);
      }, 200);
    };

    return (
      <div className="relative w-full">
        <Command className="relative rounded-lg border shadow-md w-full overflow-visible" ref={commandRef}>
          <div className="flex items-center px-4 py-3 gap-3 bg-background w-full">
            <Search className="h-5 w-5 shrink-0 opacity-50" />
            <CommandInput
              ref={inputRef}
              value={searchQuery}
              onValueChange={setSearchQuery}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Αναζήτηση με NA853 ή όνομα έργου... (Ctrl + /)"
              className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground focus:ring-0 h-auto py-1 w-full"
            />
            {isSearching && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            )}
            <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>

          {isFocused && (
            <>
              {error ? (
                <div className="p-4 text-center">
                  <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-6 text-center text-sm">
                    Δεν βρέθηκαν έργα
                  </CommandEmpty>

                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                    {filteredProjects.map((project) => {
                      const na853Info = extractNA853Info(project.name);
                      const displayName = na853Info ? na853Info.displayText : project.name;
                      return (
                        <CommandItem
                          key={project.id}
                          value={project.id}
                          onSelect={(value) => {
                            onChange(value);
                            setIsFocused(false);
                          }}
                          className={cn(
                            "cursor-pointer py-3 px-4 hover:bg-accent",
                            project.id === value && "bg-accent"
                          )}
                        >
                          <div className="flex flex-col gap-1 w-full">
                            <Badge variant="outline" className="text-xs w-fit mb-1">
                              {na853Info?.full || project.id}
                            </Badge>
                            <span className="text-sm">
                              {displayName}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </Command>
      </div>
    );
  }
);

ProjectSelect.displayName = "ProjectSelect";

// Interfaces
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

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

// Animation variants
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

// Step Indicator Component
const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { title: "Επιλογή Μονάδας", icon: <User className="h-4 w-4" /> },
    { title: "Στοιχεία Έργου", icon: <FileText className="h-4 w-4" /> },
    { title: "Δικαιούχοι", icon: <User className="h-4 w-4" /> },
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
            <ChevronDown className={`mx-2 h-4 w-4 rotate-[-90deg] ${
              index < currentStep ? 'text-primary' : 'text-muted-foreground'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

// Budget Indicator Component
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

// Schemas
const recipientSchema = z.object({
  firstname: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  lastname: z.string().min(2, "Το επώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  fathername: z.string().min(2, "Το πατρώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  afm: z.string().length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία"),
  amount: z.number().min(0.01, "Το ποσό πρέπει να είναι μεγαλύτερο από 0"),
  installment: z.string().optional(),
});

const createDocumentSchema = z.object({
  unit: z.string().min(1, "Η μονάδα είναι υποχρεωτική"),
  project_id: z.string().min(1, "Το έργο είναι υποχρεωτικό"),
  region: z.string().optional(),
  expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
  recipients: z.array(recipientSchema).optional().default([]),
  total_amount: z.number().optional(),
  status: z.string().default("draft"),
  selectedAttachments: z.array(z.string()).optional().default([])
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

// Main component
export function CreateDocumentDialog({ open, onOpenChange, onClose }: CreateDocumentDialogProps) {
  // Reference to programmatically close the dialog
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const dialogCloseRef = React.useRef<HTMLButtonElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();


  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      unit: "",
      project_id: "",
      region: "",
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

  // Add this function to get available installments based on expenditure type
  const getAvailableInstallments = (expenditureType: string) => {
    return DKA_TYPES.includes(expenditureType) ? DKA_INSTALLMENTS : ALL_INSTALLMENTS;
  };

  // Update the recipients section rendering
  const renderRecipientInstallments = (index: number) => {
    const expenditureType = form.watch('expenditure_type');
    const availableInstallments = getAvailableInstallments(expenditureType);

    return (
      <Select
        value={form.watch(`recipients.${index}.installment`)}
        onValueChange={(value) => form.setValue(`recipients.${index}.installment`, value)}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Δόση" className="placeholder:text-muted-foreground" />
        </SelectTrigger>
        <SelectContent>
          {availableInstallments.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // Queries
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/users/units');
        
        if (!response || !Array.isArray(response)) {
          console.error('Error fetching units: Invalid response format');
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive"
          });
          return [];
        }
        
        return response.map((item: any) => ({
          id: item.unit || item.id,
          name: item.unit_name || item.name
        }));
      } catch (error) {
        console.error('Units fetch error:', error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης μονάδων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive"
        });
        return [];
      }
    },
    retry: 2
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];

      try {
        console.log(`[Projects] Fetching projects for unit: ${selectedUnit}`);
        const response = await apiRequest(`/api/projects/by-unit/${encodeURIComponent(selectedUnit)}`);
        
        if (!response) {
          console.error('[Projects] Error fetching projects: No response received');
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive"
          });
          return [];
        }
        
        // Handle empty array response
        if (Array.isArray(response) && response.length === 0) {
          console.log(`[Projects] No projects found for unit: ${selectedUnit}`);
          toast({
            title: "Πληροφορία",
            description: "Δεν βρέθηκαν έργα για την επιλεγμένη μονάδα.",
            variant: "default"
          });
          return [];
        }
        
        // Handle non-array response
        if (!Array.isArray(response)) {
          console.error('[Projects] Error fetching projects: Invalid response format', response);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης έργων. Μη έγκυρη μορφή απάντησης.",
            variant: "destructive"
          });
          return [];
        }
        
        console.log(`[Projects] Found ${response.length} projects for unit: ${selectedUnit}`);
        
        // Map and transform the projects data
        return response.map((item: any) => {
          // Process expenditure types
          let expenditureTypes: string[] = [];
          if (item.expenditure_type) {
            try {
              if (typeof item.expenditure_type === 'string') {
                expenditureTypes = JSON.parse(item.expenditure_type);
              } else if (Array.isArray(item.expenditure_type)) {
                expenditureTypes = item.expenditure_type;
              }
            } catch (e) {
              console.error('[Projects] Error parsing expenditure_type for project:', item.mis, e);
            }
          }

          // Store both MIS and NA853 for proper querying
          const projectId = item.na853 || String(item.mis);
          const name = item.na853 ?
            `${item.na853} - ${item.event_description || item.project_title || 'No description'}` :
            item.event_description || item.project_title || 'No description';

          return {
            id: projectId,
            mis: String(item.mis), // Store MIS separately
            name,
            expenditure_types: expenditureTypes || []
          };
        });
      } catch (error) {
        console.error('[Projects] Projects fetch error:', error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive"
        });
        return [];
      }
    },
    enabled: Boolean(selectedUnit)
  });


  const { data: budgetData, error: budgetError } = useQuery({
    queryKey: ["budget", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;

      try {
        // Find the project to get its MIS
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project || !project.mis) {
          console.error('[Budget] Project or MIS not found:', selectedProjectId);
          return null;
        }

        console.log('[Budget] Fetching budget data for project:', {
          id: selectedProjectId,
          mis: project.mis
        });

        const response = await apiRequest(`/api/budget/${encodeURIComponent(project.mis)}`);
        
        if (!response) {
          console.log('[Budget] No budget data found for project MIS:', project.mis);
          return {
            current_budget: 0,
            total_budget: 0,
            annual_budget: 0,
            katanomes_etous: 0
          };
        }
        
        return {
          current_budget: parseFloat(response.user_view?.toString() || '0'),
          total_budget: parseFloat(response.proip?.toString() || '0'),
          annual_budget: parseFloat(response.ethsia_pistosi?.toString() || '0'),
          katanomes_etous: parseFloat(response.katanomes_etous?.toString() || '0')
        };
      } catch (error) {
        console.error('[Budget] Error fetching budget data:', error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης δεδομένων προϋπολογισμού",
          variant: "destructive"
        });
        return {
          current_budget: 0,
          total_budget: 0,
          annual_budget: 0,
          katanomes_etous: 0
        };
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

        const response = await apiRequest(`/api/attachments/${expenditureType}/${installment}`);
        
        if (!response || !Array.isArray(response)) {
          return [];
        }

        return response.reduce((acc: any[], row) => {
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
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης συνημμένων",
          variant: "destructive"
        });
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
      console.log('Starting form submission with data:', data);

      // Basic form validation
      if (!data.project_id) {
        throw new Error("Πρέπει να επιλέξετε έργο");
      }

      if (!data.recipients?.length) {
        throw new Error("Απαιτείται τουλάχιστον ένας δικαιούχος");
      }

      const invalidRecipients = data.recipients.some(r =>
        !r.firstname || !r.lastname || !r.afm || typeof r.amount !== 'number' || !r.installment
      );

      if (invalidRecipients) {
        throw new Error("Όλα τα πεδία δικαιούχου πρέπει να συμπληρωθούν");
      }

      setLoading(true);

      // Find project to get MIS
      const projectForSubmission = projects.find(p => p.id === data.project_id);
      if (!projectForSubmission?.mis) {
        throw new Error("Δεν βρέθηκε το MIS του έργου");
      }

      console.log('Found project for submission:', {
        id: projectForSubmission.id,
        mis: projectForSubmission.mis
      });

      const totalAmount = data.recipients.reduce((sum, r) => sum + r.amount, 0);

      // Validate budget
      const budgetValidation = await apiRequest<BudgetValidationResponse>('/api/budget/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mis: projectForSubmission.mis, // Use MIS instead of NA853
          amount: totalAmount.toString()
        })
      });

      if (!budgetValidation.canCreate) {
        throw new Error(budgetValidation.message || "Δεν είναι δυνατή η δημιουργία εγγράφου λόγω περιορισμών προϋπολογισμού");
      }

      // Update budget using project MIS
      const budgetUpdateResponse = await apiRequest(`/api/budget/${encodeURIComponent(projectForSubmission.mis)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: totalAmount.toString()
        })
      });

      if (!budgetUpdateResponse || budgetUpdateResponse.error) {
        throw new Error(`Σφάλμα ενημέρωσης προϋπολογισμού: ${
          budgetUpdateResponse?.error?.message || 'Αποτυχία επικοινωνίας με τον διακομιστή'
        }`);
      }

      // Prepare payload with project MIS
      const payload = {
        unit: data.unit,
        project_id: data.project_id,
        project_mis: projectForSubmission.mis,
        region: data.region,
        expenditure_type: data.expenditure_type,
        recipients: data.recipients.map(r => ({
          firstname: r.firstname.trim(),
          lastname: r.lastname.trim(),
          fathername: r.fathername.trim(),
          afm: r.afm.trim(),
          amount: parseFloat(r.amount.toString()),
          installment: r.installment
        })),
        total_amount: totalAmount,
        status: "draft",
        attachments: data.selectedAttachments || []
      };

      console.log('Sending payload to create document:', payload);

      // Try testing the route with our test endpoint first
      console.log('[DEBUG] Testing route access with test endpoint');
      try {
        const testResponse = await apiRequest('/api/test-route', {
          method: 'GET'
        });
        console.log('[DEBUG] Test route response:', testResponse);
      } catch (testError) {
        console.error('[DEBUG] Test route failed:', testError);
      }
      
      // Attempt document creation with v2 API endpoint
      console.log('[DEBUG] Creating document with API');
      try {
        // Prepare enhanced payload with project MIS
        const enhancedPayload = {
          ...payload,
          project_mis: projectForSubmission.mis, // Ensure we always pass project_mis
        };
        
        console.log('[DEBUG] Sending payload to API:', enhancedPayload);
        
        // Use the v2-documents endpoint which handles document creation with proper error handling
        const response = await apiRequest('/api/v2-documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(enhancedPayload)
        });
        
        console.log('[DEBUG] API response:', response);
        
        if (!response || !response.id) {
          throw new Error('Σφάλμα δημιουργίας εγγράφου: Μη έγκυρη απάντηση από τον διακομιστή');
        }
        
        console.log('[DEBUG] Document created successfully with ID:', response.id);
        return response;
      } catch (error) {
        console.error('[DEBUG] Document creation failed:', error);
        throw new Error(error instanceof Error ? error.message : 'Αποτυχία δημιουργίας εγγράφου. Παρακαλώ προσπαθήστε ξανά αργότερα.');
      }

      // Response validation is already performed in the document creation try-catch block above

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["budget"] }),
        queryClient.invalidateQueries({ queryKey: ["budget", data.project_id] }),
        queryClient.invalidateQueries({
          queryKey: ["budget-validation", projectForSubmission.mis, totalAmount]
        })
      ]);

      toast({
        title: "Επιτυχία",
        description: "Το έγγραφο δημιουργήθηκε επιτυχώς"
      });

      form.reset();
      setCurrentStep(0);
      
      // Close the dialog using all available methods to ensure it closes
      if (dialogCloseRef.current) {
        // Force close using the ref (most direct method)
        console.log('Forcing dialog close with ref click');
        dialogCloseRef.current.click();
      }
      
      // Also use the provided callback methods as backup
      onClose();
      onOpenChange(false);
      
      // Schedule another attempt after a small delay
      setTimeout(() => {
        if (dialogCloseRef.current) {
          dialogCloseRef.current.click();
        }
        onOpenChange(false);
      }, 100);
    } catch (error) {
      console.error('Document creation error:', error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία δημιουργίας εγγράφου",
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
        title: "Μέγιστος Αριθμός Δικαιούχων",
        description: "Δεν μπορείτε να προσθέσετε περισσότερους από 10 δικαιούχους.",
        variant: "destructive"
      });
      return;
    }

    form.setValue("recipients", [
      ...currentRecipients,
      {
        firstname: "",
        lastname: "",
        fathername: "",
        afm: "",
        amount: 0,
        installment: ""
      }
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
      form.setValue("region", "");
    }
  }, [selectedUnit, form]);

  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        form.setValue('expenditure_type', '');
      }
    }
  }, [selectedProjectId, projects, form]);

  useEffect(() => {
    // Auto-select unit based on available options
    if (units?.length === 1) {
      // If only one unit option exists, select it automatically
      form.setValue("unit", units[0].id);
    } else if (user?.units?.length === 1 && units?.length > 0) {
      // If user has only one assigned unit, find its matching unit object and select it
      const matchingUnit = units.find(unit => unit.id === user.units[0]);
      if (matchingUnit) {
        form.setValue("unit", matchingUnit.id);
      }
    }
  }, [units, user?.units, form]);

  const { data: regions = [], isLoading: regionsLoading } = useQuery({
    queryKey: ["regions", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];

      try {
        // Find the project to get its MIS
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) {
          console.error('[Regions] Project not found:', selectedProjectId);
          return [];
        }

        console.log('[Regions] Fetching regions for project:', {
          id: selectedProjectId,
          mis: project.mis
        });

        const response = await apiRequest(`/api/projects/${encodeURIComponent(project.mis)}/regions`);
        
        if (!response || (!response.regional_unit && !response.region)) {
          console.log('[Regions] No regions found for project:', project.mis);
          return [];
        }

        if (response.regional_unit && Array.isArray(response.regional_unit) && response.regional_unit.length > 0) {
          console.log('[Regions] Using regional_unit data:', response.regional_unit);
          return response.regional_unit.map((unit: string) => ({
            id: unit,
            name: unit,
            type: 'regional_unit'
          }));
        }

        if (response.region && Array.isArray(response.region) && response.region.length > 0) {
          console.log('[Regions] Falling back to region data:', response.region);
          return response.region.map((region: string) => ({
            id: region,
            name: region,
            type: 'region'
          }));
        }

        console.log('[Regions] No valid region or regional_unit data found');
        return [];
      } catch (error) {
        console.error('[Regions] Error fetching regions:', error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης περιοχών",
          variant: "destructive"
        });
        return [];
      }
    },
    enabled: Boolean(selectedProjectId) && projects.length > 0
  });

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
              description: "Παρακαλώ προσθέστε τουλάχιστον έναν δικαιούχο",
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
              description: "Παρακαλώ συμπληρώστε όλα τα πεδία για κάθε δικαιούχο",
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
        title: "Σφάλμα", description: "Προέκυψε σφάλμα κατά την μετάβαση στο επόμενο βήμα",
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
      <div className="space-y-6">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="space-y-4"
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
                        disabled={unitsLoading || user?.units?.length === 1}
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Έργο</FormLabel>
                        <ProjectSelect
                          value={field.value}
                          onChange={field.onChange}
                          projects={projects}
                          disabled={!selectedUnit || projectsLoading}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {regions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {regions[0]?.type === 'regional_unit' ? 'Περιφερειακή Ενότητα' : 'Περιφέρεια'}
                      </label>
                      <Select
                        value={form.watch("region")}
                        onValueChange={(value) => form.setValue("region", value)}
                        disabled={regions.length === 1 || regionsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            regions[0]?.type === 'regional_unit' ?
                              'Επιλέξτε Περιφερειακή Ενότητα' :
                              'Επιλέξτε Περιφέρεια'
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((region) => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {currentStep === 1 && selectedProject && (
                    <FormField
                      control={form.control}
                      name="expenditure_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Τύπος Δαπάνης</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedProjectId}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Επιλέξτε τύπο δαπάνης" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedProject?.expenditure_types?.length > 0 ? (
                                selectedProject.expenditure_types.map((type: string) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem key="no-expenditure-types" value="" disabled>
                                  Δεν υπάρχουν διαθέσιμοι τύποι δαπάνης
                                </SelectItem>
                              )}
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
                      <h3 className="text-lg font-medium">Δικαιούχοι</h3>
                      <p className="text-sm text-muted-foreground">Προσθήκη έως 10 δικαιούχων</p>
                    </div>
                    <Button
                      type="button"
                      onClick={addRecipient}
                      disabled={recipients.length >= 10 || loading}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Προσθήκη Δικαιούχου
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {recipients.map((recipient, index) => (
                      <Card key={index} className="p-4 relative">
                        <div className="flex items-start gap-4">
                          <span className="text-sm font-medium min-w-[24px] text-center mt-2">{index + 1}</span>
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                            <Input
                              {...form.register(`recipients.${index}.firstname`)}
                              placeholder="Όνομα"
                              className="md:col-span-1"
                              autoComplete="off"
                            />
                            <Input
                              {...form.register(`recipients.${index}.lastname`)}
                              placeholder="Επώνυμο"
                              className="md:col-span-1"
                              autoComplete="off"
                            />
                            <Input
                              {...form.register(`recipients.${index}.fathername`)}
                              placeholder="Πατρώνυμο"
                              className="md:col-span-1"
                              autoComplete="off"
                            />
                            <Input
                              {...form.register(`recipients.${index}.afm`)}
                              placeholder="ΑΦΜ"
                              maxLength={9}
                              className="md:col-span-1"
                              autoComplete="off"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              {...form.register(`recipients.${index}.amount`, {
                                valueAsNumber: true,
                                min: 0.01
                              })}
                              placeholder="Ποσό"
                              className="md:col-span-1"
                              autoComplete="off"
                              defaultValue=""
                            />
                            <div className="md:col-span-1 flex items-center gap-2">
                              {renderRecipientInstallments(index)}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRecipient(index)}
                                className="shrink-0"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Συνημμένα Έγγραφα</h3>
                  {attachmentsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <FileText className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center space-x-2 rounded-lg border p-3"
                        >
                          <Checkbox
                            checked={form.watch("selectedAttachments")?.includes(attachment.id)}
                            onCheckedChange={(checked) => {
                              const current = form.watch("selectedAttachments") || [];
                              if (checked) {
                                form.setValue("selectedAttachments", [...current, attachment.id]);
                              } else {
                                form.setValue(
                                  "selectedAttachments",
                                  current.filter((id) => id !== attachment.id)
                                );
                              }
                            }}
                          />
                          <span>{attachment.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4" />
                      <p>Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης</p>
                    </div>
                  )}
                </div>

                {/* Navigation buttons for final step */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={loading}
                  >
                    Προηγούμενο
                  </Button>
                  <Button
                    type="button"
                    onClick={() => form.handleSubmit(handleSubmit)()}
                    disabled={loading || !form.formState.isValid}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                        <span>Αποθήκευση...</span>
                      </>
                    ) : (
                      'Αποθήκευση'
                    )}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons for non-final steps */}
        {currentStep < 3 && (
          <div className="flex justify-end gap-2 pt-4">
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
              onClick={handleNext}
              disabled={loading}
            >
              Επόμενο
            </Button>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (user?.units?.length === 1) {
      form.setValue("unit", user.units[0]);
    }
  }, [user?.units, form]);

  useEffect(() => {
    if (regions.length === 1) {
      form.setValue("region", regions[0].id);
    }
  }, [regions, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Δημιουργία Εγγράφου</DialogTitle>
        </DialogHeader>
        <StepIndicator currentStep={currentStep} />
        <Form {...form}>
          <div className="space-y-6">
            {renderStepContent()}
          </div>
        </Form>
        {/* Hidden close button with ref for programmatic closing */}
        <DialogClose ref={dialogCloseRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}