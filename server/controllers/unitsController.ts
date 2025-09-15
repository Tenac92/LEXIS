import { Router } from "express";
import { authenticateSession } from "../authentication";
import { supabase } from "../config/db";

export const router = Router();

router.get("/", authenticateSession, async (req: any, res) => {
  try {
    console.log("[Units] Fetching units from Monada table");
    
    // Get user's allowed units from their profile  
    const userUnitIds = req.user?.unit_id || [];
    console.log("[Units] User unit IDs:", userUnitIds);
    
    // Query the Monada table directly - get all units if admin
    let query = supabase
      .from("Monada")
      .select("id, unit, unit_name")
      .order("id");
    
    // If user has specific unit restrictions, filter by them
    if (userUnitIds && userUnitIds.length > 0 && req.user?.role !== 'admin') {
      query = query.in("id", userUnitIds);
      console.log("[Units] Filtering by user units:", userUnitIds);
    } else {
      console.log("[Units] Admin user - fetching all available units");
    }
    
    const { data: unitsData, error } = await query;

    if (error) {
      console.error("[Units] Database error:", error);
      return res.status(500).json({ 
        message: "Failed to fetch units from database",
        error: error.message
      });
    }

    console.log("[Units] Raw units data sample:", unitsData?.slice(0, 2));

    // Map the units to the expected format with correct ID mapping
    const formattedUnits = (unitsData || []).map(unit => ({
      id: unit.id.toString(), // Convert numeric ID to string for frontend
      name: unit.unit_name?.name || unit.unit, // Use full name from unit_name.name
      code: unit.unit // Keep unit code
    }));

    console.log("[Units] Found matching units:", formattedUnits.length);
    res.json(formattedUnits);
  } catch (error) {
    console.error("[Units] Error fetching units:", error);
    res.status(500).json({ 
      message: "Failed to fetch units",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;