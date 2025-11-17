// ComprehensiveEditSections.tsx
// All tab sections as subcomponents. Start by wiring them and then paste/migrate
// the detailed JSX for each section from your original file into the relevant component.

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type {
  ComprehensiveFormData,
  UnitData,
  EventTypeData,
  ExpenditureTypeData,
} from "./ComprehensiveEditHelpers";

// ───────────────────────────────────────────────────────────
// Decisions Tab
// ───────────────────────────────────────────────────────────
export function DecisionsTab(props: {
  form: UseFormReturn<ComprehensiveFormData>;
  units: UnitData[] | undefined;
  expenditureTypes: ExpenditureTypeData[] | undefined;
  selected: Set<number>;
  onToggle: (i: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}) {
  const { form } = props;
  return (
    <TabsContent value="decisions">
<Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Αποφάσεις που Τεκμηριώνουν το Έργο
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Batch Operation Buttons */}
                      <div className="flex flex-wrap gap-2 pb-4 border-b">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAllDecisions}
                          className="flex items-center gap-2"
                        >
                          <CheckSquare className="h-4 w-4" />
                          Επιλογή Όλων
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeselectAllDecisions}
                          className="flex items-center gap-2"
                        >
                          <Square className="h-4 w-4" />
                          Αποεπιλογή Όλων
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDuplicateSelectedDecisions}
                          disabled={selectedDecisions.size === 0}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Αντιγραφή Επιλεγμένων ({selectedDecisions.size})
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteSelectedDecisions}
                          disabled={selectedDecisions.size === 0}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Διαγραφή Επιλεγμένων ({selectedDecisions.size})
                        </Button>
                      </div>

                      {/* Accordion for Decisions */}
                      <Accordion type="multiple" className="w-full space-y-2">
                        {form.watch("decisions").map((decision, index) => {
                          const protocolNumber = decision.protocol_number || `Απόφαση ${index + 1}`;
                          const decisionType = decision.decision_type || "Έγκριση";
                          const budget = decision.decision_budget 
                            ? formatEuropeanCurrency(parseEuropeanNumber(decision.decision_budget))
                            : "Μη καθορισμένο";
                          const fekInfo = decision.fek?.year && decision.fek?.issue && decision.fek?.number
                            ? `ΦΕΚ ${decision.fek.issue}' ${decision.fek.number}/${decision.fek.year}`
                            : "Χωρίς ΦΕΚ";
                          const ada = decision.ada || "Χωρίς ΑΔΑ";
                          const agenciesCount = decision.implementing_agency?.length || 0;
                          const isExcluded = decision.included === false;

                          return (
                            <AccordionItem 
                              key={index} 
                              value={`decision-${index}`}
                              className={`border rounded-lg ${getDecisionBorderColor(decisionType)} border-l-4`}
                            >
                              <div className="flex items-center gap-3 pr-2">
                                <Checkbox
                                  checked={selectedDecisions.has(index)}
                                  onCheckedChange={() => toggleDecisionSelection(index)}
                                  className="ml-4"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                
                                <AccordionTrigger className="flex-1 hover:no-underline py-4">
                                  <div className="flex items-start justify-between w-full pr-4">
                                    <div className="flex flex-col items-start gap-2">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-base">{protocolNumber}</h4>
                                        <Badge variant="outline" className={`bg-${getDecisionColor(decisionType)}-100 text-${getDecisionColor(decisionType)}-700 border-${getDecisionColor(decisionType)}-300`}>
                                          {decisionType}
                                        </Badge>
                                        {isExcluded && (
                                          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300">
                                            Εξαιρείται
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <strong>Προϋπολογισμός:</strong> {budget}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <strong>{fekInfo}</strong>
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <strong>ΑΔΑ:</strong> {ada}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Building2 className="h-3 w-3" />
                                          {agenciesCount} {agenciesCount === 1 ? 'Μονάδα' : 'Μονάδες'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>

                                {form.watch("decisions").length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const decisions = form.getValues("decisions");
                                      decisions.splice(index, 1);
                                      form.setValue("decisions", decisions);
                                      setSelectedDecisions(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(index);
                                        return newSet;
                                      });
                                    }}
                                    data-testid={`button-delete-decision-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <AccordionContent className="px-4 pb-4 pt-2">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.protocol_number`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="π.χ. 12345/2024"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.ada`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>ΑΔΑ</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="π.χ. ΩΔΨΚ4653Π6-ΓΞΤ"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.fek.year`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>ΦΕΚ Έτος</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Επιλέξτε έτος" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) => {
                                                const year = new Date().getFullYear() - i;
                                                return (
                                                  <SelectItem key={year} value={year.toString()}>
                                                    {year}
                                                  </SelectItem>
                                                );
                                              })}
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.fek.issue`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>ΦΕΚ Τεύχος</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Επιλέξτε τεύχος" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="Α">Α</SelectItem>
                                              <SelectItem value="Β">Β</SelectItem>
                                              <SelectItem value="Γ">Γ</SelectItem>
                                              <SelectItem value="Δ">Δ</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.fek.number`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>ΦΕΚ Αριθμός</FormLabel>
                                          <FormControl>
                                            <Input {...field} placeholder="π.χ. 1234" />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.decision_budget`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Προϋπολογισμός Απόφασης</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="π.χ. 1.000.000,00"
                                              onChange={(e) => {
                                                const formatted =
                                                  formatNumberWhileTyping(
                                                    e.target.value,
                                                  );
                                                field.onChange(formatted);
                                              }}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.expenses_covered`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Δαπάνες που καλύπτει</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="π.χ. 500.000,00"
                                              onChange={(e) => {
                                                const formatted =
                                                  formatNumberWhileTyping(
                                                    e.target.value,
                                                  );
                                                field.onChange(formatted);
                                              }}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.decision_type`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Τύπος Απόφασης</FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Επιλέξτε τύπο" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="Έγκριση">
                                                Έγκριση
                                              </SelectItem>
                                              <SelectItem value="Τροποποίηση">
                                                Τροποποίηση
                                              </SelectItem>
                                              <SelectItem value="Παράταση">
                                                Παράταση
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`decisions.${index}.included`}
                                      render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                            <FormLabel>
                                              Συμπεριλαμβάνεται στο έργο
                                            </FormLabel>
                                          </div>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  {/* Implementing Agency Multi-select */}
                                  <div>
                                    <FormLabel>Υλοποιούσες Μονάδες</FormLabel>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                      {typedUnitsData?.map((unit) => (
                                        <FormField
                                          key={unit.id}
                                          control={form.control}
                                          name={`decisions.${index}.implementing_agency`}
                                          render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(
                                                    unit.id,
                                                  )}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) {
                                                      field.onChange([
                                                        ...(field.value || []),
                                                        unit.id,
                                                      ]);
                                                    } else {
                                                      field.onChange(
                                                        (field.value || []).filter(
                                                          (item: number) =>
                                                            item !== unit.id,
                                                        ),
                                                      );
                                                    }
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="text-sm font-normal">
                                                {unit.unit_name?.name ||
                                                  unit.name ||
                                                  unit.unit}
                                              </FormLabel>
                                            </FormItem>
                                          )}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  {/* Expenditure Type Multi-select */}
                                  <div>
                                    <FormLabel>Τύποι Δαπανών</FormLabel>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                      {typedExpenditureTypesData?.map(
                                        (expenditureType) => (
                                          <FormField
                                            key={expenditureType.id}
                                            control={form.control}
                                            name={`decisions.${index}.expenditure_type`}
                                            render={({ field }) => (
                                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                  <Checkbox
                                                    checked={field.value?.includes(
                                                      expenditureType.id,
                                                    )}
                                                    onCheckedChange={(checked) => {
                                                      if (checked) {
                                                        field.onChange([
                                                          ...(field.value || []),
                                                          expenditureType.id,
                                                        ]);
                                                      } else {
                                                        field.onChange(
                                                          (field.value || []).filter(
                                                            (item: number) =>
                                                              item !==
                                                              expenditureType.id,
                                                          ),
                                                        );
                                                      }
                                                    }}
                                                  />
                                                </FormControl>
                                                <FormLabel className="text-sm font-normal">
                                                  {expenditureType.expenditure_types ||
                                                    expenditureType.name}
                                                </FormLabel>
                                              </FormItem>
                                            )}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name={`decisions.${index}.comments`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Σχόλια</FormLabel>
                                        <FormControl>
                                          <Textarea
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                            placeholder="Προαιρετικά σχόλια..."
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const decisions = form.getValues("decisions");
                          decisions.push({
                            protocol_number: "",
                            fek: { year: "", issue: "", number: "" },
                            ada: "",
                            implementing_agency: [],
                            decision_budget: "",
                            expenses_covered: "",
                            expenditure_type: [],
                            decision_type: "Έγκριση",
                            included: true,
                            comments: "",
                          });
                          form.setValue("decisions", decisions);
                        }}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Απόφασης
                      </Button>
                    </div>
                  </CardContent>
                </Card>
</TabsContent>
  );
}

// ───────────────────────────────────────────────────────────
// Event & Location Tab
// ───────────────────────────────────────────────────────────
export function EventLocationTab(props: {
  form: UseFormReturn<ComprehensiveFormData>;
  eventTypes: EventTypeData[] | undefined;
  units: UnitData[] | undefined;
}) {
  return (
    <TabsContent value="event-location">
<div className="space-y-6">
                  {/* Event Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Στοιχεία Γεγονότος</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="event_details.event_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Όνομα Γεγονότος</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε γεγονός" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {typedEventTypesData?.map((eventType) => (
                                    <SelectItem
                                      key={eventType.id}
                                      value={eventType.name}
                                    >
                                      {eventType.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="event_details.event_year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Έτος Γεγονότος</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="π.χ. 2024" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Location Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Στοιχεία Τοποθεσίας</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Batch Operations Toolbar */}
                        {form.watch("location_details").length > 0 && (
                          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={selectedLocations.size === form.watch("location_details").length 
                                ? handleDeselectAllLocations 
                                : handleSelectAllLocations}
                              data-testid="button-toggle-select-all-locations"
                            >
                              {selectedLocations.size === form.watch("location_details").length ? (
                                <>
                                  <Square className="h-4 w-4 mr-2" />
                                  Αποεπιλογή Όλων
                                </>
                              ) : (
                                <>
                                  <CheckSquare className="h-4 w-4 mr-2" />
                                  Επιλογή Όλων
                                </>
                              )}
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleDuplicateSelectedLocations}
                              disabled={selectedLocations.size === 0}
                              data-testid="button-duplicate-selected-locations"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Αντιγραφή Επιλεγμένων ({selectedLocations.size})
                            </Button>
                            
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteSelectedLocations}
                              disabled={selectedLocations.size === 0 || form.watch("location_details").length <= 1}
                              data-testid="button-delete-selected-locations"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Διαγραφή Επιλεγμένων ({selectedLocations.size})
                            </Button>
                            
                            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
                              {selectedLocations.size} / {form.watch("location_details").length} επιλεγμένα
                            </div>
                          </div>
                        )}

                        {/* Location Accordions */}
                        <Accordion type="multiple" className="w-full space-y-3">
                          {form.watch("location_details").map((location, locationIndex) => {
                            const geoAreasCount = location.geographic_areas?.length || 0;
                            const expenditureTypesCount = location.expenditure_types?.length || 0;
                            const isSelected = selectedLocations.has(locationIndex);
                            
                            return (
                              <AccordionItem 
                                key={locationIndex} 
                                value={`location-${locationIndex}`}
                                className={`border-l-4 border-l-teal-500 ${isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''}`}
                                data-testid={`accordion-location-${locationIndex}`}
                              >
                                <div className="flex items-center gap-3 pr-4">
                                  {/* Checkbox for batch selection */}
                                  <div 
                                    className="pl-4 py-4"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`checkbox-location-${locationIndex}`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleLocationSelection(locationIndex)}
                                    />
                                  </div>
                                  
                                  <AccordionTrigger className="flex-1 hover:no-underline py-4">
                                    {/* Rich Preview Card */}
                                    <div className="flex items-center gap-4 w-full pr-4">
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant="outline" 
                                          className="bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900 dark:text-teal-300 font-bold"
                                        >
                                          #{locationIndex + 1}
                                        </Badge>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                          Τοποθεσία {locationIndex + 1}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                        {location.implementing_agency && (
                                          <div className="flex items-center gap-1">
                                            <Building2 className="h-4 w-4" />
                                            <span className="truncate max-w-[200px]">{location.implementing_agency}</span>
                                          </div>
                                        )}
                                        
                                        {location.event_type && (
                                          <div className="flex items-center gap-1">
                                            <span className="truncate max-w-[150px]">{location.event_type}</span>
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2 ml-auto">
                                          {geoAreasCount > 0 && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                                              {geoAreasCount} Γεωγρ. Περιοχές
                                            </Badge>
                                          )}
                                          {expenditureTypesCount > 0 && (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                                              {expenditureTypesCount} Δαπάνες
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  
                                  {/* Individual delete button */}
                                  {form.watch("location_details").length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const locations = form.getValues("location_details");
                                        locations.splice(locationIndex, 1);
                                        form.setValue("location_details", locations);
                                        // Update selection state
                                        setSelectedLocations(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(locationIndex);
                                          return newSet;
                                        });
                                        toast({
                                          title: "Επιτυχία",
                                          description: "Η τοποθεσία διαγράφηκε"
                                        });
                                      }}
                                      data-testid={`button-delete-location-${locationIndex}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>
                                
                                <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name={`location_details.${locationIndex}.implementing_agency`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Υλοποιούσα Μονάδα</FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger data-testid={`select-implementing-agency-${locationIndex}`}>
                                                <SelectValue placeholder="Επιλέξτε μονάδα" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {typedUnitsData?.map((unit) => (
                                                <SelectItem
                                                  key={unit.id}
                                                  value={
                                                    unit.unit_name?.name ||
                                                    unit.name ||
                                                    unit.unit ||
                                                    ""
                                                  }
                                                >
                                                  {unit.unit_name?.name ||
                                                    unit.name ||
                                                    unit.unit}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`location_details.${locationIndex}.event_type`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Τύπος Γεγονότος</FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger data-testid={`select-event-type-${locationIndex}`}>
                                                <SelectValue placeholder="Επιλέξτε τύπο" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {typedEventTypesData?.map(
                                                (eventType) => (
                                                  <SelectItem
                                                    key={eventType.id}
                                                    value={eventType.name}
                                                  >
                                                    {eventType.name}
                                                  </SelectItem>
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  {/* Expenditure Types */}
                                  <div>
                                    <FormLabel>Τύποι Δαπανών</FormLabel>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                      {typedExpenditureTypesData?.map(
                                        (expenditureType) => (
                                          <FormField
                                            key={expenditureType.id}
                                            control={form.control}
                                            name={`location_details.${locationIndex}.expenditure_types`}
                                            render={({ field }) => (
                                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                  <Checkbox
                                                    checked={field.value?.includes(
                                                      expenditureType.expenditure_types ||
                                                        expenditureType.name ||
                                                        "",
                                                    )}
                                                    onCheckedChange={(checked) => {
                                                      const expenditureName =
                                                        expenditureType.expenditure_types ||
                                                        expenditureType.name ||
                                                        "";
                                                      if (checked) {
                                                        field.onChange([
                                                          ...(field.value || []),
                                                          expenditureName,
                                                        ]);
                                                      } else {
                                                        field.onChange(
                                                          (
                                                            field.value || []
                                                          ).filter(
                                                            (item: string) =>
                                                              item !==
                                                              expenditureName,
                                                          ),
                                                        );
                                                      }
                                                    }}
                                                    data-testid={`checkbox-expenditure-${locationIndex}-${expenditureType.id}`}
                                                  />
                                                </FormControl>
                                                <FormLabel className="text-sm font-normal">
                                                  {expenditureType.expenditure_types ||
                                                    expenditureType.name}
                                                </FormLabel>
                                              </FormItem>
                                            )}
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>

                                  {/* Geographic Areas */}
                                  <div className="space-y-4">
                                    <FormField
                                      control={form.control}
                                      name={`location_details.${locationIndex}.geographic_areas`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Γεωγραφικές Περιοχές</FormLabel>
                                          <SmartGeographicMultiSelect
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            kallikratisData={kallikratisData}
                                            placeholder="Επιλέξτε γεωγραφικές περιοχές..."
                                          />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const locations =
                              form.getValues("location_details");
                            locations.push({
                              implementing_agency: "",
                              event_type: "",
                              expenditure_types: [],
                              geographic_areas: [],
                            });
                            form.setValue("location_details", locations);
                          }}
                          data-testid="button-add-location"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Προσθήκη Τοποθεσίας
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
</TabsContent>
  );
}

// ───────────────────────────────────────────────────────────
// Project Details Tab
// ───────────────────────────────────────────────────────────
export function ProjectDetailsTab(props: {
  form: UseFormReturn<ComprehensiveFormData>;
  existingSATypes: string[];
  getValidationState: (key: string) => { isChecking: boolean; exists: boolean; existingProject?: { id: number; mis: number; project_title: string } };
}) {
  return (
    <TabsContent value="project">
<Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Στοιχεία Έργου
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="project_details.mis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MIS</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="π.χ. 5222801" />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="project_details.sa"
                          render={({ field }) => {
                            const fieldKey = 'project_details.sa';
                            const validationState = getValidationState(fieldKey);
                            
                            return (
                              <FormItem>
                                <FormLabel>ΣΑ</FormLabel>
                                <Select
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    // Auto-populate enumeration code based on selected ΣΑ using existing data
                                    const currentEnumerationCode = form.getValues(
                                      "project_details.enumeration_code",
                                    );
                                    const newEnumerationCode =
                                      generateEnumerationCode(
                                        value,
                                        currentEnumerationCode,
                                        existingEnumerationCodes,
                                      );
                                    form.setValue(
                                      "project_details.enumeration_code",
                                      newEnumerationCode,
                                    );
                                    
                                    // Disabled validation on change to prevent log spam
                                    // TODO: Re-enable with better controls
                                    // validateSA(value, fieldKey, mis);
                                  }}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="input-sa">
                                      <SelectValue placeholder="Επιλέξτε ΣΑ" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {existingSATypes.length > 0 ? (
                                      existingSATypes.map((saType) => (
                                        <SelectItem key={saType} value={saType}>
                                          {saType}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <>
                                        <SelectItem value="ΝΑ853">ΝΑ853</SelectItem>
                                        <SelectItem value="ΝΑ271">ΝΑ271</SelectItem>
                                        <SelectItem value="E069">E069</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                                
                                {/* Validation feedback */}
                                {validationState.isChecking && (
                                  <p className="text-sm text-blue-600 flex items-center gap-1" data-testid="status-sa">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Έλεγχος ΣΑ...
                                  </p>
                                )}
                                {validationState.exists && validationState.existingProject && (
                                  <p className="text-sm text-red-600 flex items-center gap-1" data-testid="text-sa-conflict">
                                    <X className="h-3 w-3" />
                                    ΣΑ υπάρχει ήδη στο έργο: {validationState.existingProject.project_title} (MIS: {validationState.existingProject.mis})
                                  </p>
                                )}
                                {!validationState.isChecking && !validationState.exists && field.value?.trim() && (
                                  <p className="text-sm text-green-600 flex items-center gap-1" data-testid="text-sa-ok">
                                    <CheckCircle className="h-3 w-3" />
                                    ΣΑ διαθέσιμο
                                  </p>
                                )}
                              </FormItem>
                            );
                          }}
                        />

                        <FormField
                          control={form.control}
                          name="project_details.inc_year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Έτος Ένταξης</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="π.χ. 2024" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="project_details.project_status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Κατάσταση Έργου</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Επιλέξτε κατάσταση" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Ενεργό">Ενεργό</SelectItem>
                                  <SelectItem value="Αναμονή">
                                    Αναμονή
                                  </SelectItem>
                                  <SelectItem value="Ολοκληρωμένο">
                                    Ολοκληρωμένο
                                  </SelectItem>
                                  <SelectItem value="Ακυρωμένο">
                                    Ακυρωμένο
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="project_details.project_title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Τίτλος Έργου</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Εισάγετε τον τίτλο του έργου..."
                                rows={6}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.project_description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Περιγραφή Έργου</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Εισάγετε αναλυτική περιγραφή του έργου..."
                                rows={2}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.summary_description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Συνοπτική Περιγραφή</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Εισάγετε συνοπτική περιγραφή..."
                                rows={2}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="project_details.expenses_executed"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Εκτελεσθείσες Δαπάνες</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="π.χ. 500.000,00"
                                onChange={(e) => {
                                  const formatted = formatNumberWhileTyping(
                                    e.target.value,
                                  );
                                  field.onChange(formatted);
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
</TabsContent>
  );
}

// ───────────────────────────────────────────────────────────
// Formulation Tab
// ───────────────────────────────────────────────────────────
export function FormulationTab(props: {
  form: UseFormReturn<ComprehensiveFormData>;
  existingSATypes: string[];
  existingEnumerationCodes: Record<string, string>;
}) {
  return (
    <TabsContent value="formulation">
<Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Στοιχεία Διατύπωσης Έργου
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Batch Operations Toolbar */}
                      {form.watch("formulation_details").length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={selectedFormulations.size === form.watch("formulation_details").length 
                              ? handleDeselectAllFormulations 
                              : handleSelectAllFormulations}
                            data-testid="button-toggle-select-all-formulations"
                          >
                            {selectedFormulations.size === form.watch("formulation_details").length ? (
                              <>
                                <Square className="h-4 w-4 mr-2" />
                                Αποεπιλογή Όλων
                              </>
                            ) : (
                              <>
                                <CheckSquare className="h-4 w-4 mr-2" />
                                Επιλογή Όλων
                              </>
                            )}
                          </Button>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDuplicateSelectedFormulations}
                            disabled={selectedFormulations.size === 0}
                            data-testid="button-duplicate-selected-formulations"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Αντιγραφή Επιλεγμένων ({selectedFormulations.size})
                          </Button>
                          
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelectedFormulations}
                            disabled={selectedFormulations.size === 0 || form.watch("formulation_details").length <= 1}
                            data-testid="button-delete-selected-formulations"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Διαγραφή Επιλεγμένων ({selectedFormulations.size})
                          </Button>
                          
                          <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
                            {selectedFormulations.size} / {form.watch("formulation_details").length} επιλεγμένα
                          </div>
                        </div>
                      )}

                      {/* Formulation Accordions */}
                      <Accordion type="multiple" className="w-full space-y-3">
                        {form.watch("formulation_details").map((formulation, index) => {
                          const pdeCount = formulation.budget_versions?.pde?.length || 0;
                          const epaCount = formulation.budget_versions?.epa?.length || 0;
                          const saColor = getSAColor(formulation.sa);
                          const borderColor = getSABorderColor(formulation.sa);
                          const isSelected = selectedFormulations.has(index);
                          
                          return (
                            <AccordionItem 
                              key={index} 
                              value={`formulation-${index}`}
                              className={`border-l-4 ${borderColor} ${isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''}`}
                              data-testid={`accordion-formulation-${index}`}
                            >
                              <div className="flex items-center gap-3 pr-4">
                                {/* Checkbox for batch selection */}
                                <div 
                                  className="pl-4 py-4"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`checkbox-formulation-${index}`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleFormulationSelection(index)}
                                  />
                                </div>
                                
                                <AccordionTrigger className="flex-1 hover:no-underline py-4">
                                  {/* Rich Preview Card */}
                                  <div className="flex items-center gap-4 w-full pr-4">
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant="outline" 
                                        className={`
                                          ${saColor === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300' : ''}
                                          ${saColor === 'purple' ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300' : ''}
                                          ${saColor === 'green' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300' : ''}
                                          font-bold
                                        `}
                                      >
                                        {formulation.sa}
                                      </Badge>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">
                                        Διατύπωση {index + 1}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        <span>{formulation.enumeration_code || "Χωρίς κωδικό"}</span>
                                      </div>
                                      
                                      {formulation.decision_year && (
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-4 w-4" />
                                          <span>{formulation.decision_year}</span>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-2 ml-auto">
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                                          {pdeCount} ΠΔΕ
                                        </Badge>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                                          {epaCount} ΕΠΑ
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                
                                {/* Individual delete button */}
                                {form.watch("formulation_details").length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const formulations = form.getValues("formulation_details");
                                      formulations.splice(index, 1);
                                      form.setValue("formulation_details", formulations);
                                      
                                      // Update selected indices
                                      setSelectedFormulations(prev => {
                                        const newSet = new Set<number>();
                                        prev.forEach(i => {
                                          if (i < index) newSet.add(i);
                                          else if (i > index) newSet.add(i - 1);
                                        });
                                        return newSet;
                                      });
                                      
                                      toast({
                                        title: "Επιτυχία",
                                        description: "Η διατύπωση διαγράφηκε"
                                      });
                                    }}
                                    data-testid={`button-delete-formulation-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <AccordionContent className="px-4 pb-4 pt-2">
                                {/* All existing formulation fields */}
                                <div className="space-y-4">

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.sa`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ΣΑ</FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Auto-populate enumeration code based on selected ΣΑ using existing data
                                      const currentEnumerationCode =
                                        form.getValues(
                                          `formulation_details.${index}.enumeration_code`,
                                        );
                                      const newEnumerationCode =
                                        generateEnumerationCode(
                                          value,
                                          currentEnumerationCode,
                                          existingEnumerationCodes,
                                        );
                                      form.setValue(
                                        `formulation_details.${index}.enumeration_code`,
                                        newEnumerationCode,
                                      );
                                    }}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε ΣΑ" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {existingSATypes.length > 0 ? (
                                        existingSATypes.map((saType) => (
                                          <SelectItem key={saType} value={saType}>
                                            {saType}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <>
                                          <SelectItem value="ΝΑ853">
                                            ΝΑ853
                                          </SelectItem>
                                          <SelectItem value="ΝΑ271">
                                            ΝΑ271
                                          </SelectItem>
                                          <SelectItem value="E069">E069</SelectItem>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.enumeration_code`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Κωδικός Απαρίθμησης</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="π.χ. 2023ΕΠ00100001"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`formulation_details.${index}.decision_year`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Έτος Απόφασης</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="π.χ. 2024" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>


                          {/* Budget Versions Tabs - ΠΔΕ and ΕΠΑ */}
                          <div className="mt-6">
                            <Tabs defaultValue="pde" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pde" className="flex items-center gap-2">
                                  <span>ΠΔΕ</span>
                                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                                    {form.watch(`formulation_details.${index}.budget_versions.pde`)?.length || 0}
                                  </span>
                                </TabsTrigger>
                                <TabsTrigger value="epa" className="flex items-center gap-2">
                                  <span>ΕΠΑ</span>
                                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">
                                    {form.watch(`formulation_details.${index}.budget_versions.epa`)?.length || 0}
                                  </span>
                                </TabsTrigger>
                              </TabsList>

                              {/* ΠΔΕ Tab */}
                              <TabsContent value="pde">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                      <span>Εκδόσεις ΠΔΕ</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const formulations = form.getValues("formulation_details");
                                          const existingPdeVersions = formulations[index].budget_versions.pde;
                                          const nextVersionNumber = existingPdeVersions.length > 0 
                                            ? (Math.max(...existingPdeVersions.map(v => parseFloat(v.version_number || "1.0"))) + 0.1).toFixed(1)
                                            : "1.0";
                                          formulations[index].budget_versions.pde.push({
                                            version_number: nextVersionNumber,
                                            boundary_budget: "",
                                            protocol_number: "",
                                            ada: "",
                                            decision_date: "",
                                            action_type: "Έγκριση",
                                            comments: ""
                                          });
                                          form.setValue("formulation_details", formulations);
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Προσθήκη Έκδοσης ΠΔΕ
                                      </Button>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {form.watch(`formulation_details.${index}.budget_versions.pde`)?.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">
                                        <p>Δεν υπάρχουν εκδόσεις ΠΔΕ</p>
                                        <p className="text-sm">Κάντε κλικ στο κουμπί "Προσθήκη Έκδοσης ΠΔΕ" για να προσθέσετε την πρώτη έκδοση</p>
                                      </div>
                                    ) : (
                                      <Accordion type="multiple" className="w-full">
                                        {form.watch(`formulation_details.${index}.budget_versions.pde`)
                                          ?.sort((a, b) => parseFloat(a.version_number || "1.0") - parseFloat(b.version_number || "1.0"))
                                          ?.map((versionData, pdeIndex) => {
                                            const originalIndex = form.watch(`formulation_details.${index}.budget_versions.pde`).findIndex(
                                              v => v === versionData
                                            );
                                            const isActiveVersion = form.watch(`formulation_details.${index}.budget_versions.pde`)
                                              ?.reduce((max, current) => 
                                                parseFloat(current.version_number || "1.0") > parseFloat(max.version_number || "1.0") 
                                                  ? current : max, versionData
                                              ) === versionData;
                                            return (
                                          <AccordionItem key={originalIndex} value={`pde-${originalIndex}`}>
                                            <div className="flex items-center justify-between pr-4">
                                              <AccordionTrigger className="flex-1 hover:no-underline">
                                                <div className="flex items-center gap-2">
                                                  <h5 className="font-medium">ΠΔΕ v{versionData.version_number || "1.0"}</h5>
                                                  {isActiveVersion && (
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                                      ΕΝΕΡΓΟ
                                                    </span>
                                                  )}
                                                </div>
                                              </AccordionTrigger>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const formulations = form.getValues("formulation_details");
                                                  formulations[index].budget_versions.pde.splice(originalIndex, 1);
                                                  form.setValue("formulation_details", formulations);
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <AccordionContent className="pt-4">
                                            
                                            {/* Version Information */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.version_number`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Αριθμός Έκδοσης</FormLabel>
                                                    <FormControl>
                                                      <Input 
                                                        {...field} 
                                                        placeholder="π.χ. 1.0, 1.1, 2.0" 
                                                        pattern="[0-9]+\.[0-9]+"
                                                        title="Εισάγετε έκδοση π.χ. 1.0, 1.1, 2.0"
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.decision_date`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Ημερομηνία Απόφασης</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} type="date" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.protocol_number`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 12345/2024" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.ada`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>ΑΔΑ</FormLabel>
                                                    <FormControl>
                                                      <Input {...field} placeholder="π.χ. 6ΔΛ5465ΦΘΞ-ΨΩΣ" />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.action_type`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Είδος Πράξης</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                      <FormControl>
                                                        <SelectTrigger>
                                                          <SelectValue placeholder="Επιλέξτε είδος πράξης" />
                                                        </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                        <SelectItem value="Έγκριση">Έγκριση</SelectItem>
                                                        <SelectItem value="Τροποποίηση">Τροποποίηση</SelectItem>
                                                        <SelectItem value="Κλείσιμο στο ύψος πληρωμών">Κλείσιμο στο ύψος πληρωμών</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </FormItem>
                                                )}
                                              />
                                              <FormField
                                                control={form.control}
                                                name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.boundary_budget`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Προϋπολογισμός Οριοθέτησης (€)</FormLabel>
                                                    <FormControl>
                                                      <Input 
                                                        {...field}
                                                        onChange={(e) => {
                                                          const formatted = formatNumberWhileTyping(e.target.value);
                                                          field.onChange(formatted);
                                                        }}
                                                        placeholder="π.χ. 1.500.000,00" 
                                                      />
                                                    </FormControl>
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                            
                                            {/* Connected Decisions - Removed from schema but keeping UI commented for reference */}
                                            {/* <FormField
                                              control={form.control}
                                              name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.connected_decisions`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel>Συνδεδεμένες Αποφάσεις</FormLabel>
                                                  <FormControl>
                                                    <Select
                                                      onValueChange={(value) => {
                                                        const decisionId = parseInt(value);
                                                        // 🚀 Auto-inheritance logic για PDE
                                                        handleConnectedDecisionChange(index, 'pde', pdeIndex, decisionId, true);
                                                      }}
                                                    >
                                                      <SelectTrigger>
                                                        <SelectValue placeholder="Επιλέξτε αποφάσεις..." />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {form.watch("decisions")?.map((decision, decIndex) => (
                                                          <SelectItem key={decIndex} value={decIndex.toString()}>
                                                            {decision.protocol_number || `Απόφαση ${decIndex + 1}`}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </FormControl>
                                                  {field.value && field.value.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                      {field.value.map((decisionId: number) => {
                                                        const decision = form.watch("decisions")?.[decisionId];
                                                        const { isInherited, inheritedFromVersion } = getDecisionOrigin(index, 'pde', pdeIndex, decisionId);
                                                        
                                                        return (
                                                          <span
                                                            key={decisionId}
                                                            className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                                                              isInherited 
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                                                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                                                            }`}
                                                            title={isInherited ? `Κληρονομήθηκε από έκδοση ${inheritedFromVersion! + 1}` : 'Άμεσα προστεθειμένη απόφαση'}
                                                          >
                                                            {isInherited && <span className="mr-1">🔗</span>}
                                                            {decision?.protocol_number || `Απόφαση ${decisionId + 1}`}
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                // 🗑️ PDE Removal με dedicated function
                                                                handleConnectedDecisionRemoval(index, 'pde', originalIndex, decisionId);
                                                              }}
                                                              className={isInherited ? 'hover:text-orange-600' : 'hover:text-blue-600'}
                                                            >
                                                              ×
                                                            </button>
                                                          </span>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </FormItem>
                                              )}
                                            /> */}
                                            
                                            <FormField
                                              control={form.control}
                                              name={`formulation_details.${index}.budget_versions.pde.${originalIndex}.comments`}
                                              render={({ field }) => (
                                                <FormItem>
                                                  <FormLabel>Σχόλια</FormLabel>
                                                  <FormControl>
                                                    <Textarea value={field.value || ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} placeholder="Εισάγετε σχόλια..." rows={2} />
                                                  </FormControl>
                                                </FormItem>
                                              )}
                                            />
                                            </AccordionContent>
                                          </AccordionItem>
                                          );
                                        })}
                                      </Accordion>
                                    )}
                                  </CardContent>
                                </Card>
</TabsContent>
  );
}

// ───────────────────────────────────────────────────────────
// Subprojects Tab
// ───────────────────────────────────────────────────────────
export function SubprojectsTab(props: {
  projectId: number;
  form: UseFormReturn<ComprehensiveFormData>;
}) {
  return (
    <TabsContent value="subprojects">
<SubprojectsIntegrationCard
                  projectId={completeProjectData?.id || 0}
                  formulationDetails={form.watch("formulation_details") || []}
                  onFormulationChange={(financials) => {
                    // Handle formulation financial changes if needed
                    console.log("[Subprojects] Formulation change:", financials);
                  }}
                  isEditing={true}
                />
</TabsContent>
  );
}

// ───────────────────────────────────────────────────────────
// Changes Tab
// ───────────────────────────────────────────────────────────
export function ChangesTab(props: {
  form: UseFormReturn<ComprehensiveFormData>;
}) {
  return (
    <TabsContent value="changes">
<Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Αλλαγές που Πραγματοποιήθηκαν
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {form.watch("changes").map((_, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-medium text-blue-900">
                              Αλλαγή {index + 1}
                            </h4>
                            {form.watch("changes").length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const changes = form.getValues("changes");
                                  changes.splice(index, 1);
                                  form.setValue("changes", changes);
                                }}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.timestamp`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Χρονική Στιγμή</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="YYYY-MM-DD HH:MM:SS"
                                      value={
                                        field.value ||
                                        new Date().toISOString().slice(0, 16)
                                      }
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`changes.${index}.user_name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Χρήστης</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Όνομα χρήστη που έκανε την αλλαγή"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="mb-4">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.change_type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Τύπος Αλλαγής</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε τύπο αλλαγής" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Initial Creation">
                                        Αρχική Δημιουργία
                                      </SelectItem>
                                      <SelectItem value="Budget Update">
                                        Ενημέρωση Προϋπολογισμού
                                      </SelectItem>
                                      <SelectItem value="Status Change">
                                        Αλλαγή Κατάστασης
                                      </SelectItem>
                                      <SelectItem value="Document Update">
                                        Ενημέρωση Εγγράφων
                                      </SelectItem>
                                      <SelectItem value="Other">Άλλο</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="mb-4">
                            <FormField
                              control={form.control}
                              name={`changes.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Περιγραφή Αλλαγής</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      onBlur={field.onBlur}
                                      name={field.name}
                                      ref={field.ref}
                                      placeholder="Περιγράψτε την αλλαγή που πραγματοποιήθηκε..."
                                      rows={3}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`changes.${index}.notes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Επιπλέον Σημειώσεις</FormLabel>
                                <FormControl>
                                  <Textarea
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    placeholder="Προαιρετικές σημειώσεις ή παρατηρήσεις..."
                                    rows={2}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const changes = form.getValues("changes");
                          changes.push({
                            timestamp: new Date().toISOString().slice(0, 16),
                            user_name: "",
                            change_type: "Other",
                            description: "",
                            notes: "",
                          });
                          form.setValue("changes", changes);
                        }}
                        className="w-full md:w-auto"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Προσθήκη Αλλαγής
                      </Button>
                    </div>
                  </CardContent>
                </Card>
</TabsContent>
  );
}
