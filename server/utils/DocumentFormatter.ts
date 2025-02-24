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

  static async createDefaultHeader(documentData: any = {}) {
    try {
      console.log("Creating header with document data:", documentData);
      const unitDetails = await this.getUnitDetails(documentData.unit);

      if (!unitDetails) {
        console.warn("No unit details found for unit:", documentData.unit);
      }

      const managerName = unitDetails?.manager ? 
        unitDetails.manager.split(' ΠΟΛ')[0].trim() : 
        "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ";

      const headerInfo = [
        { text: "ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ", bold: true },
        { text: "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ &", bold: true },
        { text: "ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ", bold: true },
        { text: "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ", bold: true },
        { text: "ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ", bold: true },
        { text: unitDetails?.unit_name || "", bold: true },
        { text: "Ταχ. Δ/νση: Δημοκρίτου 2", bold: false },
        { text: "Ταχ. Κώδικας: 115 23, Μαρούσι", bold: false },
        { text: `Πληροφορίες: ${managerName}`, bold: false },
        { text: `Τηλέφωνο: ${documentData.telephone || ""}`, bold: false },
        { text: `E-mail: ${unitDetails?.email || "daefkke@civilprotection.gr"}`, bold: false },
      ];

      const rightColumnInfo = [
        { text: `Αθήνα, ${new Date().toLocaleDateString("el-GR")}`, bold: false },
        { text: "Αρ. Πρωτ.: ......................", bold: true },
        { text: "" },
        { text: "ΠΡΟΣ: Γενική Δ/νση Οικονομικών Υπηρεσιών", bold: false },
        { text: "Διεύθυνση Οικονομικής Διαχείρησης", bold: false },
        { text: "Τμήμα Ελέγχου Εκκαθάρισης και", bold: false },
        { text: "Λογιστικής Παρακολούθησης Δαπανών", bold: false },
        { text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)", bold: false },
      ];

      return this.createHeaderTable(headerInfo, rightColumnInfo);
    } catch (error) {
      console.error("Error creating header:", error);
      throw error;
    }
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

  static async createFooter(document: any = {}) {
    try {
      console.log("Creating footer with document:", document);
      const unitDetails = await this.getUnitDetails(document.unit);

      const { data: attachmentData, error: attachmentError } = await supabase
        .from("attachments")
        .select("*")
        .eq("expediture_type", document.expenditure_type)
        .eq("installment", document.recipients?.[0]?.installment || 1)
        .single();

      if (attachmentError) {
        console.error("Error fetching attachments:", attachmentError);
      }

      const attachments = attachmentData?.attachments || [""];

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

      const footerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0 },
          bottom: { style: BorderStyle.NONE, size: 0 },
          left: { style: BorderStyle.NONE, size: 0 },
          right: { style: BorderStyle.NONE, size: 0 },
          insideVertical: { style: BorderStyle.NONE, size: 0 },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "ΣΥΝΗΜΜΕΝΑ:", bold: true, size: 20 }),
                    ],
                    spacing: { before: 200, after: 200 },
                  }),
                  ...this.createListItems(attachments),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "ΚΟΙΝΟΠΟΙΗΣΗ:", bold: true, size: 20 }),
                    ],
                    spacing: { before: 200, after: 200 },
                  }),
                  ...this.createListItems(notifications),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ:",
                        bold: true,
                        size: 20,
                      }),
                    ],
                    spacing: { before: 200, after: 200 },
                  }),
                  ...this.createListItems(internalDist),
                ],
                width: { size: 60, type: WidthType.PERCENTAGE },
              }),
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
                width: { size: 40, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      });

      return footerTable;
    } catch (error) {
      console.error("Error creating footer:", error);
      throw error;
    }
  }

  static createHeaderTable(headerInfo: Array<{ text: string; bold: boolean }>, rightColumnInfo: Array<{ text: string; bold: boolean }>) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: headerInfo.map(
                (item) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: item.text,
                        size: 20,
                        bold: item.bold,
                      }),
                    ],
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 100, after: 100 },
                  }),
              ),
              width: { size: 65, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              children: rightColumnInfo.map(
                (item) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: item.text,
                        size: 20,
                        bold: item.bold,
                      }),
                    ],
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 100, after: 100 },
                  }),
              ),
              width: { size: 35, type: WidthType.PERCENTAGE },
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

  static createTableCell(text: string, alignment: AlignmentType) {
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

  static formatDocumentNumber(document: any): string {
    if (!document) return '';

    // Format based on protocol number if available
    if (document.protocol_number_input) {
      return document.protocol_number_input.toString();
    }

    // Otherwise use document ID
    return `#${document.id}`;
  }

  clearCache() {
    this.cache.clear();
  }
}