import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Project, type OptimizedProject } from "@shared/schema";
import { Edit, Trash2, Calendar, MapPin, Building2, Coins, FileText, Info, RotateCcw, Building, DollarSign, TrendingUp } from "lucide-react";
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
  project: OptimizedProject;
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

  const getProjectTitle = (project: OptimizedProject) => {
    // Use event_description as the main display field
    if (project.event_description && project.event_description.trim()) {
      return project.event_description.trim();
    }
    
    // Fallback to other title fields if event_description is not available
    if (project.project_title && project.project_title.trim()) return project.project_title.trim();
    if (project.name && project.name.trim()) return project.name.trim();
    
    // Final fallback to showing MIS code with a label
    return `Έργο MIS: ${project.mis}`;
  };

  const getRegionText = (project: OptimizedProject) => {
    if (!project.region) return '';
    
    const parts = [];
    if (project.region.region) parts.push(project.region.region);
    if (project.region.regional_unit) parts.push(project.region.regional_unit);
    if (project.region.municipality) parts.push(project.region.municipality);
    
    return parts.join(' / ');
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
                      <span>Προϋπολογισμός: {formatCurrency(Number(project.budget_na853) || 0)}</span>
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
      <Card 
        className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group bg-white border-0 shadow-md"
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-0">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-bold leading-tight line-clamp-2">
                  {getProjectTitle(project)}
                </h3>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  {getStatusText(project.status || '')}
                </Badge>
              </div>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(true);
                  }}
                  className="h-8 w-8 p-0 hover:bg-white/20 text-white"
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
                    className="h-8 w-8 p-0 hover:bg-white/20 text-white"
                    title="Επεξεργασία"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Budget Status */}
            {budgetData && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800">Διαθέσιμος Προϋπολ.:</span>
                  <span className="text-green-900 font-mono font-semibold">
                    {formatCurrency(parseFloat(budgetData.available_budget?.toString() || '0'))}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-medium text-green-800">Τρέχον Τρίμηνο:</span>
                  <span className="text-green-900 font-semibold">{budgetData.current_quarter?.toUpperCase()}</span>
                </div>
              </div>
            )}
            
            {/* Project Codes */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-600" />
                  <div>
                    <span className="text-xs text-gray-600 block">Κωδικός MIS</span>
                    <span className="font-mono text-sm font-semibold text-gray-900">{project.mis || "Δ/Υ"}</span>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <div>
                    <span className="text-xs text-gray-600 block">ΝΑ853</span>
                    <span className="font-mono text-sm font-semibold text-gray-900">{project.na853 || "Δ/Υ"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-2">
              {getRegionText(project) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="truncate">{getRegionText(project)}</span>
                </div>
              )}
              
              {project.budget_na853 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="w-4 h-4 text-blue-600" />
                  <span>Προϋπολογισμός: <span className="font-semibold">{formatCurrency(Number(project.budget_na853))}</span></span>
                </div>
              )}
              
              {project.implementing_agency && project.implementing_agency.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <span className="truncate">
                    {Array.isArray(project.implementing_agency) 
                      ? project.implementing_agency.join(', ') 
                      : project.implementing_agency
                    }
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {project.created_at ? new Date(project.created_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
              </span>
              <div className="flex gap-1">
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Διαγραφή"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Διαγραφή Έργου</AlertDialogTitle>
                        <AlertDialogDescription>
                          Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έργο; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
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
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <ProjectDetailsDialog 
        project={project}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}