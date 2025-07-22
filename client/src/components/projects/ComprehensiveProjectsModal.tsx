import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { 
  Building2, 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  Calendar, 
  Euro,
  Search,
  Filter,
  Hash,
  Briefcase
} from "lucide-react";

interface OrganizedProject {
  id: number;
  na853: string;
  event_description: string;
  project_title?: string;
  expenditureTypes: string[];
  eventTypes: string[];
  regions: string[];
  budget_na853?: number;
  status?: string;
  created_at?: string;
}

interface OrganizationalUnit {
  id: string;
  name: string;
  fullName: any;
  email?: string;
}

interface OrganizedProjectData {
  unit: OrganizationalUnit;
  projects: OrganizedProject[];
}

interface ComprehensiveProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComprehensiveProjectsModal({ open, onOpenChange }: ComprehensiveProjectsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const { data: organizedData, isLoading, error } = useQuery<OrganizedProjectData[]>({
    queryKey: ['/api/projects/organized'],
    staleTime: 10 * 60 * 1000, // 10 minutes cache for better performance
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    refetchOnWindowFocus: false,
    enabled: open,
  });

  const filteredData = organizedData?.filter(orgData => {
    const unitMatchesSearch = !searchTerm || 
      orgData.unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (typeof orgData.unit.fullName === 'object' && orgData.unit.fullName?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const hasMatchingProjects = orgData.projects.some(project =>
      project.na853.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.event_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.eventTypes.some(et => et.toLowerCase().includes(searchTerm.toLowerCase())) ||
      project.expenditureTypes.some(et => et.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const unitMatches = !selectedUnit || orgData.unit.id === selectedUnit;
    
    return unitMatches && (unitMatchesSearch || hasMatchingProjects);
  });

  const toggleUnit = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const getUnitDisplayName = (unit: OrganizationalUnit) => {
    if (typeof unit.fullName === 'object' && unit.fullName?.name) {
      return unit.fullName.name;
    }
    return unit.name;
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "Δ/Υ";
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Ολοκληρωμένη Προβολή Έργων</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Φόρτωση δεδομένων έργων...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Ολοκληρωμένη Προβολή Έργων</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-red-600">
              <p>Σφάλμα κατά τη φόρτωση των δεδομένων</p>
              <p className="text-sm mt-2">Παρακαλώ δοκιμάστε ξανά</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Ολοκληρωμένη Προβολή Έργων
          </DialogTitle>
          <p className="text-gray-600">
            Έργα οργανωμένα ανά οργανωτική μονάδα με τύπους δαπανών και περιοχές
          </p>
        </DialogHeader>

        {/* Search and Filter Controls */}
        <div className="flex gap-4 py-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Αναζήτηση έργων, μονάδων, τύπων..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={selectedUnit || ""}
            onChange={(e) => setSelectedUnit(e.target.value || null)}
            className="px-3 py-2 border rounded-md bg-white"
          >
            <option value="">Όλες οι μονάδες</option>
            {organizedData?.map(orgData => (
              <option key={orgData.unit.id} value={orgData.unit.id}>
                {orgData.unit.name}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setSelectedUnit(null);
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            Καθαρισμός
          </Button>
        </div>

        {/* Project Data */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
            {filteredData?.map((orgData) => (
              <Card key={orgData.unit.id} className="border-l-4 border-l-blue-500">
                <Collapsible 
                  open={expandedUnits.has(orgData.unit.id)}
                  onOpenChange={() => toggleUnit(orgData.unit.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedUnits.has(orgData.unit.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-500" />
                          )}
                          <Building2 className="h-6 w-6 text-blue-600" />
                          <div>
                            <CardTitle className="text-lg font-semibold text-gray-900">
                              {orgData.unit.name}
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                              {getUnitDisplayName(orgData.unit)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {orgData.projects.length} έργα
                          </Badge>
                          {orgData.unit.email && (
                            <p className="text-xs text-gray-500 mt-1">{orgData.unit.email}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid gap-4">
                        {orgData.projects.map((project) => (
                          <div
                            key={project.id}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Hash className="h-4 w-4 text-gray-500" />
                                  <span className="font-mono text-sm font-semibold text-blue-700">
                                    {project.na853}
                                  </span>
                                  {project.status && (
                                    <Badge 
                                      variant={project.status === 'completed' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {project.status}
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-semibold text-gray-900 mb-1">
                                  {project.event_description}
                                </h4>
                                {project.project_title && (
                                  <p className="text-sm text-gray-600 mb-3">
                                    {project.project_title}
                                  </p>
                                )}
                              </div>
                              
                              <div className="text-right ml-4">
                                {project.budget_na853 && (
                                  <div className="flex items-center text-green-700 font-semibold">
                                    <Euro className="h-4 w-4 mr-1" />
                                    {formatCurrency(project.budget_na853)}
                                  </div>
                                )}
                                {project.created_at && (
                                  <div className="flex items-center text-xs text-gray-500 mt-1">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {new Date(project.created_at).toLocaleDateString('el-GR')}
                                  </div>
                                )}
                              </div>
                            </div>

                            <Separator className="my-3" />

                            {/* Event Types */}
                            {project.eventTypes.length > 0 && (
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Briefcase className="h-4 w-4 text-orange-600" />
                                  <span className="text-sm font-medium text-gray-700">
                                    Τύποι Συμβάντων:
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {project.eventTypes.map((eventType, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs bg-orange-50 border-orange-200">
                                      {eventType}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Expenditure Types */}
                            {project.expenditureTypes.length > 0 && (
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Euro className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-medium text-gray-700">
                                    Τύποι Δαπανών:
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {project.expenditureTypes.map((expType, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs bg-green-50 border-green-200">
                                      {expType}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Regions */}
                            {project.regions.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <MapPin className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-700">
                                    Περιοχές:
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {project.regions.map((region, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs bg-blue-50 border-blue-200">
                                      {region}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {/* Footer with Statistics */}
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              Σύνολο: {filteredData?.length || 0} οργανωτικές μονάδες, {' '}
              {filteredData?.reduce((sum, org) => sum + org.projects.length, 0) || 0} έργα
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Κλείσιμο
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}