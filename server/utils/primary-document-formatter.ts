import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  HeightRule,
  ITableBordersOptions,
  PageOrientation,
} from "docx";
import { DocumentData, UnitDetails } from "./document-types";
import { DocumentCore } from "./document-core";
import { createLogger } from "./logger";

const logger = createLogger("PrimaryDocumentFormatter");

export class PrimaryDocumentFormatter {
  private static createHeaderCell(text: string, width: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: true,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
      },
    });
  }

  private static createTableCell(
    text: string,
    alignment: string,
    columnSpan?: number,
  ): TableCell {
    const alignmentType =
      alignment === "center"
        ? AlignmentType.CENTER
        : alignment === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT;

    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: DocumentUtilities.DEFAULT_FONT_SIZE - 2,
              font: DocumentUtilities.DEFAULT_FONT,
            }),
          ],
          alignment: alignmentType,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: columnSpan,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
      },
    });
  }

  private static createPaymentTable(recipients: any[], expenditureType: string): Table {
    const tableBorders: ITableBordersOptions = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    };

    // Get column headers based on expenditure type
    const columns = ExpenditureTypeHandler.getPaymentTableColumns(expenditureType);
    
    const rows = [
      new TableRow({
        height: { value: 360, rule: HeightRule.EXACT },
        children: columns.map(column => this.createHeaderCell(column, "auto")),
      }),
    ];

    // Process each recipient
    recipients.forEach((recipient, index) => {
      const fullName =
        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();
      const afm = recipient.afm;
      const rowNumber = (index + 1).toString() + ".";

      // Determine installments
      let installments: string[] = [];
      if (
        Array.isArray(recipient.installments) &&
        recipient.installments.length > 0
      ) {
        installments = recipient.installments;
      } else if (recipient.installment) {
        installments = [recipient.installment.toString()];
      } else {
        installments = ["ΕΦΑΠΑΞ"];
      }

      // Get installment amounts if available
      const installmentAmounts = recipient.installmentAmounts || {};

      // If there's only one installment, create a simple row
      if (installments.length === 1) {
        const installment = installments[0];
        const amount = installmentAmounts[installment] || recipient.amount;

        rows.push(
          new TableRow({
            height: { value: 360, rule: HeightRule.EXACT },
            children: [
              this.createTableCell(rowNumber, "center"),
              this.createTableCell(fullName, "center"),
              this.createTableCell(afm, "center"),
              this.createTableCell(installment, "center"),
              this.createTableCell(
                amount.toLocaleString("el-GR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                "center",
              ),
            ],
          }),
        );
      }
    });

    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + recipient.amount,
      0,
    );

    rows.push(
      new TableRow({
        height: { value: 360, rule: HeightRule.EXACT },
        children: [
          this.createTableCell("", "center", 1),
          this.createTableCell("", "center", 1),
          this.createTableCell("ΣΥΝΟΛΟ:", "right", 2),
          this.createTableCell(
            totalAmount.toLocaleString("el-GR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €",
            "center",
          ),
        ],
      }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows,
    });
  }

  private static createNote(expenditureType: string): Paragraph {
    return ExpenditureTypeHandler.createNoteForExpenditureType(expenditureType);
  }

  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    // Create the left column content (attachments, notifications, etc.)
    const leftColumnParagraphs: Paragraph[] = [];

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
        spacing: { after: 120 },
      }),
    );

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
          spacing: { after: 120 },
        }),
      );
    }

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
        spacing: { after: 120 },
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
          spacing: { after: 120 },
        }),
      );
    }

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
        spacing: { after: 120 },
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
        spacing: { after: 120 },
      }),
    );

    // Create the right column content (signature)
    const managerInfo = unitDetails?.manager;
    const rightColumnParagraphs = DocumentUtilities.createManagerSignatureParagraphs(managerInfo);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [50, 50],
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
              children: leftColumnParagraphs,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              children: rightColumnParagraphs,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });
  }

  public static async generateDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData);

      const unitDetails = await DocumentUtilities.getUnitDetails(
        documentData.unit,
      );
      logger.debug("Unit details:", unitDetails);

      // Get project title and NA853 code from database
      const projectMis =
        documentData.project_na853 ||
        (documentData as any).mis?.toString() ||
        "";
      const projectTitle = `Έργο ${projectMis}`;
      const projectNA853 = projectMis;
      logger.debug(`Project title for MIS ${projectMis}:`, projectTitle);
      logger.debug(`Project NA853 for MIS ${projectMis}:`, projectNA853);

      // Create a modified document data with NA853 if available
      const enrichedDocumentData = {
        ...documentData,
        project_na853: projectNA853 || documentData.project_na853,
      };

      const sections = [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margins: DocumentUtilities.DOCUMENT_MARGINS,
              orientation: PageOrientation.PORTRAIT,
            },
          },
          children: [
            await DocumentUtilities.createDocumentHeader(
              enrichedDocumentData,
              unitDetails,
            ),
            ...DocumentUtilities.createDateAndProtocol(enrichedDocumentData),
            ...DocumentUtilities.createDocumentSubject(
              enrichedDocumentData,
              unitDetails,
            ),
            ...DocumentUtilities.createMainContent(
              enrichedDocumentData,
              unitDetails,
            ),
            this.createPaymentTable(documentData.recipients || [], documentData.expenditure_type),
            this.createNote(),
            this.createFooter(enrichedDocumentData, unitDetails),
          ],
        },
      ];

      const doc = new Document({
        sections,
        styles: {
          default: {
            document: {
              run: {
                font: DocumentUtilities.DEFAULT_FONT,
                size: DocumentUtilities.DEFAULT_FONT_SIZE,
              },
            },
          },
          paragraphStyles: [
            {
              id: "A6",
              name: "A6",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              paragraph: {
                spacing: { line: 240, lineRule: "atLeast" },
              },
            },
          ],
        },
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }
}
