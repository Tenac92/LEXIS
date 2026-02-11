import assert from "assert";
import {
  buildRegiondetSelection,
  deriveGeoSelectionFromRegiondet,
  isRegiondetComplete,
  normalizeRegiondetEntry,
  mergeRegiondetPreservingPayments,
} from "../src/components/documents/utils/beneficiary-geo";

const region = { code: "R1", name: "Region One" };
const unit = { code: "U1", name: "Unit One", region_code: "R1" };
const municipality = {
  id: "municipality-U1-001",
  code: "M1",
  name: "Municipality One",
  unit_code: "U1",
};

const regionOnly = buildRegiondetSelection({
  region,
  regionalUnit: null,
  municipality: null,
});

assert.strictEqual(
  isRegiondetComplete(regionOnly),
  true,
  "Region-only selection should be considered complete",
);

const fullSelection = buildRegiondetSelection({
  region,
  regionalUnit: unit,
  municipality,
});

assert.strictEqual(
  isRegiondetComplete(fullSelection),
  true,
  "Full selection should be considered complete",
);

assert.deepStrictEqual(
  deriveGeoSelectionFromRegiondet(fullSelection),
  { regionCode: "R1", unitCode: "U1", municipalityCode: "M1" },
  "deriveGeoSelectionFromRegiondet should expose selected codes",
);

assert.strictEqual(
  isRegiondetComplete(null),
  false,
  "Null regiondet should be incomplete",
);

const mergedPayments = mergeRegiondetPreservingPayments(regionOnly, {
  regions: [{ code: "legacy", name: "Legacy Region" }],
  payment_ids: [1, 2],
});

assert.deepStrictEqual(
  mergedPayments.payment_ids?.sort(),
  [1, 2],
  "Merging geo must preserve existing payment ids even when geo changes",
);

const appendedPayments = mergeRegiondetPreservingPayments(
  { payment_ids: [2, 3], payment_id: 3 },
  mergedPayments as any,
);

assert.deepStrictEqual(
  appendedPayments.payment_ids?.sort(),
  [1, 2, 3],
  "mergeRegiondetPreservingPayments should append unique payment ids and keep payment_id",
);
assert.strictEqual(appendedPayments.payment_id, 3, "Explicit payment_id should be retained on merge");

// Normalize from array of entries and pick the right payment
const regiondetArray = [
  { regions: [{ code: "R10", name: "Region Ten" }], payment_id: 10 },
  { regions: [{ code: "R11", name: "Region Eleven" }], payment_id: 11 },
];

const normalized = normalizeRegiondetEntry(regiondetArray as any, 11);
assert.strictEqual(
  normalized?.payment_id,
  11,
  "normalizeRegiondetEntry should select the matching payment entry",
);
assert.deepStrictEqual(
  deriveGeoSelectionFromRegiondet(regiondetArray),
  { regionCode: "R11", unitCode: "", municipalityCode: "" },
  "deriveGeoSelectionFromRegiondet should use the latest geo entry when no payment id is provided",
);

assert.deepStrictEqual(
  deriveGeoSelectionFromRegiondet({
    regions: [{ name: "Region Legacy", region_code: "R20" }],
    regional_units: [{ name: "Unit Legacy", region_code: "U20" }],
    municipalities: [{ name: "Municipality Legacy", id: "M20" }],
  } as any),
  { regionCode: "R20", unitCode: "U20", municipalityCode: "M20" },
  "deriveGeoSelectionFromRegiondet should support legacy fallback keys",
);

console.log("beneficiary-geo.test.ts passed");
