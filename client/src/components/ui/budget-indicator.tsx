
import { type BudgetData } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface BudgetIndicatorProps {
  budgetData: BudgetData;
  currentAmount?: number;
  onValidationWarning?: (type: 'funding' | 'reallocation') => void;
}

export function BudgetIndicator({ 
  budgetData, 
  currentAmount = 0,
  onValidationWarning 
}: BudgetIndicatorProps) {
  const { toast } = useToast();
  
  if (!budgetData) return null;

  const availableBudget = budgetData.user_view - currentAmount;
  const percentageUsed = (currentAmount / budgetData.user_view) * 100;
  const isExceeding20Percent = currentAmount > (budgetData.katanomes_etous * 0.2);
  const isExceedingEthsiaPistosi = currentAmount > budgetData.ethsia_pistosi;

  // Show warnings when thresholds are exceeded
  if (isExceedingEthsiaPistosi && onValidationWarning) {
    onValidationWarning('funding');
  } else if (isExceeding20Percent && onValidationWarning) {
    onValidationWarning('reallocation');
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-600">Available Budget</h3>
            <p className={`text-2xl font-bold ${availableBudget < 0 ? 'text-red-600' : 'text-blue-600'}`}>
              {availableBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <div className="mt-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${percentageUsed > 100 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-300`}
                  style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {percentageUsed.toFixed(1)}% used
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Total Budget</h3>
            <p className="text-2xl font-bold text-gray-700">
              {budgetData.total_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Annual Budget</h3>
            <p className="text-2xl font-bold text-gray-700">
              {budgetData.annual_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>
      </div>

      {isExceedingEthsiaPistosi && (
        <Alert variant="destructive">
          <AlertDescription>
            Το ποσό υπερβαίνει την ετήσια πίστωση. Απαιτείται χρηματοδότηση.
          </AlertDescription>
        </Alert>
      )}

      {isExceeding20Percent && !isExceedingEthsiaPistosi && (
        <Alert variant="warning">
          <AlertDescription>
            Το ποσό υπερβαίνει το 20% της ετήσιας κατανομής. Απαιτείται ανακατανομή.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
