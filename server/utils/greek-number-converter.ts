/**
 * Converts numbers to Greek text representation with currency formatting
 * Supports range: 0 to 999,999.99
 */

// Masculine forms (used for standalone numbers and with ευρώ)
const UNITS = [
  "", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", 
  "έξι", "επτά", "οκτώ", "εννέα"
];

// Feminine forms (used with χιλιάδες)
const UNITS_FEM = [
  "", "μία", "δύο", "τρεις", "τέσσερις", "πέντε",
  "έξι", "επτά", "οκτώ", "εννέα"
];

const TEENS = [
  "δέκα", "έντεκα", "δώδεκα", "δεκατρία", "δεκατέσσερα",
  "δεκαπέντε", "δεκαέξι", "δεκαεπτά", "δεκαοκτώ", "δεκαεννέα"
];

// Feminine teens (for thousands)
const TEENS_FEM = [
  "δέκα", "έντεκα", "δώδεκα", "δεκατρείς", "δεκατέσσερις",
  "δεκαπέντε", "δεκαέξι", "δεκαεπτά", "δεκαοκτώ", "δεκαεννέα"
];

const TENS = [
  "", "", "είκοσι", "τριάντα", "σαράντα", "πενήντα",
  "εξήντα", "εβδομήντα", "ογδόντα", "ενενήντα"
];

// Masculine hundreds
const HUNDREDS = [
  "", "εκατόν", "διακόσια", "τριακόσια", "τετρακόσια",
  "πεντακόσια", "εξακόσια", "επτακόσια", "οκτακόσια", "εννιακόσια"
];

// Feminine hundreds (for thousands)
const HUNDREDS_FEM = [
  "", "εκατόν", "διακόσιες", "τριακόσιες", "τετρακόσιες",
  "πεντακόσιες", "εξακόσιες", "επτακόσιες", "οκτακόσιες", "εννιακόσιες"
];

/**
 * Converts a number from 0-99 to Greek text
 * @param num - Number to convert
 * @param feminine - Use feminine forms (for thousands)
 */
function convertTens(num: number, feminine = false): string {
  if (num === 0) return "";
  
  const units = feminine ? UNITS_FEM : UNITS;
  const teens = feminine ? TEENS_FEM : TEENS;
  
  if (num < 10) return units[num];
  if (num < 20) return teens[num - 10];
  
  const tensDigit = Math.floor(num / 10);
  const unitsDigit = num % 10;
  
  if (unitsDigit === 0) {
    return TENS[tensDigit];
  }
  
  return `${TENS[tensDigit]} ${units[unitsDigit]}`;
}

/**
 * Converts a number from 0-999 to Greek text
 * @param num - Number to convert
 * @param feminine - Use feminine forms (for thousands)
 */
function convertHundreds(num: number, feminine = false): string {
  if (num === 0) return "";
  if (num === 100) return "εκατό";
  if (num < 100) return convertTens(num, feminine);
  
  const hundreds = feminine ? HUNDREDS_FEM : HUNDREDS;
  const hundredsDigit = Math.floor(num / 100);
  const remainder = num % 100;
  
  if (remainder === 0) {
    // For exact hundreds, use εκατό instead of εκατόν
    return hundredsDigit === 1 ? "εκατό" : hundreds[hundredsDigit];
  }
  
  return `${hundreds[hundredsDigit]} ${convertTens(remainder, feminine)}`.trim();
}

/**
 * Converts a number from 0-999,999 to Greek text
 * @param num - Number to convert (clamped to 0-999,999)
 */
function convertThousands(num: number): string {
  // Clamp to supported range
  const clamped = Math.max(0, Math.min(999999, Math.floor(num)));
  
  if (clamped === 0) return "μηδέν";
  if (clamped < 1000) return convertHundreds(clamped, false);
  
  const thousands = Math.floor(clamped / 1000);
  const remainder = clamped % 1000;
  
  let result = "";
  
  // Handle thousands part with feminine agreement
  if (thousands === 1) {
    result = "χίλια";
  } else if (thousands < 1000) {
    result = `${convertHundreds(thousands, true)} χιλιάδες`;
  }
  
  // Add remainder if exists
  if (remainder > 0) {
    result += ` ${convertHundreds(remainder, false)}`;
  }
  
  return result.trim();
}

/**
 * Converts a numeric amount to Greek currency text
 * Example: 150.50 -> "εκατόν πενήντα ευρώ και πενήντα λεπτών"
 * 
 * @param amount - The numeric amount to convert (0-999,999.99)
 * @returns Greek text representation with currency
 */
export function amountToGreekText(amount: number | string): string {
  // Convert to number and validate
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  
  if (!Number.isFinite(num)) {
    return "μηδέν ευρώ";
  }
  
  // Handle negative numbers
  if (num < 0) {
    return `μείον ${amountToGreekText(Math.abs(num))}`;
  }
  
  // Split into euros and cents, handling rounding edge case
  let euros = Math.floor(num);
  let cents = Math.round((num - euros) * 100);
  
  // Handle rounding edge case: if cents rounds to 100, add to euros
  if (cents >= 100) {
    euros += Math.floor(cents / 100);
    cents = cents % 100;
  }
  
  // Convert euros part
  let result = "";
  
  if (euros === 0 && cents === 0) {
    result = "μηδέν ευρώ";
  } else if (euros === 0) {
    result = "";
  } else {
    result = `${convertThousands(euros)} ευρώ`;
  }
  
  // Add cents if present with correct grammar
  if (cents > 0) {
    const centsText = convertTens(cents, false);
    
    if (cents === 1) {
      // Singular genitive for 1 cent
      const prefix = euros > 0 ? " και " : "";
      result += `${prefix}ενός λεπτού`;
    } else {
      // Plural genitive for multiple cents
      const prefix = euros > 0 ? " και " : "";
      result += `${prefix}${centsText} λεπτών`;
    }
  }
  
  return result.trim();
}

/**
 * Safe wrapper that converts unknown values to Greek text
 */
export function safeAmountToGreekText(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  return amountToGreekText(Number.isFinite(num) ? num : 0);
}
