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
      if (!searchTerm || searchTerm.length < 7) return [];
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      console.log(`[SimpleAFM] Employee search results for "${searchTerm}":`, data);
      return data.success ? data.data : [];
    },
    enabled: useEmployeeData && searchTerm.length >= 7,
  });

  // Fetch beneficiaries when expenditure type is NOT "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['/api/beneficiaries/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 7) return [];
      const response = await fetch(`/api/beneficiaries/search?afm=${encodeURIComponent(searchTerm)}&includeFinancial=true`);
      const data = await response.json();
      console.log(`[SimpleAFM] Beneficiary search results for "${searchTerm}":`, data);
      return data.success ? data.data : [];
    },
    enabled: !useEmployeeData && searchTerm.length >= 7,
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
      withStatus: [],  // Paid installments
      withoutStatus: [] // Unpaid installments
    };
    
    payments.forEach(payment => {
      const installments = validateInstallments(payment.installment);
      // Fix status logic: "pending", "draft", "submitted", etc. = unpaid
      // "paid", "completed", "processed" = paid
      const isPaid = payment.status && 
                     ['paid', 'completed', 'processed', 'finalized'].includes(payment.status.toLowerCase().trim());
      
      installments.forEach((inst: string) => {
        if (installmentSequence.includes(inst)) {
          if (isPaid) {
            installmentsByStatus.withStatus.push({ ...payment, currentInstallment: inst });
          } else {
            installmentsByStatus.withoutStatus.push({ ...payment, currentInstallment: inst });
          }
        }
      });
    });
    
    return installmentsByStatus;
  };
  
  // Fixed installment logic based on user requirements
  const getSmartInstallmentData = useCallback((beneficiary: any, expenditureType: string, userUnit: string, projectNa853?: string) => {
    console.log('[SmartAutocomplete] Calculating next installment for:', { 
      beneficiaryId: beneficiary.id, 
      expenditureType, 
      userUnit, 
      projectNa853 
    });

    if (!beneficiary.oikonomika || typeof beneficiary.oikonomika !== 'object') {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    // Try specific expenditure type first, then fallback to UNKNOWN
    let expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || !Array.isArray(expenditureData)) {
      // Fallback to UNKNOWN category
      expenditureData = beneficiary.oikonomika['UNKNOWN'];
      if (!expenditureData || !Array.isArray(expenditureData)) {
        return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
      }
      console.log('[SmartAutocomplete] Using UNKNOWN category as fallback for expenditure type:', expenditureType);
    }

    console.log('[SmartAutocomplete] Processing beneficiary payments:', expenditureData);

    // Extract all existing installments (ignore ΕΦΑΠΑΞ for sequence logic)
    const allInstallments: Array<{ installment: string, amount: number, created_at: string }> = [];
    
    expenditureData.forEach(payment => {
      // Use existing helper to properly handle arrays and validate installments
      const installments = validateInstallments(payment.installment);
      
      installments.forEach(installmentKey => {
        // Skip ΕΦΑΠΑΞ as it doesn't affect regular installment sequence
        if (installmentKey === 'ΕΦΑΠΑΞ') {
          console.log('[SmartAutocomplete] Skipping ΕΦΑΠΑΞ installment (stands alone)');
          return;
        }
        
        allInstallments.push({
          installment: installmentKey,
          amount: safeParseAmount(payment.amount),
          created_at: payment.created_at || ''
        });
      });
    });

    console.log('[SmartAutocomplete] Non-ΕΦΑΠΑΞ installments found:', allInstallments);

    if (allInstallments.length === 0) {
      // No regular installments exist, start with Α
      console.log('[SmartAutocomplete] No regular installments found, suggesting Α');
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    // Find the highest installment in the Greek letter sequence
    const greekSequence = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ', 'Ζ', 'Η', 'Θ', 'Ι', 'ΙΑ', 'ΙΒ', 'ΙΓ', 'ΙΔ', 'ΙΕ'];
    const numericInstallments = allInstallments.filter(p => /^\d+$/.test(p.installment));
    const greekInstallments = allInstallments.filter(p => greekSequence.includes(p.installment));

    let nextInstallment: string;
    let referenceAmount = 0;

    if (greekInstallments.length > 0) {
      // Handle Greek letter sequence
      const maxGreekIndex = Math.max(...greekInstallments.map(p => greekSequence.indexOf(p.installment)));
      const highestInstallment = greekSequence[maxGreekIndex];
      
      // Check if we can suggest the next installment in sequence
      if (maxGreekIndex + 1 < greekSequence.length) {
        nextInstallment = greekSequence[maxGreekIndex + 1];
      } else {
        // At end of sequence, suggest extending it
        nextInstallment = 'ΙΣΤ'; // Next logical installment after ΙΕ
      }
      
      // Get amount from the most recent entry of the highest-used installment type
      const highestInstallmentEntries = greekInstallments.filter(p => p.installment === highestInstallment);
      const mostRecentHighest = highestInstallmentEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      referenceAmount = mostRecentHighest?.amount || 0;
      
      console.log('[SmartAutocomplete] Greek sequence detected. Highest:', highestInstallment, 'Next:', nextInstallment, 'Amount from most recent', highestInstallment, ':', referenceAmount);
    } else if (numericInstallments.length > 0) {
      // Handle numeric sequence
      const maxNumeric = Math.max(...numericInstallments.map(p => parseInt(p.installment)));
      const highestInstallment = maxNumeric.toString();
      nextInstallment = (maxNumeric + 1).toString();
      
      // Get amount from the most recent entry of the highest-used installment type
      const highestInstallmentEntries = numericInstallments.filter(p => p.installment === highestInstallment);
      const mostRecentHighest = highestInstallmentEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      referenceAmount = mostRecentHighest?.amount || 0;
      
      console.log('[SmartAutocomplete] Numeric sequence detected. Highest:', maxNumeric, 'Next:', nextInstallment, 'Amount from most recent', highestInstallment, ':', referenceAmount);
    } else {
      // Unknown installment format, default to Α
      nextInstallment = 'Α';
      referenceAmount = 0;
      console.log('[SmartAutocomplete] Unknown installment format, defaulting to Α');
    }

    console.log('[SmartAutocomplete] Final suggestion:', { installment: nextInstallment, amount: referenceAmount });

    return {
      installment: nextInstallment,
      amount: referenceAmount,
      suggestedInstallments: [nextInstallment],
      installmentAmounts: { [nextInstallment]: referenceAmount }
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
    setShowDropdown(numericValue.length >= 7);
    
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
        onFocus={() => searchTerm.length >= 7 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      
      {/* Simple dropdown results */}
      {showDropdown && searchTerm.length >= 7 && (
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