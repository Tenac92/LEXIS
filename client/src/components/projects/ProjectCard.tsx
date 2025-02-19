import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ProjectCatalog } from "@shared/schema";
import { Edit, Trash2, Calendar, MapPin, Building2, Eye, Copy, Coins, FileText } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface ProjectCardProps {
  project: ProjectCatalog;
  view?: "grid" | "list";
}

export function ProjectCard({ project, view = "grid" }: ProjectCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} has been copied to clipboard`,
    });
  };

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

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return '€0,00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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

  const cardContent = (
    <>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold">
            {project.event_description || "Untitled Project"}
          </h3>
          <Badge variant="secondary" className={getStatusColor(project.status || '')}>
            {getStatusText(project.status || '')}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              Created: {formatDate(project.created_at)}
            </div>
            {project.region && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                {project.region}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="font-medium">
              Budget: {formatCurrency(project.budget_na853)}
            </div>
            {project.ethsia_pistosi && (
              <div className="text-sm text-muted-foreground">
                Annual Credit: {formatCurrency(project.ethsia_pistosi)}
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
    </>
  );

  const dialogDescription = `Detailed information for project ${project.mis || ''} - ${project.event_description || ''}`;

  return (
    <Card className={`transition-shadow hover:shadow-lg ${view === "list" ? "flex" : ""}`}>
      <Dialog>
        <DialogTrigger asChild>
          <CardContent className={`p-6 cursor-pointer ${view === "list" ? "flex-1" : ""}`}>
            {cardContent}
          </CardContent>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-2xl font-bold">{project.event_description || "Project Details"}</span>
              <Badge variant="secondary" className={`${getStatusColor(project.status || '')} px-4 py-1.5`}>
                {getStatusText(project.status || '')}
              </Badge>
            </DialogTitle>
            <DialogDescription id="dialog-description" className="mt-2 text-gray-600">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-8">
            {/* Key Information Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Key Information
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-gray-600">MIS</h4>
                    <button 
                      onClick={() => copyToClipboard(project.mis || '', 'MIS')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-gray-900 font-medium">{project.mis || "N/A"}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-gray-600">NA853</h4>
                    <button 
                      onClick={() => copyToClipboard(project.na853 || '', 'NA853')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-gray-900 font-medium">{project.na853 || "N/A"}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Region</h4>
                  <p className="text-gray-900 font-medium">{project.region || "N/A"}</p>
                </div>
              </div>
            </section>

            {/* Budget Information Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Budget Information
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Budget NA853</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.budget_na853)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Budget E069</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.budget_e069)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Budget NA271</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.budget_na271)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Annual Credit</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.ethsia_pistosi)}</p>
                </div>
              </div>
            </section>

            {/* Additional Details Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Additional Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.implementing_agency && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Implementing Agency</h4>
                    <p className="text-gray-900">{Array.isArray(project.implementing_agency) ? project.implementing_agency.join(", ") : project.implementing_agency}</p>
                  </div>
                )}
                {project.event_type && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Event Type</h4>
                    <p className="text-gray-900">{project.event_type}</p>
                  </div>
                )}
                {project.municipality && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Municipality</h4>
                    <p className="text-gray-900">{project.municipality}</p>
                  </div>
                )}
                {project.procedures && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 col-span-full">
                    <h4 className="font-semibold text-sm text-gray-600">Procedures</h4>
                    <p className="text-gray-900 whitespace-pre-wrap">{project.procedures}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Timestamps Section */}
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Created At</h4>
                  <p className="text-gray-900">{formatDate(project.created_at)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Last Updated</h4>
                  <p className="text-gray-900">{formatDate(project.updated_at)}</p>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

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