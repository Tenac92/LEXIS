import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type OptimizedProject } from "@shared/schema";
import { Edit, Trash2, Info, Building, DollarSign, TrendingUp, MapPin, Briefcase } from "lucide-react";
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

interface OptimizedProjectCardProps {
  project: OptimizedProject;
  view?: "grid" | "list";
  isAdmin: boolean;
}

export function OptimizedProjectCard({ project, view = "grid", isAdmin }: OptimizedProjectCardProps) {
  const [showDetails, setShowDetails] = useState(false);
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
          return null;
        }
        
        // Handle response format
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
          available_budget: budgetData.available_budget?.toString() || 
            (parseFloat(budgetData.katanomes_etous?.toString() || '0') - 
             parseFloat(budgetData.user_view?.toString() || '0')).toString(),
          quarter_available: budgetData.quarter_available?.toString() || '0',
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
    if (project.event_description && project.event_description.trim()) {
      return project.event_description.trim();
    }
    
    if (project.project_title && project.project_title.trim()) return project.project_title.trim();
    if (project.name && project.name.trim()) return project.name.trim();
    
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
      <Card className="transition-shadow hover:shadow-lg flex cursor-pointer">
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
                    <Building className="w-4 h-4" />
                    <span>MIS: {project.mis || "Δ/Υ"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="w-4 h-4" />
                    <span>NA853: {project.na853 || "Δ/Υ"}</span>
                  </div>
                  {getRegionText(project) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
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
                  {project.unit?.name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="w-4 h-4" />
                      <span>{project.unit.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
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
        </div>
      </Card>
    );
  }

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
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
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/projects/${project.mis}/edit`)}
                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                title="Επεξεργασία"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Project Information */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="w-4 h-4" />
            <span>MIS: {project.mis}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="w-4 h-4" />
            <span>NA853: {project.na853}</span>
          </div>

          {project.unit?.name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="w-4 h-4" />
              <span>{project.unit.name}</span>
            </div>
          )}

          {getRegionText(project) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{getRegionText(project)}</span>
            </div>
          )}

          {project.event_type?.name && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Τύπος: </span>
              <span>{project.event_type.name}</span>
            </div>
          )}

          {project.expenditure_type?.name && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Δαπάνη: </span>
              <span>{project.expenditure_type.name}</span>
            </div>
          )}
        </div>

        {/* Budget Information */}
        {budgetData && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-green-800">Διαθέσιμος Προϋπολογισμός:</span>
              <span className="font-bold text-green-900">
                {formatCurrency(parseFloat(budgetData.available_budget?.toString() || '0'))}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Προϋπολογισμός: {formatCurrency(Number(project.budget_na853) || 0)}</span>
        </div>
      </CardContent>
    </Card>
  );
}