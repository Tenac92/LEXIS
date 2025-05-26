/**
 * Employee Management Controller
 * Handles all employee-related API operations including CRUD and search functionality
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertEmployeeSchema, type Employee, type InsertEmployee } from '@shared/schema';
import { AuthenticatedRequest } from '../authentication';
import { createLogger } from '../utils/logger';

const logger = createLogger('EmployeesController');
const router = Router();

/**
 * GET /api/employees
 * Get all employees or filter by unit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { unit } = req.query;
    
    let employees: Employee[];
    
    if (unit && typeof unit === 'string') {
      logger.info(`Fetching employees for unit: ${unit}`);
      employees = await storage.getEmployeesByUnit(unit);
    } else {
      logger.info('Fetching all employees');
      employees = await storage.getAllEmployees();
    }
    
    res.json({
      success: true,
      data: employees,
      count: employees.length
    });
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Σφάλμα κατά την ανάκτηση των υπαλλήλων',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/employees/search
 * Search employees by AFM
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { afm } = req.query;
    
    if (!afm || typeof afm !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Το ΑΦΜ είναι υποχρεωτικό για την αναζήτηση'
      });
    }
    
    logger.info(`Searching employees by AFM: ${afm}`);
    const employees = await storage.searchEmployeesByAFM(afm);
    
    res.json({
      success: true,
      data: employees,
      count: employees.length
    });
  } catch (error) {
    logger.error('Error searching employees by AFM:', error);
    res.status(500).json({
      success: false,
      message: 'Σφάλμα κατά την αναζήτηση υπαλλήλων',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/employees
 * Create a new employee
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate the request body
    const validationResult = insertEmployeeSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Μη έγκυρα δεδομένα υπαλλήλου',
        errors: validationResult.error.errors
      });
    }
    
    const employeeData: InsertEmployee = validationResult.data;
    
    logger.info('Creating new employee:', employeeData);
    const newEmployee = await storage.createEmployee(employeeData);
    
    res.status(201).json({
      success: true,
      message: 'Ο υπάλληλος δημιουργήθηκε επιτυχώς',
      data: newEmployee
    });
  } catch (error) {
    logger.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Σφάλμα κατά τη δημιουργία του υπαλλήλου',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/employees/:id
 * Update an existing employee
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeId = parseInt(req.params.id);
    
    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Μη έγκυρο ID υπαλλήλου'
      });
    }
    
    // Validate the request body (partial update allowed)
    const validationResult = insertEmployeeSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Μη έγκυρα δεδομένα υπαλλήλου',
        errors: validationResult.error.errors
      });
    }
    
    const updateData = validationResult.data;
    
    logger.info(`Updating employee ${employeeId}:`, updateData);
    const updatedEmployee = await storage.updateEmployee(employeeId, updateData);
    
    res.json({
      success: true,
      message: 'Ο υπάλληλος ενημερώθηκε επιτυχώς',
      data: updatedEmployee
    });
  } catch (error) {
    logger.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Σφάλμα κατά την ενημέρωση του υπαλλήλου',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/employees/:id
 * Delete an employee
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeId = parseInt(req.params.id);
    
    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Μη έγκυρο ID υπαλλήλου'
      });
    }
    
    logger.info(`Deleting employee ${employeeId}`);
    await storage.deleteEmployee(employeeId);
    
    res.json({
      success: true,
      message: 'Ο υπάλληλος διαγράφηκε επιτυχώς'
    });
  } catch (error) {
    logger.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'Σφάλμα κατά τη διαγραφή του υπαλλήλου',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as employeesRouter };
export default router;