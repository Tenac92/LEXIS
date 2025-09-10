import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Check, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface EPAFinancial {
  year: number;
  total_public_expense: string;
  eligible_public_expense: string;
}

interface ValidationResult {
  year: number;
  epa_totals: {
    total_public: number;
    eligible_public: number;
  };
  subproject_totals: {
    total_public: number;
    eligible_public: number;
  };
  mismatches: {
    total_public: number;
    eligible_public: number;
  };
  has_mismatch: boolean;
}

interface EPAFinancialsWithValidationProps {
  epaVersionId: number;
  financials: EPAFinancial[];
  onFinancialsChange: (financials: EPAFinancial[]) => void;
  isEditing: boolean;
}

export function EPAFinancialsWithValidation({ 
  epaVersionId, 
  financials, 
  onFinancialsChange, 
  isEditing 
}: EPAFinancialsWithValidationProps) {
  const [localFinancials, setLocalFinancials] = useState<EPAFinancial[]>(financials);
  
  useEffect(() => {
    setLocalFinancials(financials);
  }, [financials]);

  // Fetch validation data
  const { data: validationData, isLoading: isValidating } = useQuery({
    queryKey: ['epa-financial-validation', epaVersionId],
    queryFn: async () => {
      const response = await apiRequest(`/api/epa-versions/${epaVersionId}/financial-validation`) as {
        validation: ValidationResult[];
        has_overall_mismatch: boolean;
      };
      return {
        validation: response.validation,
        has_overall_mismatch: response.has_overall_mismatch
      };
    },
    enabled: !!epaVersionId && !isEditing,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // Refetch every 30 seconds when not editing
  });

  const addNewYear = () => {
    const currentYear = new Date().getFullYear();
    const usedYears = localFinancials.map(f => f.year);
    let newYear = currentYear;
    
    // Find the next available year
    while (usedYears.includes(newYear)) {
      newYear++;
    }

    const newFinancial: EPAFinancial = {
      year: newYear,
      total_public_expense: '0',
      eligible_public_expense: '0'
    };

    const updatedFinancials = [...localFinancials, newFinancial];
    setLocalFinancials(updatedFinancials);
    onFinancialsChange(updatedFinancials);
  };

  const updateFinancial = (index: number, field: keyof EPAFinancial, value: string | number) => {
    const updatedFinancials = [...localFinancials];
    updatedFinancials[index] = { ...updatedFinancials[index], [field]: value };
    setLocalFinancials(updatedFinancials);
    onFinancialsChange(updatedFinancials);
  };

  const removeFinancial = (index: number) => {
    const updatedFinancials = localFinancials.filter((_, i) => i !== index);
    setLocalFinancials(updatedFinancials);
    onFinancialsChange(updatedFinancials);
  };

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? '0' : num.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getValidationForYear = (year: number): ValidationResult | undefined => {
    return validationData?.validation.find(v => v.year === year);
  };

  const getMismatchIcon = (mismatch: number) => {
    if (Math.abs(mismatch) < 0.01) return <Check className="h-4 w-4 text-green-600" />;
    if (mismatch > 0) return <TrendingUp className="h-4 w-4 text-orange-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getMismatchDescription = (mismatch: number, field: string) => {
    if (Math.abs(mismatch) < 0.01) return `${field}: Ταιριάζει ✓`;
    if (mismatch > 0) return `${field}: ΕΠΑ υπερβαίνει κατά €${Math.abs(mismatch).toLocaleString('el-GR', { minimumFractionDigits: 2 })}`;
    return `${field}: Υποέργα υπερβαίνουν κατά €${Math.abs(mismatch).toLocaleString('el-GR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Οικονομικά ΕΠΑ</span>
              {validationData?.has_overall_mismatch && !isEditing && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Ανισορροπία
                </Badge>
              )}
              {!validationData?.has_overall_mismatch && !isEditing && validationData && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Ισοσκελισμένο
                </Badge>
              )}
            </div>
            {isEditing && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addNewYear}
              >
                <Plus className="h-4 w-4 mr-2" />
                Προσθήκη Έτους
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {localFinancials.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Δεν υπάρχουν οικονομικά στοιχεία για αυτή την έκδοση ΕΠΑ.
              </AlertDescription>
            </Alert>
          ) : (
            localFinancials.map((financial, index) => {
              const validation = getValidationForYear(financial.year);
              const hasMismatch = validation?.has_mismatch;
              
              return (
                <Card key={index} className={`border-l-4 ${hasMismatch && !isEditing ? 'border-l-orange-400' : 'border-l-green-400'}`}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div>
                        <Label htmlFor={`epa-year-${index}`}>Έτος</Label>
                        <Input
                          id={`epa-year-${index}`}
                          type="number"
                          value={financial.year}
                          onChange={(e) => updateFinancial(index, 'year', parseInt(e.target.value) || new Date().getFullYear())}
                          disabled={!isEditing}
                          min="2020"
                          max="2050"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`epa-total-${index}`}>Συνολική Δημόσια Δαπάνη (€)</Label>
                        <Input
                          id={`epa-total-${index}`}
                          type="text"
                          value={isEditing ? financial.total_public_expense : formatCurrency(financial.total_public_expense)}
                          onChange={(e) => updateFinancial(index, 'total_public_expense', e.target.value.replace(/,/g, ''))}
                          disabled={!isEditing}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`epa-eligible-${index}`}>Επιλέξιμη Δημόσια Δαπάνη (€)</Label>
                        <Input
                          id={`epa-eligible-${index}`}
                          type="text"
                          value={isEditing ? financial.eligible_public_expense : formatCurrency(financial.eligible_public_expense)}
                          onChange={(e) => updateFinancial(index, 'eligible_public_expense', e.target.value.replace(/,/g, ''))}
                          disabled={!isEditing}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        {isEditing && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeFinancial(index)}
                          >
                            Αφαίρεση
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Validation information */}
                    {!isEditing && validation && (
                      <div className="mt-4 space-y-2">
                        {hasMismatch ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <div className="space-y-1">
                                <div className="font-medium">Ανισορροπία εντοπίστηκε για το έτος {financial.year}:</div>
                                <div className="flex flex-col gap-1 text-sm">
                                  <div className="flex items-center gap-2">
                                    {getMismatchIcon(validation.mismatches.total_public)}
                                    {getMismatchDescription(validation.mismatches.total_public, 'Συνολική')}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getMismatchIcon(validation.mismatches.eligible_public)}
                                    {getMismatchDescription(validation.mismatches.eligible_public, 'Επιλέξιμη')}
                                  </div>
                                </div>
                              </div>
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert>
                            <Check className="h-4 w-4 text-green-600" />
                            <AlertDescription>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-green-700">Έτος {financial.year}: Ισοσκελισμένο</span>
                                <Badge variant="outline" className="text-green-700">
                                  Σύνολο: €{validation.subproject_totals.total_public.toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                                </Badge>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {/* Detailed breakdown */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">ΕΠΑ Σύνολα:</div>
                            <div>Συνολική: €{validation.epa_totals.total_public.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</div>
                            <div>Επιλέξιμη: €{validation.epa_totals.eligible_public.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">Σύνολα Υποέργων:</div>
                            <div>Συνολική: €{validation.subproject_totals.total_public.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</div>
                            <div>Επιλέξιμη: €{validation.subproject_totals.eligible_public.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
          
          {/* Overall validation summary */}
          {!isEditing && validationData && validationData.validation.length > 0 && (
            <Alert className={validationData.has_overall_mismatch ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}>
              {validationData.has_overall_mismatch ? (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${validationData.has_overall_mismatch ? 'text-orange-700' : 'text-green-700'}`}>
                    {validationData.has_overall_mismatch ? 
                      'Υπάρχουν ανισορροπίες μεταξύ ΕΠΑ και υποέργων' : 
                      'Όλα τα έτη είναι ισοσκελισμένα'
                    }
                  </span>
                  {isValidating && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                      Επανέλεγχος...
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}