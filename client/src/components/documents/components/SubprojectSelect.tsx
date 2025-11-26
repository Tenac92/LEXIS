import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Loader2, FileText, Calendar, Euro, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubprojectSelectionDialog } from "@/components/projects/SubprojectSelectionDialog";

interface SubprojectData {
  id: number;
  epa_version_id: number;
  title: string;
  description?: string | null;
  status?: string | null;
  code?: string;
  version?: string;
  type?: string;
  yearly_budgets?: Record<number, { sdd?: number; edd?: number }>;
  created_at?: Date | null;
  updated_at?: Date | null;
}

interface SubprojectSelectProps {
  projectId: string | null;
  onSubprojectSelect: (subproject: SubprojectData | null) => void;
  selectedSubprojectId?: string | null;
  disabled?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Συνεχιζόμενο':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Σε αναμονή':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Ολοκληρωμένο':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatBudgetAmount = (amount: number): string => {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function SubprojectSelect({
  projectId,
  onSubprojectSelect,
  selectedSubprojectId,
  disabled = false
}: SubprojectSelectProps) {
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedSubprojectId || null);
  const [showManageDialog, setShowManageDialog] = useState(false);

  // Update local state when external selection changes
  useEffect(() => {
    setLocalSelectedId(selectedSubprojectId || null);
  }, [selectedSubprojectId]);

  // Fetch subprojects for the selected project
  const { data: subprojectsData, isLoading, error } = useQuery({
    queryKey: ['subprojects', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const response = await fetch(`/api/projects/${projectId}/subprojects`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subprojects: ${response.status}`);
      }

      return response.json();
    },
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const subprojects = subprojectsData?.subprojects || [];

  const handleSubprojectClick = (subproject: SubprojectData) => {
    if (disabled) return;

    const newSelectedId = localSelectedId === String(subproject.id) ? null : String(subproject.id);
    setLocalSelectedId(newSelectedId);
    onSubprojectSelect(newSelectedId ? subproject : null);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Φόρτωση υποέργων...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-destructive">
          Σφάλμα κατά τη φόρτωση των υποέργων
        </div>
      </div>
    );
  }

  // Show no project selected state
  if (!projectId) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Επιλέξτε πρώτα ένα έργο για να δείτε τα διαθέσιμα υποέργα
        </div>
      </div>
    );
  }

  // Show no subprojects state
  if (subprojects.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Δεν υπάρχουν διαθέσιμα υποέργα για το επιλεγμένο έργο
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowManageDialog(true)}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Διαχείριση Υποέργων
        </Button>
        <SubprojectSelectionDialog
          projectId={projectId}
          projectTitle={subprojectsData?.project?.title}
          open={showManageDialog}
          onOpenChange={setShowManageDialog}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Επιλέξτε υποέργο (προαιρετικό):
      </div>
      
      <div className="grid gap-3">
        {subprojects.map((subproject: SubprojectData) => {
          const isSelected = localSelectedId === String(subproject.id);
          const currentYear = new Date().getFullYear();
          const yearlyBudget = (subproject.yearly_budgets as any)?.[currentYear] || {};
          const totalBudget = (yearlyBudget.sdd || 0) + (yearlyBudget.edd || 0);

          return (
            <Card
              key={subproject.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected 
                  ? "ring-2 ring-blue-500 border-blue-200 bg-blue-50" 
                  : "border-gray-200 hover:border-gray-300",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => handleSubprojectClick(subproject)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {isSelected ? (
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {subproject.code}
                        </Badge>
                        <Badge className={cn("text-xs", getStatusColor(subproject.status || ""))}>
                          {subproject.status || "Άγνωστο"}
                        </Badge>
                        {subproject.version && (
                          <Badge variant="secondary" className="text-xs">
                            {subproject.version}
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-medium text-sm text-gray-900 mb-1">
                        {subproject.title}
                      </h4>
                      
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span>{subproject.type}</span>
                        </div>
                        {totalBudget > 0 && (
                          <div className="flex items-center space-x-1">
                            <Euro className="h-3 w-3" />
                            <span>{formatBudgetAmount(totalBudget)}</span>
                          </div>
                        )}
                      </div>
                      
                      {subproject.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {subproject.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowManageDialog(true)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Διαχείριση Υποέργων
        </Button>
        
        {localSelectedId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLocalSelectedId(null);
              onSubprojectSelect(null);
            }}
            disabled={disabled}
          >
            Καθαρισμός επιλογής
          </Button>
        )}
      </div>

      <SubprojectSelectionDialog
        projectId={projectId}
        projectTitle={subprojectsData?.project?.title}
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
      />
    </div>
  );
}