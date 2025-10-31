export interface BudgetData {
  current_budget: string | number;
  total_budget?: string | number;
  annual_budget?: string | number;
  katanomes_etous?: string | number;
  ethsia_pistosi: string | number;
  user_view: string | number; // Σύνολο Διαβίβασης
  quarter_view?: string | number;
  current_quarter?: string;
  last_quarter_check?: string;
  current_quarter_spent?: string | number; // Amount spent in the current quarter
  q1: string | number;
  q2: string | number;
  q3: string | number;
  q4: string | number;
  total_spent?: string | number;
  // Budget indicators
  available_budget?: string | number;  // Διαθέσιμη Κατανομή = katanomes_etous - user_view
  quarter_available?: string | number; // Υπόλοιπο Τριμήνου = (current_q + carried_forward) - current_quarter_spent
  yearly_available?: string | number;  // Υπόλοιπο προς Πίστωση = ethsia_pistosi - user_view
  // Sum field from the API response
  sum?: {
    user_view: number;
    updated_at: string;
    ethsia_pistosi: number;
    current_quarter: number;
    katanomes_etous: number;
    available_budget: number;
    yearly_available: number;
    quarter_available: number;
    carried_forward?: number; // Accumulated unspent budget from previous quarters
    [key: string]: any;
  };
}

export interface BudgetValidationResponse {
  status: 'success' | 'warning' | 'error';
  canCreate: boolean;
  message: string;
  allowDocx?: boolean;
  requiresNotification?: boolean;
  notificationType?: string;
  priority?: string;
  metadata?: {
    availableBeforeOperation?: number;
    availableAfterOperation?: number;
    userView?: number;
    newUserView?: number;
    baseValue?: number;
    percentageAvailable?: number;
    threshold?: number;
    percentageRemaining?: number;
    remainingBudget?: number;
    previousBudget?: number;
    percentAfterOperation?: number;
    amountUsed?: number;
    budget_indicators?: {
      available_budget?: string;
      quarter_available?: string;
      yearly_available?: string;
    }
  };
}

export interface Project {
  id: string;
  mis?: string;
  name: string;
  expenditure_types: string[];
}

export interface Recipient {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
  amount: number;
  installments: string[];
  installmentAmounts?: Record<string, number>;
}

export interface DocumentData {
  id: string;
  unit: string;
  project_id: string;
  project_mis?: string;
  region?: string;
  expenditure_type?: string;
  recipients: Recipient[];
  total_amount: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  attachments?: string[];
}

export interface Unit {
  id: string;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  unit_id?: number[];
  units?: string[];
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

/**
 * WebSocket Budget Update Message Type
 * Used for real-time updates when users type budget amounts
 */
export interface BudgetUpdate {
  type: 'budget_update';
  mis: string;
  amount: number;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  // IMPROVEMENT: Simple budget data for direct calculation
  simpleBudgetData?: {
    available_budget: number;
    yearly_available: number;
    quarter_available: number;
  };
}

/**
 * Result type for the useBudgetUpdates hook
 * Includes real-time budget data and validation result
 */
export interface BudgetHookResult {
  budgetData: BudgetData | undefined;
  validationResult: BudgetValidationResponse | undefined;
  isBudgetLoading: boolean;
  isValidationLoading: boolean;
  budgetError: Error | null;
  validationError: Error | null;
  websocketConnected: boolean;
  broadcastUpdate: (amount: number) => Promise<void>; // Method to manually trigger real-time updates
}