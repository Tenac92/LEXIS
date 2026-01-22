# Startup Performance Optimization: Verification & Testing Checklist

**Last Updated:** January 22, 2026  
**Changes Deployed:** P0.1, P0.2, P1.1, P1.2  
**Testing Scope:** First login, app reload, multi-user scenarios

---

## PHASE 1: Pre-Deployment Checklist (Before Staging/Prod)

### Code Review

- [ ] All 4 modified files compile without errors
  ```bash
  npm run build
  # Should complete with no TypeScript errors
  ```
- [ ] No import warnings
  ```bash
  # Check ESLint
  npm run lint -- client/src/hooks/use-auth.tsx
  npm run lint -- client/src/components/dashboard/
  ```
- [ ] Git diffs reviewed (no unexpected changes)
  ```bash
  git diff client/src/hooks/use-auth.tsx
  git diff client/src/components/dashboard/
  ```

### Unit Test Verification (if applicable)

- [ ] Any existing tests for auth flow still pass
- [ ] Any existing tests for dashboard queries still pass

---

## PHASE 2: Local Development Verification (Dev Environment)

### A. Network Request Audit

**Test Case 1: First Login**

1. Open app in incognito/private window (fresh session)
2. Open **DevTools → Network** tab
3. Clear network log
4. Log in with valid credentials
5. Wait for homepage to fully load

**Expectations:**

- [ ] Total requests: ≤7 for user role (was 7, should stay 7 but cleaner)
- [ ] Total requests: ≤9 for admin role (was 11, should be ~9)
- [ ] **Critical:** `/api/public/units` appears **exactly 1 time** in Network (not 2)
- [ ] `/api/dashboard/stats` completes before secondary admin queries
- [ ] No duplicate query keys in same request sequence

**Pass/Fail:** **\_** (PASS = all bullets met)

---

**Test Case 2: App Reload with Existing Session**

1. Log in (from Test Case 1)
2. Stay on home page for 30 seconds
3. Press **F5** or **Cmd+Shift+R** (hard refresh)
4. Open DevTools → Network tab
5. Wait for page to fully load again

**Expectations:**

- [ ] `/api/auth/me` request fires first (session restore)
- [ ] Dashboard queries fire after auth succeeds
- [ ] No `/api/public/units` duplicate (should hit cache from before refresh)
- [ ] Time-to-interactive < 1.5 seconds (measure in Performance tab)

**Measurement:** TTI = **\_** ms

**Pass/Fail:** **\_** (PASS = <1500ms)

---

### B. Caching Verification

**Test Case 3: Units StaleTime Alignment**

1. Log in fresh (Test Case 1)
2. Navigate to Documents page (`/documents`)
3. Return to Home (`/`)
4. Open Network tab, clear log
5. Wait 11 minutes (or mock time advance if available)
6. Click a button that doesn't need units (e.g., refresh stats)
7. Check Network tab for `/api/public/units` request

**Expectations:**

- [ ] **After 10 min:** No `/api/public/units` refetch (was 10 min staleTime, now 30 min)
- [ ] **After 30 min:** `/api/public/units` refetches (new 30 min staleTime)
- [ ] Cache status in DevTools shows "from cache" for first 30 min

**Duration tested:** **\_** min

**Pass/Fail:** **\_** (PASS = no refetch until 30+ min)

---

### C. Enabled Guards Verification

**Test Case 4: User with No Assigned Units**

1. Create a test user with **empty unit_id array** (or use existing user with no units)
2. Log in as that user
3. Open DevTools → Console & Network tabs
4. Observe homepage loading

**Expectations:**

- [ ] No 403/500 errors in Network for `/api/dashboard/stats`
- [ ] No JavaScript errors in Console
- [ ] Page loads without spinners (either shows fallback UI or skips stats section)
- [ ] `enabled` guards prevented unnecessary requests

**Errors encountered:** **\_** (should be "None")

**Pass/Fail:** **\_** (PASS = no errors, graceful fallback)

---

**Test Case 5: User with Assigned Units**

1. Log in as user with units assigned
2. Verify Test Case 1 & 2 still work correctly
3. Ensure all dashboard stats/data load as before

**Pass/Fail:** **\_** (PASS = data loads, no regression)

---

### D. Admin Dashboard Prioritization Verification

**Test Case 6: Admin Dashboard Query Timing**

1. Log in as admin user
2. Open **DevTools → Network** tab (sort by "Initiator" to see request order)
3. Clear log
4. Navigate to home page (or refresh if already there)
5. Observe request waterfall

**Expectations:**

- [ ] `/api/dashboard/stats` is the **first query** to initiate
- [ ] Secondary queries (`system-stats`, `projects`, `budget/overview`, `notifications`) fire **after** stats starts
- [ ] Admin dashboard renders with stats skeleton visible before secondary data loads
- [ ] Secondary data appears progressively (not all at once)

**Request order observed:**

1. **\_** (should be `dashboard/stats`)
2. **\_** (secondary query)
3. **\_** (secondary query)

**Pass/Fail:** **\_** (PASS = stats first, others after)

---

### E. UI/UX Verification

**Test Case 7: Smooth Visual Experience**

1. Log in (Test Case 1)
2. Observe homepage rendering in slow-mo (use DevTools throttle: "Slow 3G")
3. Watch for layout shifts or spinner flicker

**Expectations:**

- [ ] Dashboard skeleton loads immediately (no blank white screen)
- [ ] Skeleton dismisses smoothly when content arrives
- [ ] No visible layout shift when stats data populates
- [ ] No duplicate spinners or flicker

**Visual issues encountered:** **\_** (should be "None")

**Pass/Fail:** **\_** (PASS = smooth rendering)

---

## PHASE 3: Staging Environment (Pre-Production Test)

### A. Load Testing

**Test Case 8: Concurrent User Logins**

1. Use load testing tool (e.g., k6, JMeter) or manual test with multiple tabs
2. Open 5 tabs in private windows
3. Log in to all 5 simultaneously (staggered by 1–2 seconds)
4. Monitor server logs for `/api/public/units` requests
5. Observe client Network tabs

**Expectations:**

- [ ] **Client-side:** Each user sees only 1 units request (not duplicated)
- [ ] **Server-side:** Server receives 5 units requests (one per user) — no client-side dupes sent
- [ ] No 502/503 errors (server not overwhelmed)
- [ ] All 5 users load successfully within 3 seconds

**Concurrent users tested:** 5  
**All logins successful?** **\_** (Yes/No)

**Pass/Fail:** **\_** (PASS = no errors, all login <3s)

---

### B. Real User Monitoring (RUM)

**Test Case 9: Measure Real Performance Improvements**

1. Deploy to staging
2. Wait for 10–20 real user sessions (or simulate with tools)
3. Collect metrics:
   - Time to Interactive (TTI)
   - First Contentful Paint (FCP)
   - API request count (first 5 min of session)
   - Cache hit rate

**Before (baseline from previous metrics):**

- TTI: **\_** ms
- Request count: **\_**
- Cache hits: **\_** %

**After (from staging):**

- TTI: **\_** ms
- Request count: **\_**
- Cache hits: **\_** %

**Improvement:**

- TTI improvement: **\_** % (target: 10–20%)
- Request reduction: **\_** % (target: 10–15%)

**Pass/Fail:** **\_** (PASS = improvements match projections)

---

## PHASE 4: Production Deployment & Monitoring

### A. Canary Deployment (First 10% of Traffic)

**Test Case 10: Canary Metrics**

1. Deploy to 10% of production users
2. Monitor for 30 minutes
3. Check error rates, performance metrics

**Expectations:**

- [ ] No increase in 5xx errors
- [ ] No increase in client-side JavaScript errors
- [ ] TTI metrics stable or improved vs. baseline
- [ ] No spike in API error rates

**Error rate:** **\_** % (target: <0.5%)  
**JS errors:** **\_** per 1000 sessions (target: <2)

**Pass/Fail:** **\_** (PASS = proceed to 100%)

---

### B. Full Rollout Monitoring

**Test Case 11: Post-Deployment Metrics (24 Hours)**

1. Deploy to 100% of production users
2. Monitor metrics continuously
3. Compare to baseline

**Metrics to Track:**

| Metric                        | Target | Actual | Status |
| ----------------------------- | ------ | ------ | ------ |
| TTI (median)                  | <1.2s  | **\_** | ✓/✗    |
| TTI (95th percentile)         | <2.0s  | **\_** | ✓/✗    |
| API requests (first 5 min)    | 6–7    | **\_** | ✓/✗    |
| Duplicate `/api/public/units` | 0      | **\_** | ✓/✗    |
| 5xx error rate                | <0.1%  | **\_** | ✓/✗    |
| Cache hit rate (units)        | >90%   | **\_** | ✓/✗    |

**Overall Status:** PASS / NEEDS ROLLBACK

---

### C. User-Reported Feedback

**Test Case 12: User Experience Feedback (24–48 Hours)**

1. Monitor support tickets, feedback channels
2. Look for:
   - "App loads slow" → should decrease
   - "Spinners keep appearing" → should decrease
   - New complaints about auth/cache issues → should be 0

**Feedback summary:**

- Positive feedback (app faster): **\_** mentions
- Negative feedback (regressions): **\_** mentions

**Pass/Fail:** **\_** (PASS = more positive than before)

---

## PHASE 5: Rollback Plan (If Issues Arise)

### Quick Rollback (< 5 minutes)

**If Critical Issues Found:**

**Symptom:** Users unable to log in / 403 errors on dashboard queries

**Rollback Steps:**

1. Revert commits for P1.2 (admin query prioritization)
   ```bash
   git revert <commit-hash-admin-dashboard>
   ```
2. Redeploy
3. Verify `/api/dashboard/stats` is again fetched simultaneously with secondary queries

**Expected outcome:** All queries fetch in parallel (slower on first load, but more reliable)

---

**Symptom:** `/api/public/units` requests doubled (dedup not working)

**Rollback Steps:**

1. Revert P0.1 change (units fetchQuery)
   ```bash
   # In use-auth.tsx, change back to prefetchQuery
   git revert <commit-hash-auth>
   ```
2. Redeploy
3. Verify units prefetch works as before

**Expected outcome:** Back to 1–2 units requests (acceptable baseline)

---

**Symptom:** High error rate on admin dashboard

**Rollback Steps:**

1. Disable admin query prioritization by removing `enabled: !!stats` guards
2. Revert to simpler query structure
3. Redeploy

**Expected outcome:** Admin dashboard loads with previous structure

---

## Post-Verification Checklist (Sign-Off)

After all phases complete, final sign-off:

- [ ] **Functional:** All dashboards load correctly across all roles (user, manager, admin)
- [ ] **Performance:** TTI improved by 10–20% vs. baseline
- [ ] **Requests:** Duplicate queries eliminated (units now 1x, not 2x)
- [ ] **Caching:** Units staleTime aligned to 30 min across all uses
- [ ] **Error handling:** Users with no units don't see 403 errors
- [ ] **No regressions:** All existing features work as before
- [ ] **Monitoring:** Metrics dashboard configured to track TTI, request count, cache hits
- [ ] **Documentation:** Changes documented for future maintenance

**Sign-off Date:** **\_**  
**Signed by:** **\_** (developer)  
**Reviewed by:** **\_** (team lead)

---

## Appendix: Performance Profiling Commands

### Chrome DevTools Lighthouse

```
1. Open app in Chrome
2. DevTools → Lighthouse
3. Run audit for "Performance"
4. Compare "Time to Interactive" before/after changes
5. Target: >85 performance score
```

### Network Request Waterfall

```
1. DevTools → Network
2. Disable cache: Check "Disable cache" in DevTools
3. Log in
4. Filter by XHR/Fetch
5. Right-click → "Copy as HAR"
6. Paste into file for analysis
7. Count total requests, identify duplicates
```

### React Query DevTools

```
1. Open app in development mode
2. Ctrl+Shift+Q (or Cmd+Shift+Q on Mac)
3. Go to "Queries" tab
4. Sort by "Cache Time"
5. Verify units query has 30 min staleTime
6. Verify no duplicate query keys
```

### Server-Side Logging

```bash
# Check server logs for duplicate units requests
grep "GET /api/public/units" server.log | wc -l
# Should be: 1 per user per session (not 2)
```

---

## Notes for QA/Testing Team

- Test with real network conditions (not just localhost): Use DevTools throttle "Slow 3G" or "Fast 3G"
- Test with different user roles: regular user, manager, admin
- Test with different unit assignments: 0 units, 1 unit, multiple units
- Test both fresh login and app reload scenarios
- Test browser tab visibility changes (minimize/restore window)
- Test with multiple tabs open (concurrent requests)

---
