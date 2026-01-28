import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { User, Building2, Search, Loader2 } from "lucide-react";
import { type Employee, type Beneficiary } from "@shared/schema";

// Utility: Find scrollable parent container (reused from ProjectSelect)
const getScrollableParent = (node: HTMLElement | null): HTMLElement | null => {
  if (!node) return null;
  const regex = /(auto|scroll)/;
  let current: HTMLElement | null = node;
  while (current && current !== document.body) {
    const { overflowY } = window.getComputedStyle(current);
    if (regex.test(overflowY)) return current;
    current = current.parentElement;
  }
  return null;
};

// Utility: Center element in scroll container (reused from ProjectSelect)
interface CenterParams {
  containerEl: HTMLElement;
  targetEl: HTMLElement;
  offsetRatio?: number;
  dropdownMaxHeight?: number;
  behavior?: ScrollBehavior;
}

const centerElementInScrollContainer = ({
  containerEl,
  targetEl,
  offsetRatio = 0.4,
  dropdownMaxHeight = 400,
  behavior = "smooth",
}: CenterParams): void => {
  const containerRect = containerEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  
  const targetScrollTop =
    containerEl.scrollTop +
    (targetRect.top - containerRect.top) -
    (containerEl.clientHeight * offsetRatio);

  const targetBottomInContainer =
    containerEl.scrollTop +
    (targetRect.bottom - containerRect.top) +
    dropdownMaxHeight;
  const containerBottomEdge = containerEl.scrollTop + containerEl.clientHeight;

  let finalScrollTop = Math.max(0, targetScrollTop);
  if (targetBottomInContainer > containerBottomEdge) {
    finalScrollTop = Math.min(
      finalScrollTop,
      targetBottomInContainer - containerEl.clientHeight + 16
    );
  }

  finalScrollTop = Math.max(
    0,
    Math.min(finalScrollTop, containerEl.scrollHeight - containerEl.clientHeight)
  );

  containerEl.scrollTo({ top: finalScrollTop, behavior });
};

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
  placeholder = "π.χ. 012345678",
  disabled = false,
  className,
  value = "",
  onChange,
  userUnit = "",
  projectNa853 = ""
}: SimpleAFMAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownOpenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevShowDropdownRef = useRef(showDropdown);
  
  // Update search term when value prop changes
  useEffect(() => {
    if (value !== searchTerm) {
      setSearchTerm(value);
      setDebouncedSearchTerm(value);
    }
  }, [value]);
  
  // Debounce search term to reduce API calls
  // OPTIMIZATION: Skip debounce for exact 9-digit AFM (paste operation) for instant response
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Check if this is a complete 9-digit AFM (likely pasted)
    const isExactAFM = searchTerm.length === 9 && /^\d{9}$/.test(searchTerm);
    
    if (isExactAFM) {
      // No debounce for exact AFM - search immediately
      setDebouncedSearchTerm(searchTerm);
    } else {
      // Normal debounce for typing
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
      }, 150); // 150ms debounce for faster response
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // When dropdown opens, center the input in modal scroll container
  useEffect(() => {
    const justOpened = showDropdown && !prevShowDropdownRef.current;
    prevShowDropdownRef.current = showDropdown;

    if (!justOpened) {
      if (dropdownOpenTimerRef.current) {
        clearTimeout(dropdownOpenTimerRef.current);
      }
      return;
    }

    dropdownOpenTimerRef.current = setTimeout(() => {
      const input = inputRef.current;
      const container = containerRef.current;
      if (!input || !container) return;

      const modalScroll = getScrollableParent(container);
      if (!modalScroll || modalScroll === document.body) {
        return;
      }

      centerElementInScrollContainer({
        containerEl: modalScroll,
        targetEl: input,
        offsetRatio: 0.35,
        dropdownMaxHeight: 400,
        behavior: "smooth",
      });

      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    }, 0);

    return () => {
      if (dropdownOpenTimerRef.current) {
        clearTimeout(dropdownOpenTimerRef.current);
      }
    };
  }, [showDropdown]);

  // Scroll highlighted item into view
  const scrollHighlightedIntoView = useCallback((index: number) => {
    const item = itemRefs.current[index];
    if (item && dropdownRef.current) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);
  
  // Determine if we should use employee or beneficiary data
  const useEmployeeData = expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ";
  
  // Fetch employees when expenditure type is "ΕΚΤΟΣ ΕΔΡΑΣ"
  // Uses optimized /search-fast endpoint that handles both hash lookup (9-digit) and cache (prefix)
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees/search-fast', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 4) return [];
      
      const startTime = performance.now();
      
      // Use the optimized fast search endpoint
      const response = await fetch(`/api/beneficiaries/search-fast?afm=${encodeURIComponent(debouncedSearchTerm)}&type=employee`);
      const data = await response.json();
      
      const elapsed = Math.round(performance.now() - startTime);
      
      if (data.success && data.data.length > 0) {
        console.log(`[SimpleAFM] Employee search (${data.source}) for "${debouncedSearchTerm}": ${data.data.length} results in ${elapsed}ms`);
        return data.data;
      }
      
      // If cache miss (fallback), try regular search only for prefix searches
      if (data.source === 'fallback' && debouncedSearchTerm.length < 9) {
        console.log(`[SimpleAFM] Cache miss, falling back to regular employee search`);
        const fallbackResponse = await fetch(`/api/employees/search?afm=${encodeURIComponent(debouncedSearchTerm)}`);
        const fallbackData = await fallbackResponse.json();
        return fallbackData.success ? fallbackData.data : [];
      }
      
      return data.data || [];
    },
    enabled: useEmployeeData && debouncedSearchTerm.length >= 4,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Fetch beneficiaries when expenditure type is NOT "ΕΚΤΟΣ ΕΔΡΑΣ"
  // Uses optimized /search-fast endpoint that handles both hash lookup (9-digit) and cache (prefix)
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['/api/beneficiaries/search-fast', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 4) return [];
      
      const startTime = performance.now();
      
      // Use the optimized fast search endpoint
      const response = await fetch(`/api/beneficiaries/search-fast?afm=${encodeURIComponent(debouncedSearchTerm)}`);
      const data = await response.json();
      
      const elapsed = Math.round(performance.now() - startTime);
      
      if (data.success && data.data.length > 0) {
        console.log(`[SimpleAFM] Beneficiary search (${data.source}) for "${debouncedSearchTerm}": ${data.data.length} results in ${elapsed}ms`);
        return data.data;
      }
      
      // If cache miss (fallback), try regular search only for prefix searches
      if (data.source === 'fallback' && debouncedSearchTerm.length < 9) {
        console.log(`[SimpleAFM] Cache miss, falling back to regular beneficiary search`);
        const fallbackResponse = await fetch(`/api/beneficiaries/search?afm=${encodeURIComponent(debouncedSearchTerm)}`);
        const fallbackData = await fallbackResponse.json();
        return fallbackData.success ? fallbackData.data : [];
      }
      
      return data.data || [];
    },
    enabled: !useEmployeeData && debouncedSearchTerm.length >= 4,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const isLoading = useEmployeeData ? employeesLoading : beneficiariesLoading;
  const searchResults = useEmployeeData ? employees : beneficiaries;

  // Reset highlight when results change
  useEffect(() => {
    if (searchResults.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [searchResults.length]);

  const handleSelect = useCallback((person: Employee | Beneficiary) => {
    console.log('[SimpleAFM] Person selected:', person);
    onSelectPerson(person);
    setShowDropdown(false);
    setSearchTerm(String(person.afm || ""));
  }, [onSelectPerson]);

  // Keyboard navigation handler (placed after searchResults is defined)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0;
          scrollHighlightedIntoView(next);
          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = prev > 0 ? prev - 1 : searchResults.length - 1;
          scrollHighlightedIntoView(next);
          return next;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          const result = searchResults[highlightedIndex];
          handleSelect(result);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  }, [showDropdown, searchResults, highlightedIndex, scrollHighlightedIntoView, handleSelect]);

  // Fixed installment logic based on user requirements
  const getSmartInstallmentData = useCallback((beneficiary: any, expenditureType: string, userUnit: string, projectNa853?: string) => {
    if (import.meta.env.NODE_ENV === 'development') {
      console.log('[SmartAutocomplete] Calculating next installment for beneficiary:', beneficiary.id);
    }

    if (!beneficiary.oikonomika || typeof beneficiary.oikonomika !== 'object') {
      return { installment: 'Α', amount: 0, suggestedInstallments: ['Α'], installmentAmounts: { 'Α': 0 } };
    }

    // CRITICAL: Only use payments from the SAME expenditure type as the current document
    const expenditureData = beneficiary.oikonomika[expenditureType];
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const newValue = input.value;
    const cursorPos = input.selectionStart || 0;
    
    // Only allow numeric input and limit to 9 digits
    const numericValue = newValue.replace(/\D/g, '').slice(0, 9);
    
    // Calculate how many characters were removed before cursor
    const removedBeforeCursor = newValue.slice(0, cursorPos).replace(/\D/g, '').length;
    
    setSearchTerm(numericValue);
    
    // Notify parent component when user types
    onChange?.(numericValue);
    
    // Restore cursor position after React re-render
    setTimeout(() => {
      if (input) {
        input.setSelectionRange(removedBeforeCursor, removedBeforeCursor);
      }
    }, 0);
    
    // Show dropdown when user types at least 4 characters
    if (numericValue.length >= 4) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchTerm.length >= 4 && setShowDropdown(true)}
          disabled={disabled}
          className="w-full pr-8"
          data-testid="input-afm-search"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : useEmployeeData ? (
            <User className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {/* Dropdown results */}
      {showDropdown && searchTerm.length >= 4 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 min-w-full w-[500px] mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[400px] overflow-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Αναζήτηση...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchTerm.length < 4 ? (
                "Πληκτρολογήστε τουλάχιστον 4 χαρακτήρες"
              ) : (
                "Δεν βρέθηκαν αποτελέσματα"
              )}
            </div>
          ) : (
            <div>
              {searchResults.map((person: Employee | Beneficiary, index: number) => (
                <div
                  key={person.id}
                  ref={el => { itemRefs.current[index] = el; }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border last:border-b-0 transition-colors",
                    highlightedIndex === index ? "bg-accent" : "hover:bg-accent"
                  )}
                  onClick={() => handleSelect(person)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  data-testid={`item-afm-${person.afm}`}
                >
                  {useEmployeeData ? (
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {person.surname} {person.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ΑΦΜ: {person.afm}
                      {person.fathername && ` • ${person.fathername}`}
                    </div>
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
