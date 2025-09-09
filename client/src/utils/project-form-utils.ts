// Shared utilities for project forms (both new and edit)

// Helper function to safely convert array or object fields to text
export function safeText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "Δεν υπάρχει";
    if (value.length === 1) return String(value[0]);
    return value.join(", ");
  }
  return "";
}

// Helper function to generate enumeration code based on ΣΑ type
export function generateEnumerationCode(
  saType: string, 
  currentCode?: string, 
  existingCodes?: Record<string, string>
): string {
  // If we have an existing enumeration code for this ΣΑ type, use it
  if (existingCodes && existingCodes[saType]) {
    return existingCodes[saType];
  }

  // If there's already a code and it matches the pattern for the selected ΣΑ, keep it
  if (currentCode) {
    const patterns = {
      ΝΑ853: /^\d{4}ΝΑ853\d{8}$/,
      ΝΑ271: /^\d{4}ΝΑ271\d{8}$/,
      E069: /^\d{4}E069\d{8}$/,
    };

    if (patterns[saType as keyof typeof patterns]?.test(currentCode)) {
      return currentCode;
    }
  }

  // Generate new code if no existing data found
  const currentYear = new Date().getFullYear();
  const sequentialNumber = Math.floor(Math.random() * 99999999)
    .toString()
    .padStart(8, "0");

  return `${currentYear}${saType}${sequentialNumber}`;
}

// Helper function to convert FEK data from old string format to new object format
export function normalizeFekData(fekValue: any): {
  year: string;
  issue: string;
  number: string;
} {
  if (!fekValue) return { year: "", issue: "", number: "" };

  // If it's already an object with the new format
  if (typeof fekValue === "object" && fekValue.year !== undefined) {
    return {
      year: String(fekValue.year || ""),
      issue: String(fekValue.issue || ""),
      number: String(fekValue.number || ""),
    };
  }

  // If it's a string (old format), return empty object for now
  if (typeof fekValue === "string") {
    return { year: "", issue: "", number: "" };
  }

  // If it's an array (from JSONB), take the first element if it's an object
  if (
    Array.isArray(fekValue) &&
    fekValue.length > 0 &&
    typeof fekValue[0] === "object"
  ) {
    const obj = fekValue[0];
    return {
      year: String(obj.year || ""),
      issue: String(obj.issue || ""),
      number: String(obj.number || ""),
    };
  }

  return { year: "", issue: "", number: "" };
}

// Helper to validate and limit numeric input to database constraints
export function validateAndLimitNumericInput(
  value: string,
  fieldName: string,
  onToast: (data: { title: string; description: string; variant?: "destructive" }) => void
): string {
  // Import parseEuropeanNumber and formatEuropeanNumber from existing number format utils
  const parseEuropeanNumber = (value: string): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const formatEuropeanNumber = (value: number): string => {
    return value.toLocaleString('el-GR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const parsed = parseEuropeanNumber(value);
  if (parsed && parsed > 9999999999.99) {
    console.warn(
      `${fieldName} value ${parsed} exceeds database limit, limiting input`
    );
    onToast({
      title: "Προσοχή",
      description: `${fieldName}: Το ποσό περιορίστηκε στο μέγιστο επιτρεπτό όριο (9.999.999.999,99 €)`,
      variant: "destructive",
    });
    return formatEuropeanNumber(9999999999.99);
  }
  return value;
}

// Generate year options for FEK year select
export function generateYearOptions(): Array<{ value: string; label: string }> {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < currentYear - 1899; i++) {
    const year = currentYear - i;
    years.push({
      value: year.toString(),
      label: year.toString()
    });
  }
  return years;
}

// FEK issue options
export const FEK_ISSUES = [
  { value: "Α", label: "Α" },
  { value: "Β", label: "Β" },
  { value: "Γ", label: "Γ" },
  { value: "Δ", label: "Δ" },
] as const;

// Decision type options
export const DECISION_TYPES = [
  { value: "Έγκριση", label: "Έγκριση" },
  { value: "Τροποποίηση", label: "Τροποποίηση" },
  { value: "Παράταση", label: "Παράταση" },
] as const;

// Project status options
export const PROJECT_STATUS_OPTIONS = [
  { value: "Ενεργό", label: "Ενεργό" },
  { value: "Συμπληρωμένο", label: "Συμπληρωμένο" },
  { value: "Ανενεργό", label: "Ανενεργό" },
] as const;

// ΣΑ type options
export const SA_TYPE_OPTIONS = [
  { value: "ΝΑ853", label: "ΝΑ853" },
  { value: "ΝΑ271", label: "ΝΑ271" },
  { value: "E069", label: "E069" },
] as const;

// Decision status options
export const DECISION_STATUS_OPTIONS = [
  { value: "Ενεργή", label: "Ενεργή" },
  { value: "Ανενεργή", label: "Ανενεργή" },
  { value: "Αναστολή", label: "Αναστολή" },
] as const;

// Change type options for formulations
export const FORMULATION_CHANGE_TYPES = [
  { value: "Έγκριση", label: "Έγκριση" },
  { value: "Τροποποίηση", label: "Τροποποίηση" },
  { value: "Παράταση", label: "Παράταση" },
] as const;

// Budget version decision types
export const BUDGET_VERSION_DECISION_TYPES = [
  { value: "Έγκριση", label: "Έγκριση" },
  { value: "Τροποποίηση", label: "Τροποποίηση" },
  { value: "Κλείσιμο στο ύψος πληρωμών", label: "Κλείσιμο στο ύψος πληρωμών" },
] as const;

// Change tracking types
export const CHANGE_TYPES = [
  { value: "Initial Creation", label: "Αρχική Δημιουργία" },
  { value: "Budget Update", label: "Ενημέρωση Προϋπολογισμού" },
  { value: "Status Change", label: "Αλλαγή Κατάστασης" },
  { value: "Document Update", label: "Ενημέρωση Εγγράφων" },
  { value: "Other", label: "Άλλο" },
] as const;