import { useState, useCallback } from "react";
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
}

export function SimpleAFMAutocomplete({
  expenditureType,
  onSelectPerson,
  placeholder = "ΑΦΜ",
  disabled = false,
  className
}: SimpleAFMAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Determine if we should use employee or beneficiary data
  const useEmployeeData = expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ";
  
  // Fetch employees when expenditure type is "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: useEmployeeData && searchTerm.length >= 2,
  });

  // Fetch beneficiaries when expenditure type is NOT "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['/api/beneficiaries/search', searchTerm, expenditureType],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const response = await fetch(`/api/beneficiaries/search?afm=${encodeURIComponent(searchTerm)}&type=${encodeURIComponent(expenditureType)}`);
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: !useEmployeeData && searchTerm.length >= 2,
  });

  const isLoading = useEmployeeData ? employeesLoading : beneficiariesLoading;
  const searchResults = useEmployeeData ? employees : beneficiaries;

  const handleSelect = useCallback((person: Employee | Beneficiary) => {
    onSelectPerson(person);
    setShowDropdown(false);
    setSearchTerm(String(person.afm || ""));
  }, [onSelectPerson]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(value.length >= 2);
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
                  onMouseDown={() => handleSelect(person)}
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