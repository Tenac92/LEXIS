// Document creation constants
export const DKA_TYPES = ["ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ", "ΔΚΑ ΕΠΙΣΚΕΥΗ", "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ"];
export const DKA_INSTALLMENTS = ["ΕΦΑΠΑΞ", "Α", "Α συμπληρωματική", "Β", "Β συμπληρωματική", "Γ", "Γ συμπληρωματική"];
export const ALL_INSTALLMENTS = ["ΕΦΑΠΑΞ", "Α", "Α συμπληρωματική", "Β", "Β συμπληρωματική", "Γ", "Γ συμπληρωματική"];

// Housing allowance constants
export const HOUSING_ALLOWANCE_TYPE = "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ";
export const HOUSING_QUARTERS = Array.from({ length: 24 }, (_, i) => `ΤΡΙΜΗΝΟ ${i + 1}`);
export const STANDARD_QUARTER_AMOUNT = 900.00;

// Step configuration
export const STEPS = {
  UNIT_PROJECT: 0,
  EXPENDITURE_INSTALLMENTS: 1,
  RECIPIENTS: 2,
  DISTRIBUTION: 3,
  SUMMARY: 4
} as const;

export const STEP_TITLES = {
  [STEPS.UNIT_PROJECT]: "Επιλογή Μονάδας & Έργου",
  [STEPS.EXPENDITURE_INSTALLMENTS]: "Τύπος Δαπάνης & Δόσεις",
  [STEPS.RECIPIENTS]: "Δικαιούχοι",
  [STEPS.DISTRIBUTION]: "Διανομή",
  [STEPS.SUMMARY]: "Επισκόπηση"
} as const;