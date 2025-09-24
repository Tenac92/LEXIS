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
            text: `ΕΡΓΟ: ${title} - ΑΡ.ΕΡΓΟΥ: ${na853Code} της ΣΑΝΑ 853`,
            bold: true,
            size: 24,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
    ];
  }

  private static createRecipientsTable(
    recipients: any[],
    expenditureType: string,
  ): Table {
    // Get the original configuration and add ΠΡΑΞΗ column
    const config = DocumentUtilities.getExpenditureConfig(expenditureType);
    const originalColumns = config.columns;

    // Create modified columns by inserting ΠΡΑΞΗ before the last column (amount)
    const columns = [...originalColumns];
    const amountColumnIndex = columns.findIndex((col) => col.includes("ΠΟΣΟ"));
    if (amountColumnIndex > -1) {
      columns.splice(amountColumnIndex, 0, "ΠΡΑΞΗ");
    } else {
      // Fallback if amount column not found
      columns.splice(-1, 0, "ΠΡΑΞΗ");
    }

    const borderStyle = BorderStyle.SINGLE;

    // Create header cells using the same approach as document-generator.ts
    const headerCells = columns.map(
      (column) =>
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(column, {
              bold: false,
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
    );

    const rows = [new TableRow({ children: headerCells, tableHeader: true })];

    let totalAmount = 0;

    recipients.forEach((recipient, index) => {
      // Use the same name formatting logic as document-generator.ts
      const firstname = recipient.firstname || "";
      const lastname = recipient.lastname || "";
      const fathername = recipient.fathername || "";

      const fullName =
        !fathername || fathername.trim() === ""
          ? `${lastname} ${firstname}`.trim()
          : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();

      // Convert numeric AFM to string for document display
      const afm = recipient.afm ? String(recipient.afm) : "";
      console.log(`[SecondaryDocument] Processing recipient ${index + 1}:`, {
        name: fullName,
        afm: afm,
        afm_length: afm.length,
        afm_type: typeof afm,
        raw_afm: recipient.afm,
        raw_afm_type: typeof recipient.afm,
        recipient_keys: Object.keys(recipient)
      });
      const rowNumber = (index + 1).toString() + ".";
      const amount =
        typeof recipient.amount === "number" ? recipient.amount : 0;
      totalAmount += amount;

      // Create table cells using the same structure as document-generator.ts
      const cells = [
        // Index/Number column (Α/Α)
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(rowNumber, {
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        // Name column (ΟΝΟΜΑΤΕΠΩΝΥΜΟ)
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(fullName, {
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        // AFM column (Α.Φ.Μ.)
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(afm, {
              size: DocumentUtilities.DEFAULT_FONT_SIZE,
            }),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
      ];

      // Add expenditure-specific column based on type
      if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ") {
        cells.push(
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(
                recipient.days?.toString() || "1",
                {
                  size: DocumentUtilities.DEFAULT_FONT_SIZE,
                },
              ),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
        );
      } else if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
        // For housing allowance, replicate primary document structure exactly
        // Check if recipient has multiple installments (quarters)
        const installments = recipient.installments || [recipient.installment || "1"];
        const installmentAmounts = recipient.installmentAmounts || {};
        
        if (installments.length === 1) {
          // Single quarter - simple row structure
          const quarterNum = typeof installments[0] === 'string' ? 
            installments[0].replace("ΤΡΙΜΗΝΟ ", "") : installments[0];
          
          cells.push(
            new TableCell({
              children: [
                DocumentUtilities.createCenteredParagraph(
                  `Τ${quarterNum}`,
                  {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE,
                  },
                ),
              ],
              borders: {
                top: { style: borderStyle, size: 1 },
                bottom: { style: borderStyle, size: 1 },
                left: { style: borderStyle, size: 1 },
                right: { style: borderStyle, size: 1 },
              },
            }),
          );
        } else {
          // Multiple quarters - use the same multi-row structure as primary document
          // This will be handled in the multi-installment processing section below
          // For now, show the first quarter in this row
          const firstQuarter = installments[0];
          const quarterNum = typeof firstQuarter === 'string' ? 
            firstQuarter.replace("ΤΡΙΜΗΝΟ ", "") : firstQuarter;
          
          cells.push(
            new TableCell({
              children: [
                DocumentUtilities.createCenteredParagraph(
                  `Τ${quarterNum}`,
                  {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE,
                  },
                ),
              ],
              borders: {
                top: { style: borderStyle, size: 1 },
                bottom: { style: borderStyle, size: 1 },
                left: { style: borderStyle, size: 1 },
                right: { style: borderStyle, size: 1 },
              },
            }),
          );
        }
      } else {
        // For ΔΚΑ types, add installment column (ΔΟΣΗ)
        cells.push(
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(
                recipient.installment || "ΕΦΑΠΑΞ",
                {
                  size: DocumentUtilities.DEFAULT_FONT_SIZE,
                },
              ),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
        );
      }

      // Add ΠΡΑΞΗ column
      cells.push(
        new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(
              recipient.secondary_text || expenditureType || "",
              {
                size: DocumentUtilities.DEFAULT_FONT_SIZE,
              },
            ),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
      );

      // For housing allowance with multiple quarters, create multi-row structure exactly like primary document
      if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ" && recipient.installments && recipient.installments.length > 1) {
        const installments = recipient.installments;
        const installmentAmounts = recipient.installmentAmounts || {};

        // Create first row with consistent structure (no rowSpan)
        const firstQuarterNum = typeof installments[0] === 'string' ? 
          installments[0].replace("ΤΡΙΜΗΝΟ ", "") : installments[0];
        const firstAmount = installmentAmounts[installments[0]] || installmentAmounts[firstQuarterNum] || 0;
        totalAmount += firstAmount;

        // Replace the quarter cell in the existing cells array
        cells[cells.length - 2] = new TableCell({
          children: [
            DocumentUtilities.createCenteredParagraph(
              `Τ${firstQuarterNum}`,
              {
                size: DocumentUtilities.DEFAULT_FONT_SIZE,
              },
            ),
          ],
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        });

        // Add amount for first quarter
        cells.push(
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(
                DocumentUtilities.formatCurrency(firstAmount),
                {
                  size: DocumentUtilities.DEFAULT_FONT_SIZE,
                },
              ),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
        );

        // Add first row with consistent structure
        rows.push(new TableRow({ children: cells }));

        // Add remaining quarters as separate rows with ALL columns (consistent structure)
        for (let i = 1; i < installments.length; i++) {
          const quarterNum = typeof installments[i] === 'string' ? 
            installments[i].replace("ΤΡΙΜΗΝΟ ", "") : installments[i];
          const quarterAmount = installmentAmounts[installments[i]] || installmentAmounts[quarterNum] || 0;
          totalAmount += quarterAmount;

          // Create complete row with all columns to maintain consistent structure
          // Fixed: Create fresh TableCell objects to prevent shared references
          const quarterRow = new TableRow({
            children: [
              // Index cell (empty for subsequent quarters)
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph("", {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE,
                  }),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
              // Name cell (empty for subsequent quarters)
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph("", {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE,
                  }),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
              // AFM cell (empty for subsequent quarters)
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph("", {
                    size: DocumentUtilities.DEFAULT_FONT_SIZE,
                  }),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
              // Quarter column
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph(
                    `Τ${quarterNum}`,
                    {
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                    },
                  ),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
              // Amount column
              new TableCell({
                children: [
                  DocumentUtilities.createCenteredParagraph(
                    DocumentUtilities.formatCurrency(quarterAmount),
                    {
                      size: DocumentUtilities.DEFAULT_FONT_SIZE,
                    },
                  ),
                ],
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
              // ΠΡΑΞΗ cell (repeat same ΠΡΑΞΗ)
              new TableCell({
                children: cells[cells.length - 1].options.children, // Same ΠΡΑΞΗ as first row
                borders: {
                  top: { style: borderStyle, size: 1 },
                  bottom: { style: borderStyle, size: 1 },
                  left: { style: borderStyle, size: 1 },
                  right: { style: borderStyle, size: 1 },
                },
              }),
            ],
          });
          rows.push(quarterRow);
        }
      } else {
        // Single installment or non-housing allowance - add amount column normally
        cells.push(
          new TableCell({
            children: [
              DocumentUtilities.createCenteredParagraph(
                DocumentUtilities.formatCurrency(amount),
                {
                  size: DocumentUtilities.DEFAULT_FONT_SIZE,
                },
              ),
            ],
            borders: {
              top: { style: borderStyle, size: 1 },
              bottom: { style: borderStyle, size: 1 },
              left: { style: borderStyle, size: 1 },
              right: { style: borderStyle, size: 1 },
            },
          }),
        );

        rows.push(new TableRow({ children: cells }));
      }
    });

    // Create total row spanning to the amount column
    const totalRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: "" })],
          columnSpan: columns.length - 1,
          borders: {
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `ΣΥΝΟΛΟ: ${DocumentUtilities.formatCurrency(totalAmount)}`,
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
            top: { style: borderStyle, size: 1 },
            bottom: { style: borderStyle, size: 1 },
            left: { style: borderStyle, size: 1 },
            right: { style: borderStyle, size: 1 },
          },
        }),
      ],
    });

    rows.push(totalRow);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: rows,
    });
  }

  // getColumnWidths method removed for Word compatibility - cell widths specified directly on TableCell elements

  private static createRetentionText(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "ΤΑ ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΒΑΣΕΙ ΤΩΝ ΟΠΟΙΩΝ ΕΚΔΟΘΗΚΑΝ ΟΙ ΔΙΟΙΚΗΤΙΚΕΣ ΠΡΑΞΕΙΣ ΑΝΑΓΝΩΡΙΣΗΣ ΔΙΚΑΙΟΥΧΩΝ ΔΩΡΕΑΝ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ ΤΗΡΟΥΝΤΑΙ ΣΤΟ ΑΡΧΕΙΟ ΤΗΣ ΥΠΗΡΕΣΙΑΣ ΜΑΣ.",
          size: 22,
          font: DocumentUtilities.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
    });
  }

  private static async createSignatureSection(
    documentData: DocumentData,
  ): Promise<Table> {
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      specialty: documentData.generated_by?.details?.specialty || "",
      gender: documentData.generated_by?.details?.gender || "male", // Default to male if not specified
    };

    // Determine gender-specific signature text
    const signatureText =
      userInfo.gender === "female" ? "Η ΣΥΝΤΑΞΑΣΑ" : "Ο ΣΥΝΤΑΞΑΣ";

    // Get unit details for manager information
    const unitDetails = await DocumentUtilities.getUnitDetails(
      documentData.unit,
    );

    // Create left column for user/employee signature
    const leftColumnParagraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: signatureText,
            bold: true,
            size: 20,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: userInfo.name,
            size: 20,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: userInfo.specialty,
            size: 20,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
      }),
    ];

    // Use DocumentUtilities to create manager signature paragraphs from director_signature field
    const rightColumnParagraphs =
      DocumentUtilities.createManagerSignatureParagraphs(documentData.director_signature);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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

  public static async generateSecondDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating secondary document for:", documentData.id);
      console.log('[SecondaryDocument] === DOCUMENT DATA RECEIVED ===');
      console.log('[SecondaryDocument] Document ID:', documentData.id);
      console.log('[SecondaryDocument] Expenditure type:', documentData.expenditure_type);
      console.log('[SecondaryDocument] Recipients count:', documentData.recipients?.length || 0);
      console.log('[SecondaryDocument] Recipients details:', documentData.recipients?.map(r => ({ 
        name: `${r.firstname} ${r.lastname}`, 
        afm: r.afm, 
        amount: r.amount 
      })) || []);

      const unitDetails = await DocumentUtilities.getUnitDetails(
        documentData.unit,
      );
      logger.debug("Unit details:", unitDetails);

      // Get project information from linked projects or database
      let projectTitle: string | null = null;
      let projectNA853: string | null = null;

      // First, check if project data is available in the document's projects array
      if (documentData.projects && documentData.projects.length > 0) {
        const linkedProject = documentData.projects[0]; // Take the first linked project
        projectTitle =
          linkedProject.project_title ??
          linkedProject.title ??
          linkedProject.name ??
          linkedProject.event_description ??
          linkedProject.description ??
          null;
        logger.debug(
          `Secondary document - Using linked project: ${linkedProject.id} - ${projectTitle}`,
        );

        // Get NA853 for the linked project
        projectNA853 = await DocumentUtilities.getProjectNA853(
          String(linkedProject.id),
        );
      } else {
        // Fallback to using project_na853 field
        const projectMis =
          documentData.project_na853 ||
          (documentData as any).mis?.toString() ||
          "";
        logger.debug(
          `Secondary document - Finding project with MIS/NA853: ${projectMis}`,
        );

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
            ...this.createDocumentTitle(
              documentData,
              projectTitle,
              projectNA853,
            ),
            this.createRecipientsTable(
              documentData.recipients || [],
              documentData.expenditure_type,
            ),
            DocumentUtilities.createBlankLine(30),
            this.createRetentionText(),
            DocumentUtilities.createBlankLine(240),
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
