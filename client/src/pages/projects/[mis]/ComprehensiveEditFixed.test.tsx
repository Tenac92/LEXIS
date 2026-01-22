import assert from "assert";
import {
  buildPersistedLocationSnapshot,
  cloneLocation,
  hasPersistedLocationChanges,
  prepareLocationForSave,
} from "./location-helpers";

const baseLocation = {
  id: 10,
  project_index_id: 20,
  implementing_agency: "Agency A",
  event_type: "Event A",
  geographic_areas: ["Region|Unit|Municipality"],
  expenditure_types: ["Type A"],
  ada: "ADA-123",
  protocol_number: "PN-456",
};

const cloned = cloneLocation(baseLocation);
assert.strictEqual(cloned.id, undefined, "cloneLocation should strip id");
assert.strictEqual(
  cloned.project_index_id,
  undefined,
  "cloneLocation should strip project_index_id",
);
assert.strictEqual(cloned.ada, undefined, "cloneLocation should strip ada");
assert.strictEqual(
  cloned.protocol_number,
  undefined,
  "cloneLocation should strip protocol_number",
);
assert.strictEqual(cloned.isClone, true, "cloneLocation should mark isClone");
assert.strictEqual(
  cloned._originalId,
  10,
  "cloneLocation should capture original id",
);

baseLocation.geographic_areas.push("Region2||");
baseLocation.expenditure_types.push("Type B");
assert.deepStrictEqual(
  cloned.geographic_areas,
  ["Region|Unit|Municipality"],
  "cloneLocation should deep copy geographic_areas",
);
assert.deepStrictEqual(
  cloned.expenditure_types,
  ["Type A"],
  "cloneLocation should deep copy expenditure_types",
);

const preparedClone = prepareLocationForSave(cloned);
assert.strictEqual(
  preparedClone.id,
  undefined,
  "prepareLocationForSave should strip id for clones",
);
assert.strictEqual(
  preparedClone.project_index_id,
  undefined,
  "prepareLocationForSave should strip project_index_id for clones",
);
assert.strictEqual(
  preparedClone.isClone,
  undefined,
  "prepareLocationForSave should remove isClone",
);
assert.strictEqual(
  preparedClone._originalId,
  undefined,
  "prepareLocationForSave should remove _originalId",
);
assert.ok(
  Array.isArray(preparedClone.geographic_areas),
  "prepareLocationForSave should keep geographic_areas as array",
);
assert.ok(
  Array.isArray(preparedClone.expenditure_types),
  "prepareLocationForSave should keep expenditure_types as array",
);

const persistedLocation = {
  id: 5,
  project_index_id: 5,
  implementing_agency: "Agency B",
  event_type: "Event B",
  geographic_areas: [],
  expenditure_types: [],
};

const preparedPersisted = prepareLocationForSave(persistedLocation);
assert.strictEqual(
  preparedPersisted.id,
  5,
  "prepareLocationForSave should retain id for persisted locations",
);
assert.strictEqual(
  preparedPersisted.project_index_id,
  5,
  "prepareLocationForSave should retain project_index_id for persisted locations",
);

const initialSnapshot = buildPersistedLocationSnapshot([persistedLocation]);
const clonedPersisted = cloneLocation(persistedLocation);
const changedPersisted = { ...persistedLocation, event_type: "Event C" };

assert.strictEqual(
  hasPersistedLocationChanges(
    [changedPersisted, clonedPersisted],
    initialSnapshot,
  ),
  true,
  "hasPersistedLocationChanges should flag edits to persisted locations",
);
assert.strictEqual(
  hasPersistedLocationChanges([persistedLocation, clonedPersisted], initialSnapshot),
  false,
  "hasPersistedLocationChanges should ignore clones when persisted data is unchanged",
);

const preparedMixed = [persistedLocation, clonedPersisted].map(
  prepareLocationForSave,
);
assert.strictEqual(
  preparedMixed[1].id,
  undefined,
  "prepareLocationForSave should strip id from duplicated rows",
);

console.log("ComprehensiveEditFixed.test.tsx passed");
