import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { data: units, error } = await storage.getProjectCatalog();

    if (error) {
      throw error;
    }

    // Extract unique implementing agencies and map them to unit format
    const uniqueUnits = Array.from(new Set(
      units.flatMap(project => 
        Array.isArray(project.implementing_agency) 
          ? project.implementing_agency 
          : [project.implementing_agency]
      )
    )).filter(Boolean).map(name => ({
      id: name,
      name: name,
      code: name,
    }));

    res.json(uniqueUnits);
  } catch (error) {
    console.error("Error fetching units:", error);
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

export default router;