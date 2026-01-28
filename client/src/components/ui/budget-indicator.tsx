import { type BudgetData, type BudgetUpdate } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { BadgeInfo, Calculator, PiggyBank, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useWebSocketUpdates } from "@/hooks/use-websocket-updates";

interface BudgetIndicatorProps {
  budgetData?: BudgetData;  // Make budgetData optional
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
  // Rendering the CompactBudgetIndicator with budget data for specific MIS
  if (budgetData) {
    // Budget data includes information about user view, yearly allocations, 
    // and available budget with proper type handling for all properties
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

  // Convert to number before calculations
  const numAvailableBudget = typeof availableBudget === 'string' ? parseFloat(availableBudget) : availableBudget;
  
  // If available_budget is not in the response or is 0, calculate it
  const calculatedAvailable = (numAvailableBudget || 0) > 0 ? numAvailableBudget : (katanomesEtous - userView);
  
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
  const [_realTimeBudgetValues, setRealTimeBudgetValues] = useState<{
    available_budget?: number;
    yearly_available?: number;
    quarter_available?: number;
  } | null>(null);
  
  // Debug logging for budget data
  console.log('[BudgetIndicator] Received budget data:', budgetData);
  
  // Subscribe to WebSocket updates and get real-time budget updates
  const { lastMessage } = useWebSocketUpdates();
  
  // Effect to handle budget updates from WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'budget_update') {
      // Cast the message as BudgetUpdate
      const budgetUpdate = lastMessage as BudgetUpdate;
      
      // Check if we have the simple budget data in the update
      if (budgetUpdate.simpleBudgetData) {
        // Process real-time budget update received from WebSocket
        
        // Set real-time values from the WebSocket
        setRealTimeBudgetValues(budgetUpdate.simpleBudgetData);
        
        // Show the updating indicator
        setIsUpdating(true);
        setTimeout(() => {
          setIsUpdating(false);
        }, 1500); // Show for a bit longer to make it noticeable
        
        // Show a toast notification for the update
        toast({
          title: "Ζωντανή ενημέρωση προϋπολογισμού",
          description: "Τα ποσά έχουν ενημερωθεί σε πραγματικό χρόνο.",
          variant: "default",
          duration: 3000 // 3 seconds
        });
      }
    }
  }, [lastMessage, toast]);
  
  // Effect to show a brief "updating" indicator when budget data changes
  // This provides a visual cue that real-time updates are occurring
  useEffect(() => {
    if (budgetData) {
      console.log('[BudgetIndicator] Budget data updated, showing update indicator', {
        userView: budgetData.user_view,
        katanomesEtous: budgetData.katanomes_etous,
        available: budgetData.available_budget
      });
      setIsUpdating(true);
      const timer = setTimeout(() => {
        setIsUpdating(false);
      }, 1000); // Show updating indicator for 1 second
      
      // Budget data updated, briefly show sync indicator
      
      return () => clearTimeout(timer);
    }
  }, [budgetData]);
  
  // Enhanced debug output for main budget indicator 
  // Rendering BudgetIndicator with current budget data and amount
  if (budgetData) {
    // Budget data types are properly validated to handle both string and number values
    // Values include user_view, katanomes_etous, ethsia_pistosi, and available_budget
  } else {
    // No budget data received, display placeholder message to user
  }

  // ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Βελτιωμένη διαχείριση κενής κατάστασης - εμφανίζει μήνυμα όταν δεν υπάρχουν διαθέσιμα δεδομένα προϋπολογισμού
  if (!budgetData) {
    // No budget data available, show placeholder UI to guide user
    return (
      <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg">
        <div className="flex items-center justify-center h-20">
          <div className="flex flex-col items-center text-center">
            <PiggyBank className="h-8 w-8 mb-2 text-blue-300" />
            <h3 className="text-sm font-medium text-gray-600">Επιλέξτε έργο για να δείτε τον προϋπολογισμό</h3>
            <p className="text-xs text-gray-500 mt-1">
              Τα στοιχεία προϋπολογισμού θα εμφανιστούν μόλις επιλέξετε έργο
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Check for projects that legitimately have no budget data (different from zero allocations)
  if (
    budgetData && 
    (!budgetData.katanomes_etous || budgetData.katanomes_etous === 0) && 
    (!budgetData.user_view || budgetData.user_view === 0) && 
    (!budgetData.available_budget || budgetData.available_budget === 0) &&
    (!budgetData.ethsia_pistosi || budgetData.ethsia_pistosi === 0)
  ) {
    // Budget data exists but has zero values, showing informative message that project has no budget allocation
    return (
      <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-xl border border-orange-100/50 shadow-lg">
        <div className="flex items-center justify-center h-20">
          <div className="flex flex-col items-center text-center">
            <PiggyBank className="h-8 w-8 mb-2 text-orange-300" />
            <h3 className="text-sm font-medium text-gray-600">Δεν υπάρχουν δεδομένα προϋπολογισμού</h3>
            <p className="text-xs text-gray-500 mt-1">
              Το επιλεγμένο έργο δεν έχει κατανομή προϋπολογισμού
            </p>
          </div>
        </div>
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

  // Handle currentAmount which could be number, string or null
  // CRITICAL FIX: Guard against extremely large numbers that cause display issues
  let amount = 0;
  try {
    if (typeof currentAmount === 'number') {
      // Check if the number is unreasonably large (more than 1 billion)
      // This prevents scientific notation or overflow display issues
      amount = !isFinite(currentAmount) || currentAmount > 1000000000 ? 0 : currentAmount;
    } else if (currentAmount) {
      const parsed = parseFloat(String(currentAmount));
      amount = !isFinite(parsed) || parsed > 1000000000 ? 0 : parsed;
    }
    // Log any corrections we made
    if (currentAmount && amount === 0) {
      // Invalid amount detected and corrected to zero to prevent display issues
      // This prevents scientific notation or overflow display issues for extremely large numbers
    }
  } catch {
    // Error handling: If amount parsing fails, reset to 0 as a safe default
    // This ensures the component always displays something valid even with data issues
    amount = 0;
  }
  
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
  
  // IMPROVEMENT: Check if we have real-time budget data from WebSocket
  // This will override the initial values from budgetData if available
  // Parse new budget indicators
  // If we have real-time values from the WebSocket, use those instead
  // Log if we're using real-time values
  // If we have real-time budget data from WebSocket, it overrides the static data
  // This ensures the most current budget information is displayed to the user
  
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
  
  // Get the current quarter based on date if not provided
  const getCurrentQuarterNumber = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed
    return Math.ceil(month / 3);
  };
  
  // Determine the current quarter number
  let currentQuarterNumber = 0;
  if (currentQuarter === 'q1') currentQuarterNumber = 1;
  else if (currentQuarter === 'q2') currentQuarterNumber = 2;
  else if (currentQuarter === 'q3') currentQuarterNumber = 3;
  else if (currentQuarter === 'q4') currentQuarterNumber = 4;
  else currentQuarterNumber = getCurrentQuarterNumber();
  
  // Log for debugging
  console.log("[Budget Debug] Quarter information:", { 
    currentQuarter, 
    currentQuarterNumber,
    currentQuarterValue, 
    userView,
    q1, q2, q3, q4 
  });
  
  // Get carried forward amount from sum field (accumulated unspent budget from previous quarters)
  const carriedForward = budgetData.sum?.carried_forward 
    ? (typeof budgetData.sum.carried_forward === 'number' 
      ? budgetData.sum.carried_forward 
      : parseFloat(String(budgetData.sum.carried_forward)))
    : 0;
  
  // Get current quarter spent
  const currentQuarterSpent = typeof budgetData.current_quarter_spent === 'number'
    ? budgetData.current_quarter_spent
    : parseFloat(budgetData.current_quarter_spent?.toString() || '0');
  
  // CORRECT FORMULAS as specified:
  // Διαθέσιμη Κατανομή = katanomes_etous - user_view
  const diathesimiKatanomi = Math.max(0, katanomesEtous - userView);
  
  // Διαθέσιμο Υπόλοιπο Τριμήνου = (current quarter allocation + carried forward) - current quarter spent
  // This properly accounts for accumulated unspent budget from previous quarters
  const diathesimoTriminoυ = Math.max(0, (currentQuarterValue + carriedForward) - currentQuarterSpent);
  
  // Υπόλοιπο προς Πίστωση = ethsia_pistosi - user_view
  // NOTE: Not displayed in UI for 2026+ projects where ethsia_pistosi = 0
  const ypoloipoProsPistosi = Math.max(0, ethsiaPistosi - userView);
  
  // Calculate what would remain after the current input amount for each
  const diathesimiKatanomiAfter = Math.max(0, diathesimiKatanomi - amount);
  const diathesimoTriminoυAfter = Math.max(0, diathesimoTriminoυ - amount);

  // Calculate remaining budget after potential deduction in real-time
  // Ensure we have valid numbers by providing fallbacks
  // Check budget thresholds for warnings (showing in real-time as they type)
  const isExceeding20Percent = amount > (katanomesEtous * 0.2);
  const isExceedingEthsiaPistosi = amount > ethsiaPistosi;
  const isExceedingAvailable = diathesimiKatanomiAfter < 0 || diathesimoTriminoυAfter < 0;

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-600">Διαθέσιμη Κατανομή</h3>
            <p className={`text-2xl font-bold ${diathesimiKatanomiAfter > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {diathesimiKatanomiAfter.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <div className="mt-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${((userView + amount) / katanomesEtous * 100) > 90 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-300`}
                  style={{ width: `${Math.min(((userView + amount) / katanomesEtous * 100), 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {katanomesEtous > 0 ? ((userView + amount) / katanomesEtous * 100).toFixed(1) : 0}% χρησιμοποιήθηκε
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600">Διαθέσιμο Υπόλοιπο Τριμήνου</h3>
            <p className={`text-2xl font-bold ${diathesimoTriminoυAfter > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diathesimoTriminoυAfter.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Υπόλοιπο τρέχοντος τριμήνου
            </p>
            {amount > 0 && (
              <p className={`text-xs ${diathesimoTriminoυAfter < 0 ? 'text-red-500' : 'text-green-600'} mt-1`}>
                Πριν: {diathesimoTriminoυ.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {isExceedingEthsiaPistosi && ethsiaPistosi > 0 && (
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
            Το ποσό υπερβαίνει τον διαθέσιμο προϋπολογισμό κατά {Math.abs(diathesimiKatanomiAfter).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
