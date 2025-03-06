import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { useToast } from "@/hooks/use-toast";
import { type ProjectCatalog } from "@shared/schema";
import { Plus, FileUp, Download, LayoutGrid, LayoutList, FileEdit, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef } from "react";
import { Header } from "@/components/header";
import { FAB } from "@/components/ui/fab";

interface APIResponse<T = any> {
  ok: boolean;
  json(): Promise<T>;
  blob(): Promise<Blob>;
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { data: projects, isLoading } = useQuery<ProjectCatalog[]>({
    queryKey: ["/api/projects", { search: debouncedSearch, status: status !== "all" ? status : undefined }],
    enabled: true,
  });

  const handleExport = async () => {
    try {
      toast({
        title: "Έναρξη Εξαγωγής",
        description: "Παρακαλώ περιμένετε όσο προετοιμάζεται το αρχείο σας...",
      });

      const response = await fetch("/api/projects/export/xlsx", {
        method: "GET",
        headers: {
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

      if (!response.ok) {
        let errorMessage = 'Η εξαγωγή απέτυχε';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || 'Η εξαγωγή απέτυχε';
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projects-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Επιτυχής Εξαγωγή",
        description: "Τα δεδομένα των έργων έχουν εξαχθεί σε Excel",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Αποτυχία Εξαγωγής",
        description: error instanceof Error ? error.message : "Αποτυχία εξαγωγής δεδομένων έργων",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiRequest("/api/projects/bulk-upload", {
        method: "POST",
        body: formData,
      }) as APIResponse;

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Η μεταφόρτωση απέτυχε");
      }

      toast({
        title: "Επιτυχής Μεταφόρτωση",
        description: "Τα έργα ενημερώθηκαν με επιτυχία",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setUploadDialogOpen(false);
    } catch (error) {
      toast({
        title: "Αποτυχία Μεταφόρτωσης",
        description: error instanceof Error ? error.message : "Αποτυχία μεταφόρτωσης δεδομένων έργων",
        variant: "destructive",
      });
    }
  };

  // Filter projects based on search and status
  const filteredProjects = projects?.filter(project => {
    const searchMatch = !debouncedSearch ||
      project.event_description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.mis?.toString().includes(debouncedSearch) ||
      project.region?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.na853?.toLowerCase().includes(debouncedSearch.toLowerCase());

    const statusMatch = status === "all" || project.status === status;

    return searchMatch && statusMatch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <h1 className="text-3xl font-bold">Έργα</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView(view === "grid" ? "list" : "grid")}
            >
              {view === "grid" ? (
                <><LayoutList className="mr-2 h-4 w-4" /> Προβολή Λίστας</>
              ) : (
                <><LayoutGrid className="mr-2 h-4 w-4" /> Προβολή Πλέγματος</>
              )}
            </Button>
            {isAdmin && (
              <>
                <Link href="/projects/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Νέο Έργο
                  </Button>
                </Link>
                <Button variant="secondary" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Εξαγωγή
                </Button>
                <Link href="/projects/bulk-update">
                  <Button variant="outline">
                    <FileEdit className="mr-2 h-4 w-4" />
                    Μαζική Ενημέρωση
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Μεταφόρτωση CSV
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <Input
              placeholder="Αναζήτηση με MIS, περιγραφή, περιοχή..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:w-96"
            />
            <Select
              value={status}
              onValueChange={setStatus}
            >
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Φιλτράρισμα κατά κατάσταση" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι Καταστάσεις</SelectItem>
                <SelectItem value="active">Ενεργό</SelectItem>
                <SelectItem value="pending">Σε Εκκρεμότητα</SelectItem>
                <SelectItem value="pending_reallocation">Σε Αναμονή Ανακατανομής</SelectItem>
                <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className={view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
              {[...Array(6)].map((_, i) => (
                <div key={`skeleton-${i}`} className="h-48 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filteredProjects?.length ? (
            <div className={view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={`${project.id}-${project.mis}`}
                  project={project}
                  view={view}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <p className="text-muted-foreground">Δεν βρέθηκαν έργα</p>
            </div>
          )}
        </div>

        {/* CSV Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Μεταφόρτωση CSV</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Επιλογή Αρχείου CSV
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      <FAB />
    </div>
  );
}