import { useState, useMemo } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";

interface GeographicOption {
  id: string;
  displayName: string;
  region: string;
  regionalUnit: string;
  municipality: string;
}

interface GeographicMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  geographicData: any;
  kallikratisData: any[];
  placeholder?: string;
  addLabel?: string;
}

export function GeographicMultiSelect({
  value = [],
  onChange,
  geographicData,
  kallikratisData,
  placeholder = "Επιλέξτε γεωγραφικές περιοχές...",
  addLabel = "Προσθέστε περιοχή"
}: GeographicMultiSelectProps) {
  
  // Create geographic options by combining region + regional unit + municipality
  const geographicOptions = useMemo((): GeographicOption[] => {
    const options: GeographicOption[] = [];
    
    if (geographicData?.regions && geographicData?.regionalUnits && geographicData?.municipalities) {
      // Use normalized geographic data
      geographicData.regions.forEach((regionItem: any) => {
        if (regionItem.regions?.name) {
          const regionName = regionItem.regions.name;
          
          // Find corresponding regional units for this region
          const relatedUnits = geographicData.regionalUnits?.filter((unitItem: any) => 
            unitItem.regional_units?.region_code === regionItem.regions.code
          ) || [];
          
          relatedUnits.forEach((unitItem: any) => {
            const regionalUnitName = unitItem.regional_units?.name;
            
            // Find municipalities for this regional unit
            const relatedMunicipalities = geographicData.municipalities?.filter((muniItem: any) => 
              muniItem.municipalities?.unit_code === unitItem.regional_units?.code
            ) || [];

            if (relatedMunicipalities.length > 0) {
              // Add options for each municipality
              relatedMunicipalities.forEach((muniItem: any) => {
                const municipalityName = muniItem.municipalities?.name;
                const displayName = `${regionName} › ${regionalUnitName} › ${municipalityName}`;
                const id = `${regionName}|${regionalUnitName}|${municipalityName}`;
                
                options.push({
                  id,
                  displayName,
                  region: regionName,
                  regionalUnit: regionalUnitName,
                  municipality: municipalityName
                });
              });
            } else {
              // Add option for regional unit level (no municipalities)
              const displayName = `${regionName} › ${regionalUnitName}`;
              const id = `${regionName}|${regionalUnitName}|`;
              
              options.push({
                id,
                displayName,
                region: regionName,
                regionalUnit: regionalUnitName,
                municipality: ""
              });
            }
          });
        }
      });
    } else if (kallikratisData?.length > 0) {
      // Fallback to kallikratis data
      const uniqueEntries = new Set<string>();
      
      kallikratisData.forEach((k) => {
        if (k.perifereia && k.perifereiaki_enotita) {
          let displayName: string;
          let id: string;
          
          if (k.onoma_neou_ota) {
            displayName = `${k.perifereia} › ${k.perifereiaki_enotita} › ${k.onoma_neou_ota}`;
            id = `${k.perifereia}|${k.perifereiaki_enotita}|${k.onoma_neou_ota}`;
          } else {
            displayName = `${k.perifereia} › ${k.perifereiaki_enotita}`;
            id = `${k.perifereia}|${k.perifereiaki_enotita}|`;
          }
          
          if (!uniqueEntries.has(id)) {
            uniqueEntries.add(id);
            options.push({
              id,
              displayName,
              region: k.perifereia,
              regionalUnit: k.perifereiaki_enotita,
              municipality: k.onoma_neou_ota || ""
            });
          }
        }
      });
    }
    
    // Sort options alphabetically
    return options.sort((a, b) => a.displayName.localeCompare(b.displayName, 'el'));
  }, [geographicData, kallikratisData]);

  // Only show options that haven't been selected yet
  const availableOptions = geographicOptions.filter(option => !value.includes(option.id));

  return (
    <div className="space-y-2">
      {/* Display selected values as badges */}
      <div className="flex flex-wrap gap-2">
        {value.map((selectedId) => {
          const option = geographicOptions.find(opt => opt.id === selectedId);
          return option ? (
            <Badge 
              key={option.id} 
              className="flex items-center gap-1"
              variant="outline"
            >
              {option.displayName}
              <button 
                type="button"
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => {
                  const newValue = value.filter(id => id !== option.id);
                  onChange(newValue);
                }}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ) : null;
        })}
      </div>
      
      {/* Dropdown to add new options */}
      <Select
        onValueChange={(selectedId) => {
          if (!value.includes(selectedId)) {
            onChange([...value, selectedId]);
          }
        }}
        value={undefined}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={value.length > 0 ? addLabel : placeholder} />
          </SelectTrigger>
        </FormControl>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          {availableOptions.length > 0 ? (
            availableOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.displayName}
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-center text-muted-foreground">
              Όλες οι επιλογές έχουν επιλεγεί
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}