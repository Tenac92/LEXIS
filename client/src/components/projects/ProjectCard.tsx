import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Project } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface APIResponse<T = any> {
  ok: boolean;
  json(): Promise<T>;
  blob(): Promise<Blob>;
}

interface ProjectCardProps {
  project: Project;
  view?: "grid" | "list";
  isAdmin: boolean;
}

export function ProjectCard({ project, view = "grid", isAdmin }: ProjectCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Αντιγράφηκε!",
      description: `${label} έχει αντιγραφεί στο πρόχειρο`,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${project.mis}`, {
        method: "DELETE",
      }) as APIResponse;

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Αποτυχία διαγραφής έργου");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Διαγραφή Έργου",
        description: "Το έργο διαγράφηκε με επιτυχία",
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
            {project.event_description || "Έργο χωρίς τίτλο"}
          </h3>
          <Badge variant="secondary" className={getStatusColor(project.status || '')}>
            {getStatusText(project.status || '')}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              Δημιουργήθηκε: {formatDate(project.created_at)}
            </div>
            {project.region?.region && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                {project.region.region.join(', ')}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="font-medium">
              Προϋπολογισμός: {formatCurrency(project.budget_na853)}
            </div>
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

  return (
    <Card className={`transition-shadow hover:shadow-lg ${view === "list" ? "flex" : ""}`}>
      <Dialog>
        <DialogTrigger asChild>
          <CardContent className={`p-6 cursor-pointer ${view === "list" ? "flex-1" : ""}`}>
            {cardContent}
          </CardContent>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Στοιχεία Έργου</DialogTitle>
            <DialogDescription>
              Έργο {project.mis || 'N/A'} - {project.event_description || 'Χωρίς περιγραφή'}
            </DialogDescription>
          </DialogHeader>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{project.event_description || "Στοιχεία Έργου"}</span>
                <Badge variant="secondary" className={`${getStatusColor(project.status || '')} px-4 py-1.5`}>
                  {getStatusText(project.status || '')}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 space-y-8">
            {/* Βασικές Πληροφορίες */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Βασικές Πληροφορίες
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-gray-600">MIS</h4>
                    <button
                      onClick={() => copyToClipboard(project.mis || '', 'MIS')}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="Αντιγραφή αριθμού MIS"
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
                      aria-label="Αντιγραφή αριθμού NA853"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-gray-900 font-medium">{project.na853 || "N/A"}</p>
                </div>
                {project.region?.region && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Περιοχή</h4>
                    <p className="text-gray-900 font-medium">{project.region.region.join(', ')}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Πληροφορίες Προϋπολογισμού */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Πληροφορίες Προϋπολογισμού
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Προϋπολογισμός NA853</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.budget_na853)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Προϋπολογισμός E069</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.budget_e069)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Προϋπολογισμός NA271</h4>
                  <p className="text-gray-900 font-medium">{formatCurrency(project.budget_na271)}</p>
                </div>
              </div>
            </section>

            {/* Πρόσθετες Πληροφορίες */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Πρόσθετες Πληροφορίες
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.implementing_agency && project.implementing_agency.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Φορέας Υλοποίησης</h4>
                    <p className="text-gray-900">{project.implementing_agency.join(", ")}</p>
                  </div>
                )}
                {project.event_type && project.event_type.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Τύπος Συμβάντος</h4>
                    <p className="text-gray-900">{project.event_type.join(", ")}</p>
                  </div>
                )}
                {project.region?.municipality && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm text-gray-600">Δήμος</h4>
                    <p className="text-gray-900">{project.region.municipality.join(", ")}</p>
                  </div>
                )}
                {project.procedures && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 col-span-full">
                    <h4 className="font-semibold text-sm text-gray-600">Διαδικασίες</h4>
                    <p className="text-gray-900 whitespace-pre-wrap">{project.procedures}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Χρονικά Στοιχεία */}
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Ημερομηνία Δημιουργίας</h4>
                  <p className="text-gray-900">{formatDate(project.created_at)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm text-gray-600">Τελευταία Ενημέρωση</h4>
                  <p className="text-gray-900">{formatDate(project.updated_at)}</p>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <CardFooter className="flex justify-end gap-2 border-t p-4">
          <Link href={`/projects/${project.mis}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Επεξεργασία
            </Button>
          </Link>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
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
        </CardFooter>
      )}
    </Card>
  );
}