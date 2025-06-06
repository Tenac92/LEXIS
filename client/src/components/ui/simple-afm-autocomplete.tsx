import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type Employee, type Beneficiary } from "@shared/schema";

interface SimpleAFMAutocompleteProps {
  expenditureType: string;
  onSelectPerson: (person: Employee | Beneficiary) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  userUnit?: string;
  projectNa853?: string;
}

export function SimpleAFMAutocomplete({
  expenditureType,
  onSelectPerson,
  placeholder = "ΑΦΜ",
  disabled = false,
  className,
  value = "",
  onChange,
  userUnit = "",
  projectNa853 = ""
}: SimpleAFMAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Update search term when value prop changes
  useEffect(() => {
    if (value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);
  
  // Determine if we should use employee or beneficiary data
  const useEmployeeData = expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ";
  
  // Fetch employees when expenditure type is "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      console.log(`[SimpleAFM] Employee search results for "${searchTerm}":`, data);
      return data.success ? data.data : [];
    },
    enabled: useEmployeeData && searchTerm.length >= 2,
  });

  // Fetch beneficiaries when expenditure type is NOT "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['/api/beneficiaries/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const response = await fetch(`/api/beneficiaries/search?afm=${encodeURIComponent(searchTerm)}&includeFinancial=true`);
      const data = await response.json();
      console.log(`[SimpleAFM] Beneficiary search results for "${searchTerm}":`, data);
      return data.success ? data.data : [];
    },
    enabled: !useEmployeeData && searchTerm.length >= 2,
  });

  const isLoading = useEmployeeData ? employeesLoading : beneficiariesLoading;
  const searchResults = useEmployeeData ? employees : beneficiaries;

  // Enhanced helper function to determine next available installment and amount
  const getSmartInstallmentData = useCallback((beneficiary: any, expenditureType: string, userUnit: string, projectNa853?: string) => {
    if (!beneficiary.oikonomika || typeof beneficiary.oikonomika !== 'object') {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    const expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || !Array.isArray(expenditureData)) {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    console.log('[SmartAutocomplete] Processing beneficiary payments:', expenditureData);
    console.log('[SmartAutocomplete] Matching against:', { expenditureType, userUnit, projectNa853 });

    // Filter payments that match expenditure_type, unit_code, and na853_code
    const matchingPayments = expenditureData.filter((payment: any) => {
      if (!payment || typeof payment !== 'object') return false;
      
      // Cross-check criteria as requested
      const matchesExpenditure = payment.expenditure_type === expenditureType || !payment.expenditure_type;
      const matchesUnit = payment.unit_code === userUnit || !payment.unit_code;
      const matchesNa853 = !projectNa853 || payment.na853_code === projectNa853 || !payment.na853_code;
      
      return matchesExpenditure && matchesUnit && matchesNa853;
    });

    if (matchingPayments.length === 0) {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    console.log('[SmartAutocomplete] Found matching payments:', matchingPayments);

    // Map installments by status
    const installmentsByStatus: Record<string, any[]> = {
      withStatus: [],
      withoutStatus: []
    };

    const installmentSequence = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ'];

    matchingPayments.forEach(payment => {
      const installments = Array.isArray(payment.installment) ? payment.installment : [payment.installment].filter(Boolean);
      const hasStatus = payment.status && payment.status !== '';
      
      installments.forEach((inst: string) => {
        if (installmentSequence.includes(inst)) {
          if (hasStatus) {
            installmentsByStatus.withStatus.push({ ...payment, currentInstallment: inst });
          } else {
            installmentsByStatus.withoutStatus.push({ ...payment, currentInstallment: inst });
          }
        }
      });
    });

    console.log('[SmartAutocomplete] Installments by status:', installmentsByStatus);

    // Find next available installment following your logic:
    // 1. Next one with no status (if exists)
    // 2. Next one in sequence if all have status
    let selectedInstallment = 'Α';
    let selectedAmount = 0;

    if (installmentsByStatus.withoutStatus.length > 0) {
      // Find the earliest installment with no status
      const earliestNoStatus = installmentsByStatus.withoutStatus.reduce((earliest, current) => {
        const earliestIndex = installmentSequence.indexOf(earliest.currentInstallment);
        const currentIndex = installmentSequence.indexOf(current.currentInstallment);
        return currentIndex < earliestIndex ? current : earliest;
      });
      
      selectedInstallment = earliestNoStatus.currentInstallment;
      selectedAmount = parseFloat(earliestNoStatus.amount || "0") || 0;
      
      console.log('[SmartAutocomplete] Selected installment with no status:', selectedInstallment, selectedAmount);
    } else if (installmentsByStatus.withStatus.length > 0) {
      // All installments have status, find the next one in sequence
      const lastInstallmentWithStatus = installmentsByStatus.withStatus.reduce((latest, current) => {
        const latestIndex = installmentSequence.indexOf(latest.currentInstallment);
        const currentIndex = installmentSequence.indexOf(current.currentInstallment);
        return currentIndex > latestIndex ? current : latest;
      });
      
      const lastIndex = installmentSequence.indexOf(lastInstallmentWithStatus.currentInstallment);
      const nextIndex = lastIndex + 1;
      
      if (nextIndex < installmentSequence.length) {
        selectedInstallment = installmentSequence[nextIndex];
        // Use amount from previous installment
        selectedAmount = parseFloat(lastInstallmentWithStatus.amount || "0") || 0;
      } else {
        // If we're at the end, use the last installment data
        selectedInstallment = lastInstallmentWithStatus.currentInstallment;
        selectedAmount = parseFloat(lastInstallmentWithStatus.amount || "0") || 0;
      }
      
      console.log('[SmartAutocomplete] All have status, selected next:', selectedInstallment, selectedAmount);
    }

    // Create suggested installments and amounts
    const suggestedInstallments = [selectedInstallment];
    const installmentAmounts = { [selectedInstallment]: selectedAmount };

    return {
      installment: selectedInstallment,
      amount: selectedAmount,
      suggestedInstallments,
      installmentAmounts
    };
  }, []);

  const handleSelect = useCallback((person: Employee | Beneficiary) => {
    console.log('[SmartAutocomplete] Person selected:', person);
    console.log('[SmartAutocomplete] Context:', { expenditureType, userUnit, projectNa853, useEmployeeData });
    
    // For beneficiaries, add smart installment selection
    if (!useEmployeeData && 'oikonomika' in person) {
      console.log('[SmartAutocomplete] Processing beneficiary with oikonomika:', person.oikonomika);
      const smartData = getSmartInstallmentData(person, expenditureType, userUnit, projectNa853);
      console.log('[SmartAutocomplete] Smart data result:', smartData);
      
      const enhancedPerson = {
        ...person,
        suggestedInstallment: smartData.installment,
        suggestedAmount: smartData.amount,
        suggestedInstallments: smartData.suggestedInstallments,
        suggestedInstallmentAmounts: smartData.installmentAmounts
      };
      console.log('[SmartAutocomplete] Enhanced person data:', enhancedPerson);
      onSelectPerson(enhancedPerson);
    } else {
      console.log('[SmartAutocomplete] No smart processing - using basic selection');
      onSelectPerson(person);
    }
    
    setShowDropdown(false);
    setSearchTerm(String(person.afm || ""));
  }, [onSelectPerson, useEmployeeData, expenditureType, userUnit, projectNa853, getSmartInstallmentData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numeric input and limit to 9 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 9);
    
    setSearchTerm(numericValue);
    setShowDropdown(numericValue.length >= 2);
    
    // Notify parent component when user types
    onChange?.(numericValue);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        disabled={disabled}
        className="w-full"
        onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      
      {/* Simple dropdown results */}
      {showDropdown && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm">Αναζήτηση...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              Δεν βρέθηκαν αποτελέσματα
            </div>
          ) : (
            <div>
              {searchResults.map((person: Employee | Beneficiary) => (
                <div
                  key={person.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(person);
                  }}
                >
                  <div className="font-medium">
                    {person.surname} {person.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    ΑΦΜ: {person.afm}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}