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
import { createLogger } from "./logger";
import { DocumentShared } from "./document-shared";
import { UserDetails, UnitDetails, DocumentData } from "./document-types";

const logger = createLogger("PrimaryDocumentFormatter");

export class PrimaryDocumentFormatter {
  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) {
      throw new Error("Document data is required");
    }
    const logoBuffer = await DocumentShared.getLogoImageData();

    // Extract user information with fallbacks
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department || documentData.department || "",
      descr:
        documentData.generated_by?.descr || (documentData as any).descr || "",
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
      columnWidths: [60, 40],
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
              width: { size: 60, type: WidthType.PERCENTAGE },
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
                DocumentShared.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                DocumentShared.createBoldParagraph(
                  "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                ),
                DocumentShared.createBoldParagraph(
                  "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
                ),
                DocumentShared.createBoldParagraph("ΓΕΝΙΚΗ Δ.Α.Ε.Φ.Κ."),
                DocumentShared.createBoldParagraph(
                  unitDetails?.unit_name?.name || unitDetails?.name || "",
                ),
                DocumentShared.createBoldParagraph(userInfo.department),
                DocumentShared.createBlankLine(10),
                DocumentShared.createContactDetail("Ταχ. Δ/νση", address.address),
                DocumentShared.createContactDetail(
                  "Ταχ. Κώδικας",
                  `${address.tk}, ${address.region}`,
                ),
                DocumentShared.createContactDetail("Πληροφορίες", userInfo.name),
                DocumentShared.createContactDetail("Τηλέφωνο", userInfo.contact_number),
                DocumentShared.createContactDetail("Email", unitDetails?.email || ""),
                DocumentShared.createBlankLine(10),
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
              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },
              children: [
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
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "Διεύθυνση Οικονομικής Διαχείρισης",
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "Δημοκρίτου 2",
                              alignment: AlignmentType.LEFT,
                            }),
                            new Paragraph({
                              text: "151 23 Μαρούσι",
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
  }

  private static createDateAndProtocol(documentData: DocumentData): Paragraph[] {
    const today = new Date();
    const formattedDate = DocumentShared.formatDate(today);

    return [
      DocumentShared.createBlankLine(600),
      new Paragraph({
        children: [
          new TextRun({
            text: `Αθήνα, ${formattedDate}`,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Αριθμ. Πρωτ.: ",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
          new TextRun({
            text: documentData.protocol_number || documentData.protocol_number_input || "",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 480 },
      }),
    ];
  }

  private static createDocumentSubject(
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
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: subjectText.map(
                      (segment) =>
                        new TextRun({
                          text: segment.text,
                          bold: segment.bold,
                          italics: segment.italics,
                          size: DocumentShared.DEFAULT_FONT_SIZE,
                        })
                    ),
                    alignment: AlignmentType.JUSTIFIED,
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                margins: {
                  top: 200,
                  bottom: 200,
                  left: 200,
                  right: 200,
                },
              }),
            ],
          }),
        ],
      }),
    ];
  }

  private static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): (Paragraph | Table)[] {
    const unitName = unitDetails?.unit_name?.name || documentData.unit;
    const unitProp = unitDetails?.unit_name?.prop || "τη";
    return [
      DocumentShared.createBlankLine(8),
      new Paragraph({
        children: [
          new TextRun({
            text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            size: DocumentShared.DEFAULT_FONT_SIZE - 2,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
      }),
      DocumentShared.createBlankLine(14),
      new Paragraph({
        children: [
          new TextRun({
            text: `Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από ${unitDetails?.unit_name?.prop || "τη"} ${unitDetails?.unit || "Μονάδα"}, σύμφωνα με τα παρακάτω στοιχεία.`,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
      }),
      DocumentShared.createBlankLine(14),
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
                      new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", bold: true, size: DocumentShared.DEFAULT_FONT_SIZE }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${documentData.project_na853 || ""} της ΣΑΝΑ 853`,
                        size: DocumentShared.DEFAULT_FONT_SIZE,
                      }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "ΑΛΕ: ", bold: true, size: DocumentShared.DEFAULT_FONT_SIZE }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.",
                        size: DocumentShared.DEFAULT_FONT_SIZE,
                      }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "ΤΟΜΕΑΣ: ", bold: true, size: DocumentShared.DEFAULT_FONT_SIZE }),
                    ],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
                        size: DocumentShared.DEFAULT_FONT_SIZE,
                      }),
                    ],
                  }),
                ],
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
      }),
      DocumentShared.createBlankLine(14),
    ];
  }

  private static createClosingContent(): Paragraph[] {
    return [
      DocumentShared.createBlankLine(14),
      new Paragraph({
        children: [
          new TextRun({
            text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 480 },
      }),
    ];
  }

  private static createAttachmentsSection(): Paragraph[] {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)",
            bold: true,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Οι εκδοθείσες εγκρίσεις ΣΣ",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 480 },
      }),
    ];
  }

  private static createDistributionSections(): Paragraph[] {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "ΚΟΙΝΟΠΟΙΗΣΗ",
            bold: true,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "2. Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "3. Γ.Δ.Α.Ε.Φ.Κ.",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ",
            bold: true,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Χρονολογικό Αρχείο",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 480 },
      }),
    ];
  }

  private static createPaymentTable(recipients: any[]): Table {
    const headerRow = new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Α/Α",
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΟΝΟΜΑΤΕΠΩΝΥΜΟ",
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΠΟΣΟ (€)",
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΔΟΣΗ",
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΑΦΜ",
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
      ],
    });

    const dataRows = recipients.map((recipient, index) => {
      const amount = typeof recipient.amount === "number" ? recipient.amount : 0;
      const formattedAmount = DocumentShared.formatCurrency(amount);

      return new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: (index + 1).toString() + ".",
                    size: DocumentShared.DEFAULT_FONT_SIZE,
                    font: DocumentShared.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${recipient.lastname || ""} ${recipient.firstname || ""} ΤΟΥ ${recipient.fathername || ""}`.trim(),
                    size: DocumentShared.DEFAULT_FONT_SIZE,
                    font: DocumentShared.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formattedAmount,
                    size: DocumentShared.DEFAULT_FONT_SIZE,
                    font: DocumentShared.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: recipient.installment?.toString() || "Α",
                    size: DocumentShared.DEFAULT_FONT_SIZE,
                    font: DocumentShared.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: recipient.afm || "",
                    size: DocumentShared.DEFAULT_FONT_SIZE,
                    font: DocumentShared.DEFAULT_FONT,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
        ],
      });
    });

    // Calculate total
    const totalAmount = recipients.reduce((sum, r) => {
      const amount = typeof r.amount === "number" && !isNaN(r.amount) ? r.amount : 0;
      return sum + amount;
    }, 0);

    const totalRow = new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΣΥΝΟΛΟ:",
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
          columnSpan: 2,
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${DocumentShared.formatCurrency(totalAmount)} €`,
                  bold: true,
                  size: DocumentShared.DEFAULT_FONT_SIZE,
                  font: DocumentShared.DEFAULT_FONT,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
        new TableCell({
          children: [new Paragraph({ text: "" })],
          columnSpan: 2,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
      ],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [800, 4000, 2000, 2000],
      rows: [headerRow, ...dataRows, totalRow],
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });
  }

  private static createNote(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Σημείωση: Τα δικαιολογητικά της δαπάνης διατηρούνται στην αρμόδια υπηρεσία.",
          size: DocumentShared.DEFAULT_FONT_SIZE,
          font: DocumentShared.DEFAULT_FONT,
          italics: true,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 480, after: 480 },
    });
  }

  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    // Create the left column content (attachments, notifications, etc.)
    const leftColumnParagraphs: Paragraph[] = [];

    leftColumnParagraphs.push(
      DocumentShared.createBoldUnderlinedParagraph("ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)"),
    );

    for (let i = 0; i < attachments.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${attachments[i]}`,
              size: DocumentShared.DEFAULT_FONT_SIZE,
              font: DocumentShared.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
          spacing: { after: 120 },
        }),
      );
    }

    leftColumnParagraphs.push(
      DocumentShared.createBoldUnderlinedParagraph("ΚΟΙΝΟΠΟΙΗΣΗ"),
    );

    const notifications = [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ.",
    ];

    for (let i = 0; i < notifications.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${notifications[i]}`,
              size: DocumentShared.DEFAULT_FONT_SIZE,
              font: DocumentShared.DEFAULT_FONT,
            }),
          ],
          indent: { left: 426 },
          spacing: { after: 120 },
        }),
      );
    }

    leftColumnParagraphs.push(
      DocumentShared.createBoldUnderlinedParagraph("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ"),
    );

    leftColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Χρονολογικό Αρχείο",
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        indent: { left: 426 },
        spacing: { after: 120 },
      }),
    );

    // Create the right column content (signature)
    const managerInfo = unitDetails?.manager;
    const rightColumnParagraphs: Paragraph[] = [];

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ΜΕ ΕΝΤΟΛΗ ΑΝΑΠΛ. ΠΡΟΪΣΤΑΜΕΝΟΥ Γ.Δ.Α.Ε.Φ.Κ.",
            bold: true,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
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
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
    );

    rightColumnParagraphs.push(DocumentShared.createBlankLine(480));
    rightColumnParagraphs.push(DocumentShared.createBlankLine(480));

    rightColumnParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: managerInfo?.name || "ΑΓΓΕΛΟΣ ΣΑΡΙΔΑΚΗΣ",
            bold: true,
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
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
            size: DocumentShared.DEFAULT_FONT_SIZE,
            font: DocumentShared.DEFAULT_FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [50, 50],
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
              children: leftColumnParagraphs,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
            }),
            new TableCell({
              children: rightColumnParagraphs,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
            }),
          ],
        }),
      ],
    });
  }

  public static async generateDocument(documentData: DocumentData): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData);

      const unitDetails = await DocumentShared.getUnitDetails(documentData.unit);
      logger.debug("Unit details:", unitDetails);

      // Get project title and NA853 code from database
      const projectMis =
        documentData.project_na853 ||
        (documentData as any).mis?.toString() ||
        "";
      const projectTitle = await DocumentShared.getProjectTitle(projectMis);
      const projectNA853 = await DocumentShared.getProjectNA853(projectMis);
      logger.debug(`Project title for MIS ${projectMis}:`, projectTitle);
      logger.debug(`Project NA853 for MIS ${projectMis}:`, projectNA853);

      // Create a modified document data with NA853 if available
      const enrichedDocumentData = {
        ...documentData,
        project_na853: projectNA853 || documentData.project_na853,
      };

      const sections = [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margins: DocumentShared.DOCUMENT_MARGINS,
              orientation: PageOrientation.PORTRAIT,
            },
          },
          children: [
            await this.createDocumentHeader(enrichedDocumentData, unitDetails),
            ...this.createDateAndProtocol(enrichedDocumentData),
            ...this.createDocumentSubject(enrichedDocumentData, unitDetails),
            ...this.createMainContent(enrichedDocumentData, unitDetails),
            this.createPaymentTable(documentData.recipients || []),
            this.createNote(),
            ...this.createClosingContent(),
            ...this.createAttachmentsSection(),
            ...this.createDistributionSections(),
            ...this.createFooter(enrichedDocumentData, unitDetails),
          ].flat(),
        },
      ];

      const doc = new Document({
        sections,
        styles: {
          default: {
            document: {
              run: {
                font: DocumentShared.DEFAULT_FONT,
                size: DocumentShared.DEFAULT_FONT_SIZE,
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
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }
}