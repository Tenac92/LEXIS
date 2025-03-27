/**
 * SDEGDaefk Controller
 * 
 * Handles all special routes and functionality specific to the sdegdaefk.gr domain.
 * Centralizes logic for browser-specific requests and diagnostic routes.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { log } from '../vite';

// Create the router
export const router = Router();

// Export the router as default
export default router;

/**
 * GET /sdegdaefk-gr
 * Browser-specific handler for the sdegdaefk.gr domain root
 */
router.get('/', (req: Request, res: Response) => {
  // This route provides a default response for browser-based sdegdaefk.gr requests
  log(`[SDEGDaefk] Browser-based request to sdegdaefk.gr root path`);
  
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>ΣΔΕΓΔΑΕΦΚ - Σύστημα Διαχείρισης Εγγράφων</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          p { line-height: 1.5; color: #666; }
          footer { margin-top: 30px; text-align: center; font-size: 0.8rem; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>ΣΔΕΓΔΑΕΦΚ</h1>
          <p>Σύστημα Διαχείρισης Εγγράφων Γενικής Διεύθυνσης Απόδοσης και Ευρωπαϊκού Φορέα Κοινωνικής Ασφάλισης</p>
          <p>Είστε στη διεύθυνση <strong>sdegdaefk.gr</strong>. Αυτή η διεύθυνση χρησιμοποιείται αποκλειστικά για API κλήσεις και δεν προσφέρει περιβάλλον χρήστη.</p>
          <p>Για να συνδεθείτε στο σύστημα, επισκεφθείτε την κεντρική σελίδα της εφαρμογής.</p>
          <footer>ΣΔΕΓΔΑΕΦΚ © ${new Date().getFullYear()}</footer>
        </div>
      </body>
    </html>
  `);
});

/**
 * GET /sdegdaefk-database-check
 * Check database connection status for the sdegdaefk.gr domain
 */
router.get('/database-check', async (req: Request, res: Response) => {
  try {
    log(`[SDEGDaefk] Database connection check initiated`);
    
    // Simple database connection check
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    const timeString = result.rows[0].current_time.toISOString();
    
    log(`[SDEGDaefk] Database connection check successful: ${timeString}`);
    
    return res.status(200).json({
      status: 'ok',
      message: 'Database connection is working',
      timestamp: timeString
    });
  } catch (error: any) {
    log(`[SDEGDaefk] Database connection check failed: ${error.message}`, 'error');
    
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});