import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";
import { projects } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const { unit } = req.query;

  try {
    let query = storage.db.select().from(projects);
    
    if (unit) {
      query = query.where(eq(projects.unit, unit as string));
    }
    
    const result = await query.orderBy(projects.mis);
    res.json(result);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/:projectId/expenditure-types", authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const result = await storage.db
      .select()
      .from(projects)
      .where(eq(projects.id, parseInt(projectId)));

    if (result.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // For now, return a static list of expenditure types
    // This should be replaced with actual data from your business logic
    const expenditureTypes = [
      "Travel",
      "Equipment",
      "Supplies",
      "Services",
      "Other"
    ];

    res.json(expenditureTypes);
  } catch (error) {
    console.error("Error fetching expenditure types:", error);
    res.status(500).json({ error: "Failed to fetch expenditure types" });
  }
});

export default router;
