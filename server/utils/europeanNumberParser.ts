/**
 * Server-side European Number Parsing Utility
 * Handles conversion from European format (comma as decimal separator) to database format
 */

/**
 * Parse a European formatted number string to a number for database storage
 * @param value - The European formatted string (e.g., "1.234,56")
 * @returns Number value suitable for database storage
 */
export function parseEuropeanNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') return value;
  
  const strValue = String(value).trim();
  if (!strValue) return 0;
  
  // Handle European format: "1.234.567,89" -> 1234567.89
  if (strValue.includes('.') && strValue.includes(',')) {
    // Remove dots (thousands separators) and replace comma with decimal point
    const normalized = strValue.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }
  
  // Handle comma as decimal separator: "22,50" -> 22.50
  if (strValue.includes(',') && !strValue.includes('.')) {
    return parseFloat(strValue.replace(',', '.')) || 0;
  }
  
  // Handle dots as thousands separators only: "15.000" -> 15000
  if (strValue.includes('.') && !strValue.includes(',')) {
    // Check if this looks like a thousands separator pattern
    const dotCount = (strValue.match(/\./g) || []).length;
    const afterLastDot = strValue.split('.').pop() || '';
    
    // If last part has exactly 3 digits, treat dots as thousands separators
    if (afterLastDot.length === 3 || dotCount > 1) {
      const normalized = strValue.replace(/\./g, '');
      return parseFloat(normalized) || 0;
    }
  }
  
  // Handle standard format
  return parseFloat(strValue) || 0;
}

/**
 * Validate that a number is within the acceptable range for budget values
 * @param value - The number to validate
 * @returns true if valid, false otherwise
 */
export function isValidBudgetAmount(value: number): boolean {
  return !isNaN(value) && value >= 0 && value <= 9999999999.99;
}

/**
 * Parse and validate a European formatted budget value
 * @param value - The European formatted string or number
 * @returns Parsed number if valid, null if invalid
 */
export function parseAndValidateBudgetAmount(value: string | number | null | undefined): number | null {
  const parsed = parseEuropeanNumber(value);
  return isValidBudgetAmount(parsed) ? parsed : null;
}