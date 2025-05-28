/**
 * Smart AFM Autocomplete Component
 * Switches between employee and beneficiary data based on expenditure type:
 * - "ΕΚΤΟΣ ΕΔΡΑΣ" -> uses employee table
 * - All other types -> uses beneficiary table (filtered by type)
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { type Employee, type Beneficiary } from "@shared/schema";

interface SmartAFMAutocompleteProps {
  expenditureType: string;
  onSelectPerson: (person: Employee | Beneficiary) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  value?: string;
}

export function SmartAFMAutocomplete({
  expenditureType,
  onSelectPerson,
  placeholder = "Αναζήτηση με ΑΦΜ...",
  disabled = false,
  className,
  value = ""
}: SmartAFMAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [selectedValue, setSelectedValue] = useState(value);
  const [searchResults, setSearchResults] = useState<(Employee | Beneficiary)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Determine if we should use employee or beneficiary data
  const useEmployeeData = expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ";
  
  // Update search term when value prop changes
  useEffect(() => {
    if (value !== searchTerm) {
      setSearchTerm(value);
      setSelectedValue(value);
    }
  }, [value]);

  // Fetch employees when expenditure type is "ΕΚΤΟΣ ΕΔΡΑΣ"
  const { data: employees } = useQuery({
    queryKey: ['/api/employees'],
    enabled: useEmployeeData && searchTerm.length >= 2,
  });

  // Fetch beneficiaries for other expenditure types
  const { data: beneficiaries } = useQuery({
    queryKey: ['/api/beneficiaries'],
    enabled: !useEmployeeData && searchTerm.length >= 2,
  });

  // Search function with debouncing
  const performSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);

    try {
      let results: (Employee | Beneficiary)[] = [];

      if (useEmployeeData) {
        // Search in employees
        if (employees) {
          results = employees.filter((emp: Employee) => 
            emp.afm?.includes(term) || 
            emp.name?.toLowerCase().includes(term.toLowerCase()) ||
            emp.surname?.toLowerCase().includes(term.toLowerCase())
          ).slice(0, 10);
        }
      } else {
        // Search in beneficiaries
        if (beneficiaries) {
          results = beneficiaries.filter((ben: Beneficiary) => 
            ben.afm?.includes(term) || 
            ben.name?.toLowerCase().includes(term.toLowerCase()) ||
            ben.surname?.toLowerCase().includes(term.toLowerCase())
          ).slice(0, 10);
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('[AFM Autocomplete] Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [useEmployeeData, employees, beneficiaries]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, performSearch]);

  const handleSelect = (person: Employee | Beneficiary) => {
    const displayValue = `${person.afm} - ${person.surname} ${person.name}`;
    setSelectedValue(displayValue);
    setSearchTerm(displayValue);
    setOpen(false);
    onSelectPerson(person);
    console.log('[AFM] Selected person:', person);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Clear selection if user is typing
    if (newValue !== selectedValue) {
      setSelectedValue("");
    }
    
    if (newValue.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
      setSearchResults([]);
    }
  };

  const getIcon = (person: Employee | Beneficiary) => {
    return useEmployeeData ? (
      <User className="h-4 w-4 text-blue-500" />
    ) : (
      <Building2 className="h-4 w-4 text-green-500" />
    );
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
        onFocus={() => {
          if (searchTerm.length >= 2) {
            setOpen(true);
          }
        }}
      />
      
      {/* Dropdown results - only show when there are results */}
      {open && searchTerm.length >= 2 && (
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
                  onClick={() => handleSelect(person)}
                >
                  <div className="flex items-center space-x-2">
                    {getIcon(person)}
                    <div className="flex-1">
                      <div className="font-medium">
                        {person.surname} {person.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ΑΦΜ: {person.afm}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Click outside to close */}
      {open && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setOpen(false)}
        />
      )}
      
      {/* Show expenditure type indicator */}
      {expenditureType && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            {useEmployeeData ? "Αναζήτηση σε εργαζόμενους" : "Αναζήτηση σε δικαιούχους"}
          </Badge>
        </div>
      )}
    </div>
  );
}