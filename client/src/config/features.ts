/**
 * Feature Flags Configuration
 * 
 * Centralized feature toggle system to prevent UI-backend drift.
 * Set enabled: true only when feature is fully implemented in backend.
 */

export const FEATURES = {
  // Project Management
  PROJECT_ANALYSIS: {
    enabled: false,
    path: "/admin/project-analysis",
    label: "Ανάλυση απόδοσης",
    reason: "Under development - backend endpoint not implemented"
  },

  // System Administration
  SYSTEM_SETTINGS: {
    enabled: false,
    path: "/admin/system-settings",
    label: "Ρυθμίσεις συστήματος",
    reason: "Under development - backend endpoint not implemented"
  },

  SYSTEM_HEALTH_MONITORING: {
    enabled: false,
    path: null,
    label: "Παρακολούθηση υγείας συστήματος",
    reason: "Under development - backend readiness endpoint exists but UI is pending"
  },

  // Template Management
  TEMPLATE_MANAGEMENT: {
    enabled: false,
    path: "/templates",
    label: "Διαχείριση προτύπων",
    reason: "Partial implementation - API endpoints missing"
  },

  TEMPLATE_PREVIEW: {
    enabled: false,
    path: null,
    label: "Προεπισκόπηση προτύπου",
    reason: "Not implemented - no backend endpoint"
  },

  TEMPLATE_EDIT: {
    enabled: false,
    path: null,
    label: "Επεξεργασία προτύπου",
    reason: "Not implemented - no backend endpoint"
  },

  // Budget Features
  BUDGET_OVERVIEW: {
    enabled: false,
    path: null,
    label: "Σύνοψη προϋπολογισμού",
    reason: "Backend endpoint missing - /api/budget/overview not implemented"
  },

  // Notifications
  BUDGET_NOTIFICATIONS: {
    enabled: true,
    path: null,
    label: "Ειδοποιήσεις προϋπολογισμού",
    reason: "Endpoint exists but returns empty array - placeholder implementation"
  },

  // All fully implemented features (these don't need flags but documented for reference)
  DOCUMENTS_MANAGEMENT: {
    enabled: true,
    path: "/documents",
    label: "Διαχείριση διαβιβαστικών",
    reason: "Fully implemented"
  },

  PROJECTS_MANAGEMENT: {
    enabled: true,
    path: "/projects",
    label: "Διαχείριση έργων",
    reason: "Fully implemented"
  },

  USERS_MANAGEMENT: {
    enabled: true,
    path: "/users",
    label: "Διαχείριση χρηστών",
    reason: "Fully implemented"
  },

  QUARTER_MANAGEMENT: {
    enabled: true,
    path: "/admin/quarter-management",
    label: "Διαχείριση τριμήνων",
    reason: "Fully implemented"
  },

  BUDGET_MONITORING: {
    enabled: true,
    path: "/admin/budget-monitoring",
    label: "Παρακολούθηση προϋπολογισμού",
    reason: "Fully implemented"
  },

  BUDGET_UPLOAD: {
    enabled: true,
    path: "/admin/budget-upload",
    label: "Φόρτωση προϋπολογισμού",
    reason: "Fully implemented"
  },

  PAYMENTS_IMPORT: {
    enabled: true,
    path: "/admin/payments-import",
    label: "Εισαγωγή πληρωμών",
    reason: "Fully implemented"
  },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export type Feature = typeof FEATURES[FeatureKey];

/**
 * Check if a feature is enabled
 * @param feature - The feature key to check
 * @returns true if feature is fully implemented, false otherwise
 */
export function isFeatureEnabled(feature: FeatureKey): boolean {
  return FEATURES[feature]?.enabled ?? false;
}

/**
 * Get feature metadata
 * @param feature - The feature key
 * @returns Feature configuration object
 */
export function getFeature(feature: FeatureKey): Feature {
  return FEATURES[feature];
}

/**
 * Get all disabled features (for debugging/admin purposes)
 */
export function getDisabledFeatures(): Record<FeatureKey, Feature> {
  return Object.entries(FEATURES).reduce(
    (acc, [key, feature]) => {
      if (!feature.enabled) {
        acc[key as FeatureKey] = feature as Feature;
      }
      return acc;
    },
    {} as Record<FeatureKey, Feature>
  );
}

/**
 * Get all enabled features (for auditing)
 */
export function getEnabledFeatures(): Record<FeatureKey, Feature> {
  return Object.entries(FEATURES).reduce(
    (acc, [key, feature]) => {
      if (feature.enabled) {
        acc[key as FeatureKey] = feature as Feature;
      }
      return acc;
    },
    {} as Record<FeatureKey, Feature>
  );
}
