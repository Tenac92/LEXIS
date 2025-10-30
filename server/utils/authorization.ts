import { Response } from "express";
import { AuthenticatedRequest } from "../authentication";
import { supabase } from "../config/db";

export interface ProjectAuthResult {
  authorized: boolean;
  project?: any;
  error?: string;
  statusCode?: number;
}

export async function canAccessProject(
  user: any,
  mis: string
): Promise<ProjectAuthResult> {
  try {
    if (!user || !user.id) {
      return {
        authorized: false,
        error: "Authentication required",
        statusCode: 401,
      };
    }

    const { data: project, error: projectError } = await supabase
      .from("Projects")
      .select("id, mis, monada_id, implementing_agency")
      .eq("mis", mis)
      .single();

    if (projectError || !project) {
      return {
        authorized: false,
        error: "Project not found",
        statusCode: 404,
      };
    }

    if (user.role === "admin") {
      return { authorized: true, project };
    }

    const userUnits = Array.isArray(user.unit_id) ? user.unit_id : user.unit_id ? [user.unit_id] : [];

    if (userUnits.length === 0) {
      return {
        authorized: false,
        error: "User has no assigned units",
        statusCode: 403,
      };
    }

    let hasAccess = false;

    if (project.monada_id && userUnits.includes(project.monada_id)) {
      hasAccess = true;
    }

    if (!hasAccess && Array.isArray(project.implementing_agency)) {
      const { data: monadaData } = await supabase
        .from("Monada")
        .select("id, unit")
        .in("id", userUnits);

      const userUnitCodes = (monadaData || []).map((m: any) => m.unit);

      const agencyOverlap = project.implementing_agency.some((agency: string) =>
        userUnitCodes.includes(agency)
      );

      if (agencyOverlap) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return {
        authorized: false,
        error: "You do not have access to this project",
        statusCode: 403,
      };
    }

    return { authorized: true, project };
  } catch (error) {
    console.error("[Authorization] Error checking project access:", error);
    return {
      authorized: false,
      error: "Internal server error",
      statusCode: 500,
    };
  }
}

export async function requireProjectAccess(
  req: AuthenticatedRequest,
  res: Response,
  mis: string
): Promise<any | null> {
  const authResult = await canAccessProject(req.user, mis);

  if (!authResult.authorized) {
    res.status(authResult.statusCode || 403).json({
      message: authResult.error || "Access denied",
    });
    return null;
  }

  return authResult.project;
}
