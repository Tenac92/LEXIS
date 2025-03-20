import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Project } from "@shared/schema";
import { Edit, Trash2, Calendar, MapPin, Building2, Coins, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";

interface ProjectCardProps {
  project: Project;
  view?: "grid" | "list";
  isAdmin: boolean;
}

export function ProjectCard({ project, view = "grid", isAdmin }: ProjectCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const getRegionText = (project: Project) => {
    if (!project.region) return '';
    const regionData = project.region as { region: string[], municipality: string[], regional_unit: string[] };
    const parts = [];
    if (regionData.region?.length) parts.push(regionData.region[0]);
    if (regionData.regional_unit?.length) parts.push(regionData.regional_unit[0]);
    if (regionData.municipality?.length) parts.push(regionData.municipality[0]);
    return parts.join(' / ');
  };

  return (
    <>
      <Card 
        className={`transition-shadow hover:shadow-lg ${view === "list" ? "flex" : ""} cursor-pointer`}
        onClick={() => setShowDetails(true)}
      >
        <CardContent 
          className={`p-6 ${view === "list" ? "flex-1" : ""}`}
        >
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-lg font-bold">
                {project.event_description || project.project_title || "Έργο Χωρίς Τίτλο"}
              </h3>
              <Badge variant="secondary" className={getStatusColor(project.status || '')}>
                {getStatusText(project.status || '')}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  Δημιουργήθηκε: {new Date(project.created_at || '').toLocaleDateString('el-GR')}
                </div>
                {project.region && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4" />
                    {getRegionText(project)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="font-medium">
                  Προϋπολογισμός ΣΑ853: {formatCurrency(Number(project.budget_na853))}
                </div>
                {project.budget_na271 && (
                  <div className="text-sm text-muted-foreground">
                    Προϋπολογισμός ΣΑ271: {formatCurrency(Number(project.budget_na271))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Κωδικός MIS</div>
                <div className="font-medium">{project.mis || "Δ/Υ"}</div>
              </div>
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Κωδικός ΣΑ853</div>
                <div className="font-medium">{project.na853 || "Δ/Υ"}</div>
              </div>
            </div>
          </div>
        </CardContent>

        {isAdmin && (
          <CardFooter className="flex justify-end gap-2 border-t p-4 admin-actions">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/projects/${project.mis}/edit`;
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Επεξεργασία
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
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
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Ακύρωση</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate();
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Διαγραφή
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>

      <ProjectDetailsDialog 
        project={project}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}