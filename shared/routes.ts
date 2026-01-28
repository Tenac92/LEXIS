/**
 * Centralized Route Definitions
 * 
 * Single source of truth for all routes in the application.
 * Prevents UI-routing drift and makes it easy to manage navigation.
 */

import { FeatureKey } from "@/config/features";

export interface RouteConfig {
  path: string;
  label: string;
  icon?: string;
  roles: ("admin" | "manager" | "user")[];
  feature?: FeatureKey;
  description?: string;
}

/**
 * Public Routes (no authentication required)
 */
export const PUBLIC_ROUTES = {
  AUTH: "/auth",
  LOGIN: "/auth",
} as const;

/**
 * Protected Routes (authentication required)
 */
export const PROTECTED_ROUTES = {
  // Dashboard
  HOME: "/",

  // Documents
  DOCUMENTS: "/documents",
  DOCUMENTS_NEW: "/documents/new",

  // Templates
  TEMPLATES: "/templates",

  // Projects
  PROJECTS: "/projects",
  PROJECTS_NEW: "/projects/new",
  PROJECTS_DETAILS: (id: string) => `/projects/${id}`,
  PROJECTS_EDIT: (id: string) => `/projects/${id}/edit`,

  // Users
  USERS: "/users",

  // Employees
  EMPLOYEES: "/employees",

  // Beneficiaries
  BENEFICIARIES: "/beneficiaries",

  // Budget
  BUDGET_HISTORY: "/budget-history",
  BUDGET_HISTORY_ALT: "/budget/history",

  // Notifications
  NOTIFICATIONS: "/notifications",
  NOTIFICATIONS_ADMIN: "/admin/notifications",

  // Admin Features
  BUDGET_UPLOAD: "/admin/budget-upload",
  PAYMENTS_IMPORT: "/admin/payments-import",
  QUARTER_MANAGEMENT: "/admin/quarter-management",
  BUDGET_MONITORING: "/admin/budget-monitoring",

  // Under Development / Disabled
  PROJECT_ANALYSIS: "/admin/project-analysis",
  SYSTEM_SETTINGS: "/admin/system-settings",
} as const;

/**
 * Navigation items for header (filtered by role)
 */
export const NAVIGATION_CONFIG: RouteConfig[] = [
  {
    path: PROTECTED_ROUTES.DOCUMENTS,
    label: "Διαβιβαστικά",
    roles: ["admin", "user", "manager"],
    description: "Manage transfer documents",
  },
  {
    path: PROTECTED_ROUTES.PROJECTS,
    label: "Έργα",
    roles: ["admin", "user", "manager"],
    description: "Manage projects",
  },
  {
    path: PROTECTED_ROUTES.BUDGET_HISTORY,
    label: "Ιστορικό Προϋπ.",
    roles: ["admin", "manager"],
    description: "View budget history",
  },
  {
    path: PROTECTED_ROUTES.EMPLOYEES,
    label: "Υπάλληλοι",
    roles: ["admin", "manager"],
    description: "Manage employees",
  },
  {
    path: PROTECTED_ROUTES.BENEFICIARIES,
    label: "Δικαιούχοι",
    roles: ["user", "manager"],
    description: "Manage beneficiaries",
  },
  {
    path: PROTECTED_ROUTES.USERS,
    label: "Χρήστες",
    roles: ["admin"],
    description: "Manage system users",
  },
  {
    path: PROTECTED_ROUTES.NOTIFICATIONS_ADMIN,
    label: "Ειδοποιήσεις",
    roles: ["admin"],
    description: "System notifications",
  },
];

/**
 * Admin Control Panel Links
 */
export const ADMIN_CONTROLS = {
  PROJECT_MANAGEMENT: [
    {
      path: PROTECTED_ROUTES.PROJECTS,
      label: "Προβολή όλων των έργων",
      description: "View all projects",
    },
    {
      path: PROTECTED_ROUTES.PROJECT_ANALYSIS,
      label: "Ανάλυση απόδοσης",
      feature: "PROJECT_ANALYSIS" as FeatureKey,
      description: "Project performance analysis",
    },
  ],

  BUDGET_MANAGEMENT: [
    {
      path: PROTECTED_ROUTES.BUDGET_UPLOAD,
      label: "Φόρτωση προϋπολογισμού",
      description: "Upload budget data",
    },
    {
      path: PROTECTED_ROUTES.PAYMENTS_IMPORT,
      label: "Εισαγωγή πληρωμών",
      description: "Import payment data",
    },
    {
      path: PROTECTED_ROUTES.BUDGET_HISTORY,
      label: "Ιστορικό προϋπολογισμού",
      description: "View budget history",
    },
  ],

  SYSTEM_MANAGEMENT: [
    {
      path: PROTECTED_ROUTES.USERS,
      label: "Διαχείριση χρηστών",
      description: "Manage system users",
    },
    {
      path: PROTECTED_ROUTES.NOTIFICATIONS_ADMIN,
      label: "Ειδοποιήσεις συστήματος",
      description: "System notifications",
    },
    {
      path: PROTECTED_ROUTES.QUARTER_MANAGEMENT,
      label: "Διαχείριση τριμήνων",
      description: "Manage quarter transitions",
    },
    {
      path: PROTECTED_ROUTES.TEMPLATES,
      label: "Πρότυπα εγγράφων",
      description: "Manage document templates",
    },
    {
      path: PROTECTED_ROUTES.SYSTEM_SETTINGS,
      label: "Ρυθμίσεις συστήματος",
      feature: "SYSTEM_SETTINGS" as FeatureKey,
      description: "System configuration",
    },
  ],
};

/**
 * Get navigation items filtered by user role
 */
export function getNavigationByRole(
  role: "admin" | "manager" | "user"
): RouteConfig[] {
  return NAVIGATION_CONFIG.filter((item) => item.roles.includes(role));
}

/**
 * Check if a route is valid (exists in the application)
 */
export function isValidRoute(path: string): boolean {
  const allRoutes = Object.values(PROTECTED_ROUTES).filter(
    (route) => typeof route === "string"
  );
  return allRoutes.includes(path as any);
}

/**
 * Get all admin control items that are actually enabled
 */
export function getEnabledAdminControls() {
  return Object.entries(ADMIN_CONTROLS).reduce(
    (acc, [category, items]) => {
      acc[category] = items.filter((item: any) => !item.feature);
      return acc;
    },
    {} as Record<string, any>
  );
}
