import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptimizedProjectCard } from "@/components/projects/OptimizedProjectCard";
import { ComprehensiveProjectsModal } from "@/components/projects/ComprehensiveProjectsModal";
import { useToast } from "@/hooks/use-toast";
import { type Project, type OptimizedProject } from "@shared/schema";
import { Plus, FileUp, Download, LayoutGrid, LayoutList, Upload, FolderOpen, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

import { useRef } from "react";
import { Header } from "@/components/header";

export default function ProjectsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Check if user is a manager (any role other than 'admin' or 'user' is considered a manager)
  const isManager = user?.role === 'manager';
  // Allow both admin and manager to access export functionality
  const canExport = isAdmin || isManager;
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [comprehensiveModalOpen, setComprehensiveModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log("Current user:", user);
  console.log("Is admin:", isAdmin);
  console.log("Is manager:", isManager);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { data: projects, isLoading, error } = useQuery<OptimizedProject[]>({
    queryKey: ["/api/projects/cards"],
    staleTime: 5 * 60 * 1000, // 5 minutes cache for better performance
    gcTime: 15 * 60 * 1000, // 15 minutes cache retention
    refetchOnWindowFocus: false,
  });

  const handleExport = async () => {
    try {
      toast({
        title: "Starting Export",
        description: "Please wait while your file is being prepared...",
      });

      const response = await fetch("/api/projects/export/xlsx", {
        method: "GET",
        headers: {
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
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
        title: "Export Successful",
        description: "Project data has been exported to Excel",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export project data",
        variant: "destructive",
      });
    }
  };

  // Filter projects based on search and status
  const filteredProjects = Array.isArray(projects) ? projects.filter((project: OptimizedProject) => {
    const searchMatch = !debouncedSearch ||
      project.event_description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.project_title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.mis?.toString().includes(debouncedSearch) ||
      project.na853?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.event_type?.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.expenditure_type?.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.unit?.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.region?.region?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.region?.regional_unit?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.region?.municipality?.toLowerCase().includes(debouncedSearch.toLowerCase());

    const statusMatch = status === "all" || project.status === status;

    return searchMatch && statusMatch;
  }) : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            {/* Header with Actions */}
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
              <h1 className="text-2xl font-bold text-foreground">Έργα</h1>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setView(view === "grid" ? "list" : "grid")}
                >
                  {view === "grid" ? (
                    <><LayoutList className="mr-2 h-4 w-4" /> Λίστα</>
                  ) : (
                    <><LayoutGrid className="mr-2 h-4 w-4" /> Κάρτες</>
                  )}
                </Button>
                
                {isAdmin && (
                  <Link href="/projects/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Νέο Έργο
                    </Button>
                  </Link>
                )}
                
                {isAdmin && (
                  <Link href="/admin/budget-upload">
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Μεταφόρτωση Προϋπολογισμού
                    </Button>
                  </Link>
                )}
                
                {canExport && (
                  <Button variant="secondary" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Εξαγωγή
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => setComprehensiveModalOpen(true)}
                  className="bg-blue-50 border-blue-200 hover:bg-blue-100"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Ολοκληρωμένη Προβολή
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Αναζήτηση</label>
                <Input
                  placeholder="Αναζήτηση κατά MIS, περιγραφή, περιοχή..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Κατάσταση</label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε κατάσταση" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Όλες οι Καταστάσεις</SelectItem>
                    <SelectItem value="active">Ενεργό</SelectItem>
                    <SelectItem value="pending">Σε Εκκρεμότητα</SelectItem>
                    <SelectItem value="pending_reallocation">Εκκρεμής Αναδιανομή</SelectItem>
                    <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results */}
            {isLoading ? (
              <div className={view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {[...Array(6)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="h-48 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredProjects?.length ? (
              <div className={view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {filteredProjects.map((project, index) => (
                  <OptimizedProjectCard
                    key={`${project.na853 || 'na853-' + index}-${project.mis || 'mis-' + index}`}
                    project={project}
                    view={view}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FolderOpen className="h-8 w-8" />
                  <p>Δεν βρέθηκαν έργα</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      
      {/* Comprehensive Projects Modal */}
      <ComprehensiveProjectsModal 
        open={comprehensiveModalOpen}
        onOpenChange={setComprehensiveModalOpen}
      />
    </div>
  );
}