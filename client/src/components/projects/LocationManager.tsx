import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, MapPin, Building, Globe } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface LocationEntry {
  implementing_agency: string;
  event_type: string;
  expenditure_types: string[];
  regions: Array<{
    region: string;
    regional_unit: string;
    municipality: string;
  }>;
}

interface LocationManagerProps {
  form: any;
  eventTypesData?: any[];
  unitsData?: any[];
  expenditureTypesData?: any[];
  kallikratisData?: any[];
}

export function LocationManager({ 
  form, 
  eventTypesData = [], 
  unitsData = [], 
  expenditureTypesData = [], 
  kallikratisData = [] 
}: LocationManagerProps) {
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);

  const locationDetails = form.watch("location_details") || [];

  // Get unique regions, regional units, and municipalities from kallikratis data
  const uniqueRegions = Array.from(new Set(kallikratisData.map((k: any) => k.perifereia))).filter(Boolean).sort();
  
  const getRegionalUnitsForRegion = (region: string) => {
    return Array.from(new Set(
      kallikratisData
        .filter((k: any) => k.perifereia === region)
        .map((k: any) => k.perifereiaki_enotita)
    )).filter(Boolean).sort();
  };

  const getMunicipalitiesForRegionalUnit = (region: string, regionalUnit: string) => {
    return Array.from(new Set(
      kallikratisData
        .filter((k: any) => k.perifereia === region && k.perifereiaki_enotita === regionalUnit)
        .map((k: any) => k.onoma_neou_ota)
    )).filter(Boolean).sort();
  };

  const addLocationEntry = () => {
    const currentLocations = form.getValues("location_details") || [];
    const newLocation: LocationEntry = {
      implementing_agency: "",
      event_type: "",
      expenditure_types: [],
      regions: [{ region: "", regional_unit: "", municipality: "" }]
    };
    
    form.setValue("location_details", [...currentLocations, newLocation]);
    setActiveLocationIndex(currentLocations.length);
  };

  const removeLocationEntry = (index: number) => {
    const currentLocations = form.getValues("location_details") || [];
    const filteredLocations = currentLocations.filter((_: any, i: number) => i !== index);
    form.setValue("location_details", filteredLocations);
    
    if (activeLocationIndex >= filteredLocations.length) {
      setActiveLocationIndex(Math.max(0, filteredLocations.length - 1));
    }
  };

  const addRegionToLocation = (locationIndex: number) => {
    const currentLocations = form.getValues("location_details") || [];
    const updatedLocations = [...currentLocations];
    
    if (updatedLocations[locationIndex]) {
      updatedLocations[locationIndex].regions.push({
        region: "",
        regional_unit: "",
        municipality: ""
      });
      form.setValue("location_details", updatedLocations);
    }
  };

  const removeRegionFromLocation = (locationIndex: number, regionIndex: number) => {
    const currentLocations = form.getValues("location_details") || [];
    const updatedLocations = [...currentLocations];
    
    if (updatedLocations[locationIndex] && updatedLocations[locationIndex].regions.length > 1) {
      updatedLocations[locationIndex].regions.splice(regionIndex, 1);
      form.setValue("location_details", updatedLocations);
    }
  };

  const updateRegion = (locationIndex: number, regionIndex: number, field: string, value: string) => {
    const currentLocations = form.getValues("location_details") || [];
    const updatedLocations = [...currentLocations];
    
    if (updatedLocations[locationIndex] && updatedLocations[locationIndex].regions[regionIndex]) {
      (updatedLocations[locationIndex].regions[regionIndex] as any)[field] = value;
      
      // Clear dependent fields when parent field changes
      if (field === "region") {
        updatedLocations[locationIndex].regions[regionIndex].regional_unit = "";
        updatedLocations[locationIndex].regions[regionIndex].municipality = "";
      } else if (field === "regional_unit") {
        updatedLocations[locationIndex].regions[regionIndex].municipality = "";
      }
      
      form.setValue("location_details", updatedLocations);
    }
  };

  const updateExpenditureTypes = (locationIndex: number, expenditureType: string, checked: boolean) => {
    const currentLocations = form.getValues("location_details") || [];
    const updatedLocations = [...currentLocations];
    
    if (updatedLocations[locationIndex]) {
      const currentTypes = updatedLocations[locationIndex].expenditure_types || [];
      
      if (checked) {
        if (!currentTypes.includes(expenditureType)) {
          updatedLocations[locationIndex].expenditure_types = [...currentTypes, expenditureType];
        }
      } else {
        updatedLocations[locationIndex].expenditure_types = currentTypes.filter((type: string) => type !== expenditureType);
      }
      
      form.setValue("location_details", updatedLocations);
    }
  };

  // Initialize with at least one location entry if empty
  useEffect(() => {
    const currentLocations = form.getValues("location_details") || [];
    if (currentLocations.length === 0) {
      addLocationEntry();
    }
  }, []);

  if (locationDetails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Γεωγραφική Κάλυψη
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Δεν έχουν οριστεί γεωγραφικές περιοχές</p>
            <Button onClick={addLocationEntry} className="gap-2">
              <Plus className="h-4 w-4" />
              Προσθήκη Τοποθεσίας
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Location Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {locationDetails.map((location: LocationEntry, index: number) => {
          const isActive = index === activeLocationIndex;
          const hasData = location.implementing_agency || location.event_type || location.expenditure_types.length > 0;
          
          return (
            <Button
              key={index}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveLocationIndex(index)}
              className="gap-2"
            >
              <Building className="h-3 w-3" />
              Τοποθεσία {index + 1}
              {hasData && <Badge variant="secondary" className="ml-1 px-1 text-xs">●</Badge>}
            </Button>
          );
        })}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={addLocationEntry}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Νέα Τοποθεσία
        </Button>
      </div>

      {/* Active Location Details */}
      {locationDetails[activeLocationIndex] && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Τοποθεσία {activeLocationIndex + 1}
              </CardTitle>
              {locationDetails.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLocationEntry(activeLocationIndex)}
                  className="text-destructive hover:text-destructive gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Διαγραφή
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Implementation Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`location_details.${activeLocationIndex}.implementing_agency`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Φορέας Υλοποίησης</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε φορέα" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unitsData.map((unit: any) => (
                          <SelectItem key={unit.id} value={unit.name || unit.unit}>
                            {unit.name || unit.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`location_details.${activeLocationIndex}.event_type`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Τύπος Συμβάντος</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε τύπο συμβάντος" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypesData.map((eventType: any) => (
                          <SelectItem key={eventType.id} value={eventType.name}>
                            {eventType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Expenditure Types */}
            <div>
              <FormLabel className="text-base font-semibold mb-3 block">Τύποι Δαπανών</FormLabel>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {expenditureTypesData.map((expenditure: any) => {
                  const isChecked = locationDetails[activeLocationIndex]?.expenditure_types?.includes(expenditure.expenditure_types) || false;
                  
                  return (
                    <div key={expenditure.id} className="flex items-start space-x-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => 
                          updateExpenditureTypes(activeLocationIndex, expenditure.expenditure_types, checked as boolean)
                        }
                      />
                      <div className="space-y-1 leading-none">
                        <label className="text-sm font-normal cursor-pointer">
                          {expenditure.expenditure_types}
                        </label>
                        {expenditure.expenditure_types_minor && (
                          <p className="text-xs text-muted-foreground">
                            {expenditure.expenditure_types_minor}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Geographic Regions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <FormLabel className="text-base font-semibold">Γεωγραφικές Περιοχές</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRegionToLocation(activeLocationIndex)}
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Προσθήκη Περιοχής
                </Button>
              </div>

              <div className="space-y-4">
                {locationDetails[activeLocationIndex]?.regions?.map((region: any, regionIndex: number) => (
                  <Card key={regionIndex} className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Περιοχή {regionIndex + 1}
                        </h4>
                        {locationDetails[activeLocationIndex].regions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRegionFromLocation(activeLocationIndex, regionIndex)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        {/* Region Select */}
                        <div>
                          <FormLabel className="text-sm">Περιφέρεια</FormLabel>
                          <Select
                            value={region.region}
                            onValueChange={(value) => updateRegion(activeLocationIndex, regionIndex, "region", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Επιλέξτε περιφέρεια" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueRegions.map((regionName: string) => (
                                <SelectItem key={regionName} value={regionName}>
                                  {regionName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Regional Unit Select */}
                        <div>
                          <FormLabel className="text-sm">Περιφερειακή Ενότητα</FormLabel>
                          <Select
                            value={region.regional_unit}
                            onValueChange={(value) => updateRegion(activeLocationIndex, regionIndex, "regional_unit", value)}
                            disabled={!region.region}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Επιλέξτε π.ε." />
                            </SelectTrigger>
                            <SelectContent>
                              {region.region && getRegionalUnitsForRegion(region.region).map((unitName: string) => (
                                <SelectItem key={unitName} value={unitName}>
                                  {unitName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Municipality Select */}
                        <div>
                          <FormLabel className="text-sm">Δήμος</FormLabel>
                          <Select
                            value={region.municipality}
                            onValueChange={(value) => updateRegion(activeLocationIndex, regionIndex, "municipality", value)}
                            disabled={!region.regional_unit}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Επιλέξτε δήμο" />
                            </SelectTrigger>
                            <SelectContent>
                              {region.region && region.regional_unit && 
                                getMunicipalitiesForRegionalUnit(region.region, region.regional_unit).map((municipalityName: string) => (
                                <SelectItem key={municipalityName} value={municipalityName}>
                                  {municipalityName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}