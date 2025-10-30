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

    if (user.role === "admin") {
      console.log(`[Authorization] Admin user ${user.id} granted access to project ${projectId}`);
      return { authorized: true, project };
    }

    // For non-admin users, check if they have access through project_index
    const userUnits = Array.isArray(user.unit_id) ? user.unit_id : user.unit_id ? [user.unit_id] : [];

    if (userUnits.length === 0) {
      console.log(`[Authorization] User ${user.id} has no assigned units`);
      return {
        authorized: false,
        error: "User has no assigned units",
        statusCode: 403,
      };
    }

    // Check if user's units match any project_index entries for this project
    const { data: projectIndexEntries, error: indexError } = await supabase
      .from("project_index")
      .select("id, monada_id")
      .eq("project_id", projectId)
      .in("monada_id", userUnits);

    if (indexError) {
      console.error(`[Authorization] Error checking project_index:`, indexError);
      return {
        authorized: false,
        error: "Error checking project access",
        statusCode: 500,
      };
    }

    if (projectIndexEntries && projectIndexEntries.length > 0) {
      console.log(`[Authorization] Non-admin user ${user.id} granted access to project ${projectId} through ${projectIndexEntries.length} matching index entries`);
      return { authorized: true, project };
    }

    console.log(`[Authorization] User ${user.id} denied access to project ${projectId} - no matching units`);
    return {
      authorized: false,
      error: "You do not have access to this project",
      statusCode: 403,
    };
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
