type RegiondetEntry = Record<string, unknown> & {
  payment_id?: string | number;
  payment_ids?: Array<string | number>;
};

const toEntryList = (value: any): RegiondetEntry[] => {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  const entries: RegiondetEntry[] = [];

  items.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const paymentIds = new Set<any>();
    if (Array.isArray((item as any).payment_ids)) {
      (item as any).payment_ids.forEach((id: any) => paymentIds.add(id));
    }
    if ((item as any).payment_id !== undefined && (item as any).payment_id !== null) {
      paymentIds.add((item as any).payment_id);
    }

    const { payment_id, payment_ids, ...geo } = item as any;

    if (paymentIds.size === 0) {
      entries.push(geo);
    } else {
      Array.from(paymentIds).forEach((pid) => {
        entries.push({ ...geo, payment_id: pid, payment_ids: [pid] });
      });
    }
  });

  return entries;
};

export const mergeRegiondetWithPayments = (
  existingRegiondet: any,
  incomingRegiondet: any,
): RegiondetEntry[] => {
  const existingEntries = toEntryList(existingRegiondet);
  const incomingEntries = toEntryList(incomingRegiondet);

  // When incoming regiondet is provided without payment ids, treat it as a template
  // for any existing entries so geo updates continue to apply across payments.
  const incomingTemplate = incomingEntries
    .filter((entry) => entry.payment_id === undefined)
    .reduce((acc, entry) => ({ ...acc, ...entry }), {});

  const existingTemplate = existingEntries
    .filter((entry) => entry.payment_id === undefined)
    .reduce((acc, entry) => ({ ...acc, ...entry }), {});

  const existingEntryFallbackTemplate = existingEntries
    .filter((entry) => entry.payment_id !== undefined)
    .map((entry) => {
      const { payment_id, payment_ids, ...geo } = entry;
      return geo;
    })
    .find((geo) => Object.keys(geo).length > 0);

  const template = Object.keys(incomingTemplate).length
    ? incomingTemplate
    : Object.keys(existingTemplate).length
      ? existingTemplate
      : existingEntryFallbackTemplate || {};

  const merged = new Map<string, RegiondetEntry>();

  existingEntries.forEach((entry, idx) => {
    const key =
      entry.payment_id !== undefined
        ? String(entry.payment_id)
        : `__no_payment__:${idx}`;
    // Incoming template should override existing geo fields for mapped payments.
    const value = template ? ({ ...entry, ...template } as RegiondetEntry) : entry;
    merged.set(key, value);
  });

  incomingEntries
    .filter((entry) => entry.payment_id !== undefined)
    .forEach((entry) => {
      const key = String(entry.payment_id);
      const base = merged.get(key) || template || {};
      merged.set(key, { ...(base as object), ...entry } as RegiondetEntry);
    });

  // If we only received a template (no payment ids yet), keep it as a single entry
  if (merged.size === 0 && Object.keys(template || {}).length > 0) {
    merged.set("__template__", template as RegiondetEntry);
  }

  const mergedEntries = Array.from(merged.values());
  const hasPaymentIds = mergedEntries.some(
    (entry) => entry.payment_id !== undefined,
  );

  return mergedEntries
    .filter((entry) => (hasPaymentIds ? entry.payment_id !== undefined : true))
    .map((entry) => {
      const { payment_ids, payment_id, ...geo } = entry;
      if (payment_id === undefined) {
        return geo as RegiondetEntry;
      }
      return {
        ...geo,
        payment_id,
        payment_ids: [payment_id],
      } as RegiondetEntry;
    });
};
