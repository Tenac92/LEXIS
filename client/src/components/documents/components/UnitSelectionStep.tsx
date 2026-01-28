import * as React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";

interface UnitSelectionStepProps {
  form: UseFormReturn<any>;
  units: any[];
  unitsLoading: boolean;
  userUnitIds: string[];
  onUnitChange: (value: string) => void;
}

export function UnitSelectionStep({
  form,
  units,
  unitsLoading,
  userUnitIds,
  onUnitChange,
}: UnitSelectionStepProps) {
  const selectedUnit = form.watch("unit");

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Clear section header */}
      <div className="pb-3 border-b">
        <h2 className="text-lg font-semibold">Μονάδα Υπηρεσίας</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Η μονάδα που εκδίδει το έγγραφο
        </p>
      </div>

      <FormField
        control={form.control}
        name="unit"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base">
              Μονάδα <span className="text-destructive">*</span>
            </FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                onUnitChange(value);
              }}
              value={field.value}
              disabled={unitsLoading || (units && units.length <= 1)}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      units && units.length === 1
                        ? "Αυτόματη επιλογή μονάδας"
                        : "Επιλέξτε μονάδα"
                    }
                  >
                    {field.value && Array.isArray(units) && units.length > 0
                      ? units.find((u: any) => u.id === field.value)?.name ||
                        field.value
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Array.isArray(units) && units.length > 0 ? (
                  units.map((unit: any) => (
                    <SelectItem key={unit.id || unit.name} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-units" disabled>
                    Δεν βρέθηκαν μονάδες
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
            {field.value && (
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Επιλεγμένη:</strong>{" "}
                {Array.isArray(units) && units.length > 0
                  ? units.find((u: any) => u.id === field.value)?.name ||
                    field.value
                  : field.value}
              </p>
            )}
          </FormItem>
        )}
      />
    </div>
  );
}
