export interface User {
  id: number;
  name: string;
  username?: string;
  email: string;
  role: 'admin' | 'user';
  created_at?: string;
  updated_at?: string;
}

export interface BudgetData {
  user_view: number;
  total_budget: number;
  katanomes_etous: number;
  ethsia_pistosi: number;
  proip?: number;
  current_budget?: number;  // Added for compatibility with BudgetIndicator
  annual_budget?: number;   // Added for compatibility with BudgetIndicator
  total_spent?: number;     // Total amount spent so far
  remaining_budget?: number; // Current remaining budget after spending
  quarterly?: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
}

export interface BudgetNotification {
  id: number;
  mis: string;
  type: 'funding' | 'reallocation' | 'low_budget';
  amount: number;
  current_budget: number;
  ethsia_pistosi: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetValidationResponse {
  status: 'success' | 'warning' | 'error';
  message?: string;
  canCreate: boolean;
  requiresNotification?: boolean;
  notificationType?: 'funding' | 'reallocation' | 'low_budget' | 'threshold_warning' | 'exceeded_proip';
  priority?: 'high' | 'medium' | 'low';
  allowDocx?: boolean;
  metadata?: {
    remainingBudget?: number;
    threshold?: number;
    baseValue?: number;
    percentageRemaining?: number;
    available?: number;
    requested?: number;
    shortfall?: number;
    previousBudget?: number;
    budgetValues?: Record<string, number>;
    error?: string;
    [key: string]: any;
  };
}