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

const parseRegiondetJsonIfNeeded = (value: unknown): unknown => {
  let current: unknown = value;

  // Some rows arrive as stringified JSON, and in edge cases as double-stringified JSON.
  for (let i = 0; i < 3; i += 1) {
    if (typeof current !== "string") {
      return current;
    }

    const trimmed = current.trim();
    if (!trimmed) {
      return null;
    }

    if (!(trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"{') || trimmed.startsWith('"['))) {
      return current;
    }

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
    return value.filter((item) => item && typeof item === "object");
  }
  if (value && typeof value === "object") {
    return [value];
  }
  return [];
};

const normalizeLegacyRegiondetShape = (
  value: any,
): Partial<RegiondetSelection> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const regionCode =
    value.region_code !== undefined && value.region_code !== null
      ? String(value.region_code)
      : "";
  const regionName =
    typeof value.region_name === "string" ? value.region_name : "";

  const unitCode =
    value.unit_code !== undefined && value.unit_code !== null
      ? String(value.unit_code)
      : "";
  const unitName =
    typeof value.unit_name === "string" ? value.unit_name : "";

  const municipalityCode =
    value.municipality_code !== undefined && value.municipality_code !== null
      ? String(value.municipality_code)
      : "";
  const municipalityName =
    typeof value.municipality_name === "string" ? value.municipality_name : "";

  const normalized: Partial<RegiondetSelection> = {};

  if (regionCode || regionName) {
    normalized.regions = [
      {
        code: regionCode || undefined,
        name: regionName || regionCode || "",
      },
    ];
  }

  if (unitCode || unitName) {
    normalized.regional_units = [
      {
        code: unitCode || undefined,
        name: unitName || unitCode || "",
        region_code: regionCode || undefined,
      },
    ];
  }

  if (municipalityCode || municipalityName) {
    normalized.municipalities = [
      {
        code: municipalityCode || undefined,
        id: municipalityCode || undefined,
        name: municipalityName || municipalityCode || "",
        unit_code: unitCode || undefined,
      },
    ];
  }

  // Legacy minimal shape used in older rows: { region, regional_unit, municipality }
  const simpleRegionName =
    typeof value.region === "string" ? value.region.trim() : "";
  const simpleUnitName =
    typeof value.regional_unit === "string" ? value.regional_unit.trim() : "";
  const simpleMunicipalityName =
    typeof value.municipality === "string" ? value.municipality.trim() : "";

  if (!normalized.regions && simpleRegionName) {
    normalized.regions = [
      {
        name: simpleRegionName,
      },
    ];
  }

  if (!normalized.regional_units && simpleUnitName) {
    normalized.regional_units = [
      {
        name: simpleUnitName,
      },
    ];
  }

  if (!normalized.municipalities && simpleMunicipalityName) {
    normalized.municipalities = [
      {
        name: simpleMunicipalityName,
      },
    ];
  }

  return normalized;
};

export const normalizeRegiondetEntry = (
  regiondet: RegiondetSelection | RegiondetSelection[] | null | undefined,
  paymentId?: string | number,
): RegiondetSelection | null => {
  const parsedRegiondet = parseRegiondetJsonIfNeeded(regiondet);
  if (!parsedRegiondet) return null;

  const entries = Array.isArray(parsedRegiondet)
    ? parsedRegiondet
    : [parsedRegiondet];

  const hasGeoInEntry = (entry: any): boolean => {
    if (!entry || typeof entry !== "object") return false;
    const normalizedCandidate = {
      ...normalizeLegacyRegiondetShape(entry),
      ...entry,
    } as any;
    return Boolean(
      (Array.isArray(normalizedCandidate.regions) && normalizedCandidate.regions.length > 0) ||
        (Array.isArray(normalizedCandidate.regional_units) && normalizedCandidate.regional_units.length > 0) ||
        (Array.isArray(normalizedCandidate.municipalities) && normalizedCandidate.municipalities.length > 0),
    );
  };

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

  const latestGeoEntry = [...entries]
    .reverse()
    .find((entry) => hasGeoInEntry(entry));

  const resolved = (
    (match && hasGeoInEntry(match) ? match : null) ||
    latestGeoEntry ||
    match ||
    entries[entries.length - 1] ||
    entries[0]
  ) as any;
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
  const normalized: RegiondetSelection = {
    ...normalizeLegacyRegiondetShape(resolved),
    ...rest,
  };

  const regionEntries = toObjectArray((normalized as any).regions ?? (resolved as any).region);
  if (regionEntries.length > 0) {
    normalized.regions = regionEntries.map((entry: any) => {
      const code =
        entry.code ??
        entry.region_code ??
        entry.id ??
        entry.regionId;
      const name = entry.name ?? entry.region_name ?? entry.label ?? code ?? "";
      return {
        ...entry,
        code: code !== undefined && code !== null ? String(code) : undefined,
        name: String(name),
      };
    });
  }

  const unitEntries = toObjectArray(
    (normalized as any).regional_units ??
      (resolved as any).regional_unit ??
      (resolved as any).unit,
  );
  if (unitEntries.length > 0) {
    normalized.regional_units = unitEntries.map((entry: any) => {
      const code =
        entry.code ??
        entry.unit_code ??
        entry.regional_unit_code ??
        entry.id;
      const name = entry.name ?? entry.unit_name ?? entry.label ?? code ?? "";
      const regionCode = entry.region_code ?? entry.parent_region_code;
      return {
        ...entry,
        code: code !== undefined && code !== null ? String(code) : undefined,
        name: String(name),
        region_code:
          regionCode !== undefined && regionCode !== null
            ? String(regionCode)
            : undefined,
      };
    });
  }

  const municipalityEntries = toObjectArray(
    (normalized as any).municipalities ??
      (resolved as any).municipality,
  );
  if (municipalityEntries.length > 0) {
    normalized.municipalities = municipalityEntries.map((entry: any) => {
      const code =
        entry.code ??
        entry.muni_code ??
        entry.municipality_code ??
        entry.id;
      const name =
        entry.name ?? entry.municipality_name ?? entry.label ?? code ?? "";
      const unitCode = entry.unit_code ?? entry.parent_unit_code;
      return {
        ...entry,
        id: code !== undefined && code !== null ? String(code) : entry.id,
        code: code !== undefined && code !== null ? String(code) : undefined,
        name: String(name),
        unit_code:
          unitCode !== undefined && unitCode !== null
            ? String(unitCode)
            : undefined,
      };
    });
  }

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
      ? String(
          resolved.regions[0].code ||
            resolved.regions[0].region_code ||
            resolved.regions[0].name ||
            "",
        )
      : "";
  const unitCode =
    resolved.regional_units && resolved.regional_units[0]
      ? String(
          resolved.regional_units[0].code ||
            (resolved.regional_units[0] as any).unit_code ||
            resolved.regional_units[0].region_code ||
            resolved.regional_units[0].name ||
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
