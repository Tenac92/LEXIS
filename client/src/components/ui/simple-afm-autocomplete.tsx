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
}

export function SimpleAFMAutocomplete({
  expenditureType,
  onSelectPerson,
  placeholder = "ΑΦΜ",
  disabled = false,
  className,
  value = "",
  onChange
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
      if (!searchTerm || searchTerm.length < 6) return [];
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: useEmployeeData && searchTerm.length === 9,
  });

  // Fetch beneficiaries when expenditure type is NOT "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['/api/beneficiaries/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 6) return [];
      const response = await fetch(`/api/beneficiaries/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: !useEmployeeData && searchTerm.length === 9,
  });

  const isLoading = useEmployeeData ? employeesLoading : beneficiariesLoading;
  const searchResults = useEmployeeData ? employees : beneficiaries;

  // Helper function to determine next available installment
  const getNextAvailableInstallment = useCallback((beneficiary: any, expenditureType: string) => {
    if (!beneficiary.oikonomika || typeof beneficiary.oikonomika !== 'object') {
      return 'Α'; // Default to first installment if no financial data
    }

    const expenditureData = beneficiary.oikonomika[expenditureType];
    if (!expenditureData || typeof expenditureData !== 'object') {
      return 'Α'; // Default to first installment if no data for this expenditure type
    }

    // Check which installments are already "διαβιβάστηκε"
    const completedInstallments = new Set();
    
    // Handle both array and object formats
    if (Array.isArray(expenditureData)) {
      expenditureData.forEach((record: any) => {
        if (record.status === 'διαβιβάστηκε' || record.status === 'διαβιβαστηκε') {
          completedInstallments.add(record.installment);
        }
      });
    } else {
      // Handle object format like: { "Α": { "status": "διαβιβάστηκε", ... }, "Β": {...} }
      Object.entries(expenditureData).forEach(([installment, record]: [string, any]) => {
        if (record && (record.status === 'διαβιβάστηκε' || record.status === 'διαβιβαστηκε')) {
          completedInstallments.add(installment);
        }
      });
    }

    // Return next available installment in sequence
    const installmentSequence = ['Α', 'Β', 'Γ', 'Δ', 'Ε'];
    for (const installment of installmentSequence) {
      if (!completedInstallments.has(installment)) {
        return installment;
      }
    }

    return 'Α'; // Fallback to first installment
  }, []);

  const handleSelect = useCallback((person: Employee | Beneficiary) => {
    // For beneficiaries, add smart installment selection
    if (!useEmployeeData && 'oikonomika' in person) {
      const nextInstallment = getNextAvailableInstallment(person, expenditureType);
      const enhancedPerson = {
        ...person,
        suggestedInstallment: nextInstallment
      };
      onSelectPerson(enhancedPerson);
    } else {
      onSelectPerson(person);
    }
    
    setShowDropdown(false);
    setSearchTerm(String(person.afm || ""));
  }, [onSelectPerson, useEmployeeData, expenditureType, getNextAvailableInstallment]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numeric input and limit to 9 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 9);
    
    setSearchTerm(numericValue);
    setShowDropdown(numericValue.length === 9);
    
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