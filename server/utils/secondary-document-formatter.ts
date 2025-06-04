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
  PageOrientation,
  TableLayoutType,
} from "docx";
import { createLogger } from "./logger";
import { DocumentUtilities } from "./document-utilities";
import { UserDetails, UnitDetails, DocumentData } from "./document-types";

const logger = createLogger("SecondaryDocumentFormatter");

export class SecondaryDocumentFormatter {
  private static createDocumentTitle(
    documentData: DocumentData,
    projectTitle: string | null,
    projectNA853: string | null,
  ): Paragraph[] {
    const title = projectTitle || "Έργο χωρίς τίτλο";
    const na853Code = projectNA853 || documentData.project_na853 || "";

    return [
      new Paragraph({
        children: [
          new TextRun({
            text: `ΕΡΓΟ: ${title}`,
            bold: true,
            size: 24,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `ΝΑ853: ${na853Code}`,
            bold: true,
            size: 20,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
    ];
  }

  private static createRecipientsTable(
    recipients: any[],
    expenditureType: string,
  ): Table {
    const headerRow = new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Α/Α",
                  bold: true,
                  size: 16,
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
          width: { size: 8, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΕΠΩΝΥΜΟ ΟΝΟΜΑ ΠΑΤΡΩΝΥΜΟ",
                  bold: true,
                  size: 16,
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
          width: { size: 30, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Α.Φ.Μ.",
                  bold: true,
                  size: 16,
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
          width: { size: 15, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΠΟΣΟ (€)",
                  bold: true,
                  size: 16,
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
          width: { size: 15, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΠΡΑΞΗ",
                  bold: true,
                  size: 16,
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
          width: { size: 32, type: WidthType.PERCENTAGE },
        }),
      ],
    });

    const dataRows = recipients.map((recipient, index) => {
      const amount = typeof recipient.amount === "number" ? recipient.amount : 0;
      const formattedAmount = DocumentUtilities.formatCurrency(amount);

      return new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: (index + 1).toString(),
                    size: 14,
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
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${recipient.lastname || ""} ${recipient.firstname || ""} ${recipient.fathername || ""}`.trim(),
                    size: 14,
                    font: DocumentUtilities.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: recipient.afm || "",
                    size: 14,
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
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formattedAmount,
                    size: 14,
                    font: DocumentUtilities.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: recipient.secondary_text || expenditureType || "",
                    size: 14,
                    font: DocumentUtilities.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
        ],
      });
    });

    // Calculate total
    const totalAmount = recipients.reduce((sum, r) => {
      const amount = typeof r.amount === "number" && !isNaN(r.amount) ? r.amount : 0;
      return sum + amount;
    }, 0);

    const totalRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: "" })],
          columnSpan: 3,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `ΣΥΝΟΛΟ: ${DocumentUtilities.formatCurrency(totalAmount)}`,
                  bold: true,
                  size: 16,
                  font: DocumentUtilities.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [new Paragraph({ text: "" })],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
      ],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [headerRow, ...dataRows, totalRow],
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });
  }

  private static createRetentionText(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "ΤΑ ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΒΑΣΕΙ ΤΩΝ ΟΠΟΙΩΝ ΕΚΔΟΘΗΚΑΝ ΟΙ ΔΙΟΙΚΗΤΙΚΕΣ ΠΡΑΞΕΙΣ ΑΝΑΓΝΩΡΙΣΗΣ ΔΙΚΑΙΟΥΧΩΝ ΔΩΡΕΑΝ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ ΤΗΡΟΥΝΤΑΙ ΣΤΟ ΑΡΧΕΙΟ ΤΗΣ ΥΠΗΡΕΣΙΑΣ ΜΑΣ.",
          size: 16,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 480, after: 480 },
    });
  }

  private static async createSignatureSection(documentData: DocumentData): Promise<Table> {
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department ||
        documentData.generated_by?.descr ||
        (documentData as any).descr ||
        documentData.department ||
        "",
    };

    // Get unit details for manager information
    const unitDetails = await DocumentUtilities.getUnitDetails(documentData.unit);
    
    // Create left column for user/employee signature
    const leftColumnParagraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: "Ο/Η Υπάλληλος",
            bold: true,
            size: 18,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 960 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: userInfo.name,
            size: 18,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: userInfo.department,
            size: 16,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
      }),
    ];

    // Use DocumentUtilities to create manager signature paragraphs
    const rightColumnParagraphs = DocumentUtilities.createManagerSignatureParagraphs(unitDetails?.manager);

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
            }),
            new TableCell({
              children: rightColumnParagraphs,
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

  public static async generateSecondDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      logger.debug("Generating secondary document for:", documentData);

      const unitDetails = await DocumentUtilities.getUnitDetails(documentData.unit);
      logger.debug("Unit details:", unitDetails);

      // Get project information from linked projects or database
      let projectTitle: string | null = null;
      let projectNA853: string | null = null;
      
      // First, check if project data is available in the document's projects array
      if (documentData.projects && documentData.projects.length > 0) {
        const linkedProject = documentData.projects[0]; // Take the first linked project
        projectTitle = linkedProject.project_title ?? linkedProject.title ?? linkedProject.name ?? linkedProject.event_description ?? linkedProject.description ?? null;
        logger.debug(`Secondary document - Using linked project: ${linkedProject.id} - ${projectTitle}`);
        
        // Get NA853 for the linked project
        projectNA853 = await DocumentUtilities.getProjectNA853(String(linkedProject.id));
      } else {
        // Fallback to using project_na853 field
        const projectMis = documentData.project_na853 || (documentData as any).mis?.toString() || "";
        logger.debug(`Secondary document - Finding project with MIS/NA853: ${projectMis}`);
        
        projectTitle = await DocumentUtilities.getProjectTitle(projectMis);
        projectNA853 = await DocumentUtilities.getProjectNA853(projectMis);
      }
      
      logger.debug(`Secondary document - Final project title: ${projectTitle}`);
      logger.debug(`Secondary document - Final project NA853: ${projectNA853}`);

      // Calculate total amount from recipients
      const totalAmount = (documentData.recipients || []).reduce((sum, r) => {
        let amount = 0;
        if (typeof r.amount === "number" && !isNaN(r.amount)) {
          amount = r.amount;
        } else if (r.amount !== null && r.amount !== undefined) {
          const parsed = parseFloat(String(r.amount));
          amount = isNaN(parsed) ? 0 : parsed;
        }
        return sum + amount;
      }, 0);

      const formattedTotal = DocumentUtilities.formatCurrency(totalAmount);

      // Create signature section first since it's async
      const signatureSection = await this.createSignatureSection(documentData);

      const sections = [
        {
          properties: {
            page: {
              size: { width: 16838, height: 11906 }, // Landscape orientation
              margins: DocumentUtilities.DOCUMENT_MARGINS,
              orientation: PageOrientation.LANDSCAPE,
            },
          },
          children: [
            ...this.createDocumentTitle(documentData, projectTitle, projectNA853),
            this.createRecipientsTable(documentData.recipients || [], documentData.expenditure_type),
            DocumentUtilities.createBlankLine(480),
            this.createRetentionText(),
            DocumentUtilities.createBlankLine(480),
            signatureSection,
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
      logger.error("Error generating secondary document:", error);
      throw error;
    }
  }
}