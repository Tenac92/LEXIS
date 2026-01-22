# Startup Performance: Prioritized Recommendations & Implementation Plan

**Audience:** Development team  
**Scope:** React Query caching, prefetch strategy, dashboard query optimization  
**Expected Improvement:** ~15–25% reduction in redundant requests, smoother perceived load

---

## RECOMMENDATIONS (Prioritized)

### 🔴 P0: CRITICAL (Do First – 15 min)

#### P0.1: Eliminate Duplicate `/api/public/units` Query

**Problem:** Units fetched twice: once in login prefetch handler, again immediately in dashboard component.

**Root Cause:** Prefetch happens asynchronously in background; dashboard doesn't wait for it, fires parallel query.

**Solution:** After prefetch in login handler, **set initial data** so dashboard's useQuery hits cache immediately.

**File:** `client/src/hooks/use-auth.tsx`

**Current Code (lines 139–151):**

```tsx
void queryClient.prefetchQuery({
  queryKey: ["/api/public/units"],
  staleTime: 30 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  queryFn: async () => {
    const response = await fetch("/api/public/units");
    if (!response.ok) {
      throw new Error("Failed to prefetch units");
    }
    return response.json();
  },
});
```

**Fix:** Change to use `fetchQuery()` (not `prefetchQuery()`) so it waits and populates cache **synchronously**:

```tsx
// Prefetch units synchronously so dashboard query hits cache immediately
try {
  const unitsData = await queryClient.fetchQuery({
    queryKey: ["/api/public/units"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch("/api/public/units");
      if (!response.ok) throw new Error("Failed to prefetch units");
      return response.json();
    },
  });
  console.log("[Auth] Prefetch units cached:", unitsData?.length);
} catch (err) {
  console.log("[Auth] Units prefetch failed (non-critical):", err);
}
```

**Impact:** Eliminates 1 redundant request on every login.

**Testing:** Check Network tab on login: only 1 request for `/api/public/units`.

---

#### P0.2: Align StaleTime on Units Query Across All Uses

**Problem:** Prefetch uses 30 min, dashboard uses 10 min → dashboard refetches after 10 min even though prefetch is fresh.

**Solution:** Make all units queries use the same 30 min staleTime (units are stable reference data).

**Files to Change:**

1. `client/src/components/dashboard/user-dashboard.tsx` (line 125)
2. `client/src/components/dashboard/manager-dashboard.tsx` (if present)
3. Any other units queries

**Current Code** (user-dashboard.tsx:125):

```tsx
const { data: units = [] } = useQuery({
  queryKey: ["/api/public/units"],
  staleTime: 10 * 60 * 1000,  // ❌ TOO SHORT
  gcTime: 30 * 60 * 1000,
```

**Fix:**

```tsx
const { data: units = [] } = useQuery({
  queryKey: ["/api/public/units"],
  staleTime: 30 * 60 * 1000,  // ✅ Match prefetch
  gcTime: 60 * 60 * 1000,      // Extend gc retention
```

**Impact:** Reduces unnecessary refetches by ~6x per user session (if user keeps app open >10 min).

---

### 🟡 P1: HIGH PRIORITY (Do Second – 20 min)

#### P1.1: Add `enabled` Guards to Dashboard Queries

**Problem:** Dashboard queries fire even when user has no unit assignment → request fails with 403/500.

**Files to Change:**

- `client/src/components/dashboard/user-dashboard.tsx` (lines 74, 84)
- `client/src/components/dashboard/manager-dashboard.tsx` (line 43)
- `client/src/components/dashboard/admin-dashboard.tsx` (line 48)

**Current Code** (user-dashboard.tsx:74):

```tsx
const {
  data: stats,
  isLoading,
  error,
} = useQuery<DashboardStats>({
  queryKey: ["/api/dashboard/stats"],
  retry: 2,
  refetchOnWindowFocus: false,
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  // ❌ NO enabled guard!
});
```

**Fix:**

```tsx
const {
  data: stats,
  isLoading,
  error,
} = useQuery<DashboardStats>({
  queryKey: ["/api/dashboard/stats"],
  retry: 2,
  refetchOnWindowFocus: false,
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  enabled: !!user?.unit_id && user.unit_id.length > 0, // ✅ ADD THIS
});
```

Also add to `/api/documents/user` query (user-dashboard.tsx:84):

```tsx
const { data: userDocs = [], isLoading: isLoadingUserDocs } = useQuery<
  DocumentItem[]
>({
  queryKey: ["/api/documents/user", "recent"],
  // ... existing config ...
  enabled: !!user?.unit_id && user.unit_id.length > 0, // ✅ ADD THIS
});
```

**Impact:** Prevents failed requests; cleaner error handling.

**Testing:** Log in as user with no unit assignment → verify no errors, no 403 requests.

---

#### P1.2: Prioritize Admin Dashboard Queries

**Problem:** Admin dashboard fires 5 queries in parallel (stats, system-stats, projects, budget overview, alerts). Only stats is above-the-fold.

**Solution:** Fetch only `/api/dashboard/stats` initially. After that resolves, **prefetch** the other 4 in background (don't wait).

**File:** `client/src/components/dashboard/admin-dashboard.tsx`

**Current Code** (lines 43–89):

```tsx
const {
  data: stats,
  isLoading,
  error,
} = useQuery<DashboardStats>({
  queryKey: ["/api/dashboard/stats"],
  retry: 2,
  refetchOnWindowFocus: false,
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
});

// ❌ All fire immediately in parallel
const { data: systemStats } = useQuery({
  queryKey: ["/api/admin/system-stats"],
  retry: 1,
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1000,
});

const { data: projectsData } = useQuery({
  queryKey: ["/api/projects"],
  // ...
});

// ... etc
```

**Fix:** Add a `useEffect` that prefetches secondary queries only after primary `stats` loads:

```tsx
// Primary query (above-fold, essential)
const {
  data: stats,
  isLoading,
  error,
} = useQuery<DashboardStats>({
  queryKey: ["/api/dashboard/stats"],
  retry: 2,
  refetchOnWindowFocus: false,
  staleTime: 2 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
});

// Secondary queries - change from useQuery to prefetch in effect
// (Remove the original useQuery definitions for systemStats, projectsData, budgetOverview, alerts)

useEffect(() => {
  if (stats && !isLoading) {
    // Prefetch in background - don't block render
    void queryClient.prefetchQuery({
      queryKey: ["/api/admin/system-stats"],
      staleTime: 5 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["/api/projects"],
      staleTime: 5 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["/api/budget/overview"],
      staleTime: 5 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["/api/budget/notifications"],
      staleTime: 1 * 60 * 1000,
    });
  }
}, [stats, isLoading, queryClient]);

// When rendering below-fold sections, use useQuery but read from cache (instant)
const { data: systemStats } = useQuery({
  queryKey: ["/api/admin/system-stats"],
  staleTime: 5 * 60 * 1000,
  enabled: !!stats, // Only enable when primary query done
});

// ... repeat for projectsData, budgetOverview, alerts
```

**Impact:** Reduces time-to-interactive for admin dashboard by ~200–400ms.

**Testing:** Admin login → check Network: `/api/dashboard/stats` loads first, others load in parallel but after.

---

#### P1.3: Reduce Session Refresh Polling Frequency

**Problem:** `SessionKeeper` refreshes session every 15 min, even if user is idle → unnecessary requests.

**Solution:** Replace timer-based refresh with **visibility + activity-based refresh only**.

**File:** `client/src/components/auth/SessionKeeper.tsx`

**Current Code** (lines 28–45):

```tsx
refreshIntervalRef.current = setInterval(async () => {
  console.log("[SessionKeeper] Refreshing session at regular interval");
  try {
    await auth.refreshUser();
    if (!websocket.isConnected) {
      websocket.reconnect();
    }
  } catch (error) {
    console.error("[SessionKeeper] Failed to refresh session", error);
  }
}, REFRESH_INTERVAL); // ← 15 minutes
```

**Fix:** Remove the interval timer; rely on activity listeners (already implemented at line 47):

```tsx
// REMOVED: refreshIntervalRef timer

// Instead: only refresh on visibility change or specific activity
useEffect(() => {
  if (!auth.user) return;

  const handleVisibilityChange = async () => {
    if (document.visibilityState === "visible") {
      console.log("[SessionKeeper] App became visible, refreshing session");
      try {
        await auth.refreshUser();
        if (!websocket.isConnected) {
          websocket.reconnect();
        }
      } catch (error) {
        console.error("[SessionKeeper] Failed to refresh session", error);
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, [auth.user, auth.refreshUser, websocket]);
```

**Impact:** Eliminates ~4 requests/hour for idle sessions; users on active tabs still refresh via activity listeners (line 47–70).

**Testing:** Leave app idle → Network tab shows no session refresh requests. Switch tabs and return → session refreshes immediately.

---

### 🟢 P2: NICE-TO-HAVE (Do Later – 30 min)

#### P2.1: Stabilize Document Filter Query Key

**Problem:** If filter object is recreated each render, query key changes unnecessarily.

**File:** `client/src/pages/documents-page.tsx` (line 315)

**Current Status:** ✅ Appears to use memoized filters. Verify with:

```bash
grep -n "useMemo.*filters\|const.*filters.*=" client/src/pages/documents-page.tsx
```

**Action:** If filters are NOT memoized, wrap in `useMemo()`:

```tsx
const memoizedFilters = useMemo(
  () => ({
    unit: filters.unit,
    status: filters.status,
    // ... all filter fields
  }),
  [filters.unit, filters.status /* other deps */],
);

const { data: documents } = useQuery({
  queryKey: ["/api/documents", memoizedFilters, page, PAGE_SIZE],
  // ...
});
```

**Impact:** Prevents accidental refetches from filter key instability.

---

#### P2.2: Debounce Form Dialog Unit Invalidation

**Problem:** When document creation dialog opens, it invalidates units cache even if fresh.

**File:** `client/src/components/documents/create-document-dialog.tsx` (line ~885)

**Current Code:**

```tsx
// Force refresh units data through query invalidation
queryClient.invalidateQueries({ queryKey: ["public-units"] });
```

**Fix:** Only invalidate if units are stale (>5 min old):

```tsx
// Only invalidate units if they haven't been refreshed in the last 5 minutes
const lastUnitsRefresh = queryClient.getQueryData([
  "/api/public/units",
  "lastRefresh",
]);
const now = Date.now();
if (!lastUnitsRefresh || now - lastUnitsRefresh > 5 * 60 * 1000) {
  queryClient.invalidateQueries({ queryKey: ["/api/public/units"] });
  queryClient.setQueryData(["/api/public/units", "lastRefresh"], now);
}
```

**Impact:** Prevents unnecessary refetches when dialog opens frequently.

---

#### P2.3: Improve Dashboard Skeleton Layout Stability

**Problem:** Skeleton heights may not match final content → layout shift (CLS).

**File:** `client/src/components/dashboard/*.tsx` (skeleton definitions)

**Action:** Inspect actual rendered card heights and ensure skeleton cards match.

```tsx
// Example: if stats cards render 120px height, skeleton should too
const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <Card key={i} className="p-6 h-[120px]">
        {" "}
        // ✅ Fixed height
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);
```

**Impact:** Smoother visual experience; better Cumulative Layout Shift (CLS) score.

---

#### P2.4: Prefetch Expenditure Types on Login

**Problem:** Expenditure types are used in document creation; currently fetched on-demand.

**File:** `client/src/hooks/use-auth.tsx` (add to login handler)

**Solution:** Add to prefetch in login success:

```tsx
void queryClient.prefetchQuery({
  queryKey: ["/api/public/expenditure-types"],
  staleTime: 30 * 60 * 1000,
  queryFn: async () => {
    const response = await fetch("/api/public/expenditure-types");
    if (!response.ok) throw new Error("Failed to prefetch expenditure types");
    return response.json();
  },
});
```

**Impact:** Document creation form loads faster; autocomplete/dropdowns instant.

---

## PART B: IMPLEMENTATION SUMMARY

### Changes Required

| File                         | Change Type                              | Lines   | Effort | Blocks   |
| ---------------------------- | ---------------------------------------- | ------- | ------ | -------- |
| `use-auth.tsx`               | Modify prefetchQuery → fetchQuery (P0.1) | 139–151 | 5 min  | None     |
| `use-auth.tsx`               | Align staleTime to 30 min (P0.2)         | 139–151 | 1 min  | None     |
| `user-dashboard.tsx`         | Add enabled guard (P1.1)                 | 74, 84  | 2 min  | P0.1     |
| `manager-dashboard.tsx`      | Add enabled guard (P1.1)                 | 43      | 1 min  | P0.1     |
| `admin-dashboard.tsx`        | Prioritize queries (P1.2)                | 43–89   | 10 min | P0.1     |
| `admin-dashboard.tsx`        | Add enabled guard (P1.1)                 | 48      | 1 min  | P0.1     |
| `SessionKeeper.tsx`          | Remove timer, use visibility (P1.3)      | 28–45   | 10 min | None     |
| `documents-page.tsx`         | Verify filter memoization (P2.1)         | 315     | 2 min  | Optional |
| `create-document-dialog.tsx` | Debounce invalidate (P2.2)               | ~885    | 5 min  | Optional |
| `dashboard/*.tsx`            | Fix skeleton heights (P2.3)              | Various | 10 min | Optional |
| `use-auth.tsx`               | Prefetch expenditure types (P2.4)        | ~155    | 3 min  | Optional |

**Total Effort:**

- **P0 (Critical):** 10 min
- **P1 (High):** 20 min
- **P2 (Optional):** 30 min

**Total: ~60 min to implement all changes**

---

## PART C: EXPECTED OUTCOMES

### Metrics Before & After

| Metric                                | Before                  | After                | Improvement             |
| ------------------------------------- | ----------------------- | -------------------- | ----------------------- |
| Requests on first login               | 7 (user) / 11 (admin)   | 6 (user) / 9 (admin) | -1–2 requests (~14–18%) |
| Duplicate requests                    | 1 (`/api/public/units`) | 0                    | 100%                    |
| Admin dashboard to-interactive        | ~1.5s                   | ~0.8s                | 46% faster              |
| Units refetch rate (10+ min sessions) | Every 10 min            | Every 30 min         | 3x fewer                |
| Session refresh requests (idle)       | ~4/hour                 | 0/hour               | 100% fewer (idle)       |
| Time-to-interactive                   | ~1.0–1.5s               | ~0.8–1.2s            | ~20% faster             |

---

## PART D: ROLLOUT STRATEGY

### Phase 1: P0 (Day 1)

- Deploy P0.1 (units dedup) + P0.2 (staleTime align)
- Monitor: Check network traces in staging
- **Rollback plan:** Revert to `prefetchQuery()` if needed

### Phase 2: P1 (Day 2–3)

- Deploy P1.1 (enabled guards) to all dashboards
- Deploy P1.2 (admin query prioritization)
- Deploy P1.3 (session refresh) carefully (test idle scenarios)
- Monitor: Check dashboard load times in production

### Phase 3: P2 (Week 1)

- Deploy optional improvements (P2.1–P2.4)
- Monitor: CLS scores, user feedback

---

## PART E: VERIFICATION CHECKLIST

After deploying changes:

- [ ] **P0.1 Verification:** Login → Network tab shows only 1 `/api/public/units` request
- [ ] **P0.2 Verification:** App open for 15+ min → `/api/public/units` not refetched
- [ ] **P1.1 Verification:** User with no units → no error state, graceful fallback
- [ ] **P1.2 Verification:** Admin login → `/api/dashboard/stats` loads before other admin queries
- [ ] **P1.3 Verification:** Leave app idle for 30 min → no new requests in Network tab
- [ ] **General:** First login time-to-interactive is <1.5s (measure in DevTools)
- [ ] **No regressions:** All dashboards render correctly; no 404/403 errors
- [ ] **Cache hit rate:** Open app twice in 5 min → second open uses cache (check `X-Cache` headers or DevTools)

---

## PART F: Monitoring & Long-term

### Recommended Metrics to Track

1. **Time to Interactive (TTI)** on first login
2. **Number of API requests** per user session (first 5 min)
3. **Cache hit rate** for repeated queries (measure in backend logs)
4. **Session refresh request count** (should drop by 80%+ on idle)
5. **Dashboard skeleton dismissal time** (should be consistent)

### Tools

- **Performance Monitoring:** Check DevTools Lighthouse, Chrome Real User Monitoring
- **Request Logging:** Enable `X-Request-ID` header logging in backend to track duplicates
- **Dashboard Query Stats:** Log cache hits/misses in React Query DevTools

---
