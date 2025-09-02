import { useState, useMemo } from "react";
import { XIcon, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

interface GeographicSelection {
  id: string;
  displayName: string;
  region: string;
  regionalUnit: string;
  municipality: string;
  level: 'region' | 'regional_unit' | 'municipality';
}

interface SmartGeographicMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  kallikratisData: any[];
  placeholder?: string;
}

export function SmartGeographicMultiSelect({
  value = [],
  onChange,
  kallikratisData,
  placeholder = "Επιλέξτε γεωγραφικές περιοχές..."
}: SmartGeographicMultiSelectProps) {
  const [currentLevel, setCurrentLevel] = useState<'region' | 'regional_unit' | 'municipality'>('region');
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedRegionalUnit, setSelectedRegionalUnit] = useState<string>("");

  // Get unique regions
  const regions = useMemo(() => {
    if (!kallikratisData?.length) return [];
    const uniqueRegions = Array.from(new Set(kallikratisData.map(k => k.perifereia))).filter(Boolean);
    return uniqueRegions.sort((a, b) => a.localeCompare(b, 'el'));
  }, [kallikratisData]);

  // Get regional units for selected region
  const regionalUnits = useMemo(() => {
    if (!selectedRegion || !kallikratisData?.length) return [];
    const units = Array.from(new Set(
      kallikratisData
        .filter(k => k.perifereia === selectedRegion)
        .map(k => k.perifereiaki_enotita)
    )).filter(Boolean);
    return units.sort((a, b) => a.localeCompare(b, 'el'));
  }, [selectedRegion, kallikratisData]);

  // Get municipalities for selected regional unit
  const municipalities = useMemo(() => {
    if (!selectedRegion || !selectedRegionalUnit || !kallikratisData?.length) return [];
    const munis = Array.from(new Set(
      kallikratisData
        .filter(k => k.perifereia === selectedRegion && k.perifereiaki_enotita === selectedRegionalUnit)
        .map(k => k.onoma_neou_ota)
    )).filter(Boolean);
    return munis.sort((a, b) => a.localeCompare(b, 'el'));
  }, [selectedRegion, selectedRegionalUnit, kallikratisData]);

  // Parse selected values to display
  const selectedItems = useMemo(() => {
    return value.map(id => {
      const [region, regionalUnit, municipality] = id.split('|');
      let displayName: string;
      let level: 'region' | 'regional_unit' | 'municipality';
      
      if (municipality) {
        displayName = `${region} › ${regionalUnit} › ${municipality}`;
        level = 'municipality';
      } else if (regionalUnit) {
        displayName = `${region} › ${regionalUnit}`;
        level = 'regional_unit';
      } else {
        displayName = region;
        level = 'region';
      }
      
      return {
        id,
        displayName,
        region,
        regionalUnit: regionalUnit || "",
        municipality: municipality || "",
        level
      };
    });
  }, [value]);

  const addSelection = (region: string, regionalUnit?: string, municipality?: string) => {
    const newSelections: string[] = [...value];
    
    // Backward selection: when adding a more specific level, also add the parent levels
    if (municipality && regionalUnit) {
      // Add municipality level
      const municipalityId = `${region}|${regionalUnit}|${municipality}`;
      if (!newSelections.includes(municipalityId)) {
        newSelections.push(municipalityId);
      }
      
      // Also add regional unit level if not already present
      const regionalUnitId = `${region}|${regionalUnit}|`;
      if (!newSelections.includes(regionalUnitId)) {
        newSelections.push(regionalUnitId);
      }
      
      // Also add region level if not already present
      const regionId = `${region}||`;
      if (!newSelections.includes(regionId)) {
        newSelections.push(regionId);
      }
    } else if (regionalUnit) {
      // Add regional unit level
      const regionalUnitId = `${region}|${regionalUnit}|`;
      if (!newSelections.includes(regionalUnitId)) {
        newSelections.push(regionalUnitId);
      }
      
      // Also add region level if not already present
      const regionId = `${region}||`;
      if (!newSelections.includes(regionId)) {
        newSelections.push(regionId);
      }
    } else {
      // Add only region level
      const regionId = `${region}||`;
      if (!newSelections.includes(regionId)) {
        newSelections.push(regionId);
      }
    }
    
    onChange(newSelections);
    
    // Reset selections for next pick
    setSelectedRegion("");
    setSelectedRegionalUnit("");
    setCurrentLevel('region');
  };

  const removeSelection = (id: string) => {
    onChange(value.filter(v => v !== id));
  };

  const canProceedToRegionalUnits = selectedRegion && regionalUnits.length > 0;
  const canProceedToMunicipalities = selectedRegion && selectedRegionalUnit && municipalities.length > 0;

  return (
    <div className="space-y-4">
      {/* Display selected values as badges */}
      <div className="flex flex-wrap gap-2">
        {selectedItems.map((item) => (
          <Badge 
            key={item.id} 
            className="flex items-center gap-1"
            variant="outline"
          >
            {item.displayName}
            <button 
              type="button"
              className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => removeSelection(item.id)}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      
      {/* Smart hierarchical selection */}
      <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
        <div className="text-sm font-medium text-gray-700">Προσθήκη νέας περιοχής:</div>
        
        {/* Step 1: Region Selection */}
        <div className="space-y-2">
          <div className="text-xs text-gray-600">1. Επιλέξτε Περιφέρεια:</div>
          <Select
            value={selectedRegion}
            onValueChange={setSelectedRegion}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Επιλέξτε περιφέρεια..." />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedRegion && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addSelection(selectedRegion)}
              className="text-xs"
            >
              ✓ Προσθήκη περιφέρειας: {selectedRegion}
            </Button>
          )}
        </div>

        {/* Step 2: Regional Unit Selection */}
        {canProceedToRegionalUnits && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              2. Επιλέξτε Περιφερειακή Ενότητα:
            </div>
            <Select
              value={selectedRegionalUnit}
              onValueChange={setSelectedRegionalUnit}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε περιφερειακή ενότητα..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {regionalUnits.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedRegionalUnit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSelection(selectedRegion, selectedRegionalUnit)}
                className="text-xs"
              >
                ✓ Προσθήκη (+ γονικά): {selectedRegion} › {selectedRegionalUnit}
              </Button>
            )}
          </div>
        )}

        {/* Step 3: Municipality Selection */}
        {canProceedToMunicipalities && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              3. Επιλέξτε Δήμο:
            </div>
            <Select
              value=""
              onValueChange={(municipality) => addSelection(selectedRegion, selectedRegionalUnit, municipality)}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε δήμο (θα προστεθούν όλα τα επίπεδα)..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {municipalities.map((municipality) => (
                  <SelectItem key={municipality} value={municipality}>
                    ✓ {municipality} (+ περιφέρεια + ενότητα)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}