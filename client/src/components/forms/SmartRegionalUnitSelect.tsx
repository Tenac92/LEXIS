import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KallikratisEntry {
  id: number;
  perifereia: string;
  perifereiaki_enotita: string;
  onoma_neou_ota: string;
}

interface SmartRegionalUnitSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  region: string;
  kallikratisData: KallikratisEntry[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SmartRegionalUnitSelect({
  value,
  onValueChange,
  region,
  kallikratisData,
  placeholder = "Επιλέξτε περιφερειακή ενότητα",
  disabled = false,
  className
}: SmartRegionalUnitSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Smart filtering function
  const getFilteredRegionalUnits = useMemo(() => {
    if (!kallikratisData || !region) return [];
    
    // Get all regional units for the region
    const units = new Set(
      kallikratisData
        .filter(k => k.perifereia === region)
        .map(k => k.perifereiaki_enotita)
        .filter(Boolean) // Remove empty/null values
    );
    
    let filteredUnits = Array.from(units);
    
    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      filteredUnits = filteredUnits.filter(unit => 
        unit.toLowerCase().includes(normalizedQuery)
      );
    }
    
    // Smart sorting: prioritize exact matches, then partial matches, then alphabetical
    return filteredUnits.sort((a, b) => {
      if (!searchQuery) return a.localeCompare(b, 'el'); // Greek locale sorting
      
      const query = searchQuery.toLowerCase();
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // Exact matches first
      if (aLower === query) return -1;
      if (bLower === query) return 1;
      
      // Starts with query
      if (aLower.startsWith(query) && !bLower.startsWith(query)) return -1;
      if (bLower.startsWith(query) && !aLower.startsWith(query)) return 1;
      
      // Contains query
      const aContains = aLower.includes(query);
      const bContains = bLower.includes(query);
      if (aContains && !bContains) return -1;
      if (bContains && !aContains) return 1;
      
      // Alphabetical for equal relevance
      return a.localeCompare(b, 'el');
    });
  }, [kallikratisData, region, searchQuery]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
    setSearchQuery("");
  };

  // Get statistics for better UX
  const totalUnitsInRegion = useMemo(() => {
    if (!kallikratisData || !region) return 0;
    return new Set(
      kallikratisData
        .filter(k => k.perifereia === region)
        .map(k => k.perifereiaki_enotita)
        .filter(Boolean)
    ).size;
  }, [kallikratisData, region]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled || !region}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Αναζήτηση περιφερειακής ενότητας..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="border-0 focus:ring-0"
            />
          </div>
          
          {!region ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Επιλέξτε πρώτα περιφέρεια
            </div>
          ) : (
            <>
              {/* Statistics header */}
              <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
                {searchQuery 
                  ? `${getFilteredRegionalUnits.length} αποτελέσματα από ${totalUnitsInRegion} ενότητες`
                  : `${totalUnitsInRegion} περιφερειακές ενότητες στην ${region}`
                }
              </div>

              <CommandEmpty className="py-6 text-center text-sm">
                {searchQuery 
                  ? `Δεν βρέθηκαν ενότητες που να περιέχουν "${searchQuery}"`
                  : "Δεν βρέθηκαν περιφερειακές ενότητες"
                }
              </CommandEmpty>

              <CommandGroup className="max-h-[200px] overflow-y-auto">
                {getFilteredRegionalUnits.map((unit) => (
                  <CommandItem
                    key={unit}
                    value={unit}
                    onSelect={() => handleSelect(unit)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === unit ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">
                      {searchQuery ? (
                        // Highlight matching text
                        unit.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, index) =>
                          part.toLowerCase() === searchQuery.toLowerCase() ? (
                            <mark key={index} className="bg-yellow-200 font-medium">
                              {part}
                            </mark>
                          ) : (
                            part
                          )
                        )
                      ) : (
                        unit
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}