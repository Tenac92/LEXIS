import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertTriangle, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SubprojectFinancial {
  id?: number;
  year: number;
  total_public: string;
  eligible_public: string;
}

interface SubprojectFinancialsProps {
  subprojectId: number;
  subprojectTitle: string;
  financials: SubprojectFinancial[];
  onFinancialsChange: () => void;
}

export function SubprojectFinancials({ 
  subprojectId, 
  subprojectTitle, 
  financials, 
  onFinancialsChange 
}: SubprojectFinancialsProps) {
  const [localFinancials, setLocalFinancials] = useState<SubprojectFinancial[]>(financials);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add new financial year
  const addFinancialMutation = useMutation({
    mutationFn: async (financial: Omit<SubprojectFinancial, 'id'>) => {
      return apiRequest(`/api/subprojects/${subprojectId}/financials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(financial)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Επιτυχής προσθήκη',
        description: 'Τα οικονομικά στοιχεία προστέθηκαν επιτυχώς'
      });
      onFinancialsChange();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία προσθήκης οικονομικών στοιχείων'
      });
    }
  });

  // Update financial year
  const updateFinancialMutation = useMutation({
    mutationFn: async ({ id, ...financial }: SubprojectFinancial) => {
      return apiRequest(`/api/subprojects/financials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(financial)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Επιτυχής ενημέρωση',
        description: 'Τα οικονομικά στοιχεία ενημερώθηκαν επιτυχώς'
      });
      setEditingIndex(null);
      onFinancialsChange();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία ενημέρωσης οικονομικών στοιχείων'
      });
    }
  });

  // Delete financial year
  const deleteFinancialMutation = useMutation({
    mutationFn: async (financialId: number) => {
      return apiRequest(`/api/subprojects/financials/${financialId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Επιτυχής διαγραφή',
        description: 'Τα οικονομικά στοιχεία διαγράφηκαν επιτυχώς'
      });
      onFinancialsChange();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία διαγραφής οικονομικών στοιχείων'
      });
    }
  });

  const addNewYear = () => {
    const currentYear = new Date().getFullYear();
    const usedYears = localFinancials.map(f => f.year);
    let newYear = currentYear;
    
    // Find the next available year
    while (usedYears.includes(newYear)) {
      newYear++;
    }

    const newFinancial: SubprojectFinancial = {
      year: newYear,
      total_public: '0',
      eligible_public: '0'
    };

    setLocalFinancials([...localFinancials, newFinancial]);
    setEditingIndex(localFinancials.length);
  };

  const saveFinancial = (index: number) => {
    const financial = localFinancials[index];
    
    // Validation
    const totalPublic = parseFloat(financial.total_public.replace(/,/g, ''));
    const eligiblePublic = parseFloat(financial.eligible_public.replace(/,/g, ''));
    
    if (isNaN(totalPublic) || totalPublic < 0) {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα επικύρωσης',
        description: 'Η συνολική δημόσια δαπάνη πρέπει να είναι μη αρνητικός αριθμός'
      });
      return;
    }
    
    if (isNaN(eligiblePublic) || eligiblePublic < 0) {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα επικύρωσης',
        description: 'Η επιλέξιμη δημόσια δαπάνη πρέπει να είναι μη αρνητικός αριθμός'
      });
      return;
    }
    
    if (eligiblePublic > totalPublic) {
      toast({
        variant: 'destructive',
        title: 'Σφάλμα επικύρωσης',
        description: 'Η επιλέξιμη δημόσια δαπάνη δεν μπορεί να υπερβαίνει τη συνολική'
      });
      return;
    }

    if (financial.id) {
      updateFinancialMutation.mutate(financial);
    } else {
      addFinancialMutation.mutate({
        year: financial.year,
        total_public: financial.total_public,
        eligible_public: financial.eligible_public
      });
    }
  };

  const deleteFinancial = (index: number) => {
    const financial = localFinancials[index];
    if (financial.id) {
      deleteFinancialMutation.mutate(financial.id);
    } else {
      // Remove from local state if not saved yet
      const newFinancials = localFinancials.filter((_, i) => i !== index);
      setLocalFinancials(newFinancials);
      if (editingIndex === index) {
        setEditingIndex(null);
      }
    }
  };

  const updateLocalFinancial = (index: number, field: keyof SubprojectFinancial, value: string | number) => {
    const newFinancials = [...localFinancials];
    newFinancials[index] = { ...newFinancials[index], [field]: value };
    setLocalFinancials(newFinancials);
  };

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? '0' : num.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isValidFinancial = (financial: SubprojectFinancial): boolean => {
    const totalPublic = parseFloat(financial.total_public.replace(/,/g, ''));
    const eligiblePublic = parseFloat(financial.eligible_public.replace(/,/g, ''));
    
    return !isNaN(totalPublic) && !isNaN(eligiblePublic) && 
           totalPublic >= 0 && eligiblePublic >= 0 && 
           eligiblePublic <= totalPublic;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Οικονομικά - {subprojectTitle}</span>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addNewYear}
            disabled={editingIndex !== null}
          >
            <Plus className="h-4 w-4 mr-2" />
            Προσθήκη Έτους
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {localFinancials.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Δεν υπάρχουν οικονομικά στοιχεία για αυτό το υποέργο.
            </AlertDescription>
          </Alert>
        ) : (
          localFinancials.map((financial, index) => (
            <Card key={index} className="border-l-4 border-l-blue-400">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label htmlFor={`year-${index}`}>Έτος</Label>
                    <Input
                      id={`year-${index}`}
                      type="number"
                      value={financial.year}
                      onChange={(e) => updateLocalFinancial(index, 'year', parseInt(e.target.value) || new Date().getFullYear())}
                      disabled={editingIndex !== index}
                      min="2020"
                      max="2050"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`total-${index}`}>Συνολική Δημόσια Δαπάνη (€)</Label>
                    <Input
                      id={`total-${index}`}
                      type="text"
                      value={editingIndex === index ? financial.total_public : formatCurrency(financial.total_public)}
                      onChange={(e) => updateLocalFinancial(index, 'total_public', e.target.value.replace(/,/g, ''))}
                      disabled={editingIndex !== index}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`eligible-${index}`}>Επιλέξιμη Δημόσια Δαπάνη (€)</Label>
                    <Input
                      id={`eligible-${index}`}
                      type="text"
                      value={editingIndex === index ? financial.eligible_public : formatCurrency(financial.eligible_public)}
                      onChange={(e) => updateLocalFinancial(index, 'eligible_public', e.target.value.replace(/,/g, ''))}
                      disabled={editingIndex !== index}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    {editingIndex === index ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveFinancial(index)}
                          disabled={!isValidFinancial(financial) || addFinancialMutation.isPending || updateFinancialMutation.isPending}
                          className="flex-1"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Αποθήκευση
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingIndex(null);
                            if (!financial.id) {
                              deleteFinancial(index);
                            }
                          }}
                        >
                          Ακύρωση
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingIndex(index)}
                          disabled={editingIndex !== null}
                        >
                          Επεξεργασία
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteFinancial(index)}
                          disabled={editingIndex !== null || deleteFinancialMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {!isValidFinancial(financial) && editingIndex === index && (
                  <Alert className="mt-3" variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Παρακαλώ ελέγξτε ότι όλα τα ποσά είναι μη αρνητικά και η επιλέξιμη δαπάνη δεν υπερβαίνει τη συνολική.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}