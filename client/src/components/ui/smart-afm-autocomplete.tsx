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
import { type Employee, type Beneficiary } from "@shared/schema";

interface SmartAFMAutocompleteProps {
  expenditureType: string;
  onSelectPerson: (person: Employee | Beneficiary) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SmartAFMAutocomplete({
  expenditureType,
  onSelectPerson,
  placeholder = "Αναζήτηση με ΑΦΜ...",
  disabled = false,
  className
}: SmartAFMAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
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
    console.log('[Smart AFM Debug] Selected person:', {
      type: useEmployeeData ? 'Employee' : 'Beneficiary',
      expenditureType,
      person
    });
    
    onSelectPerson(person);
    setOpen(false);
    setSearchTerm("");
  }, [onSelectPerson, useEmployeeData, expenditureType]);

  // Get appropriate display text for the current mode
  const getDisplayText = () => {
    if (useEmployeeData) {
      return "Αναζήτηση υπαλλήλου (ΕΚΤΟΣ ΕΔΡΑΣ)";
    }
    return `Αναζήτηση δικαιούχου (${expenditureType})`;
  };

  const getIcon = () => {
    return useEmployeeData ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />;
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={disabled}
        className="w-full"
        onFocus={() => setOpen(true)}
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
            </div>
          ) : (
            <div>
              {searchResults.map((person: Employee | Beneficiary) => (
                <div
                  key={person.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelect(person)}
                >
                  <div className="font-medium">
                    {(person as Employee).surname || (person as Beneficiary).surname} {(person as Employee).name || (person as Beneficiary).name}
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
      
      {/* Click outside to close */}
      {open && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setOpen(false)}
        />
      )} 
                      ? "Δεν βρέθηκε υπάλληλος με αυτό το ΑΦΜ"
                      : `Δεν βρέθηκε δικαιούχος τύπου "${expenditureType}" με αυτό το ΑΦΜ`
                    }
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {searchResults.map((person: Employee | Beneficiary) => (
                  <CommandItem
                    key={person.id}
                    value={person.afm}
                    onSelect={() => handleSelect(person)}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                      {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {person.surname} {person.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {person.afm}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {person.fathername && `Πατρώνυμο: ${person.fathername}`}
                      </div>
                      {!useEmployeeData && 'amount' in person && (
                        <div className="text-xs text-green-600">
                          Ποσό: €{person.amount}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}