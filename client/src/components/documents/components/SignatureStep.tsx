import * as React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

interface SignatureStepProps {
  form: UseFormReturn<any>;
  availableDirectors: any[];
  availableDepartmentManagers: any[];
}

export function SignatureStep({
  form,
  availableDirectors,
  availableDepartmentManagers,
}: SignatureStepProps) {
  const hasSignatures =
    availableDirectors.length > 0 || availableDepartmentManagers.length > 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Clear section header */}
      <div className="pb-3 border-b">
        <h2 className="text-lg font-semibold">Υπογραφή</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Επιλέξτε τον υπογράφοντα του διαβιβαστικού (προαιρετικό)
        </p>
      </div>

      {!hasSignatures && form.watch("unit") && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Δεν υπάρχουν διαθέσιμοι υπογράφοντες</p>
            <p className="text-sm text-muted-foreground mt-1">
              Η επιλεγμένη μονάδα δεν έχει προσωπικό υπογραφής στη βάση
              δεδομένων. Μονάδες με διαθέσιμους υπογράφοντες: ΔΑΕΦΚ-ΚΕ,
              ΔΑΕΦΚ-ΑΚ, ΔΑΕΦΚ-ΔΕ.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <FormField
        control={form.control}
        name="director_signature"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base">
              Υπογράφων{" "}
              <span className="text-muted-foreground text-sm font-normal">
                (προαιρετικό)
              </span>
            </FormLabel>
            <Select
              value={field.value ? JSON.stringify(field.value) : undefined}
              onValueChange={(value) => {
                if (value && value !== "no-signature") {
                  field.onChange(JSON.parse(value));
                } else {
                  field.onChange(null);
                }
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε υπογράφοντα" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {/* Directors */}
                {availableDirectors.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Διευθυντές
                    </div>
                    {availableDirectors.map((director: any) => (
                      <SelectItem
                        key={`director-${director.unit}`}
                        value={JSON.stringify({
                          ...director.director,
                          type: "director",
                          unit: director.unit,
                        })}
                      >
                        {director.director.name} - Διευθυντής ({director.unit})
                      </SelectItem>
                    ))}
                  </>
                )}

                {/* Department Managers */}
                {availableDepartmentManagers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Προϊστάμενοι Τμημάτων
                    </div>
                    {availableDepartmentManagers.map((manager: any) => (
                      <SelectItem
                        key={`manager-${manager.unit}-${manager.partKey}`}
                        value={JSON.stringify({
                          ...manager.manager,
                          type: "department_manager",
                          unit: manager.unit,
                          department: manager.department,
                        })}
                      >
                        {manager.manager.name} - {manager.department} (
                        {manager.unit})
                      </SelectItem>
                    ))}
                  </>
                )}

                {!hasSignatures && (
                  <SelectItem value="no-signature" disabled>
                    Δεν υπάρχουν διαθέσιμοι υπογράφοντες
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      {/* Info box */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p>
          <strong>Σημείωση:</strong> Η επιλογή υπογραφής είναι προαιρετική. Αν
          δεν επιλέξετε υπογράφοντα, το έγγραφο θα δημιουργηθεί χωρίς στοιχεία
          υπογραφής.
        </p>
      </div>
    </div>
  );
}
