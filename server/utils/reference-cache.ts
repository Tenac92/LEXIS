import { supabase } from "../config/db";

interface Monada {
  id: number;
  unit: string;
}

interface EventType {
  id: number;
  name: string;
}

interface ExpenditureType {
  id: number;
  expenditure_types: string;
}

interface ReferenceCache {
  monada: Monada[];
  eventTypes: EventType[];
  expenditureTypes: ExpenditureType[];
  timestamp: number;
  loading: boolean;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let referenceCache: ReferenceCache | null = null;
let cachePromise: Promise<ReferenceCache> | null = null;

export async function getReferenceData(): Promise<ReferenceCache> {
  if (referenceCache && Date.now() - referenceCache.timestamp < CACHE_TTL) {
    console.log('[RefCache] HIT - using cached reference data');
    return referenceCache;
  }

  if (cachePromise) {
    console.log('[RefCache] WAITING - another request is loading');
    return cachePromise;
  }

  console.log('[RefCache] MISS - loading reference data from database');
  
  cachePromise = loadReferenceData();
  
  try {
    referenceCache = await cachePromise;
    return referenceCache;
  } finally {
    cachePromise = null;
  }
}

async function loadReferenceData(): Promise<ReferenceCache> {
  const startTime = Date.now();

  const [monadaRes, eventTypesRes, expenditureTypesRes] = await Promise.all([
    supabase.from('Monada').select('id, unit'),
    supabase.from('event_types').select('id, name'),
    supabase.from('expenditure_types').select('id, expenditure_types')
  ]);

  if (monadaRes.error) {
    console.error('[RefCache] Error loading Monada:', monadaRes.error);
    throw monadaRes.error;
  }
  if (eventTypesRes.error) {
    console.error('[RefCache] Error loading event_types:', eventTypesRes.error);
    throw eventTypesRes.error;
  }
  if (expenditureTypesRes.error) {
    console.error('[RefCache] Error loading expenditure_types:', expenditureTypesRes.error);
    throw expenditureTypesRes.error;
  }

  const cache: ReferenceCache = {
    monada: monadaRes.data || [],
    eventTypes: eventTypesRes.data || [],
    expenditureTypes: expenditureTypesRes.data || [],
    timestamp: Date.now(),
    loading: false
  };

  const elapsed = Date.now() - startTime;
  console.log(`[RefCache] Loaded ${cache.monada.length} units, ${cache.eventTypes.length} event types, ${cache.expenditureTypes.length} expenditure types in ${elapsed}ms`);

  return cache;
}

export function getMonadaById(id: number): Monada | undefined {
  return referenceCache?.monada.find(m => m.id === id);
}

export function getMonadaByUnit(unit: string): Monada | undefined {
  return referenceCache?.monada.find(m => m.unit === unit);
}

export function getEventTypeById(id: number): EventType | undefined {
  return referenceCache?.eventTypes.find(et => et.id === id);
}

export function getExpenditureTypeById(id: number): ExpenditureType | undefined {
  return referenceCache?.expenditureTypes.find(et => et.id === id);
}

export function invalidateReferenceCache(): void {
  referenceCache = null;
  cachePromise = null;
  console.log('[RefCache] INVALIDATED');
}

export function preloadReferenceCache(): void {
  if (!referenceCache || Date.now() - referenceCache.timestamp >= CACHE_TTL) {
    console.log('[RefCache] Preloading reference data in background');
    getReferenceData().catch(err => {
      console.error('[RefCache] Preload failed:', err);
    });
  }
}

export function getCacheStats(): { loaded: boolean; age: number; counts: { monada: number; eventTypes: number; expenditureTypes: number } } {
  if (!referenceCache) {
    return { loaded: false, age: 0, counts: { monada: 0, eventTypes: 0, expenditureTypes: 0 } };
  }
  return {
    loaded: true,
    age: Date.now() - referenceCache.timestamp,
    counts: {
      monada: referenceCache.monada.length,
      eventTypes: referenceCache.eventTypes.length,
      expenditureTypes: referenceCache.expenditureTypes.length
    }
  };
}
