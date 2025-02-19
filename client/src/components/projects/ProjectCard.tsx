import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ProjectCatalog } from "@shared/schema";
import { Edit, Trash2, Calendar, MapPin, Building2 } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";

interface ProjectCardProps {
  project: ProjectCatalog;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Deleted",
        description: "Project has been successfully deleted",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('el-GR');
  };

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return '€0,00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
    }).format(numAmount);
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

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
        <div className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-lg font-bold">
              {project.event_description || "Untitled Project"}
            </h3>
            <Badge variant="secondary" className={getStatusColor(project.status || '')}>
              {project.status === "pending"
                ? "Αναμονή Χρηματοδότησης"
                : project.status === "pending_reallocation"
                ? "Αναμονή Ανακατανομής"
                : project.status === "active"
                ? "Ενεργό"
                : "Ολοκληρωμένο"}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-1 h-4 w-4" />
              {formatDate(project.created_at)}
            </div>
            {project.region && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-1 h-4 w-4" />
                {project.region}
              </div>
            )}
            {project.implementing_agency?.[0] && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Building2 className="mr-1 h-4 w-4" />
                {project.implementing_agency[0]}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-md bg-primary/5 p-2">
              <span className="text-sm font-medium">Budget NA853</span>
              <span className="font-semibold text-blue-600">{formatCurrency(project.budget_na853)}</span>
            </div>
            {project.ethsia_pistosi && (
              <div className="flex items-center justify-between rounded-md bg-primary/5 p-2">
                <span className="text-sm font-medium">Ετήσια Πίστωση</span>
                <span className="font-semibold">{formatCurrency(project.ethsia_pistosi)}</span>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded bg-gray-50 p-2">
              <div className="text-xs text-gray-500">MIS</div>
              <div className="font-medium">{project.mis}</div>
            </div>
            <div className="rounded bg-gray-50 p-2">
              <div className="text-xs text-gray-500">NA853</div>
              <div className="font-medium">{project.na853 || "N/A"}</div>
            </div>
          </div>
        </div>
      </CardContent>

      {isAdmin && (
        <CardFooter className="flex justify-end gap-2 border-t p-4">
          <Link href={`/projects/${project.id}/edit`}>
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
  );
}