import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const { unit } = req.query;

  try {
    const projects = unit 
      ? await storage.getProjectCatalogByUnit(unit as string)
      : await storage.getProjectCatalog();

    // Map projects to the expected format
    const formattedProjects = projects.map(project => ({
      id: project.mis,
      name: project.project_title || project.event_description,
      mis: project.mis,
      na853: project.na853,
      budget: project.budget_na853 || project.budget_na271 || project.budget_e069
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