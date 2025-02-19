import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";
import type { ProjectCatalog } from "@shared/schema";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const { unit } = req.query;

  try {
    const projects = unit 
      ? await storage.getProjectCatalogByUnit(unit as string)
      : await storage.getProjectCatalog();

    // Map projects to include all necessary fields
    const formattedProjects = projects.map((project: ProjectCatalog) => ({
      id: project.id,
      mis: project.mis,
      na853: project.na853,
      event_description: project.event_description,
      implementing_agency: project.implementing_agency,
      region: project.region,
      municipality: project.municipality,
      budget_na853: project.budget_na853,
      budget_na271: project.budget_na271,
      budget_e069: project.budget_e069,
      ethsia_pistosi: project.ethsia_pistosi,
      status: project.status,
      event_type: project.event_type,
      event_year: project.event_year,
      procedures: project.procedures,
      created_at: project.created_at,
      updated_at: project.updated_at
    }));

    res.json(formattedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/:projectId/expenditure-types", authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const expenditureTypes = await storage.getProjectExpenditureTypes(projectId);

    if (!expenditureTypes || expenditureTypes.length === 0) {
      return res.json([
        "Travel",
        "Equipment",
        "Supplies",
        "Services",
        "Other"
      ]);
    }

    res.json(expenditureTypes);
  } catch (error) {
    console.error("Error fetching expenditure types:", error);
    res.status(500).json({ error: "Failed to fetch expenditure types" });
  }
});

export default router;