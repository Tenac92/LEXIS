const ExcelJS = require('exceljs');
import { ErrorHandler } from '../../utils/errorHandler.js';
import { getAuthToken } from '../../utils/auth.js';

export class CsvUploadManager {
  constructor() {
    this.uploadUrl = '/api/budget/csv-upload';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.allowedTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];
    this.encodings = ['UTF-8', 'UTF-16LE', 'windows-1253', 'ISO-8859-7'];
  }

  validateFile(file) {
    if (!file) {
      throw new Error('No file selected');
    }

    if (!file.name?.toLowerCase().endsWith('.csv')) {
      throw new Error('Invalid file type. Please select a CSV file');
    }

    if (!file.size || file.size === 0) {
      throw new Error('File is empty');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`);
    }

    return true;
  }

  async handleFileUpload(file) {
    try {
      const workbook = new ExcelJS.Workbook();

      if (file.name.endsWith('.csv')) {
        await workbook.csv.load(file);
      } else {
        await workbook.xlsx.load(file);
      }

      const worksheet = workbook.worksheets[0];
      const rows = [];
      const headers = [];

      worksheet.getRow(1).eachCell((cell) => {
        headers.push(cell.value);
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowData = {};
        row.eachCell((cell, colNumber) => {
          rowData[headers[colNumber - 1]] = cell.value;
        });
        rows.push(rowData);
      });

      return { headers, rows };
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error('Failed to process file');
    }
  }
}

module.exports = CsvUploadManager;