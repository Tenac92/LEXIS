import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_ANON_KEY in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type PaymentRow = {
  id: number;
  regiondet: unknown;
  region_code: string | null;
  regional_unit_code: string | null;
  municipality_code: string | null;
};

const parseJsonIfNeeded = (value: unknown): unknown => {
  let current: unknown = value;

  for (let i = 0; i < 3; i += 1) {
    if (typeof current !== "string") return current;

    const trimmed = current.trim();
    if (!trimmed) return null;

    const looksLikeJson =
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith('"{') ||
      trimmed.startsWith('"[');

    if (!looksLikeJson) return current;

    try {
      current = JSON.parse(trimmed);
    } catch {
      return current;
    }
  }

  return current;
};

const toObjectArray = (value: unknown): any[] => {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry && typeof entry === "object");
  }
  if (value && typeof value === "object") {
    return [value];
  }
  return [];
};

const hasGeo = (entry: any): boolean => {
  if (!entry || typeof entry !== "object") return false;
  return Boolean(
    (Array.isArray(entry.regions) && entry.regions.length > 0) ||
      (Array.isArray(entry.regional_units) && entry.regional_units.length > 0) ||
      (Array.isArray(entry.municipalities) && entry.municipalities.length > 0) ||
      entry.region_code ||
      entry.unit_code ||
      entry.municipality_code ||
      entry.region ||
      entry.regional_unit ||
      entry.municipality,
  );
};

const deriveCodesFromRegiondet = (rawRegiondet: unknown) => {
  const parsed = parseJsonIfNeeded(rawRegiondet);
  const entries = toObjectArray(parsed);

  const resolved =
    [...entries].reverse().find((entry) => hasGeo(entry)) ||
    (entries.length > 0 ? entries[entries.length - 1] : null);

  if (!resolved) {
    return {
      region_code: null as string | null,
      regional_unit_code: null as string | null,
      municipality_code: null as string | null,
    };
  }

  const regions = toObjectArray((resolved as any).regions);
  const regionalUnits = toObjectArray(
    (resolved as any).regional_units ??
      (resolved as any).regional_unit ??
      (resolved as any).unit,
  );
  const municipalities = toObjectArray(
    (resolved as any).municipalities ?? (resolved as any).municipality,
  );

  const regionCodeRaw =
    regions[0]?.code ??
    regions[0]?.region_code ??
    (resolved as any).region_code ??
    null;

  const regionalUnitCodeRaw =
    regionalUnits[0]?.code ??
    regionalUnits[0]?.unit_code ??
    (resolved as any).unit_code ??
    null;

  const municipalityCodeRaw =
    municipalities[0]?.code ??
    municipalities[0]?.id ??
    (resolved as any).municipality_code ??
    null;

  return {
    region_code:
      regionCodeRaw !== null && regionCodeRaw !== undefined
        ? String(regionCodeRaw)
        : null,
    regional_unit_code:
      regionalUnitCodeRaw !== null && regionalUnitCodeRaw !== undefined
        ? String(regionalUnitCodeRaw)
        : null,
    municipality_code:
      municipalityCodeRaw !== null && municipalityCodeRaw !== undefined
        ? String(municipalityCodeRaw)
        : null,
  };
};

async function backfillGeoCodes() {
  console.log("\n=== Backfill beneficiary_payments geo code columns from regiondet ===\n");

  const pageSize = 500;
  let from = 0;
  let total = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("beneficiary_payments")
      .select("id, regiondet, region_code, regional_unit_code, municipality_code")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error(`Failed reading rows ${from}-${to}:`, error.message);
      process.exit(1);
    }

    const rows = (data || []) as PaymentRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      total += 1;

      const next = deriveCodesFromRegiondet(row.regiondet);

      const needsUpdate =
        (row.region_code || null) !== (next.region_code || null) ||
        (row.regional_unit_code || null) !== (next.regional_unit_code || null) ||
        (row.municipality_code || null) !== (next.municipality_code || null);

      if (!needsUpdate) {
        skipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("beneficiary_payments")
        .update({
          region_code: next.region_code,
          regional_unit_code: next.regional_unit_code,
          municipality_code: next.municipality_code,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        failed += 1;
        console.error(`Failed updating payment id=${row.id}: ${updateError.message}`);
      } else {
        updated += 1;
      }
    }

    console.log(
      `Processed ${Math.min(to + 1, from + rows.length)} rows so far | updated=${updated}, skipped=${skipped}, failed=${failed}`,
    );

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log("\n=== Backfill summary ===");
  console.log(`Total scanned: ${total}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

backfillGeoCodes().catch((err) => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});
