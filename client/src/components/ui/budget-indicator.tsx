import { type BudgetData } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { BadgeInfo, Calculator, CalendarFold, PiggyBank, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

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
  // Enhanced debug output
  console.log("[CompactBudgetIndicator] Rendering with data:", budgetData, "for MIS:", mis);
  if (budgetData) {
    console.log("[CompactBudgetIndicator] Debug - key values:", { 
      user_view: budgetData.user_view,
      katanomes_etous: budgetData.katanomes_etous,
      available_budget: budgetData.available_budget,
      // Show the data types to help debug type conversion issues
      types: {
        user_view: typeof budgetData.user_view,
        katanomes_etous: typeof budgetData.katanomes_etous,
        available_budget: typeof budgetData.available_budget,
        mis: typeof mis
      }
    });
  }
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

  const katanomesEtous = typeof budgetData.katanomes_etous === 'number'
    ? budgetData.katanomes_etous
    : parseFloat(budgetData.katanomes_etous?.toString() || '0');

  const availableBudget = typeof budgetData.available_budget === 'number'
    ? budgetData.available_budget
    : parseFloat(budgetData.available_budget?.toString() || '0');

  // If available_budget is not in the response, calculate it
  const calculatedAvailable = availableBudget || (katanomesEtous - userView);
  
  // Calculate percentage used for visualization
  const percentageUsed = katanomesEtous > 0 ? ((userView / katanomesEtous) * 100) : 0;
  
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center">
          <Calculator className="mr-2 h-4 w-4 text-blue-500" />
          <span>Κατανομή: </span>
        </div>
        <span className="font-medium">
          {calculatedAvailable.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
        </span>
      </div>
      
      <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${percentageUsed > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(percentageUsed, 100)}%` }}
        />
      </div>
      
      <div className="flex justify-end text-xs text-gray-500 mt-0.5">
        {percentageUsed.toFixed(1)}% χρησιμοποιήθηκε
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
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Effect to show a brief "updating" indicator when budget data changes
  // This provides a visual cue that real-time updates are occurring
  useEffect(() => {
    if (budgetData) {
      setIsUpdating(true);
      const timer = setTimeout(() => {
        setIsUpdating(false);
      }, 1000); // Show updating indicator for 1 second
      
      console.log("[BudgetIndicator] Budget data updated, showing sync indicator");
      
      return () => clearTimeout(timer);
    }
  }, [budgetData?.available_budget, currentAmount]);
  
  // Enhanced debug output for main budget indicator 
  console.log("[BudgetIndicator] Rendering with data:", budgetData, "current amount:", currentAmount);
  if (budgetData) {
    console.log("[BudgetIndicator] Debug - data types:", {
      user_view: typeof budgetData.user_view,
      katanomes_etous: typeof budgetData.katanomes_etous,
      ethsia_pistosi: typeof budgetData.ethsia_pistosi,
      available_budget: typeof budgetData.available_budget,
      // Additional conversion debug info
      values: {
        user_view: budgetData.user_view,
        katanomes_etous: budgetData.katanomes_etous,
        ethsia_pistosi: budgetData.ethsia_pistosi,
        available_budget: budgetData.available_budget
      },
      amount: currentAmount,
      amount_type: typeof currentAmount
    });
  } else {
    console.warn("[BudgetIndicator] No budget data received!");
  }

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

  // Calculate remaining budget after potential deduction in real-time
  const remainingAvailable = availableBudget - amount;
  
  // Calculate percentage for progress bar, showing real-time usage as user types
  const percentageUsed = availableBudget > 0 ? ((amount / availableBudget) * 100) : 0;
  
  // Check budget thresholds for warnings (showing in real-time as they type)
  const isExceeding20Percent = amount > (katanomesEtous * 0.2);
  const isExceedingEthsiaPistosi = amount > ethsiaPistosi;
  const isExceedingAvailable = remainingAvailable < 0;

  // Show warnings when thresholds are exceeded
  if (isExceedingEthsiaPistosi && onValidationWarning) {
    onValidationWarning('funding');
  } else if (isExceeding20Percent && onValidationWarning) {
    onValidationWarning('reallocation');
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg relative">
        {isUpdating && (
          <div className="absolute top-2 right-2 flex items-center text-xs text-blue-600 animate-pulse">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            <span>Συγχρονισμός...</span>
          </div>
        )}
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
      
      {/* Show real-time warning for exceeding available budget */}
      {isExceedingAvailable && !isExceedingEthsiaPistosi && (
        <Alert variant="destructive">
          <AlertDescription>
            Το ποσό υπερβαίνει τον διαθέσιμο προϋπολογισμό κατά {Math.abs(remainingAvailable).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}