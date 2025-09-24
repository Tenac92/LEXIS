/**
 * Document Generator - Complete document generation functionality
 * Single file for all Greek government document generation with expenditure type handling
 *
 * This file is organized in logical top-down order matching document structure:
 * 1. Main generation method
 * 2. Document header components (logo, contact info, recipient info)
 * 3. Document subject
 * 4. Legal references
 * 5. Main content
 * 6. Project information
 * 7. Payment table
 * 8. Final request
 * 9. Footer components
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
  BorderStyle,
  HeightRule,
  VerticalAlign,
  ImageRun,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { DocumentUtilities } from "./document-utilities";
import { DocumentData, UnitDetails } from "./document-types";
import { createLogger } from "./logger";

const logger = createLogger("DocumentGenerator");

export class DocumentGenerator {
  // Unified helper methods for common declarations

  /**
   * Get expenditure type configuration - unified method to avoid repetition
   */
  private static getExpenditureConfig(documentData: DocumentData) {
    const expenditureType = documentData.expenditure_type;
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    return { expenditureType, config };
  }

  /**
   * Get default address configuration - unified method
   */
  private static getDefaultAddress() {
    return {
      address: "",
      tk: "",
      region: "",
    };
  }

  /**
   * Get contact information - unified method
   */
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

  /**
   * Generate primary document
   */
  public static async generatePrimaryDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData.id);
      console.log("[PrimaryDocument] === DOCUMENT DATA RECEIVED ===");
      console.log("[PrimaryDocument] Document ID:", documentData.id);
      console.log(
        "[PrimaryDocument] Expenditure type:",
        documentData.expenditure_type,
      );
      console.log(
        "[PrimaryDocument] Project title:",
        documentData.project_title,
      );
      console.log(
        "[PrimaryDocument] Project NA853:",
        documentData.project_na853,
      );
      console.log(
        "[PrimaryDocument] Recipients count:",
        documentData.recipients?.length || 0,
      );
      console.log(
        "[PrimaryDocument] Attachments count:",
        documentData.attachments?.length || 0,
      );
      console.log(
        "[PrimaryDocument] Recipients details:",
        documentData.recipients?.map((r) => ({
          name: `${r.firstname} ${r.lastname}`,
          afm: r.afm,
          amount: r.amount,
          installment: r.installment,
        })) || [],
      );

      // Get unit details
      const unitDetails = await DocumentUtilities.getUnitDetails(
        documentData.unit,
      );

      // Create document sections
      const children: any[] = [
        // Header with two-column layout (includes logo, contact info and recipient section)
        await this.createDocumentHeader(documentData, unitDetails),

        // Break column inheritance with blank paragraphs
        DocumentUtilities.createBlankLine(5),

        // Subject
        this.createDocumentSubject(documentData, unitDetails),

        // Legal references
        ...DocumentGenerator.createLegalReferences(
          documentData.expenditure_type,
        ),

        // Main request text
        ...this.createMainContent(documentData, unitDetails),

        // Break any table inheritance before project info
        DocumentUtilities.createBlankLine(1),

        // Project information
        ...DocumentGenerator.createProjectInfo(
          documentData,
          documentData.expenditure_type,
        ),

        // Payment table
        this.createPaymentTable(
          documentData.recipients || [],
          documentData.expenditure_type,
        ),

        // Final request
        DocumentGenerator.createFinalRequest(),

        // Note: Attachments and distribution lists are handled in the footer

        // Footer
        this.createFooter(documentData, unitDetails),
      ];

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: DocumentUtilities.DOCUMENT_MARGINS,
              },
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

  /**
   * Create contact information section
   */
  private static createContactInfo(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Paragraph[] {
    const contactParagraphs: Paragraph[] = [];
    const { contactPerson, telephone, email, address } = this.getContactInfo(
      documentData,
      unitDetails,
    );

    // Contact details
    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Ταχ. Δ/νση: ${address.address}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Ταχ. Κώδικας: ${address.tk}, ${address.region}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Πληροφορίες: ${contactPerson}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Τηλέφωνο: ${telephone}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 0 },
      }),
    );

    contactParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Email: ${email}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
      }),
    );

    return contactParagraphs;
  }

  /**
   * Create document subject with bordered table
   */
  private static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const { expenditureType, config } = this.getExpenditureConfig(documentData);
    const documentTitle = config.documentTitle;

    const subjectText = [
      { text: "ΘΕΜΑ:", bold: true, italics: true, color: "000000" },
      {
        text: ` ${documentTitle} ${
          expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
            ? unitDetails?.unit_name?.prop || "τη"
            : unitDetails?.unit_name?.prop || "της"
        } ${unitDetails?.unit_name?.name || unitDetails?.name || "Διεύθυνση"}`,
        italics: true,
        bold: true,
        color: "000000",
      },
    ];

    // Use consistent page content width for all document elements
    const PAGE_CONTENT_WIDTH = 10466; // A4 width (11906) minus left/right margins (720 each)

    const BORDER = { style: BorderStyle.SINGLE, size: 4 };
    const CELL_BORDERS = {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
    };
    const TABLE_BORDERS = {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
    };

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              borders: CELL_BORDERS,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              shading: { fill: "C0C0C0" },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: subjectText.map(
                    (part) =>
                      new TextRun({
                        text: part.text,
                        bold: part.bold,
                        italics: part.italics,
                        color: part.color,
                        size: DocumentUtilities.DEFAULT_FONT_SIZE,
                        font: DocumentUtilities.DEFAULT_FONT,
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

  /**
   * Create main content section
   */
  private static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails,
  ): Paragraph[] {
    const contentParagraphs: Paragraph[] = [];

    // Main request text based on expenditure type
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const mainText = config.mainText;

    contentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${mainText} ${unitDetails?.unit_name?.prop || "τη"} ${unitDetails?.unit_name?.name}`,
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 0 },
      }),
    );

    return contentParagraphs;
  }
  private static createPaymentTable(
    recipients: any[],
    expenditureType: string,
  ): Table {
    const { columns } = DocumentUtilities.getExpenditureConfig(expenditureType);

    // ---- helpers
    const FONT = { size: DocumentUtilities.DEFAULT_FONT_SIZE - 2 };
    const B = (style = BorderStyle.SINGLE, size = 1) => ({
      top: { style, size },
      bottom: { style, size },
      left: { style, size },
      right: { style, size },
    });
    const BORDER = B();
    const NB = {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    };

    const centeredP = (text: string, extra: Partial<TextRun> = {}) =>
      DocumentUtilities.createCenteredParagraph(text, { ...FONT, ...extra });

    const cell = (
      text: string,
      opts?: {
        bold?: boolean;
        borders?: any;
        rowSpan?: number;
        vAlign?: typeof VerticalAlign.CENTER;
      },
    ) =>
      new TableCell({
        rowSpan: opts?.rowSpan,
        verticalAlign: opts?.vAlign,
        borders: opts?.borders ?? BORDER,
        children: [centeredP(text, {})],
      });

    const indexOfCol = (label: string) =>
      columns.findIndex((c: string) => c === label);

    const typeSpecificValue = (
      recipient: any,
      installment: string | number,
    ) => {
      if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ")
        return recipient.days?.toString() || "1";
      if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
        const q =
          typeof installment === "string"
            ? installment.replace("ΤΡΙΜΗΝΟ ", "")
            : installment;
        return q.toString();
      }
      return String(installment); // ΔΚΑ etc.
    };

    const mkHeaderRow = () =>
      new TableRow({
        tableHeader: true,
        children: columns.map(
          (c: string) =>
            new TableCell({
              borders: BORDER,
              children: [centeredP(c)],
            }),
        ),
      });

    // Common formatter blocks
    const formatFullName = (r: any) => {
      const firstname = r.firstname || "";
      const lastname = r.lastname || "";
      const fathername = r.fathername?.trim();
      return fathername
        ? `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim()
        : `${lastname} ${firstname}`.trim();
    };

    const formatAFM = (r: any) => (r.afm ? String(r.afm) : "");

    // Build rows
    const rows: TableRow[] = [mkHeaderRow()];
    let totalAmount = 0;

    recipients.forEach((recipient: any, i: number) => {
      const rowNumber = `${i + 1}.`;
      const fullName = formatFullName(recipient);
      const afm = formatAFM(recipient);

      // normalize installments
      const installments: string[] =
        Array.isArray(recipient.installments) && recipient.installments.length
          ? recipient.installments
          : recipient.installment
            ? [String(recipient.installment)]
            : ["ΕΦΑΠΑΞ"];

      const installmentAmounts = recipient.installmentAmounts || {};

      // Single installment → one row
      if (installments.length === 1) {
        const inst = installments[0];
        const amount = installmentAmounts[inst] ?? recipient.amount ?? 0;
        totalAmount += amount;

        // cells in same order as columns
        const cMap: Record<string, string> = {
          "Α/Α": rowNumber,
          ΟΝΟΜΑΤΕΠΩΝΥΜΟ: fullName,
          "Α.Φ.Μ.": afm,
          ΔΟΣΗ: typeSpecificValue(recipient, inst),
          ΗΜΕΡΕΣ: typeSpecificValue(recipient, inst),
          ΜΗΝΕΣ: typeSpecificValue(recipient, inst),
          ΤΡΙΜΗΝΟ: typeSpecificValue(recipient, inst),
          "ΠΟΣΟ (€)": DocumentUtilities.formatCurrency(amount),
        };

        rows.push(
          new TableRow({
            children: columns.map((label: string) =>
              cell(cMap[label] ?? "", { borders: BORDER }),
            ),
          }),
        );
        return;
      }

      // Multiple installments → first row with rowSpan for index/name/afm (and days if needed)
      const span = installments.length;
      const firstInst = installments[0];
      const firstAmt = installmentAmounts[firstInst] ?? 0;
      totalAmount += firstAmt;

      // Pre-create the row-spanned cells we need
      const spanCells: Record<string, TableCell> = {
        index: cell(rowNumber, {
          borders: BORDER,
          rowSpan: span,
          vAlign: VerticalAlign.CENTER,
        }),
        name: cell(fullName, {
          borders: BORDER,
          rowSpan: span,
          vAlign: VerticalAlign.CENTER,
        }),
        afm: cell(afm, {
          borders: BORDER,
          rowSpan: span,
          vAlign: VerticalAlign.CENTER,
        }),
      };

      // Build first row children according to columns
      const firstRowCells = columns.map((label: string) => {
        if (label === "Α/Α") return spanCells.index;
        if (label === "ΟΝΟΜΑΤΕΠΩΝΥΜΟ") return spanCells.name;
        if (label === "Α.Φ.Μ.") return spanCells.afm;
        if (label === "ΠΟΣΟ (€)")
          return cell(DocumentUtilities.formatCurrency(firstAmt));
        // type-specific column
        if (["ΔΟΣΗ", "ΗΜΕΡΕΣ", "ΜΗΝΕΣ", "ΤΡΙΜΗΝΟ"].includes(label))
          return cell(typeSpecificValue(recipient, firstInst));
        // default empty
        return cell("");
      });

      rows.push(
        new TableRow({
          height: { value: 360, rule: HeightRule.ATLEAST },
          children: firstRowCells,
        }),
      );

      // Subsequent rows: only type-specific column + ΠΟΣΟ
      for (let k = 1; k < installments.length; k++) {
        const inst = installments[k];
        const amount = installmentAmounts[inst] ?? 0;
        totalAmount += amount;

        const subsequentCells = columns.map((label: string) => {
          if (label === "ΠΟΣΟ (€)")
            return cell(DocumentUtilities.formatCurrency(amount));
          if (["ΔΟΣΗ", "ΗΜΕΡΕΣ", "ΜΗΝΕΣ", "ΤΡΙΜΗΝΟ"].includes(label))
            return cell(typeSpecificValue(recipient, inst));
          // everything else is “occupied” by rowSpan in the first row, so empty here
          return cell("");
        });

        rows.push(
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: subsequentCells,
          }),
        );
      }
    });

    // ---- total row (dynamic width)
    const totalLabelCellIndex = Math.max(0, columns.length - 2);
    const totalRowCells = columns.map((_, idx) => {
      if (idx < totalLabelCellIndex)
        return new TableCell({
          borders: NB,
          children: [new Paragraph({ text: "" })],
        });
      if (idx === totalLabelCellIndex)
        return new TableCell({
          borders: NB,
          children: [centeredP("ΣΥΝΟΛΟ:")],
        });
      return new TableCell({
        borders: NB,
        children: [centeredP(DocumentUtilities.formatCurrency(totalAmount))],
      });
    });
    rows.push(new TableRow({ children: totalRowCells }));

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10466, type: WidthType.DXA }, // Use consistent page content width
      rows,
    });
  }

  // Create footer with signature

  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null,
  ): Table {
    // Left column - attachments, notifications, and internal distribution
    const leftColumnParagraphs: Paragraph[] = [];

    // Add ΣΥΝΗΜΜΕΝΑ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    console.log("[PrimaryDocument] Footer attachments processing:", {
      rawAttachments: documentData.attachments,
      processedAttachments: attachments,
      count: attachments.length,
    });

    for (let i = 0; i < attachments.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${attachments[i]}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
        }),
      );
    }

    leftColumnParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: "" })] }),
    );

    // Add ΚΟΙΝΟΠΟΙΗΣΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΚΟΙΝΟΠΟΙΗΣΗ",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    const notifications = [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ.",
    ];

    for (let i = 0; i < notifications.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${notifications[i]}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
        }),
      );
    }

    leftColumnParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: "" })] }),
    );

    // Add ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ section
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ",
            bold: true,
            underline: {},
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Χρονολογικό Αρχείο",
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        indent: { left: 426 },
      }),
    );

    // Add ESDIAN fields if they exist
    let esdianCounter = 2;
    console.log(
      "[DocumentGenerator] ESDIAN Debug - documentData.esdian:",
      documentData.esdian,
    );
    console.log(
      "[DocumentGenerator] ESDIAN Debug - Array check:",
      Array.isArray(documentData.esdian),
    );
    if (documentData.esdian && Array.isArray(documentData.esdian)) {
      console.log(
        "[DocumentGenerator] ESDIAN Debug - Processing ESDIAN array with length:",
        documentData.esdian.length,
      );
      for (const esdianItem of documentData.esdian) {
        console.log(
          "[DocumentGenerator] ESDIAN Debug - Processing item:",
          esdianItem,
        );
        if (esdianItem && esdianItem.trim()) {
          console.log(
            "[DocumentGenerator] ESDIAN Debug - Adding paragraph for:",
            esdianItem.trim(),
          );
          leftColumnParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${esdianCounter}. ${esdianItem.trim()}`,
                  size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
                  font: DocumentUtilities.DEFAULT_FONT,
                }),
              ],
              indent: { left: 426 },
            }),
          );
          esdianCounter++;
        }
      }
    } else {
      console.log(
        "[DocumentGenerator] ESDIAN Debug - No ESDIAN data found or not an array",
      );
    }

    // Right column - use signature from director_signature field
    const rightColumnParagraphs =
      DocumentUtilities.createManagerSignatureParagraphs(
        documentData.director_signature,
      );

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10466, type: WidthType.DXA }, // Use consistent page content width
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 6500, type: WidthType.DXA },
              children: leftColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
              margins: { right: 200 },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              width: { size: 3966, type: WidthType.DXA },
              children: rightColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
          ],
        }),
      ],
    });
  }

  //Create legal references section

  private static createLegalReferences(expenditureType: string): Paragraph[] {
    const baseOptions = {
      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
      font: DocumentUtilities.DEFAULT_FONT,
    };

    const texts =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? [
            "Σχ.:α) Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            "  β) Τις διατάξεις του Ν. 4336/2015 (Α’94) και ειδικότερα της υποπαραγράφου Δ9 «Δαπάνες μετακινούμενων εντός και εκτός έδρας» όπως τροποποιήθηκε και ισχύει.",
            "  γ) Τη με αρ.2/73/ΔΕΠ/04.01.2016 (Β’20) απόφαση του Αν. Υπουργού Οικονομικών με θέμα: «Δικαιολογητικά αναγνώρισης και εκκαθάρισης δαπανών μετακινούμενων εντός και εκτός έδρας της Επικράτειας.",
          ]
        : [
            "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε.",
          ];

    return texts.map(
      (t) =>
        new Paragraph({
          children: [new TextRun({ text: t, ...baseOptions })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 0 },
        }),
    );
  }

  // Create project information section using table layout
  private static createProjectInfo(
    documentData: DocumentData,
    expenditureType: string,
  ): (Table | Paragraph)[] {
    const baseFont = {
      size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
    };

    // Only this changes per expenditure type
    const aleValue =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? "2420403001-2420405001-2420404001"
        : "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.";

    const row = (label: string, value: string) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1574, type: WidthType.DXA }, // 15% of page width
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${label}: `, bold: true, ...baseFont }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 8892, type: WidthType.DXA }, // 85% of page width
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, ...baseFont })],
              }),
            ],
          }),
        ],
      });

    const table = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10466, type: WidthType.DXA }, // Use consistent page content width
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        row("ΑΡ. ΕΡΓΟΥ", `${documentData.project_na853 || ""} της ΣΑΝΑ 853`),
        row("ΑΛΕ", aleValue),
        row(
          "ΤΟΜΕΑΣ",
          "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
        ),
      ],
    });

    return [table, new Paragraph({ children: [new TextRun({ text: "" })] })];
  }

  /**
   * Create final request paragraph
   */
  private static createFinalRequest(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε  στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
          size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 0 },
    });
  }

  /**
   * Create document header with two-column layout (matches template exactly)
   */

  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) throw new Error("Document data is required");

    // ---- constants & helpers
    const NONE = { style: BorderStyle.NONE };
    const NO_BORDERS = {
      top: NONE,
      bottom: NONE,
      left: NONE,
      right: NONE,
      insideHorizontal: NONE,
      insideVertical: NONE,
    };
    const NO_MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };

    // A4 usable content width with Word's default margins = 10466 twips.
    // A4 page width (11906) minus left margin (720) and right margin (720)
    const PAGE_CONTENT_WIDTH = 10466;

    const pctTwips = (n: number) => Math.round((PAGE_CONTENT_WIDTH * n) / 100);

    const LEFT_COL_WIDTH = pctTwips(60);
    const RIGHT_COL_WIDTH = pctTwips(40);

    // Right-inner "ΠΡΟΣ:" table column widths (20% / 80% of right column)
    const PROS_LABEL_COL = Math.round(RIGHT_COL_WIDTH * 0.2);
    const PROS_TEXT_COL = Math.round(RIGHT_COL_WIDTH * 0.8);

    const p = (text: string, opts?: { bold?: boolean }) =>
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts?.bold || false,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
      });

    const boldP = (text: string) => p(text, { bold: true });
    const contact = (label: string, value: string) =>
      DocumentUtilities.createContactDetail(label, value);

    // Cell helper using DXA (twips), not percentages
    const cellDXA = (
      children: (Paragraph | Table)[],
      widthTwips?: number,
      valign: typeof VerticalAlign.TOP = VerticalAlign.TOP,
    ) =>
      new TableCell({
        width: { size: widthTwips || PAGE_CONTENT_WIDTH, type: WidthType.DXA },
        verticalAlign: valign,
        borders: NO_BORDERS,
        margins: NO_MARGINS,
        children,
      });

    const row = (cells: TableCell[]) => new TableRow({ children: cells });

    // ---- data
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

    // ---- left column (logo + org + contacts)
    const leftCol: Paragraph[] = [
      new Paragraph({
        children: [
          new ImageRun({
            data: fs.readFileSync(
              path.join(process.cwd(), "server", "utils", "ethnosimo22.png"),
            ),
            transformation: { width: 40, height: 40 },
          } as any),
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
      boldP(unitDetails?.unit_name?.name || unitDetails?.name || ""),
      boldP(userInfo.department),
      contact("Ταχ. Δ/νση", address.address),
      contact("Ταχ. Κώδικας", `${address.tk}, ${address.region}`),
      contact("Πληροφορίες", userInfo.name),
      contact("Τηλέφωνο", userInfo.contact_number),
      contact("Email", unitDetails?.email || ""),
    ];

    // ---- right column ("ΠΡΟΣ:" block)
    const toLines = [
      "Γενική Δ/νση Οικονομικών  Υπηρεσιών",
      "Διεύθυνση Οικονομικής Διαχείρισης",
      "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
      "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
      "Δημοκρίτου 2",
      "151 23 Μαρούσι",
    ];

    const rightInnerTable = new Table({
      layout: TableLayoutType.FIXED, // ✅ fixed layout to avoid autofit collapse
      width: { size: RIGHT_COL_WIDTH, type: WidthType.DXA }, // ✅ absolute width matching parent cell
      borders: NO_BORDERS,
      rows: [
        row([
          cellDXA(
            [
              new Paragraph({
                children: [
                  new TextRun({ text: "ΠΡΟΣ:", bold: true, size: 20 }),
                ],
                spacing: { before: 2200 },
                alignment: AlignmentType.LEFT,
              }),
            ],
            PROS_LABEL_COL,
          ),
          cellDXA(
            [
              new Paragraph({
                children: [new TextRun({ text: toLines[0], size: 20 })],
                spacing: { before: 2200 },
                alignment: AlignmentType.LEFT,
              }),
              ...toLines.slice(1).map(
                (t) =>
                  new Paragraph({
                    children: [new TextRun({ text: t, size: 20 })],
                    alignment: AlignmentType.LEFT,
                  }),
              ),
            ],
            PROS_TEXT_COL,
          ),
        ]),
      ],
    });

    // ---- whole header table
    return new Table({
      layout: TableLayoutType.FIXED, // ✅ fixed layout across the whole header
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA }, // ✅ absolute page content width
      borders: NO_BORDERS,
      rows: [
        row([
          cellDXA(leftCol, LEFT_COL_WIDTH, VerticalAlign.TOP),
          cellDXA([rightInnerTable], RIGHT_COL_WIDTH, VerticalAlign.TOP),
        ]),
      ],
    });
  }
}
