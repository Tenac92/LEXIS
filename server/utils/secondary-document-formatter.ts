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
    const cfg = DocumentUtilities.getExpenditureConfig(expenditureType);
    const original = cfg.columns as string[];

    // Insert ΠΡΑΞΗ before ΠΟΣΟ (€)
    const cols = [...original];
    const idxAmount = cols.findIndex((c) => c.includes("ΠΟΣΟ"));
    if (idxAmount >= 0) cols.splice(idxAmount, 0, "ΠΡΑΞΗ");
    else cols.splice(cols.length - 1, 0, "ΠΡΑΞΗ"); // fallback

    // Ensure final header order is exactly what we will emit in rows
    // We will always output: [Α/Α, ΟΝΟΜΑΤΕΠΩΝΥΜΟ, Α.Φ.Μ., <TYPE>, ΠΡΑΞΗ, ΠΟΣΟ (€)]
    const headerOrder = ["Α/Α", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "Α.Φ.Μ."];
    const typeCol =
      expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ"
        ? "ΗΜΕΡΕΣ"
        : expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ"
          ? "ΤΡΙΜΗΝΟ"
          : "ΔΟΣΗ";
    headerOrder.push(typeCol, "ΠΡΑΞΗ", "ΠΟΣΟ (€)");

    // Build a clean header using the intended order
    const border = { style: BorderStyle.SINGLE, size: 1 } as const;
    const cellBorder = {
      top: border,
      bottom: border,
      left: border,
      right: border,
    } as const;

    const mkCentered = (text: string, bold = false) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold,
            size: DocumentUtilities.DEFAULT_FONT_SIZE,
            font: DocumentUtilities.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 0 },
      });

    const headerCells = headerOrder.map(
      (label) =>
        new TableCell({
          borders: cellBorder,
          children: [mkCentered(label, true)],
          verticalAlign: VerticalAlign.CENTER,
        }),
    );

    const rows: TableRow[] = [
      new TableRow({ children: headerCells }),
    ];

    // Equal DXA grid (last col absorbs remainder)
    const PAGE_DXA = 14000;
    const base = Math.floor(PAGE_DXA / headerOrder.length);
    const grid = headerOrder.map((_, i) =>
      i < headerOrder.length - 1
        ? base
        : PAGE_DXA - base * (headerOrder.length - 1),
    );

    // Helper to build one data row in the exact header order
    const mkRow = (data: Record<string, string>) =>
      new TableRow({
        children: headerOrder.map(
          (col) =>
            new TableCell({
              borders: cellBorder,
              children: [mkCentered(data[col] ?? "", false)],
              verticalAlign: VerticalAlign.CENTER,
            }),
        ),
      });

    let totalAmount = 0;

    recipients.forEach((r: any, i: number) => {
      const lastname = (r.lastname || "").trim();
      const firstname = (r.firstname || "").trim();
      const fathername = (r.fathername || "").trim();
      const fullName = fathername
        ? `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim()
        : `${lastname} ${firstname}`.trim();
      const afm = r.afm ? String(r.afm) : "";
      const praxis = r.secondary_text || expenditureType || "";

      const addOneRow = (typeValue: string, amountNum: number) => {
        const amountStr = DocumentUtilities.formatCurrency(amountNum || 0);
        totalAmount += Number.isFinite(amountNum) ? amountNum : 0;

        rows.push(
          mkRow({
            "Α/Α": `${i + 1}.`,
            ΟΝΟΜΑΤΕΠΩΝΥΜΟ: fullName,
            "Α.Φ.Μ.": afm,
            [typeCol]: typeValue,
            ΠΡΑΞΗ: praxis,
            "ΠΟΣΟ (€)": amountStr,
          }),
        );
      };

      if (expenditureType === "ΕΚΤΟΣ ΕΔΡΑΣ") {
        const days = r?.days != null ? String(r.days) : "1";
        const amt =
          typeof r.amount === "number" ? r.amount : Number(r.amount) || 0;
        addOneRow(days, amt);
        return;
      }

      if (expenditureType === "ΕΠΙΔΟΤΗΣΗ ΕΝΟΙΚΙΟΥ") {
        const installments: (string | number)[] =
          Array.isArray(r.installments) && r.installments.length
            ? r.installments
            : [r.installment ?? 1];

        const amounts: Record<string, number> = r.installmentAmounts || {};

        installments.forEach((inst) => {
          // Normalize like primary: strip "ΤΡΙΜΗΝΟ "
          const instKey =
            typeof inst === "string"
              ? inst.replace("ΤΡΙΜΗΝΟ ", "")
              : String(inst);
          const quarterLabel = `Τ${instKey}`;
          const amt =
            amounts[inst as any] ??
            amounts[instKey] ??
            (typeof r.amount === "number" ? r.amount : Number(r.amount) || 0);

          addOneRow(quarterLabel, amt);
        });
        return;
      }

      // Default ΔΚΑ* types — single row with ΔΟΣΗ
      const dose = r.installment || "ΕΦΑΠΑΞ";
      const amt =
        typeof r.amount === "number" ? r.amount : Number(r.amount) || 0;
      addOneRow(dose, amt);
    });

    // Total row: label in ΠΡΑΞΗ col, value in ΠΟΣΟ (€)
    const totalLabelIdx = headerOrder.indexOf("ΠΡΑΞΗ");
    const totalValueIdx = headerOrder.indexOf("ΠΟΣΟ (€)");

    const totalChildren = headerOrder.map((_, idx) => {
      if (idx === totalLabelIdx) {
        return new TableCell({
          borders: cellBorder,
          children: [mkCentered("ΣΥΝΟΛΟ:", true)],
          verticalAlign: VerticalAlign.CENTER,
        });
      }
      if (idx === totalValueIdx) {
        return new TableCell({
          borders: cellBorder,
          children: [
            mkCentered(DocumentUtilities.formatCurrency(totalAmount), true),
          ],
          verticalAlign: VerticalAlign.CENTER,
        });
      }
      return new TableCell({
        borders: cellBorder,
        children: [mkCentered("", false)],
        verticalAlign: VerticalAlign.CENTER,
      });
    });

    rows.push(new TableRow({ children: totalChildren }));

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: PAGE_DXA, type: WidthType.DXA },
      columnWidths: grid,
      borders: DocumentUtilities.BorderFactory.table.single,
      rows,
    });
  }

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
      DocumentUtilities.createManagerSignatureParagraphs(
        documentData.director_signature,
      );

    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10466, type: WidthType.DXA },
      columnWidths: [5233, 5233], // Two equal columns for signature
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
      console.log("[SecondaryDocument] === DOCUMENT DATA RECEIVED ===");
      console.log("[SecondaryDocument] Document ID:", documentData.id);
      console.log(
        "[SecondaryDocument] Expenditure type:",
        documentData.expenditure_type,
      );
      console.log(
        "[SecondaryDocument] Recipients count:",
        documentData.recipients?.length || 0,
      );
      console.log(
        "[SecondaryDocument] Recipients details:",
        documentData.recipients?.map((r) => ({
          name: `${r.firstname} ${r.lastname}`,
          afm: r.afm,
          amount: r.amount,
        })) || [],
      );

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
