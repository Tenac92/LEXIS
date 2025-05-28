/**
 * Unit-Based Access Control Middleware
 * Ensures users can only access data for their assigned units
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../authentication';

/**
 * Get unit abbreviation from full unit name
 */
export async function getUnitAbbreviation(fullUnitName: string): Promise<string> {
  const unitMappings: Record<string, string> = {
    'ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΕΛΛΑΔΟΣ': 'ΔΑΕΦΚ-ΔΕ',
    'ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΑΙΓΑΙΟΥ ΚΑΙ ΚΡΗΤΗΣ': 'ΔΑΕΦΚ-ΑΚ',
    'ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΒΟΡΕΙΟΥ ΕΛΛΑΔΟΣ': 'ΔΑΕΦΚ-ΒΕ',
    'ΓΕΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ': 'ΓΔΑΕΦΚ',
    'ΤΟΜΕΑΣ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΔΥΤΙΚΗΣ ΑΤΤΙΚΗΣ': 'ΤΑΕΦΚ-ΔΑ',
    'ΤΟΜΕΑΣ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΕΠΙΠΤΩΣΕΩΝ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ': 'ΤΑΕΦΚ-ΑΑ'
  };
  
  return unitMappings[fullUnitName] || fullUnitName;
}

/**
 * Middleware to ensure users can only access data from their assigned units
 */
export function enforceUnitAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      message: 'Μη εξουσιοδοτημένη πρόσβαση'
    });
  }

  // Admins can access all units
  if (req.user.role === 'admin') {
    return next();
  }

  // Regular users must have assigned units
  if (!req.user.units || req.user.units.length === 0) {
    return res.status(403).json({
      message: 'Δεν έχετε εκχωρημένες μονάδες'
    });
  }

  // Add user's units to request for filtering
  req.userUnits = req.user.units;
  
  next();
}

/**
 * Filter query parameters to only include user's units
 */
export function filterByUserUnits(query: any, userUnits: string[]): any {
  const filteredQuery = { ...query };
  
  // If unit is specified in query, ensure it's in user's units
  if (filteredQuery.unit && !userUnits.includes(filteredQuery.unit)) {
    filteredQuery.unit = userUnits[0]; // Default to first unit
  }
  
  // If no unit specified, default to user's first unit
  if (!filteredQuery.unit) {
    filteredQuery.unit = userUnits[0];
  }
  
  return filteredQuery;
}

/**
 * Add unit filtering to database queries
 */
export function addUnitFilter(baseQuery: any, userUnits: string[]) {
  return baseQuery.in('unit', userUnits);
}

// Extend the AuthenticatedRequest interface
declare module '../authentication' {
  interface AuthenticatedRequest {
    userUnits?: string[];
  }
}