import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, VerticalAlign, HeightRule, ITableBordersOptions, ImageRun } from 'docx';
import { supabase } from '../config/db';
import * as fs from 'fs';
import * as path from 'path';
import { before } from 'node:test';

interface UnitDetails {
  unit_name?: string;
  manager?: string;
  email?: string;
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
  recipients?: Array<{
    firstname: string;
    lastname: string;
    afm: string;
    amount: number;
    installment: number;
  }>;
}

export class DocumentFormatter {
  private static readonly DEFAULT_FONT_SIZE = 22;
  private static readonly DEFAULT_FONT = "Calibri";
  private static readonly DEFAULT_MARGINS = {
    top: 100,
    right: 800,
    bottom: 1440,
    left: 1134,
  };

  private static async getLogoImageData(): Promise<Buffer> {
    const logoPath = path.join(process.cwd(), 'attached_assets', 'ethnosimo22.png');
    return fs.promises.readFile(logoPath);
  }

  private static async createDocumentHeader(documentData: DocumentData, unitDetails?: UnitDetails): Promise<Table> {
    const logoBuffer = await this.getLogoImageData();

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [65, 35],
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
                margins: {
                  top: 0,
                  bottom: 120,
                  left: 120,
                  right: 120
                },
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: {
                          width: 100,
                          height: 50,
                        },
                        type: 'png',
                      }),
                      this.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                      this.createBoldParagraph("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ"),
                      this.createBoldParagraph("ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ"),
                      this.createBoldParagraph("ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ"),
                      this.createBoldParagraph(unitDetails?.unit_name || documentData.unit),
                      this.createContactDetail("Ταχ. Δ/νση", "Κηφισίας 124 & Ιατρίδου 2"),
                      this.createContactDetail("Ταχ. Κώδικας", "11526, Αθήνα"),
                      this.createContactDetail("Πληροφορίες", documentData.user_name || "......................"),
                    ],
                    spacing: { after: 200 },
                  }),
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
                margins: {
                  top: 120,
                  bottom: 120,
                  left: 120,
                  right: 120
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Ημερομηνία: ${documentData.protocol_date ? format(new Date(documentData.protocol_date), 'dd/MM/yyyy') : '........................'}
`                      }),
                  ],
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 520 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Αρ. Πρωτ.: ${documentData.protocol_number_input || documentData.protocol_number || '......................'}`, bold: true })],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  text: "",
                  spacing: { before: 360 },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          children: [
                            new Paragraph({
                              text: "ΠΡΟΣ: Γενική Δ/νση Οικονομικών Υπηρεσιών",
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
                              alignment: AlignmentType.LEFT,
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          children: [
                            new Paragraph({
                              text: "Αντίγραφο στο:",
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "Χωρίς αναγνωρίσιμο κείμενο",
                              alignment: AlignmentType.LEFT,
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
  public static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      console.log("Generating document for:", documentData);

      const unitDetails = await this.getUnitDetails(documentData.unit);
      console.log("Unit details:", unitDetails);

      const sections = [{
        properties: {},
        children: [
          await this.createDocumentHeader(documentData, unitDetails || undefined),
          ...this.createDocumentSubject(),
          ...this.createMainContent(documentData),
          this.createPaymentTable(documentData.recipients || []),
          this.createNote(),
          this.createFooter(documentData, unitDetails || undefined),
        ]
      }];

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
        }
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
  }
  private static createDocumentSubject(): (Table | Paragraph)[] {
    const subjectText = [
      {
        text: "ΘΕΜΑ:",
        bold: true,
        italics: true,
      },
      {
        text: " Διαβιβαστικό αιτήματος για την πληρωμή Δ.Κ.Α. που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
        italics: true,
      }
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
                  top: 240,
                  bottom: 240,
                  left: 240,
                  right: 240
                },
                width: { size: 100, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: subjectText.map(part =>
                      new TextRun({
                        text: part.text,
                        bold: part.bold,
                        italics: part.italics,
                        size: this.DEFAULT_FONT_SIZE,
                      })
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

  private static createMainContent(documentData: DocumentData): Paragraph[] {
    return [
      new Paragraph({
        text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
      }),
      new Paragraph({
        text: "Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε. , σύμφωνα με τα κάτωθι στοιχεία.",
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", bold: true }),
          new TextRun({ text: `${documentData.project_na853 || "(na853)"} της ΣΑΝΑ 853 (ΤΕ 2023ΝΑ27100228)` }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΛΕ: ", bold: true }),
          new TextRun({ text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ." }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΤΟΜΕΑΣ: ", bold: true }),
          new TextRun({ text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών" }),
        ],
      }),
    ];
  }

  private static createPaymentTable(recipients: NonNullable<DocumentData['recipients']>): Table {
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
      ...recipients.map((recipient, index) =>
        new TableRow({
          height: { value: 360, rule: HeightRule.EXACT },
          children: [
            this.createTableCell((index + 1).toString() + ".", "center"),
            this.createTableCell(`${recipient.lastname} ${recipient.firstname}`.trim(), "left"),
            this.createTableCell(recipient.amount.toLocaleString('el-GR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }), "right"),
            this.createTableCell(recipient.installment.toString(), "center"),
            this.createTableCell(recipient.afm, "center"),
          ],
        })
      ),
    ];

    const totalAmount = recipients.reduce((sum, recipient) => sum + recipient.amount, 0);
    rows.push(
      new TableRow({
        height: { value: 360, rule: HeightRule.EXACT },
        children: [
          this.createTableCell("ΣΥΝΟΛΟ:", "right", 2),
          this.createTableCell(
            totalAmount.toLocaleString('el-GR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €",
            "right"
          ),
          this.createTableCell("", "center", 2),
        ],
      })
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows,
    });
  }

  private static createNote(): Paragraph {
    return new Paragraph({
      text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσίας μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
    });
  }

  private static createFooter(documentData: DocumentData, unitDetails?: UnitDetails): Table {
    const attachments = (documentData.attachments || [])
      .map(item => item.replace(/^\d+\-/, ''))
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
                this.createBoldUnderlinedParagraph("ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)"),
                ...attachments.map((item, index) =>
                  new Paragraph({
                    text: `${index + 1}. ${item}`,
                    indent: { left: 426 },
                    style: "a6",
                  })
                ),
                this.createBoldUnderlinedParagraph("ΚΟΙΝΟΠΟΙΗΣΗ"),
                ...["Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
                  "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
                  "Γ.Δ.Α.Ε.Φ.Κ."].map((item, index) =>
                  new Paragraph({
                    text: `${index + 1}. ${item}`,
                    indent: { left: 426 },
                    style: "a6",
                  })
                ),
                this.createBoldUnderlinedParagraph("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ"),
                ...["Χρονολογικό Αρχείο", "Τμήμα Β/20.51", "Αβραμόπουλο Ι."].map((item, index) =>
                  new Paragraph({
                    text: `${index + 1}. ${item}`,
                    indent: { left: 426 },
                    style: "a6",
                  })
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
                  children: [
                    new TextRun({
                      text: "ΜΕ ΕΝΤΟΛΗ ΠΡΟΪΣΤΑΜΕΝΗΣ Γ.Δ.Α.Ε.Φ.Κ.",
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({ text: "", spacing: { before: 720 } }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  text: "ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ με Α΄ β.",
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
        new TextRun({ text: value }),
      ],
    });
  }

  private static createHeaderCell(text: string, width: string | number): TableCell {
    const widthSetting = width === "auto"
      ? undefined
      : { size: width as number, type: WidthType.PERCENTAGE };

    return new TableCell({
      width: widthSetting,
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: this.DEFAULT_FONT_SIZE })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static createTableCell(
    text: string,
    alignment: "left" | "center" | "right",
    colSpan?: number
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

  public static async getUnitDetails(unitCode: string): Promise<UnitDetails | null> {
    try {
      console.log("Fetching unit details for:", unitCode);
      const { data: unitData, error: unitError } = await supabase
        .from('unit_det')
        .select('*')
        .eq('unit', unitCode)
        .single();

      if (unitError) {
        console.error("Error fetching unit details:", unitError);
        return null;
      }

      console.log("Unit details fetched:", unitData);
      return unitData;
    } catch (error) {
      console.error('Error in getUnitDetails:', error);
      return null;
    }
  }
}