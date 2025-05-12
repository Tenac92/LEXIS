/**
 * Test Script for European Number Format Parsing
 * This script tests the parseEuropeanNumber function to ensure it correctly handles
 * European number formats with periods as thousands separators and commas as decimal points.
 */

// Implementation of parseEuropeanNumber function to test
function parseEuropeanNumber(value) {
  if (!value) return 0;
  
  // Convert to string if it's not already
  const strValue = String(value).trim();
  
  // Return 0 for empty strings
  if (!strValue) return 0;
  
  // Check if the string has European number formatting (period as thousands separator, comma as decimal separator)
  // Example: "22.000,00" should be converted to 22000
  if (strValue.includes('.') && strValue.includes(',')) {
    // Check if it's European format with comma as decimal separator (e.g., "22.000,00")
    if (strValue.lastIndexOf(',') > strValue.lastIndexOf('.')) {
      // European format: replace dots with nothing (remove thousands separators) and commas with dots (decimal separator)
      const normalizedStr = strValue.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalizedStr);
    }
    // Otherwise it's likely US format with comma as thousands separator (e.g., "22,000.50")
    else {
      // US format: remove all commas
      const normalizedStr = strValue.replace(/,/g, '');
      return parseFloat(normalizedStr);
    }
  }
  
  // If it's just a comma as decimal separator (e.g., "22,50")
  if (strValue.includes(',') && !strValue.includes('.')) {
    return parseFloat(strValue.replace(',', '.'));
  }
  
  // Default case: try regular parseFloat
  return parseFloat(strValue);
}

// Test cases
const testCases = [
  { input: "22.000,00", expected: 22000.00, name: "Standard European format with thousands separator and decimal" },
  { input: "1.234.567,89", expected: 1234567.89, name: "Large European format with multiple thousands separators" },
  { input: "22,50", expected: 22.50, name: "European format with only decimal comma" },
  { input: "22.50", expected: 22.50, name: "Standard US format" },
  { input: ".50", expected: 0.50, name: "Decimal only US format" },
  { input: ",50", expected: 0.50, name: "Decimal only European format" },
  { input: "22,000.50", expected: 22000.50, name: "US format with thousands separator and decimal" },
  { input: "22", expected: 22, name: "Integer only" },
  { input: "", expected: 0, name: "Empty string" },
  { input: null, expected: 0, name: "Null value" },
  { input: undefined, expected: 0, name: "Undefined value" },
  { input: "   22.000,00   ", expected: 22000.00, name: "European format with whitespace" },
  { input: "not-a-number", expected: NaN, name: "Non-numeric string" }
];

// Run the tests
console.log("Testing parseEuropeanNumber function\n");
let passCount = 0;
let failCount = 0;

for (const { input, expected, name } of testCases) {
  const result = parseEuropeanNumber(input);
  const passed = Number.isNaN(expected) ? Number.isNaN(result) : result === expected;
  
  if (passed) {
    console.log(`✅ PASS: ${name}`);
    console.log(`   Input: ${JSON.stringify(input)}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Result: ${result}\n`);
    passCount++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Input: ${JSON.stringify(input)}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Result: ${result}\n`);
    failCount++;
  }
}

console.log(`Test Summary: ${passCount} passed, ${failCount} failed`);

// Output test results
if (failCount === 0) {
  console.log("All tests passed! The parseEuropeanNumber function is working correctly.");
} else {
  console.log("Some tests failed. The parseEuropeanNumber function needs to be fixed.");
}