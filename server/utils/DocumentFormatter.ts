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
  private static readonly DEFAULT_FONT_SIZE = 24; // 12pt in half-points
  private static readonly DEFAULT_FONT = "Times New Roman";
  private static readonly DEFAULT_MARGINS = {
    top: 850,
    right: 1000,
    bottom: 850,
    left: 1000
  };

  static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      console.log("Starting document generation with data:", JSON.stringify(documentData, null, 2));

      // Get unit details
      const unitDetails = await this.getUnitDetails(documentData.unit);
      if (!unitDetails) {
        console.warn("No unit details found for unit:", documentData.unit);
      }

      // Create document sections
      const headerSection = await this.createHeader(documentData, unitDetails);
      const mainContent = await this.createMainContent(documentData);
      const paymentTable = this.createPaymentTable(documentData.recipients || []);
      const footerSection = await this.createFooter(documentData, unitDetails);

      // Create document
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
            ...headerSection,
            ...mainContent,
            paymentTable,
            ...footerSection
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
        }
      });

      // Generate buffer
      console.log("Generating document buffer...");
      const buffer = await Packer.toBuffer(doc);

      if (!buffer || buffer.length === 0) {
        throw new Error('Generated document buffer is empty');
      }

      console.log("Document generated successfully, buffer size:", buffer.length);
      return buffer;

    } catch (error) {
      console.error("Error in document generation:", error);
      throw error;
    }
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

  private static async createHeader(documentData: DocumentData, unitDetails?: UnitDetails) {
    const headerParagraphs = [
      this.createCenteredParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ", true),
      this.createCenteredParagraph("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &", true),
      this.createCenteredParagraph("ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ", true),
      this.createCenteredParagraph("ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ", true),
      this.createCenteredParagraph("ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ", true),
      this.createCenteredParagraph("ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ", true),
      this.createCenteredParagraph(unitDetails?.unit_name || documentData.unit, true),
    ];

    // Right-aligned web posting notice
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ", bold: true, size: this.DEFAULT_FONT_SIZE })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240, after: 240 }
      })
    );

    // Contact information table
    const contactTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: this.getNoBorders(),
      rows: [
        this.createContactRow("Ταχ. Δ/νση", "Κηφισίας 124 & Ιατρίδου 2"),
        this.createContactRow("Ταχ. Κώδικας", "11526, Αθήνα"),
        this.createContactRow("Πληροφορίες", unitDetails?.manager || "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ"),
        this.createContactRow("Email", unitDetails?.email || "daefkke@civilprotection.gr")
      ]
    });

    // Protocol number and date
    const protocolHeader = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: this.getNoBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: "" })],
              width: { size: 60, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({
                    text: `Αθήνα, ${documentData.protocol_date || '........................'}`,
                    size: this.DEFAULT_FONT_SIZE
                  })],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [new TextRun({
                    text: `Αρ. Πρωτ.: ${documentData.protocol_number || '......................'}`,
                    size: this.DEFAULT_FONT_SIZE,
                    bold: true
                  })],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 40, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    });

    return [...headerParagraphs, contactTable, protocolHeader];
  }

  private static async createMainContent(documentData: DocumentData) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "ΘΕΜΑ: ",
            size: this.DEFAULT_FONT_SIZE,
            bold: true
          }),
          new TextRun({
            text: "Έγκριση καταβολής Στεγαστικής Συνδρομής για την αποκατάσταση της κτηριακής βλάβης που προκλήθηκε από τον σεισμό της 27ης Σεπτεμβρίου 2021 στον Δήμο Μινώα Πεδιάδας της Περιφερειακής Ενότητας Ηρακλείου της Περιφέρειας Κρήτης",
            size: this.DEFAULT_FONT_SIZE
          })
        ],
        spacing: { before: 480, after: 240 }
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: "Έχοντας υπόψη:",
            size: this.DEFAULT_FONT_SIZE,
            bold: true
          })
        ],
        spacing: { before: 240, after: 240 }
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: "1. Το ν. 867/1979 (Α΄ 24) «Περί κυρώσεως, τροποποιήσεως και συμπληρώσεως της από 28.7.1978 Πράξεως Νομοθετικού Περιεχομένου του Προέδρου της Δημοκρατίας «περί αποκαταστάσεως ζημιών εκ των σεισμών 1978 εις περιοχή Βορείου Ελλάδος κ.λπ. και ρυθμίσεως ετέρων τινών συναφών θεμάτων»",
            size: this.DEFAULT_FONT_SIZE
          })
        ],
        spacing: { before: 120, after: 120 }
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: "2. Την υπό στοιχεία Δ.Α.Ε.Φ.Κ.-Κ.Ε./οικ.18450/Α321/20.10.2021 (Β΄4882) απόφαση των Υπουργών Οικονομικών, Ανάπτυξης και Επενδύσεων και Υποδομών και Μεταφορών",
            size: this.DEFAULT_FONT_SIZE
          })
        ],
        spacing: { before: 120, after: 120 }
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: "3. Το από ",
            size: this.DEFAULT_FONT_SIZE
          }),
          new TextRun({
            text: documentData.project_na853 || '(NA853)',
            size: this.DEFAULT_FONT_SIZE,
            bold: true
          }),
          new TextRun({
            text: " χρηματικό ένταλμα ύψους ",
            size: this.DEFAULT_FONT_SIZE
          }),
          new TextRun({
            text: `${parseFloat(documentData.total_amount?.toString() || '0').toLocaleString('el-GR', { minimumFractionDigits: 2 })} €`,
            size: this.DEFAULT_FONT_SIZE,
            bold: true
          })
        ],
        spacing: { before: 120, after: 240 }
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: "Εγκρίνουμε",
            size: this.DEFAULT_FONT_SIZE,
            bold: true
          })
        ],
        spacing: { before: 240, after: 240 },
        alignment: AlignmentType.CENTER
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: "την καταβολή Στεγαστικής Συνδρομής για την αποκατάσταση των πληγέντων κτηρίων από τον σεισμό της 27ης Σεπτεμβρίου 2021 που έπληξε περιοχές της Περιφερειακής Ενότητας Ηρακλείου της Περιφέρειας Κρήτης, στους παρακάτω δικαιούχους:",
            size: this.DEFAULT_FONT_SIZE
          })
        ],
        spacing: { before: 240, after: 240 }
      })
    ];
  }

  private static createPaymentTable(recipients: DocumentData['recipients'] = []) {
    const rows = [
      new TableRow({
        children: [
          this.createTableHeaderCell("Α/Α"),
          this.createTableHeaderCell("ΕΠΩΝΥΜΟ"),
          this.createTableHeaderCell("ΟΝΟΜΑ"),
          this.createTableHeaderCell("ΠΑΤΡΩΝΥΜΟ"),
          this.createTableHeaderCell("ΑΦΜ"),
          this.createTableHeaderCell("ΠΟΣΟ (€)"),
          this.createTableHeaderCell("ΔΟΣΗ"),
        ],
      }),
      ...recipients.map((recipient, index) =>
        new TableRow({
          children: [
            this.createTableCell((index + 1).toString(), "center"),
            this.createTableCell(recipient.lastname, "left"),
            this.createTableCell(recipient.firstname, "left"),
            this.createTableCell(recipient.fathername || "", "left"),
            this.createTableCell(recipient.afm, "center"),
            this.createTableCell(
              recipient.amount.toLocaleString('el-GR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }),
              "right"
            ),
            this.createTableCell(recipient.installment.toString(), "center"),
          ],
        })
      ),
    ];

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
      rows,
    });
  }

  private static async createFooter(documentData: DocumentData, unitDetails?: UnitDetails) {
    const managerName = unitDetails?.manager?.split(' ΠΟΛ')[0].trim() || "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

    const { data: attachmentData } = await supabase
      .from("attachments")
      .select("*")
      .eq("expediture_type", documentData.expenditure_type)
      .eq("installment", documentData.recipients?.[0]?.installment || 1)
      .single();

    const attachments = attachmentData?.attachments || [
      "Διαβιβαστικό",
      "ΔΚΑ"
    ];

    const notifications = [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ."
    ];

    const internalDist = [
      "Χρονολογικό Αρχείο",
      "Τμήμα Β/20.51",
      "Αβραμόπουλο Ι."
    ];

    return [
      this.createParagraphWithSpacing("ΣΥΝΗΜΜΕΝΑ:", true),
      ...attachments.map((item, index) =>
        this.createParagraphWithSpacing(`${index + 1}. ${item}`, false, 240)
      ),
      this.createParagraphWithSpacing("ΚΟΙΝΟΠΟΙΗΣΗ:", true),
      ...notifications.map((item, index) =>
        this.createParagraphWithSpacing(`${index + 1}. ${item}`, false, 240)
      ),
      this.createParagraphWithSpacing("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ:", true),
      ...internalDist.map((item, index) =>
        this.createParagraphWithSpacing(`${index + 1}. ${item}`, false, 240)
      ),
      this.createCenteredParagraph(
        `Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ ${unitDetails?.unit_name || 'Δ.Α.Ε.Φ.Κ.'}`,
        true,
        { before: 1440, after: 720 }
      ),
      this.createCenteredParagraph(managerName, true),
      this.createCenteredParagraph("ΠΟΛ. ΜΗΧΑΝΙΚΟΣ"),
    ];
  }

  private static createCenteredParagraph(text: string, bold: boolean = false, spacing?: { before: number; after: number }) {
    return new Paragraph({
      children: [new TextRun({ text, bold, size: this.DEFAULT_FONT_SIZE })],
      alignment: AlignmentType.CENTER,
      spacing: spacing || { before: 200, after: 200 },
    });
  }

  private static createParagraphWithSpacing(text: string, bold: boolean = false, indent: number = 0) {
    return new Paragraph({
      children: [new TextRun({ text, bold, size: this.DEFAULT_FONT_SIZE })],
      spacing: { before: 100, after: 100 },
      indent: indent ? { left: indent } : undefined
    });
  }

  private static createContactRow(label: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label + ":", size: this.DEFAULT_FONT_SIZE })]
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: value, size: this.DEFAULT_FONT_SIZE })]
          })],
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  }

  private static createTableHeaderCell(text: string) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: this.DEFAULT_FONT_SIZE })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static createTableCell(text: string, alignment: "left" | "center" | "right") {
    const alignmentMap = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT
    };

    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: this.DEFAULT_FONT_SIZE })],
          alignment: alignmentMap[alignment],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private static getNoBorders() {
    return {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }
    };
  }
}