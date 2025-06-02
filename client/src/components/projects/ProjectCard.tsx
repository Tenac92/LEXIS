import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Project } from "@shared/schema";
import { Edit, Trash2, Calendar, MapPin, Building2, Coins, FileText, Info, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";
import { CompactBudgetIndicator } from "@/components/ui/budget-indicator";
import { type BudgetData } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
  view?: "grid" | "list";
  isAdmin: boolean;
}

export function ProjectCard({ project, view = "grid", isAdmin }: ProjectCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch budget data for this project
  const { data: budgetData } = useQuery<BudgetData | null>({
    queryKey: ["budget", project.mis],
    queryFn: async () => {
      if (!project.mis) return null;
      
      try {
        const response = await apiRequest(`/api/budget/${encodeURIComponent(project.mis)}`);
        if (!response || (typeof response === 'object' && 'status' in response && response.status === 'error')) {
          console.log('[Budget] No valid budget data for MIS:', project.mis);
          return null;
        }
        
        // Handle response format - could be either direct or in a data property
        let budgetData: Record<string, any> = {}; 
        if (typeof response === 'object' && 'data' in response && response.data) {
          budgetData = response.data;
        } else if (typeof response === 'object' && !('data' in response)) {
          budgetData = response;
        }
        
        // Map budget data to the expected interface
        return {
          user_view: parseFloat(budgetData.user_view?.toString() || '0'),
          total_budget: parseFloat(budgetData.total_budget?.toString() || '0'),
          katanomes_etous: parseFloat(budgetData.katanomes_etous?.toString() || '0'),
          ethsia_pistosi: parseFloat(budgetData.ethsia_pistosi?.toString() || '0'),
          current_budget: parseFloat(budgetData.current_budget?.toString() || '0'),
          annual_budget: parseFloat(budgetData.annual_budget?.toString() || '0'),
          quarter_view: parseFloat(budgetData.quarter_view?.toString() || '0'),
          current_quarter: budgetData.current_quarter?.toString() || 'q1',
          last_quarter_check: budgetData.last_quarter_check?.toString() || 'q1',
          q1: parseFloat(budgetData.q1?.toString() || '0'),
          q2: parseFloat(budgetData.q2?.toString() || '0'),
          q3: parseFloat(budgetData.q3?.toString() || '0'),
          q4: parseFloat(budgetData.q4?.toString() || '0'),
          // Calculate these values if they're not provided in the response
          available_budget: budgetData.available_budget?.toString() || 
            (parseFloat(budgetData.katanomes_etous?.toString() || '0') - 
             parseFloat(budgetData.user_view?.toString() || '0')).toString(),
          quarter_available: budgetData.quarter_available?.toString() || 
            (() => {
              // Get current quarter value
              const currentQ = budgetData.current_quarter?.toString() || 'q1';
              let quarterValue = 0;
              if (currentQ === 'q1') quarterValue = parseFloat(budgetData.q1?.toString() || '0');
              else if (currentQ === 'q2') quarterValue = parseFloat(budgetData.q2?.toString() || '0');
              else if (currentQ === 'q3') quarterValue = parseFloat(budgetData.q3?.toString() || '0');
              else if (currentQ === 'q4') quarterValue = parseFloat(budgetData.q4?.toString() || '0');
              return (quarterValue - parseFloat(budgetData.user_view?.toString() || '0')).toString();
            })(),
          yearly_available: budgetData.yearly_available?.toString() || 
            (parseFloat(budgetData.ethsia_pistosi?.toString() || '0') - 
             parseFloat(budgetData.user_view?.toString() || '0')).toString()
        };
      } catch (error) {
        console.error('[Budget] Error fetching budget data:', error);
        return null;
      }
    },
    enabled: Boolean(project.mis),
    staleTime: 60 * 1000 // Cache for 1 minute
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${project.mis}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Αποτυχία διαγραφής έργου");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Το έργο διαγράφηκε",
        description: "Το έργο διαγράφηκε επιτυχώς",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Αποτυχία Διαγραφής",
        description: error.message || "Αποτυχία διαγραφής έργου",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '€0,00';
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "pending_reallocation":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Αναμονή Χρηματοδότησης";
      case "pending_reallocation":
        return "Αναμονή Ανακατανομής";
      case "active":
        return "Ενεργό";
      case "completed":
        return "Ολοκληρωμένο";
      default:
        return status;
    }
  };

  const getProjectTitle = (project: Project) => {
    // Display event_description as the primary title for project cards
    const projectData = project as any;
    
    // Use event_description as the main display field
    if (projectData.event_description && projectData.event_description.trim()) {
      return projectData.event_description.trim();
    }
    
    // Fallback to other title fields if event_description is not available
    if (projectData.title && projectData.title.trim()) return projectData.title.trim();
    if (projectData.project_title && projectData.project_title.trim()) return projectData.project_title.trim();
    if (projectData.name && projectData.name.trim()) return projectData.name.trim();
    
    // Final fallback to showing MIS code with a label
    return `Έργο MIS: ${project.mis}`;
  };

  const getRegionText = (project: Project) => {
    if (!project.region) return '';
    
    // Handle string regions
    if (typeof project.region === 'string') {
      return project.region;
    }
    
    // Handle array regions
    if (Array.isArray(project.region)) {
      return project.region.join(', ');
    }
    
    // Handle object regions - try to extract meaningful text
    if (typeof project.region === 'object') {
      try {
        // If it's an object with structured region data
        const obj = project.region as any;
        
        // Try structured region data first
        if (obj.region || obj.municipality || obj.regional_unit) {
          const parts = [];
          if (obj.region?.length) {
            parts.push(Array.isArray(obj.region) ? obj.region[0] : obj.region);
          }
          if (obj.regional_unit?.length) {
            parts.push(Array.isArray(obj.regional_unit) ? obj.regional_unit[0] : obj.regional_unit);
          }
          if (obj.municipality?.length) {
            parts.push(Array.isArray(obj.municipality) ? obj.municipality[0] : obj.municipality);
          }
          if (parts.length > 0) return parts.join(' / ');
        }
        
        // Try other common properties
        if (obj.name) return obj.name;
        if (obj.title) return obj.title;
        
        // If it has keys, try to join their values
        const keys = Object.keys(obj);
        if (keys.length > 0) {
          const values = keys.map(key => {
            const val = obj[key];
            if (Array.isArray(val) && val.length > 0) {
              return val[0];
            }
            return val;
          }).filter(val => val && typeof val === 'string');
          
          if (values.length > 0) {
            return values.join(', ');
          }
        }
      } catch (e) {
        console.warn('Error parsing region object:', e);
      }
    }
    
    return '';
  };

  if (view === "list") {
    return (
      <>
        <Card 
          className="transition-shadow hover:shadow-lg flex cursor-pointer"
          onClick={() => setShowDetails(true)}
        >
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {getProjectTitle(project)}
                  </h3>
                  <Badge variant="secondary" className={getStatusColor(project.status || '')}>
                    {getStatusText(project.status || '')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>MIS: {project.mis || "Δ/Υ"}</span>
                    </div>
                    {getRegionText(project) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>{getRegionText(project)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>Προϋπολογισμός: {formatCurrency(Number(project.budget_na853))}</span>
                    </div>
                    {budgetData && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span>Διαθέσιμο: {formatCurrency(parseFloat(budgetData.available_budget?.toString() || '0'))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(true);
                  }}
                >
                  <Info className="w-4 h-4 mr-2" />
                  Λεπτομέρειες
                </Button>
                <div className="flex gap-1">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/projects/${project.mis}/edit`);
                      }}
                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="Επεξεργασία"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate();
                      }}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Διαγραφή"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
        <ProjectDetailsDialog 
          project={project}
          open={showDetails}
          onOpenChange={setShowDetails}
        />
      </>
    );
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Allow flipping anywhere on the card except buttons
    if (!(e.target as HTMLElement).closest('button')) {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <>
      <div className="flip-card" onClick={handleCardClick}>
        <div className={`flip-card-inner ${isFlipped ? 'rotate-y-180' : ''}`}>
          {/* Front of card */}
          <div className="flip-card-front">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight line-clamp-2">
                    {getProjectTitle(project)}
                  </h3>
                  <Badge variant="secondary" className={getStatusColor(project.status || '')}>
                    {getStatusText(project.status || '')}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(true);
                    }}
                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="Λεπτομέρειες"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/projects/${project.mis}/edit`);
                      }}
                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="Επεξεργασία"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Critical Information - Budget Status */}
              {budgetData && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-800">Διαθέσιμος Προϋπολ.:</span>
                    <span className="text-green-900 font-mono">
                      {formatCurrency(parseFloat(budgetData.available_budget?.toString() || '0'))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-medium text-green-800">Τρέχον Τρίμηνο:</span>
                    <span className="text-green-900">{budgetData.current_quarter?.toUpperCase()}</span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Κωδικός MIS</span>
                  <span className="text-gray-900 font-mono">{project.mis || "Δ/Υ"}</span>
                </div>
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Προϋπολογισμός ΣΑ853</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(Number(project.budget_na853))}</span>
                </div>
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Ημερομηνία</span>
                  <span className="text-gray-900">{new Date(project.created_at || '').toLocaleDateString('el-GR')}</span>
                </div>
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Κατάσταση</span>
                  <span className="text-gray-900">{getStatusText(project.status || '')}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(true);
                  }}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <Info className="w-4 h-4 mr-2" />
                  Περισσότερα στοιχεία
                </Button>
              </div>
            </div>
          </div>

          {/* Back of card */}
          <div className="flip-card-back bg-green-50">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-600"></div>
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-green-900">
                    Λεπτομέρειες Έργου
                  </h3>
                  <p className="text-green-700 text-sm line-clamp-2">
                    {project.title}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFlipped(false)}
                  className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600 transition-colors"
                  title="Επιστροφή"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Budget Details */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Προϋπολογισμός ΣΑ853:</span>
                    <span className="text-green-900 font-mono">{formatCurrency(Number(project.budget_na853))}</span>
                  </div>
                  {project.budget_na271 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700 font-medium">Προϋπολογισμός ΣΑ271:</span>
                      <span className="text-green-900 font-mono">{formatCurrency(Number(project.budget_na271))}</span>
                    </div>
                  )}
                  {project.budget_e069 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700 font-medium">Προϋπολογισμός E069:</span>
                      <span className="text-green-900 font-mono">{formatCurrency(Number(project.budget_e069))}</span>
                    </div>
                  )}
                </div>

                {/* Expenditure Types */}
                {project.expenditure_type && Array.isArray(project.expenditure_type) && project.expenditure_type.length > 0 && (
                  <div className="pt-2 border-t border-green-200">
                    <span className="text-green-700 font-medium text-sm">Τύποι Δαπάνης:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {project.expenditure_type.map((type, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-green-100 text-green-800">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Implementing Agency */}
                {project.implementing_agency && Array.isArray(project.implementing_agency) && project.implementing_agency.length > 0 && (
                  <div className="pt-2 border-t border-green-200">
                    <span className="text-green-700 font-medium text-sm">Φορέας Υλοποίησης:</span>
                    <div className="mt-1">
                      {project.implementing_agency.map((agency, index) => (
                        <div key={index} className="text-green-900 text-sm">{agency}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Budget Indicators */}
                {budgetData && (
                  <div className="pt-4 border-t border-green-200">
                    <h4 className="font-semibold text-green-800 text-sm mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Διαθέσιμος Προϋπολογισμός
                    </h4>
                    <CompactBudgetIndicator 
                      budgetData={budgetData} 
                      mis={String(project.mis) || ''}
                    />
                  </div>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="pt-4 border-t border-green-200">
                    <div className="flex gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="flex-1"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Διαγραφή
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Διαγραφή Έργου</AlertDialogTitle>
                            <AlertDialogDescription>
                              Είστε βέβαιοι ότι θέλετε να διαγράψετε αυτό το έργο; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate()}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Διαγραφή
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProjectDetailsDialog 
        project={project}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}