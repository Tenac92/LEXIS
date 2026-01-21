import assert from "assert";
import {
  formatDateForDb,
  normalizeAfm,
  normalizeProtocol,
  parseExcelDate,
} from "../utils/payment-import";

// AFM normalization
assert.strictEqual(normalizeAfm("12345678"), "012345678");
assert.strictEqual(normalizeAfm("012345678"), "012345678");
assert.strictEqual(normalizeAfm("12.345.678"), "012345678");
assert.strictEqual(normalizeAfm(""), null);
assert.strictEqual(normalizeAfm("1234567890"), null);

// Protocol normalization (trim + whitespace collapse + loose variant)
const protocol = normalizeProtocol(`  A\u00A0123  `);
assert.strictEqual(protocol.strict, "A 123");
assert.strictEqual(protocol.loose, "A123");

// Date parsing
const dateDmy = parseExcelDate("31/12/2025");
assert.ok(dateDmy);
assert.strictEqual(formatDateForDb(dateDmy as Date), "2025-12-31");

const dateIso = parseExcelDate("2025-12-31");
assert.ok(dateIso);
assert.strictEqual(formatDateForDb(dateIso as Date), "2025-12-31");

const dateObj = parseExcelDate(new Date(Date.UTC(2025, 11, 31)));
assert.ok(dateObj);
assert.strictEqual(formatDateForDb(dateObj as Date), "2025-12-31");

console.log("payment-import utils tests passed");
