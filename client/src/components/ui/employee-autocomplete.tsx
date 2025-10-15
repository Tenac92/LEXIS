/**
 * Employee AFM Autocomplete Component
 * Provides autocomplete functionality for employee selection using AFM search
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
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
import { type Employee } from "@shared/schema";

interface EmployeeAutocompleteProps {
  value?: string; // AFM value
  onSelect: (employee: Employee | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function EmployeeAutocomplete({
  value,
  onSelect,
  placeholder = "Αναζήτηση με ΑΦΜ...",
  disabled = false,
  className
}: EmployeeAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch employees based on AFM search
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['/api/employees/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 1) return [];
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: searchTerm.length >= 1,
  });

  // Find selected employee
  const selectedEmployee = employees.find((emp: Employee) => emp.afm === value);

  const handleSelect = useCallback((employee: Employee | null) => {
    onSelect(employee);
    setOpen(false);
  }, [onSelect]);

  const displayValue = selectedEmployee 
    ? `${selectedEmployee.surname} ${selectedEmployee.name} (${selectedEmployee.afm})`
    : value 
    ? `ΑΦΜ: ${value}`
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
        >
          <div className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayValue}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Πληκτρολογήστε ΑΦΜ για αναζήτηση..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="border-0 focus:ring-0"
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
              ) : searchTerm.length < 1 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Πληκτρολογήστε τουλάχιστον 1 χαρακτήρα
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Δεν βρέθηκαν υπάλληλοι με αυτό το ΑΦΜ
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {/* Clear selection option */}
              {value && (
                <CommandItem
                  onSelect={() => handleSelect(null)}
                  className="text-muted-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Καθαρισμός επιλογής
                </CommandItem>
              )}
              
              {/* Employee options */}
              {employees.map((employee: Employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.afm || ''}
                  onSelect={() => handleSelect(employee)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === employee.afm ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {employee.surname} {employee.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {employee.fathername && `${employee.fathername} • `}
                        {employee.attribute && `${employee.attribute} • `}
                        {employee.monada}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {employee.afm}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Hook for employee search functionality
export function useEmployeeSearch() {
  const searchEmployeeByAFM = useCallback(async (afm: string): Promise<Employee | null> => {
    if (!afm || afm.length < 9) return null;
    
    try {
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(afm)}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        // Return exact match if found
        const exactMatch = data.data.find((emp: Employee) => emp.afm === afm);
        return exactMatch || data.data[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error searching employee by AFM:', error);
      return null;
    }
  }, []);

  return { searchEmployeeByAFM };
}