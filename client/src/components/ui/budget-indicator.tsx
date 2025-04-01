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
  
  // Parse quarter-related values
  const quarterView = parseFloat(budgetData.quarter_view?.toString() || '0');
  const currentQuarter = budgetData.current_quarter || '';
  const q1 = parseFloat(budgetData.q1?.toString() || '0');
  const q2 = parseFloat(budgetData.q2?.toString() || '0');
  const q3 = parseFloat(budgetData.q3?.toString() || '0');
  const q4 = parseFloat(budgetData.q4?.toString() || '0');
  
  // Calculate annual budget (sum of all quarters except current one)
  let annualBudget = 0;
  if (currentQuarter === 'q1') {
    annualBudget = q2 + q3 + q4;
  } else if (currentQuarter === 'q2') {
    annualBudget = q1 + q3 + q4;
  } else if (currentQuarter === 'q3') {
    annualBudget = q1 + q2 + q4;
  } else if (currentQuarter === 'q4') {
    annualBudget = q1 + q2 + q3;
  } else {
    annualBudget = q1 + q2 + q3 + q4;
  }

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
            <h3 className="text-sm font-medium text-gray-600">Διαθέσιμος</h3>
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
            <h3 className="text-sm font-medium text-gray-600">Τρίμηνο {currentQuarter?.substring(1) || ''}</h3>
            <p className="text-2xl font-bold text-gray-700">
              {quarterView.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Προϋπολογισμός τρέχοντος τριμήνου
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Ετήσιος</h3>
            <p className="text-2xl font-bold text-gray-700">
              {annualBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Υπόλοιπα τρίμηνα: {currentQuarter ? 
                ['q1', 'q2', 'q3', 'q4']
                  .filter(q => q !== currentQuarter)
                  .map(q => q.substring(1))
                  .join(', ') : 
                '1, 2, 3, 4'}
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