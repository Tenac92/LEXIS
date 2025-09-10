import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderOpen, AlertTriangle, DollarSign, TrendingUp, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { SubprojectManager } from './SubprojectManager';
import { EPAFinancialsWithValidation } from './EPAFinancialsWithValidation';

interface FormulationDetail {
  epa_version: string;
  total_public_expense: string;
  eligible_public_expense: string;
  [key: string]: any;
}

interface SubprojectsIntegrationCardProps {
  projectId: number;
  formulationDetails: FormulationDetail[];
  onFormulationChange: (financials: Array<{ year: number; total_public_expense: string; eligible_public_expense: string; }>) => void;
  isEditing: boolean;
}

interface EPAVersionInfo {
  id: number;
  version_number: string;
  epa_version: string;
  project_id: number;
  formulation_index: number;
}

export function SubprojectsIntegrationCard({ 
  projectId, 
  formulationDetails, 
  onFormulationChange, 
  isEditing 
}: SubprojectsIntegrationCardProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch EPA versions for this project
  const { data: epaVersions, isLoading: isLoadingVersions, error } = useQuery({
    queryKey: ['project-epa-versions', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/subprojects/projects/${projectId}/epa-versions`) as {
        epa_versions: EPAVersionInfo[];
      };
      return response.epa_versions;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Create EPA versions from formulation details if they don't exist in database
  const availableVersions = React.useMemo(() => {
    if (!epaVersions) return [];
    
    // Map formulation details to EPA versions, using database versions where available
    return formulationDetails.map((formulation, index) => {
      const existingVersion = epaVersions.find(v => v.formulation_index === index);
      return existingVersion || {
        id: -1, // Temporary ID for unsaved versions
        version_number: `${index + 1}`,
        epa_version: formulation.epa_version || `Έκδοση ${index + 1}`,
        project_id: projectId,
        formulation_index: index
      };
    });
  }, [epaVersions, formulationDetails, projectId]);

  // Calculate overall validation status
  const getOverallValidationStatus = () => {
    if (!availableVersions.length) return { status: 'none', message: 'Δεν υπάρχουν εκδόσεις ΕΠΑ' };
    
    const savedVersions = availableVersions.filter(v => v.id > 0);
    if (!savedVersions.length) return { status: 'pending', message: 'Αποθήκευση για επικύρωση υποέργων' };
    
    return { status: 'ready', message: `${savedVersions.length} εκδόσεις ΕΠΑ διαθέσιμες` };
  };

  const validationStatus = getOverallValidationStatus();

  if (isLoadingVersions) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Φόρτωση εκδόσεων ΕΠΑ...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Σφάλμα κατά τη φόρτωση των εκδόσεων ΕΠΑ: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            <span>Διαχείριση Υποέργων</span>
            <Badge variant={validationStatus.status === 'ready' ? 'secondary' : 'outline'}>
              {validationStatus.message}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {availableVersions.length} Εκδόσεις ΕΠΑ
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!availableVersions.length ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Δεν υπάρχουν εκδόσεις ΕΠΑ για αυτό το έργο. Προσθέστε διατυπώσεις στην καρτέλα "Στοιχεία Διατύπωσης Έργου" για να ενεργοποιήσετε τη διαχείριση υποέργων.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Επισκόπηση</TabsTrigger>
              <TabsTrigger value="subprojects">Υποέργα</TabsTrigger>
              <TabsTrigger value="financials">Οικονομικά</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableVersions.map((version, index) => (
                  <Card key={version.id || index} className="border-l-4 border-l-blue-400">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">ΕΠΑ {version.version_number}</h4>
                          <Badge variant={version.id > 0 ? 'secondary' : 'outline'}>
                            {version.id > 0 ? 'Αποθηκευμένη' : 'Μη αποθηκευμένη'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{version.epa_version}</p>
                        
                        {version.id > 0 ? (
                          <div className="space-y-1 text-xs">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveTab('subprojects')}
                              className="w-full"
                            >
                              Διαχείριση Υποέργων
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveTab('financials')}
                              className="w-full"
                            >
                              Επικύρωση Οικονομικών
                            </Button>
                          </div>
                        ) : (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Αποθηκεύστε το έργο για να ενεργοποιήσετε τη διαχείριση υποέργων
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="subprojects" className="space-y-4 mt-4">
              {availableVersions.filter(v => v.id > 0).length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Δεν υπάρχουν αποθηκευμένες εκδόσεις ΕΠΑ. Αποθηκεύστε το έργο πρώτα για να διαχειριστείτε υποέργα.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {availableVersions.filter(v => v.id > 0).map((version) => (
                    <SubprojectManager
                      key={version.id}
                      epaVersionId={version.id}
                      epaVersionInfo={{
                        version_number: version.version_number,
                        epa_version: version.epa_version
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="financials" className="space-y-4 mt-4">
              {availableVersions.filter(v => v.id > 0).length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Δεν υπάρχουν αποθηκευμένες εκδόσεις ΕΠΑ για επικύρωση οικονομικών στοιχείων.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {availableVersions.filter(v => v.id > 0).map((version, index) => {
                    const formulation = formulationDetails[version.formulation_index];
                    const financials = [
                      {
                        year: new Date().getFullYear(),
                        total_public_expense: formulation?.total_public_expense || '0',
                        eligible_public_expense: formulation?.eligible_public_expense || '0'
                      }
                    ];

                    return (
                      <EPAFinancialsWithValidation
                        key={version.id}
                        epaVersionId={version.id}
                        financials={financials}
                        onFinancialsChange={(updatedFinancials) => {
                          // Update the parent form when financials change
                          onFormulationChange(updatedFinancials);
                        }}
                        isEditing={isEditing}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}