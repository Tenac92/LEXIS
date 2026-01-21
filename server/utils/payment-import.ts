import * as XLSX from "xlsx";

export const REQUIRED_PAYMENT_HEADERS = {
  protocol: "Αριθμός Παραστατικού",
  afm: "ΑΦΜ Δικαιούχου Πληρωμής",
  date: "Ημ/νία Πρωτοκόλλου/Εντάλματος",
  eps: "EPS",
};

const NBSP = "\u00A0";

export function normalizeHeader(input: unknown): string {
  return String(input ?? "")
    .replaceAll(NBSP, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProtocol(input: unknown): {
  strict: string | null;
  loose: string | null;
} {
  const strict = normalizeHeader(input);
  if (!strict) {
    return { strict: null, loose: null };
  }
  const loose = strict.replace(/\s+/g, "");
  return { strict, loose };
}

export function normalizeAfm(input: unknown): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length > 9) {
    return null;
  }

  return digits.padStart(9, "0");
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseExcelDate(input: unknown): Date | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return null;
    }
    return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
      return null;
    }
    if (!isValidDateParts(parsed.y, parsed.m, parsed.d)) {
      return null;
    }
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      const parsed = XLSX.SSF.parse_date_code(asNumber);
      if (parsed && parsed.y && parsed.m && parsed.d && isValidDateParts(parsed.y, parsed.m, parsed.d)) {
        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      }
    }
  }

  const isoMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidDateParts(year, month, day)) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (!isValidDateParts(year, month, day)) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  return null;
}

export function formatDateForDb(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extract protocol candidate numbers from Excel "Αριθμός Παραστατικού" column.
 * Handles cases like "Ορθή Επανάληψη" where multiple protocol numbers are present:
 *   - "67501 Ο.Ε.(64379 Ο.Ε.63759)" → ["67501","64379","63759"]
 *   - "78235 ΟΕ 73175" → ["78235","73175"]
 *   - "  00012  Ο.Ε  " → ["00012"]  (preserves leading zeros)
 *
 * @param input Unknown input (typically from Excel cell)
 * @returns Array of unique protocol number strings (in order of first occurrence), preserving leading zeros
 */
export function extractProtocolCandidates(input: unknown): string[] {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return [];
  }

  // Extract all digit sequences using regex
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) {
    return [];
  }

  // Return unique values preserving order of first occurrence
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of matches) {
    if (!seen.has(match)) {
      seen.add(match);
      result.push(match);
    }
  }
  return result;
}
