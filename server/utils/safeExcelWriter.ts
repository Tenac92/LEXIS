import ExcelJS from 'exceljs';

/**
 * Create a simple empty workbook with a message sheet.
 * Useful for sending "no data" responses.
 */
export async function createEmptyWorkbook(message: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Κενό');
  sheet.addRow(['Μήνυμα']);
  sheet.addRow([message]);
  sheet.getColumn(1).width = 60;
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Create a workbook from multiple data arrays with sheet names.
 * Safer alternative to xlsx for export scenarios.
 */
export async function createWorkbookFromData(
  sheets: Array<{ name: string; data: Record<string, any>[]; currencyColumns?: string[] }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const { name, data, currencyColumns = [] } of sheets) {
    if (data.length === 0) continue;

    const sheet = workbook.addWorksheet(name);
    const headers = Object.keys(data[0]);
    sheet.addRow(headers);

    for (const row of data) {
      const values = headers.map((h) => row[h] ?? '');
      sheet.addRow(values);
    }

    // Apply column widths
    sheet.columns = headers.map((h) => ({
      key: h,
      width: h.length < 12 ? 15 : h.length + 5,
    }));

    // Apply currency formatting to specified columns
    if (currencyColumns.length > 0) {
      const currencyColIndices = currencyColumns
        .map((col) => headers.indexOf(col) + 1)
        .filter((i) => i > 0);

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        currencyColIndices.forEach((colIndex) => {
          const cell = row.getCell(colIndex);
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          }
        });
      });
    }
  }

  // If no sheets added, add a fallback empty sheet
  if (workbook.worksheets.length === 0) {
    const sheet = workbook.addWorksheet('Κενό');
    sheet.addRow(['Μήνυμα']);
    sheet.addRow(['Δεν βρέθηκαν δεδομένα με τα επιλεγμένα κριτήρια αναζήτησης']);
    sheet.getColumn(1).width = 60;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Helper to send an Excel buffer as a downloadable response.
 */
export function sendExcelResponse(
  res: any,
  buffer: Buffer,
  filename: string
): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length.toString());
  res.end(buffer);
}
