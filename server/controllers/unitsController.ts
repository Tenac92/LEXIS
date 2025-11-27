import { Router } from "express";
import { authenticateSession } from "../authentication";
import { supabase } from "../config/db";

export const router = Router();

/**
 * Get for_yl (implementing agencies) filtered by monada_id
 * Used when selecting a monada to show available for_yl options
 */
router.get("/for-yl", authenticateSession, async (req: any, res) => {
  try {
    const { monada_id } = req.query;
    console.log("[ForYl] Fetching for_yl data, monada_id:", monada_id);
    
    // Query the for_yl table
    const { data: forYlData, error } = await supabase
      .from("for_yl")
      .select("id, foreis");

    if (error) {
      console.error("[ForYl] Database error:", error);
      return res.status(500).json({ 
        message: "Failed to fetch for_yl from database",
        error: error.message
      });
    }

    // Filter by monada_id if provided
    let filteredData = forYlData || [];
    if (monada_id) {
      filteredData = filteredData.filter(item => {
        const foreis = item.foreis as { title?: string; monada_id?: string } | null;
        return foreis?.monada_id === String(monada_id);
      });
    }

    // Map to a more usable format
    const formattedForYl = filteredData.map(item => {
      const foreis = item.foreis as { title?: string; monada_id?: string } | null;
      return {
        id: item.id,
        title: foreis?.title || "",
        monada_id: foreis?.monada_id || ""
      };
    });

    console.log("[ForYl] Found for_yl entries:", formattedForYl.length);
    res.json(formattedForYl);
  } catch (error) {
    console.error("[ForYl] Error fetching for_yl:", error);
    res.status(500).json({ 
      message: "Failed to fetch for_yl",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get a single for_yl by ID with full details
 */
router.get("/for-yl/:id", authenticateSession, async (req: any, res) => {
  try {
    const { id } = req.params;
    console.log("[ForYl] Fetching for_yl by ID:", id);
    
    const { data: forYlData, error } = await supabase
      .from("for_yl")
      .select("id, foreis")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[ForYl] Database error:", error);
      return res.status(404).json({ 
        message: "For YL not found",
        error: error.message
      });
    }

    const foreis = forYlData.foreis as { title?: string; monada_id?: string } | null;
    const result = {
      id: forYlData.id,
      title: foreis?.title || "",
      monada_id: foreis?.monada_id || ""
    };

    console.log("[ForYl] Found for_yl:", result);
    res.json(result);
  } catch (error) {
    console.error("[ForYl] Error fetching for_yl:", error);
    res.status(500).json({ 
      message: "Failed to fetch for_yl",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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