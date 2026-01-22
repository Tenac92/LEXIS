/**
 * Dashboard Utility Functions
 * Shared calculations and formatters for dashboards
 */

/**
 * Format large numbers with K/M suffixes for display
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M €`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K €`;
  }
  return `${value.toFixed(0)} €`;
}

/**
 * Format currency with proper locale
 */
export function formatCurrency(value: number, locale: string = "el-GR"): string {
  return value.toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
  });
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionRate(
  completed: number,
  total: number,
): number {
  if (!total || total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Calculate budget utilization percentage
 */
export function calculateBudgetUtilization(
  used: number,
  total: number,
): number {
  if (!total || total === 0) return 0;
  return Math.round((used / total) * 100);
}

/**
 * Get severity level based on percentage
 */
export function getSeverityFromPercentage(
  percentage: number,
): "high" | "medium" | "low" {
  if (percentage >= 90) return "high";
  if (percentage >= 75) return "medium";
  return "low";
}

/**
 * Format date for Greek locale
 */
export function formatDate(date: string | Date, locale: string = "el-GR"): string {
  return new Date(date).toLocaleDateString(locale);
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: string | Date, locale: string = "el"): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Σήμερα";
  if (diffDays === 1) return "Χθες";
  if (diffDays < 7) return `Πριν ${diffDays} ημέρες`;
  if (diffDays < 30) return `Πριν ${Math.floor(diffDays / 7)} εβδομάδες`;
  return formatDate(date, locale);
}

/**
 * Sum values in an object
 */
export function sumObjectValues(obj: Record<string, number>): number {
  return Object.values(obj).reduce((sum, val) => sum + val, 0);
}
