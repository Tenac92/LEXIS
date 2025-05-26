/**
 * AFM Recipient Autocomplete Component
 * Specialized autocomplete for selecting recipients by AFM in document creation
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { type Employee } from "@shared/schema";

interface AFMRecipientAutocompleteProps {
  onSelectEmployee: (employee: Employee) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AFMRecipientAutocomplete({
  onSelectEmployee,
  placeholder = "Αναζήτηση υπαλλήλου με ΑΦΜ...",
  disabled = false,
  className
}: AFMRecipientAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch employees based on AFM search
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['/api/employees/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const response = await fetch(`/api/employees/search?afm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: searchTerm.length >= 2,
  });

  const handleSelectEmployee = (employee: Employee) => {
    console.log('[AFM Debug] Auto-filling form fields with employee data:', {
      firstname: employee.name,
      lastname: employee.surname, 
      fathername: employee.fathername,
      afm: employee.afm,
      secondary_text: employee.attribute
    });
    
    onSelectEmployee(employee);
    setOpen(false);
    setSearchTerm("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Αναζήτηση Υπαλλήλου (ΑΦΜ)</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="text-muted-foreground">{placeholder}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Πληκτρολογήστε ΑΦΜ..."
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
                    onSelect={() => handleSelectEmployee(employee)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <div className="font-medium">
                          {employee.surname} {employee.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.fathername && `${employee.fathername} • `}
                          {employee.attribute} • {employee.monada}
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
      <p className="text-xs text-muted-foreground">
        Επιλέξτε υπάλληλο από τον κατάλογο για αυτόματη συμπλήρωση των στοιχείων
      </p>
    </div>
  );
}

// Enhanced manual recipient form with AFM autocomplete integration
interface ManualRecipientFormProps {
  onAddRecipient: (recipient: any) => void;
  disabled?: boolean;
}

export function ManualRecipientForm({ onAddRecipient, disabled }: ManualRecipientFormProps) {
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    fathername: "",
    afm: "",
    amount: 0,
    secondary_text: "",
  });

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Auto-fill form when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      console.log('[AFM Debug] Auto-filling form fields with selected employee:', selectedEmployee);
      const newFormData = {
        firstname: selectedEmployee.name || "",
        lastname: selectedEmployee.surname || "",
        fathername: selectedEmployee.fathername || "",
        afm: String(selectedEmployee.afm || ""),
        amount: 0,
        secondary_text: selectedEmployee.attribute || "",
      };
      console.log('[AFM Debug] Setting form data to:', newFormData);
      setFormData(newFormData);
    }
  }, [selectedEmployee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.firstname && formData.lastname && formData.fathername && formData.afm) {
      onAddRecipient({
        ...formData,
        installment: "ΕΦΑΠΑΞ",
        installments: ["ΕΦΑΠΑΞ"],
        installmentAmounts: { ΕΦΑΠΑΞ: formData.amount },
      });
      
      // Reset form
      setFormData({
        firstname: "",
        lastname: "",
        fathername: "",
        afm: "",
        amount: 0,
        secondary_text: "",
      });
      setSelectedEmployee(null);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear selected employee when manually editing
    if (selectedEmployee && field !== 'amount' && field !== 'secondary_text') {
      setSelectedEmployee(null);
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h4 className="font-medium">Προσθήκη Παραλήπτη ΕΚΤΟΣ ΕΔΡΑΣ</h4>
      
      {/* AFM Autocomplete */}
      <AFMRecipientAutocomplete
        onSelectEmployee={setSelectedEmployee}
        disabled={disabled}
      />

      {/* Manual Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstname">Όνομα *</Label>
            <Input
              id="firstname"
              value={formData.firstname}
              onChange={(e) => handleInputChange('firstname', e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          <div>
            <Label htmlFor="lastname">Επώνυμο *</Label>
            <Input
              id="lastname"
              value={formData.lastname}
              onChange={(e) => handleInputChange('lastname', e.target.value)}
              disabled={disabled}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fathername">Πατρώνυμο *</Label>
            <Input
              id="fathername"
              value={formData.fathername}
              onChange={(e) => handleInputChange('fathername', e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          <div>
            <Label htmlFor="afm">ΑΦΜ *</Label>
            <Input
              id="afm"
              value={formData.afm}
              onChange={(e) => handleInputChange('afm', e.target.value)}
              maxLength={9}
              disabled={disabled}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount">Ποσό (€) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              required
            />
          </div>
          <div>
            <Label htmlFor="secondary_text">Ιδιότητα/Σχόλια</Label>
            <Input
              id="secondary_text"
              value={formData.secondary_text}
              onChange={(e) => handleInputChange('secondary_text', e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <Button type="submit" disabled={disabled} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη Παραλήπτη
        </Button>
      </form>

      {selectedEmployee && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <Check className="h-4 w-4" />
            <span className="font-medium">Επιλεγμένος υπάλληλος:</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {selectedEmployee.surname} {selectedEmployee.name} ({selectedEmployee.afm})
          </p>
        </div>
      )}
    </div>
  );
}