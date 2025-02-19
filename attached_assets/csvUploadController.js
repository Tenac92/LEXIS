const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware.js");
const { supabase } = require("../config/db.js");
const router = express.Router();
const { ApiErrorHandler } = require('../utils/apiErrorHandler');

const CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // Increased to 50MB
  CHUNK_SIZE: 1000, // Process 1000 rows at a time
  DELIMITER: ';',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

const REQUIRED_HEADERS = [
  'Κωδικός Έργου',
  'Προϋπολογισμός',
  'Ετήσια Πιστωση',
  'Πίστωση Q1',
  'Πίστωση Q2',
  'Πίστωση Q3',
  'Πίστωση Q4',
  'Κατανομές Έτους',
  'Κωδικοί MIS'
];

class CsvProcessor {
  static async processWithRetry(fn, retryCount = 0) {
    try {
      return await fn();
    } catch (error) {
      if (retryCount < CONFIG.RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        return this.processWithRetry(fn, retryCount + 1);
      }
      throw error;
    }
  }

  static async processBatch(rows, startIndex) {
    const results = { success: [], errors: [], skipped: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        this.validateRow(row); //Added this line for validation before processing
        const budgetData = {
          na853: row['Κωδικός Έργου']?.trim(),
          proip: this.cleanNumericValue(row['Προϋπολογισμός']),
          ethsia_pistosi: this.cleanNumericValue(row['Ετήσια Πιστωση']),
          q1: this.cleanNumericValue(row['Πίστωση Q1']),
          q2: this.cleanNumericValue(row['Πίστωση Q2']),
          q3: this.cleanNumericValue(row['Πίστωση Q3']),
          q4: this.cleanNumericValue(row['Πίστωση Q4']),
          katanomes_etous: this.cleanNumericValue(row['Κατανομές Έτους']),
          mis: row['Κωδικοί MIS']?.trim(),
          last_updated: new Date().toISOString()
        };

        await this.processWithRetry(async () => {
          const { data: existing } = await supabase
            .from('budget_na853_split')
            .select('*')
            .eq('na853', budgetData.na853)
            .single();

          if (!existing) {
            const { error } = await supabase
              .from('budget_na853_split')
              .insert([budgetData]);
            if (error) throw error;
            results.success.push(budgetData.na853);
          } else {
            const { error } = await supabase
              .from('budget_na853_split')
              .update({
                ...budgetData,
                user_view: existing.user_view || budgetData.katanomes_etous
              })
              .eq('na853', budgetData.na853);
            if (error) throw error;
            results.skipped.push(budgetData.na853);
          }
        });
      } catch (error) {
        results.errors.push({
          row: startIndex + i + 1,
          na853: row['Κωδικός Έργου'] || 'Unknown',
          error: error.message
        });
      }
    }
    return results;
  }

  static cleanNumericValue(value) {
    if (!value) return 0;
    // Handle both . and , as decimal separators
    const cleaned = value.toString()
      .replace(/[^0-9,.-]/g, '')
      .replace(/,(\d+)$/, '.$1'); // Only replace comma if it's followed by decimal places
    return parseFloat(cleaned) || 0;
  }

  static validateRow(row) {
    if (!row['Κωδικός Έργου']?.trim()) {
      throw new Error('Missing project code');
    }
    const numericFields = [
      'Προϋπολογισμός',
      'Ετήσια Πιστωση',
      'Πίστωση Q1',
      'Πίστωση Q2',
      'Πίστωση Q3',
      'Πίστωση Q4',
      'Κατανομές Έτους'
    ];
    numericFields.forEach(field => {
      const value = this.cleanNumericValue(row[field]);
      if (isNaN(value)) {
        throw new Error(`Invalid numeric value for ${field}`);
      }
    });
  }
}

router.post("/", authenticateToken, async (req, res) => {
  const startTime = performance.now();
  const results = { success: [], errors: [], skipped: [] };
  const progressUpdates = [];

  try {
    if (!req.files || !req.files.file) {
      throw new Error("No file uploaded");
    }
    const file = req.files.file;
    if (!file.data) {
      throw new Error("No file data received");
    }
    if (!Buffer.isBuffer(file.data)) {
      file.data = Buffer.from(file.data);
    }
    if (file.data.length === 0) {
      throw new Error("Empty file received");
    }
    if (file.mimetype !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      throw new Error("Invalid file type. Please upload a CSV file");
    }
    console.log('File info:', { 
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      dataLength: file.data.length 
    });

    let buffer;
    try {
      // Handle raw file data
      if (file.data instanceof Buffer) {
        buffer = file.data;
      } else if (file.data instanceof Uint8Array) {
        buffer = Buffer.from(file.data);
      } else if (typeof file.data === 'string') {
        buffer = Buffer.from(file.data, 'utf8');
      } else {
        // Try to get the raw data
        buffer = file.data.buffer || file.data;
        if (!(buffer instanceof Buffer)) {
          buffer = Buffer.from(buffer);
        }
      }

      console.log('Buffer created:', {
        size: buffer.length,
        isBuffer: Buffer.isBuffer(buffer),
        type: typeof file.data,
        dataType: file.data.constructor.name
      });

      if (buffer.length === 0) {
        throw new Error('Empty file data received');
      }
    } catch (error) {
      console.error('Error processing file data:', error);
      throw new Error('Failed to process file data: ' + error.message);
    }

    console.log('Buffer size:', buffer.length, 'bytes');
    console.log('Buffer size:', buffer.length, 'bytes');

    let fileContent;
    // First try to detect BOM for UTF-16/UTF-8
    if (buffer.length >= 2) {
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        fileContent = buffer.toString('utf16le');
      } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        fileContent = buffer.swap16().toString('utf16le');
      }
    }

    // If no BOM detected, try different encodings
    if (!fileContent) {
      const encodings = ['utf8', 'utf16le', 'latin1', 'windows-1253', 'iso-8859-7', 'ascii'];
      for (const encoding of encodings) {
        try {
          const content = buffer.toString(encoding);
          if (content && content.trim().length > 0 && 
              !content.includes('�') && 
              content.split('\n')[0].includes(CONFIG.DELIMITER)) {
            fileContent = content;
            console.log(`Successfully decoded using ${encoding}`);
            break;
          }
        } catch (e) {
          console.warn(`Failed with ${encoding}:`, e);
        }
      }
    }

    if (!fileContent || !fileContent.trim()) {
      console.error('Sample of problematic content:', buffer.slice(0, 50).toString('hex'));
      throw new Error('Could not read file content - invalid encoding or format');
    }

    const lines = fileContent.split('\n')
      .map(line => line?.trim())
      .filter(Boolean);

    if (!lines.length) throw new Error('No valid lines found');

    const headers = lines[0].split(CONFIG.DELIMITER)
      .map(h => h?.trim())
      .filter(Boolean);

    if (!headers.length) throw new Error('No valid headers found');

    CsvProcessor.validateHeaders(headers); //Added this line for header validation

    const rows = lines.slice(1).map(line => {
      const values = line.split(CONFIG.DELIMITER).map(v => v.trim());
      return headers.reduce((obj, header, i) => {
        obj[header] = values[i] || '';
        return obj;
      }, {});
    });

    // Process in chunks
    for (let i = 0; i < rows.length; i += CONFIG.CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CONFIG.CHUNK_SIZE);
      const chunkResult = await CsvProcessor.processBatch(chunk, i);

      results.success.push(...chunkResult.success);
      results.errors.push(...chunkResult.errors);
      results.skipped.push(...chunkResult.skipped);

      const progress = Math.round((i + chunk.length) / rows.length * 100);
      progressUpdates.push({
        processed: i + chunk.length,
        total: rows.length,
        progress: `${progress}%`
      });
    }

    const endTime = performance.now();
    res.json({
      status: 'success',
      message: "Processing completed",
      processingTime: `${Math.round(endTime - startTime)}ms`,
      stats: {
        total: rows.length,
        updated: results.success.length,
        skipped: results.skipped.length,
        failed: results.errors.length
      },
      progress: progressUpdates,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    console.error('CSV processing error:', error);
    ApiErrorHandler.handleError(error, req, res);
  }
});

module.exports = router;

// Added validateHeaders function to match the original code's functionality
CsvProcessor.validateHeaders = function(headers) {
  const normalizedHeaders = headers.map(h => h.normalize('NFD').toLowerCase().trim());
  const missingHeaders = REQUIRED_HEADERS.filter(required => 
    !normalizedHeaders.some(h => h === required.normalize('NFD').toLowerCase())
  );

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }
  return normalizedHeaders;
};