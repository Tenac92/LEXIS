/**
 * API Contracts
 * 
 * Type-safe interfaces for all backend endpoints.
 * Prevents frontend from calling non-existent endpoints.
 */

/**
 * Dashboard Statistics
 */
export interface DashboardStats {
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
  projectStats: {
    active: number;
    pending: number;
    completed: number;
    pending_reallocation: number;
  };
  budgetTotals: {
    total?: number;
    allocated?: number;
    remaining?: number;
  };
  recentActivity?: Array<{
    id: string;
    description: string;
    timestamp: string;
    type: string;
  }>;
}

/**
 * System Health Status (Under Development)
 */
export interface SystemHealth {
  healthPercentage: number;
  databaseLatency: number;
  memoryUsage: number;
  uptime: number;
  timestamp: string;
}

/**
 * Budget Overview (NOT YET IMPLEMENTED)
 */
export interface BudgetOverview {
  total: number;
  allocated: number;
  remaining: number;
  utilization: number;
  alerts: BudgetAlert[];
}

/**
 * Budget Notification / Alert
 */
export interface BudgetAlert {
  id: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  href?: string;
  timestamp: string;
}

/**
 * Template (NOT YET FULLY IMPLEMENTED)
 * - Creation works
 * - Preview/Edit endpoints missing
 */
export interface Template {
  id: number;
  name: string;
  description: string;
  category: string;
  expenditure_type: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Quarter Transition Status
 */
export interface QuarterTransitionStatus {
  success: boolean;
  current_quarter: string;
  current_date: string;
  next_scheduled_check: string;
  error?: string;
}

/**
 * Year End Closure Status
 */
export interface YearEndClosureStatus {
  success: boolean;
  current_year: number;
  current_date: string;
  next_scheduled_closure: string;
  days_until_closure: number;
  error?: string;
}

/**
 * API Endpoint Status
 * For auditing which endpoints are implemented vs mocked
 */
export const API_ENDPOINTS = {
  // ✅ Fully Implemented
  DASHBOARD_STATS: {
    method: "GET",
    path: "/api/dashboard/stats",
    implemented: true,
    description: "Get dashboard statistics",
  },
  DOCUMENTS: {
    method: "GET",
    path: "/api/documents",
    implemented: true,
    description: "List all documents",
  },
  DOCUMENTS_CREATE: {
    method: "POST",
    path: "/api/documents",
    implemented: true,
    description: "Create new document",
  },
  PROJECTS: {
    method: "GET",
    path: "/api/projects",
    implemented: true,
    description: "List all projects",
  },
  USERS: {
    method: "GET",
    path: "/api/users",
    implemented: true,
    description: "List all users",
  },
  BUDGET_NOTIFICATIONS: {
    method: "GET",
    path: "/api/budget/notifications",
    implemented: true,
    description: "Get budget notifications (returns empty array)",
  },
  BUDGET_VALIDATE: {
    method: "POST",
    path: "/api/budget/validate",
    implemented: true,
    description: "Validate budget for document",
  },
  QUARTER_STATUS: {
    method: "GET",
    path: "/api/admin/quarter-transition/status",
    implemented: true,
    description: "Get quarter transition status",
  },

  // ⚠️ Partially Implemented
  TEMPLATES: {
    method: "GET",
    path: "/api/templates",
    implemented: false,
    description: "List templates - ENDPOINT MISSING",
  },
  TEMPLATES_CREATE: {
    method: "POST",
    path: "/api/templates",
    implemented: false,
    description: "Create template - ENDPOINT MISSING",
  },
  BUDGET_OVERVIEW: {
    method: "GET",
    path: "/api/budget/overview",
    implemented: false,
    description: "Get budget overview - ENDPOINT MISSING",
  },
  SYSTEM_STATS: {
    method: "GET",
    path: "/api/admin/system-stats",
    implemented: false,
    description: "Get system statistics - ENDPOINT EXISTS but returns mock data",
  },

  // ❌ Not Implemented
  PROJECT_ANALYSIS: {
    method: "GET",
    path: "/api/admin/project-analysis",
    implemented: false,
    description: "Project performance analysis - NOT IMPLEMENTED",
  },
  SYSTEM_SETTINGS: {
    method: "GET",
    path: "/api/admin/system-settings",
    implemented: false,
    description: "Get system settings - NOT IMPLEMENTED",
  },
  TEMPLATE_PREVIEW: {
    method: "GET",
    path: "/api/templates/:id/preview",
    implemented: false,
    description: "Preview template - NOT IMPLEMENTED",
  },
  TEMPLATE_EDIT: {
    method: "PUT",
    path: "/api/templates/:id",
    implemented: false,
    description: "Update template - NOT IMPLEMENTED",
  },
} as const;

/**
 * Get implementation status of an endpoint
 */
export function getEndpointStatus(
  endpoint: keyof typeof API_ENDPOINTS
): boolean {
  return API_ENDPOINTS[endpoint]?.implemented ?? false;
}

/**
 * Get all unimplemented endpoints (for debugging)
 */
export function getUnimplementedEndpoints() {
  return Object.entries(API_ENDPOINTS)
    .filter(([_, config]) => !config.implemented)
    .map(([key, config]) => ({
      key,
      ...config,
    }));
}

/**
 * Get all implemented endpoints (for auditing)
 */
export function getImplementedEndpoints() {
  return Object.entries(API_ENDPOINTS)
    .filter(([_, config]) => config.implemented)
    .map(([key, config]) => ({
      key,
      ...config,
    }));
}
