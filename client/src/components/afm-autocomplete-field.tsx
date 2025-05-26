/**
 * AFM Autocomplete Field Component
 * Handles AFM input with real-time search and auto-completion for recipient data
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type Employee } from "@shared/schema";

interface AFMAutocompleteFieldProps {
  value: string;
  onChange: (value: string) => void;
  onEmployeeSelect?: (employee: Employee | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

export function AFMAutocompleteField({
  value,
  onChange,
  onEmployeeSelect,
  placeholder = "Εισάγετε ΑΦΜ...",
  disabled = false,
  className,
  label = "ΑΦΜ",
  required = false,
}: AFMAutocompleteFieldProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Update search term when value changes from outside
  useEffect(() => {
    if (value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Search employees based on AFM
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['/api/employees/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      
      try {
        const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        return data.success ? data.data : [];
      } catch (error) {
        console.error('Error searching employees:', error);
        return [];
      }
    },
    enabled: searchTerm.length >= 2,
  });

  // Handle input change
  const handleInputChange = useCallback((newValue: string) => {
    setSearchTerm(newValue);
    onChange(newValue);
    
    // Clear selected employee if AFM doesn't match
    if (selectedEmployee && selectedEmployee.afm !== newValue) {
      setSelectedEmployee(null);
      onEmployeeSelect?.(null);
    }
    
    // Auto-open suggestions if typing
    if (newValue.length >= 2) {
      setIsOpen(true);
    }
  }, [onChange, onEmployeeSelect, selectedEmployee]);

  // Handle employee selection
  const handleEmployeeSelect = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setSearchTerm(employee.afm || "");
    onChange(employee.afm || "");
    onEmployeeSelect?.(employee);
    setIsOpen(false);
  }, [onChange, onEmployeeSelect]);

  // Find exact match in current results
  const exactMatch = employees.find((emp: Employee) => emp.afm === searchTerm);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor="afm-input">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                id="afm-input"
                value={searchTerm}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  "pr-10",
                  exactMatch && "border-green-500 bg-green-50",
                  searchTerm.length >= 2 && !exactMatch && !isLoading && employees.length === 0 && "border-yellow-500 bg-yellow-50"
                )}
                maxLength={9}
              />
              
              {/* Status indicators */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isLoading && searchTerm.length >= 2 && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
                
                {exactMatch && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                
                {searchTerm.length >= 2 && !isLoading && !exactMatch && employees.length === 0 && (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </PopoverTrigger>
          
          <PopoverContent className="w-full p-0" align="start" side="bottom">
            <Command>
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
                      Δεν βρέθηκαν υπάλληλοι με αυτό το ΑΦΜ
                    </div>
                  )}
                </CommandEmpty>
                
                <CommandGroup>
                  {employees.map((employee: Employee) => (
                    <CommandItem
                      key={employee.id}
                      value={employee.afm}
                      onSelect={() => handleEmployeeSelect(employee)}
                      className="flex items-start justify-between cursor-pointer p-3"
                    >
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div className="flex flex-col">
                          <div className="font-medium">
                            {employee.surname} {employee.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employee.fathername}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employee.attribute} • {employee.monada}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {employee.afm}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Status messages */}
      {exactMatch && (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4" />
          <span>
            Βρέθηκε: {exactMatch.surname} {exactMatch.name}
          </span>
        </div>
      )}
      
      {searchTerm.length >= 2 && !isLoading && !exactMatch && employees.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-yellow-700">
          <AlertCircle className="h-4 w-4" />
          <span>Δεν βρέθηκε υπάλληλος με αυτό το ΑΦΜ</span>
        </div>
      )}
    </div>
  );
}

// Hook for AFM-based recipient auto-fill
export function useAFMRecipientAutoFill() {
  const [lastSearchedEmployee, setLastSearchedEmployee] = useState<Employee | null>(null);

  const fillRecipientFromEmployee = useCallback((employee: Employee | null) => {
    setLastSearchedEmployee(employee);
    
    if (!employee) return null;

    return {
      firstname: employee.name || "",
      lastname: employee.surname || "",
      fathername: employee.fathername || "",
      afm: employee.afm || "",
      secondary_text: employee.attribute || "",
    };
  }, []);

  const getEmployeeInfo = useCallback(() => {
    return lastSearchedEmployee;
  }, [lastSearchedEmployee]);

  return {
    fillRecipientFromEmployee,
    getEmployeeInfo,
    lastSearchedEmployee,
  };
}

// Enhanced AFM Input with auto-fill integration
interface AFMInputWithAutoFillProps {
  value: string;
  onChange: (value: string) => void;
  onAutoFill?: (data: {
    firstname: string;
    lastname: string;
    fathername: string;
    afm: string;
    secondary_text: string;
  } | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

export function AFMInputWithAutoFill({
  value,
  onChange,
  onAutoFill,
  ...props
}: AFMInputWithAutoFillProps) {
  const { fillRecipientFromEmployee } = useAFMRecipientAutoFill();

  const handleEmployeeSelect = useCallback((employee: Employee | null) => {
    const recipientData = fillRecipientFromEmployee(employee);
    onAutoFill?.(recipientData);
  }, [fillRecipientFromEmployee, onAutoFill]);

  return (
    <AFMAutocompleteField
      value={value}
      onChange={onChange}
      onEmployeeSelect={handleEmployeeSelect}
      {...props}
    />
  );
}