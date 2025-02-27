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
  private static readonly DEFAULT_FONT_SIZE = 24; // 12pt
  private static readonly DEFAULT_FONT = "Times New Roman";
  private static readonly DEFAULT_MARGINS = {
    top: 850,
    right: 1000,
    bottom: 850,
    left: 1000,
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
                width: 11906,  // A4 width in twips
                height: 16838, // A4 height in twips
              },
            },
          },
          children: [
            ...this.createHeaderSection(documentData, unitDetails),
            ...this.createMainContentSection(documentData),
            this.createPaymentTableSection(documentData.recipients || []),
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

      // Generate buffer
      return await Packer.toBuffer(doc);

    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
  }

  private static createHeaderSection(documentData: DocumentData, unitDetails?: UnitDetails) {
    return [
      // Header table containing organization details and protocol info
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: this.getNoBorders(),
        rows: [
          new TableRow({
            children: [
              // Left column with organization details
              new TableCell({
                children: [
                  ...this.createOrganizationHeader(),
                  ...this.createContactDetails(documentData, unitDetails),
                ],
                width: { size: 65, type: WidthType.PERCENTAGE },
              }),
              // Right column with web posting and protocol
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ", bold: true })],
                    alignment: AlignmentType.RIGHT,
                  }),
                  new Paragraph({ text: "" }),
                  new Paragraph({
                    children: [new TextRun({ 
                      text: `Αθήνα, ${documentData.protocol_date || '........................'}` 
                    })],
                    alignment: AlignmentType.RIGHT,
                  }),
                  new Paragraph({
                    children: [new TextRun({ 
                      text: `Αρ. Πρωτ.: ${documentData.protocol_number || '......................'}`,
                      bold: true
                    })],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 35, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: "", spacing: { before: 240, after: 240 } }),
    ];
  }

  private static createOrganizationHeader(): Paragraph[] {
    const headerLines = [
      "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ",
      "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &",
      "ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
      "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ",
      "ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ",
      "ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
    ];

    return headerLines.map(line => new Paragraph({
      children: [new TextRun({ text: line, bold: true })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120 },
    }));
  }

  private static createContactDetails(documentData: DocumentData, unitDetails?: UnitDetails): Paragraph[] {
    return [
      new Paragraph({
        children: [new TextRun({ text: unitDetails?.unit_name || documentData.unit, bold: true })],
        spacing: { before: 240, after: 240 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Ταχ. Δ/νση: Κηφισίας 124 & Ιατρίδου 2" })],
      }),
      new Paragraph({
        children: [new TextRun({ text: "Ταχ. Κώδικας: 11526, Αθήνα" })],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Πληροφορίες: ${unitDetails?.manager || "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ"}` })],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Email: ${unitDetails?.email || "daefkke@civilprotection.gr"}` })],
      }),
    ];
  }

  private static createMainContentSection(documentData: DocumentData): Paragraph[] {
    return [
      // Subject
      new Paragraph({
        children: [
          new TextRun({ text: "ΘΕΜΑ: ", bold: true }),
          new TextRun({ 
            text: "Έγκριση καταβολής Στεγαστικής Συνδρομής για την αποκατάσταση της κτηριακής βλάβης που προκλήθηκε από τον σεισμό της 27ης Σεπτεμβρίου 2021 στον Δήμο Μινώα Πεδιάδας της Περιφερειακής Ενότητας Ηρακλείου της Περιφέρειας Κρήτης" 
          }),
        ],
        spacing: { before: 360, after: 360 },
      }),

      // References section
      new Paragraph({
        children: [new TextRun({ text: "Έχοντας υπόψη:", bold: true })],
        spacing: { before: 240, after: 240 },
      }),

      new Paragraph({
        children: [new TextRun({ 
          text: "1. Το ν. 867/1979 (Α΄ 24) «Περί κυρώσεως, τροποποιήσεως και συμπληρώσεως της από 28.7.1978 Πράξεως Νομοθετικού Περιεχομένου του Προέδρου της Δημοκρατίας «περί αποκαταστάσεως ζημιών εκ των σεισμών 1978 εις περιοχή Βορείου Ελλάδος κ.λπ. και ρυθμίσεως ετέρων τινών συναφών θεμάτων»"
        })],
        spacing: { before: 120, after: 120 },
      }),

      new Paragraph({
        children: [new TextRun({ 
          text: "2. Την υπό στοιχεία Δ.Α.Ε.Φ.Κ.-Κ.Ε./οικ.18450/Α321/20.10.2021 (Β΄4882) απόφαση των Υπουργών Οικονομικών, Ανάπτυξης και Επενδύσεων και Υποδομών και Μεταφορών"
        })],
        spacing: { before: 120, after: 120 },
      }),

      new Paragraph({
        children: [
          new TextRun({ text: "3. Το από " }),
          new TextRun({ text: documentData.project_na853 || "(NA853)", bold: true }),
          new TextRun({ text: " χρηματικό ένταλμα ύψους " }),
          new TextRun({ 
            text: `${parseFloat(documentData.total_amount?.toString() || '0').toLocaleString('el-GR', { minimumFractionDigits: 2 })} €`,
            bold: true 
          }),
        ],
        spacing: { before: 120, after: 360 },
      }),

      // Approval section
      new Paragraph({
        children: [new TextRun({ text: "Εγκρίνουμε", bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 360 },
      }),

      new Paragraph({
        children: [new TextRun({ 
          text: "την καταβολή Στεγαστικής Συνδρομής για την αποκατάσταση των πληγέντων κτηρίων από τον σεισμό της 27ης Σεπτεμβρίου 2021 που έπληξε περιοχές της Περιφερειακής Ενότητας Ηρακλείου της Περιφέρειας Κρήτης, στους παρακάτω δικαιούχους:"
        })],
        spacing: { before: 240, after: 240 },
      }),
    ];
  }

  private static createPaymentTableSection(recipients: DocumentData['recipients']) {
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
            this.createTableHeaderCell("Α/Α"),
            this.createTableHeaderCell("ΕΠΩΝΥΜΟ"),
            this.createTableHeaderCell("ΟΝΟΜΑ"),
            this.createTableHeaderCell("ΠΑΤΡΩΝΥΜΟ"),
            this.createTableHeaderCell("ΑΦΜ"),
            this.createTableHeaderCell("ΠΟΣΟ (€)"),
            this.createTableHeaderCell("ΔΟΣΗ"),
          ],
        }),
        // Data rows
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
      ],
    });
  }

  private static createFooterSection(documentData: DocumentData, unitDetails?: UnitDetails) {
    const sections: Paragraph[] = [];

    // Attachments section
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: "ΣΥΝΗΜΜΕΝΑ:", bold: true })],
        spacing: { before: 360, after: 240 },
      })
    );

    const attachments = [
      "1. Διαβιβαστικό",
      "2. ΔΚΑ",
    ];

    attachments.forEach(attachment => {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: attachment })],
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
        })
      );
    });

    // Notifications section
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: "ΚΟΙΝΟΠΟΙΗΣΗ:", bold: true })],
        spacing: { before: 360, after: 240 },
      })
    );

    const notifications = [
      "1. Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "2. Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "3. Γ.Δ.Α.Ε.Φ.Κ.",
    ];

    notifications.forEach(notification => {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: notification })],
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
        })
      );
    });

    // Internal distribution section
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ:", bold: true })],
        spacing: { before: 360, after: 240 },
      })
    );

    const internalDist = [
      "1. Χρονολογικό Αρχείο",
      "2. Τμήμα Β/20.51",
      "3. Αβραμόπουλο Ι.",
    ];

    internalDist.forEach(dist => {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: dist })],
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
        })
      );
    });

    // Signature block
    sections.push(
      new Paragraph({ text: "", spacing: { before: 720 } }),
      new Paragraph({
        children: [new TextRun({ 
          text: `Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ ${unitDetails?.unit_name || 'Δ.Α.Ε.Φ.Κ.'}`,
          bold: true 
        })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "", spacing: { before: 720 } }),
      new Paragraph({
        children: [new TextRun({ 
          text: unitDetails?.manager?.split(' ΠΟΛ')[0].trim() || "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ",
          bold: true 
        })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: "ΠΟΛ. ΜΗΧΑΝΙΚΟΣ" })],
        alignment: AlignmentType.CENTER,
      })
    );

    return sections;
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

  private static createTableHeaderCell(text: string) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true })],
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
          children: [new TextRun({ text })],
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