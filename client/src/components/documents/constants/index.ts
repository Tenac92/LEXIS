// Document creation constants
export const DKA_TYPES = ["ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ", "ΔΚΑ ΕΠΙΣΚΕΥΗ", "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ"];
export const DKA_INSTALLMENTS = ["ΕΦΑΠΑΞ", "Α", "Β", "Γ", "Α συμπληρωματική", "Β συμπληρωματική", "Γ συμπληρωματική"];
export const ALL_INSTALLMENTS = ["ΕΦΑΠΑΞ", "Α", "Β", "Γ", "Α συμπληρωματική", "Β συμπληρωματική", "Γ συμπληρωματική"];

// Housing allowance constants
export const HOUSING_ALLOWANCE_TYPE = "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ";
export const HOUSING_QUARTERS = Array.from({ length: 24 }, (_, i) => `ΤΡΙΜΗΝΟ ${i + 1}`);
export const STANDARD_QUARTER_AMOUNT = 900.00;

// ΕΚΤΟΣ ΕΔΡΑΣ constants
export const EKTOS_EDRAS_TYPE = "ΕΚΤΟΣ ΕΔΡΑΣ";
export const GREEK_MONTHS = [
  "ΙΑΝΟΥΑΡΙΟΣ", "ΦΕΒΡΟΥΑΡΙΟΣ", "ΜΑΡΤΙΟΣ", "ΑΠΡΙΛΙΟΣ", "ΜΑΪΟΣ", "ΙΟΥΝΙΟΣ",
  "ΙΟΥΛΙΟΣ", "ΑΥΓΟΥΣΤΟΣ", "ΣΕΠΤΕΜΒΡΙΟΣ", "ΟΚΤΩΒΡΙΟΣ", "ΝΟΕΜΒΡΙΟΣ", "ΔΕΚΕΜΒΡΙΟΣ"
];
export const DEFAULT_PRICE_PER_KM = 0.20;

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