import React, { useState, useMemo, useCallback } from 'react';
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

  // Optimized filtering with pre-computed maps for speed
  const regionUnitsMap = useMemo(() => {
    if (!kallikratisData) return new Map();
    
    const map = new Map<string, Set<string>>();
    kallikratisData.forEach(k => {
      if (k.perifereia && k.perifereiaki_enotita) {
        if (!map.has(k.perifereia)) {
          map.set(k.perifereia, new Set());
        }
        map.get(k.perifereia)!.add(k.perifereiaki_enotita);
      }
    });
    return map;
  }, [kallikratisData]);

  const getFilteredRegionalUnits = useMemo(() => {
    if (!region || !regionUnitsMap.has(region)) return [];
    
    const units = Array.from(regionUnitsMap.get(region)!) as string[];
    
    // Early return for no search
    if (!searchQuery?.trim()) {
      return units.sort((a: string, b: string) => a.localeCompare(b, 'el'));
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = units.filter((unit: string) => 
      unit.toLowerCase().includes(query)
    );
    
    // Fast sorting with single pass
    return filtered.sort((a: string, b: string) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // Exact match priority
      if (aLower === query) return -1;
      if (bLower === query) return 1;
      
      // Starts with priority
      const aStarts = aLower.startsWith(query);
      const bStarts = bLower.startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      
      // Alphabetical
      return a.localeCompare(b, 'el');
    });
  }, [regionUnitsMap, region, searchQuery]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
    setSearchQuery("");
  };

  // Fast statistics using pre-computed map
  const totalUnitsInRegion = useMemo(() => {
    return regionUnitsMap.get(region)?.size || 0;
  }, [regionUnitsMap, region]);

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
                {getFilteredRegionalUnits.map((unit: string) => (
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
                        unit.split(new RegExp(`(${searchQuery})`, 'gi')).map((part: string, index: number) =>
                          part.toLowerCase() === searchQuery.toLowerCase() ? (
                            <mark key={index} className="bg-yellow-200 font-medium">
                              {part}
                            </mark>
                          ) : (
                            <span key={index}>{part}</span>
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