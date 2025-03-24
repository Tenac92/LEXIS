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
import { AlertCircle, Check, ChevronDown, FileText, FileX, Plus, Search, Trash2, User } from "lucide-react";
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
        
        // Force response to be an array
        let projectsArray: any[] = [];
        
        if (!response) {
          console.error('[Projects] Error fetching projects: No response received');
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
            variant: "destructive"
          });
          return [];
        }
        
        // Determine if we have a valid response
        if (Array.isArray(response)) {
          projectsArray = response;
        } else if (response && typeof response === 'object' && response.data && Array.isArray(response.data)) {
          // Handle wrapped API response {data: [...]}
          projectsArray = response.data;
        } else {
          console.error('[Projects] Error fetching projects: Invalid response format', response);
          toast({
            title: "Σφάλμα", 
            description: "Αποτυχία φόρτωσης έργων. Μη έγκυρη μορφή απάντησης.",
            variant: "destructive"
          });
          return [];
        }
        
        // Handle empty array case
        if (projectsArray.length === 0) {
          console.log(`[Projects] No projects found for unit: ${selectedUnit}`);
          toast({
            title: "Πληροφορία",
            description: "Δεν βρέθηκαν έργα για την επιλεγμένη μονάδα.",
            variant: "destructive"
          });
          return [];
        }
        
        console.log(`[Projects] Found ${projectsArray.length} projects for unit: ${selectedUnit}`);
        
        // Map and transform the projects data
        return projectsArray.map((item: any) => {
          if (!item) return null;
          
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
        }).filter(Boolean); // Remove any null values
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


  const { data: budgetData, error: budgetError } = useQuery<BudgetData>({
    queryKey: ["budget", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) {
        // Return empty but valid budget data structure
        return {
          user_view: 0,
          total_budget: 0,
          ethsia_pistosi: 0,
          katanomes_etous: 0,
          proip: 0,
          current_budget: 0,
          annual_budget: 0,
          quarterly: { q1: 0, q2: 0, q3: 0, q4: 0 }
        };
      }

      try {
        // Find the project to get its MIS
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project || !project.mis) {
          console.error('[Budget] Project or MIS not found:', selectedProjectId);
          throw new Error('Project MIS not found');
        }

        console.log('[Budget] Fetching budget data for project:', {
          id: selectedProjectId,
          mis: project.mis
        });

        const response = await apiRequest(`/api/budget/${encodeURIComponent(project.mis)}`);
        
        console.log('[Budget] Budget API response:', response);
        
        // Define a complete empty budget data structure
        const emptyBudget: BudgetData = {
          user_view: 0,
          total_budget: 0,
          ethsia_pistosi: 0,
          katanomes_etous: 0,
          proip: 0,
          current_budget: 0,
          annual_budget: 0,
          quarterly: { q1: 0, q2: 0, q3: 0, q4: 0 }
        };

        // Handle different response formats
        if (!response) {
          console.log('[Budget] No response received for project MIS:', project.mis);
          return emptyBudget;
        }
        
        // Handle error response
        if (typeof response === 'object' && 'status' in response && response.status === 'error') {
          console.log('[Budget] Error response for project MIS:', project.mis);
          return emptyBudget;
        }
        
        // Extract budget data from response
        let budgetData: Record<string, any> = {}; 
        
        if (typeof response === 'object' && 'data' in response && response.data) {
          // Response has a data property
          budgetData = response.data;
        } else if (typeof response === 'object' && !('data' in response)) {
          // Response is directly the budget data
          budgetData = response;
        }
        
        console.log('[Budget] Extracted budget data:', budgetData);
        
        // Map the response to match the BudgetData interface completely
        return {
          user_view: parseFloat(budgetData.user_view?.toString() || '0'),
          total_budget: parseFloat(budgetData.current_budget?.toString() || '0'), 
          ethsia_pistosi: parseFloat(budgetData.ethsia_pistosi?.toString() || '0'),
          katanomes_etous: parseFloat(budgetData.katanomes_etous?.toString() || '0'),
          proip: parseFloat(budgetData.current_budget?.toString() || '0'),
          current_budget: parseFloat(budgetData.current_budget?.toString() || '0'),
          annual_budget: parseFloat(budgetData.ethsia_pistosi?.toString() || '0'),
          quarterly: {
            q1: parseFloat(budgetData.q1?.toString() || '0'),
            q2: parseFloat(budgetData.q2?.toString() || '0'),
            q3: parseFloat(budgetData.q3?.toString() || '0'),
            q4: parseFloat(budgetData.q4?.toString() || '0')
          }
        };
      } catch (error) {
        console.error('[Budget] Error fetching budget data:', error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης δεδομένων προϋπολογισμού",
          variant: "destructive"
        });
        
        // Always return a valid budget data structure
        return {
          user_view: 0,
          total_budget: 0,
          ethsia_pistosi: 0,
          katanomes_etous: 0,
          proip: 0,
          current_budget: 0,
          annual_budget: 0,
          quarterly: { q1: 0, q2: 0, q3: 0, q4: 0 }
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

        console.log('[DEBUG] Making manual fetch request to /api/attachments/' + encodeURIComponent(expenditureType) + '/' + encodeURIComponent(installment));
        
        // Use direct fetch instead of apiRequest to prevent authentication issues
        const response = await fetch(`/api/attachments/${encodeURIComponent(expenditureType)}/${encodeURIComponent(installment)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
          },
          credentials: 'include'
        });
        
        // Handle authentication errors (401)
        if (response.status === 401) {
          console.warn('[DEBUG] Authentication required for attachments');
          // Return default attachments without redirecting to login
          return [
            {
              id: 'Διαβιβαστικό',
              title: 'Διαβιβαστικό',
              file_type: 'document',
              description: `Απαιτείται για ${expenditureType}`
            },
            {
              id: 'ΔΚΑ',
              title: 'ΔΚΑ',
              file_type: 'document',
              description: `Απαιτείται για ${expenditureType}`
            }
          ];
        }
        
        // Handle other errors
        if (!response.ok) {
          console.error('[DEBUG] Attachments request failed:', response.status);
          // Return default attachments for error scenarios
          return [
            {
              id: 'Διαβιβαστικό',
              title: 'Διαβιβαστικό',
              file_type: 'document',
              description: `Απαιτείται για ${expenditureType}`
            },
            {
              id: 'ΔΚΑ',
              title: 'ΔΚΑ',
              file_type: 'document',
              description: `Απαιτείται για ${expenditureType}`
            }
          ];
        }
        
        // Process successful response
        const data = await response.json();
        console.log('[Debug] Attachments API response:', data);
        
        if (!data) {
          return [
            {
              id: 'Διαβιβαστικό',
              title: 'Διαβιβαστικό',
              file_type: 'document',
              description: `Απαιτείται για ${expenditureType}`
            },
            {
              id: 'ΔΚΑ',
              title: 'ΔΚΑ',
              file_type: 'document',
              description: `Απαιτείται για ${expenditureType}`
            }
          ];
        }
        
        // Check if the response has a message about no attachments found
        if (data.status === 'success' && data.message && Array.isArray(data.attachments) && data.attachments.length === 0) {
          console.log('[Debug] No attachments found with message:', data.message);
          
          // Return a special "no attachments" entry that will be displayed differently in the UI
          return [{
            id: 'no-attachments',
            title: 'Δεν βρέθηκαν συνημμένα',
            file_type: 'none',
            description: data.message || 'Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.'
          }];
        }
        
        // Check if the response has attachments in the standard API format
        if (data.status === 'success' && Array.isArray(data.attachments) && data.attachments.length > 0) {
          console.log('[Debug] Found attachments in standard format:', data.attachments);
          
          // Convert each attachment title to our display format
          return data.attachments.map((title: string) => ({
            id: title, // Use the title as the ID for selection
            title,
            file_type: 'document',
            description: `Απαιτείται για ${expenditureType}`
          }));
        }
        
        // Fallback for legacy format or unexpected response format
        console.warn('[Debug] Attachments response is not in expected format:', data);
        
        // For safety, attempt to extract attachments from any response format
        let extractedAttachments: string[] = [];
        
        // Try to extract from data.attachments if it exists
        if (data.attachments && Array.isArray(data.attachments)) {
          extractedAttachments = data.attachments;
        } 
        // Try to extract from root array
        else if (Array.isArray(data)) {
          extractedAttachments = data;
        }
        
        if (extractedAttachments.length > 0) {
          return extractedAttachments.map((title: string) => ({
            id: title,
            title,
            file_type: 'document',
            description: `Απαιτείται για ${expenditureType}`
          }));
        }
        
        // If we couldn't extract anything, return a "no attachments" message
        return [{
          id: 'no-attachments-fallback',
          title: 'Δεν βρέθηκαν συνημμένα',
          file_type: 'none',
          description: 'Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης.'
        }];
      } catch (error) {
        console.error('Error fetching attachments:', error);
        // Return default attachments instead of showing error toast
        return [
          {
            id: 'Διαβιβαστικό',
            title: 'Διαβιβαστικό',
            file_type: 'document',
            description: `Απαιτείται για ${expenditureType}`
          },
          {
            id: 'ΔΚΑ',
            title: 'ΔΚΑ',
            file_type: 'document',
            description: `Απαιτείται για ${expenditureType}`
          }
        ];
      }
    },
    enabled: Boolean(form.watch('expenditure_type'))
  });

  const { data: validationResult } = useQuery<BudgetValidationResponse>({
    queryKey: ["budget-validation", selectedProjectId, currentAmount],
    queryFn: async () => {
      if (!selectedProjectId || currentAmount <= 0) {
        return { status: 'success', canCreate: true, allowDocx: true };
      }

      try {
        // Using fetch directly instead of apiRequest to avoid auto-redirect on 401
        console.log('[DEBUG] Making manual budget validation request');
        const response = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          },
          credentials: 'include',
          body: JSON.stringify({
            mis: selectedProjectId,
            amount: currentAmount.toString()
          })
        });
        
        if (response.status === 401) {
          console.warn('[Budget] Authentication required for budget validation');
          // Return fallback response without redirecting
          return { 
            status: 'warning', 
            canCreate: true,
            allowDocx: true,
            message: 'Συνδεθείτε ξανά για έλεγχο προϋπολογισμού. Προσωρινά επιτρέπεται η συνέχεια με προειδοποίηση.'
          };
        }
        
        if (!response.ok) {
          console.error('[Budget] Validation request failed:', response.status);
          // Return fallback response for other errors
          return { 
            status: 'warning', 
            canCreate: true,
            allowDocx: true,
            message: 'Αδυναμία ελέγχου προϋπολογισμού. Προειδοποίηση: Το ποσό ενδέχεται να υπερβαίνει τον διαθέσιμο προϋπολογισμό.'
          };
        }
        
        // Process successful response
        const data = await response.json();
        console.log('[Budget] Validation response:', data);
        
        if (data.status === 'warning' && data.message) {
          toast({
            title: "Προειδοποίηση",
            description: data.message,
            variant: "destructive"
          });
        }

        return data;
      } catch (error) {
        console.error('Budget validation error:', error);
        toast({
          title: "Σφάλμα",
          description: 'Αποτυχία επικύρωσης προϋπολογισμού',
          variant: "destructive"
        });
        return {
          status: 'warning',
          canCreate: true,
          allowDocx: true,
          message: 'Αποτυχία επικύρωσης προϋπολογισμού. Προσωρινά επιτρέπεται η συνέχεια.'
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

      // Validate budget with our own fetch to prevent auth redirects
      try {
        console.log('[DEBUG] Making manual budget validation request for submit');
        const budgetValidationResponse = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          },
          credentials: 'include',
          body: JSON.stringify({
            mis: projectForSubmission.mis,
            amount: totalAmount.toString()
          })
        });
        
        // Handle authorization issues gracefully
        if (budgetValidationResponse.status === 401) {
          console.warn('[DEBUG] Auth warning for budget validation during submit');
          toast({
            title: "Προειδοποίηση",
            description: "Απαιτείται επαναλογίνση για πλήρη έλεγχο προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive"
          });
        } 
        // Handle other errors gracefully
        else if (!budgetValidationResponse.ok) {
          console.error('[DEBUG] Budget validation failed:', budgetValidationResponse.status);
          toast({
            title: "Προειδοποίηση",
            description: "Αδυναμία ελέγχου προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive"
          });
        }
        // Process successful validation
        else {
          const budgetValidation = await budgetValidationResponse.json();
          
          if (!budgetValidation.canCreate) {
            throw new Error(budgetValidation.message || "Δεν είναι δυνατή η δημιουργία εγγράφου λόγω περιορισμών προϋπολογισμού");
          }
        }
      } catch (validationError) {
        console.error('[DEBUG] Budget validation error:', validationError);
        toast({
          title: "Προειδοποίηση",
          description: "Σφάλμα κατά τον έλεγχο προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
          variant: "destructive"
        });
      }

      // Update budget using project MIS with our own fetch to prevent auth redirects
      try {
        console.log('[DEBUG] Making manual budget update request');
        const budgetUpdateResp = await fetch(`/api/budget/${encodeURIComponent(projectForSubmission.mis)}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          },
          credentials: 'include',
          body: JSON.stringify({
            amount: totalAmount.toString()
          })
        });
        
        // Handle authorization issues gracefully
        if (budgetUpdateResp.status === 401) {
          console.warn('[DEBUG] Auth warning for budget update');
          toast({
            title: "Προειδοποίηση",
            description: "Απαιτείται επαναλογίνση για ενημέρωση προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive"
          });
        } 
        // Handle other errors gracefully
        else if (!budgetUpdateResp.ok) {
          console.error('[DEBUG] Budget update failed:', budgetUpdateResp.status);
          toast({
            title: "Προειδοποίηση",
            description: "Αδυναμία ενημέρωσης προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
            variant: "destructive"
          });
        }
        else {
          console.log('[DEBUG] Budget updated successfully');
        }
      } catch (updateError) {
        console.error('[DEBUG] Budget update error:', updateError);
        toast({
          title: "Προειδοποίηση",
          description: "Σφάλμα κατά την ενημέρωση προϋπολογισμού. Η διαδικασία θα συνεχιστεί με επιφύλαξη.",
          variant: "destructive"
        });
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
      // If no project selected, return empty array
      if (!selectedProjectId) {
        return [];
      }
      
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

        // Fetch regions data from API
        const response = await apiRequest(`/api/projects/${encodeURIComponent(project.mis)}/regions`);
        console.log('[Regions] Response:', response);
        
        // Handle invalid response
        if (!response || typeof response !== 'object') {
          console.log('[Regions] Invalid response format:', response);
          return [];
        }
        
        // Handle the nested structure of the response
        try {
          let processedRegions: Array<{id: string, name: string, type: string}> = [];
          
          // Handle object with nested arrays
          if (response.region && Array.isArray(response.region)) {
            console.log('[Regions] Processing region data with format:', typeof response.region[0]);
            
            // Handle case where response.region contains region objects
            if (response.region.length > 0 && typeof response.region[0] === 'object') {
              // Extract and flatten the regional_unit values if available
              for (const regionItem of response.region) {
                if (regionItem.regional_unit && Array.isArray(regionItem.regional_unit)) {
                  // Process regional_unit values first (preferred)
                  for (const unit of regionItem.regional_unit) {
                    if (typeof unit === 'string' && unit.trim()) {
                      processedRegions.push({
                        id: unit,
                        name: unit,
                        type: 'regional_unit'
                      });
                    }
                  }
                }
                
                // If no regional_unit found, fall back to region values
                if (processedRegions.length === 0 && regionItem.region && Array.isArray(regionItem.region)) {
                  for (const region of regionItem.region) {
                    if (typeof region === 'string' && region.trim()) {
                      processedRegions.push({
                        id: region,
                        name: region,
                        type: 'region'
                      });
                    }
                  }
                }
              }
            } 
            // Handle case where response.region is a direct array of strings
            else if (response.region.length > 0 && typeof response.region[0] === 'string') {
              for (const region of response.region) {
                if (region.trim()) {
                  processedRegions.push({
                    id: region,
                    name: region,
                    type: 'region'
                  });
                }
              }
            }
          }
          
          // Also check for regional_unit at the top level
          if (processedRegions.length === 0 && response.regional_unit && Array.isArray(response.regional_unit)) {
            for (const unit of response.regional_unit) {
              if (typeof unit === 'string' && unit.trim()) {
                processedRegions.push({
                  id: unit,
                  name: unit,
                  type: 'regional_unit'
                });
              }
            }
          }
          
          // If we found any regions in any format, return them
          if (processedRegions.length > 0) {
            console.log('[Regions] Processed region data:', processedRegions);
            return processedRegions;
          }
          
          // No valid regions were found
          console.log('[Regions] No regions found for project:', project.mis);
          return [];
        } catch (err) {
          console.error('[Regions] Error processing region data:', err);
          return [];
        }
        
        // Shouldn't reach here due to earlier check, but just in case
        console.log('[Regions] No valid region or regional_unit data found');
        return [];
      } catch (error) {
        // Handle any errors
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
                        attachment.file_type === 'none' ? (
                          // Display message for no attachments found
                          <div key={attachment.id} className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <FileX className="h-12 w-12 mb-4" />
                            <p className="font-medium">{attachment.title}</p>
                            <p className="text-sm">{attachment.description}</p>
                          </div>
                        ) : (
                          // Display regular attachments with checkboxes
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
                        )
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