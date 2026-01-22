import ExcelJS from 'exceljs';

export interface ExcelReadLimits {
  maxRows?: number; // maximum rows to read (including header)
  maxCols?: number; // maximum columns to read
  maxSheets?: number; // maximum sheets allowed (we only read first)
}

function normalizeCellValue(value: ExcelJS.CellValue): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  // For objects (e.g., formula, rich text), prefer the computed result if present
  const anyVal = value as any;
  if (anyVal && typeof anyVal === 'object') {
    if ('result' in anyVal && anyVal.result !== undefined) return anyVal.result;
    if ('text' in anyVal && typeof anyVal.text === 'string') return anyVal.text;
  }
  return String(value);
}

/**
 * Read an XLSX buffer into a 2D array of cell values using exceljs, with basic hardening.
 * - Limits sheets/rows/columns to prevent resource exhaustion
 * - Does not evaluate formulas
 */
export async function readXlsxToRows(buffer: Buffer, limits: ExcelReadLimits = {}): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const maxSheets = limits.maxSheets ?? 5;
  if (workbook.worksheets.length === 0) {
    throw new Error('No worksheet found in the uploaded file');
  }
  if (workbook.worksheets.length > maxSheets) {
    throw new Error(`Too many worksheets (${workbook.worksheets.length}). Max allowed is ${maxSheets}.`);
  }

  const sheet = workbook.worksheets[0];
  const columnCount = sheet.columnCount || 0;
  const rowCount = sheet.rowCount || 0;

  const maxCols = limits.maxCols ?? Math.max(1, columnCount);
  const maxRows = limits.maxRows ?? Math.max(1, rowCount);

  const cols = Math.min(columnCount, maxCols);
  const rows = Math.min(rowCount, maxRows);

  if (cols <= 0 || rows <= 0) {
    throw new Error('Worksheet appears to be empty');
  }

  const result: unknown[][] = [];
  for (let r = 1; r <= rows; r++) {
    const row = sheet.getRow(r);
    const values: unknown[] = [];
    for (let c = 1; c <= cols; c++) {
      values.push(normalizeCellValue(row.getCell(c).value));
    }
    result.push(values);
  }

  return result;
}
