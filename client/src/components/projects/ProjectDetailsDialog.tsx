import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Building2, Calendar, Euro, FileText, Users, Settings, AlertCircle } from 'lucide-react';
import { formatEuropeanNumber } from '@/lib/number-format';

interface ProjectDetailsDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Comprehensive interface definitions based on actual database schema
interface BudgetData {
  id?: number;
  project_id?: number;
  mis?: number;
  na853?: string;
  total_amount?: string | number;
  q1_amount?: string | number;
  q2_amount?: string | number;
  q3_amount?: string | number;
  q4_amount?: string | number;
  budget_year?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectIndexEntry {
  project_id?: number;
  monada_id?: number;
  kallikratis_id?: number;
  event_types_id?: number;
  expediture_type_id?: number;
  geographic_code?: number;
  // Related data from joins
  monada?: {
    id?: string;
    unit?: string;
    unit_name?: any; // JSONB field
    email?: string;
    manager?: any; // JSONB field
    address?: any; // JSONB field
  };
  kallikratis?: {
    id?: number;
    kodikos_neou_ota?: number;
    eidos_neou_ota?: string;
    onoma_neou_ota?: string;
    kodikos_perifereiakis_enotitas?: number;
    perifereiaki_enotita?: string;
    kodikos_perifereias?: number;
    perifereia?: string;
  };
  event_types?: {
    id?: number;
    name?: string;
  };
  expediture_types?: {
    id?: number;
    expediture_types?: string;
    expediture_types_minor?: string;
  };
}

interface DecisionData {
  id?: number;
  project_id?: number;
  decision_sequence?: number;
  decision_type?: string;
  protocol_number?: string;
  fek?: string;
  ada?: string;
  implementing_agency?: string;
  decision_budget?: string | number;
  expenses_covered?: string | number;
  decision_date?: string;
  is_included?: boolean;
  is_active?: boolean;
  comments?: string;
  budget_decision?: string;
  funding_decision?: string;
  allocation_decision?: string;
  created_at?: string;
  updated_at?: string;
}

interface FormulationData {
  id?: number;
  project_id?: number;
  decision_id?: number;
  formulation_sequence?: number;
  sa_type?: string;
  enumeration_code?: string;
  protocol_number?: string;
  ada?: string;
  decision_year?: number;
  project_budget?: string | number;
  total_public_expense?: string | number;
  eligible_public_expense?: string | number;
  epa_version?: string;
  decision_status?: string;
  change_type?: string;
  connected_decision_ids?: number[];
  comments?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  // Related decision data from join
  project_decisions?: {
    id?: number;
    decision_type?: string;
    protocol_number?: string;
    fek?: string;
    ada?: string;
  };
}

export const ProjectDetailsDialog: React.FC<ProjectDetailsDialogProps> = ({
  project,
  open,
  onOpenChange,
}) => {
  if (!project) return null;

  // Extract project details safely with comprehensive error handling
  const projectData = project as any;
  const projectId = projectData?.id;
  const projectMis = projectData?.mis;

  // Comprehensive data fetching with proper error handling
  const { data: budgetData, isLoading: budgetLoading, error: budgetError } = useQuery({
    queryKey: [`/api/budget/${projectMis}`],
    enabled: !!projectMis && open,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: projectIndexData, isLoading: indexLoading, error: indexError } = useQuery({
    queryKey: [`/api/projects/${projectMis}/index`],
    enabled: !!projectMis && open,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const { data: decisionsData, isLoading: decisionsLoading, error: decisionsError } = useQuery({
    queryKey: [`/api/projects/${projectMis}/decisions`],
    enabled: !!projectMis && open,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const { data: formulationsData, isLoading: formulationsLoading, error: formulationsError } = useQuery({
    queryKey: [`/api/projects/${projectMis}/formulations`],
    enabled: !!projectMis && open,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = budgetLoading || indexLoading || decisionsLoading || formulationsLoading;
  const hasErrors = budgetError || indexError || decisionsError || formulationsError;

  // Enhanced data extraction with comprehensive validation
  const budgetInfo = React.useMemo(() => {
    if (!budgetData) return null;
    // Handle both single object and array responses
    if (Array.isArray(budgetData)) {
      return budgetData[0] as BudgetData || null;
    }
    return budgetData as BudgetData;
  }, [budgetData]);

  const indexEntries = React.useMemo(() => {
    if (!projectIndexData) return [];
    return (Array.isArray(projectIndexData) ? projectIndexData : [projectIndexData]) as ProjectIndexEntry[];
  }, [projectIndexData]);

  const decisions = React.useMemo(() => {
    if (!decisionsData) return [];
    return (Array.isArray(decisionsData) ? decisionsData : [decisionsData]) as DecisionData[];
  }, [decisionsData]);

  const formulations = React.useMemo(() => {
    if (!formulationsData) return [];
    return (Array.isArray(formulationsData) ? formulationsData : [formulationsData]) as FormulationData[];
  }, [formulationsData]);

  // Enhanced helper functions with proper data type handling
  const formatCurrency = React.useCallback((value: any): string => {
    if (value === null || value === undefined || value === '') return 'Δεν υπάρχει';
    
    // Handle string decimals from database
    let numValue: number;
    if (typeof value === 'string') {
      numValue = parseFloat(value);
    } else if (typeof value === 'number') {
      numValue = value;
    } else {
      return 'Δεν υπάρχει';
    }
    
    if (isNaN(numValue) || numValue === 0) return 'Δεν υπάρχει';
    return formatEuropeanNumber(numValue) + ' €';
  }, []);

  const safeText = React.useCallback((value: any): string => {
    if (value === null || value === undefined || value === '') return 'Δεν υπάρχει';
    if (typeof value === 'object') {
      // Handle JSONB fields
      if (typeof value === 'object' && value.toString) {
        return value.toString();
      }
      return JSON.stringify(value);
    }
    return String(value);
  }, []);

  const formatDate = React.useCallback((dateValue: any): string => {
    if (!dateValue) return 'Δεν υπάρχει';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Δεν υπάρχει';
      return date.toLocaleDateString('el-GR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Δεν υπάρχει';
    }
  }, []);

  // Enhanced unit name extraction from JSONB
  const extractUnitName = React.useCallback((unitName: any): string => {
    if (!unitName) return 'Δεν υπάρχει';
    if (typeof unitName === 'string') return unitName;
    if (typeof unitName === 'object') {
      // Handle JSONB structure
      if (unitName.name) return unitName.name;
      if (unitName.title) return unitName.title;
      if (Array.isArray(unitName) && unitName.length > 0) return unitName[0];
      return JSON.stringify(unitName);
    }
    return String(unitName);
  }, []);

  // Error display component
  const ErrorDisplay: React.FC<{ error: any; title: string }> = ({ error, title }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-red-800">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-red-600 text-sm mt-2">
        {error?.message || 'Αδυναμία φόρτωσης δεδομένων'}
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">
            Λεπτομέρειες Έργου: {safeText(projectData?.project_title)}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            <span>MIS: {safeText(projectData?.mis)}</span>
            <span>•</span>
            <span>NA853: {safeText(projectData?.na853)}</span>
            {projectData?.status && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-xs">
                  {projectData.status}
                </Badge>
              </>
            )}
            {projectId && (
              <>
                <span>•</span>
                <span className="text-xs">ID: {projectId}</span>
              </>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="flex items-center gap-2 text-xs">
              <Building2 className="h-4 w-4" />
              Βασικά στοιχεία
            </TabsTrigger>
            <TabsTrigger value="budget" className="flex items-center gap-2 text-xs">
              <Euro className="h-4 w-4" />
              Οικονομικά
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2 text-xs">
              <FileText className="h-4 w-4" />
              Λεπτομέρειες
            </TabsTrigger>
            <TabsTrigger value="technical" className="flex items-center gap-2 text-xs">
              <Settings className="h-4 w-4" />
              Τεχνικά
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 max-h-[calc(90vh-200px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-lg">Φόρτωση δεδομένων...</span>
              </div>
            ) : (
              <>
                {/* Βασικά στοιχεία - Specific Fields as Requested */}
                <TabsContent value="basic" className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-semibold text-green-800">Βασικά Στοιχεία Έργου</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Projects table
                      </Badge>
                    </div>
                    
                    <div className="bg-white rounded-lg p-6 border border-green-100 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Συμβάν:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              {safeText(projectData?.event_description)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Έτος εκδήλωσης:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              {Array.isArray(projectData?.event_year) 
                                ? projectData.event_year.join(', ') 
                                : safeText(projectData?.event_year)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Περιοχή (Περιφέρεια):</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              {indexEntries.length > 0 && indexEntries[0]?.kallikratis?.perifereia 
                                ? indexEntries[0].kallikratis.perifereia 
                                : 'Δεν υπάρχει'}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">MIS:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm font-mono">
                              {safeText(projectData?.mis)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">ΣΑ:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              ΝΑ853
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Κωδ. Ενάριθμος na853:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm font-mono">
                              {safeText(projectData?.na853)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Έτος ένταξης:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              {Array.isArray(projectData?.event_year) && projectData.event_year.length > 0
                                ? projectData.event_year[0] 
                                : safeText(projectData?.event_year)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Τίτλος έργου:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              {safeText(projectData?.project_title)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Συνοπτική περιγραφή:</span>
                            <p className="text-gray-900 bg-green-50 p-2 rounded text-sm">
                              {safeText(projectData?.event_description)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Δαπάνες έργου:</span>
                            <div className="space-y-2">
                              {projectData?.budget_na853 && (
                                <div className="bg-green-50 p-2 rounded text-sm">
                                  <span className="font-medium">ΝΑ853: </span>
                                  <span className="font-bold text-green-800">{formatCurrency(projectData.budget_na853)}</span>
                                </div>
                              )}
                              {projectData?.budget_na271 && (
                                <div className="bg-green-50 p-2 rounded text-sm">
                                  <span className="font-medium">ΝΑ271: </span>
                                  <span className="font-bold text-green-800">{formatCurrency(projectData.budget_na271)}</span>
                                </div>
                              )}
                              {projectData?.budget_e069 && (
                                <div className="bg-green-50 p-2 rounded text-sm">
                                  <span className="font-medium">E069: </span>
                                  <span className="font-bold text-green-800">{formatCurrency(projectData.budget_e069)}</span>
                                </div>
                              )}
                              {!projectData?.budget_na853 && !projectData?.budget_na271 && !projectData?.budget_e069 && (
                                <p className="text-gray-500 bg-gray-50 p-2 rounded text-sm">
                                  Δεν υπάρχουν διαθέσιμα στοιχεία δαπανών
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <span className="font-medium text-green-700 block mb-1">Κατάσταση έργου:</span>
                            <div className="bg-green-50 p-2 rounded">
                              <Badge variant="outline" className="text-green-700 border-green-300">
                                {safeText(projectData?.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Οικονομικά Στοιχεία - Budget Data */}
                <TabsContent value="budget" className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Euro className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-blue-800">Οικονομικά Στοιχεία</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        budget_na853_split
                      </Badge>
                    </div>
                    
                    {budgetError ? (
                      <ErrorDisplay error={budgetError} title="Σφάλμα φόρτωσης οικονομικών στοιχείων" />
                    ) : budgetInfo ? (
                      <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                            <span className="font-medium text-blue-700 block mb-2">Συνολικό Ποσό:</span>
                            <p className="text-2xl font-bold text-blue-900">{formatCurrency(budgetInfo.total_amount)}</p>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                            <span className="font-medium text-gray-700 block mb-2">Έτος Προϋπολογισμού:</span>
                            <p className="text-xl font-semibold text-gray-900">{safeText(budgetInfo.budget_year)}</p>
                            <p className="text-sm text-gray-600">ΝΑ853: {safeText(budgetInfo.na853)}</p>
                          </div>
                        </div>
                        
                        <Separator className="my-6" />
                        
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Τριμηνιαία Κατανομή
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                              <span className="font-medium text-green-700 block mb-1">Α' Τρίμηνο</span>
                              <p className="text-lg font-bold text-green-900">{formatCurrency(budgetInfo.q1_amount)}</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                              <span className="font-medium text-blue-700 block mb-1">Β' Τρίμηνο</span>
                              <p className="text-lg font-bold text-blue-900">{formatCurrency(budgetInfo.q2_amount)}</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                              <span className="font-medium text-orange-700 block mb-1">Γ' Τρίμηνο</span>
                              <p className="text-lg font-bold text-orange-900">{formatCurrency(budgetInfo.q3_amount)}</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200">
                              <span className="font-medium text-red-700 block mb-1">Δ' Τρίμηνο</span>
                              <p className="text-lg font-bold text-red-900">{formatCurrency(budgetInfo.q4_amount)}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-6 flex items-center justify-between">
                          {budgetInfo.status && (
                            <div>
                              <span className="font-medium text-gray-700">Κατάσταση: </span>
                              <Badge variant="secondary">{safeText(budgetInfo.status)}</Badge>
                            </div>
                          )}
                          <div className="text-sm text-gray-500">
                            {budgetInfo.created_at && (
                              <span>Δημιουργήθηκε: {formatDate(budgetInfo.created_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-8 border border-blue-100 text-center">
                        <Euro className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Δεν υπάρχουν στοιχεία στον πίνακα budget_na853_split</p>
                        <div className="text-left bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium mb-2">Διαθέσιμα στοιχεία από Projects:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <span className="font-medium text-gray-700">Προϋπολογισμός ΝΑ853:</span>
                              <p className="text-gray-900">{formatCurrency(projectData?.budget_na853)}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Προϋπολογισμός ΝΑ271:</span>
                              <p className="text-gray-900">{formatCurrency(projectData?.budget_na271)}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Προϋπολογισμός E069:</span>
                              <p className="text-gray-900">{formatCurrency(projectData?.budget_e069)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Λεπτομέρειες - Decisions & Formulations */}
                <TabsContent value="details" className="space-y-6">
                  {/* Project Decisions */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">Αποφάσεις που τεκμηριώνουν το έργο</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        project_decisions ({decisions.length})
                      </Badge>
                    </div>
                    
                    {decisionsError ? (
                      <ErrorDisplay error={decisionsError} title="Σφάλμα φόρτωσης αποφάσεων" />
                    ) : decisions.length > 0 ? (
                      <div className="space-y-4">
                        {decisions.map((decision, index) => (
                          <div key={decision.id || index} className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <Badge className="bg-purple-100 text-purple-800">
                                {decision.decision_sequence}. {safeText(decision.decision_type)}
                              </Badge>
                              {decision.is_active && (
                                <Badge variant="outline" className="text-green-600 border-green-300">
                                  Ενεργή
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div>
                                  <span className="font-medium text-purple-700 block text-sm">Αριθμός Πρωτοκόλλου:</span>
                                  <p className="text-purple-900">{safeText(decision.protocol_number)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-purple-700 block text-sm">ΦΕΚ:</span>
                                  <p className="text-purple-900">{safeText(decision.fek)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-purple-700 block text-sm">ΑΔΑ:</span>
                                  <p className="text-purple-900">{safeText(decision.ada)}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <span className="font-medium text-purple-700 block text-sm">Φορέας Υλοποίησης:</span>
                                  <p className="text-purple-900">{safeText(decision.implementing_agency)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-purple-700 block text-sm">Προϋπολογισμός:</span>
                                  <p className="text-purple-900 font-semibold">{formatCurrency(decision.decision_budget)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-purple-700 block text-sm">Καλυπτόμενες Δαπάνες:</span>
                                  <p className="text-purple-900">{formatCurrency(decision.expenses_covered)}</p>
                                </div>
                              </div>
                              {decision.comments && (
                                <div className="col-span-full">
                                  <span className="font-medium text-purple-700 block text-sm mb-1">Σχόλια:</span>
                                  <p className="text-purple-900 bg-purple-50 p-2 rounded text-sm">{decision.comments}</p>
                                </div>
                              )}
                              <div className="col-span-full text-xs text-gray-500">
                                Δημιουργήθηκε: {formatDate(decision.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-8 border border-purple-100 text-center">
                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">Δεν υπάρχουν αποφάσεις στον πίνακα project_decisions</p>
                      </div>
                    )}
                  </div>

                  {/* Project Formulations */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-5 w-5 text-orange-600" />
                      <h3 className="text-lg font-semibold text-orange-800">Στοιχεία κατάρτισης έργου</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        project_formulations ({formulations.length})
                      </Badge>
                    </div>
                    
                    {formulationsError ? (
                      <ErrorDisplay error={formulationsError} title="Σφάλμα φόρτωσης στοιχείων κατάρτισης" />
                    ) : formulations.length > 0 ? (
                      <div className="space-y-4">
                        {formulations.map((formulation, index) => (
                          <div key={formulation.id || index} className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <Badge className="bg-orange-100 text-orange-800">
                                {formulation.formulation_sequence}. {safeText(formulation.sa_type)}
                              </Badge>
                              <Badge variant="outline" className="text-sm">
                                {safeText(formulation.decision_status)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Κωδικός ενάριθμος:</span>
                                  <p className="text-orange-900">{safeText(formulation.enumeration_code)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Πρωτόκολλο:</span>
                                  <p className="text-orange-900">{safeText(formulation.protocol_number)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">ΑΔΑ:</span>
                                  <p className="text-orange-900">{safeText(formulation.ada)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Έτος Απόφασης:</span>
                                  <p className="text-orange-900">{safeText(formulation.decision_year)}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Προϋπολογισμός Έργου:</span>
                                  <p className="text-orange-900 font-semibold">{formatCurrency(formulation.project_budget)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Σύνολο Δημόσιας Δαπάνης:</span>
                                  <p className="text-orange-900">{formatCurrency(formulation.total_public_expense)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Επιλέξιμη Δημόσια Δαπάνη:</span>
                                  <p className="text-orange-900">{formatCurrency(formulation.eligible_public_expense)}</p>
                                </div>
                                <div>
                                  <span className="font-medium text-orange-700 block text-sm">Έκδοση ΕΠΑ:</span>
                                  <p className="text-orange-900">{safeText(formulation.epa_version)}</p>
                                </div>
                              </div>
                              {formulation.project_decisions && (
                                <div className="col-span-full">
                                  <span className="font-medium text-orange-700 block text-sm mb-1">Συνδεδεμένη Απόφαση:</span>
                                  <div className="bg-orange-50 p-2 rounded text-sm">
                                    <p className="text-orange-900">
                                      {formulation.project_decisions.decision_type} - {formulation.project_decisions.protocol_number}
                                    </p>
                                    {formulation.project_decisions.fek && (
                                      <p className="text-orange-700">ΦΕΚ: {formulation.project_decisions.fek}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {formulation.comments && (
                                <div className="col-span-full">
                                  <span className="font-medium text-orange-700 block text-sm mb-1">Σχόλια:</span>
                                  <p className="text-orange-900 bg-orange-50 p-2 rounded text-sm">{formulation.comments}</p>
                                </div>
                              )}
                              <div className="col-span-full text-xs text-gray-500">
                                Δημιουργήθηκε: {formatDate(formulation.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-8 border border-orange-100 text-center">
                        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">Δεν υπάρχουν στοιχεία στον πίνακα project_formulations</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Τεχνικά - Technical Data from Projects Table */}
                <TabsContent value="technical" className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="h-5 w-5 text-gray-600" />
                      <h3 className="text-lg font-semibold text-gray-800">Τεχνικά Στοιχεία</h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Projects table
                      </Badge>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">ID Έργου:</span>
                          <p className="text-gray-900 font-mono">{safeText(projectData?.id)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">MIS:</span>
                          <p className="text-gray-900 font-mono">{safeText(projectData?.mis)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Κωδικός E069:</span>
                          <p className="text-gray-900 font-mono">{safeText(projectData?.e069)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Κωδικός ΝΑ271:</span>
                          <p className="text-gray-900 font-mono">{safeText(projectData?.na271)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Κωδικός ΝΑ853:</span>
                          <p className="text-gray-900 font-mono">{safeText(projectData?.na853)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Κατάσταση:</span>
                          <Badge variant="outline">{safeText(projectData?.status)}</Badge>
                        </div>
                        <div className="col-span-full space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Περιγραφή Γεγονότος:</span>
                          <p className="text-gray-900 bg-gray-50 p-2 rounded text-sm">{safeText(projectData?.event_description)}</p>
                        </div>
                        <div className="col-span-full space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Τίτλος Έργου:</span>
                          <p className="text-gray-900 bg-gray-50 p-2 rounded text-sm">{safeText(projectData?.project_title)}</p>
                        </div>
                        {projectData?.event_year && (
                          <div className="col-span-full space-y-1">
                            <span className="font-medium text-gray-700 block text-sm">Έτη Εκδήλωσης:</span>
                            <p className="text-gray-900 bg-gray-50 p-2 rounded text-sm">
                              {Array.isArray(projectData.event_year) 
                                ? projectData.event_year.join(', ') 
                                : safeText(projectData.event_year)}
                            </p>
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Δημιουργήθηκε:</span>
                          <p className="text-gray-900 text-sm">{formatDate(projectData?.created_at)}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium text-gray-700 block text-sm">Τελευταία Ενημέρωση:</span>
                          <p className="text-gray-900 text-sm">{formatDate(projectData?.updated_at)}</p>
                        </div>
                      </div>
                    </div>
                    
                    {hasErrors && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-medium text-sm">Προειδοποίηση</span>
                        </div>
                        <p className="text-yellow-700 text-sm mt-1">
                          Κάποια δεδομένα δεν μπόρεσαν να φορτωθούν από τους εξειδικευμένους πίνακες.
                          Εμφανίζονται τα διαθέσιμα στοιχεία από τον κύριο πίνακα Projects.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};