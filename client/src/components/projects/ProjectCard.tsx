import { Link } from "wouter";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ProjectCardProps {
  project: Project;
  view?: "grid" | "list";
  isAdmin: boolean;
}

export function ProjectCard({ project, view = "grid", isAdmin }: ProjectCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${project.mis}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete project");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Deleted",
        description: "The project has been successfully deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project",
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
    <Link href={`/projects/${project.mis}`}>
      <Card className={`transition-shadow hover:shadow-lg ${view === "list" ? "flex" : ""} cursor-pointer`}>
        <CardContent 
          className={`p-6 ${view === "list" ? "flex-1" : ""}`} 
          onClick={(e) => {
            // Prevent triggering card click when clicking on the admin buttons
            if ((e.target as HTMLElement).closest('.admin-actions')) {
              e.preventDefault();
            }
          }}
        >
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-lg font-bold">
                {project.event_description || project.project_title || "Untitled Project"}
              </h3>
              <Badge variant="secondary" className={getStatusColor(project.status || '')}>
                {getStatusText(project.status || '')}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  Created: {new Date(project.created_at || '').toLocaleDateString('el-GR')}
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
                  Budget NA853: {formatCurrency(Number(project.budget_na853))}
                </div>
                {project.budget_na271 && (
                  <div className="text-sm text-muted-foreground">
                    Budget NA271: {formatCurrency(Number(project.budget_na271))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">MIS</div>
                <div className="font-medium">{project.mis || "N/A"}</div>
              </div>
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">NA853</div>
                <div className="font-medium">{project.na853 || "N/A"}</div>
              </div>
            </div>
          </div>
        </CardContent>

        {isAdmin && (
          <CardFooter className="flex justify-end gap-2 border-t p-4 admin-actions" onClick={e => e.preventDefault()}>
            <Link href={`/projects/${project.mis}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this project? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}