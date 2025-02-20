export interface BudgetData {
  user_view: number;
  total_budget: number;
  katanomes_etous: number;
  ethsia_pistosi: number;
  proip?: number;
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
  type: 'funding' | 'reallocation';
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
  notificationType?: 'funding' | 'reallocation';
  allowDocx: boolean;
}