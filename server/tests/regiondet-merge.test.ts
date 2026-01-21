import assert from "assert";
import { mergeRegiondetWithPayments } from "../utils/regiondet-merge";

// Preserve payment mapping and update geo
const existing = {
  regions: [{ code: "R1", name: "Region 1" }],
  payment_ids: [1],
};

const incomingGeo = {
  regions: [{ code: "R2", name: "Region 2" }],
};

const mergedGeo = mergeRegiondetWithPayments(existing, incomingGeo);
assert.deepStrictEqual(
  mergedGeo,
  [
    {
      regions: [{ code: "R2", name: "Region 2" }],
      payment_id: 1,
      payment_ids: [1],
    },
  ],
  "Incoming geo without payment ids should update the existing payment entry",
);

// Append multiple payments without changing geo
const appended = mergeRegiondetWithPayments(existing, { payment_ids: [2, 1] });
assert.deepStrictEqual(
  appended,
  [
    {
      regions: [{ code: "R1", name: "Region 1" }],
      payment_id: 1,
      payment_ids: [1],
    },
    {
      regions: [{ code: "R1", name: "Region 1" }],
      payment_id: 2,
      payment_ids: [2],
    },
  ],
  "Appending payment ids should yield one regiondet entry per payment id",
);

// Create template entry when no payment ids exist yet
const templateOnly = mergeRegiondetWithPayments(null, incomingGeo);
assert.deepStrictEqual(
  templateOnly,
  [{ regions: [{ code: "R2", name: "Region 2" }] }],
  "Regiondet without payments should be stored as a single template entry",
);

console.log("regiondet-merge.test.ts passed");
