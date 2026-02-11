interface CachedAFM {
  decryptedAFM: string;
  beneficiaryId: number;
  surname: string;
  name: string;
  fathername: string | null;
  timestamp: number;
}

interface UnitCache {
  beneficiaries: CachedAFM[];
  employees: CachedAFM[];
  timestamp: number;
  loading: boolean;
}

const AFM_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const unitCacheMap = new Map<string, UnitCache>();

export function getUnitCacheKey(unitIds: readonly number[]): string {
  return `unit_${[...unitIds].sort((a, b) => a - b).join('_')}`;
}

export function getCachedAFMData(unitIds: number[]): UnitCache | null {
  const key = getUnitCacheKey(unitIds);
  const cached = unitCacheMap.get(key);
  
  if (cached && Date.now() - cached.timestamp < AFM_CACHE_TTL) {
    console.log(`[AFMCache] HIT for units: ${unitIds.join(', ')} (${cached.beneficiaries.length} beneficiaries, ${cached.employees.length} employees)`);
    return cached;
  }
  
  if (cached && !cached.loading) {
    console.log(`[AFMCache] STALE for units: ${unitIds.join(', ')}, will refresh`);
    unitCacheMap.delete(key);
  }
  
  return null;
}

export function setCachedAFMData(
  unitIds: number[], 
  beneficiaries: CachedAFM[], 
  employees: CachedAFM[]
): void {
  const key = getUnitCacheKey(unitIds);
  unitCacheMap.set(key, {
    beneficiaries,
    employees,
    timestamp: Date.now(),
    loading: false
  });
  console.log(`[AFMCache] SET for units: ${unitIds.join(', ')} (${beneficiaries.length} beneficiaries, ${employees.length} employees)`);
}

export function setLoadingState(unitIds: number[], loading: boolean): void {
  const key = getUnitCacheKey(unitIds);
  const existing = unitCacheMap.get(key);
  
  if (existing) {
    existing.loading = loading;
  } else if (loading) {
    unitCacheMap.set(key, {
      beneficiaries: [],
      employees: [],
      timestamp: Date.now(),
      loading: true
    });
  }
}

export function isLoading(unitIds: number[]): boolean {
  const key = getUnitCacheKey(unitIds);
  const cached = unitCacheMap.get(key);
  return cached?.loading || false;
}

export function invalidateAFMCache(unitIds?: number[]): void {
  if (unitIds) {
    const key = getUnitCacheKey(unitIds);
    unitCacheMap.delete(key);
    console.log(`[AFMCache] INVALIDATED for units: ${unitIds.join(', ')}`);
  } else {
    unitCacheMap.clear();
    console.log('[AFMCache] CLEARED all units');
  }
}

export function searchCachedBeneficiaries(unitIds: number[], afmPrefix: string): CachedAFM[] {
  const cached = getCachedAFMData(unitIds);
  if (!cached || cached.beneficiaries.length === 0) {
    return [];
  }
  
  const results = cached.beneficiaries.filter(b => 
    b.decryptedAFM.startsWith(afmPrefix)
  ).slice(0, 20);
  
  console.log(`[AFMCache] Search for "${afmPrefix}" in cache returned ${results.length} results`);
  return results;
}

export function searchCachedEmployees(unitIds: number[], afmPrefix: string): CachedAFM[] {
  const cached = getCachedAFMData(unitIds);
  if (!cached || cached.employees.length === 0) {
    return [];
  }
  
  const results = cached.employees.filter(e => 
    e.decryptedAFM.startsWith(afmPrefix)
  ).slice(0, 20);
  
  console.log(`[AFMCache] Search for "${afmPrefix}" in employees cache returned ${results.length} results`);
  return results;
}

export function getCacheStats(): { units: number; totalBeneficiaries: number; totalEmployees: number } {
  let totalBeneficiaries = 0;
  let totalEmployees = 0;
  
  unitCacheMap.forEach(cache => {
    totalBeneficiaries += cache.beneficiaries.length;
    totalEmployees += cache.employees.length;
  });
  
  return {
    units: unitCacheMap.size,
    totalBeneficiaries,
    totalEmployees
  };
}
