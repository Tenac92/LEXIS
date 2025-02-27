import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  VerticalAlign,
  ITableBordersOptions,
  HeightRule,
} from "docx";
import { supabase } from "../config/db";

interface DocumentData {
  unit: string;
  telephone?: string;
  expenditure_type?: string;
  recipients?: Array<{
    lastname: string;
    firstname: string;
    fathername?: string;
    amount: number;
    installment: number;
    afm: string;
  }>;
  project_na853?: string;
  project_id?: string;
  total_amount?: number;
  id: number;
  protocol_number?: string;
  protocol_date?: string;
}

interface UnitDetails {
  unit_name?: string;
  manager?: string;
  email?: string;
}

export class DocumentFormatter {
  private static readonly DEFAULT_FONT_SIZE = 22; // 11pt
  private static readonly DEFAULT_FONT = "Times New Roman";
  private static readonly DEFAULT_MARGINS = {
    top: 426,    // 0.3 inches
    right: 1133, // 0.79 inches
    bottom: 1440, // 1 inch
    left: 1134,  // 0.79 inches
  };

  static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      // Get unit details
      const unitDetails = await this.getUnitDetails(documentData.unit);

      // Create document with specific sections
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: this.DEFAULT_MARGINS,
              size: {
                width: 11906,
                height: 16838,
              },
            },
          },
          children: [
            this.createHeader(documentData, unitDetails),
            this.createSubject(),
            ...this.createMainContent(documentData),
            this.createPaymentTable(documentData.recipients || []),
            this.createNote(),
            this.createFooter(documentData, unitDetails),
          ]
        }],
        styles: {
          default: {
            document: {
              run: {
                font: this.DEFAULT_FONT,
                size: this.DEFAULT_FONT_SIZE,
              },
            },
          },
        },
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
  }

  private static createHeader(documentData: DocumentData, unitDetails?: UnitDetails): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                this.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                this.createBoldParagraph("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ"),
                this.createBoldParagraph("ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ"),
                this.createBoldParagraph("ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ"),
                this.createBoldParagraph(unitDetails?.unit_name || documentData.unit),
                new Paragraph({ text: "" }),
                this.createContactDetail("Ταχ. Δ/νση", "Κηφισίας 124 & Ιατρίδου 2"),
                this.createContactDetail("Ταχ. Κώδικας", "11526, Αθήνα"),
                this.createContactDetail("Πληροφορίες", unitDetails?.manager || "-"),
                this.createContactDetail("Email", unitDetails?.email || "daefkke@civilprotection.gr"),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
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
                      text: "ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ",
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({ text: "" }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Αθήνα, ${documentData.protocol_date || '........................'}`,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Αρ. Πρωτ.: ${documentData.protocol_number || '......................'}`,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({ text: "" }),
                new Paragraph({
                  text: "ΠΡΟΣ: Γενική Δ/νση Οικονομικών Υπηρεσιών",
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  text: "Διεύθυνση Οικονομικής Διαχείρισης",
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  private static createSubject(): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 4 },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          height: { value: 400, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΘΕΜΑ:",
                      bold: true,
                      italics: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 85, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Διαβιβαστικό αιτήματος για την πληρωμή Δ.Κ.Α. που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
                      italics: true,
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

  private static createMainContent(documentData: DocumentData): Paragraph[] {
    return [
      new Paragraph({
        text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
        spacing: { before: 240, after: 240 },
      }),
      new Paragraph({
        text: "Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε. , σύμφωνα με τα κάτωθι στοιχεία.",
        spacing: { before: 240, after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", bold: true }),
          new TextRun({ text: `${documentData.project_na853 || "(na853)"} της ΣΑΝΑ 853 (ΤΕ 2023ΝΑ27100228)` }),
        ],
        spacing: { before: 240, after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΛΕ: ", bold: true }),
          new TextRun({ text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ." }),
        ],
        spacing: { before: 240, after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΤΟΜΕΑΣ: ", bold: true }),
          new TextRun({ text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών" }),
        ],
        spacing: { before: 240, after: 480 },
      }),
    ];
  }

  private static createPaymentTable(recipients: DocumentData['recipients']): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      },
      rows: [
        new TableRow({
          children: [
            this.createHeaderCell("Α.Α.", 10),
            this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", 40),
            this.createHeaderCell("ΠΟΣΟ (€)", 20),
            this.createHeaderCell("ΔΟΣΗ", 15),
            this.createHeaderCell("ΑΦΜ", 15),
          ],
        }),
        ...recipients.map((recipient, index) =>
          new TableRow({
            children: [
              this.createTableCell((index + 1).toString() + ".", "center"),
              this.createTableCell(`${recipient.lastname} ${recipient.firstname} ${recipient.fathername || ''}`.trim(), "left"),
              this.createTableCell(recipient.amount.toLocaleString('el-GR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }), "right"),
              this.createTableCell(recipient.installment.toString(), "center"),
              this.createTableCell(recipient.afm, "center"),
            ],
          })
        ),
        new TableRow({
          children: [
            this.createTableCell("ΣΥΝΟΛΟ:", "right", 2, true),
            this.createTableCell(
              recipients.reduce((sum, recipient) => sum + recipient.amount, 0).toLocaleString('el-GR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) + " €",
              "right",
              true
            ),
            this.createTableCell("", "center", 2),
          ],
        }),
      ],
    });
  }

  private static createNote(): Paragraph {
    return new Paragraph({
      text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσίας μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
      spacing: { before: 480, after: 480 },
    });
  }

  private static createFooter(documentData: DocumentData, unitDetails?: UnitDetails): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                this.createBoldUnderlinedParagraph("ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)"),
                ...["Διαβιβαστικό", "ΔΚΑ"].map((item, index) =>
                  new Paragraph({
                    text: `${index + 1}. ${item}`,
                    indent: { left: 720 },
                  })
                ),
                new Paragraph({ text: "" }),
                this.createBoldUnderlinedParagraph("ΚΟΙΝΟΠΟΙΗΣΗ"),
                new Paragraph({
                  text: "1. Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
                  indent: { left: 720 },
                }),
                new Paragraph({
                  text: "2. Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
                  indent: { left: 720 },
                }),
                new Paragraph({
                  text: "3. Γ.Δ.Α.Ε.Φ.Κ.",
                  indent: { left: 720 },
                }),
                new Paragraph({ text: "" }),
                this.createBoldUnderlinedParagraph("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ"),
                new Paragraph({
                  text: "1. Χρονολογικό Αρχείο",
                  indent: { left: 720 },
                }),
                new Paragraph({
                  text: "2. Τμήμα Β/20.51",
                  indent: { left: 720 },
                }),
                new Paragraph({
                  text: "3. Αβραμόπουλο Ι.",
                  indent: { left: 720 },
                }),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({ text: "", spacing: { before: 480 } }),
                new Paragraph({
                  text: "ΜΕ ΕΝΤΟΛΗ ΠΡΟΪΣΤΑΜΕΝΗΣ Γ.Δ.Α.Ε.Φ.Κ.",
                  alignment: AlignmentType.CENTER,
                  bold: true,
                }),
                new Paragraph({
                  text: "Ο ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΣ Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
                  alignment: AlignmentType.CENTER,
                  bold: true,
                }),
                new Paragraph({ text: "", spacing: { before: 720 } }),
                new Paragraph({
                  text: "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
                  alignment: AlignmentType.CENTER,
                  bold: true,
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

  private static createHeaderCell(text: string, widthPercent: number): TableCell {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true })],
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
    bold?: boolean
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
          children: [new TextRun({ text, bold: bold || false })],
          alignment: alignmentMap[alignment],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static async getUnitDetails(unitCode: string): Promise<UnitDetails | null> {
    try {
      const { data: unitData, error: unitError } = await supabase
        .from('unit_det')
        .select('*')
        .eq('unit', unitCode)
        .single();

      if (unitError) {
        console.error("Error fetching unit details:", unitError);
        return null;
      }

      return unitData;
    } catch (error) {
      console.error('Error in getUnitDetails:', error);
      return null;
    }
  }
}