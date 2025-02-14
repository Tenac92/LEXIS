import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { supabase } from "../config/db";
import type { Request, Response } from "express";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const router = Router();

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, unit, dateFrom, dateTo } = req.query;
    let query = supabase.from('generated_documents').select('*');

    // Filter by user's assigned units unless they're admin
    if (req.user?.role !== 'admin') {
      if (!req.user?.unit) {
        return res.status(403).json({ message: 'No unit assigned' });
      }
      query = query.eq('unit', req.user.unit);
    }

    if (status) {
      query = query.eq('status', status as string);
    }
    if (unit && unit !== 'all') {
      query = query.eq('unit', unit as string);
    }

    // Date filters
    if (dateFrom) {
      query = query.gte('protocol_date', dateFrom as string);
    }
    if (dateTo) {
      query = query.lte('protocol_date', dateTo as string);
    }

    // Amount filters with validation
    if (req.query.amountFrom) {
      const amountFrom = parseFloat(req.query.amountFrom as string);
      if (!isNaN(amountFrom) && amountFrom >= 0 && amountFrom <= Number.MAX_SAFE_INTEGER) {
        query = query.gte('total_amount', amountFrom);
      }
    }
    if (req.query.amountTo) {
      const amountTo = parseFloat(req.query.amountTo as string);
      if (!isNaN(amountTo) && amountTo >= 0 && amountTo <= Number.MAX_SAFE_INTEGER) {
        query = query.lte('total_amount', amountTo);
      }
    }

    // User/Recipient filter with proper text search
    if (req.query.user) {
      const searchTerm = (req.query.user as string).toLowerCase().trim();
      if (searchTerm) {
        query = query.or(`recipients.cs.[{"lastname":"${searchTerm}"}],recipients.cs.[{"afm":"${searchTerm}"}]`);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

export default router;