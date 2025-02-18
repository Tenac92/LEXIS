
const docx = require('docx');

class DocumentFormatter {
  static getDefaultMargins() {
    return {
      top: 850,
      right: 1000,
      bottom: 850,
      left: 1000
    };
  }

  static createHeader(text, size = 24, bold = true) {
    return new docx.Paragraph({
      children: [new docx.TextRun({ text, size, bold })],
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 240, after: 240 }
    });
  }

  static createContactField(label, value) {
    return new docx.Paragraph({
      children: [
        new docx.TextRun({ text: label, size: 24 }),
        new docx.TextRun({ text: '\t:\t', size: 24 }),
        new docx.TextRun({ text: value, size: 24 })
      ],
      spacing: { before: 120, after: 120 },
      indent: { left: 720 }
    });
  }

  static createPaymentTable(documents) {
    return new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top: { style: docx.BorderStyle.SINGLE, size: 1 },
        bottom: { style: docx.BorderStyle.SINGLE, size: 1 },
        left: { style: docx.BorderStyle.SINGLE, size: 1 },
        right: { style: docx.BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: docx.BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: docx.BorderStyle.SINGLE, size: 1 }
      },
      rows: [
        this.createTableHeader(['Α.Α.', 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΠΟΣΟ (€)', 'ΔΟΣΗ', 'ΑΦΜ']),
        ...this.createTableRows(documents)
      ]
    });
  }

  static createTableHeader(headers) {
    return new docx.TableRow({
      children: headers.map(header => 
        new docx.TableCell({
          children: [new docx.Paragraph({
            children: [new docx.TextRun({ text: header, bold: true, size: 24 })],
            alignment: docx.AlignmentType.CENTER
          })],
          verticalAlign: docx.VerticalAlign.CENTER
        })
      )
    });
  }

  static createTableRows(documents) {
    return documents.map((doc, index) => 
      new docx.TableRow({
        children: [
          this.createTableCell((index + 1).toString() + '.', docx.AlignmentType.CENTER),
          this.createTableCell(`${doc.lastname} ${doc.firstname} ${doc.fathername || ''}`.trim(), docx.AlignmentType.LEFT),
          this.createTableCell(parseFloat(doc.amount).toFixed(2), docx.AlignmentType.RIGHT),
          this.createTableCell(doc.installment.toString(), docx.AlignmentType.CENTER),
          this.createTableCell(doc.afm, docx.AlignmentType.CENTER)
        ]
      })
    );
  }

  static createTableCell(text, alignment) {
    return new docx.TableCell({
      children: [new docx.Paragraph({ 
        text,
        alignment
      })]
    });
  }

  static createDocumentHeader(req, unitDetails = {}) {
    const defaultEmail = unitDetails?.email || 'daefkke@civilprotection.gr';
    
    const headerInfo = [
      { text: 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ', bold: true },
      { text: 'ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ', bold: true },
      { text: 'ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ', bold: true },
      { text: 'ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ', bold: true },
      { text: unitDetails?.unit_name || '', bold: true },
      ...(unitDetails?.parts || []).map(part => ({ text: part, bold: true })),
      { text: '', bold: false },
      { text: 'Ταχ. Δ/νση: Κηφισίας 124 & Ιατρίδου 2', bold: false },
      { text: 'Ταχ. Κώδικας: 11526, Αθήνα', bold: false },
      { text: `Πληροφορίες: ${req?.user?.name || ''}`, bold: false },
      { text: 'Email: ' + defaultEmail, bold: false }
    ];

    const rightColumnInfo = [
      { text: 'ΑΝΑΡΤΗΤΕΑ ΣΤΟ ΔΙΑΔΙΚΤΥΟ', bold: true },
      { text: '', bold: false },
      { text: 'Αθήνα, ........................', bold: true },
      { text: 'Αρ. Πρωτ.: ......................', bold: true }
    ];

    return this.createHeaderTable(headerInfo, rightColumnInfo);
  }

  static createHeaderTable(headerInfo, rightColumnInfo) {
    return new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: { top: {}, bottom: {}, left: {}, right: {}, insideVertical: {} },
      rows: [this.createHeaderRow(headerInfo, rightColumnInfo)]
    });
  }

  static createHeaderRow(headerInfo, rightColumnInfo) {
    return new docx.TableRow({
      children: [
        this.createHeaderColumn(headerInfo, 65),
        this.createHeaderColumn(rightColumnInfo, 35)
      ]
    });
  }

  static createHeaderColumn(info, width) {
    return new docx.TableCell({
      children: info.map(item => new docx.Paragraph({
        children: [new docx.TextRun({ text: item.text, size: 20, bold: item.bold })],
        alignment: docx.AlignmentType.LEFT,
        spacing: { before: 0, after: 0 }
      })),
      width: { size: width, type: docx.WidthType.PERCENTAGE }
    });
  }

  static createDocumentFooter(unitDetails = {}) {
    const attachments = [
      'Η σε ορθή επανάληψη έγκριση Σ.Σ για ανακατ. κτιρίου',
      'Οι εκδοθείσες άδειες επισκευής κτιρίου',
      'Οι εγκρίσεις Σ.Σ για ανακατασκευή άδειες επισκευής',
      'Υπεύθυνες δηλώσεις δικαιούχων',
      'Φωτοτυπίες των βιβλιαρίων',
      'Φωτοτυπίες ΑΔΤ των δικαιούχων',
      'Ένας συγκεντρωτικός πίνακας των δικαιούχων'
    ];

    const notifications = [
      'Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας',
      'Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής',
      'Γ.Δ.Α.Ε.Φ.Κ.'
    ];

    const internalDist = [
      'Χρονολογικό Αρχείο',
      'Τμήμα Β/20.51',
      'Αβραμόπουλο Ι.'
    ];

    return new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: { top: {}, bottom: {}, left: {}, right: {}, insideVertical: {} },
      rows: [
        new docx.TableRow({
          children: [
            new docx.TableCell({
              children: [
                new docx.Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
                new docx.Paragraph({
                  children: [new docx.TextRun({ text: 'ΣΥΝΗΜΜΕΝΑ', bold: true })],
                  spacing: { before: 240, after: 240 }
                }),
                ...attachments.map((item, index) => new docx.Paragraph({
                  children: [new docx.TextRun({ text: `${index + 1}. ${item}` })],
                  indent: { left: 240 },
                  spacing: { before: 60, after: 60 }
                })),
                new docx.Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
                new docx.Paragraph({
                  children: [new docx.TextRun({ text: 'ΚΟΙΝΟΠΟΙΗΣΗ', bold: true })],
                  spacing: { before: 60, after: 240 }
                }),
                ...notifications.map((item, index) => new docx.Paragraph({
                  children: [new docx.TextRun({ text: `${index + 1}. ${item}` })],
                  indent: { left: 240 },
                  spacing: { before: 60, after: 60 }
                })),
                new docx.Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
                new docx.Paragraph({
                  children: [new docx.TextRun({ text: 'ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ', bold: true })],
                  spacing: { before: 60, after: 60 }
                }),
                ...internalDist.map((item, index) => new docx.Paragraph({
                  children: [new docx.TextRun({ text: `${index + 1}. ${item}` })],
                  indent: { left: 240 },
                  spacing: { before: 60, after: 60 }
                }))
              ],
              width: { size: 65, type: docx.WidthType.PERCENTAGE }
            }),
            new docx.TableCell({
              children: [
                new docx.Paragraph({ text: '', spacing: { before: 3000 } }),
                new docx.Paragraph({
                  text: 'Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΤΗΣ Δ.Α.Ε.Φ.Κ.',
                  alignment: docx.AlignmentType.CENTER,
                  bold: true
                }),
                new docx.Paragraph({
                  text: '',
                  alignment: docx.AlignmentType.CENTER,
                  spacing: { before: 500 }
                }),
                new docx.Paragraph({
                  text: 'ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ',
                  alignment: docx.AlignmentType.CENTER,
                  bold: true
                }),
                new docx.Paragraph({
                  text: 'ΠΟΛ. ΜΗΧΑΝΙΚΟΣ',
                  alignment: docx.AlignmentType.CENTER
                })
              ],
              width: { size: 35, type: docx.WidthType.PERCENTAGE }
            })
          ]
        })
      ]
    });
  }
}

module.exports = DocumentFormatter;
