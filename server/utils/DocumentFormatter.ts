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
import { supabase } from "../db";

export class DocumentFormatter {
  static getDefaultMargins() {
    return {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440,
    };
  }

  static formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat("el-GR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `${amount} €`;
    }
  }

  static async getUnitDetails(unitCode: string) {
    try {
      console.log("Fetching unit details for:", unitCode);

      const { data: unitData, error: unitError } = await supabase
        .from('unit_det')
        .select('*')
        .eq('unit', unitCode as string)
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

  static async generateDocument(documentData: any) {
    try {
      console.log("Starting document generation with data:", documentData);

      // Get unit details first
      const unitDetails = await this.getUnitDetails(documentData.unit);
      console.log("Unit details for document:", unitDetails);

      // Create document sections
      const headerSection = await this.createHeader(documentData, unitDetails);
      const referenceSection = this.createReferenceSection();
      const paymentTable = this.createPaymentTable(documentData.recipients || []);
      const footerSection = await this.createFooter(documentData, unitDetails);

      // Create document with all sections
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: this.getDefaultMargins(),
              },
            },
            children: [
              ...headerSection, // Spread the header paragraphs
              new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
              ...referenceSection,
              new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
              paymentTable,
              new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),
              footerSection,
            ],
          },
        ],
      });

      console.log("Document generation completed, packing to buffer");
      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
  }

  static async createHeader(documentData: any, unitDetails: any) {
    try {
      const managerName = unitDetails?.manager ? 
        unitDetails.manager.split(' ΠΟΛ')[0].trim() : 
        "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

      // Create header content as array of paragraphs
      const headerParagraphs = [
        new Paragraph({
          children: [new TextRun({ text: "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ", bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &", bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ", bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ", bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ", bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: unitDetails?.unit_name || "", bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 400 },
        }),
      ];

      // Create contact information table
      const contactTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        rows: [
          this.createContactRow("Ταχ. Δ/νση", "Δημοκρίτου 2"),
          this.createContactRow("Ταχ. Κώδικας", "115 23, Μαρούσι"),
          this.createContactRow("Πληροφορίες", managerName),
          this.createContactRow("Τηλέφωνο", documentData.telephone || ""),
          this.createContactRow("E-mail", unitDetails?.email || "daefkke@civilprotection.gr"),
        ],
      });

      return [...headerParagraphs, contactTable];
    } catch (error) {
      console.error("Error creating header:", error);
      throw error;
    }
  }

  private static createContactRow(label: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label + ":", size: 20 })] })],
          width: { size: 30, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  }

  static createReferenceSection() {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            size: 20,
          }),
        ],
        spacing: { before: 300, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από τη Δ.Α.Ε.Φ.Κ.-Κ.Ε. , σύμφωνα με τα κάτωθι στοιχεία.",
            size: 20,
          }),
        ],
        spacing: { before: 200, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", size: 20, bold: true }),
          new TextRun({ text: "2024ΝΑ85300084  της ΣΑΝΑ 853 (ΤΕ 2023ΝΑ27100228)", size: 20 }),
        ],
        spacing: { before: 200, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΑΛΕ: ", size: 20, bold: true }),
          new TextRun({ text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.", size: 20 }),
        ],
        spacing: { before: 200, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "ΤΟΜΕΑΣ: ", size: 20, bold: true }),
          new TextRun({ text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών", size: 20 }),
        ],
        spacing: { before: 200, after: 300 },
      }),
    ];
  }

  static createPaymentTable(recipients: any[]) {
    try {
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
              this.createTableHeaderCell("Α/Α"),
              this.createTableHeaderCell("ΕΠΩΝΥΜΟ"),
              this.createTableHeaderCell("ΟΝΟΜΑ"),
              this.createTableHeaderCell("ΠΑΤΡΩΝΥΜΟ"),
              this.createTableHeaderCell("ΑΦΜ"),
              this.createTableHeaderCell("ΠΟΣΟ (€)"),
            ],
          }),
          ...recipients.map(
            (recipient, index) =>
              new TableRow({
                children: [
                  this.createTableCell((index + 1).toString(), AlignmentType.CENTER),
                  this.createTableCell(recipient.lastname || "", AlignmentType.LEFT),
                  this.createTableCell(recipient.firstname || "", AlignmentType.LEFT),
                  this.createTableCell(recipient.fathername || "", AlignmentType.LEFT),
                  this.createTableCell(recipient.afm || "", AlignmentType.CENTER),
                  this.createTableCell(
                    this.formatCurrency(recipient.amount || 0),
                    AlignmentType.RIGHT
                  ),
                ],
              })
          ),
        ],
      });
    } catch (error) {
      console.error("Error creating payment table:", error);
      throw error;
    }
  }

  static createTableHeaderCell(text: string) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  static createTableCell(text: string, alignment: typeof AlignmentType) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 20 })],
          alignment,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  static createListItems(items: string[]) {
    return items.map(
      (item, index) =>
        new Paragraph({
          children: [new TextRun({ text: `${index + 1}. ${item}`, size: 20 })],
          indent: { left: 360 },
          spacing: { before: 100, after: 100 },
        })
    );
  }

  static async createFooter(document: any, unitDetails: any) {
    try {
      const notifications = [
        "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
        "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
        "Γ.Δ.Α.Ε.Φ.Κ.",
      ];

      const internalDist = [
        "Χρονολογικό Αρχείο",
        "Τμήμα Β/20.51",
        "Αβραμόπουλο Ι.",
      ];

      const managerName = unitDetails?.manager ? 
        unitDetails.manager.split(' ΠΟΛ')[0].trim() : 
        "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ ${unitDetails?.unit_name || 'Δ.Α.Ε.Φ.Κ.'}`,
                        bold: true,
                        size: 20,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 1440 },
                  }),
                  new Paragraph({
                    text: "",
                    spacing: { before: 720, after: 720 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: managerName,
                        bold: true,
                        size: 20,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "ΠΟΛ. ΜΗΧΑΝΙΚΟΣ", size: 20 })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                width: { size: 100, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      });
    } catch (error) {
      console.error("Error creating footer:", error);
      throw error;
    }
  }

  static formatDocumentNumber(id: number): string {
    return `${id.toString().padStart(6, '0')}`;
  }
}