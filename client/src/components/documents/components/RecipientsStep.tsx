import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BudgetIndicator } from "@/components/ui/budget-indicator";
import { BudgetValidationAlert } from "./BudgetValidationAlert";
import { RecipientCard } from "./RecipientCard";
import type { UseFormReturn } from "react-hook-form";

interface RecipientsStepProps {
  form: UseFormReturn<any>;
  recipients: any[];
  budgetData: any;
  currentAmount: number;
  localBudgetValidation: any;
  selectedProjectId: string;
  isEktosEdrasType: boolean;
  loading: boolean;
  onAddRecipient: () => void;
  onRemoveRecipient: (index: number) => void;
  onRegiondetChange?: (index: number, data: any) => void;
  regiondetErrors?: Record<number, string>;
  regiondetSaveStates?: Record<string, { status: string; message?: string }>;
  renderInstallmentSelector?: (index: number) => React.ReactNode;
  renderInstallmentAmounts?: (index: number) => React.ReactNode;
}

export function RecipientsStep({
  form,
  recipients,
  budgetData,
  currentAmount,
  localBudgetValidation,
  selectedProjectId,
  isEktosEdrasType,
  loading,
  onAddRecipient,
  onRemoveRecipient,
  onRegiondetChange,
  regiondetErrors = {},
  regiondetSaveStates = {},
  renderInstallmentSelector,
  renderInstallmentAmounts,
}: RecipientsStepProps) {
  return (
    <div className="space-y-6">
      {/* Clear section header */}
      <div className="pb-3 border-b">
        <h2 className="text-lg font-semibold">Δικαιούχοι Πληρωμής</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Προσθέστε έως 10 δικαιούχους με τα στοιχεία τους
        </p>
      </div>

      {/* Compact Budget Overview */}
      <BudgetIndicator budgetData={budgetData} currentAmount={currentAmount} />

      {/* Budget Validation Alert - Consolidated */}
      <BudgetValidationAlert
        validation={localBudgetValidation}
        currentAmount={currentAmount}
        budgetData={budgetData}
        selectedProjectId={selectedProjectId}
      />

      {/* Recipients List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-medium">
              Λίστα Δικαιούχων{" "}
              <span className="text-muted-foreground text-sm">
                ({recipients.length}/10)
              </span>
            </h3>
            {recipients.length > 0 && currentAmount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Συνολικό ποσό:{" "}
                <strong className="text-foreground">
                  {currentAmount.toLocaleString("el-GR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </strong>
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={onAddRecipient}
            disabled={recipients.length >= 10 || loading}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Προσθήκη Δικαιούχου
          </Button>
        </div>

        {recipients.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
            <p className="text-muted-foreground">
              Δεν έχουν προστεθεί δικαιούχοι ακόμα
            </p>
            <Button
              type="button"
              onClick={onAddRecipient}
              variant="default"
              size="sm"
              className="mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Προσθήκη Πρώτου Δικαιούχου
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recipients.map((recipient, index) => (
              <RecipientCard
                key={index}
                index={index}
                recipient={recipient}
                form={form}
                isEktosEdrasType={isEktosEdrasType}
                onRemove={() => onRemoveRecipient(index)}
                onRegiondetChange={onRegiondetChange}
                regiondetError={regiondetErrors[index]}
                regiondetSaveState={regiondetSaveStates[String(recipient.id)]}
                renderInstallmentSelector={
                  renderInstallmentSelector
                    ? () => renderInstallmentSelector(index)
                    : undefined
                }
                renderInstallmentAmounts={
                  renderInstallmentAmounts
                    ? () => renderInstallmentAmounts(index)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Helpful tips */}
      {recipients.length > 0 && (
        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-3 rounded-md">
          <p className="font-medium text-blue-900 mb-1">💡 Συμβουλή:</p>
          <ul className="space-y-1 text-blue-800">
            <li>• Τα πεδία με <span className="text-destructive">*</span> είναι υποχρεωτικά</li>
            <li>• Το ΑΦΜ συμπληρώνει αυτόματα τα στοιχεία αν υπάρχουν στη βάση</li>
            <li>• Χρησιμοποιήστε "Επιπλέον Πεδία" για προαιρετικές πληροφορίες</li>
          </ul>
        </div>
      )}
    </div>
  );
}
