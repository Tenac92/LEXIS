/**
 * Document Generator - robust Word export (DXA widths + fixed column grids)
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  TableLayoutType,
  HeightRule,
  BorderStyle,
  VerticalAlign,
  UnderlineType,
  ShadingType,
  ImageRun,
  // ImageType, // optional enum if you prefer
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { DocumentUtilities } from "./document-utilities";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";
import { supabase } from "../config/db";
import { safeAmountToGreekText } from "./greek-number-converter";

const logger = createLogger("DocumentGenerator");

/* -------------------------------------------------------------------------- */
/*                               HELPERS / SANITIZE                           */
/* -------------------------------------------------------------------------- */

// A4 width ≈ 8.27" = 11906 twips. (If using Letter, set ~12240.)
const PAGE_WIDTH_TWIP = 11906;

// Compute usable content width from margins defined in DocumentUtilities
const contentWidthTwip = () => {
  const m = DocumentUtilities.DOCUMENT_MARGINS || { left: 1440, right: 1440 };
  const left = (m as any).left ?? 0;
  const right = (m as any).right ?? 0;
  return PAGE_WIDTH_TWIP - left - right;
};

// Convert % array -> twip column grid summing exactly to content width
const gridFromPercents = (percents: number[]): number[] => {
  const total = contentWidthTwip();
  const raw = percents.map((p) => Math.max(0, Math.round((p / 100) * total)));
  // Fix rounding drift so sum matches exactly
  const diff = total - raw.reduce((a, b) => a + b, 0);
  if (diff !== 0 && raw.length) raw[raw.length - 1] += diff;
  return raw;
};

// Strips XML-illegal control chars and U+FFFD; normalizes dashes and spaces.
const cleanText = (input: unknown): string => {
  return String(input ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g, "")
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .trim();
};

// Convenience wrapper for TextRun that always sanitizes text.
type TRInit = ConstructorParameters<typeof TextRun>[0];
const t = (text: unknown, opts: Partial<TRInit> = {}) =>
  new TextRun({ ...(opts as object), text: cleanText(text) });

const safeCurrency = (n: number) =>
  cleanText(DocumentUtilities.formatCurrency(n)).replace(/\u00A0/g, " ");

const FONT_MAIN = {
  font: DocumentUtilities.DEFAULT_FONT,
  size: DocumentUtilities.DEFAULT_FONT_SIZE,
};
const FONT_BODY = {
  font: DocumentUtilities.DEFAULT_FONT,
  size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
};
const FONT_SMALL = {
  font: DocumentUtilities.DEFAULT_FONT,
  size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
};

// Reusable border presets (avoid size: 0 on NONE)
const BORDER_NONE = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
};
const BORDER_BOX_THICK = {
  top: { style: BorderStyle.SINGLE, size: 4 },
  bottom: { style: BorderStyle.SINGLE, size: 4 },
  left: { style: BorderStyle.SINGLE, size: 4 },
  right: { style: BorderStyle.SINGLE, size: 4 },
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
};

/* -------------------------------------------------------------------------- */

export class DocumentGenerator {
  /** Expenditure config */
  private static getExpenditureConfig(documentData: DocumentData) {
    const expenditureType = documentData.expenditure_type;
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    return { expenditureType, config };
  }

  /** Default address */
  private static getDefaultAddress() {
    return { address: "", tk: "", region: "" };
  }

  /** Contact info */
  private static getContactInfo(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ) {
    const contactPerson =
      documentData.generated_by?.name || documentData.user_name || "Υπάλληλος";
    const telephone =
      documentData.generated_by?.telephone ||
      documentData.contact_number ||
      "2131331391";
    const email = unitDetails?.email || "";
    const address = unitDetails?.address || this.getDefaultAddress();

    return { contactPerson, telephone, email, address };
  }

  /** Generate primary document */
  public static async generatePrimaryDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData.id);

      const unitDetails = await DocumentUtilities.getUnitDetails(
        documentData.unit,
      );

      const children: any[] = [
        await this.createDocumentHeader(documentData, unitDetails),
        DocumentUtilities.createBlankLine(5),
        this.createDocumentSubject(documentData, unitDetails),
        ...DocumentGenerator.createLegalReferences(
          documentData.expenditure_type,
        ),
        ...this.createMainContent(documentData, unitDetails as UnitDetails),
        ...DocumentGenerator.createProjectInfo(
          documentData,
          documentData.expenditure_type,
        ),
        await this.createPaymentTable(
          documentData.recipients || [],
          documentData.expenditure_type,
          documentData.id,
        ),
        DocumentGenerator.createFinalRequest(),
        this.createFooter(documentData, unitDetails),
      ];

      const doc = new Document({
        sections: [
          {
            properties: {
              page: { margin: DocumentUtilities.DOCUMENT_MARGINS },
            },
            children,
          },
        ],
        styles: {
          default: {
            document: {
              run: {
                font: DocumentUtilities.DEFAULT_FONT,
                size: DocumentUtilities.DEFAULT_FONT_SIZE,
              },
            },
          },
        },
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }

  /** Subject box (DXA width + FIXED layout) */
  private static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const { expenditureType, config } = this.getExpenditureConfig(documentData);
    const documentTitle = config.documentTitle;

    const subjectText = [
      { text: "ΘΕΜΑ: ", bold: true, italics: true, color: "000000" },
      {
        text: ` ${documentTitle} ${
          expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
            ? `${unitDetails?.unit_name?.propgen || ""} ${unitDetails?.unit_name?.namegen || ""}`
            : `${unitDetails?.unit_name?.prop || ""} ${unitDetails?.unit_name?.name || ""}`
        }`,
        italics: true,
        bold: true,
        color: "000000",
      },
    ];

    const fullWidth = contentWidthTwip();

    return new Table({
      width: { type: WidthType.DXA, size: fullWidth },
      layout: TableLayoutType.FIXED,
      borders: BORDER_BOX_THICK,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { type: WidthType.DXA, size: fullWidth },
              shading: {
                fill: "C0C0C0",
                type: ShadingType.CLEAR,
                color: "FFFFFF", // avoid "auto"
              },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: subjectText.map((part) =>
                    t(part.text, {
                      bold: part.bold,
                      italics: part.italics,
                      color: part.color,
                      ...FONT_MAIN,
                    }),
                  ),
                  spacing: { after: 0 },
                  alignment: AlignmentType.LEFT,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /** Main content */
  private static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails,
  ): Paragraph[] {
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const mainText = config.mainText;
    const greekAmount = safeAmountToGreekText(documentData.total_amount);
    const prop =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? unitDetails?.unit_name?.propgen || "της"
        : unitDetails?.unit_name?.prop || "τη";
    return [
      new Paragraph({
        children: [
          t(
            `${mainText} ${prop} ${
              expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
                ? unitDetails?.unit_name?.namegen
                : unitDetails?.unit_name?.name
            }, συνολικού ποσού ${greekAmount}`,
            { font: FONT_BODY.font, size: FONT_BODY.size }
          ),
        ],
        spacing: { after: 0 },
        alignment: AlignmentType.JUSTIFIED,
      });
    ];
  }

  /** Payment table (DXA width + column grid + per-cell widths) */
  private static async createPaymentTable(
    recipients: any[],
    expenditureType: string,
    documentId?: number,
  ): Promise<Table> {
    // Special handling for ΕΚΤΟΣ ΕΔΡΑΣ - show month-grouped summary
    if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ" && documentId) {
      return await this.createEktosEdrasMonthlyTable(documentId);
    }

    const { columns } = DocumentUtilities.getExpenditureConfig(expenditureType);

    // Minimal fallback if config missing
    if (!Array.isArray(columns) || columns.length === 0) {
      return new Table({
        width: { type: WidthType.DXA, size: contentWidthTwip() },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { type: WidthType.DXA, size: contentWidthTwip() },
                children: [new Paragraph({ children: [t(" ")] })],
              }),
            ],
          }),
        ],
      });
    }

    // Prefer percents from config, else spread evenly
    const config = DocumentUtilities.getExpenditureConfig(
      expenditureType,
    ) as any;
    const columnPercents: number[] =
      Array.isArray(config.columnPercents) &&
      config.columnPercents.length === columns.length
        ? config.columnPercents
        : Array(columns.length).fill(100 / columns.length);

    const colGrid = gridFromPercents(columnPercents);
    const fullWidth = contentWidthTwip();

    const FONT = { size: FONT_BODY.size, font: FONT_BODY.font };

    const safeAmount = (n: unknown) => {
      const v = typeof n === "number" ? n : Number(n);
      return Number.isFinite(v) ? v : 0;
    };

    const mkHeaderRow = () =>
      new TableRow({
        children: columns.map(
          (c: string, idx: number) =>
            new TableCell({
              width: { type: WidthType.DXA, size: colGrid[idx] },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [t(c, { bold: true, ...FONT })],
                }),
              ],
            }),
        ),
      });

    const typeSpecificValue = (
      recipient: any,
      installment: string | number,
    ) => {
      if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ")
        return cleanText(recipient?.days?.toString?.() || "1");
      if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
        const q =
          typeof installment === "string"
            ? installment.replace("ΤΡΙΜΗΝΟ ", "")
            : installment;
        return q != null ? cleanText(String(q)) : "";
      }
      if (
        typeof installment === "string" &&
        installment.includes("συμπληρωματική")
      ) {
        return cleanText(installment.replace(" συμπληρωματική", " ΣΥΜ."));
      }
      return installment != null ? cleanText(String(installment)) : "";
    };

    const formatFullName = (r: any) => {
      const firstname = cleanText(r?.firstname);
      const lastname = cleanText(r?.lastname);
      const fathername = cleanText(r?.fathername);
      return fathername
        ? `${lastname} ${firstname} ΤΟΥ ${fathername}`
        : `${lastname} ${firstname}`;
    };

    const formatAFM = (r: any) => cleanText(r?.afm);

    const rows: TableRow[] = [mkHeaderRow()];
    let totalAmount = 0;

    (recipients || []).forEach((recipient: any, i: number) => {
      const rowNumber = `${i + 1}.`;
      const fullName = formatFullName(recipient);
      const afm = formatAFM(recipient);

      const installments: string[] =
        Array.isArray(recipient?.installments) && recipient.installments.length
          ? recipient.installments.map((x: any) => cleanText(x))
          : recipient?.installment != null
            ? [cleanText(recipient.installment)]
            : ["ΕΦΑΠΑΞ"];

      // Sort installments consistently
      installments.sort((a, b) => {
        const order = (inst: string) => {
          if (inst === "ΕΦΑΠΑΞ") return 0;
          if (inst === "Α") return 1;
          if (inst === "Α συμπληρωματική") return 2;
          if (inst === "Β") return 3;
          if (inst === "Β συμπληρωματική") return 4;
          if (inst === "Γ") return 5;
          if (inst === "Γ συμπληρωματική") return 6;
          if (inst.startsWith("ΤΡΙΜΗΝΟ "))
            return 100 + parseInt(inst.replace("ΤΡΙΜΗΝΟ ", ""));
          return 99;
        };
        return order(a) - order(b);
      });

      const installmentAmounts: Record<string, number> =
        recipient?.installmentAmounts || {};

      installments.forEach((inst) => {
        const amount = safeAmount(
          installmentAmounts[inst] ?? recipient?.amount ?? 0,
        );
        totalAmount += amount;

        const cMap: Record<string, string> = {
          "Α/Α": rowNumber,
          ΟΝΟΜΑΤΕΠΩΝΥΜΟ: fullName,
          "Α.Φ.Μ.": afm,
          ΔΟΣΗ: typeSpecificValue(recipient, inst),
          ΗΜΕΡΕΣ: typeSpecificValue(recipient, inst),
          ΜΗΝΕΣ: typeSpecificValue(recipient, inst),
          ΤΡΙΜΗΝΟ: typeSpecificValue(recipient, inst),
          "ΠΟΣΟ (€)": safeCurrency(amount),
        };

        rows.push(
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: columns.map((label: string, idx: number) => {
              if (label === "ΟΝΟΜΑΤΕΠΩΝΥΜΟ") {
                const runs: TextRun[] = [t(fullName, { ...FONT })];
                if (recipient?.freetext && recipient.freetext.trim()) {
                  runs.push(
                    new TextRun({ break: 1 }),
                    t(cleanText(recipient.freetext), { ...FONT }),
                  );
                }
                return new TableCell({
                  width: { type: WidthType.DXA, size: colGrid[idx] },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 0 },
                      children: runs,
                    }),
                  ],
                });
              }
              return new TableCell({
                width: { type: WidthType.DXA, size: colGrid[idx] },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [t(cMap[label] ?? "", { ...FONT })],
                  }),
                ],
              });
            }),
          }),
        );
      });
    });

    // Total
    const totalLabelCellIndex = Math.max(0, columns.length - 2);
    rows.push(
      new TableRow({
        children: columns.map((_, idx) => {
          if (idx < totalLabelCellIndex) {
            return new TableCell({
              width: { type: WidthType.DXA, size: colGrid[idx] },
              children: [new Paragraph({ children: [t("")] })],
            });
          }
          if (idx === totalLabelCellIndex) {
            return new TableCell({
              width: { type: WidthType.DXA, size: colGrid[idx] },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [t("ΣΥΝΟΛΟ:", { ...FONT, bold: true })],
                }),
              ],
            });
          }
          return new TableCell({
            width: { type: WidthType.DXA, size: colGrid[idx] },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  t(safeCurrency(totalAmount), { ...FONT, bold: true }),
                ],
              }),
            ],
          });
        }),
      }),
    );

    return new Table({
      width: { type: WidthType.DXA, size: fullWidth },
      layout: TableLayoutType.FIXED,
      columnWidths: colGrid,
      rows,
    });
  }

  /** Create monthly summary table for ΕΚΤΟΣ ΕΔΡΑΣ payments */
  private static async createEktosEdrasMonthlyTable(
    documentId: number,
  ): Promise<Table> {
    const FONT = { size: FONT_BODY.size, font: FONT_BODY.font };
    const fullWidth = contentWidthTwip();

    // Define column structure: Month (40%), ΣΤΟΥΣ ΔΙΚΑΙΟΥΧΟΥΣ (20%), ΥΠΕΡ ΜΤΠΥ (20%), ΣΥΝΟΛΟ (20%)
    const columnPercents = [40, 20, 20, 20];
    const colGrid = gridFromPercents(columnPercents);

    // Column headers
    const columns = [
      "ΜΗΝΑΣ",
      "ΣΤΟΥΣ ΔΙΚΑΙΟΥΧΟΥΣ (€)",
      "ΥΠΕΡ ΜΤΠΥ (€)",
      "ΣΥΝΟΛΟ (€)",
    ];

    try {
      // Fetch EmployeePayments from database
      const { data: payments, error } = await supabase
        .from("EmployeePayments")
        .select("month, net_payable, deduction_2_percent, total_expense")
        .eq("document_id", documentId);

      if (error) {
        logger.error("Error fetching employee payments:", error);
        throw error;
      }

      // Group payments by month and sum amounts
      const monthlyData: Record<
        string,
        {
          netPayable: number;
          deduction: number;
          total: number;
        }
      > = {};

      (payments || []).forEach((payment: any) => {
        const month = cleanText(payment.month);
        const netPayable = Number(payment.net_payable) || 0;
        const deduction = Number(payment.deduction_2_percent) || 0;
        const total = Number(payment.total_expense) || 0;

        if (!monthlyData[month]) {
          monthlyData[month] = { netPayable: 0, deduction: 0, total: 0 };
        }

        monthlyData[month].netPayable += netPayable;
        monthlyData[month].deduction += deduction;
        monthlyData[month].total += total;
      });

      // Create table rows
      const rows: TableRow[] = [];

      // Header row
      rows.push(
        new TableRow({
          children: columns.map(
            (col, idx) =>
              new TableCell({
                width: { type: WidthType.DXA, size: colGrid[idx] },
                borders: DocumentUtilities.BORDERS.STANDARD_CELL,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [t(col, { bold: true, ...FONT })],
                  }),
                ],
              }),
          ),
        }),
      );

      // Data rows - sorted by month
      const sortedMonths = Object.keys(monthlyData).sort();
      let grandTotalNetPayable = 0;
      let grandTotalDeduction = 0;
      let grandTotalExpense = 0;

      sortedMonths.forEach((month) => {
        const data = monthlyData[month];
        grandTotalNetPayable += data.netPayable;
        grandTotalDeduction += data.deduction;
        grandTotalExpense += data.total;

        rows.push(
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                width: { type: WidthType.DXA, size: colGrid[0] },
                borders: DocumentUtilities.BORDERS.STANDARD_CELL,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [t(month, { ...FONT })],
                  }),
                ],
              }),
              new TableCell({
                width: { type: WidthType.DXA, size: colGrid[1] },
                borders: DocumentUtilities.BORDERS.STANDARD_CELL,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [t(safeCurrency(data.netPayable), { ...FONT })],
                  }),
                ],
              }),
              new TableCell({
                width: { type: WidthType.DXA, size: colGrid[2] },
                borders: DocumentUtilities.BORDERS.STANDARD_CELL,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [t(safeCurrency(data.deduction), { ...FONT })],
                  }),
                ],
              }),
              new TableCell({
                width: { type: WidthType.DXA, size: colGrid[3] },
                borders: DocumentUtilities.BORDERS.STANDARD_CELL,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [t(safeCurrency(data.total), { ...FONT })],
                  }),
                ],
              }),
            ],
          }),
        );
      });

      // Total row
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { type: WidthType.DXA, size: colGrid[0] },
              borders: DocumentUtilities.BORDERS.STANDARD_CELL,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [t("ΣΥΝΟΛΟ:", { ...FONT, bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { type: WidthType.DXA, size: colGrid[1] },
              borders: DocumentUtilities.BORDERS.STANDARD_CELL,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [
                    t(safeCurrency(grandTotalNetPayable), {
                      ...FONT,
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { type: WidthType.DXA, size: colGrid[2] },
              borders: DocumentUtilities.BORDERS.STANDARD_CELL,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [
                    t(safeCurrency(grandTotalDeduction), {
                      ...FONT,
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { type: WidthType.DXA, size: colGrid[3] },
              borders: DocumentUtilities.BORDERS.STANDARD_CELL,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [
                    t(safeCurrency(grandTotalExpense), { ...FONT, bold: true }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );

      return new Table({
        width: { type: WidthType.DXA, size: fullWidth },
        layout: TableLayoutType.FIXED,
        columnWidths: colGrid,
        rows,
      });
    } catch (error) {
      logger.error("Error creating ΕΚΤΟΣ ΕΔΡΑΣ monthly table:", error);

      // Return empty table on error
      return new Table({
        width: { type: WidthType.DXA, size: fullWidth },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { type: WidthType.DXA, size: fullWidth },
                children: [
                  new Paragraph({
                    children: [t("Σφάλμα κατά τη φόρτωση των δεδομένων")],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    }
  }

  /** Footer with signature (DXA width) */
  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const left: Paragraph[] = [];
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const isEktosEdras = expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ";

    // Attachments
    left.push(
      new Paragraph({
        children: [
          t("ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)", {
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            ...FONT_SMALL,
          }),
        ],
      }),
    );

    const attachments = (documentData.attachments || [])
      .map((item) => cleanText(item).replace(/^\d+\-/, ""))
      .filter(Boolean);

    attachments.forEach((att, i) =>
      left.push(
        new Paragraph({
          children: [t(`${i + 1}. ${att}`, { ...FONT_SMALL })],
          indent: { left: 426 },
        }),
      ),
    );

    left.push(new Paragraph({ children: [t("")] }));

    // ΑΝΑΚΟΙΝΩΣΗ section (only for ΕΚΤΟΣ ΕΔΡΑΣ)
    if (isEktosEdras) {
      left.push(
        new Paragraph({
          children: [
            t("ΑΝΑΚΟΙΝΩΣΗ", {
              bold: true,
              underline: { type: UnderlineType.SINGLE },
              ...FONT_SMALL,
            }),
          ],
        }),
      );

      left.push(
        new Paragraph({
          children: [
            t("Γρ. Υφυπουργού Κλιματικής Κρίσης και Πολιτικής", {
              ...FONT_SMALL,
            }),
          ],
          indent: { left: 426 },
        }),
      );

      left.push(
        new Paragraph({
          children: [
            t("Προστασίας (Αρμόδιου για την Αποκατάσταση", {
              ...FONT_SMALL,
            }),
          ],
          indent: { left: 426 },
        }),
      );

      left.push(
        new Paragraph({
          children: [
            t("Φυσικών Καταστροφών & Κρατικής Αρωγής)", {
              ...FONT_SMALL,
            }),
          ],
          indent: { left: 426 },
        }),
      );

      left.push(new Paragraph({ children: [t("")] }));
    }

    // Distribution (ΚΟΙΝΟΠΟΙΗΣΗ)
    left.push(
      new Paragraph({
        children: [
          t("ΚΟΙΝΟΠΟΙΗΣΗ", {
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            ...FONT_SMALL,
          }),
        ],
      }),
    );

    // Different distribution list for ΕΚΤΟΣ ΕΔΡΑΣ vs other types
    if (isEktosEdras) {
      left.push(
        new Paragraph({
          children: [
            t(
              "1. Γρ. Γ. Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
              {
                ...FONT_SMALL,
              },
            ),
          ],
          indent: { left: 426 },
        }),
      );
    } else {
      [
        "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
        "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
        "Γ.Δ.Α.Ε.Φ.Κ.",
      ].forEach((n, i) =>
        left.push(
          new Paragraph({
            children: [t(`${i + 1}. ${n}`, { ...FONT_SMALL })],
            indent: { left: 426 },
          }),
        ),
      );
    }

    left.push(new Paragraph({ children: [t("")] }));

    // Internal distribution
    left.push(
      new Paragraph({
        children: [
          t("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ", {
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            ...FONT_SMALL,
          }),
        ],
      }),
    );

    left.push(
      new Paragraph({
        children: [t("1. Χρονολογικό Αρχείο", { ...FONT_SMALL })],
        indent: { left: 426 },
      }),
    );

    let esdianCounter = 2;
    if (documentData.esdian && Array.isArray(documentData.esdian)) {
      for (const esdianItem of documentData.esdian) {
        if (esdianItem && esdianItem.trim()) {
          left.push(
            new Paragraph({
              children: [
                t(`${esdianCounter}. ${cleanText(esdianItem)}`, {
                  ...FONT_SMALL,
                }),
              ],
              indent: { left: 426 },
            }),
          );
          esdianCounter++;
        }
      }
    }

    const right = DocumentUtilities.createManagerSignatureParagraphs(
      documentData.director_signature,
    );

    const fullWidth = contentWidthTwip();
    const footerGrid = gridFromPercents([60, 40]);

    return new Table({
      width: { type: WidthType.DXA, size: fullWidth },
      layout: TableLayoutType.FIXED,
      borders: BORDER_NONE,
      columnWidths: footerGrid,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { type: WidthType.DXA, size: footerGrid[0] },
              children: left,
              verticalAlign: VerticalAlign.TOP,
              borders: BORDER_NONE,
            }),
            new TableCell({
              width: { type: WidthType.DXA, size: footerGrid[1] },
              children: right,
              verticalAlign: VerticalAlign.TOP,
              borders: BORDER_NONE,
            }),
          ],
        }),
      ],
    });
  }

  /** Legal references */
  private static createLegalReferences(expenditureType: string): Paragraph[] {
    const texts =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? [
            "Σχ.: α) Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            "  β) Τις διατάξεις του Ν. 4336/2015 (Α’94) και ειδικότερα της υποπαραγράφου Δ9 «Δαπάνες μετακινούμενων εντός και εκτός έδρας» όπως τροποποιήθηκε και ισχύει.",
            "  γ) Τη με αρ. 2/73/ΔΕΠ/04.01.2016 (Β’20) απόφαση του Αν. Υπουργού Οικονομικών με θέμα: «Δικαιολογητικά αναγνώρισης και εκκαθάρισης δαπανών μετακινούμενων εντός και εκτός έδρας της Επικράτειας».",
          ]
        : [
            "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
          ];

    return texts.map(
      (txt) =>
        new Paragraph({
          children: [t(txt, FONT_BODY)],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 0 },
        }),
    );
  }

  /** Project info (DXA width, no borders) */
  private static createProjectInfo(
    documentData: DocumentData,
    expenditureType: string,
  ): (Table | Paragraph)[] {
    const baseFont = { size: FONT_BODY.size, font: FONT_BODY.font };

    const aleValue =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? "2420403001-2420405001-2420404001"
        : "2310989004 – Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.";

    const row = (label: string, value: string) =>
      new TableRow({
        children: [
          new TableCell({
            borders: BORDER_NONE,
            width: {
              type: WidthType.DXA,
              size: Math.round(contentWidthTwip() * 0.22),
            },
            children: [
              new Paragraph({
                children: [t(`${label}: `, { bold: true, ...baseFont })],
              }),
            ],
          }),
          new TableCell({
            borders: BORDER_NONE,
            width: {
              type: WidthType.DXA,
              size: Math.round(contentWidthTwip() * 0.78),
            },
            children: [new Paragraph({ children: [t(value, baseFont)] })],
          }),
        ],
      });

    return [
      new Table({
        width: { type: WidthType.DXA, size: contentWidthTwip() },
        layout: TableLayoutType.FIXED,
        borders: BORDER_NONE,
        rows: [
          row(
            "ΑΡ. ΕΡΓΟΥ",
            `${cleanText(documentData.project_na853) || ""} της ΣΑΝΑ 853`,
          ),
          row("ΑΛΕ", aleValue),
          row(
            "ΤΟΜΕΑΣ",
            "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
          ),
        ],
      }),
      new Paragraph({ children: [t("")] }),
    ];
  }

  /** Final request */
  private static createFinalRequest(): Paragraph {
    return new Paragraph({
      children: [
        t(
          "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
          FONT_BODY,
        ),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 0 },
    });
  }

  /** Header with two-column layout (DXA widths + grid) */
  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) throw new Error("Document data is required");

    const p = (text: string, opts?: { bold?: boolean }) =>
      new Paragraph({
        children: [t(text, { bold: opts?.bold || false, ...FONT_MAIN })],
        alignment: AlignmentType.LEFT,
      });
    const boldP = (text: string) => p(text, { bold: true });
    const contact = (label: string, value: string) =>
      DocumentUtilities.createContactDetail(label, cleanText(value));

    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department || documentData.department || "",
      contact_number:
        documentData.generated_by?.telephone?.toString() ||
        documentData.contact_number?.toString() ||
        "",
    };

    const address = unitDetails?.address ?? { address: "", tk: "", region: "" };

    const logoPng = fs.readFileSync(
      path.join(process.cwd(), "server", "utils", "ethnosimo22.png"),
    );

    const leftCol: Paragraph[] = [
      new Paragraph({
        children: [
          new ImageRun({
            data: logoPng,
            type: "png", // or ImageType.PNG
            transformation: { width: 40, height: 40 },
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 100 },
      }),
      boldP("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
      boldP("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ"),
      boldP(
        "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
      ),
      boldP("ΓΕΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ"),
      boldP(cleanText(unitDetails?.unit_name?.name || unitDetails?.name || "")),
      boldP(
        (() => {
          if (
            unitDetails?.parts &&
            typeof unitDetails.parts === "object" &&
            documentData.director_signature
          ) {
            const signatureTitle = documentData.director_signature.title;
            for (const [, value] of Object.entries(unitDetails.parts)) {
              if (
                value &&
                typeof value === "object" &&
                (value as any).manager &&
                (value as any).manager.title === signatureTitle &&
                (value as any).tmima
              ) {
                return cleanText((value as any).tmima);
              }
            }
          }
          return cleanText(userInfo.department);
        })(),
      ),
      contact("Ταχ. Δ/νση", address.address),
      contact("Ταχ. Κώδικας", `${address.tk}, ${address.region}`),
      contact("Πληροφορίες", userInfo.name),
      contact("Τηλέφωνο", userInfo.contact_number),
      contact("Email", unitDetails?.email || ""),
    ];

    const toLines = [
      "Γενική Δ/νση Οικονομικών  Υπηρεσιών",
      "Διεύθυνση Οικονομικής Διαχείρισης",
      "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
      "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
      "Δημοκρίτου 2",
      "151 23 Μαρούσι",
    ].map(cleanText);

    // Inner "ΠΡΟΣ:" table (single row, two cells)
    const fullWidth = contentWidthTwip();
    // 60/40 split for the header
    const headerGrid = gridFromPercents([60, 40]);

    // Inner "ΠΡΟΣ:" table must not exceed its parent cell width:
    const innerRightWidth = headerGrid[1];
    const innerGrid = gridFromPercents([20, 80]); // label vs lines

    const rightInnerTable = new Table({
      width: { type: WidthType.DXA, size: innerRightWidth },
      layout: TableLayoutType.FIXED,
      borders: BORDER_NONE,
      columnWidths: innerGrid,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: BORDER_NONE,
              width: { type: WidthType.DXA, size: innerGrid[0] },
              children: [
                new Paragraph({
                  children: [t("ΠΡΟΣ:", { bold: true, size: 20 })],
                  // keep this gentle; huge 'before' causes layout jumps
                  spacing: { before: 2200 },
                  alignment: AlignmentType.LEFT,
                }),
              ],
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              borders: BORDER_NONE,
              width: { type: WidthType.DXA, size: innerGrid[1] },
              children: [
                new Paragraph({
                  children: [t(toLines[0], { size: 20 })],
                  spacing: { before: 2200 },
                  alignment: AlignmentType.LEFT,
                }),
                ...toLines.slice(1).map(
                  (line) =>
                    new Paragraph({
                      children: [t(line, { size: 20 })],
                      alignment: AlignmentType.LEFT,
                    }),
                ),
              ],
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });

    // Build the outer header with the same grid
    return new Table({
      width: { type: WidthType.DXA, size: fullWidth },
      layout: TableLayoutType.FIXED,
      borders: BORDER_NONE,
      columnWidths: headerGrid,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: BORDER_NONE,
              width: { type: WidthType.DXA, size: headerGrid[0] },
              children: leftCol,
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              borders: BORDER_NONE,
              width: { type: WidthType.DXA, size: headerGrid[1] },
              // (optional) add a mild top margin to align with the logo
              margins: { top: 120, bottom: 0, left: 0, right: 0 },
              children: [rightInnerTable],
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });
  }
}
