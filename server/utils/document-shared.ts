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
import { createLogger } from "./logger";
import { UserDetails, UnitDetails, DocumentData } from "./document-types";

const logger = createLogger("DocumentShared");

export class DocumentShared {
  public static readonly DEFAULT_FONT_SIZE = 20;
  public static readonly DEFAULT_FONT = "Calibri";
  public static readonly DEFAULT_MARGINS = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  public static readonly DOCUMENT_MARGINS = this.DEFAULT_MARGINS;

  public static async getLogoImageData(): Promise<Buffer> {
    const logoPath = path.join(
      process.cwd(),
      "server",
      "utils",
      "ethnosimo22.png",
    );
    return fs.promises.readFile(logoPath);
  }

  public static createBoldParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: 18,
          font: this.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    });
  }

  public static createBlankLine(spacing: number = 240): Paragraph {
    return new Paragraph({
      text: "",
      spacing: { after: spacing },
    });
  }

  public static createContactDetail(label: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `${label}: `,
          bold: false,
          size: 18,
          font: this.DEFAULT_FONT,
        }),
        new TextRun({
          text: value || "",
          bold: false,
          size: 18,
          font: this.DEFAULT_FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    });
  }

  public static formatCurrency(amount: number): string {
    return amount.toLocaleString("el-GR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  public static formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  public static async getUnitDetails(unit: string): Promise<UnitDetails | null> {
    try {
      logger.debug(`Fetching unit details for: ${unit}`);
      
      const { data, error } = await supabase
        .from("Units")
        .select("*")
        .eq("unit", unit)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching unit details:", error);
        return null;
      }

      return data as UnitDetails;
    } catch (error) {
      logger.error("Error in getUnitDetails:", error);
      return null;
    }
  }

  public static async getProjectTitle(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        logger.error("[DocumentShared] No MIS provided for project title lookup");
        return null;
      }

      logger.debug(`[DocumentShared] Fetching project title for input: '${mis}'`);

      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isProjectCode = projectCodePattern.test(mis);

      // Strategy 1: Try with na853
      const na853Result = await supabase
        .from("Projects")
        .select("project_title, mis, na853, budget_na853")
        .eq("na853", mis)
        .maybeSingle();

      if (na853Result.data?.project_title) {
        logger.debug(`[DocumentShared] Found project title by na853: '${na853Result.data.project_title}'`);
        return na853Result.data.project_title;
      }

      // Strategy 2: Try with budget_na853 if it looks like a project code
      if (isProjectCode) {
        const budgetResult = await supabase
          .from("Projects")
          .select("project_title, mis, na853, budget_na853")
          .eq("budget_na853", mis)
          .maybeSingle();

        if (budgetResult.data?.project_title) {
          logger.debug(`[DocumentShared] Found project title by budget_na853: '${budgetResult.data.project_title}'`);
          return budgetResult.data.project_title;
        }
      }

      // Strategy 3: Try with MIS as integer if numeric
      if (isNumericString) {
        const misResult = await supabase
          .from("Projects")
          .select("project_title, mis, na853, budget_na853")
          .eq("mis", parseInt(mis))
          .maybeSingle();

        if (misResult.data?.project_title) {
          logger.debug(`[DocumentShared] Found project title by MIS: '${misResult.data.project_title}'`);
          return misResult.data.project_title;
        }
      }

      logger.debug(`[DocumentShared] No project title found for: ${mis}`);
      return null;
    } catch (error) {
      logger.error("[DocumentShared] Error in getProjectTitle:", error);
      return null;
    }
  }

  public static async getProjectNA853(mis: string): Promise<string | null> {
    try {
      if (!mis) {
        logger.error("[DocumentShared] No MIS provided for NA853 lookup");
        return mis;
      }

      logger.debug(`[DocumentShared] Fetching NA853 for input: '${mis}'`);

      const isNumericString = /^\d+$/.test(mis);
      const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
      const isProjectCode = projectCodePattern.test(mis);

      // Strategy 1: Direct na853 lookup
      const na853Result = await supabase
        .from("Projects")
        .select("na853")
        .eq("na853", mis)
        .maybeSingle();

      if (na853Result.data?.na853) {
        logger.debug(`[DocumentShared] Found NA853 by direct lookup: ${na853Result.data.na853}`);
        return na853Result.data.na853;
      }

      // Strategy 2: Try MIS lookup to get na853
      if (isNumericString) {
        const misResult = await supabase
          .from("Projects")
          .select("na853")
          .eq("mis", parseInt(mis))
          .maybeSingle();

        if (misResult.data?.na853) {
          logger.debug(`[DocumentShared] Found NA853 by MIS lookup: ${misResult.data.na853}`);
          return misResult.data.na853;
        }
      }

      // Strategy 3: Try budget_na853 lookup
      const budgetResult = await supabase
        .from("Projects")
        .select("budget_na853")
        .eq("budget_na853", mis)
        .maybeSingle();

      if (budgetResult.data?.budget_na853) {
        logger.debug(`[DocumentShared] Found budget_na853 by direct lookup: ${budgetResult.data.budget_na853}`);
        return budgetResult.data.budget_na853;
      }

      logger.debug(`[DocumentShared] No NA853 found, using input as fallback: ${mis}`);
      return mis;
    } catch (error) {
      logger.error("[DocumentShared] Error in getProjectNA853:", error);
      return mis;
    }
  }
}