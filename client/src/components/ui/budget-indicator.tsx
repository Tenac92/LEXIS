import { type BudgetData } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { BadgeInfo, Calculator, CalendarFold, PiggyBank } from "lucide-react";

interface BudgetIndicatorProps {
  budgetData: BudgetData;
  currentAmount?: number;
  onValidationWarning?: (type: 'funding' | 'reallocation') => void;
  compact?: boolean;
}

// Compact version of the budget indicator for project cards
export function CompactBudgetIndicator({ 
  budgetData,
  mis
}: { 
  budgetData: BudgetData | null;
  mis: string;
}) {
  // Debug output
  console.log("[CompactBudgetIndicator] Rendering with data:", budgetData);
  // If no budget data, show a message
  if (!budgetData) {
    return (
      <div className="mt-2 text-sm text-muted-foreground flex items-center">
        <BadgeInfo className="mr-2 h-4 w-4 text-blue-500" />
        <span>Δεν υπάρχουν δεδομένα κατανομών</span>
      </div>
    );
  }

  // Parse values ensuring they are numbers (handling both string and number inputs)
  const userView = typeof budgetData.user_view === 'number' 
    ? budgetData.user_view
    : parseFloat(budgetData.user_view?.toString() || '0');

  // The API response doesn't include katanomes_etous directly, but it's in the sum field
  const katanomesEtous = budgetData.katanomes_etous 
    ? (typeof budgetData.katanomes_etous === 'number' 
      ? budgetData.katanomes_etous 
      : parseFloat(budgetData.katanomes_etous.toString()))
    : (budgetData.sum?.katanomes_etous || 0);

  const ethsiaPistosi = typeof budgetData.ethsia_pistosi === 'number'
    ? budgetData.ethsia_pistosi
    : parseFloat(budgetData.ethsia_pistosi?.toString() || '0');
  
  // Parse new budget indicators
  const availableBudget = typeof budgetData.available_budget === 'number'
    ? budgetData.available_budget
    : parseFloat(budgetData.available_budget?.toString() || (katanomesEtous - userView).toString());
  
  const quarterAvailable = typeof budgetData.quarter_available === 'number'
    ? budgetData.quarter_available
    : parseFloat(budgetData.quarter_available?.toString() || '0');
  
  const yearlyAvailable = typeof budgetData.yearly_available === 'number'
    ? budgetData.yearly_available
    : parseFloat(budgetData.yearly_available?.toString() || (ethsiaPistosi - userView).toString());
  
  // Calculate percentage for progress bar
  const percentageUsed = katanomesEtous > 0 ? ((userView / katanomesEtous) * 100) : 0;
  
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center">
          <PiggyBank className="mr-1 h-4 w-4 text-blue-500" />
          <span className="text-muted-foreground">Διαθέσιμη Κατανομή:</span>
        </div>
        <span className="font-medium">{availableBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</span>
      </div>
      
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${percentageUsed > 80 ? 'bg-orange-500' : percentageUsed > 100 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-300`}
          style={{ width: `${Math.min(percentageUsed, 100)}%` }}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center">
            <CalendarFold className="mr-1 h-3 w-3" />
            Υπόλοιπο Τριμήνου:
          </span>
          <span className="font-medium">{quarterAvailable.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center">
            <Calculator className="mr-1 h-3 w-3" />
            Υπόλοιπο προς Πίστωση:
          </span>
          <span className="font-medium">{yearlyAvailable.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</span>
        </div>
      </div>
    </div>
  );
}

export function BudgetIndicator({ 
  budgetData, 
  currentAmount = 0,
  onValidationWarning 
}: BudgetIndicatorProps) {
  const { toast } = useToast();
  
  // Debug output for main budget indicator
  console.log("[BudgetIndicator] Rendering with data:", budgetData, "current amount:", currentAmount);

  if (!budgetData) return null;

  // Parse values ensuring they are numbers (handling both string and number inputs)
  const userView = typeof budgetData.user_view === 'number' 
    ? budgetData.user_view
    : parseFloat(budgetData.user_view?.toString() || '0');

  // The API response doesn't include katanomes_etous directly, but it's in the sum field
  const katanomesEtous = budgetData.katanomes_etous 
    ? (typeof budgetData.katanomes_etous === 'number' 
      ? budgetData.katanomes_etous 
      : parseFloat(budgetData.katanomes_etous.toString()))
    : (budgetData.sum?.katanomes_etous || 0);

  const ethsiaPistosi = typeof budgetData.ethsia_pistosi === 'number'
    ? budgetData.ethsia_pistosi
    : parseFloat(budgetData.ethsia_pistosi?.toString() || '0');

  // Handle currentAmount which could be number, string or null
  const amount = typeof currentAmount === 'number'
    ? currentAmount 
    : currentAmount ? parseFloat(String(currentAmount)) : 0;
  
  // Parse quarter-related values
  const currentQuarter = budgetData.current_quarter || '';
  const q1 = typeof budgetData.q1 === 'number'
    ? budgetData.q1
    : parseFloat(budgetData.q1?.toString() || '0');
  
  const q2 = typeof budgetData.q2 === 'number'
    ? budgetData.q2
    : parseFloat(budgetData.q2?.toString() || '0');
  
  const q3 = typeof budgetData.q3 === 'number'
    ? budgetData.q3
    : parseFloat(budgetData.q3?.toString() || '0');
  
  const q4 = typeof budgetData.q4 === 'number'
    ? budgetData.q4
    : parseFloat(budgetData.q4?.toString() || '0');
  
  // Parse new budget indicators
  const availableBudget = typeof budgetData.available_budget === 'number'
    ? budgetData.available_budget
    : parseFloat(budgetData.available_budget?.toString() || (katanomesEtous - userView).toString());
  
  const quarterAvailable = typeof budgetData.quarter_available === 'number'
    ? budgetData.quarter_available
    : parseFloat(budgetData.quarter_available?.toString() || '0');
  
  const yearlyAvailable = typeof budgetData.yearly_available === 'number'
    ? budgetData.yearly_available
    : parseFloat(budgetData.yearly_available?.toString() || (ethsiaPistosi - userView).toString());
  
  // Get the current quarter value based on quarter indicator
  let currentQuarterValue = 0;
  if (currentQuarter === 'q1') {
    currentQuarterValue = q1;
  } else if (currentQuarter === 'q2') {
    currentQuarterValue = q2;
  } else if (currentQuarter === 'q3') {
    currentQuarterValue = q3;
  } else if (currentQuarter === 'q4') {
    currentQuarterValue = q4;
  }
  
  // If quarter_available isn't provided, calculate it
  const quarterAvailableValue = quarterAvailable || (currentQuarterValue - userView);

  // Calculate remaining budget after potential deduction
  const remainingAvailable = availableBudget - amount;
  
  // Calculate percentage for progress bar
  const percentageUsed = availableBudget > 0 ? ((amount / availableBudget) * 100) : 0;
  
  // Check budget thresholds for warnings
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
            <h3 className="text-sm font-medium text-gray-600">Διαθέσιμη Κατανομή</h3>
            <p className={`text-2xl font-bold ${remainingAvailable < 0 ? 'text-red-600' : 'text-blue-600'}`}>
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
            <h3 className="text-sm font-medium text-gray-600">Υπόλοιπο Τριμήνου {currentQuarter?.substring(1) || ''}</h3>
            <p className="text-2xl font-bold text-gray-700">
              {quarterAvailableValue.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Υπόλοιπο τρέχοντος τριμήνου
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Υπόλοιπο προς Πίστωση</h3>
            <p className="text-2xl font-bold text-gray-700">
              {yearlyAvailable.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Υπόλοιπο προς πίστωση για το έτος
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