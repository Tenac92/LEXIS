/**
 * Tests for Greek number converter
 */

import { amountToGreekText, safeAmountToGreekText } from "./greek-number-converter";

// Test cases covering grammar, edge cases, and range
const testCases = [
  // Original user example
  { input: 150.50, expected: "εκατόν πενήντα ευρώ και πενήντα λεπτών" },
  
  // Basic cases
  { input: 0, expected: "μηδέν ευρώ" },
  { input: 1, expected: "ένα ευρώ" },
  { input: 10, expected: "δέκα ευρώ" },
  { input: 100, expected: "εκατό ευρώ" },
  { input: 200, expected: "διακόσια ευρώ" },
  
  // Thousands with feminine agreement
  { input: 1000, expected: "χίλια ευρώ" },
  { input: 2000, expected: "δύο χιλιάδες ευρώ" },
  { input: 3000, expected: "τρεις χιλιάδες ευρώ" },
  { input: 4000, expected: "τέσσερις χιλιάδες ευρώ" },
  { input: 2500, expected: "δύο χιλιάδες πεντακόσια ευρώ" },
  { input: 21000, expected: "είκοσι μία χιλιάδες ευρώ" },
  { input: 234000, expected: "διακόσιες τριάντα τέσσερις χιλιάδες ευρώ" },
  { input: 999999, expected: "εννιακόσιες ενενήντα εννέα χιλιάδες εννιακόσια ενενήντα εννέα ευρώ" },
  
  // Cents edge cases
  { input: 0.01, expected: "ενός λεπτού" },
  { input: 1.01, expected: "ένα ευρώ και ενός λεπτού" },
  { input: 99.99, expected: "ενενήντα εννέα ευρώ και ενενήντα εννέα λεπτών" },
  { input: 1.999, expected: "δύο ευρώ" }, // Rounding edge case: 1.999 rounds cents to 100, adds to euros
  { input: 1250.75, expected: "χίλια διακόσια πενήντα ευρώ και εβδομήντα πέντε λεπτών" },
  
  // Negative numbers
  { input: -50, expected: "μείον πενήντα ευρώ" },
  
  // Range limits
  { input: 1000000, expected: "εννιακόσιες ενενήντα εννέα χιλιάδες εννιακόσια ενενήντα εννέα ευρώ" }, // Clamped to 999,999
];

console.log("Greek Number Converter Tests:\n");

let passCount = 0;
let failCount = 0;

testCases.forEach(({ input, expected }) => {
  const result = amountToGreekText(input);
  const passed = result === expected;
  
  if (passed) {
    passCount++;
  } else {
    failCount++;
  }
  
  console.log(`Input: ${input}`);
  console.log(`Expected: ${expected}`);
  console.log(`Got:      ${result}`);
  console.log(`Status:   ${passed ? "✓ PASS" : "✗ FAIL"}`);
  console.log();
});

// Test safeAmountToGreekText with invalid inputs
console.log("Testing safe wrapper with invalid inputs:");
console.log(`safeAmountToGreekText("invalid"): ${safeAmountToGreekText("invalid")}`);
console.log(`safeAmountToGreekText(null): ${safeAmountToGreekText(null)}`);
console.log(`safeAmountToGreekText(undefined): ${safeAmountToGreekText(undefined)}`);
console.log(`safeAmountToGreekText("150.50"): ${safeAmountToGreekText("150.50")}`);

console.log(`\n\nSummary: ${passCount} passed, ${failCount} failed`);

// Exit with error code if any tests failed
if (failCount > 0) {
  process.exit(1);
}
