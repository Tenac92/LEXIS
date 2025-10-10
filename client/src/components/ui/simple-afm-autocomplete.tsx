import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Building2, Search, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
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
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  
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

  // Fixed installment logic based on user requirements
  const getSmartInstallmentData = useCallback((beneficiary: any, expenditureType: string, userUnit: string, projectNa853?: string) => {
    if (import.meta.env.NODE_ENV === 'development') {
      console.log('[SmartAutocomplete] Calculating next installment for beneficiary:', beneficiary.id);
    }

    if (!beneficiary.oikonomika || typeof beneficiary.oikonomika !== 'object') {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    // CRITICAL: Only use payments from the SAME expenditure type as the current document
    let expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || !Array.isArray(expenditureData)) {
      // Check if this beneficiary has payments for OTHER expenditure types
      const hasOtherExpenditureTypes = Object.keys(beneficiary.oikonomika).some(key => {
        return key !== expenditureType && 
               key !== 'UNKNOWN' && 
               Array.isArray(beneficiary.oikonomika[key]) && 
               beneficiary.oikonomika[key].length > 0;
      });
      
      if (hasOtherExpenditureTypes) {
        if (import.meta.env.NODE_ENV === 'development') {
        console.log(`[SmartAutocomplete] EXPENDITURE TYPE MISMATCH: No suggestions for different expenditure type`);
      }
        return { installment: '', amount: 0, suggestedInstallments: [], installmentAmounts: {} };
      }
      
      // Check if UNKNOWN payments exist (these could be from any expenditure type)
      const hasUnknownPayments = beneficiary.oikonomika['UNKNOWN'] && 
                               Array.isArray(beneficiary.oikonomika['UNKNOWN']) && 
                               beneficiary.oikonomika['UNKNOWN'].length > 0;
      
      if (hasUnknownPayments) {
        if (import.meta.env.NODE_ENV === 'development') {
          console.log(`[SmartAutocomplete] Found UNKNOWN payments - not suggesting continuation to avoid cross-expenditure type contamination`);
        }
        return { installment: '', amount: 0, suggestedInstallments: [], installmentAmounts: {} };
      }
      
      // Only suggest 'Α' when there are truly NO payments at all
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    } else {
      if (import.meta.env.NODE_ENV === 'development') {
        console.log(`[SmartAutocomplete] Found ${expenditureData.length} payments for expenditure type`);
      }
    }

    if (import.meta.env.NODE_ENV === 'development') {
      console.log(`[SmartAutocomplete] Processing ${expenditureData.length} payments`);
    }

    // Extract all existing installments (ignore ΕΦΑΠΑΞ for sequence logic)
    const allInstallments: Array<{ installment: string, amount: number, created_at: string }> = [];
    
    expenditureData.forEach(payment => {
      // Use existing helper to properly handle arrays and validate installments
      const installments = validateInstallments(payment.installment);
      
      installments.forEach(installmentKey => {
        // Skip ΕΦΑΠΑΞ as it doesn't affect regular installment sequence
        if (installmentKey === 'ΕΦΑΠΑΞ') {
          if (import.meta.env.NODE_ENV === 'development') {
        console.log('[SmartAutocomplete] Skipping ΕΦΑΠΑΞ installment');
      }
          return;
        }
        
        allInstallments.push({
          installment: installmentKey,
          amount: safeParseAmount(payment.amount),
          created_at: payment.created_at || ''
        });
      });
    });

    if (import.meta.env.NODE_ENV === 'development') {
      console.log(`[SmartAutocomplete] Found ${allInstallments.length} non-ΕΦΑΠΑΞ installments`);
    }

    if (allInstallments.length === 0) {
      // No regular installments exist, start with Α
      if (import.meta.env.NODE_ENV === 'development') {
        console.log('[SmartAutocomplete] No regular installments found, suggesting Α');
      }
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
    console.log('[SimpleAFM] Person selected:', person);
    console.log('[SimpleAFM] Context:', { expenditureType, userUnit, projectNa853, useEmployeeData });
    
    // For beneficiaries, add smart installment selection
    if (!useEmployeeData && 'oikonomika' in person) {
      console.log('[SimpleAFM] Processing beneficiary with oikonomika:', person.oikonomika);
      const smartData = getSmartInstallmentData(person, expenditureType, userUnit, projectNa853);
      console.log('[SimpleAFM] Smart data result:', smartData);
      
      const enhancedPerson = {
        ...person,
        suggestedInstallment: smartData.installment,
        suggestedAmount: smartData.amount,
        suggestedInstallments: smartData.suggestedInstallments,
        suggestedInstallmentAmounts: smartData.installmentAmounts
      };
      console.log('[SimpleAFM] Enhanced person data:', enhancedPerson);
      onSelectPerson(enhancedPerson);
    } else {
      console.log('[SimpleAFM] No smart processing - using basic selection');
      onSelectPerson(person);
    }
    
    setOpen(false);
    setSearchTerm(String(person.afm || ""));
  }, [onSelectPerson, useEmployeeData, expenditureType, userUnit, projectNa853, getSmartInstallmentData]);

  const handleInputChange = (newValue: string) => {
    // Only allow numeric input and limit to 9 digits
    const numericValue = newValue.replace(/\D/g, '').slice(0, 9);
    
    setSearchTerm(numericValue);
    
    // Notify parent component when user types
    onChange?.(numericValue);
    
    // Auto-open dropdown when typing
    if (numericValue.length >= 2 && !open) {
      setOpen(true);
    }
  };

  // Find selected person for display
  const selectedPerson = searchResults.find((p: Employee | Beneficiary) => 
    String(p.afm) === searchTerm
  );

  const displayValue = selectedPerson
    ? `${selectedPerson.surname} ${selectedPerson.name} (${selectedPerson.afm})`
    : searchTerm
    ? `ΑΦΜ: ${searchTerm}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          data-testid="button-afm-search"
        >
          <div className="flex items-center gap-2 truncate">
            {useEmployeeData ? (
              <User className="h-4 w-4 shrink-0" />
            ) : (
              <Building2 className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{displayValue}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Πληκτρολογήστε ΑΦΜ..."
              value={searchTerm}
              onValueChange={handleInputChange}
              className="border-0 focus:ring-0"
              data-testid="input-afm-search"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="py-6 text-center text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Αναζήτηση...
                  </div>
                </div>
              ) : searchTerm.length < 2 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Πληκτρολογήστε τουλάχιστον 2 χαρακτήρες
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Δεν βρέθηκαν αποτελέσματα
                </div>
              )}
            </CommandEmpty>
            {searchResults.length > 0 && (
              <CommandGroup>
                {searchResults.map((person: Employee | Beneficiary) => {
                  const isSelected = selectedPerson?.id === person.id;
                  
                  return (
                    <CommandItem
                      key={person.id}
                      value={String(person.afm)}
                      onSelect={() => handleSelect(person)}
                      className="cursor-pointer"
                      data-testid={`item-afm-${person.afm}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {useEmployeeData ? (
                          <User className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">
                            {person.surname} {person.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ΑΦΜ: {person.afm}
                            {person.fathername && ` • ${person.fathername}`}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
