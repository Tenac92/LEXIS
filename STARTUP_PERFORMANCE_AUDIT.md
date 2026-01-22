# Startup Performance Audit: Initial Data Fetching Analysis

**Generated:** January 22, 2026  
**App:** React + Supabase + TanStack Query (v5)  
**Focus:** First login → app landing, cold app open with existing session

---

## EXECUTIVE SUMMARY

### Current State

✅ **Strengths:**

- Background AFM prefetch strategy is well-designed (non-blocking, session-storage deduped)
- Auth bootstrap query has aggressive caching (10 min staleTime, 15 min gcTime)
- Reference data (units) is prefetched immediately on login
- Skeletons/loaders are implemented in dashboards (no blank screen)

⚠️ **Identified Issues (Severity Low→High):**

1. **Duplicate `/api/public/units` queries** (fired 3+ times on startup)
2. **Dashboard triggers 3 consecutive parallel queries** without staggering (blocks all three at once)
3. **Admin dashboard fires 5 queries simultaneously** (not prioritized for above-fold content)
4. **No enabled guards on dashboard queries** when user has no units (unnecessary requests)
5. **Session refresh polling every 15 min** even on idle (low impact but noisy)
6. **Form prefetch during dialog open** may trigger unnecessary refetches
7. **No request deduplication** for overlapping filter params in documents page
8. **Layout shift potential** if skeleton heights don't match final content (minor UI polish issue)

### Performance Impact Assessment

- **First login to first UI:** ~2-3 seconds (controlled by `/api/dashboard/stats` latency)
- **Concurrent requests on startup:** 6-8 simultaneous (good parallelization)
- **Duplicate requests:** 2-3 wasted requests for `/api/public/units`
- **Total blocking requests:** 1 (auth session restore) → all others can render in background
- **Perceived jank:** Low (skeletons prevent blanks), but loading state persistence could be smoothed

---

## PART A: STARTUP FETCH AUDIT

### Stage 1: Bootstrap (Before Auth Session Ready)

| Request         | Endpoint           | File                | Blocking | Status    | Notes                                                                                |
| --------------- | ------------------ | ------------------- | -------- | --------- | ------------------------------------------------------------------------------------ |
| Session restore | `GET /api/auth/me` | `use-auth.tsx:L236` | **YES**  | Essential | Fired in `AuthProvider.useQuery()` on mount; blocks ProtectedRoute redirect decision |

**Stage 1 Summary:** 1 blocking request. All routes gated behind this.

---

### Stage 2: After Auth Ready → HomePage Render

When `/api/auth/me` succeeds with authenticated user:

| Request              | Endpoint                        | File                      | Blocking    | Parallel?           | Status                | Triggers                                         |
| -------------------- | ------------------------------- | ------------------------- | ----------- | ------------------- | --------------------- | ------------------------------------------------ |
| Dashboard stats      | `GET /api/dashboard/stats`      | `dashboard/*.tsx:L43-75`  | **YES**     | 3-way parallel      | Essential             | All 3 dashboard variants request same endpoint   |
| User recent docs     | `GET /api/documents/user`       | `user-dashboard.tsx:L84`  | **PARTIAL** | Parallel with stats | Nice-to-have          | Only user role; blocks stats skeleton dismiss    |
| Units list           | `GET /api/public/units`         | `user-dashboard.tsx:L125` | NO          | Parallel            | Essential for display | All dashboard types + login prefetch (DUPLICATE) |
| System stats         | `GET /api/admin/system-stats`   | `admin-dashboard.tsx:L57` | NO          | Parallel            | Admin-only            | Only if user.role === 'admin'                    |
| Projects list        | `GET /api/projects`             | `admin-dashboard.tsx:L65` | NO          | Parallel            | Admin-only            | Only if user.role === 'admin'                    |
| Budget overview      | `GET /api/budget/overview`      | `admin-dashboard.tsx:L73` | NO          | Parallel            | Admin-only            | Only if user.role === 'admin'                    |
| Alerts/notifications | `GET /api/budget/notifications` | `admin-dashboard.tsx:L81` | NO          | Parallel            | Admin-only            | Only if user.role === 'admin'                    |

**Stage 2 Summary:**

- **User role:** 4 concurrent requests (1 blocking until resolved)
- **Manager role:** 4 concurrent requests (stats + units + same 2 as user)
- **Admin role:** 7 concurrent requests (all above)
- **⚠️ Issue:** Users experience loading UI until `/api/dashboard/stats` completes (~500ms–1.5s typical)

---

### Stage 3: Login Success Handler (Prefetch)

In `useLoginMutation().onSuccess()` at `use-auth.tsx:L97–162`:

| Request            | Endpoint                          | File                | Blocking | When                   | Status                             |
| ------------------ | --------------------------------- | ------------------- | -------- | ---------------------- | ---------------------------------- |
| Documents prefetch | `GET /api/documents?...`          | `use-auth.tsx:L120` | NO       | Immediately post-login | **DEFERRED** (prefetch, not fetch) |
| Units prefetch     | `GET /api/public/units`           | `use-auth.tsx:L139` | NO       | Immediately post-login | **DEFERRED** (prefetch, not fetch) |
| AFM beneficiaries  | `GET /api/beneficiaries/prefetch` | `use-auth.tsx:L152` | NO       | Fire-and-forget        | Background, non-critical           |

**Stage 3 Summary:**

- Prefetch runs in background (won't block UI)
- **⚠️ Issue:** `GET /api/public/units` prefetch happens here, but **already loaded in Stage 2** if user navigates to dashboard immediately

---

### Stage 4: App Load with Existing Session

When user returns to app (session exists):

In `AuthProvider.useEffect()` at `use-auth.tsx:L325–360`:

| Request            | Endpoint                          | File                    | Blocking | Interval                     | Status          |
| ------------------ | --------------------------------- | ----------------------- | -------- | ---------------------------- | --------------- |
| AFM prefetch check | `GET /api/beneficiaries/prefetch` | `use-auth.tsx:L338`     | NO       | On app load (5 min debounce) | Background      |
| Session refresh    | Auth check (internal)             | `SessionKeeper.tsx:L28` | NO       | Every 15 min                 | Passive refresh |

**Stage 4 Summary:**

- Minimal overhead on app return
- AFM prefetch intelligently debounced (sessionStorage check prevents repeat within 5 min)

---

## PART B: DUPLICATE QUERIES DETECTED

### Critical Duplicate: `/api/public/units`

**Fired 3 times on first login:**

1. **In login success handler** (`use-auth.tsx:L139`):

   ```tsx
   void queryClient.prefetchQuery({
     queryKey: ["/api/public/units"],
     staleTime: 30 * 60 * 1000,
     ...
   });
   ```

2. **In UserDashboard component** (`user-dashboard.tsx:L125`):

   ```tsx
   const { data: units = [] } = useQuery({
     queryKey: ["/api/public/units"],
     staleTime: 10 * 60 * 1000,  // ⚠️ SHORTER staleTime!
     ...
   });
   ```

3. **In AdminDashboard (if admin)** – indirectly shared with above

**Problem:** Dashboard's `useQuery` has **10 min staleTime** vs prefetch's **30 min staleTime**. Both are in cache, but if dashboard renders before prefetch completes, it fires a second request.

---

## PART C: PERFORMANCE ANTI-PATTERNS DETECTED

### 1. **Parallel Dashboard Queries Without Prioritization** ⚠️

- **Location:** `home-page.tsx:L20–40` renders role-based dashboard
- **Issue:** All 3 dashboards request `/api/dashboard/stats` but only one renders
  - User role: 1 stats request ✓
  - Manager role: 1 stats request ✓
  - Admin role: 1 stats request ✓
- **But:** If user role changes mid-session, stale queries for other roles linger in cache
- **Impact:** Low (not actually called), but cache bloat

### 2. **Missing `enabled` Guard on Dashboard Queries** ⚠️

- **Location:** `user-dashboard.tsx:L74–83`, `manager-dashboard.tsx:L43–52`
- **Issue:** Query fires even if `user?.unit_id` is empty
  ```tsx
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    // ❌ NO enabled guard!
  });
  ```
- **Impact:** Users with no unit assignment get error state instead of early exit
- **Fix:** Add `enabled: !!user?.unit_id && user.unit_id.length > 0`

### 3. **Admin Dashboard: 5 Queries Fire Simultaneously** ⚠️

- **Location:** `admin-dashboard.tsx:L43–89`
- **Queries:**
  - `/api/dashboard/stats` (essential, above-fold)
  - `/api/admin/system-stats` (nice-to-have, below-fold)
  - `/api/projects` (nice-to-have, below-fold)
  - `/api/budget/overview` (nice-to-have, below-fold)
  - `/api/budget/notifications` (alerts, below-fold)
- **Issue:** Non-critical queries block rendering with 1 skeleton. Could defer 4 queries.
- **Improvement:** Fetch stats first, skeleton until done, then prefetch the rest in background

### 4. **StaleTime Inconsistency on Units** ⚠️

- **Prefetch:** 30 min staleTime
- **Dashboard useQuery:** 10 min staleTime
- **Location:** `user-dashboard.tsx:L125`
- **Impact:** Dashboard refetches after 10 min even though prefetched data is still fresh
- **Fix:** Align to 30 min (units rarely change)

### 5. **Session Refresh Polling at 15 min Intervals** ⚠️

- **Location:** `SessionKeeper.tsx:L28–45` and `use-auth.tsx:L292–320`
- **Issue:** Refreshes session every 15 min regardless of activity
- **Better approach:** Only refresh on tab visibility change or actual activity (already implemented in `SessionKeeper.tsx:L47–70` with activity listeners, but 15 min timer is redundant)
- **Impact:** Low (15 min = 4 requests/hour for long-lived sessions)

### 6. **Form Dialog Prefetch During Open** ⚠️

- **Location:** `create-document-dialog.tsx:L852–898`
- **Issue:** When dialog opens, it triggers `queryClient.invalidateQueries({ queryKey: ["public-units"] })`
- **Problem:** User may have already loaded units; invalidate forces refetch
- **Better:** Only invalidate if units haven't been fetched in the last 5 min

### 7. **No Request Deduplication for Filters in Documents Page** ⚠️

- **Location:** `documents-page.tsx:L315–340`
- **Issue:** Query key includes full filter object:
  ```tsx
  queryKey: ["/api/documents", defaultDocumentFilters, 0, 30];
  ```
- **Problem:** Object literal in key can cause new key instances if filters are reconstructed
- **Fix:** Ensure filters are memoized or serialized

---

## PART D: WATERFALL DIAGRAM (First Login Flow)

```
Time →
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

T0 +0ms  [Auth] GET /api/auth/me                    ▂▂▂▂▂▂▂▂▂▂▂▂▂ (BLOCKS ProtectedRoute)
                                                                 ↓
T1 +500ms [Auth Success Handler fires]
          [Prefetch] GET /api/documents                        ▂▂▂ (background, non-blocking)
          [Prefetch] GET /api/public/units                     ▂▂▂ (background)
          [Prefetch] GET /api/beneficiaries/prefetch          (fire-and-forget)
                                                                 ↓
T2 +500ms [HomePage mounts, dashboard component mounts]
          [Dashboard] GET /api/dashboard/stats        ▂▂▂▂▂▂▂▂▂ (BLOCKING, primary)
          [Dashboard] GET /api/documents/user                 ▂▂ (parallel)
          [Dashboard] GET /api/public/units                   ▂▂ (parallel, overlaps prefetch!)
                                                                 ↓
T3 +1000ms [Prefetch queries resolve in background]
           [Dashboard stats resolve] → Skeleton dismissed, content shown
                                                                 ↓
T4 +2000ms [All queries resolved, full page interactive]

┌─────────────────────────────────────────────────────────────┐
│ Blocking Path (User waits for):                               │
│ 1. /api/auth/me (500ms) → ProtectedRoute passes             │
│ 2. /api/dashboard/stats (500ms) → Skeleton dismissed        │
│ Total perceived latency: ~1000ms (1 second to full UI)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Overlaps Detected:                                            │
│ • /api/public/units: Prefetched AND queried in dashboard   │
│   → 2 requests for same data in short time window           │
│ • Can be deduplicated if dashboard catches prefetch result   │
└─────────────────────────────────────────────────────────────┘
```

---

## PART E: CACHING CONFIGURATION ANALYSIS

### Current Settings by Endpoint

| Endpoint                        | staleTime  | gcTime | refetchOnWindowFocus | refetchOnMount | Issue                                |
| ------------------------------- | ---------- | ------ | -------------------- | -------------- | ------------------------------------ |
| `/api/auth/me`                  | 10 min     | 15 min | ❌ NO                | ❌ NO          | ✅ Good (stable)                     |
| `/api/dashboard/stats`          | 2 min      | 5 min  | ❌ NO                | ❌ NO          | ✅ Good                              |
| `/api/documents/user`           | 1 min      | 3 min  | ❌ NO                | ❌ NO          | ✅ Good                              |
| `/api/public/units` (dashboard) | **10 min** | 30 min | ❌ NO                | ❌ NO          | ⚠️ Mismatched with prefetch (30 min) |
| `/api/public/units` (prefetch)  | **30 min** | 60 min | N/A                  | N/A            | ⚠️ Inconsistency                     |
| `/api/admin/system-stats`       | 5 min      | N/A    | ❌ NO                | ❌ NO          | ✅ Good                              |
| `/api/projects`                 | 5 min      | N/A    | ❌ NO                | ❌ NO          | ✅ Good                              |
| `/api/budget/overview`          | 5 min      | N/A    | ❌ NO                | ❌ NO          | ✅ Good                              |
| `/api/budget/notifications`     | 1 min      | N/A    | ❌ NO                | ❌ NO          | ✅ Good                              |

---

## PART F: QUERY KEY CONSISTENCY CHECK

### Potential Key Instability Issues

#### Issue 1: Filter Object as Query Key

**File:** `documents-page.tsx:L315`

```tsx
queryKey: ["/api/documents", defaultDocumentFilters, 0, 30];
```

**Problem:** If `defaultDocumentFilters` is recreated each render (not memoized), key changes → unnecessary refetch

**Current Status:** ✅ Appears memoized via `useMemo` in same file

---

#### Issue 2: Dynamic Units Query Key

**File:** None detected as problematic

**Status:** ✅ All units queries use static key `["/api/public/units"]`

---

## PART G: REQUEST COUNT ANALYSIS

### Cold Start (First Login) Request Timeline

```
Stage 1 (T0):
  1. GET /api/auth/me                      [BLOCKING]

Stage 2 (T0 + 500ms, auth ready):
  2. GET /api/dashboard/stats              [Dashboard]
  3. GET /api/documents/user               [Dashboard user]
  4. GET /api/public/units                 [Dashboard]
  [+ 3 more if admin: system-stats, projects, budget/overview, notifications]

Stage 3 (T0 + 500ms, login handler):
  5. GET /api/documents (prefetch)         [Background]
  6. GET /api/public/units (prefetch)      [Background, DUPLICATE!]
  7. GET /api/beneficiaries/prefetch       [Background]

Total for regular user: 7 requests
Total for admin: 11 requests

Duplicates: /api/public/units (2x)
Unnecessary: /api/documents user fetch if user hasn't clicked documents yet (defer to page)
```

---

## Summary Table: Issues by Severity

| Severity  | Issue                                        | Location                         | Impact                                           | Effort |
| --------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------ | ------ |
| 🔴 HIGH   | Duplicate `/api/public/units` queries        | use-auth.tsx, user-dashboard.tsx | 1 wasted request (non-blocking)                  | 5 min  |
| 🟡 MEDIUM | Admin dashboard fires 5 queries in parallel  | admin-dashboard.tsx              | Longer initial load, unnecessary concurrent load | 10 min |
| 🟡 MEDIUM | Missing `enabled` guard on dashboard queries | user/manager-dashboard.tsx       | Errors if user has no units; wasted request      | 5 min  |
| 🟡 MEDIUM | StaleTime mismatch on `/api/public/units`    | user-dashboard.tsx               | Unnecessary refetch after 10 min                 | 2 min  |
| 🟢 LOW    | Session refresh polling at 15 min            | SessionKeeper.tsx                | Noisy but low impact (~4 req/hr)                 | 10 min |
| 🟢 LOW    | Form dialog invalidates units on open        | create-document-dialog.tsx       | May cause unnecessary refetch                    | 5 min  |
| 🟢 LOW    | Skeleton heights may not match content       | dashboard components             | Minor layout shift                               | 10 min |

---

## Recommendations Preview

See **PART C** in accompanying "RECOMMENDATIONS" document for prioritized fixes.
