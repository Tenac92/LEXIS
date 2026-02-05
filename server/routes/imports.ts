import { Router, Response } from "express";
import multer from "multer";
import { readXlsxToRows } from "../utils/safeExcel";
import {
  AuthenticatedRequest,
  authenticateSession,
  requireAdmin,
} from "../authentication";
import { supabase } from "../config/db";
import { decryptAFM } from "../utils/crypto";
import { createLogger } from "../utils/logger";
import {
  REQUIRED_PAYMENT_HEADERS,
  extractProtocolCandidates,
  formatDateForDb,
  normalizeAfm,
  normalizeHeader,
  normalizeProtocol,
  parseExcelDate,
} from "../utils/payment-import";

const logger = createLogger("PaymentsImport");
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const MAX_ROWS = 20000;
const CHUNK_SIZE = 500;

interface ParsedRow {
  rowNumber: number;
  protocolCandidates: string[]; // All protocol candidates from Excel cell (in order)
  selectedProtocol?: string; // The protocol that matched (set during matching phase)
  afm: string;
  paymentDate: string;
  eps: string | null;
}

interface ImportReport {
  total_rows: number;
  matched_rows: number;
  updated_rows: number;
  updated_payments: number;
  skipped_rows: Array<{ row: number; reason: string; details?: string }>;
  error_rows: Array<{ row: number; error: string; details?: string }>;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

router.post(
  "/payments-from-excel",
  authenticateSession,
  requireAdmin,
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    const report: ImportReport = {
      total_rows: 0,
      matched_rows: 0,
      updated_rows: 0,
      updated_payments: 0,
      skipped_rows: [],
      error_rows: [],
    };

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const fileName = req.file.originalname.toLowerCase();
      // Hardened: accept only modern .xlsx files (reject legacy .xls)
      if (!fileName.endsWith(".xlsx")) {
        return res.status(400).json({
          success: false,
          message: "Unsupported file type. Use .xlsx",
        });
      }

      const override =
        String(req.body?.override ?? "").trim().toLowerCase() === "true";

      // Use exceljs-based reader with limits to prevent resource exhaustion
      const rows = (await readXlsxToRows(req.file.buffer, {
        maxRows: MAX_ROWS + 1, // include header row
        maxCols: 200, // reasonable upper bound for columns
        maxSheets: 3,
      })) as unknown[];

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "The worksheet is empty",
        });
      }

      const headerRow = (rows[0] as unknown[]).map(normalizeHeader);
      const headerIndex = new Map<string, number>();
      
      // Include all columns (including empty ones) to maintain proper indexing
      headerRow.forEach((header, index) => {
        if (header) {
          headerIndex.set(header, index);
        }
      });

      logger.info(
        `[PaymentsImport] Full header row (${headerRow.length} columns): ${headerRow.map((h, i) => `[${i}]="${h}"`).join(", ")}`,
      );
      logger.info(
        `[PaymentsImport] Header mapping: ${Array.from(headerIndex.entries())
          .map(([h, i]) => `"${h}"@${i}`)
          .join(" | ")}`,
      );

      const requiredHeaders = Object.values(REQUIRED_PAYMENT_HEADERS).map(
        normalizeHeader,
      );
      const missingHeaders = requiredHeaders.filter(
        (header) => !headerIndex.has(header),
      );

      if (missingHeaders.length > 0) {
        const foundHeaders = Array.from(headerIndex.keys());
        logger.warn(
          `[PaymentsImport] Missing headers. Found: ${foundHeaders.join(", ")}. Required: ${requiredHeaders.join(", ")}`
        );
        return res.status(400).json({
          success: false,
          message: `Missing required columns: ${missingHeaders.join(", ")}. Found columns: ${foundHeaders.join(", ")}`,
        });
      }

      const protocolIndex = headerIndex.get(
        normalizeHeader(REQUIRED_PAYMENT_HEADERS.protocol),
      );
      const afmIndex = headerIndex.get(
        normalizeHeader(REQUIRED_PAYMENT_HEADERS.afm),
      );
      const dateIndex = headerIndex.get(
        normalizeHeader(REQUIRED_PAYMENT_HEADERS.date),
      );
      const epsIndex = headerIndex.get(
        normalizeHeader(REQUIRED_PAYMENT_HEADERS.eps),
      );

      // Validate indices
      if (
        protocolIndex === undefined ||
        afmIndex === undefined ||
        dateIndex === undefined ||
        epsIndex === undefined
      ) {
        logger.error(
          `[PaymentsImport] Invalid indices after lookup - protocol: ${protocolIndex}, afm: ${afmIndex}, date: ${dateIndex}, eps: ${epsIndex}`,
        );
        return res.status(400).json({
          success: false,
          message: `Missing required columns: ${
            [
              protocolIndex === undefined ? REQUIRED_PAYMENT_HEADERS.protocol : "",
              afmIndex === undefined ? REQUIRED_PAYMENT_HEADERS.afm : "",
              dateIndex === undefined ? REQUIRED_PAYMENT_HEADERS.date : "",
              epsIndex === undefined ? REQUIRED_PAYMENT_HEADERS.eps : "",
            ]
              .filter(Boolean)
              .join(", ")
          }`,
        });
      }

      logger.info(
        `[PaymentsImport] Column indices - protocol: ${protocolIndex}, afm: ${afmIndex}, date: ${dateIndex}, eps: ${epsIndex}`,
      );
      logger.info(
        `[PaymentsImport] Header row sample: ${headerRow.slice(0, Math.max(protocolIndex, afmIndex, dateIndex, epsIndex) + 1).join(" | ")}`,
      );

      const dataRows = rows.slice(1) as unknown[][];
      report.total_rows = dataRows.length;

      if (dataRows.length > MAX_ROWS) {
        return res.status(400).json({
          success: false,
          message: `Row limit exceeded (${dataRows.length}). Max allowed is ${MAX_ROWS}.`,
        });
      }

      const parsedRows: ParsedRow[] = [];

      dataRows.forEach((rawRow, index) => {
        const rowNumber = index + 2;
        const row = Array.isArray(rawRow) ? rawRow : [];
        const isEmpty = row.every(
          (cell) =>
            cell === null ||
            cell === undefined ||
            String(cell).trim() === "",
        );

        if (isEmpty) {
          report.skipped_rows.push({ row: rowNumber, reason: "empty_row" });
          return;
        }

        const protocolCandidates = extractProtocolCandidates(row[protocolIndex as number]);
        if (protocolCandidates.length === 0) {
          report.error_rows.push({
            row: rowNumber,
            error: "missing_protocol",
            details: String(row[protocolIndex as number] ?? ""),
          });
          return;
        }

        const afm = normalizeAfm(row[afmIndex as number]);
        if (!afm) {
          report.error_rows.push({
            row: rowNumber,
            error: "invalid_afm",
            details: String(row[afmIndex as number] ?? ""),
          });
          return;
        }

        const parsedDate = parseExcelDate(row[dateIndex as number]);
        if (!parsedDate) {
          report.error_rows.push({
            row: rowNumber,
            error: "invalid_date",
            details: String(row[dateIndex as number] ?? ""),
          });
          return;
        }

        const epsRaw = row[epsIndex as number];
        let epsValue: string | null = null;
        if (epsRaw !== null && epsRaw !== undefined) {
          const trimmed = String(epsRaw).trim();
          // EPS must be exactly 7 digits
          if (/^\d{7}$/.test(trimmed)) {
            epsValue = trimmed;
          }
        }

        // DEBUGGING: Log first 3 rows to detect column misalignment
        if (index < 3) {
          const contextStart = Math.max(0, (epsIndex as number) - 3);
          const contextEnd = Math.min(row.length, (epsIndex as number) + 4);
          const contextCols = [];
          for (let i = contextStart; i < contextEnd; i++) {
            const marker = i === epsIndex ? "►" : " ";
            contextCols.push(`${marker}[${i}]="${String(row[i] ?? "").substring(0, 20)}"`);
          }
          logger.info(
            `[PaymentsImport] Row ${rowNumber}: EPS Column Context:\n${contextCols.join(" | ")}\nExtracted EPS="${epsValue}"`,
          );
        }

        parsedRows.push({
          rowNumber,
          protocolCandidates,
          afm,
          paymentDate: formatDateForDb(parsedDate),
          eps: epsValue || null,
        });
      });

      if (parsedRows.length === 0) {
        return res.json({
          success: true,
          message: "No valid rows to process",
          report,
        });
      }

      const protocolSet = new Set<string>();
      parsedRows.forEach((row) => {
        row.protocolCandidates.forEach((candidate) => {
          protocolSet.add(candidate);
        });
      });

      const protocols = Array.from(protocolSet);
      const documents: Array<{ id: number | string; protocol_number_input: string }> =
        [];

      for (const chunk of chunkArray(protocols, CHUNK_SIZE)) {
        const { data, error } = await supabase
          .from("generated_documents")
          .select("id, protocol_number_input")
          .in("protocol_number_input", chunk);

        if (error) {
          logger.error("[PaymentsImport] Failed to fetch documents", error);
          return res.status(500).json({
            success: false,
            message: "Failed to fetch generated documents",
            error: error.message,
          });
        }

        if (data) {
          documents.push(...data);
        }
      }

      const documentsById = new Map<string, { id: number | string; protocol_number_input: string }>();
      const documentsByProtocol = new Map<string, { id: number | string; protocol_number_input: string }>();

      documents.forEach((doc) => {
        documentsById.set(String(doc.id), doc);
        documentsByProtocol.set(doc.protocol_number_input, doc);
      });

      const documentIds = documents
        .map((doc) => doc.id)
        .filter((id) => id !== null && id !== undefined);

      if (documentIds.length === 0) {
        parsedRows.forEach((row) => {
          report.skipped_rows.push({
            row: row.rowNumber,
            reason: "protocol_not_found",
            details: `Candidates: ${row.protocolCandidates.join(", ")}`,
          });
        });

        return res.json({
          success: true,
          message: "No matching documents found",
          report,
        });
      }

      const paymentsByDocument = new Map<
        string,
        Map<
          string,
          Array<{
            id: number | string;
            payment_date: string | null;
            eps: string | null;
            freetext: string | null;
          }>
        >
      >();

      for (const chunk of chunkArray(documentIds, CHUNK_SIZE)) {
        const { data, error } = await supabase
          .from("beneficiary_payments")
          .select(
            `
            id,
            document_id,
            payment_date,
            eps,
            freetext,
            beneficiaries:beneficiary_id (
              afm
            )
          `,
          )
          .in("document_id", chunk);

        if (error) {
          logger.error("[PaymentsImport] Failed to fetch beneficiary payments", error);
          return res.status(500).json({
            success: false,
            message: "Failed to fetch beneficiary payments",
            error: error.message,
          });
        }

        if (!data) {
          continue;
        }

        data.forEach((payment: any) => {
          const documentKey = String(payment.document_id ?? "");
          if (!documentKey) {
            return;
          }

          const encryptedAfm = payment.beneficiaries?.afm || "";
          const decryptedAfm = encryptedAfm ? decryptAFM(encryptedAfm) : null;
          const afm = normalizeAfm(decryptedAfm);
          if (!afm) {
            return;
          }

          const byAfm =
            paymentsByDocument.get(documentKey) ||
            new Map<
              string,
              Array<{
                id: number | string;
                payment_date: string | null;
                freetext: string | null;
              }>
            >();

          const existing = byAfm.get(afm) || [];
          existing.push({
            id: payment.id,
            payment_date: payment.payment_date ?? null,
            eps: payment.eps ?? payment.freetext ?? null,
            freetext: payment.freetext ?? null,
          });
          byAfm.set(afm, existing);
          paymentsByDocument.set(documentKey, byAfm);
        });
      }

      for (const row of parsedRows) {
        // Try each protocol candidate in order
        let matchedDocument: { id: number | string; protocol_number_input: string } | null = null;
        let selectedProtocol: string | null = null;

        for (const candidate of row.protocolCandidates) {
          const doc = documentsByProtocol.get(candidate);
          if (doc) {
            matchedDocument = doc;
            selectedProtocol = candidate;
            break;
          }
        }

        if (!matchedDocument) {
          report.skipped_rows.push({
            row: row.rowNumber,
            reason: "protocol_not_found",
            details: `Tried candidates: ${row.protocolCandidates.join(", ")}`,
          });
          continue;
        }

        const documentKey = String(matchedDocument.id);
        const byAfm = paymentsByDocument.get(documentKey);
        if (!byAfm) {
          report.skipped_rows.push({
            row: row.rowNumber,
            reason: "document_has_no_payments",
            details: `Protocol: ${selectedProtocol}`,
          });
          continue;
        }

        const matches = byAfm.get(row.afm);
        if (!matches || matches.length === 0) {
          report.skipped_rows.push({
            row: row.rowNumber,
            reason: "afm_not_found",
            details: row.afm,
          });
          continue;
        }

        report.matched_rows += 1;
        let rowUpdated = false;
        let rowHadAttempt = false;

        for (const payment of matches) {
          const updatePayload: Record<string, string> = {};
          const existingDate = payment.payment_date || null;
          const existingEps = payment.eps || payment.freetext || null;
          const existingEpsValue = existingEps?.trim() || "";

          if (row.paymentDate) {
            if (override || !existingDate) {
              if (override || existingDate !== row.paymentDate) {
                updatePayload.payment_date = row.paymentDate;
              }
            }
          }

          if (row.eps && /^\d{7}$/.test(row.eps)) {
            if (override || !existingEpsValue) {
              if (override || existingEpsValue !== row.eps) {
                updatePayload.eps = row.eps;
                updatePayload.freetext = row.eps;
              }
            }
          }

          if (Object.keys(updatePayload).length === 0) {
            continue;
          }

          rowHadAttempt = true;

          const { error: updateError } = await supabase
            .from("beneficiary_payments")
            .update({
              ...updatePayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id);

          if (updateError) {
            report.error_rows.push({
              row: row.rowNumber,
              error: "update_failed",
              details: updateError.message,
            });
            continue;
          }

          report.updated_payments += 1;
          rowUpdated = true;
          logger.info(
            `[PaymentsImport] Updated beneficiary_payment ${payment.id} (document ${matchedDocument.id})`,
          );
        }

        if (rowUpdated) {
          report.updated_rows += 1;
        } else if (!rowHadAttempt) {
          report.skipped_rows.push({
            row: row.rowNumber,
            reason: "no_updates",
            details: override
              ? "values already match"
              : "existing values present",
          });
        }
      }

      const message = `Import completed: ${report.matched_rows} matched, ${report.updated_rows} rows updated, ${report.skipped_rows.length} skipped, ${report.error_rows.length} errors.`;

      return res.json({
        success: true,
        message,
        report,
      });
    } catch (error) {
      logger.error("[PaymentsImport] Error processing import", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process the import file",
        error: error instanceof Error ? error.message : "Unknown error",
        report,
      });
    }
  },
);

export default router;
