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
  TableBorders,
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
  parts?: string[];
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
                width: 11906,  // A4 width
                height: 16838, // A4 height
              },
            },
          },
          children: [
            this.createHeaderTable(documentData, unitDetails),
            ...this.createMainContent(documentData),
            this.createRecipientsTable(documentData.recipients || []),
            ...this.createFooterSection(documentData, unitDetails),
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

  private static createHeaderTable(documentData: DocumentData, unitDetails?: UnitDetails): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: this.getNoBorders(),
      rows: [
        new TableRow({
          children: [
            // Left column - Organization details
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              borders: this.getNoBorders(),
              children: [
                // Logo placeholder
                new Paragraph({ text: "" }),
                // Organization details
                this.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                this.createBoldParagraph("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ"),
                this.createBoldParagraph("ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ"),
                this.createBoldParagraph("ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ"),
                this.createBoldParagraph(unitDetails?.unit_name || documentData.unit),
                new Paragraph({ text: "" }),
                // Contact details
                this.createContactDetail("Ταχ. Δ/νση", "Κηφισίας 124 & Ιατρίδου 2"),
                this.createContactDetail("Ταχ. Κώδικας", "11526, Αθήνα"),
                this.createContactDetail("Πληροφορίες", unitDetails?.manager || "-"),
                this.createContactDetail("Email", unitDetails?.email || "daefkke@civilprotection.gr"),
              ],
            }),
            // Right column - Protocol info
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: this.getNoBorders(),
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

  private static createMainContent(documentData: DocumentData): Paragraph[] {
    const content: Paragraph[] = [];

    // Subject section
    content.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
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
                width: { size: 90, type: WidthType.PERCENTAGE },
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
      }),
    );

    // References section
    content.push(
      new Paragraph({
        text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
        spacing: { before: 240, after: 240 },
      }),
    );

    // Main text
    content.push(
      new Paragraph({
        text: "Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε. , σύμφωνα με τα κάτωθι στοιχεία.",
        spacing: { before: 240, after: 240 },
      }),
    );

    // Project details
    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΡ. ΕΡΓΟΥ", bold: true }),
          new TextRun({ text: ": " }),
          new TextRun({ text: documentData.project_na853 || "(na853)" }),
          new TextRun({ text: " της ΣΑΝΑ 853 (ΤΕ 2023ΝΑ27100228)" }),
        ],
        spacing: { before: 240, after: 240 },
      }),
    );

    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΛΕ", bold: true }),
          new TextRun({ text: ": " }),
          new TextRun({ text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ." }),
        ],
        spacing: { before: 240, after: 240 },
      }),
    );

    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: "ΤΟΜΕΑΣ", bold: true }),
          new TextRun({ text: ": " }),
          new TextRun({ text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών" }),
        ],
        spacing: { before: 240, after: 240 },
      }),
    );

    return content;
  }

  private static createRecipientsTable(recipients: DocumentData['recipients']): Table {
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
        // Header row
        new TableRow({
          children: [
            this.createTableHeaderCell("Α.Α.", 7),
            this.createTableHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", 43),
            this.createTableHeaderCell("ΠΟΣΟ (€)", 15),
            this.createTableHeaderCell("ΔΟΣΗ", 12),
            this.createTableHeaderCell("ΑΦΜ", 18),
          ],
        }),
        // Data rows
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
        // Total row
        new TableRow({
          children: [
            this.createTableCell("ΣΥΝΟΛΟ:", "left", 2, true),
            this.createTableCell(
              recipients.reduce((sum, recipient) => sum + recipient.amount, 0).toLocaleString('el-GR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              "right",
              1,
              true
            ),
            this.createTableCell("", "center", 2),
          ],
        }),
      ],
    });
  }

  private static createFooterSection(documentData: DocumentData, unitDetails?: UnitDetails): Paragraph[] {
    const footer: Paragraph[] = [];

    // Final note
    footer.push(
      new Paragraph({
        text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσίας μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
        spacing: { before: 240, after: 240 },
      })
    );

    // Attachments and distribution sections using tables
    footer.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: this.getNoBorders(),
        rows: [
          new TableRow({
            children: [
              // Left column - Attachments and distributions
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: this.getNoBorders(),
                children: [
                  this.createSectionHeading("ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)"),
                  ...["Διαβιβαστικό", "ΔΚΑ"].map((item, index) =>
                    this.createListItem(`${index + 1}. ${item}`)
                  ),
                  new Paragraph({ text: "" }),
                  this.createSectionHeading("ΚΟΙΝΟΠΟΙΗΣΗ"),
                  ...this.createNotificationsList(),
                  new Paragraph({ text: "" }),
                  this.createSectionHeading("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ"),
                  ...this.createInternalDistributionList(),
                ],
              }),
              // Right column - Signature
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: this.getNoBorders(),
                children: [
                  new Paragraph({ text: "", spacing: { before: 720 } }),
                  this.createSignatureBlock(unitDetails),
                ],
              }),
            ],
          }),
        ],
      })
    );

    return footer;
  }

  private static createSectionHeading(text: string): Paragraph {
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

  private static createNotificationsList(): Paragraph[] {
    return [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ.",
    ].map((text, index) => this.createListItem(`${index + 1}. ${text}`));
  }

  private static createInternalDistributionList(): Paragraph[] {
    return [
      "Χρονολογικό Αρχείο",
      "Τμήμα Β/20.51",
      "Αβραμόπουλο Ι.",
    ].map((text, index) => this.createListItem(`${index + 1}. ${text}`));
  }

  private static createSignatureBlock(unitDetails?: UnitDetails): Paragraph[] {
    return [
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
    ];
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

  private static createContactDetail(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({ text: label }),
        new TextRun({ text: ": " }),
        new TextRun({ text: value }),
      ],
    });
  }

  private static createListItem(text: string): Paragraph {
    return new Paragraph({
      text,
      indent: { left: 720 },
      spacing: { before: 120, after: 120 },
    });
  }

  private static createTableHeaderCell(text: string, widthPercent: number): TableCell {
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
    colSpan: number = 1,
    bold: boolean = false
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
          children: [new TextRun({ text, bold })],
          alignment: alignmentMap[alignment],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static getNoBorders(): TableBorders {
    return {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    };
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