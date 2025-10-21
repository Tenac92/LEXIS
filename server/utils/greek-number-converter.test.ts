/**
 * Tests for Greek number converter
 */

import { amountToGreekText, safeAmountToGreekText } from "./greek-number-converter";

// Test cases covering grammar, edge cases, and range (uppercase genitive)
const testCases = [
  // Original user example (uppercase genitive)
  { input: 150.50, expected: "ΕΚΑΤΟΝ ΠΕΝΗΝΤΑ ΕΥΡΩ ΚΑΙ ΠΕΝΗΝΤΑ ΛΕΠΤΩΝ" },
  
  // Basic cases
  { input: 0, expected: "ΜΗΔΕΝ ΕΥΡΩ" },
  { input: 1, expected: "ΕΝΑ ΕΥΡΩ" },
  { input: 10, expected: "ΔΕΚΑ ΕΥΡΩ" },
  { input: 100, expected: "ΕΚΑΤΟ ΕΥΡΩ" },
  { input: 200, expected: "ΔΙΑΚΟΣΙΩΝ ΕΥΡΩ" }, // Genitive plural
  
  // Thousands with feminine agreement
  { input: 1000, expected: "ΧΙΛΙΑ ΕΥΡΩ" },
  { input: 2000, expected: "ΔΥΟ ΧΙΛΙΑΔΕΣ ΕΥΡΩ" },
  { input: 3000, expected: "ΤΡΕΙΣ ΧΙΛΙΑΔΕΣ ΕΥΡΩ" },
  { input: 4000, expected: "ΤΕΣΣΕΡΙΣ ΧΙΛΙΑΔΕΣ ΕΥΡΩ" },
  { input: 2500, expected: "ΔΥΟ ΧΙΛΙΑΔΕΣ ΠΕΝΤΑΚΟΣΙΩΝ ΕΥΡΩ" }, // Genitive plural for hundreds
  { input: 21000, expected: "ΕΙΚΟΣΙ ΜΙΑ ΧΙΛΙΑΔΕΣ ΕΥΡΩ" },
  { input: 234000, expected: "ΔΙΑΚΟΣΙΕΣ ΤΡΙΑΝΤΑ ΤΕΣΣΕΡΙΣ ΧΙΛΙΑΔΕΣ ΕΥΡΩ" },
  { input: 999999, expected: "ΕΝΝΙΑΚΟΣΙΕΣ ΕΝΕΝΗΝΤΑ ΕΝΝΕΑ ΧΙΛΙΑΔΕΣ ΕΝΝΙΑΚΟΣΙΩΝ ΕΝΕΝΗΝΤΑ ΕΝΝΕΑ ΕΥΡΩ" }, // Genitive plural for hundreds
  
  // Cents edge cases
  { input: 0.01, expected: "ΕΝΟΣ ΛΕΠΤΟΥ" },
  { input: 1.01, expected: "ΕΝΑ ΕΥΡΩ ΚΑΙ ΕΝΟΣ ΛΕΠΤΟΥ" },
  { input: 99.99, expected: "ΕΝΕΝΗΝΤΑ ΕΝΝΕΑ ΕΥΡΩ ΚΑΙ ΕΝΕΝΗΝΤΑ ΕΝΝΕΑ ΛΕΠΤΩΝ" },
  { input: 1.999, expected: "ΔΥΟ ΕΥΡΩ" }, // Rounding edge case: 1.999 rounds cents to 100, adds to euros
  { input: 1250.75, expected: "ΧΙΛΙΑ ΔΙΑΚΟΣΙΩΝ ΠΕΝΗΝΤΑ ΕΥΡΩ ΚΑΙ ΕΒΔΟΜΗΝΤΑ ΠΕΝΤΕ ΛΕΠΤΩΝ" }, // Genitive plural for hundreds
  
  // Negative numbers
  { input: -50, expected: "ΜΕΙΟΝ ΠΕΝΗΝΤΑ ΕΥΡΩ" },
  
  // Range limits
  { input: 1000000, expected: "ΕΝΝΙΑΚΟΣΙΕΣ ΕΝΕΝΗΝΤΑ ΕΝΝΕΑ ΧΙΛΙΑΔΕΣ ΕΝΝΙΑΚΟΣΙΩΝ ΕΝΕΝΗΝΤΑ ΕΝΝΕΑ ΕΥΡΩ" }, // Clamped to 999,999, genitive plural for hundreds
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
console.log(`safeAmountToGreekText("invalid"): ${safeAmountToGreekText("invalid")} (expected: ΜΗΔΕΝ ΕΥΡΩ)`);
console.log(`safeAmountToGreekText(null): ${safeAmountToGreekText(null)} (expected: ΜΗΔΕΝ ΕΥΡΩ)`);
console.log(`safeAmountToGreekText(undefined): ${safeAmountToGreekText(undefined)} (expected: ΜΗΔΕΝ ΕΥΡΩ)`);
console.log(`safeAmountToGreekText("150.50"): ${safeAmountToGreekText("150.50")} (expected: ΕΚΑΤΟΝ ΠΕΝΗΝΤΑ ΕΥΡΩ ΚΑΙ ΠΕΝΗΝΤΑ ΛΕΠΤΩΝ)`);

console.log(`\n\nSummary: ${passCount} passed, ${failCount} failed`);

// Exit with error code if any tests failed
if (failCount > 0) {
  process.exit(1);
}
