import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { type Project } from "@shared/schema";
import { Plus, FileUp, Download, LayoutGrid, LayoutList } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef } from "react";
import { Header } from "@/components/header";

export default function ProjectsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
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

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", { search: debouncedSearch, status: status !== "all" ? status : undefined }],
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
  const filteredProjects = projects?.filter(project => {
    const searchMatch = !debouncedSearch ||
      project.event_description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.mis?.toString().includes(debouncedSearch) ||
      (project.region as any)?.region?.[0]?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      project.na853?.toLowerCase().includes(debouncedSearch.toLowerCase());

    const statusMatch = status === "all" || project.status === status;

    return searchMatch && statusMatch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <h1 className="text-3xl font-bold">Projects</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView(view === "grid" ? "list" : "grid")}
            >
              {view === "grid" ? (
                <><LayoutList className="mr-2 h-4 w-4" /> List View</>
              ) : (
                <><LayoutGrid className="mr-2 h-4 w-4" /> Grid View</>
              )}
            </Button>
            {isAdmin && (
              <>
                <Link href="/projects/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </Link>
                <Button variant="secondary" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <Input
              placeholder="Search by MIS, description, region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:w-96"
            />
            <Select
              value={status}
              onValueChange={setStatus}
            >
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="pending_reallocation">Pending Reallocation</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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
                  key={project.id}
                  project={project}
                  view={view}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <p className="text-muted-foreground">No projects found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}