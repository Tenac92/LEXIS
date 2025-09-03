import { useState, useMemo } from "react";
import { XIcon, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([]);

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
    
    // Handle empty/skipped levels
    const cleanRegion = region || "";
    const cleanRegionalUnit = regionalUnit || "";
    const cleanMunicipality = municipality || "";
    
    // Create the ID with potentially empty levels
    let id: string;
    if (cleanMunicipality) {
      id = `${cleanRegion}|${cleanRegionalUnit}|${cleanMunicipality}`;
    } else if (cleanRegionalUnit) {
      id = `${cleanRegion}|${cleanRegionalUnit}|`;
    } else {
      id = `${cleanRegion}||`;
    }
    
    // Add the selection if not already present
    if (!newSelections.includes(id)) {
      newSelections.push(id);
    }
    
    // For backward compatibility - also add parent levels when they exist and aren't skipped
    if (cleanMunicipality && cleanRegionalUnit && cleanRegion) {
      // Complete hierarchy - add all levels
      const regionalUnitId = `${cleanRegion}|${cleanRegionalUnit}|`;
      const regionId = `${cleanRegion}||`;
      
      if (!newSelections.includes(regionalUnitId)) {
        newSelections.push(regionalUnitId);
      }
      if (!newSelections.includes(regionId)) {
        newSelections.push(regionId);
      }
    } else if (cleanRegionalUnit && cleanRegion) {
      // Regional unit level - also add region if not skipped
      const regionId = `${cleanRegion}||`;
      if (!newSelections.includes(regionId)) {
        newSelections.push(regionId);
      }
    }
    
    onChange(newSelections);
    
    // Reset selections for next pick
    setSelectedRegion("");
    setSelectedRegionalUnit("");
    setSelectedMunicipalities([]);
    setCurrentLevel('region');
  };

  const removeSelection = (id: string) => {
    onChange(value.filter(v => v !== id));
  };

  const canProceedToRegionalUnits = selectedRegion && regionalUnits.length > 0;
  const canProceedToMunicipalities = selectedRegion && selectedRegionalUnit && selectedRegionalUnit !== "SKIP" && municipalities.length > 0;

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
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSelection(selectedRegion)}
                className="text-xs"
              >
                ✓ Προσθήκη περιφέρειας: {selectedRegion}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedRegion("")}
                className="text-xs text-gray-500"
              >
                Παράλειψη περιφέρειας
              </Button>
            </div>
          )}
        </div>

        {/* Step 2: Regional Unit Selection or Skip */}
        {(canProceedToRegionalUnits || selectedRegion) && (
          <div className="space-y-2">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              2. Επιλέξτε Περιφερειακή Ενότητα (ή παραλείψτε):
            </div>
            <Select
              value={selectedRegionalUnit}
              onValueChange={(value) => {
                if (value === "SKIP_LEVEL") {
                  setSelectedRegionalUnit("SKIP");
                } else {
                  setSelectedRegionalUnit(value);
                }
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε περιφερειακή ενότητα..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="SKIP_LEVEL">
                  🚫 Παράλειψη ενότητας (κενό επίπεδο)
                </SelectItem>
                {regionalUnits.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedRegionalUnit && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addSelection(selectedRegion, selectedRegionalUnit)}
                  className="text-xs"
                >
                  ✓ Προσθήκη (+ γονικά): {selectedRegion} › {selectedRegionalUnit}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRegionalUnit("")}
                  className="text-xs text-gray-500"
                >
                  Παράλειψη ενότητας
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Municipality Multi-Selection with Checkboxes */}
        {(canProceedToMunicipalities || selectedRegionalUnit) && (
          <div className="space-y-3">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              3. Επιλέξτε Δήμους (πολλαπλή επιλογή):
            </div>
            
            {/* Checkbox List for Multiple Municipality Selection */}
            <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-white space-y-2">
              {municipalities.length > 0 ? (
                municipalities.map((municipality) => (
                  <div key={municipality} className="flex items-center space-x-2">
                    <Checkbox
                      id={`municipality-${municipality}`}
                      checked={selectedMunicipalities.includes(municipality)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedMunicipalities(prev => [...prev, municipality]);
                        } else {
                          setSelectedMunicipalities(prev => prev.filter(m => m !== municipality));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`municipality-${municipality}`}
                      className="text-sm cursor-pointer hover:text-blue-600"
                    >
                      {municipality}
                    </label>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm italic">
                  Δεν υπάρχουν διαθέσιμοι δήμοι για την επιλεγμένη ενότητα
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {selectedMunicipalities.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Add all selected municipalities
                    selectedMunicipalities.forEach(municipality => {
                      addSelection(selectedRegion, selectedRegionalUnit === "SKIP" ? "" : selectedRegionalUnit, municipality);
                    });
                    setSelectedMunicipalities([]);
                  }}
                  className="text-xs"
                >
                  ✓ Προσθήκη {selectedMunicipalities.length} δήμων
                </Button>
              )}
              
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Skip municipalities (add without municipality)
                  addSelection(selectedRegion, selectedRegionalUnit === "SKIP" ? "" : selectedRegionalUnit, "");
                  setSelectedMunicipalities([]);
                }}
                className="text-xs text-gray-500"
              >
                🚫 Παράλειψη δήμων
              </Button>
              
              {selectedMunicipalities.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedMunicipalities([])}
                  className="text-xs text-red-500"
                >
                  Καθαρισμός επιλογών
                </Button>
              )}
            </div>
            
            {/* Show currently selected municipalities */}
            {selectedMunicipalities.length > 0 && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                Επιλεγμένοι δήμοι ({selectedMunicipalities.length}): {selectedMunicipalities.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}