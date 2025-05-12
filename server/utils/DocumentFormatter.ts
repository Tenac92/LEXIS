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
import { supabase } from "../config/db";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";
import { after } from "node:test";

import { createLogger } from './logger';

const logger = createLogger('DocumentFormatter');

interface UserDetails {
  name: string;
  email?: string;
  contact_number?: string;
  telephone?: string; // Added telephone field from Supabase user table
  department?: string;
  descr?: string;
}

interface UnitDetails {
  unit: string;
  unit_name?: {
    name: string;
    prop: string;
  };
  manager?: {
    name: string;
    order: string;
    title: string;
    degree: string;
    prepose?: string; // Set as optional if needed
  };
  email?: string;
  address?: {
    address: string;
    tk: string;
    region: string;
  };
}

interface DocumentData {
  id: number; // Ensure all properties are present and consistent
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
  contact_number?: string;
  department?: string;
  generated_by?: UserDetails; // Consistent use of UserDetails
  recipients?: Array<{
    firstname: string;
    lastname: string;
    fathername: string;
    afm: string;
    amount: number;
    installment: number | string;
    installments?: string[];
    installmentAmounts?: Record<string, number>;
    secondary_text?: string;
  }>;
}

export class DocumentFormatter {
  private static readonly DEFAULT_FONT_SIZE = 22;
  private static readonly DEFAULT_ADDRESS = {
    address: "Κηφισίας 124 & Ιατρίδου 2",
    tk: "11526",
    region: "Αθήνα",
  };
  private static readonly DEFAULT_FONT = "Calibri";
  private static readonly DEFAULT_MARGINS = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  private static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

  private static async getLogoImageData(): Promise<Buffer> {
    const logoPath = path.join(
      process.cwd(),
      "server",
      "utils",
      "ethnosimo22.png",
    );
    return fs.promises.readFile(logoPath);
  }

  private static async createDocumentHeader(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Promise<Table> {
    if (!documentData) {
      throw new Error("Document data is required");
    }
    const logoBuffer = await this.getLogoImageData();

    // Extract user information with fallbacks
    const userInfo = {
      name: documentData.generated_by?.name || documentData.user_name || "",
      department:
        documentData.generated_by?.department || documentData.department || "",
      // Add descr field for both document types
      descr:
        documentData.generated_by?.descr || (documentData as any).descr || "",
      // Handle telephone as number by converting to string
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
      columnWidths: [55, 45],
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
              width: { size: 50, type: WidthType.PERCENTAGE },
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
                this.createBoldParagraph("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
                this.createBoldParagraph(
                  "ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ",
                ),
                this.createBoldParagraph(
                  "ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ",
                ),
                this.createBoldParagraph("ΓΕΝΙΚΗ Δ.Α.Ε.Φ.Κ."),
                this.createBoldParagraph(documentData.unit),
                this.createBoldParagraph(userInfo.department),
                this.createBlankLine(10),
                this.createContactDetail("Ταχ. Δ/νση", address.address),
                this.createContactDetail(
                  "Ταχ. Κώδικας",
                  `${address.tk}, ${address.region}`,
                ),
                this.createContactDetail("Πληροφορίες", userInfo.name),
                this.createContactDetail("Τηλέφωνο", userInfo.contact_number),
                this.createContactDetail("Email", unitDetails?.email || ""),
                this.createBlankLine(10),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
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
                    new TextRun({
                      text: `${address.region}: ${
                        documentData.protocol_date
                          ? format(
                              new Date(documentData.protocol_date),
                              "dd/MM/yyyy",
                            )
                          : "........................"
                      }`,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 240 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Αρ. Πρωτ.: ${
                        documentData.protocol_number_input ||
                        documentData.protocol_number ||
                        "......................"
                      }`,
                      bold: true,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  text: "",
                  spacing: { before: 240 },
                }),
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
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                            new Paragraph({
                              text: "Διεύθυνση Οικονομικής Διαχείρισης",
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                            new Paragraph({
                              text: "Τμήμα Ελέγχου Εκκαθάρισης και Λογιστικής Παρακολούθησης Δαπανών",
                              alignment: AlignmentType.JUSTIFIED,
                            }),
                            new Paragraph({
                              text: "Γραφείο Π.Δ.Ε. (ιδίου υπουργείου)",
                              alignment: AlignmentType.JUSTIFIED,
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

  /**
   * Generate the first (primary) document
   */
  public static async generateDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating primary document for:", documentData);

      const unitDetails = await this.getUnitDetails(documentData.unit);
      logger.debug("Unit details:", unitDetails);

      // Get project title and NA853 code from database
      const projectMis =
        documentData.project_na853 ||
        (documentData as any).mis?.toString() ||
        "";
      const projectTitle = await this.getProjectTitle(projectMis);
      const projectNA853 = await this.getProjectNA853(projectMis);
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
              margins: this.DOCUMENT_MARGINS,
              orientation: PageOrientation.PORTRAIT,
            },
          },
          children: [
            await this.createDocumentHeader(enrichedDocumentData, unitDetails),
            ...this.createDocumentSubject(enrichedDocumentData, unitDetails),
            ...this.createMainContent(enrichedDocumentData, unitDetails),
            this.createPaymentTable(documentData.recipients || []),
            this.createNote(),
            this.createFooter(enrichedDocumentData, unitDetails),
          ],
        },
      ];

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
        },
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error("Error generating primary document:", error);
      throw error;
    }
  }

  /**
   * Generate the second document containing:
   * - Document title at the top
   * - Recipients table with an extra ΠΡΑΞΗ column that shows the expenditure type
   * - Standard text about documentation retention
   * - Two signature fields with user name and department on the left
   */
  /**
   * Get project title from the Projects table using MIS or NA853
   */
  public static async getProjectTitle(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        logger.error(
          "[DocumentFormatter] No MIS provided for project title lookup",
        );
        return null;
      }

      logger.debug(
        `[DocumentFormatter] Fetching project title for input: '${mis}'`,
      );

      // Check if MIS is numeric or follows the pattern of project codes
      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isProjectCode = projectCodePattern.test(mis);

      logger.debug(
        `[DocumentFormatter] getProjectTitle - Analysis: mis='${mis}', isNumericString=${isNumericString}, isProjectCode=${isProjectCode}`,
      );

      let data: any = null;
      let error: any = null;
      let resultFound = false;

      // DUMP ALL FIELDS for a specific record to debug issues
      logger.debug(
        `[DocumentFormatter] Running diagnostic query to dump all fields for a few records`,
      );
      const diagnosticResult = await supabase
        .from("Projects")
        .select("*")
        .limit(2);

      if (diagnosticResult.error) {
        logger.error(
          "[DocumentFormatter] Diagnostic query error:",
          diagnosticResult.error.message,
        );
      } else if (diagnosticResult.data && diagnosticResult.data.length > 0) {
        logger.debug(
          `[DocumentFormatter] Diagnostic record sample:`,
          JSON.stringify(diagnosticResult.data[0]),
        );
        logger.debug(
          `[DocumentFormatter] Available columns:`,
          Object.keys(diagnosticResult.data[0]).join(", "),
        );
      }

      // Strategy 1: First try with na853 as this appears to be the right column based on schema
      logger.debug(`[DocumentFormatter] Trying NA853 lookup with value: ${mis}`);
      const na853Result = await supabase
        .from("Projects")
        .select("project_title, mis, na853, budget_na853")
        .eq("na853", mis)
        .maybeSingle();

      if (na853Result.error) {
        logger.error(
          "[DocumentFormatter] NA853 lookup error:",
          na853Result.error.message,
        );
      } else if (na853Result.data?.project_title) {
        logger.debug(
          `[DocumentFormatter] Found project title by na853: '${na853Result.data.project_title}'`,
        );
        logger.debug(
          `[DocumentFormatter] Project details:`,
          JSON.stringify(na853Result.data),
        );
        resultFound = true;
        return na853Result.data.project_title;
      }

      // Strategy 2: Try with budget_na853 if it looks like a project code
      if (!resultFound && isProjectCode) {
        logger.debug(
          `[DocumentFormatter] Input appears to be a project code: ${mis}, trying budget_na853 lookup`,
        );
        const result = await supabase
          .from("Projects")
          .select("project_title, mis, na853, budget_na853")
          .eq("budget_na853", mis)
          .maybeSingle();

        data = result.data;
        error = result.error;

        if (error) {
          logger.error(
            "[DocumentFormatter] Budget lookup error:",
            error.message,
          );
        }

        if (!error && data?.project_title) {
          logger.debug(
            `[DocumentFormatter] Found project title by budget_na853: '${data.project_title}'`,
          );
          logger.debug(
            `[DocumentFormatter] Project details:`,
            JSON.stringify(data),
          );
          resultFound = true;
          return data.project_title;
        }
      }

      // Strategy 3: Default lookup by MIS as numeric value
      if (!resultFound && isNumericString) {
        logger.debug(
          `[DocumentFormatter] Trying MIS lookup with numeric value: ${mis}`,
        );
        const result = await supabase
          .from("Projects")
          .select("project_title, na853, budget_na853")
          .eq("mis", mis)
          .maybeSingle();

        data = result.data;
        error = result.error;

        if (error) {
          logger.error(
            "[DocumentFormatter] Error fetching project title by MIS:",
            error.message,
          );
        } else if (!data || !data.project_title) {
          logger.debug(`[DocumentFormatter] No project found with MIS: ${mis}`);
        } else {
          logger.debug(
            `[DocumentFormatter] Found project by MIS with title: '${data.project_title}'`,
            `and fields:`,
            JSON.stringify(data),
          );
          resultFound = true;
          return data.project_title;
        }
      }

      // Strategy 4: Try through an exact match on either field
      if (!resultFound) {
        logger.debug(
          `[DocumentFormatter] Trying exact match search on multiple columns`,
        );

        const exactResult = await supabase
          .from("Projects")
          .select("project_title, mis, na853, budget_na853")
          .or(`na853.eq.${mis},budget_na853.eq.${mis}`)
          .limit(1);

        if (exactResult.error) {
          logger.error(
            "[DocumentFormatter] Exact match error:",
            exactResult.error.message,
          );
        } else if (exactResult.data && exactResult.data.length > 0) {
          logger.debug(
            `[DocumentFormatter] Found project by exact match:`,
            exactResult.data[0],
          );
          resultFound = true;
          return exactResult.data[0].project_title;
        }
      }

      // Strategy 5: Last resort - try a fuzzy search on multiple fields
      if (!resultFound) {
        logger.debug(
          `[DocumentFormatter] Trying fuzzy search for project with term: ${mis}`,
        );

        if (isProjectCode) {
          // Check if term contains both Greek and Latin characters, and try to split
          const mixedPattern = /^(\d{4})([\u0370-\u03FF\u1F00-\u1FFF]+)(\d+)$/;
          const mixedMatch = mis.match(mixedPattern);

          if (mixedMatch) {
            const year = mixedMatch[1];
            const code = mixedMatch[2];
            const number = mixedMatch[3];

            logger.debug(
              `[DocumentFormatter] Parsed mixed code - Year: ${year}, Code: ${code}, Number: ${number}`,
            );

            // Try searching by partial matches using the ilike operator
            const result = await supabase
              .from("Projects")
              .select("project_title, na853, budget_na853, mis")
              .or(
                `na853.ilike.%${mis}%,budget_na853.ilike.%${mis}%,project_title.ilike.%${mis}%`,
              )
              .limit(1);

            if (result.error) {
              logger.error(
                "[DocumentFormatter] Fuzzy search error:",
                result.error.message,
              );
            } else if (result.data && result.data.length > 0) {
              logger.debug(
                `[DocumentFormatter] Found project by fuzzy search:`,
                result.data[0],
              );
              resultFound = true;
              return result.data[0].project_title;
            }
          }
        }
      }

      // If we got here, we couldn't find a project title
      logger.debug(
        `[DocumentFormatter] No project title found for input: ${mis} after all attempts`,
      );

      // Return a default title as last resort if all strategies fail
      return "ΚΡΑΤΙΚΗ ΑΡΩΓΗ";
    } catch (error) {
      logger.error("[DocumentFormatter] Error in getProjectTitle:", error);
      return "ΚΡΑΤΙΚΗ ΑΡΩΓΗ"; // Provide a default title in case of errors
    }
  }

  /**
   * Get project NA853 code from the Projects table using MIS or NA853
   */
  public static async getProjectNA853(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        logger.error(
          "[DocumentFormatter] No MIS provided for project NA853 lookup",
        );
        return null;
      }

      // If the input already looks like an NA853 code, it might be what we're searching for
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      if (projectCodePattern.test(mis)) {
        logger.debug(
          `[DocumentFormatter] Input appears to be an NA853 code already: ${mis}`,
        );
        return mis;
      }

      logger.debug(`[DocumentFormatter] Fetching project NA853 for MIS: ${mis}`);

      // Strategy 1: Try na853 field first
      logger.debug(`[DocumentFormatter] Trying NA853 lookup with value: ${mis}`);
      const na853Result = await supabase
        .from("Projects")
        .select("na853, budget_na853")
        .eq("mis", mis)
        .maybeSingle();

      if (!na853Result.error && na853Result.data?.na853) {
        logger.debug(
          `[DocumentFormatter] Found project with na853: ${na853Result.data.na853}`,
        );
        return na853Result.data.na853;
      }

      // Strategy 2: Try budget_na853 field
      if (!na853Result.error && na853Result.data?.budget_na853) {
        logger.debug(
          `[DocumentFormatter] Found project with budget_na853: ${na853Result.data.budget_na853}`,
        );
        return na853Result.data.budget_na853;
      }

      if (na853Result.error) {
        logger.error(
          "[DocumentFormatter] Error in NA853 lookup:",
          na853Result.error.message,
        );
      }

      // Strategy 3: Try direct lookup if mis is actually a project code in na853 field
      const directNA853 = await supabase
        .from("Projects")
        .select("na853")
        .eq("na853", mis)
        .maybeSingle();

      if (!directNA853.error && directNA853.data?.na853) {
        logger.debug(
          `[DocumentFormatter] Found na853 by direct lookup: ${directNA853.data.na853}`,
        );
        return directNA853.data.na853;
      }

      // Strategy 4: Try direct lookup if mis is actually a project code in budget_na853 field
      const directBudgetNA853 = await supabase
        .from("Projects")
        .select("budget_na853")
        .eq("budget_na853", mis)
        .maybeSingle();

      if (!directBudgetNA853.error && directBudgetNA853.data?.budget_na853) {
        logger.debug(
          `[DocumentFormatter] Found budget_na853 by direct lookup: ${directBudgetNA853.data.budget_na853}`,
        );
        return directBudgetNA853.data.budget_na853;
      }

      // Last resort: Use MIS as fallback if it's not found
      logger.debug(
        `[DocumentFormatter] No NA853 found after all attempts, using input as fallback: ${mis}`,
      );
      return mis;
    } catch (error) {
      logger.error("[DocumentFormatter] Error in getProjectNA853:", error);
      return mis; // Return the input as fallback in case of errors
    }
  }

  public static async generateSecondDocument(
    documentData: DocumentData,
  ): Promise<Buffer> {
    try {
      logger.debug("Generating secondary document for:", documentData);

      const unitDetails = await this.getUnitDetails(documentData.unit);
      logger.debug("Unit details:", unitDetails);

      // Get project title and NA853 code from database
      const projectMis =
        documentData.project_na853 ||
        (documentData as any).mis?.toString() ||
        "";
      logger.debug(
        `[DocumentFormatter] Secondary document - Finding project with MIS/NA853: ${projectMis}`,
      );
      logger.debug(
        `[DocumentFormatter] Secondary document - Document data:`,
        JSON.stringify({
          id: documentData.id,
          project_na853: documentData.project_na853,
          mis: (documentData as any).mis,
        }),
      );

      const projectTitle = await this.getProjectTitle(projectMis);
      const projectNA853 = await this.getProjectNA853(projectMis);
      logger.debug(
        `[DocumentFormatter] Secondary document - Project title for MIS ${projectMis}:`,
        projectTitle,
      );
      logger.debug(
        `[DocumentFormatter] Secondary document - Project NA853 for MIS ${projectMis}:`,
        projectNA853,
      );

      // Get user information with fallbacks
      const userInfo = {
        name: documentData.generated_by?.name || documentData.user_name || "",
        department:
          documentData.generated_by?.department ||
          (documentData as any).descr ||
          "",
        descr:
          documentData.generated_by?.descr || (documentData as any).descr || "",
      };

      // Calculate total amount from recipients
      const totalAmount = (documentData.recipients || []).reduce((sum, r) => {
        const amount =
          typeof r.amount === "number"
            ? r.amount
            : parseFloat(String(r.amount) || "0");
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      // Format total amount with 2 decimal places
      const formattedTotal = this.formatCurrency(totalAmount);

      const sections = [
        {
          properties: {
            page: {
              size: { width: 16838, height: 11906 }, // Swapped width and height for landscape
              margins: this.DOCUMENT_MARGINS,
              orientation: PageOrientation.LANDSCAPE, // Changed to LANDSCAPE
            },
          },
          children: [
            // Show only the project information without uppercase formatting
            new Paragraph({
              children: [
                new TextRun({
                  text: `${projectTitle ? `${projectTitle} - ` : ""}ΑΡ.ΕΡΓΟΥ: ${projectNA853 || documentData.project_na853 || "___"} της ΣΑΝΑ 853`,
                  bold: true,
                  size: 24, // Decreased font size
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
            }),

            // Recipients table with ΠΡΑΞΗ column (includes total row)
            this.createRecipientsTableWithAction(
              documentData.recipients || [],
              documentData.expenditure_type,
            ),

            // Standard text about documentation retention
            new Paragraph({
              children: [
                new TextRun({
                  text: "ΤΑ ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΒΑΣΕΙ ΤΩΝ ΟΠΟΙΩΝ ΕΚΔΟΘΗΚΑΝ ΟΙ ΔΙΟΙΚΗΤΙΚΕΣ ΠΡΑΞΕΙΣ ΑΝΑΓΝΩΡΙΣΗΣ ΔΙΚΑΙΟΥΧΩΝ ΔΩΡΕΑΝ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ ΤΗΡΟΥΝΤΑΙ ΣΤΟ ΑΡΧΕΙΟ ΤΗΣ ΥΠΗΡΕΣΙΑΣ ΜΑΣ.",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Empty space before signatures
            new Paragraph({
              children: [new TextRun({ text: "" })],
              spacing: { before: 600, after: 600 },
            }),

            // Signature fields with compiler on the left
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
                    // Left side - compiler details
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: "Ο ΣΥΝΤΑΞΑΣ", bold: true })],
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 400, after: 400 },
                        }),
                        new Paragraph({
                          children: [new TextRun({ text: userInfo.name })],
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 200 },
                        }),
                        new Paragraph({
                          children: [new TextRun({ text: userInfo.descr || "", bold: true })],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    }),
                    // Right side - signature field (Ministry representative)
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                      children: [
                        // Create the same signature textbox as in createFooter method
                        new Table({
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
                                  borders: {
                                    top: { style: BorderStyle.NONE },
                                    bottom: { style: BorderStyle.NONE },
                                    left: { style: BorderStyle.NONE },
                                    right: { style: BorderStyle.NONE },
                                  },
                                  children: [
                                    new Paragraph({
                                      alignment: AlignmentType.CENTER,
                                      children: [
                                        new TextRun({
                                          text: unitDetails?.manager?.order,
                                          bold: true,
                                        }),
                                      ],
                                    }),
                                    new Paragraph({
                                      alignment: AlignmentType.CENTER,
                                      children: [
                                        new TextRun({
                                          text:
                                            unitDetails?.manager?.title || "",
                                          bold: true,
                                        }),
                                      ],
                                    }),
                                    new Paragraph({
                                      alignment: AlignmentType.CENTER,
                                      spacing: { before: 160, after: 160 },
                                      children: [
                                        new TextRun({
                                          text: "",
                                        }),
                                      ],
                                    }),
                                    new Paragraph({
                                      alignment: AlignmentType.CENTER,
                                      children: [
                                        new TextRun({
                                          text: unitDetails?.manager?.name,
                                          bold: true,
                                        }),
                                      ],
                                    }),
                                    new Paragraph({
                                      alignment: AlignmentType.CENTER,
                                      children: [
                                        new TextRun({
                                          text: unitDetails?.manager?.degree,
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
                }),
              ],
            }),
          ],
        },
      ];

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
              id: "Heading1",
              name: "Heading 1",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                size: 32,
                bold: true,
              },
              paragraph: {
                spacing: { line: 340, lineRule: "atLeast" },
              },
            },
          ],
        },
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error("Error generating secondary document:", error);
      throw error;
    }
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
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4 },
                  bottom: { style: BorderStyle.SINGLE, size: 4 },
                  left: { style: BorderStyle.SINGLE, size: 4 },
                  right: { style: BorderStyle.SINGLE, size: 4 },
                },
                margins: {
                  top: 50,
                  bottom: 50,
                  left: 50,
                  right: 50,
                },
                width: { size: 100, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: subjectText.map(
                      (part) =>
                        new TextRun({
                          text: part.text,
                          bold: part.bold,
                          italics: part.italics,
                          size: this.DEFAULT_FONT_SIZE,
                        }),
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

  private static createMainContent(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): (Paragraph | Table)[] {
    const unitName = unitDetails?.unit_name?.name || documentData.unit;
    const unitProp = unitDetails?.unit_name?.prop || "τη";
    return [
      this.createBlankLine(8),
      new Paragraph({
        children: [
          new TextRun({
            text: "Σχ.: Οι διατάξεις των άρθρων 7 και 14 του Π.Δ. 77/2023 (Α΄130) «Σύσταση Υπουργείου και μετονομασία Υπουργείων – Σύσταση, κατάργηση και μετονομασία Γενικών και Ειδικών Γραμματειών – Μεταφορά αρμοδιοτήτων, υπηρεσιακών μονάδων, θέσεων προσωπικού και εποπτευόμενων φορέων», όπως τροποποιήθηκε, συμπληρώθηκε και ισχύει.",
            size: DocumentFormatter.DEFAULT_FONT_SIZE - 2,
          }),
        ],
      }),
      this.createBlankLine(14),
      new Paragraph({
        children: [
          new TextRun({
            text: `Αιτούμαστε την πληρωμή των κρατικών αρωγών που έχουν εγκριθεί από ${unitDetails?.unit_name?.prop || "τη"} ${unitDetails?.unit || "Μονάδα"}, σύμφωνα με τα παρακάτω στοιχεία.`,
          }),
        ],
      }),
      this.createBlankLine(14),
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
                      new TextRun({ text: "ΑΡ. ΕΡΓΟΥ: ", bold: true }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${documentData.project_na853 || ""} της ΣΑΝΑ 853`,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "ΑΛΕ: ", bold: true })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "2310989004–Οικονομικής ενισχ. πυροπαθών, σεισμ/κτων, πλημ/παθών κ.λπ.",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "ΤΟΜΕΑΣ: ", bold: true })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Υπο-Πρόγραμμα Κρατικής αρωγής και αποκατάστασης επιπτώσεων φυσικών καταστροφών",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: "" })],
      }),
    ];
  }

  /**
   * Creates a special recipients table with an extra ΠΡΑΞΗ column
   * Used in the second document
   */
  private static createRecipientsTableWithAction(
    recipients: NonNullable<
      DocumentData["recipients"] & Array<{ secondary_text?: string }>
    >,
    expenditureType: string,
  ): Table {
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
        height: { value: 360, rule: HeightRule.ATLEAST },
        children: [
          this.createHeaderCell("Α.Α.", "auto"),
          this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "auto"),
          this.createHeaderCell("ΠΟΣΟ (€)", "auto"),
          this.createHeaderCell("ΔΟΣΗ", "auto"),
          this.createHeaderCell("ΑΦΜ", "auto"),
          this.createHeaderCell("ΠΡΑΞΗ", "auto"), // Extra column for action/expenditure type
        ],
      }),
    ];

    // Process each recipient
    recipients.forEach((recipient, index) => {
      // Check if fathername exists and is not empty
      const firstname = recipient.firstname || "";
      const lastname = recipient.lastname || "";
      const fathername = recipient.fathername || "";

      // Check if fathername exists and is not empty
      const fullName =
        !fathername || fathername.trim() === ""
          ? `${lastname} ${firstname}`.trim()
          : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();
      const afm = recipient.afm || "";
      const rowNumber = (index + 1).toString() + ".";
      let installments: string[] = [];
      if (
        Array.isArray(recipient.installments) &&
        recipient.installments.length > 0
      ) {
        installments = recipient.installments;
      } else if (recipient.installment) {
        installments = [recipient.installment.toString()];
      } else {
        installments = ["ΕΦΑΠΑΞ"];
      }

      // Get installment amounts if available
      const installmentAmounts = recipient.installmentAmounts || {};

      // If there's only one installment, create a simple row
      if (installments.length === 1) {
        const installment = installments[0];
        const amount = installmentAmounts[installment] || recipient.amount;

        rows.push(
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              this.createTableCell(rowNumber, "center"),
              this.createTableCellWithSecondaryText(
                fullName,
                recipient.secondary_text,
                "center",
              ),
              this.createTableCell(
                amount.toLocaleString("el-GR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                "center",
              ),
              this.createTableCell(installment, "center"),
              this.createTableCell(afm, "center"),
              this.createTableCell(expenditureType, "center"), // Add expenditure type in the extra column
            ],
          }),
        );
      } else {
        // For multiple installments, use row spanning (same as primary document)
        const rowSpan = installments.length;
        const rowHeight = 360; // Base height for one row

        // Create cells for the first row with rowSpan
        const nameCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: fullName,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        const indexCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: rowNumber,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        const afmCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: afm,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        // Add expenditure type cell with rowSpan
        const expenditureTypeCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: expenditureType,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        // Add the first row with installment details
        const firstInstallment = installments[0];
        const firstAmount = installmentAmounts[firstInstallment] || 0;

        rows.push(
          new TableRow({
            height: { value: rowHeight, rule: HeightRule.ATLEAST },
            children: [
              indexCell,
              nameCell,
              this.createTableCell(
                firstAmount.toLocaleString("el-GR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                "center",
              ),
              this.createTableCell(firstInstallment, "center"),
              afmCell,
              expenditureTypeCell,
            ],
          }),
        );

        // Add subsequent rows for remaining installments
        for (let i = 1; i < installments.length; i++) {
          const installment = installments[i];
          const amount = installmentAmounts[installment] || 0;

          rows.push(
            new TableRow({
              height: { value: rowHeight, rule: HeightRule.ATLEAST },
              children: [
                // These cells will be empty due to rowSpan in the first row
                this.createTableCell(
                  amount.toLocaleString("el-GR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                  "center",
                ),
                this.createTableCell(installment, "center"),
              ],
            }),
          );
        }
      }
    });

    // Calculate total amount
    const totalAmount = recipients.reduce((sum, r) => {
      const amount =
        typeof r.amount === "number"
          ? r.amount
          : parseFloat(String(r.amount) || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    // Add total row to the table, formatting to match primary document
    rows.push(
      new TableRow({
        height: { value: 360, rule: HeightRule.ATLEAST },
        children: [
          this.createTableCell("ΣΥΝΟΛΟ:", "right", 2),
          this.createTableCell(
            totalAmount.toLocaleString("el-GR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €",
            "center",
          ),
          // Empty column for ΔΟΣΗ
          this.createTableCell("", "center"),
          // Empty column for ΑΦΜ
          this.createTableCell("", "center"),
          // Empty column for ΠΡΑΞΗ
          this.createTableCell("", "center"),
        ],
      }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows,
    });
  }

  private static createPaymentTable(
    recipients: NonNullable<
      DocumentData["recipients"] & Array<{ secondary_text?: string }>
    >,
  ): Table {
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
        height: { value: 360, rule: HeightRule.ATLEAST },
        children: [
          this.createHeaderCell("Α.Α.", "auto"),
          this.createHeaderCell("ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "auto"),
          this.createHeaderCell("ΠΟΣΟ (€)", "auto"),
          this.createHeaderCell("ΔΟΣΗ", "auto"),
          this.createHeaderCell("ΑΦΜ", "auto"),
        ],
      }),
    ];

    // Process each recipient
    recipients.forEach((recipient, index) => {
      // Ensure all recipient properties exist and handle undefined/null values safely
      const firstname = recipient.firstname || '';
      const lastname = recipient.lastname || '';
      const fathername = recipient.fathername || '';
      
      // Check if fathername exists and is not empty
      const fullName = !fathername || fathername.trim() === ""
        ? `${lastname} ${firstname}`.trim()
        : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();
      const afm = recipient.afm || '';
      const rowNumber = (index + 1).toString() + ".";
      let installments: string[] = [];
      if (
        Array.isArray(recipient.installments) &&
        recipient.installments.length > 0
      ) {
        installments = recipient.installments;
      } else if (recipient.installment) {
        installments = [recipient.installment.toString()];
      } else {
        installments = ["ΕΦΑΠΑΞ"];
      }

      // Get installment amounts if available
      const installmentAmounts = recipient.installmentAmounts || {};

      // If there's only one installment, create a simple row
      if (installments.length === 1) {
        const installment = installments[0];
        const amount = installmentAmounts[installment] || recipient.amount;

        // Determine row height based on content
        // Use ATLEAST instead of EXACT to allow expansion for text
        const rowHeight =
          recipient.secondary_text && recipient.secondary_text.trim()
            ? { value: 540, rule: HeightRule.ATLEAST } // Taller row for secondary text
            : { value: 360, rule: HeightRule.ATLEAST }; // Standard row height, but still expandable

        rows.push(
          new TableRow({
            height: rowHeight,
            children: [
              this.createTableCell(rowNumber, "center"),
              this.createTableCellWithSecondaryText(
                fullName,
                recipient.secondary_text,
                "center",
              ),
              this.createTableCell(
                amount.toLocaleString("el-GR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                "center",
              ),
              this.createTableCell(installment, "center"),
              this.createTableCell(afm, "center"),
            ],
          }),
        );
      }
      // If there are multiple installments, create a row with rowSpan for name/AFM
      // and separate rows for each installment
      else if (installments.length > 1) {
        const rowSpan = installments.length;
        const rowHeight = 360; // Base height for one row

        // Calculate heights to vertically center the name and AFM
        const totalHeight = rowHeight * rowSpan;

        // Create cells for the first row with rowSpan
        const nameCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: fullName,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        const indexCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: rowNumber,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        const afmCell = new TableCell({
          rowSpan: rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: afm,
                  size: this.DEFAULT_FONT_SIZE,
                }),
              ],
            }),
          ],
        });

        // Add the first row with installment details
        const firstInstallment = installments[0];
        const firstAmount = installmentAmounts[firstInstallment] || 0;

        rows.push(
          new TableRow({
            height: { value: rowHeight, rule: HeightRule.ATLEAST },
            children: [
              indexCell,
              nameCell,
              this.createTableCell(
                firstAmount.toLocaleString("el-GR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
                "center",
              ),
              this.createTableCell(firstInstallment, "center"),
              afmCell,
            ],
          }),
        );

        // Add subsequent rows for remaining installments
        for (let i = 1; i < installments.length; i++) {
          const installment = installments[i];
          const amount = installmentAmounts[installment] || 0;

          rows.push(
            new TableRow({
              height: { value: rowHeight, rule: HeightRule.ATLEAST },
              children: [
                // These cells will be empty due to rowSpan in the first row
                this.createTableCell(
                  amount.toLocaleString("el-GR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                  "center",
                ),
                this.createTableCell(installment, "center"),
              ],
            }),
          );
        }
      }
    });

    // Calculate total amount, safely handling undefined or null values
    const totalAmount = recipients.reduce(
      (sum, recipient) => sum + (recipient.amount || 0),
      0,
    );
    rows.push(
      new TableRow({
        height: { value: 360, rule: HeightRule.ATLEAST },
        children: [
          this.createTableCell("ΣΥΝΟΛΟ:", "right", 2),
          this.createTableCell(
            totalAmount.toLocaleString("el-GR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €",
            "right",
          ),
          this.createTableCell("", "center", 2),
        ],
      }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows,
    });
  }

  private static createNote(): Paragraph {
    return new Paragraph({
      text: "Παρακαλούμε όπως, μετά την ολοκλήρωση της διαδικασίας ελέγχου και εξόφλησης των δικαιούχων, αποστείλετε στην Υπηρεσία μας αντίγραφα των επιβεβαιωμένων ηλεκτρονικών τραπεζικών εντολών.",
    });
  }

  private static createFooter(
    documentData: DocumentData,
    unitDetails: UnitDetails | null | undefined,
  ): Table {
    const attachments = (documentData.attachments || [])
      .map((item) => item.replace(/^\d+\-/, ""))
      .filter(Boolean);

    // Create a two-column table with proper layout
    // Create the left column content (attachments, notifications, etc.)
    const leftColumnParagraphs: Paragraph[] = [];

    leftColumnParagraphs.push(
      this.createBoldUnderlinedParagraph("ΣΥΝΗΜΜΕΝΑ (Εντός κλειστού φακέλου)"),
    );

    for (let i = 0; i < attachments.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          text: `${i + 1}. ${attachments[i]}`,
          keepLines: false,
          indent: { left: 426 },
          style: "a6",
        }),
      );
    }

    leftColumnParagraphs.push(
      this.createBoldUnderlinedParagraph("ΚΟΙΝΟΠΟΙΗΣΗ"),
    );

    const notifications = [
      "Γρ. Υφυπουργού Κλιματικής Κρίσης & Πολιτικής Προστασίας",
      "Γρ. Γ.Γ. Αποκατάστασης Φυσικών Καταστροφών και Κρατικής Αρωγής",
      "Γ.Δ.Α.Ε.Φ.Κ.",
    ];

    for (let i = 0; i < notifications.length; i++) {
      leftColumnParagraphs.push(
        new Paragraph({
          text: `${i + 1}. ${notifications[i]}`,
          keepLines: false,
          indent: { left: 426 },
          style: "a6",
        }),
      );
    }

    leftColumnParagraphs.push(
      this.createBoldUnderlinedParagraph("ΕΣΩΤΕΡΙΚΗ ΔΙΑΝΟΜΗ"),
    );

    leftColumnParagraphs.push(
      new Paragraph({
        text: "1. Χρονολογικό Αρχείο",
        keepLines: false,
        indent: { left: 426 },
        style: "a6",
      }),
    );

    // Create the right column with signature (text only)

    // First, create paragraphs for the title and role
    const titleParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: unitDetails?.manager?.order || "",
          bold: true,
        }),
      ],
    });

    const roleParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: unitDetails?.manager?.title || "",
          bold: true,
        }),
      ],
    });

    // Create an empty space where signature would be
    const signatureSpaceParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 160 },
      children: [
        new TextRun({
          text: "",
        }),
      ],
    });

    // Create paragraphs for the name and degree
    const nameParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: unitDetails?.manager?.name || "",
          bold: true,
        }),
      ],
    });

    const degreeParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: unitDetails?.manager?.degree || "",
        }),
      ],
    });

    // Combine all paragraphs into a table for proper layout
    const signatureTextbox = new Table({
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
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                titleParagraph,
                roleParagraph,
                signatureSpaceParagraph,
                nameParagraph,
                degreeParagraph,
              ],
            }),
          ],
        }),
      ],
    });

    // For compatibility, create a container paragraph to hold the textbox
    const signatureParagraph = new Paragraph({
      keepLines: true,
      spacing: { before: 480 }, // Add some space before the signature
      children: [new TextRun({ text: "" })],
    });

    // Create a floating table that keeps the correct layout
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [7000, 4000], // Set fixed column widths
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
          cantSplit: false, // Allow the row to split across pages - important!
          children: [
            // Left column - allows flow across pages
            new TableCell({
              children: leftColumnParagraphs,
              verticalAlign: VerticalAlign.TOP,
              margins: {
                marginUnitType: WidthType.DXA,
                right: 300,
              }, // Add some margin for separation
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),

            // Right column - signature stays together in a textbox
            new TableCell({
              children: [signatureTextbox],
              verticalAlign: VerticalAlign.TOP,
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
      spacing: { before: 240, after: 10 },
    });
  }

  /**
   * Helper method for creating a regular cell for second document tables
   */
  private static createCell(
    text: string,
    alignment: "center" | "left" | "right" = AlignmentType.CENTER,
  ): TableCell {
    return new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              size: this.DEFAULT_FONT_SIZE,
            }),
          ],
          alignment,
        }),
      ],
    });
  }

  /**
   * Helper method for creating a cell with row spanning for second document tables
   */
  private static createCellWithRowSpan(
    text: string,
    rowSpan: number,
    verticalMerge: "restart" | "continue" = VerticalMergeType.RESTART,
    alignment: "center" | "left" | "right" = AlignmentType.CENTER,
  ): TableCell {
    return new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      verticalMerge,
      rowSpan: rowSpan > 0 ? rowSpan : undefined,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              size: this.DEFAULT_FONT_SIZE,
            }),
          ],
          alignment,
        }),
      ],
    });
  }

  /**
   * Creates a table cell with rowspan and secondary text support
   */
  private static createCellWithRowSpanAndSecondaryText(
    primaryText: string,
    secondaryText: string | undefined,
    alignment: "center" | "left" | "right" = AlignmentType.CENTER,
    rowSpan: number = 1,
    verticalMerge: "restart" | "continue" = VerticalMergeType.RESTART,
  ): TableCell {
    const alignmentMap = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
    };

    const children = [
      new Paragraph({
        children: [
          new TextRun({ text: primaryText, size: this.DEFAULT_FONT_SIZE }),
        ],
        alignment: alignmentMap[alignment],
      }),
    ];

    // Add secondary text as a second paragraph if it exists and isn't empty
    if (secondaryText && secondaryText.trim()) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: secondaryText,
              size: this.DEFAULT_FONT_SIZE,
              italics: true, // Make secondary text italic to differentiate it
            }),
          ],
          alignment: alignmentMap[alignment],
        }),
      );
    }

    return new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      verticalMerge,
      rowSpan: rowSpan > 0 ? rowSpan : undefined,
      children: children,
    });
  }

  /**
   * Helper method to format currency values consistently
   */
  private static formatCurrency(amount: number): string {
    return (
      amount.toLocaleString("el-GR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  }

  private static createContactDetail(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({ text: label }),
        new TextRun({ text: ": " }),
        new TextRun({ text: value || "........................" }),
      ],
    });
  }

  private static createBlankLine(size: number = 60): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: " ", size: size })],
      spacing: { before: 0, after: 0, line: 100, lineRule: "exact" },
    });
  }

  private static createHeaderCell(
    text: string,
    width: string | number,
  ): TableCell {
    const widthSetting =
      width === "auto"
        ? undefined
        : { size: width as number, type: WidthType.PERCENTAGE };

    return new TableCell({
      width: widthSetting,
      children: [
        new Paragraph({
          children: [
            new TextRun({ text, bold: true, size: this.DEFAULT_FONT_SIZE }),
          ],
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

  /**
   * Creates a table cell with two lines of text (primary and secondary)
   * Used for recipient names where secondary text is provided
   */
  private static createTableCellWithSecondaryText(
    primaryText: string,
    secondaryText: string | undefined,
    alignment: "left" | "center" | "right",
    colSpan?: number,
  ): TableCell {
    const alignmentMap = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
    };

    const children = [
      new Paragraph({
        children: [
          new TextRun({ text: primaryText, size: this.DEFAULT_FONT_SIZE }),
        ],
        alignment: alignmentMap[alignment],
      }),
    ];

    // Add secondary text as a second paragraph if it exists and isn't empty
    if (secondaryText && secondaryText.trim()) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: secondaryText,
              size: this.DEFAULT_FONT_SIZE,
              italics: true, // Make secondary text italic to differentiate it
            }),
          ],
          alignment: alignmentMap[alignment],
        }),
      );
    }

    return new TableCell({
      columnSpan: colSpan,
      children: children,
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  public static async getUnitDetails(
    unitCode: string,
  ): Promise<UnitDetails | null> {
    try {
      if (!unitCode) {
        logger.error("No unit code provided");
        return null;
      }

      logger.debug("Fetching unit details for:", unitCode);

      // Try exact match on unit field first
      let { data: unitData, error: unitError } = await supabase
        .from("Monada")
        .select("*")
        .eq("unit", unitCode)
        .maybeSingle();

      // If not found, try with unit_name.name using containsJson query
      if (!unitData && !unitError) {
        logger.debug(
          "Unit not found by exact match on unit field, trying unit_name.name",
        );

        // Get all units and filter manually for unit_name.name match
        const { data: allUnits, error: fetchError } = await supabase
          .from("Monada")
          .select("*");

        if (!fetchError && allUnits) {
          // Find the first unit that matches by unit_name.name
          unitData =
            allUnits.find(
              (unit) =>
                unit.unit_name &&
                typeof unit.unit_name === "object" &&
                unit.unit_name.name &&
                unit.unit_name.name === unitCode,
            ) || null;

          if (unitData) {
            logger.debug("Found unit by unit_name.name match:", unitData.unit);
          }
        } else if (fetchError) {
          logger.error("Error fetching all units:", fetchError);
        }
      }

      // If still not found, try case-insensitive search on unit field
      if (!unitData && !unitError) {
        logger.debug(
          "Unit not found by exact match, trying case-insensitive search on unit field",
        );
        ({ data: unitData, error: unitError } = await supabase
          .from("Monada")
          .select("*")
          .ilike("unit", unitCode)
          .maybeSingle());
      }

      if (unitError) {
        logger.error("Error fetching unit details:", unitError);
        return null;
      }

      if (!unitData) {
        logger.debug("No unit found in database, returning default values");
        // Return default unit details instead of null
        return {
          unit: unitCode,
          unit_name: {
            name: unitCode,
            prop: "τη",
          },
          address: {
            address: "",
            tk: "",
            region: "",
          },
          manager: {
            name: "",
            order: "",
            title: "",
            degree: "",
            prepose: "",
          },
          email: "",
        };
      }

      logger.debug("Unit details fetched:", unitData);
      return unitData;
    } catch (error) {
      logger.error("Error in getUnitDetails:", error);
      // Return default unit details on error
      return {
        unit: unitCode,
        unit_name: {
          name: unitCode,
          prop: "τη",
        },
        address: {
          address: "",
          tk: "",
          region: "",
        },
        manager: {
          name: "",
          order: "",
          title: "",
          degree: "",
          prepose: "",
        },
        email: "",
      };
    }
  }

  public async formatOrthiEpanalipsi(data: {
    comments: string;
    originalDocument: DocumentData;
    project_id: string;
    project_na853: string;
    protocol_number_input: string;
    protocol_date: string;
    unit: string;
    expenditure_type: string;
    recipients: Array<{
      firstname: string;
      lastname: string;
      fathername?: string;
      afm: string;
      amount: number;
      installment: number | string;
      installments?: string[];
      installmentAmounts?: Record<string, number>;
    }>;
    total_amount: number;
    id?: number; // Optional ID that might be passed
  }): Promise<Buffer> {
    try {
      logger.debug("Formatting orthi epanalipsi document with data:", data);

      // Get unit details
      const unitDetails = await DocumentFormatter.getUnitDetails(data.unit);

      // Create a document data object compatible with our methods
      const documentData: DocumentData = {
        id: data.id || data.originalDocument.id,
        unit: data.unit,
        project_id: data.project_id,
        project_na853: data.project_na853,
        expenditure_type: data.expenditure_type,
        protocol_number: data.protocol_number_input,
        protocol_number_input: data.protocol_number_input,
        protocol_date: data.protocol_date,
        user_name: data.originalDocument.user_name,
        department: data.originalDocument.department,
        contact_number: data.originalDocument.contact_number,
        generated_by: data.originalDocument.generated_by,
        attachments: data.originalDocument.attachments,
        recipients: data.recipients.map((r) => ({
          ...r,
          fathername: r.fathername || "", // Ensure fathername exists
        })),
        total_amount: data.total_amount,
      };

      // Collect all children elements as proper document elements
      const children: (Paragraph | Table)[] = [];

      // Add header
      children.push(
        await DocumentFormatter.createDocumentHeader(documentData, unitDetails),
      );

      // Add document subject
      const docSubject = DocumentFormatter.createDocumentSubject(
        documentData,
        unitDetails,
      );
      docSubject.forEach((element: Paragraph | Table) =>
        children.push(element),
      );

      // Add main content
      const mainContent = DocumentFormatter.createMainContent(
        documentData,
        unitDetails,
      );
      mainContent.forEach((element: Paragraph | Table) =>
        children.push(element),
      );

      // Add payment table
      children.push(
        DocumentFormatter.createPaymentTable(documentData.recipients || []),
      );

      // Add note
      children.push(DocumentFormatter.createNote());

      // Add footer
      const footer = DocumentFormatter.createFooter(documentData, unitDetails);
      children.push(footer);

      // Create section with all elements
      // Cast the children array to any to avoid TypeScript errors with Document sections
      const sectionElements: any[] = children;

      const sections = [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margins: DocumentFormatter.DOCUMENT_MARGINS,
              orientation: PageOrientation.PORTRAIT,
            },
          },
          children: sectionElements,
        },
      ];

      const doc = new Document({
        sections,
        styles: {
          default: {
            document: {
              run: {
                font: DocumentFormatter.DEFAULT_FONT,
                size: DocumentFormatter.DEFAULT_FONT_SIZE,
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
      logger.error("Error formatting orthi epanalipsi document:", error);
      throw error;
    }
  }
}
