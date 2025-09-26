/**
 * Document Generator - Complete document generation functionality
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
  VerticalAlign,
  UnderlineType,
  ShadingType,
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
  /**
   * Get expenditure type configuration
   */
  private static getExpenditureConfig(documentData: DocumentData) {
    const expenditureType = documentData.expenditure_type;
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    return { expenditureType, config };
  }

  /**
   * Get default address configuration
   */
  private static getDefaultAddress() {
    return { address: "", tk: "", region: "" };
  }

  /**
   * Get contact information
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
        ...this.createMainContent(documentData, unitDetails),
        ...DocumentGenerator.createProjectInfo(
          documentData,
          documentData.expenditure_type,
        ),
        this.createPaymentTable(
          documentData.recipients || [],
          documentData.expenditure_type,
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

  /**
   * Subject (boxed, shaded)
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

    const PAGE_CONTENT_WIDTH = 10466;

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [PAGE_CONTENT_WIDTH],
      borders: DocumentUtilities.BORDERS.SUBJECT_TABLE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: DocumentUtilities.BORDERS.SUBJECT_CELL,
              shading: { fill: "C0C0C0", type: ShadingType.CLEAR, color: "auto" },
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
   * Main content
   */
  private static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails,
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const expenditureType = documentData.expenditure_type || "ΔΑΠΑΝΗ";
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const mainText = config.mainText;

    paragraphs.push(
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

    return paragraphs;
  }

  /**
   * Payment table
   */
  private static createPaymentTable(
    recipients: any[],
    expenditureType: string,
  ): Table {
    const { columns } = DocumentUtilities.getExpenditureConfig(expenditureType);

    if (!Array.isArray(columns) || columns.length === 0) {
      return new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 10466, type: WidthType.DXA },
        columnWidths: [10466],
        borders: DocumentUtilities.BORDERS.PAYMENT_TABLE,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: DocumentUtilities.BORDERS.PAYMENT_CELL,
                children: [new Paragraph({ children: [new TextRun(" ")] })],
              }),
            ],
          }),
        ],
      });
    }

    const TABLE_WIDTH_DXA = 10466;
    const base = Math.floor(TABLE_WIDTH_DXA / columns.length);
    const columnWidths: number[] = columns.map((_, i) =>
      i < columns.length - 1 ? base : TABLE_WIDTH_DXA - base * (columns.length - 1),
    );

    const FONT = { size: DocumentUtilities.DEFAULT_FONT_SIZE - 2 };

    const safeAmount = (n: unknown) => {
      const v = typeof n === "number" ? n : Number(n);
      return Number.isFinite(v) ? v : 0;
    };

    const cell = (
      text: string,
      opts?: {
        bold?: boolean;
        borders?: typeof DocumentUtilities.BORDERS.PAYMENT_CELL;
        vAlign?: VerticalAlign;
      },
    ) =>
      new TableCell({
        verticalAlign: opts?.vAlign ?? VerticalAlign.CENTER,
        borders: opts?.borders ?? DocumentUtilities.BORDERS.PAYMENT_CELL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: (text ?? "").toString(),
                bold: opts?.bold ?? false,
                ...FONT,
              }),
            ],
          }),
        ],
      });

    const mkHeaderRow = () =>
      new TableRow({
        children: columns.map((c: string) =>
          cell(c, { bold: true, vAlign: VerticalAlign.CENTER }),
        ),
      });

    const typeSpecificValue = (recipient: any, installment: string | number) => {
      if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ")
        return recipient?.days?.toString?.() || "1";
      if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
        const q =
          typeof installment === "string"
            ? installment.replace("ΤΡΙΜΗΝΟ ", "")
            : installment;
        return q != null ? String(q) : "";
      }
      return installment != null ? String(installment) : "";
    };

    const formatFullName = (r: any) => {
      const firstname = (r?.firstname || "").trim();
      const lastname = (r?.lastname || "").trim();
      const fathername = r?.fathername?.trim();
      return fathername
        ? `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim()
        : `${lastname} ${firstname}`.trim();
    };

    const formatAFM = (r: any) => (r?.afm != null ? String(r.afm) : "");

    const rows: TableRow[] = [mkHeaderRow()];
    let totalAmount = 0;

    (recipients || []).forEach((recipient: any, i: number) => {
      const rowNumber = `${i + 1}.`;
      const fullName = formatFullName(recipient);
      const afm = formatAFM(recipient);

      const installments: string[] =
        Array.isArray(recipient?.installments) && recipient.installments.length
          ? recipient.installments.map((x: any) => String(x))
          : recipient?.installment != null
          ? [String(recipient.installment)]
          : ["ΕΦΑΠΑΞ"];

      const installmentAmounts: Record<string, number> =
        recipient?.installmentAmounts || {};

      installments.forEach((inst) => {
        const amount = safeAmount(installmentAmounts[inst] ?? recipient?.amount ?? 0);
        totalAmount += amount;

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
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: columns.map((label: string) =>
              cell(cMap[label] ?? "", { vAlign: VerticalAlign.CENTER }),
            ),
          }),
        );
      });
    });

    const totalLabelCellIndex = Math.max(0, columns.length - 2);
    rows.push(
      new TableRow({
        children: columns.map((_, idx) => {
          if (idx < totalLabelCellIndex) {
            return new TableCell({
              borders: DocumentUtilities.BORDERS.PAYMENT_CELL,
              children: [new Paragraph({ children: [new TextRun("")] })],
            });
          }
          if (idx === totalLabelCellIndex) {
            return new TableCell({
              borders: DocumentUtilities.BORDERS.PAYMENT_CELL,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [new TextRun({ text: "ΣΥΝΟΛΟ:", ...FONT, bold: true })],
                }),
              ],
            });
          }
          return new TableCell({
            borders: DocumentUtilities.BORDERS.PAYMENT_CELL,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: DocumentUtilities.formatCurrency(totalAmount),
                    ...FONT,
                    bold: true,
                  }),
                ],
              }),
            ],
          });
        }),
      }),
    );

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
      columnWidths,
      borders: DocumentUtilities.BORDERS.PAYMENT_TABLE,
      rows,
    });
  }

  /**
   * Footer with signature
   */
  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null,
  ): Table {
    const leftColumnParagraphs: Paragraph[] = [];

    // ΣΥΝΗΜΜΕΝΑ
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    attachments.forEach((att, i) =>
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${att}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
        }),
      ),
    );

    leftColumnParagraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));

    // ΚΟΙΝΟΠΟΙΗΣΗ
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΚΟΙΝΟΠΟΙΗΣΗ",
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
      }),
    );

    [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ.",
    ].forEach((n, i) =>
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${n}`,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 4,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
        }),
      ),
    );

    leftColumnParagraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));

    // ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ
    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ",
            bold: true,
            underline: { type: UnderlineType.SINGLE },
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

    let esdianCounter = 2;
    if (documentData.esdian && Array.isArray(documentData.esdian)) {
      for (const esdianItem of documentData.esdian) {
        if (esdianItem && esdianItem.trim()) {
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
    }

    const rightColumnParagraphs =
      DocumentUtilities.createManagerSignatureParagraphs(
        documentData.director_signature,
      );

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10466, type: WidthType.DXA },
      columnWidths: [6500, 3966],
      borders: DocumentUtilities.BORDERS.NO_BORDER_TABLE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
              children: leftColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
              children: rightColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Legal references
   */
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
            "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει..",
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

  /**
   * Project information table
   */
  private static createProjectInfo(
    documentData: DocumentData,
    expenditureType: string,
  ): (Table | Paragraph)[] {
    const baseFont = { size: DocumentUtilities.DEFAULT_FONT_SIZE - 2 };

    const aleValue =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? "2420403001-2420405001-2420404001"
        : "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.";

    const row = (label: string, value: string) =>
      new TableRow({
        children: [
          new TableCell({
            borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${label}: `, bold: true, ...baseFont }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, ...baseFont })],
              }),
            ],
          }),
        ],
      });

    return [
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 10466, type: WidthType.DXA },
        columnWidths: [1574, 8892],
        borders: DocumentUtilities.BORDERS.NO_BORDER_TABLE,
        rows: [
          row("ΑΡ. ΕΡΓΟΥ", `${documentData.project_na853 || ""} της ΣΑΝΑ 853`),
          row("ΑΛΕ", aleValue),
          row(
            "ΤΟΜΕΑΣ",
            "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
          ),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
    ];
  }

  /**
   * Final request paragraph
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
   * Header with two-column layout (nested TO block)
   */
  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) throw new Error("Document data is required");

    const PAGE_CONTENT_WIDTH = 10466;
    const LEFT_COL_WIDTH = Math.round(PAGE_CONTENT_WIDTH * 0.6);
    const RIGHT_COL_WIDTH = PAGE_CONTENT_WIDTH - LEFT_COL_WIDTH;

    const RIGHT_INNER_WIDTH = RIGHT_COL_WIDTH - 10;
    const PROS_LABEL_COL = Math.round(RIGHT_INNER_WIDTH * 0.2);
    const PROS_TEXT_COL = RIGHT_INNER_WIDTH - PROS_LABEL_COL;

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
                value.manager &&
                value.manager.title === signatureTitle &&
                (value as any).tmima
              ) {
                return (value as any).tmima;
              }
            }
          }
          return userInfo.department;
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
    ];

    const rightInnerTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: RIGHT_INNER_WIDTH, type: WidthType.DXA },
      columnWidths: [PROS_LABEL_COL, PROS_TEXT_COL],
      borders: DocumentUtilities.BORDERS.NO_BORDER_TABLE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "ΠΡΟΣ:", bold: true, size: 20 })],
                  spacing: { before: 2200 },
                  alignment: AlignmentType.LEFT,
                }),
              ],
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
              children: [
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
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [LEFT_COL_WIDTH, RIGHT_COL_WIDTH],
      borders: DocumentUtilities.BORDERS.NO_BORDER_TABLE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
              children: leftCol,
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              borders: DocumentUtilities.BORDERS.NO_BORDER_CELL,
              children: [rightInnerTable],
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });
  }
}
