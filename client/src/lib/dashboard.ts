/**
 * Dashboard Types and Utilities
 */

export interface DashboardStats {
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
  projectStats: {
    active: number;
    pending: number;
    completed: number;
    pending_reallocation?: number;
  };
  budgetTotals: Record<string, number>;
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    date: string;
    createdBy?: string;
    documentId?: number;
    mis?: string;
    previousAmount?: number;
    newAmount?: number;
    changeAmount?: number;
  }>;
}

export interface RecentDocument {
  id: number;
  title?: string;
  status?: string;
  document_type?: string;
  protocol_number?: string;
  created_at?: string;
  mis?: string;
  unit?: string;
}