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

  // Parse values ensuring they are numbers
  const userView = parseFloat(budgetData.user_view?.toString() || '0');
  const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
  const katanomesEtous = parseFloat(budgetData.katanomes_etous?.toString() || '0');
  const amount = parseFloat(currentAmount?.toString() || '0');

  const availableBudget = userView - amount;
  const percentageUsed = (amount / userView) * 100;
  const isExceeding20Percent = amount > (katanomesEtous * 0.2);
  const isExceedingEthsiaPistosi = amount > ethsiaPistosi;

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
            <h3 className="text-sm font-medium text-gray-600">Διαθέσιμος Προϋπολογισμός</h3>
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
                {percentageUsed.toFixed(1)}% χρησιμοποιήθηκε
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Ετήσιος Προϋπολογισμός</h3>
            <p className="text-2xl font-bold text-gray-700">
              {ethsiaPistosi.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Συνολικός Προϋπολογισμός</h3>
            <p className="text-2xl font-bold text-gray-700">
              {katanomesEtous.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
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
        <Alert>
          <AlertDescription>
            Το ποσό υπερβαίνει το 20% της ετήσιας κατανομής. Απαιτείται ανακατανομή.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}