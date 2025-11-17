// ComprehensiveEditHelpers.ts
// Utilities, types, schema, and small reusable hooks/components extracted from the big component.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  parseEuropeanNumber,
  formatEuropeanNumber,
} from "@/lib/number-format";

// ───────────────────────────────────────────────────────────
// Interfaces (kept minimal – extend as needed)
// ───────────────────────────────────────────────────────────
export interface UnitData {
  id: number;
  name?: string;
  unit?: string;
  unit_name?: {
    name: string;
    prop: string;
  };
}

export interface EventTypeData {
  id: number;
  name: string;
}

export interface ExpenditureTypeData {
  id: number;
  expenditure_types?: string;
  expenditure_types_minor?: string;
  name?: string;
}

export interface ProjectData {
  id: number;
  mis: string;
  project_title?: string;
  event_description?: string;
  event_year?: string | number;
  status?: string;
  na853?: string;
  na271?: string;
  e069?: string;
  budget_na853?: number;
  budget_na271?: number;
  budget_e069?: number;
  enhanced_unit?: {
    name: string;
  };
}

// ───────────────────────────────────────────────────────────
// Form schema (copy from original if you need every field)
// ───────────────────────────────────────────────────────────
export const comprehensiveProjectSchema = z.object({
  decisions: z
    .array(
      z.object({
        protocol_number: z.string().default(""),
        fek: z
          .object({
            year: z.string().default(""),
            issue: z.string().default(""),
            number: z.string().default(""),
          })
          .default({ year: "", issue: "", number: "" }),
        ada: z.string().default(""),
        implementing_agency: z.array(z.number()).default([]),
        decision_budget: z.string().default(""),
        expenses_covered: z.string().default(""),
        expenditure_type: z.array(z.number()).default([]),
        decision_type: z
          .enum(["Έγκριση", "Τροποποίηση", "Παράταση"] as const)
          .default("Έγκριση"),
        included: z.boolean().default(true),
        comments: z.string().default(""),
      }),
    )
    .default([]),

  event_details: z
    .object({
      event_name: z.string().default(""),
      event_year: z.string().default(""),
    })
    .default({ event_name: "", event_year: "" }),

  location_details: z
    .array(
      z.object({
        implementing_agency: z.string().default(""),
        event_type: z.string().default(""),
        expenditure_types: z.array(z.string()).default([]),
        geographic_areas: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  project_details: z
    .object({
      mis: z.string().default(""),
      sa: z.string().default(""),
      inc_year: z.string().default(""),
      project_title: z.string().default(""),
      project_description: z.string().default(""),
      summary_description: z.string().default(""),
      expenses_executed: z.string().default(""),
      project_status: z.string().default("Ενεργό"),
    })
    .default({
      mis: "",
      sa: "",
      inc_year: "",
      project_title: "",
      project_description: "",
      summary_description: "",
      expenses_executed: "",
      project_status: "Ενεργό",
    }),

  previous_entries: z
    .array(
      z.object({
        mis: z.string().default(""),
        sa: z.string().default(""),
        inc_year: z.string().default(""),
        project_title: z.string().default(""),
        project_description: z.string().default(""),
        summary_description: z.string().default(""),
        expenses_executed: z.string().default(""),
        project_status: z.string().default("Ενεργό"),
      }),
    )
    .default([]),

  formulation_details: z
    .array(
      z.object({
        sa: z.enum(["ΝΑ853", "ΝΑ271", "E069"] as const).default("ΝΑ853"),
        enumeration_code: z.string().default(""),
        decision_year: z.string().default(""),
        decision_status: z
          .enum(["Ενεργή", "Ανενεργή", "Αναστολή"] as const)
          .default("Ενεργή"),
        change_type: z
          .enum(["Τροποποίηση", "Παράταση", "Έγκριση"] as const)
          .default("Έγκριση"),
        comments: z.string().default(""),
        budget_versions: z
          .object({
            pde: z
              .array(
                z.object({
                  version_number: z.coerce.string().default("1.0"),
                  boundary_budget: z.string().default(""),
                  protocol_number: z.string().default(""),
                  ada: z.string().default(""),
                  decision_date: z.string().default(""),
                  action_type: z
                    .enum(
                      ["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"] as const,
                    )
                    .default("Έγκριση"),
                  comments: z.string().default(""),
                }),
              )
              .default([]),
            epa: z
              .array(
                z.object({
                  version_number: z.coerce.string().default("1.0"),
                  epa_version: z.string().default(""),
                  protocol_number: z.string().default(""),
                  ada: z.string().default(""),
                  decision_date: z.string().default(""),
                  action_type: z
                    .enum(
                      ["Έγκριση", "Τροποποίηση", "Κλείσιμο στο ύψος πληρωμών"] as const,
                    )
                    .default("Έγκριση"),
                  comments: z.string().default(""),
                  financials: z
                    .array(
                      z.object({
                        year: z.number().min(2020).max(2050),
                        total_public_expense: z.string().default(""),
                        eligible_public_expense: z.string().default(""),
                      }),
                    )
                    .default([]),
                }),
              )
              .default([]),
          })
          .default({ pde: [], epa: [] }),
      }),
    )
    .default([]),

  changes: z
    .array(
      z.object({
        timestamp: z.string().default(""),
        user_id: z.number().optional(),
        user_name: z.string().default(""),
        change_type: z
          .enum(
            ["Initial Creation", "Budget Update", "Status Change", "Document Update", "Other"] as const,
          )
          .default("Other"),
        description: z.string().default(""),
        notes: z.string().default(""),
      }),
    )
    .default([
      {
        timestamp: new Date().toISOString(),
        user_name: "",
        change_type: "Other",
        description: "",
        notes: "",
      },
    ]),
});

export type ComprehensiveFormData = z.infer<typeof comprehensiveProjectSchema>;

// ───────────────────────────────────────────────────────────
// Small UI helpers / color helpers
// ───────────────────────────────────────────────────────────
export const getSAColor = (saType: string): string => {
  switch (saType) {
    case "ΝΑ853":
      return "blue";
    case "ΝΑ271":
      return "purple";
    case "E069":
      return "green";
    default:
      return "gray";
  }
};

export const getSABorderColor = (saType: string): string => {
  switch (saType) {
    case "ΝΑ853":
      return "border-l-blue-500";
    case "ΝΑ271":
      return "border-l-purple-500";
    case "E069":
      return "border-l-green-500";
    default:
      return "border-l-gray-500";
  }
};

export const getDecisionColor = (decisionType: string): string => {
  switch (decisionType) {
    case "Έγκριση":
      return "blue";
    case "Τροποποίηση":
      return "orange";
    case "Παράταση":
      return "gray";
    default:
      return "gray";
  }
};

export const getDecisionBorderColor = (decisionType: string): string => {
  switch (decisionType) {
    case "Έγκριση":
      return "border-l-blue-500";
    case "Τροποποίηση":
      return "border-l-orange-500";
    case "Παράταση":
      return "border-l-gray-500";
    default:
      return "border-l-gray-500";
  }
};

// ───────────────────────────────────────────────────────────
// EuropeanNumberInput
// ───────────────────────────────────────────────────────────
export function EuropeanNumberInput({
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  value: number | undefined | null;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState<string>(() =>
    value !== undefined && value !== null ? formatEuropeanNumber(value) : "",
  );

  useEffect(() => {
    const isThisInputFocused = document.activeElement === inputRef.current;
    if (!isThisInputFocused) {
      if (value !== undefined && value !== null) {
        setDisplayValue(formatEuropeanNumber(value));
      } else {
        setDisplayValue("");
      }
    }
  }, [value]);

  return (
    <Input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      value={displayValue}
      onChange={(e) => {
        const rawValue = e.target.value;
        setDisplayValue(rawValue);

        if (rawValue === "" || rawValue.trim() === "") {
          onChange(undefined);
          return;
        }

        const numericValue = parseEuropeanNumber(rawValue);
        if (!isNaN(numericValue)) {
          onChange(numericValue);
        }
      }}
      onBlur={() => {
        if (value !== undefined && value !== null) {
          setDisplayValue(formatEuropeanNumber(value));
        }
        onBlur?.();
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────
// SA validation hook (debounced) – identical behavior to original
// ───────────────────────────────────────────────────────────
export function useSAValidation() {
  const [validationStates, setValidationStates] = useState<
    Record<
      string,
      {
        isChecking: boolean;
        exists: boolean;
        existingProject?: {
          id: number;
          mis: number;
          project_title: string;
        };
      }
    >
  >({});

  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const validateSA = useCallback(
    async (saValue: string, fieldKey: string, currentMis?: string) => {
      if (timeoutRef.current[fieldKey]) {
        clearTimeout(timeoutRef.current[fieldKey]);
      }

      if (!saValue?.trim()) {
        setValidationStates((prev) => ({
          ...prev,
          [fieldKey]: { isChecking: false, exists: false },
        }));
        return;
      }

      setValidationStates((prev) => ({
        ...prev,
        [fieldKey]: { isChecking: true, exists: false },
      }));

      timeoutRef.current[fieldKey] = setTimeout(async () => {
        try {
          const response = (await apiRequest(
            `/api/projects/check-sa/${encodeURIComponent(saValue)}`,
          )) as any;

          let isSelfProject = false;
          if (currentMis && response.existingProject?.mis) {
            const currentMisStr = currentMis.toString().trim();
            const existingMisStr = response.existingProject.mis
              .toString()
              .trim();
            isSelfProject = currentMisStr === existingMisStr;
          }

          setValidationStates((prev) => ({
            ...prev,
            [fieldKey]: {
              isChecking: false,
              exists: response.exists && !isSelfProject,
              existingProject: response.existingProject,
            },
          }));
        } catch {
          setValidationStates((prev) => ({
            ...prev,
            [fieldKey]: { isChecking: false, exists: false },
          }));
        }
      }, 500);
    },
    [],
  );

  const getValidationState = (fieldKey: string) => {
    return validationStates[fieldKey] || { isChecking: false, exists: false };
  };

  useEffect(() => {
    return () => {
      Object.values(timeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  return { validateSA, getValidationState };
}

// ───────────────────────────────────────────────────────────
// Misc helpers from original
// ───────────────────────────────────────────────────────────
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

export function generateEnumerationCode(
  saType: string,
  currentCode?: string,
  existingCodes?: Record<string, string>,
): string {
  if (existingCodes && existingCodes[saType]) {
    return existingCodes[saType];
  }

  if (currentCode) {
    const patterns = {
      ΝΑ853: /^\d{4}ΝΑ853\d{8}$/,
      ΝΑ271: /^\d{4}ΝΑ271\d{8}$/,
      E069: /^\d{4}E069\d{8}$/,
    } as const;

    if ((patterns as any)[saType]?.test(currentCode)) {
      return currentCode;
    }
  }

  const currentYear = new Date().getFullYear();
  const sequentialNumber = Math.floor(Math.random() * 99999999)
    .toString()
    .padStart(8, "0");

  return `${currentYear}${saType}${sequentialNumber}`;
}

export function normalizeFekData(fekValue: any): {
  year: string;
  issue: string;
  number: string;
} {
  if (!fekValue) return { year: "", issue: "", number: "" };
  if (typeof fekValue === "object" && fekValue.year !== undefined) {
    return {
      year: String(fekValue.year || ""),
      issue: String(fekValue.issue || ""),
      number: String(fekValue.number || ""),
    };
  }
  if (typeof fekValue === "string") {
    return { year: "", issue: "", number: "" };
  }
  if (Array.isArray(fekValue) && fekValue.length > 0 && typeof fekValue[0] === "object") {
    const obj = fekValue[0];
    return {
      year: String(obj.year || ""),
      issue: String(obj.issue || ""),
      number: String(obj.number || ""),
    };
  }
  return { year: "", issue: "", number: "" };
}


// ───────────────────────────────────────────────────────────
// Extracted from src: validateAndLimitNumericInput
// ───────────────────────────────────────────────────────────
export const validateAndLimitNumericInput = (
    value: string,
    fieldName: string,
  ): string => {
    const parsed = parseEuropeanNumber(value);
    if (parsed && parsed > 9999999999.99) {
      console.warn(
        `${fieldName} value ${parsed} exceeds database limit, limiting input`,
      );
      toast({
        title: "Προσοχή",
        description: `${fieldName}: Το ποσό περιορίστηκε στο μέγιστο επιτρεπτό όριο (9.999.999.999,99 €)`,
        variant: "destructive",
      });
      return formatEuropeanNumber(9999999999.99);
    }
    return value;
  };


// ───────────────────────────────────────────────────────────
// Extracted from main: validateAndLimitNumericInput
// ───────────────────────────────────────────────────────────
export const validateAndLimitNumericInput = (
    value: string,
    fieldName: string,
  ): string => {
    const parsed = parseEuropeanNumber(value);
    if (parsed && parsed > 9999999999.99) {
      console.warn(
        `${fieldName} value ${parsed} exceeds database limit, limiting input`,
      );
      toast({
        title: "Προσοχή",
        description: `${fieldName}: Το ποσό περιορίστηκε στο μέγιστο επιτρεπτό όριο (9.999.999.999,99 €)`,
        variant: "destructive",
      });
      return formatEuropeanNumber(9999999999.99);
    }
    return value;
  };
