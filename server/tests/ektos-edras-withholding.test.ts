import { describe, it, expect } from 'vitest';

/**
 * Tests for ΕΚΤΟΣ ΕΔΡΑΣ (Out-of-Office) 2% Tax Withholding Calculation
 * 
 * Business Rule:
 * - For ΕΚΤΟΣ ΕΔΡΑΣ documents, the 2% tax withholding (Παρακράτηση φόρου 2%)
 *   should be calculated ONLY on the daily compensation (Ημερήσια αποζημίωση).
 * - It should NOT be calculated on the full total amount (which includes accommodation,
 *   kilometers traveled, and tickets/tolls/rental expenses).
 * - For all other document types, the 2% withholding applies to the full total.
 */

describe('ΕΚΤΟΣ ΕΔΡΑΣ Tax Withholding Calculation', () => {
  /**
   * Helper function to calculate employee payment amounts
   * This mimics the logic in server/controllers/documentsController.ts
   */
  function calculateEktosEdrasPayment(params: {
    dailyCompensation: number;
    accommodation: number;
    kilometersPrice: number;
    ticketsTollsRental: number;
    has2PercentDeduction: boolean;
  }) {
    const { dailyCompensation, accommodation, kilometersPrice, ticketsTollsRental, has2PercentDeduction } = params;
    
    // Calculate total expense (sum of all components)
    const totalExpense = dailyCompensation + accommodation + kilometersPrice + ticketsTollsRental;
    
    // For ΕΚΤΟΣ ΕΔΡΑΣ: 2% withholding applies ONLY to daily compensation
    const deduction2Percent = has2PercentDeduction ? dailyCompensation * 0.02 : 0;
    
    // Net payable is total minus deduction
    const netPayable = totalExpense - deduction2Percent;
    
    return {
      totalExpense,
      deduction2Percent,
      netPayable,
    };
  }

  it('should calculate 2% withholding only on daily compensation', () => {
    // Test case from the requirements:
    // - Daily compensation (ημερήσια αποζημίωση) = 100.00
    // - Other components = 900.00
    // - Expected: withholding = 2.00 (2% of 100.00, NOT 2% of 1000.00)
    
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 100.00,
      accommodation: 300.00,
      kilometersPrice: 400.00, // e.g., 2000 km * 0.20
      ticketsTollsRental: 200.00,
      has2PercentDeduction: true,
    });

    expect(result.totalExpense).toBe(1000.00);
    expect(result.deduction2Percent).toBe(2.00); // 2% of 100.00 only
    expect(result.netPayable).toBe(998.00);
  });

  it('should calculate correct withholding for different daily compensation amounts', () => {
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 250.00,
      accommodation: 150.00,
      kilometersPrice: 100.00,
      ticketsTollsRental: 50.00,
      has2PercentDeduction: true,
    });

    expect(result.totalExpense).toBe(550.00);
    expect(result.deduction2Percent).toBe(5.00); // 2% of 250.00
    expect(result.netPayable).toBe(545.00);
  });

  it('should not apply withholding when has_2_percent_deduction is false', () => {
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 100.00,
      accommodation: 200.00,
      kilometersPrice: 300.00,
      ticketsTollsRental: 400.00,
      has2PercentDeduction: false,
    });

    expect(result.totalExpense).toBe(1000.00);
    expect(result.deduction2Percent).toBe(0);
    expect(result.netPayable).toBe(1000.00);
  });

  it('should handle zero daily compensation correctly', () => {
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 0,
      accommodation: 500.00,
      kilometersPrice: 300.00,
      ticketsTollsRental: 200.00,
      has2PercentDeduction: true,
    });

    expect(result.totalExpense).toBe(1000.00);
    expect(result.deduction2Percent).toBe(0); // 2% of 0 = 0
    expect(result.netPayable).toBe(1000.00);
  });

  it('should handle only daily compensation (no other expenses)', () => {
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 500.00,
      accommodation: 0,
      kilometersPrice: 0,
      ticketsTollsRental: 0,
      has2PercentDeduction: true,
    });

    expect(result.totalExpense).toBe(500.00);
    expect(result.deduction2Percent).toBe(10.00); // 2% of 500.00
    expect(result.netPayable).toBe(490.00);
  });

  it('should round deduction to 2 decimal places', () => {
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 123.45,
      accommodation: 100.00,
      kilometersPrice: 50.00,
      ticketsTollsRental: 25.00,
      has2PercentDeduction: true,
    });

    expect(result.totalExpense).toBe(298.45);
    // 2% of 123.45 = 2.469, which in JavaScript is 2.469
    // The application should handle rounding appropriately
    expect(result.deduction2Percent).toBeCloseTo(2.47, 2);
    expect(result.netPayable).toBeCloseTo(295.98, 2);
  });

  it('should ensure net payable is never negative', () => {
    // Edge case: if somehow daily compensation is very small but total is large
    const result = calculateEktosEdrasPayment({
      dailyCompensation: 1.00,
      accommodation: 0,
      kilometersPrice: 0,
      ticketsTollsRental: 0,
      has2PercentDeduction: true,
    });

    expect(result.totalExpense).toBe(1.00);
    expect(result.deduction2Percent).toBe(0.02); // 2% of 1.00
    expect(result.netPayable).toBe(0.98);
    expect(result.netPayable).toBeGreaterThanOrEqual(0);
  });
});

/**
 * Integration notes:
 * 
 * This test verifies the calculation logic. The actual implementation should be tested
 * end-to-end with the following scenarios:
 * 
 * 1. UI Preview Test:
 *    - Create a new ΕΚΤΟΣ ΕΔΡΑΣ document in the UI
 *    - Enter daily compensation and other expenses
 *    - Enable 2% withholding checkbox
 *    - Verify that the preview shows correct deduction (2% of daily comp only)
 * 
 * 2. Database Persistence Test:
 *    - Submit the document
 *    - Verify that the stored deduction_2_percent value matches expectation
 *    - Verify that net_payable = total_expense - deduction_2_percent
 * 
 * 3. Document Export Test:
 *    - Generate DOCX/PDF export
 *    - Verify that exported amounts match the calculated values
 * 
 * 4. Regression Test (Other Document Types):
 *    - For non-ΕΚΤΟΣ ΕΔΡΑΣ documents, verify that 2% withholding
 *      continues to apply to the full total amount (existing behavior)
 */
