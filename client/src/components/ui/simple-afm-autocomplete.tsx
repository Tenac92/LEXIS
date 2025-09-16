import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type Employee, type Beneficiary } from "@shared/schema";

// Data validation utilities
const isValidPayment = (payment: any): boolean => {
  return payment && typeof payment === 'object' && payment !== null;
};

const isValidString = (value: any): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

// European-aware number parsing utility
const parseEuropeanNumber = (value: string): number => {
  if (!value || typeof value !== 'string') return NaN;
  
  // Remove whitespace
  const cleaned = value.trim();
  
  // Handle European format: "1.234,56" -> 1234.56
  // Check if it contains both dots and commas (European format)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Remove thousands separators (dots) and replace decimal comma with dot
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  
  // Handle comma as decimal separator: "123,45" -> 123.45
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  
  // Handle standard format or dots as thousands separator: "1.234" or "1234.56"
  return parseFloat(cleaned);
};

const safeParseAmount = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(0, Number(value.toFixed(2))); // Ensure non-negative and 2 decimal places
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseEuropeanNumber(value.trim());
    if (!isNaN(parsed) && isFinite(parsed)) {
      return Math.max(0, Number(parsed.toFixed(2)));
    }
  }
  return defaultValue;
};

// Currency formatting utilities
const formatCurrency = (amount: number, locale: string = 'el-GR'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Simple number formatting (without currency symbol)  
const formatAmount = (amount: number, locale: string = 'el-GR'): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const validateInstallments = (installments: any): string[] => {
  if (!installments) return [];
  
  const installmentArray = Array.isArray(installments) 
    ? installments 
    : [installments];
    
  return installmentArray
    .filter(inst => isValidString(inst) && inst.trim() !== '')
    .map(inst => inst.trim());
};

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

  // Unified matching function with prioritized criteria
  const findMatchingPayments = (payments: any[], expenditureType: string, userUnit: string, projectNa853?: string) => {
    const validPayments = payments.filter(isValidPayment);
    
    // Priority 1: Exact match on all criteria
    const exactMatches = validPayments.filter(payment => {
      const paymentExpenditure = isValidString(payment.expenditure_type) ? payment.expenditure_type.trim() : '';
      const paymentUnit = isValidString(payment.unit_code) ? payment.unit_code.trim() : '';
      const paymentNa853 = isValidString(payment.na853_code) ? payment.na853_code.trim() : '';
      
      const matchesExpenditure = !paymentExpenditure || paymentExpenditure === expenditureType;
      const matchesUnit = !paymentUnit || paymentUnit === userUnit;
      
      let matchesNa853 = true;
      if (isValidString(projectNa853) && paymentNa853) {
        matchesNa853 = paymentNa853 === projectNa853.trim();
      }
      
      return matchesExpenditure && matchesUnit && matchesNa853;
    });
    
    if (exactMatches.length > 0) {
      console.log('[SmartAutocomplete] Found exact matches:', exactMatches.length);
      return exactMatches;
    }
    
    // Priority 2: Partial NA853 match
    if (isValidString(projectNa853)) {
      const partialMatches = validPayments.filter(payment => {
        const paymentExpenditure = isValidString(payment.expenditure_type) ? payment.expenditure_type.trim() : '';
        const paymentUnit = isValidString(payment.unit_code) ? payment.unit_code.trim() : '';
        const paymentNa853 = isValidString(payment.na853_code) ? payment.na853_code.trim() : '';
        
        const matchesExpenditure = !paymentExpenditure || paymentExpenditure === expenditureType;
        const matchesUnit = !paymentUnit || paymentUnit === userUnit;
        const matchesNa853 = paymentNa853.includes(projectNa853.trim()) || projectNa853.trim().includes(paymentNa853);
        
        return matchesExpenditure && matchesUnit && matchesNa853;
      });
      
      if (partialMatches.length > 0) {
        console.log('[SmartAutocomplete] Found partial NA853 matches:', partialMatches.length);
        return partialMatches;
      }
    }
    
    // Priority 3: Expenditure type and unit only
    const basicMatches = validPayments.filter(payment => {
      const paymentExpenditure = isValidString(payment.expenditure_type) ? payment.expenditure_type.trim() : '';
      const paymentUnit = isValidString(payment.unit_code) ? payment.unit_code.trim() : '';
      
      return (!paymentExpenditure || paymentExpenditure === expenditureType) && 
             (!paymentUnit || paymentUnit === userUnit);
    });
    
    console.log('[SmartAutocomplete] Using basic criteria matches:', basicMatches.length);
    return basicMatches;
  };
  
  // Unified installment processing function
  const processInstallments = (payments: any[], installmentSequence: string[]) => {
    const installmentsByStatus: Record<string, any[]> = {
      withStatus: [],
      withoutStatus: []
    };
    
    payments.forEach(payment => {
      const installments = validateInstallments(payment.installment);
      const hasStatus = isValidString(payment.status);
      
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
    
    return installmentsByStatus;
  };
  
  // Enhanced helper function to determine next available installment and amount
  const getSmartInstallmentData = useCallback((beneficiary: any, expenditureType: string, userUnit: string, projectNa853?: string) => {
    // Define installment sequence at the very beginning to avoid hoisting issues
    const installmentSequence = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ', 'Ζ', 'Η', 'Θ', 'Ι'];
    
    if (!beneficiary.oikonomika || typeof beneficiary.oikonomika !== 'object') {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    const expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || !Array.isArray(expenditureData)) {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    console.log('[SmartAutocomplete] Processing beneficiary payments:', expenditureData);
    console.log('[SmartAutocomplete] Matching against:', { expenditureType, userUnit, projectNa853 });

    // Use unified matching algorithm with prioritized criteria
    const matchingPayments = findMatchingPayments(expenditureData, expenditureType, userUnit, projectNa853);
    
    if (matchingPayments.length === 0) {
      console.log('[SmartAutocomplete] No matching payments found, using defaults');
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }
    
    // Process installments using unified logic
    const installmentsByStatus = processInstallments(matchingPayments, installmentSequence);
    console.log('[SmartAutocomplete] Processed installments by status:', installmentsByStatus);

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
      selectedAmount = safeParseAmount(earliestNoStatus.amount);
      
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
        selectedAmount = safeParseAmount(lastInstallmentWithStatus.amount);
      } else {
        // If we're at the end, use the last installment data
        selectedInstallment = lastInstallmentWithStatus.currentInstallment;
        selectedAmount = safeParseAmount(lastInstallmentWithStatus.amount);
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