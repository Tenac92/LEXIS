import * as React from "react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronUp, User } from "lucide-react";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { SimpleAFMAutocomplete } from "@/components/ui/simple-afm-autocomplete";
import { BeneficiaryGeoSelector } from "./BeneficiaryGeoSelector";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";

interface RecipientCardProps {
  index: number;
  recipient: any;
  form: UseFormReturn<any>;
  isEktosEdrasType: boolean;
  onRemove: () => void;
  onRegiondetChange?: (index: number, data: any) => void;
  regiondetError?: string;
  regiondetSaveState?: { status: string; message?: string };
  onRegiondetRetry?: () => void;
  renderInstallmentSelector?: () => React.ReactNode;
  renderInstallmentAmounts?: () => React.ReactNode;
}

export function RecipientCard({
  index,
  recipient,
  form,
  isEktosEdrasType,
  onRemove,
  onRegiondetChange,
  regiondetError,
  regiondetSaveState,
  onRegiondetRetry,
  renderInstallmentSelector,
  renderInstallmentAmounts,
}: RecipientCardProps) {
  const [optionsExpanded, setOptionsExpanded] = useState(false);

  return (
    <Card className="p-4 relative">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            Δικαιούχος {index + 1}
          </span>
          {recipient.firstname && recipient.lastname && (
            <Badge variant="outline" className="text-xs">
              {recipient.firstname} {recipient.lastname}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Fields - Always Visible */}
      <div className="space-y-3">
        {/* Section: Στοιχεία Δικαιούχου */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Στοιχεία Δικαιούχου
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Όνομα */}
            <FormField
              control={form.control}
              name={`recipients.${index}.firstname`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Όνομα *"
                      autoComplete="off"
                      data-testid={`input-recipient-${index}-firstname`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Επώνυμο */}
            <FormField
              control={form.control}
              name={`recipients.${index}.lastname`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Επώνυμο *"
                      autoComplete="off"
                      data-testid={`input-recipient-${index}-lastname`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Πατρώνυμο */}
            <FormField
              control={form.control}
              name={`recipients.${index}.fathername`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Πατρώνυμο"
                      autoComplete="off"
                      data-testid={`input-recipient-${index}-fathername`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section: Οικονομικά Στοιχεία */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Οικονομικά Στοιχεία
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* ΑΦΜ με Autocomplete */}
            <FormField
              control={form.control}
              name={`recipients.${index}.afm`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <SimpleAFMAutocomplete
                      value={field.value}
                      onChange={(value: string) => {
                        field.onChange(value);
                      }}
                      placeholder="ΑΦΜ (9 ψηφία) *"
                      expenditureType=""
                      onSelectPerson={() => {}}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ποσό - Show only if not using installment amounts */}
            {!renderInstallmentAmounts && (
              <FormField
                control={form.control}
                name={`recipients.${index}.amount`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NumberInput
                        value={field.value}
                        onChange={(formatted, numeric) => field.onChange(numeric || 0)}
                        placeholder="Ποσό (€) *"
                        decimals={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        {/* Installment Selector & Amounts - Conditional */}
        {renderInstallmentSelector && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Κατανομή Πληρωμής
            </h4>
            {renderInstallmentSelector()}
            {renderInstallmentAmounts && (
              <div className="mt-2">
                {renderInstallmentAmounts()}
              </div>
            )}
          </div>
        )}

        {/* Geo Selector - Required for certain types */}
        {!isEktosEdrasType && onRegiondetChange && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Γεωγραφική Θέση
            </h4>
            <BeneficiaryGeoSelector
              regions={[]}
              regionalUnits={[]}
              municipalities={[]}
              value={recipient.regiondet || null}
              onChange={(data) => onRegiondetChange(index, data)}
              error={regiondetError}
              onRetry={onRegiondetRetry}
            />
          </div>
        )}

        {/* Collapsible Additional Options */}
        <Collapsible open={optionsExpanded} onOpenChange={setOptionsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs h-8"
            >
              {optionsExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Απόκρυψη Επιπλέον Πεδίων
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Επιπλέον Πεδία (προαιρετικά)
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {/* Secondary Text - Ελεύθερο Κείμενο */}
            {!isEktosEdrasType && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Επιπλέον Σχόλια / Πληροφορίες
                </label>
                <Input
                  {...form.register(`recipients.${index}.secondary_text`)}
                  placeholder="π.χ. Αριθμός Απόφασης, Παρατηρήσεις..."
                  autoComplete="off"
                />
              </div>
            )}

            {/* ΕΚΤΟΣ ΕΔΡΑΣ Specific Fields - if applicable */}
            {isEktosEdrasType && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground">
                  Πεδία για ΕΚΤΟΣ ΕΔΡΑΣ (συμπληρώνονται αυτόματα από το σύστημα)
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
