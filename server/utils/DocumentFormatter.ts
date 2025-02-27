import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, VerticalAlign, HeightRule, ITableBordersOptions } from 'docx';
import { supabase } from '../config/db';

interface UnitDetails {
  unit_name?: string;
  manager?: string;
  email?: string;
}

interface DocumentData {
  id: number;
  unit: string;
  project_id: string;
  project_na853?: string;
  expenditure_type: string;
  status?: string;
  total_amount?: number;
  protocol_number?: string;
  protocol_date?: string;
  recipients?: Array<{
    firstname: string;
    lastname: string;
    afm: string;
    amount: number;
    installment: number;
  }>;
}

export class DocumentFormatter {
  private static readonly DEFAULT_FONT_SIZE = 22; // 11pt in half-points
  private static readonly DEFAULT_FONT = "Times New Roman";
  private static readonly DEFAULT_MARGINS = {
    top: 426,    // 0.3 inches in twips
    right: 1133, // 0.79 inches in twips
    bottom: 1440, // 1 inch in twips
    left: 1134,  // 0.79 inches in twips
  };

  static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      const unitDetails = await this.getUnitDetails(documentData.unit);

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: this.DEFAULT_MARGINS,
              size: {
                width: 11906,  // A4 width in twips
                height: 16838, // A4 height in twips
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
              paragraph: {
                spacing: { line: 360, lineRule: "atLeast" },
              },
            },
          },
          paragraphStyles: [
            {
              id: "a6",
              name: "A6 Style",
              run: {
                font: this.DEFAULT_FONT,
                size: this.DEFAULT_FONT_SIZE,
              },
              paragraph: {
                spacing: { line: 360, lineRule: "atLeast" },
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

  private static createHeader(documentData: DocumentData, unitDetails?: UnitDetails): Table {
    return new Table({
      width: { size: 9629, type: WidthType.DXA },
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
              width: { size: 5524, type: WidthType.DXA },
              gridSpan: 2,
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
                new Paragraph({ text: "", spacing: { after: 240 } }),
                this.createContactDetail("Ταχ. Δ/νση", "Κηφισίας 124 & Ιατρίδου 2"),
                this.createContactDetail("Ταχ. Κώδικας", "11526, Αθήνα"),
                this.createContactDetail("Πληροφορίες", unitDetails?.manager || "-"),
                this.createContactDetail("Email", unitDetails?.email || "daefkke@civilprotection.gr"),
              ],
            }),
            new TableCell({
              width: { size: 4105, type: WidthType.DXA },
              gridSpan: 2,
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
                new Paragraph({ text: "", spacing: { before: 240, after: 240 } }),
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
                new Paragraph({ text: "", spacing: { before: 240, after: 240 } }),
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
      width: { size: 9629, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 4 },
        left: { style: BorderStyle.SINGLE, size: 4 },
        right: { style: BorderStyle.SINGLE, size: 4 },
      },
      rows: [
        new TableRow({
          height: { value: 400, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 888, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4 },
                bottom: { style: BorderStyle.SINGLE, size: 4 },
                left: { style: BorderStyle.SINGLE, size: 4 },
                right: { style: BorderStyle.SINGLE, size: 4 },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "ΘΕΜΑ:",
                      bold: true,
                      italics: true,
                      size: this.DEFAULT_FONT_SIZE,
                    }),
                  ],
                  spacing: { line: 20, lineRule: "atLeast" },
                }),
              ],
            }),
            new TableCell({
              width: { size: 8741, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4 },
                bottom: { style: BorderStyle.SINGLE, size: 4 },
                left: { style: BorderStyle.SINGLE, size: 4 },
                right: { style: BorderStyle.SINGLE, size: 4 },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Διαβιβαστικό αιτήματος για την πληρωμή Δ.Κ.Α. που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε.",
                      italics: true,
                      size: this.DEFAULT_FONT_SIZE,
                    }),
                  ],
                  spacing: { line: 20, lineRule: "atLeast" },
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
        spacing: { line: 360, lineRule: "atLeast" },
      }),
      new Paragraph({
        text: "Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε. , σύμφωνα με τα κάτωθι στοιχεία.",
        spacing: { before: 180, after: 180 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", bold: true }),
          new TextRun({ text: `${documentData.project_na853 || "(na853)"} της ΣΑΝΑ 853 (ΤΕ 2023ΝΑ27100228)` }),
        ],
        spacing: { after: 180 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΛΕ: ", bold: true }),
          new TextRun({ text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ." }),
        ],
        spacing: { after: 180 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΤΟΜΕΑΣ: ", bold: true }),
          new TextRun({ text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών" }),
        ],
        spacing: { before: 180, after: 360 },
      }),
    ];
  }

  private static createPaymentTable(recipients: DocumentData['recipients']): Table {
    const tableBorders: ITableBordersOptions = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    };

    return new Table({
      width: { size: 9629, type: WidthType.DXA },
      borders: tableBorders,
      rows: [
        new TableRow({
          height: { value: 360, rule: HeightRule.EXACT },
          children: [
            this.createHeaderCell("Α.Α.", 666),
            this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", 4366),
            this.createHeaderCell("ΠΟΣΟ (€)", 1409),
            this.createHeaderCell("ΔΟΣΗ", 1197),
            this.createHeaderCell("ΑΦΜ", 1615),
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
        new TableRow({
          height: { value: 360, rule: HeightRule.EXACT },
          children: [
            this.createTableCell("ΣΥΝΟΛΟ:", "right", 2),
            this.createTableCell(
              recipients.reduce((sum, recipient) => sum + recipient.amount, 0).toLocaleString('el-GR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) + " €",
              "right"
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
      spacing: { before: 360, after: 360 },
    });
  }

  private static createFooter(documentData: DocumentData, unitDetails?: UnitDetails): Table {
    return new Table({
      width: { size: 11478, type: WidthType.DXA },
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
              width: { size: 6663, type: WidthType.DXA },
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
                    indent: { left: 426 },
                    style: "a6",
                  })
                ),
                new Paragraph({ text: "" }),
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
                new Paragraph({ text: "" }),
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
              width: { size: 4815, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({ text: "", spacing: { before: 720 } }),
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
      spacing: { before: 120, after: 120 },
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
      spacing: { before: 120, after: 120 },
    });
  }

  private static createHeaderCell(text: string, width: number): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
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