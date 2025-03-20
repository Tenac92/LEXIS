import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";

export const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    // Get user's allowed units from their profile
    const userUnits = await storage.getUserUnits(req.user!.id);

    // Map the units to the expected format
    const formattedUnits = userUnits.map(unit => ({
      id: unit.unit,
      name: unit.unit_name,
      code: unit.unit
    }));

    res.json(formattedUnits);
  } catch (error) {
    console.error("Error fetching units:", error);
    res.status(500).json({ 
      message: "Failed to fetch units",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;