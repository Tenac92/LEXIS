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
  ImageRun,
  PageOrientation,
} from "docx";
import { supabase } from "../config/db";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";
import { after } from "node:test";

interface UnitDetails {
  unit_name?: {
    name: string;
    prop: string;
  }
  manager?: {
    name: string;
    order: string;
    title: string;
    degree: string;
    prepose: string;
  };
  email?: string;
  address?: {
    tk: string;
    region: string;
    address: string;
  };
}

interface UserDetails {
  name: string;
  email?: string;
  contact_number?: string;
  department?: string;
}

interface DocumentData {
  id: number;
  unit: string;
  project_id?: string;
  project_na853?: string;
  expenditure_type: string;
  status?: string;
  total_amount?: number;
  protocol_number?: string;
  protocol_number_input?: string;
  protocol_date?: string;
  user_name?: string;
  attachments?: string[];
  contact_number?: string;
  department?: string;
  generated_by?: UserDetails;
  recipients?: Array<{
    firstname: string;
    lastname: string;
    fathername: string;
    afm: string;
    amount: number;
    installment: number;
  }>;
}

export class DocumentFormatter {
  private static readonly DEFAULT_FONT_SIZE = 22;
  private static readonly DEFAULT_FONT = "Calibri";
  private static readonly DEFAULT_MARGINS = {
    top: 0,
    right: 0,
    bottom: 1000,
    left: 0,
  };
  private static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

  private static async getLogoImageData(): Promise<Buffer> {
    const logoPath = path.join(
      process.cwd(),
      "server",
      "utils",
      "ethnosimo22.png",
    );
    return fs.promises.readFile(logoPath);
  }

  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails?: UnitDetails,
  ): Promise<Table> {
    const logoBuffer = await this.getLogoImageData();

    // Extract user information with fallbacks
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department || documentData.department || "",
      contact_number:
        documentData.generated_by?.contact_number ||
        documentData.contact_number ||
        "",
    };

    // Use unitDetails.address if available
    const address = unitDetails?.address || {
      address: "Κηφισίας 124 & Ιατρίδου 2",
      tk: "11526",
      region: "Αθήνα"
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
                this.createBoldParagraph(
                  unitDetails?.unit_name?.name || documentData.unit,
                ),
                this.createBoldParagraph(userInfo.department),
                this.createBlankLine(10),
                this.createContactDetail(
                  "Ταχ. Δ/νση",
                  address.address,
                ),
                this.createContactDetail("Ταχ. Κώδικας", `${address.tk}, ${address.region}`),
                this.createContactDetail(
                  "Πληροφορίες",
                  userInfo.name,
                ),
                this.createContactDetail(
                  "Τηλέφωνο",
                  userInfo.contact_number,
                ),
                this.createContactDetail(
                  "Email",
                  unitDetails?.email || "",
                ),
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
                  children: [
                    new TextRun({
                      text: `${address.region}: ${
                        documentData.protocol_date
                          ? format(
                              new Date(documentData.protocol_date),
                              "dd/MM/yyyy",
                            )
                          : "........................"
                      }`,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 240 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Αρ. Πρωτ.: ${
                        documentData.protocol_number_input ||
                        documentData.protocol_number ||
                        "......................"
                      }`,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
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

  private static async generateDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      console.log("Generating document for:", documentData);

      const unitDetails = await this.getUnitDetails(documentData.unit);
      console.log("Unit details:", unitDetails);

      const sections = [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margins: this.DOCUMENT_MARGINS,
              orientation: PageOrientation.PORTRAIT,
            },
          },
          children: [
            await this.createDocumentHeader(
              documentData,
              unitDetails || undefined,
            ),
            ...this.createDocumentSubject(documentData, unitDetails || {}),
            ...this.createMainContent(documentData, unitDetails || {}),
            this.createPaymentTable(documentData.recipients || []),
            this.createNote(),
            this.createFooter(documentData, unitDetails || undefined),
          ],
        },
      ];

      const doc = new Document({
        sections,
        styles: {
          default: {
            document: {
              run: {
                font: this.DEFAULT_FONT,
                size: this.DEFAULT_FONT_SIZE,
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
      console.error("Error generating document:", error);
      throw error;
    }
  }

  private static createDocumentSubject(
    documentData: DocumentData, unitDetails: UnitDetails,
  ): (Table | Paragraph)[] {
    const subjectText = [
      {
        text: "ΘΕΜΑ:",
        bold: true,
        italics: true,
      },
      {
        text: ` Διαβιβαστικό αιτήματος για την πληρωμή Δ.Κ.Α. που έχουν εγκριθεί από ${unitDetails?.unit_name?.prop || 'τη'} ${documentData.unit}`,
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
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4 },
                  bottom: { style: BorderStyle.SINGLE, size: 4 },
                  left: { style: BorderStyle.SINGLE, size: 4 },
                  right: { style: BorderStyle.SINGLE, size: 4 },
                },
                margins: {
                  top: 50,
                  bottom: 50,
                  left: 50,
                  right: 50,
                },
                width: { size: 100, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: subjectText.map(
                      (part) =>
                        new TextRun({
                          text: part.text,
                          bold: part.bold,
                          italics: part.italics,
                          size: this.DEFAULT_FONT_SIZE,
                        }),
                    ),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];
  }

  private static createMainContent(
    documentData: DocumentData,  unitDetails: UnitDetails,
  ): (Paragraph | Table)[] {
    return [
      this.createBlankLine(8),
      new Paragraph({
        children: [
          new TextRun({
            text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            size: DocumentFormatter.DEFAULT_FONT_SIZE - 2,
          }),
        ],
      }),
      this.createBlankLine(14),
      new Paragraph({
        children: [
          new TextRun({
            text: `Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από ${unitDetails?.unit_name?.prop || 'τη'} ${documentData.unit}, σύμφωνα με τα παρακάτω στοιχεία.`,
          }),
        ],
      }),
      this.createBlankLine(14),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [20, 80],
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
                      new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", bold: true }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${documentData.project_na853} της ΣΑΝΑ 853`,
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
                    children: [new TextRun({ text: "ΑΛΕ: ", bold: true })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.",
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
                    children: [new TextRun({ text: "ΤΟΜΕΑΣ: ", bold: true })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
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
        text: "",
      }),
    ];
  }

  private static createPaymentTable(
    recipients: NonNullable<DocumentData["recipients"]>,
  ): Table {
    const tableBorders: ITableBordersOptions = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    };

    const rows = [
      new TableRow({
        height: { value: 360, rule: HeightRule.EXACT },
        children: [
          this.createHeaderCell("Α.Α.", "auto"),
          this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "auto"),
          this.createHeaderCell("ΠΟΣΟ (€)", "auto"),
          this.createHeaderCell("ΔΟΣΗ", "auto"),
          this.createHeaderCell("ΑΦΜ", "auto"),
        ],
      }),
      ...recipients.map(
        (recipient, index) =>
          new TableRow({
            height: { value: 360, rule: HeightRule.EXACT },
            children: [
              this.createTableCell((index + 1).toString() + ".", "center"),
              this.createTableCell(
                `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim(), 
                "center",
              ),
              this.createTableCell(
                recipient.amount.toLocaleString("el-GR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                "center",
              ),
              this.createTableCell(recipient.installment.toString(), "center"),
              this.createTableCell(recipient.afm, "center"),
            ],
          }),
      ),
    ];

    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + recipient.amount,
      0,
    );
    rows.push(
      new TableRow({
        height: { value: 360, rule: HeightRule.EXACT },
        children: [
          this.createTableCell("ΣΥΝΟΛΟ:", "right", 2),
          this.createTableCell(
            totalAmount.toLocaleString("el-GR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €",
            "right",
          ),
          this.createTableCell("", "center", 2),
        ],
      }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows,
    });
  }

  private static createNote(): Paragraph {
    return new Paragraph({
      text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
    });
  }

  private static createFooter(
    documentData: DocumentData,
    unitDetails?: UnitDetails,
  ): Table {
    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

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
              width: { size: 65, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                this.createBoldUnderlinedParagraph(
                  "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
                ),
                ...attachments.map(
                  (item, index) =>
                    new Paragraph({
                      text: `${index + 1}. ${item}`,
                      indent: { left: 426 },
                      style: "a6",
                    }),
                ),
                this.createBoldUnderlinedParagraph("ΚΟΙΝΟΠΟΙΗΣΗ"),
                ...[
                  "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
                  "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
                  "Γ.Δ.Α.Ε.Φ.Κ.",
                ].map(
                  (item, index) =>
                    new Paragraph({
                      text: `${index + 1}. ${item}`,
                      indent: { left: 426 },
                      style: "a6",
                    }),
                ),
                this.createBoldUnderlinedParagraph("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ"),
                ...["Χρονολογικό Αρχείο"].map(
                  (item, index) =>
                    new Paragraph({
                      text: `${index + 1}. ${item}`,
                      indent: { left: 426 },
                      style: "a6",
                    }),
                ),
              ],
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  keepLines: true,  // Ensure the cell content doesn't break across pages
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: unitDetails?.manager?.order || '',
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  keepLines: true,  // Ensure the cell content doesn't break across pages
                  children: [
                    new TextRun({
                      text: unitDetails?.manager?.title || '',
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  keepLines: true,  // Ensure the cell content doesn't break across pages
                  spacing: { before: 400},
                  children: [
                    new TextRun({
                      text: unitDetails?.manager?.name || '',
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  keepLines: true,  // Ensure the cell content doesn't break across pages
                  text: unitDetails?.manager?.degree || '',
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  private static createBoldParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
        }),
      ],
    });
  }

  private static createBoldUnderlinedParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          underline: { type: "single" },
        }),
      ],
      spacing: { before: 240, after: 240 },
    });
  }

  private static createContactDetail(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({ text: label }),
        new TextRun({ text: ": " }),
        new TextRun({ text: value || "........................" }),
      ],
    });
  }

  private static createBlankLine(size: number = 60): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: " ", size: size })],
      spacing: { before: 0, after: 0, line: 100, lineRule: "exact" },
    });
  }

  private static createHeaderCell(
    text: string,
    width: string | number,
  ): TableCell {
    const widthSetting =
      width === "auto"
        ? undefined
        : { size: width as number, type: WidthType.PERCENTAGE };

    return new TableCell({
      width: widthSetting,
      children: [
        new Paragraph({
          children: [
            new TextRun({ text, bold: true, size: this.DEFAULT_FONT_SIZE }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static createTableCell(
    text: string,
    alignment: "left" | "center" | "right",
    colSpan?: number,
  ): TableCell {
    const alignmentMap = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
    };

    return new TableCell({
      columnSpan: colSpan,
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: this.DEFAULT_FONT_SIZE })],
          alignment: alignmentMap[alignment],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  public static async getUnitDetails(
    unitCode: string,
  ): Promise<UnitDetails | null> {
    try {
      console.log("Fetching unit details for:", unitCode);
      const { data: unitData, error: unitError } = await supabase
        .from("Monada")
        .select("*")
        .eq("unit", unitCode)
        .single();

      if (unitError) {
        console.error("Error fetching unit details:", unitError);
        return null;
      }

      console.log("Unit details fetched:", unitData);
      return unitData;
    } catch (error) {
      console.error("Error in getUnitDetails:", error);
      return null;
    }
  }

  public async formatOrthiEpanalipsi(data: {
    comments: string;
    originalDocument: DocumentData;
    project_id: string;
    project_na853: string;
    protocol_number_input: string;
    protocol_date: string;
    unit: string;
    expenditure_type: string;
    recipients: Array<{
      firstname: string;
      lastname: string;
      afm: string;
      amount: number;
      installment: number;
    }>;
    total_amount: number;
  }): Promise<Buffer> {
    try {
      console.log("Formatting orthi epanalipsi document with data:", data);

      // Get unit details
      const unitDetails = await DocumentFormatter.getUnitDetails(data.unit);

      const sections = [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margins: DocumentFormatter.DOCUMENT_MARGINS,
              orientation: PageOrientation.PORTRAIT,
            },
          },
          children: [
            await DocumentFormatter.createDocumentHeader(data, unitDetails || undefined),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ",
                  bold: true,
                  size: 32,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 240, after: 240 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Λόγος διόρθωσης: ",
                  bold: true,
                }),
                new TextRun({
                  text: data.comments || '',
                }),
              ],
              spacing: { before: 240, after: 480 },
            }),
            ...DocumentFormatter.createDocumentSubject(data, unitDetails || {}),
            ...DocumentFormatter.createMainContent(data, unitDetails || {}),
            DocumentFormatter.createPaymentTable(data.recipients),
            DocumentFormatter.createNote(),
            DocumentFormatter.createFooter(data, unitDetails),
          ],
        },
      ];

      const doc = new Document({
        sections,
        styles: {
          default: {
            document: {
              run: {
                font: DocumentFormatter.DEFAULT_FONT,
                size: DocumentFormatter.DEFAULT_FONT_SIZE,
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
      console.error("Error formatting orthi epanalipsi document:", error);
      throw error;
    }
  }
}