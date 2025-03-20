import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Building2, FileText, BriefcaseBusiness, Target, Clock } from "lucide-react";
import { type Project } from "@shared/schema";

interface ProjectDetailsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailsDialog({ project, open, onOpenChange }: ProjectDetailsDialogProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Details</DialogTitle>
        </DialogHeader>
        <div className="py-6">
          <div className="flex items-center justify-between mb-6">
            <Badge variant="secondary" className={getStatusColor(project.status || '')}>
              {getStatusText(project.status || '')}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold mb-4">
            {project.event_description || project.project_title || "Untitled Project"}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Project Metadata */}
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

              {project.event_type && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Target className="mr-2 h-4 w-4" />
                  Event Type: {Array.isArray(project.event_type) 
                    ? project.event_type.join(', ')
                    : project.event_type}
                </div>
              )}

              {project.event_year && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  Event Year: {Array.isArray(project.event_year) 
                    ? project.event_year.join(', ')
                    : project.event_year}
                </div>
              )}
            </div>

            {/* Budget Information */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Budget Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-muted-foreground">Budget NA853:</span>
                      <span className="font-medium">{formatCurrency(Number(project.budget_na853))}</span>
                    </div>
                    {project.budget_na271 && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Budget NA271:</span>
                        <span className="font-medium">{formatCurrency(Number(project.budget_na271))}</span>
                      </div>
                    )}
                    {project.budget_e069 && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Budget E069:</span>
                        <span className="font-medium">{formatCurrency(Number(project.budget_e069))}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Project Identifiers */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm text-gray-500 mb-1">MIS</h3>
              <p className="font-medium">{project.mis || "N/A"}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm text-gray-500 mb-1">NA853</h3>
              <p className="font-medium">{project.na853 || "N/A"}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm text-gray-500 mb-1">E069</h3>
              <p className="font-medium">{project.e069 || "N/A"}</p>
            </div>
          </div>

          {/* Related Documents Section */}
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-lg">Related Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.kya && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">KYA</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(project.kya) ? project.kya.join(', ') : project.kya}
                  </p>
                </div>
              )}

              {project.fek && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">FEK</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(project.fek) ? project.fek.join(', ') : project.fek}
                  </p>
                </div>
              )}

              {project.ada && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">ADA</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(project.ada) ? project.ada.join(', ') : project.ada}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Documents */}
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-lg">Additional Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.budget_decision && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                    <span className="font-medium">Budget Decisions</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(project.budget_decision) ? project.budget_decision.join(', ') : project.budget_decision}
                  </p>
                </div>
              )}

              {project.funding_decision && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                    <span className="font-medium">Funding Decisions</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(project.funding_decision) ? project.funding_decision.join(', ') : project.funding_decision}
                  </p>
                </div>
              )}

              {project.allocation_decision && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                    <span className="font-medium">Allocation Decisions</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(project.allocation_decision) ? project.allocation_decision.join(', ') : project.allocation_decision}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}