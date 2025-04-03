import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, MapPin, Building2, FileText, ArrowLeft } from "lucide-react";
import { Header } from "@/components/header";
import { type Project } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function ProjectDetailsPage() {
  const { mis } = useParams<{ mis: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  console.log("Project Details Page - MIS Parameter:", mis);

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${mis}`], // Direct API route matching
    enabled: !!mis && !!user // Only fetch if we have both MIS and user
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Project Not Found</h1>
              <Button variant="outline" asChild>
                <Link href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Link>
              </Button>
            </div>
            <Card className="p-6 bg-red-50">
              <p className="text-red-600">
                The requested project could not be found or you don't have permission to view it.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '€0,00';
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
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
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild className="mr-4">
                <Link href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Link>
              </Button>
              <Badge variant="secondary" className={getStatusColor(project.status || '')}>
                {getStatusText(project.status || '')}
              </Badge>
            </div>
            {isAdmin && (
              <Button variant="outline" asChild>
                <Link href={`/projects/${mis}/edit`}>
                  Edit Project
                </Link>
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold mb-4">
                {project.event_description || project.project_title || "Untitled Project"}
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
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

                  {project.implementing_agency && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Building2 className="mr-2 h-4 w-4" />
                      {Array.isArray(project.implementing_agency) 
                        ? project.implementing_agency.join(', ')
                        : project.implementing_agency}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Budget Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Budget NA853:</span>
                        <span className="font-medium">{formatCurrency(Number(project.budget_na853))}</span>
                      </div>
                      {project.budget_na271 && (
                        <div className="flex justify-between">
                          <span>Budget NA271:</span>
                          <span className="font-medium">{formatCurrency(Number(project.budget_na271))}</span>
                        </div>
                      )}
                      {project.budget_e069 && (
                        <div className="flex justify-between">
                          <span>Budget E069:</span>
                          <span className="font-medium">{formatCurrency(Number(project.budget_e069))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm text-gray-500 mb-1">MIS</h3>
                  <p className="font-medium">{project.mis || "N/A"}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm text-gray-500 mb-1">NA853</h3>
                  <p className="font-medium">{project.na853 || "N/A"}</p>
                </div>
              </div>

              {project.kya && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Related Documents</h3>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>KYA: {Array.isArray(project.kya) ? project.kya.join(', ') : project.kya}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}