import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { storage } from "../storage";
import { units } from "@shared/schema";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await storage.db.select().from(units).orderBy(units.name);
    res.json(result);
  } catch (error) {
    console.error("Error fetching units:", error);
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

export default router;
