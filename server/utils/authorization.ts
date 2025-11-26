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
  projectId: number
): Promise<ProjectAuthResult> {
  try {
    if (!user || !user.id) {
      return {
        authorized: false,
        error: "Authentication required",
        statusCode: 401,
      };
    }

    console.log(`[Authorization] Checking access for user ${user.id} to project ${projectId}`);

    const { data: project, error: projectError } = await supabase
      .from("Projects")
      .select("id, mis")
      .eq("id", projectId)
      .single();

    console.log(`[Authorization] Supabase query result:`, {
      hasProject: !!project,
      hasError: !!projectError,
      error: projectError,
      projectData: project
    });

    if (projectError || !project) {
      console.error(`[Authorization] Project ${projectId} not found:`, projectError);
      return {
        authorized: false,
        error: "Project not found",
        statusCode: 404,
      };
    }

    // All authenticated users can access all projects
    console.log(`[Authorization] User ${user.id} granted access to project ${projectId}`);
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
  projectId: number
): Promise<any | null> {
  const authResult = await canAccessProject(req.user, projectId);

  if (!authResult.authorized) {
    res.status(authResult.statusCode || 403).json({
      message: authResult.error || "Access denied",
    });
    return null;
  }

  return authResult.project;
}
