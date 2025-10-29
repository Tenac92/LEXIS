import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, AlertTriangle, FolderOpen, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SubprojectFinancials } from './SubprojectFinancials';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Subproject {
  id: number;
  epa_version_id: number;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  subproject_financials: Array<{
    id: number;
    year: number;
    total_public: string;
    eligible_public: string;
    created_at: string;
    updated_at: string;
  }>;
}

interface SubprojectManagerProps {
  epaVersionId: number;
  epaVersionInfo?: {
    version_number: string;
    epa_version: string;
  };
}

const statusOptions = [
  { value: 'Συνεχιζόμενο', label: 'Συνεχιζόμενο' },
  { value: 'Σε αναμονή', label: 'Σε αναμονή' },
  { value: 'Ολοκληρωμένο', label: 'Ολοκληρωμένο' }
];

export function SubprojectManager({ epaVersionId, epaVersionInfo }: SubprojectManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSubproject, setNewSubproject] = useState({
    title: '',
    description: '',
    status: 'Συνεχιζόμενο'
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subprojects for EPA version - only if saved (id > 0)
  const { data: subprojects, isLoading, error, refetch } = useQuery({
    queryKey: ['epa-subprojects', epaVersionId],
    queryFn: async () => {
      const response = await apiRequest(`/api/epa-versions/${epaVersionId}/subprojects`) as { subprojects: Subproject[] };
      return response.subprojects;
    },
    enabled: epaVersionId > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Create new subproject
  const createSubprojectMutation = useMutation({
    mutationFn: async (subprojectData: typeof newSubproject) => {
      return apiRequest(`/api/epa-versions/${epaVersionId}/subprojects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subprojectData)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Επιτυχής δημιουργία',
        description: 'Το υποέργο δημιουργήθηκε επιτυχώς'
      });
      setIsCreating(false);
      setNewSubproject({ title: '', description: '', status: 'Συνεχιζόμενο' });
      refetch();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία δημιουργίας υποέργου'
      });
    }
  });

  // Delete subproject
  const deleteSubprojectMutation = useMutation({
    mutationFn: async (subprojectId: number) => {
      return apiRequest(`/api/subprojects/${subprojectId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Επιτυχής διαγραφή',
        description: 'Το υποέργο διαγράφηκε επιτυχώς'
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία διαγραφής υποέργου'
      });
    }
  });

  const handleCreateSubproject = () => {
    if (!newSubproject.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα επικύρωσης',
        description: 'Ο τίτλος του υποέργου είναι υποχρεωτικός'
      });
      return;
    }

    createSubprojectMutation.mutate(newSubproject);
  };

  const handleDeleteSubproject = (subprojectId: number, subprojectTitle: string) => {
    if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το υποέργο "${subprojectTitle}";`)) {
      deleteSubprojectMutation.mutate(subprojectId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Συνεχιζόμενο':
        return 'bg-green-100 text-green-800';
      case 'Σε αναμονή':
        return 'bg-yellow-100 text-yellow-800';
      case 'Ολοκληρωμένο':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Φόρτωση υποέργων...</span>
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
          Σφάλμα κατά τη φόρτωση των υποέργων: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              <span>Υποέργα</span>
              {epaVersionInfo && (
                <Badge variant="outline">
                  ΕΠΑ {epaVersionInfo.version_number} - {epaVersionInfo.epa_version}
                </Badge>
              )}
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4 mr-2" />
              Νέο Υποέργο
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* Create new subproject form */}
          {isCreating && (
            <Card className="mb-4 border-dashed">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="new-title">Τίτλος Υποέργου *</Label>
                    <Input
                      id="new-title"
                      value={newSubproject.title}
                      onChange={(e) => setNewSubproject(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Εισάγετε τον τίτλο του υποέργου"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="new-description">Περιγραφή</Label>
                    <Textarea
                      id="new-description"
                      value={newSubproject.description}
                      onChange={(e) => setNewSubproject(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Προαιρετική περιγραφή του υποέργου"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="new-status">Κατάσταση</Label>
                    <Select
                      value={newSubproject.status}
                      onValueChange={(value) => setNewSubproject(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCreateSubproject}
                      disabled={createSubprojectMutation.isPending}
                    >
                      {createSubprojectMutation.isPending ? 'Δημιουργία...' : 'Δημιουργία Υποέργου'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreating(false);
                        setNewSubproject({ title: '', description: '', status: 'Συνεχιζόμενο' });
                      }}
                    >
                      Ακύρωση
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subprojects list */}
          {!subprojects || subprojects.length === 0 ? (
            <Alert>
              <FolderOpen className="h-4 w-4" />
              <AlertDescription>
                Δεν υπάρχουν υποέργα για αυτή την έκδοση ΕΠΑ. Κάντε κλικ στο "Νέο Υποέργο" για να δημιουργήσετε το πρώτο.
              </AlertDescription>
            </Alert>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {subprojects.map((subproject, index) => (
                <AccordionItem 
                  key={subproject.id} 
                  value={`subproject-${subproject.id}`}
                  className="border rounded-lg"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full mr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{subproject.title}</span>
                        <Badge className={getStatusColor(subproject.status)}>
                          {subproject.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {subproject.subproject_financials?.length || 0} έτη
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubproject(subproject.id, subproject.title);
                          }}
                          disabled={deleteSubprojectMutation.isPending}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {subproject.description && (
                        <div>
                          <Label className="text-sm font-medium">Περιγραφή:</Label>
                          <p className="text-sm text-gray-600 mt-1">{subproject.description}</p>
                        </div>
                      )}
                      
                      <SubprojectFinancials
                        subprojectId={subproject.id}
                        subprojectTitle={subproject.title}
                        financials={subproject.subproject_financials || []}
                        onFinancialsChange={() => refetch()}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}