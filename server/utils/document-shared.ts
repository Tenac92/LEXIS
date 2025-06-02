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
  VerticalMerge,
  VerticalMergeType,
  HeightRule,
  ITableBordersOptions,
  ImageRun,
  PageOrientation,
  TableLayoutType,
} from "docx";
import { supabase } from "../config/db";
import * as fs from "fs";
import * as path from "path";
import { createLogger } from "./logger";
import { UserDetails, UnitDetails, DocumentData } from "./document-types";

const logger = createLogger("DocumentShared");

export class DocumentShared {
  public static readonly DEFAULT_FONT_SIZE = 22;
  public static readonly DEFAULT_FONT = "Calibri";
  public static readonly DEFAULT_MARGINS = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  public static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

  public static async getLogoImageData(): Promise<Buffer> {
    const logoPath = path.join(
      process.cwd(),
      "server",
      "utils",
      "ethnosimo22.png",
    );
    return fs.promises.readFile(logoPath);
  }

  public static createBoldParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: 18,
          font: this.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    });
  }

  public static createBlankLine(spacing: number = 240): Paragraph {
    return new Paragraph({
      text: "",
      spacing: { after: spacing },
    });
  }

  /**
   * Creates manager signature paragraphs for document signatures
   * @param managerInfo Manager information from unit details
   * @returns Array of paragraphs for the signature section
   */
  public static createManagerSignatureParagraphs(managerInfo?: any): Paragraph[] {
    const rightColumnParagraphs: Paragraph[] = [];

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.order || "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.title || "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
    );

    rightColumnParagraphs.push(this.createBlankLine(120));
    rightColumnParagraphs.push(this.createBlankLine(120));

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.name || "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
            bold: true,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    );

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.degree || "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α'β.",
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    );

    return rightColumnParagraphs;
  }

  public static createContactDetail(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `${label}: `,
          bold: false,
          size: 18,
          font: this.DEFAULT_FONT,
        }),
        new TextRun({
          text: value || "",
          bold: false,
          size: 18,
          font: this.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    });
  }

  public static formatCurrency(amount: number): string {
    return amount.toLocaleString("el-GR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  public static formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  public static async getUnitDetails(
    unit: string,
  ): Promise<UnitDetails | null> {
    try {
      logger.debug(`Fetching unit details for: ${unit}`);

      const { data, error } = await supabase
        .from("Monada")
        .select("*")
        .eq("unit", unit)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching unit details:", error);
        return null;
      }

      if (!data) {
        // Try to find by unit_name if not found by unit code
        const { data: allUnits, error: fetchError } = await supabase
          .from("Monada")
          .select("*");

        if (!fetchError && allUnits) {
          const foundUnit = allUnits.find(
            (unitData) =>
              unitData.unit_name &&
              typeof unitData.unit_name === "object" &&
              unitData.unit_name.name === unit,
          );

          if (foundUnit) {
            return {
              unit: foundUnit.unit,
              unit_name: foundUnit.unit_name,
              address: foundUnit.address || {
                address: "Κηφισίας 124 & Ιατρίδου 2",
                tk: "11526",
                region: "Αθήνα",
              },
              email: foundUnit.email || "",
              parts: foundUnit.parts || {},
            } as UnitDetails;
          }
        }
        return null;
      }

      return {
        unit: data.unit,
        unit_name: data.unit_name,
        address: data.address || {
          address: "Κηφισίας 124 & Ιατρίδου 2",
          tk: "11526",
          region: "Αθήνα",
        },
        email: data.email || "",
        parts: data.parts || {},
      } as UnitDetails;
    } catch (error) {
      logger.error("Error in getUnitDetails:", error);
      return null;
    }
  }

  public static async getProjectTitle(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        logger.error(
          "[DocumentShared] No MIS provided for project title lookup",
        );
        return null;
      }

      logger.debug(
        `[DocumentShared] Fetching project title for input: '${mis}'`,
      );

      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isProjectCode = projectCodePattern.test(mis);

      // Strategy 1: Try with na853
      const na853Result = await supabase
        .from("Projects")
        .select("project_title, mis, na853, budget_na853")
        .eq("na853", mis)
        .maybeSingle();

      if (na853Result.data?.project_title) {
        logger.debug(
          `[DocumentShared] Found project title by na853: '${na853Result.data.project_title}'`,
        );
        return na853Result.data.project_title;
      }

      // Strategy 2: Try with budget_na853 if it looks like a project code
      if (isProjectCode) {
        const budgetResult = await supabase
          .from("Projects")
          .select("project_title, mis, na853, budget_na853")
          .eq("budget_na853", mis)
          .maybeSingle();

        if (budgetResult.data?.project_title) {
          logger.debug(
            `[DocumentShared] Found project title by budget_na853: '${budgetResult.data.project_title}'`,
          );
          return budgetResult.data.project_title;
        }
      }

      // Strategy 3: Try with MIS as integer if numeric
      if (isNumericString) {
        const misResult = await supabase
          .from("Projects")
          .select("project_title, mis, na853, budget_na853")
          .eq("mis", parseInt(mis))
          .maybeSingle();

        if (misResult.data?.project_title) {
          logger.debug(
            `[DocumentShared] Found project title by MIS: '${misResult.data.project_title}'`,
          );
          return misResult.data.project_title;
        }
      }

      logger.debug(`[DocumentShared] No project title found for: ${mis}`);
      return null;
    } catch (error) {
      logger.error("[DocumentShared] Error in getProjectTitle:", error);
      return null;
    }
  }

  public static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) {
      throw new Error("Document data is required");
    }
    const logoBuffer = await this.getLogoImageData();

    // Extract user information with fallbacks
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department || documentData.department || "",
      // Handle telephone as number by converting to string
      contact_number:
        (documentData.generated_by?.telephone !== undefined
          ? String(documentData.generated_by?.telephone)
          : null) ||
        documentData.generated_by?.contact_number ||
        (documentData.contact_number !== undefined
          ? String(documentData.contact_number)
          : ""),
    };

    // Use unitDetails.address if available
    const address = unitDetails?.address || {
      address: "Κηφισίας 124 & Ιατρίδου 2",
      tk: "11526",
      region: "Αθήνα",
    };

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [55, 45],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: logoBuffer,
                      transformation: {
                        width: 40,
                        height: 40,
                      },
                      type: "png",
                    }),
                  ],
                  spacing: { after: 120 },
                }),
                this.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                this.createBoldParagraph(
                  "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                ),
                this.createBoldParagraph(
                  "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
                ),
                this.createBoldParagraph("ΓΕΝΙΚΗ Δ.Α.Ε.Φ.Κ."),
                this.createBoldParagraph(documentData.unit),
                this.createBoldParagraph(userInfo.department),
                this.createBlankLine(10),
                this.createContactDetail("Ταχ. Δ/νση", address.address),
                this.createContactDetail(
                  "Ταχ. Κώδικας",
                  `${address.tk}, ${address.region}`,
                ),
                this.createContactDetail("Πληροφορίες", userInfo.name),
                this.createContactDetail("Τηλέφωνο", userInfo.contact_number),
                this.createContactDetail("Email", unitDetails?.email || ""),
                this.createBlankLine(10),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },
              children: [
                new Paragraph({
                  text: "",
                  spacing: { before: 240 },
                }),
                new Table({
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
                          width: { size: 8, type: WidthType.PERCENTAGE },
                          borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                          },
                          children: [
                            new Paragraph({
                              text: "ΠΡΟΣ:",
                              spacing: { before: 2000 },
                              alignment: AlignmentType.LEFT,
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 92, type: WidthType.PERCENTAGE },
                          borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                          },
                          children: [
                            new Paragraph({
                              text: "Γενική Δ/νση Οικονομικών  Υπηρεσιών",
                              spacing: { before: 2000 },
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                            new Paragraph({
                              text: "Διεύθυνση Οικονομικής Διαχείρισης",
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                            new Paragraph({
                              text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                            new Paragraph({
                              text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  public static createDateAndProtocol(documentData: DocumentData): Paragraph[] {
    return [
      new Paragraph({
        text: "",
        spacing: { before: 480, after: 240 },
      }),
    ];
  }

  public static createDocumentSubject(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): (Table | Paragraph)[] {
    const subjectText = [
      {
        text: "ΘΕΜΑ:",
        bold: true,
        italics: true,
      },
      {
        text: ` Διαβιβαστικό αιτήματος για την πληρωμή Δ.Κ.Α. που έχουν εγκριθεί από ${unitDetails?.unit_name?.prop || "τη"} ${unitDetails?.unit || "Μονάδα"}`,
        italics: true,
      },
    ];

    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 4 },
          left: { style: BorderStyle.SINGLE, size: 4 },
          right: { style: BorderStyle.SINGLE, size: 4 },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: subjectText.map(
                      (textObj) =>
                        new TextRun({
                          text: textObj.text,
                          bold: textObj.bold || false,
                          italics: textObj.italics || false,
                          size: this.DEFAULT_FONT_SIZE,
                          font: this.DEFAULT_FONT,
                        }),
                    ),
                    spacing: { before: 240, after: 240 },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];
  }

  public static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): (Paragraph | Table)[] {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 480 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από τη ${documentData.unit}, σύμφωνα με τα παρακάτω στοιχεία.`,
            size: this.DEFAULT_FONT_SIZE,
            font: this.DEFAULT_FONT,
          }),
        ],
        spacing: { after: 480 },
      }),
      new Table({
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
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΑΡ. ΕΡΓΟΥ: ",
                        bold: true,
                        size: this.DEFAULT_FONT_SIZE,
                        font: this.DEFAULT_FONT,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${documentData.project_na853 || ""} της ΣΑΝΑ 853`,
                        size: this.DEFAULT_FONT_SIZE,
                        font: this.DEFAULT_FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΑΛΕ: ",
                        bold: true,
                        size: this.DEFAULT_FONT_SIZE,
                        font: this.DEFAULT_FONT,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.",
                        size: this.DEFAULT_FONT_SIZE,
                        font: this.DEFAULT_FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΤΟΜΕΑΣ: ",
                        bold: true,
                        size: this.DEFAULT_FONT_SIZE,
                        font: this.DEFAULT_FONT,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
                        size: this.DEFAULT_FONT_SIZE,
                        font: this.DEFAULT_FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { before: 480, after: 480 },
      }),
    ];
  }

  public static async getProjectNA853(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        logger.error("[DocumentShared] No MIS provided for NA853 lookup");
        return mis;
      }

      logger.debug(`[DocumentShared] Fetching NA853 for input: '${mis}'`);

      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isProjectCode = projectCodePattern.test(mis);

      // Strategy 1: Direct na853 lookup
      const na853Result = await supabase
        .from("Projects")
        .select("na853")
        .eq("na853", mis)
        .maybeSingle();

      if (na853Result.data?.na853) {
        logger.debug(
          `[DocumentShared] Found NA853 by direct lookup: ${na853Result.data.na853}`,
        );
        return na853Result.data.na853;
      }

      // Strategy 2: Try MIS lookup to get na853
      if (isNumericString) {
        const misResult = await supabase
          .from("Projects")
          .select("na853")
          .eq("mis", parseInt(mis))
          .maybeSingle();

        if (misResult.data?.na853) {
          logger.debug(
            `[DocumentShared] Found NA853 by MIS lookup: ${misResult.data.na853}`,
          );
          return misResult.data.na853;
        }
      }

      // Strategy 3: Try budget_na853 lookup
      const budgetResult = await supabase
        .from("Projects")
        .select("budget_na853")
        .eq("budget_na853", mis)
        .maybeSingle();

      if (budgetResult.data?.budget_na853) {
        logger.debug(
          `[DocumentShared] Found budget_na853 by direct lookup: ${budgetResult.data.budget_na853}`,
        );
        return budgetResult.data.budget_na853;
      }

      logger.debug(
        `[DocumentShared] No NA853 found, using input as fallback: ${mis}`,
      );
      return mis;
    } catch (error) {
      logger.error("[DocumentShared] Error in getProjectNA853:", error);
      return mis;
    }
  }
}
