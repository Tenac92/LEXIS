import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type OptimizedProject } from "@shared/schema";
import { 
  Edit, 
  Trash2, 
  Info, 
  Building, 
  DollarSign, 
  TrendingUp, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Hash, 
  Users, 
  ChevronRight,
  RotateCcw,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from "lucide-react";
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
import { type BudgetData } from "@/lib/types";
import { ProjectDetailsDialog } from "@/components/projects/ProjectDetailsDialog";

interface OptimizedProjectCardProps {
  project: OptimizedProject;
  view?: "grid" | "list";
  isAdmin: boolean;
}

export function OptimizedProjectCard({ project, view = "grid", isAdmin }: OptimizedProjectCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: budgetData } = useQuery<BudgetData | null>({
    queryKey: ["budget", project.mis],
    queryFn: async () => {
      if (!project.mis) return null;
      
      try {
        const response = await apiRequest(`/api/budget/lookup/${encodeURIComponent(project.mis)}`);
        if (!response || (typeof response === 'object' && 'status' in response && response.status === 'error')) {
          return null;
        }
        
        let budgetData: Record<string, any> = {}; 
        if (typeof response === 'object' && 'data' in response && response.data) {
          budgetData = response.data;
        } else if (typeof response === 'object' && !('data' in response)) {
          budgetData = response;
        }
        
        return {
          user_view: parseFloat(budgetData.user_view?.toString() || '0'),
          total_budget: parseFloat(budgetData.total_budget?.toString() || '0'),
          proip: parseFloat(budgetData.proip?.toString() || '0'),
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
          available_budget: budgetData.available_budget?.toString() || 
            (parseFloat(budgetData.katanomes_etous?.toString() || '0') - 
             parseFloat(budgetData.user_view?.toString() || '0')).toString(),
          quarter_available: budgetData.quarter_available?.toString() || '0',
          yearly_available: budgetData.yearly_available?.toString() || 
            (parseFloat(budgetData.ethsia_pistosi?.toString() || '0') - 
             parseFloat(budgetData.user_view?.toString() || '0')).toString()
        };
      } catch (error) {
        if (error instanceof Error && !error.message.includes('Budget data not found')) {
          console.error('[Budget] Error fetching budget data:', error);
        }
        return null;
      }
    },
    enabled: Boolean(project.mis),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${project.id}`, {
        method: "DELETE",
      }) as Response;

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Αποτυχία διαγραφής έργου");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/cards"] });
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

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '€0,00';
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '€0';
    if (amount >= 1000000) {
      return `€${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `€${(amount / 1000).toFixed(0)}K`;
    }
    return formatCurrency(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "pending_reallocation":
        return "bg-violet-100 text-violet-800 border-violet-200";
      case "completed":
        return "bg-sky-100 text-sky-800 border-sky-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Αναμονή";
      case "pending_reallocation":
        return "Ανακατανομή";
      case "active":
        return "Ενεργό";
      case "completed":
        return "Ολοκληρωμένο";
      default:
        return status;
    }
  };

  const getProjectTitle = (project: OptimizedProject) => {
    if (project.event_description && project.event_description.trim()) {
      return project.event_description.trim();
    }
    if (project.project_title && project.project_title.trim()) {
      return project.project_title.trim();
    }
    if (project.mis) {
      return `Έργο MIS: ${project.mis}`;
    }
    if (project.na853) {
      return `Έργο NA853: ${project.na853}`;
    }
    return 'Έργο χωρίς τίτλο';
  };

  const getRegionText = (project: OptimizedProject) => {
    if (!project.region) return '';
    const parts = [];
    if (project.region.region) parts.push(project.region.region);
    if (project.region.regional_unit) parts.push(project.region.regional_unit);
    return parts.join(' • ');
  };

  const getEventYearText = (project: OptimizedProject) => {
    if (!project.event_year) return null;
    if (Array.isArray(project.event_year) && project.event_year.length > 0) {
      return project.event_year.join(', ');
    }
    return null;
  };

  const calculateBudgetUtilization = () => {
    if (!budgetData) return 0;
    const allocated = parseFloat(budgetData.katanomes_etous?.toString() || '0');
    const spent = parseFloat(budgetData.user_view?.toString() || '0');
    if (allocated === 0) return 0;
    return Math.min(100, Math.round((spent / allocated) * 100));
  };

  const getCardBorderColor = () => {
    const utilization = calculateBudgetUtilization();
    return utilization > 80 ? 'border-l-red-500' : 'border-l-emerald-500';
  };

  const getCardBackgroundClass = () => {
    const utilization = calculateBudgetUtilization();
    return utilization > 80 ? 'bg-gradient-to-br from-red-50/50 to-white dark:from-red-950/20 dark:to-background' : 'bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background';
  };

  const getFlipButtonColor = () => {
    const utilization = calculateBudgetUtilization();
    return utilization > 80 ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700';
  };

  const getQuarterLabel = (quarter: string) => {
    switch(quarter?.toLowerCase()) {
      case 'q1': return 'Α\'';
      case 'q2': return 'Β\'';
      case 'q3': return 'Γ\'';
      case 'q4': return 'Δ\'';
      default: return quarter;
    }
  };

  if (view === "list") {
    return (
      <Card 
        className="transition-all duration-200 hover:shadow-md border-l-4 border-l-emerald-500 cursor-pointer group"
        onClick={() => setShowDetails(true)}
        data-testid={`card-project-list-${project.id}`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-base font-semibold text-foreground truncate" data-testid={`text-title-${project.id}`}>
                  {getProjectTitle(project)}
                </h3>
                <Badge variant="outline" className={`shrink-0 text-xs ${getStatusColor(project.status || '')}`}>
                  {getStatusText(project.status || '')}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono text-xs">{project.mis || "—"}</span>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="font-mono text-xs">{project.na853}</span>
                </div>
                
                {project.unit?.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{project.unit.name}</span>
                  </div>
                )}
                
                {project.event_type?.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{project.event_type.name}</span>
                  </div>
                )}
                
                {getRegionText(project) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{getRegionText(project)}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium">{formatCompactCurrency(Number(project.budget_na853) || 0)}</span>
                  {budgetData && (
                    <span className="text-emerald-600 text-xs">
                      ({calculateBudgetUtilization()}% χρήση)
                    </span>
                  )}
                </div>
              </div>
              
              {/* Second row with additional metadata */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2">
                {project.implementing_agency?.title && (
                  <div className="flex items-center gap-1.5 text-muted-foreground/80">
                    <Users className="w-3 h-3 shrink-0" />
                    <span className="truncate">{project.implementing_agency.title}</span>
                  </div>
                )}
                
                {(getEventYearText(project) || project.inc_year) && (
                  <div className="flex items-center gap-1.5 text-muted-foreground/80">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {getEventYearText(project) && `Συμβάν: ${getEventYearText(project)}`}
                      {getEventYearText(project) && project.inc_year && ' • '}
                      {project.inc_year && `Ένταξη: ${project.inc_year}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(true);
                }}
                className="h-8 w-8 p-0"
                title="Λεπτομέρειες"
                data-testid={`button-details-${project.id}`}
              >
                <Info className="w-4 h-4" />
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/projects/${project.id}/edit`);
                    }}
                    className="h-8 w-8 p-0"
                    title="Επεξεργασία"
                    data-testid={`button-edit-${project.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        title="Διαγραφή"
                        data-testid={`button-delete-${project.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Διαγραφή Έργου</AlertDialogTitle>
                        <AlertDialogDescription>
                          Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έργο;
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
                </>
              )}
            </div>
          </div>
        </div>
        
        <ProjectDetailsDialog 
          project={project as any}
          open={showDetails}
          onOpenChange={setShowDetails}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="flip-card h-[420px]" onClick={() => setIsFlipped(!isFlipped)} data-testid={`card-project-grid-${project.id}`}>
        <div className={`flip-card-inner ${isFlipped ? "rotate-y-180" : ""}`}>
          
          {/* FRONT - Metadata */}
          <div className="flip-card-front">
            <Card className={`h-full border-l-4 shadow-sm hover:shadow-md transition-shadow ${getCardBorderColor()}`}>
              <div className="p-5 h-full flex flex-col">
                
                {/* Header with Status and Actions */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <Badge variant="outline" className={`text-xs ${getStatusColor(project.status || '')}`}>
                    {getStatusText(project.status || '')}
                  </Badge>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetails(true);
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                      title="Λεπτομέρειες"
                      data-testid={`button-info-${project.id}`}
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/projects/${project.id}/edit`);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600"
                          title="Επεξεργασία"
                          data-testid={`button-edit-grid-${project.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                              title="Διαγραφή"
                              data-testid={`button-delete-grid-${project.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Διαγραφή Έργου</AlertDialogTitle>
                              <AlertDialogDescription>
                                Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έργο;
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
                      </>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-foreground leading-tight mb-4 line-clamp-2" data-testid={`text-title-grid-${project.id}`}>
                  {getProjectTitle(project)}
                </h3>

                {/* Project Codes */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">MIS</span>
                      <p className="font-mono text-sm font-medium">{project.mis || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ΝΑ853</span>
                      <p className="font-mono text-sm font-medium">{project.na853}</p>
                    </div>
                  </div>
                </div>

                {/* Metadata Items */}
                <div className="space-y-2.5 flex-1">
                  {project.unit?.name && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-muted-foreground truncate">{project.unit.name}</span>
                    </div>
                  )}
                  
                  {project.implementing_agency?.title && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-muted-foreground truncate">{project.implementing_agency.title}</span>
                    </div>
                  )}
                  
                  {project.event_type?.name && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-muted-foreground truncate">{project.event_type.name}</span>
                    </div>
                  )}
                  
                  {getRegionText(project) && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-muted-foreground truncate">{getRegionText(project)}</span>
                    </div>
                  )}
                  
                  {(getEventYearText(project) || project.inc_year) && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-muted-foreground">
                        {getEventYearText(project) && `Συμβάν: ${getEventYearText(project)}`}
                        {getEventYearText(project) && project.inc_year && ' • '}
                        {project.inc_year && `Ένταξη: ${project.inc_year}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Flip to Financial */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(true);
                  }}
                  className={`w-full mt-4 ${getFlipButtonColor()}`}
                  data-testid={`button-flip-to-financial-${project.id}`}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Οικονομικά Στοιχεία
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </div>
            </Card>
          </div>

          {/* BACK - Financial */}
          <div className="flip-card-back">
            <Card className={`h-full border-l-4 shadow-sm ${getCardBackgroundClass()} ${calculateBudgetUtilization() > 80 ? 'border-l-red-500' : 'border-l-blue-500'}`}>
              <div className="p-5 h-full flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                      <Wallet className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-foreground">Οικονομικά</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground"
                    title="Επιστροφή"
                    data-testid={`button-flip-back-${project.id}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>

                {/* Project Reference */}
                <div className="text-xs text-muted-foreground mb-4">
                  MIS: <span className="font-mono">{project.mis}</span> • NA853: <span className="font-mono">{project.na853}</span>
                </div>

                {/* Total Budget */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-4 border shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Συνολικός Προϋπολογισμός</span>
                    <Target className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <p className="text-xl font-bold text-foreground" data-testid={`text-total-budget-${project.id}`}>
                    {formatCurrency(budgetData?.proip ? Number(budgetData.proip) : Number(project.budget_na853) || 0)}
                  </p>
                </div>

                {budgetData ? (
                  <>
                    {/* Budget Utilization */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Χρήση Προϋπολογισμού</span>
                        <span className="text-xs font-medium">{calculateBudgetUtilization()}%</span>
                      </div>
                      <Progress 
                        value={calculateBudgetUtilization()} 
                        className="h-2"
                      />
                      <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                        <span>Δαπάνες: {formatCompactCurrency(parseFloat(budgetData.user_view?.toString() || '0'))}</span>
                        <span>Κατανομές: {formatCompactCurrency(parseFloat(budgetData.katanomes_etous?.toString() || '0'))}</span>
                      </div>
                    </div>

                    {/* Available & Spent */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Διαθέσιμο</span>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatCompactCurrency(parseFloat(budgetData.available_budget?.toString() || '0'))}
                        </p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ArrowDownRight className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] text-amber-700 dark:text-amber-400">Δαπάνες {new Date().getFullYear()}</span>
                        </div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          {formatCompactCurrency(parseFloat(budgetData.user_view?.toString() || '0'))}
                        </p>
                      </div>
                    </div>

                    {/* Quarterly Breakdown */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Τριμηνιαίες Κατανομές</span>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                          Τρέχον: {getQuarterLabel(budgetData.current_quarter || '')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {['q1', 'q2', 'q3', 'q4'].map((q) => {
                          const value = budgetData[q as keyof typeof budgetData] as number || 0;
                          const isCurrent = budgetData.current_quarter?.toLowerCase() === q;
                          return (
                            <div 
                              key={q} 
                              className={`text-center p-1.5 rounded ${isCurrent ? 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-300' : 'bg-white dark:bg-slate-700'}`}
                            >
                              <span className="text-[10px] text-muted-foreground block">{getQuarterLabel(q)}</span>
                              <span className={`text-xs font-medium ${isCurrent ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                                {formatCompactCurrency(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <PiggyBank className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Δεν υπάρχουν δεδομένα προϋπολογισμού</p>
                    </div>
                  </div>
                )}

                {/* Back to Metadata */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                  className="w-full mt-auto text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  data-testid={`button-flip-to-metadata-${project.id}`}
                >
                  <Building className="w-4 h-4 mr-2" />
                  Στοιχεία Έργου
                  <ChevronRight className="w-4 h-4 ml-auto rotate-180" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <ProjectDetailsDialog 
        project={project as any}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}
