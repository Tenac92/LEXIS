export interface RegionOption {
  code?: string;
  name: string;
  region_code?: string;
}

export interface RegionalUnitOption {
  code?: string;
  name: string;
  region_code?: string;
}

export interface MunicipalityOption {
  id?: string;
  code?: string;
  name: string;
  unit_code?: string;
}

export interface RegiondetSelection {
  payment_id?: string | number;
  regions?: Array<RegionOption>;
  regional_units?: Array<RegionalUnitOption>;
  municipalities?: Array<MunicipalityOption>;
  // Preserve any linked payment ids without affecting geo validation
  payment_ids?: Array<string | number>;
}

export const normalizeRegiondetEntry = (
  regiondet: RegiondetSelection | RegiondetSelection[] | null | undefined,
  paymentId?: string | number,
): RegiondetSelection | null => {
  if (!regiondet) return null;

  const entries = Array.isArray(regiondet) ? regiondet : [regiondet];
  const match = paymentId !== undefined
    ? entries.find((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const ids: Array<string | number> = [];
        if (entry.payment_id !== undefined && entry.payment_id !== null) {
          ids.push(entry.payment_id);
        }
        if (Array.isArray(entry.payment_ids)) {
          ids.push(...entry.payment_ids);
        }
        return ids.map(String).includes(String(paymentId));
      })
    : null;

  const resolved = (match || entries[entries.length - 1] || entries[0]) as any;
  if (!resolved || typeof resolved !== "object") return null;

  const existingIds = Array.isArray(resolved.payment_ids)
    ? resolved.payment_ids
    : [];
  const payment_id =
    resolved.payment_id ??
    (paymentId !== undefined
      ? paymentId
      : existingIds.length === 1
        ? existingIds[0]
        : undefined);

  const idSet = new Set<string | number>(existingIds);
  if (payment_id !== undefined && payment_id !== null) {
    idSet.add(payment_id);
  }

  const { payment_ids, payment_id: _, ...rest } = resolved;
  const normalized: RegiondetSelection = { ...rest };

  if (payment_id !== undefined && payment_id !== null) {
    normalized.payment_id = payment_id;
  }
  if (idSet.size) {
    normalized.payment_ids = Array.from(idSet);
  }

  return normalized;
};

export const isRegiondetComplete = (
  value: RegiondetSelection | RegiondetSelection[] | null | undefined,
): boolean => {
  const normalized = normalizeRegiondetEntry(value);
  if (!normalized) return false;
  return Boolean(
    (normalized.regions && normalized.regions.length > 0) ||
      (normalized.regional_units && normalized.regional_units.length > 0) ||
      (normalized.municipalities && normalized.municipalities.length > 0),
  );
};

export const buildRegiondetSelection = ({
  region,
  regionalUnit,
  municipality,
}: {
  region?: RegionOption | null;
  regionalUnit?: RegionalUnitOption | null;
  municipality?: MunicipalityOption | null;
}): RegiondetSelection => {
  const next: RegiondetSelection = {};

  if (region) {
    next.regions = [
      {
        code: region.code,
        name: region.name,
        region_code: region.region_code,
      },
    ];
  }

  if (regionalUnit) {
    next.regional_units = [
      {
        code: regionalUnit.code,
        name: regionalUnit.name,
        region_code: regionalUnit.region_code,
      },
    ];
  }

  if (municipality) {
    next.municipalities = [
      {
        id: municipality.id,
        code: municipality.code,
        name: municipality.name,
        unit_code: municipality.unit_code,
      },
    ];
  }

  return next;
};

export const deriveGeoSelectionFromRegiondet = (
  regiondet: RegiondetSelection | RegiondetSelection[] | null | undefined,
): {
  regionCode: string;
  unitCode: string;
  municipalityCode: string;
} => {
  const resolved = normalizeRegiondetEntry(regiondet);
  if (!resolved)
    return { regionCode: "", unitCode: "", municipalityCode: "" };

  const regionCode =
    resolved.regions && resolved.regions[0]
      ? String(resolved.regions[0].code || resolved.regions[0].region_code || "")
      : "";
  const unitCode =
    resolved.regional_units && resolved.regional_units[0]
      ? String(
          resolved.regional_units[0].code ||
            resolved.regional_units[0].region_code ||
            "",
        )
      : "";
  const municipalityCode =
    resolved.municipalities && resolved.municipalities[0]
      ? String(
          resolved.municipalities[0].code ||
            resolved.municipalities[0].id ||
            "",
        )
      : "";

  return { regionCode, unitCode, municipalityCode };
};

export const mergeRegiondetPreservingPayments = (
  next: RegiondetSelection | null | undefined,
  existing: RegiondetSelection | null | undefined,
): RegiondetSelection => {
  const normalizedExisting = normalizeRegiondetEntry(existing);
  const normalizedNext = normalizeRegiondetEntry(next);

  const merged: RegiondetSelection = {
    ...(normalizedExisting || {}),
    ...(normalizedNext || {}),
  };

  const payment_id =
    normalizedNext?.payment_id ??
    normalizedExisting?.payment_id ??
    (normalizedNext?.payment_ids?.[0] ??
      normalizedExisting?.payment_ids?.[0]);

  const paymentIds = new Set<string | number>();
  if (Array.isArray(normalizedExisting?.payment_ids)) {
    normalizedExisting.payment_ids.forEach((id) => paymentIds.add(id));
  }
  if (Array.isArray(normalizedNext?.payment_ids)) {
    normalizedNext.payment_ids.forEach((id) => paymentIds.add(id));
  }
  if (payment_id !== undefined && payment_id !== null) {
    paymentIds.add(payment_id);
    merged.payment_id = payment_id;
  }

  if (paymentIds.size) {
    merged.payment_ids = Array.from(paymentIds);
  }

  return merged;
};
