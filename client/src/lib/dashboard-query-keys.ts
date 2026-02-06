/**
 * Utility functions for creating stable, user-scoped query keys
 * Prevents cache collisions between users with different unit assignments
 */

/**
 * Create a stable hash of an array (e.g., unit IDs)
 * Two arrays with same elements in same order will produce same hash
 * Used as part of query keys to invalidate cache when units change
 */
export function hashArray(arr: number[] | undefined): string {
  if (!arr || arr.length === 0) return "none";
  // Sort to ensure consistent hashing regardless of order
  return arr.sort((a, b) => a - b).join(",");
}

/**
 * Create a dashboard stats query key that includes user context
 * Ensures different users never share cached dashboard data
 * 
 * @param userId - The user ID
 * @param unitIds - The user's assigned unit IDs
 * @returns Query key array suitable for React Query
 */
export function createDashboardQueryKey(userId: number | undefined, unitIds: number[] | undefined): any[] {
  if (!userId) {
    return ["/api/dashboard/stats", "no-user"];
  }
  
  // Include both userId and a hash of unitIds to catch:
  // 1. Cross-user cache contamination (different userId)
  // 2. Unit reassignment cache stale issues (same userId, different unitIds)
  const unitHash = hashArray(unitIds);
  return ["/api/dashboard/stats", userId, unitHash];
}
