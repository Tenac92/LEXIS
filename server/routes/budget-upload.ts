import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../authentication';
import { User } from '@shared/schema';
import { supabase } from '../config/db';
import { storage } from '../storage';
import multer from 'multer';
import * as xlsx from 'xlsx';

const router = Router();

// Route path will be /api/budget/upload
// The /api/budget prefix is added in routes.ts

// Configure multer for memory storage (file will be in buffer)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// Route to upload Excel file and update budget data
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  // Check if user is admin
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This operation requires admin privileges.'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  try {
    console.log('[BudgetUpload] Processing Excel file upload');
    
    // Process the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    
    // Assume the first sheet contains the data
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert worksheet to JSON (array of objects)
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    console.log(`[BudgetUpload] Extracted ${rawData.length} rows from Excel`);

    // Validate and transform the data
    const updates = [];
    const failures = [];

    for (const rawRow of rawData) {
      try {
        // Type assertion to handle the unknown type from xlsx parsing
        const row = rawRow as Record<string, any>;
        
        // Map Excel columns to database fields
        // These keys may need to be adjusted based on the actual Excel column names
        const misKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('mis') || 
          key.toLowerCase() === 'id'
        );
        
        const na853Key = Object.keys(row).find(key => 
          key.toLowerCase().includes('na853') || 
          key.toLowerCase().includes('κωδικός') ||
          key.toLowerCase().includes('kodikos')
        );

        // Find budget-related keys
        const ethsiaPistosiKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('ethsia') || 
          key.toLowerCase().includes('ετήσια') ||
          key.toLowerCase().includes('πίστωση')
        );
        
        const q1Key = Object.keys(row).find(key => 
          key.toLowerCase().includes('q1') || 
          key.toLowerCase().includes('τρίμηνο 1') || 
          key.toLowerCase().includes('α τρίμηνο')
        );
        
        const q2Key = Object.keys(row).find(key => 
          key.toLowerCase().includes('q2') || 
          key.toLowerCase().includes('τρίμηνο 2') || 
          key.toLowerCase().includes('β τρίμηνο')
        );
        
        const q3Key = Object.keys(row).find(key => 
          key.toLowerCase().includes('q3') || 
          key.toLowerCase().includes('τρίμηνο 3') || 
          key.toLowerCase().includes('γ τρίμηνο')
        );
        
        const q4Key = Object.keys(row).find(key => 
          key.toLowerCase().includes('q4') || 
          key.toLowerCase().includes('τρίμηνο 4') || 
          key.toLowerCase().includes('δ τρίμηνο')
        );
        
        const katanomesEtousKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('katanomes') || 
          key.toLowerCase().includes('κατανομές') ||
          key.toLowerCase().includes('συνολικές')
        );
        
        const userViewKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('user') || 
          key.toLowerCase().includes('χρήστη') ||
          key.toLowerCase().includes('διαθέσιμο')
        );

        // Check if required keys exist
        if (!misKey || !na853Key) {
          throw new Error(`Missing required columns MIS or NA853 in row`);
        }

        const mis = row[misKey]?.toString();
        const na853 = row[na853Key]?.toString();

        // Check if MIS and NA853 have values
        if (!mis || !na853) {
          throw new Error(`Missing values for MIS or NA853`);
        }

        // Create update object
        const updateData: Record<string, any> = {
          mis,
          na853,
          data: {
            ethsia_pistosi: ethsiaPistosiKey ? parseFloat(row[ethsiaPistosiKey]?.toString() || '0') : undefined,
            q1: q1Key ? parseFloat(row[q1Key]?.toString() || '0') : undefined,
            q2: q2Key ? parseFloat(row[q2Key]?.toString() || '0') : undefined,
            q3: q3Key ? parseFloat(row[q3Key]?.toString() || '0') : undefined,
            q4: q4Key ? parseFloat(row[q4Key]?.toString() || '0') : undefined,
            katanomes_etous: katanomesEtousKey ? parseFloat(row[katanomesEtousKey]?.toString() || '0') : undefined,
            user_view: userViewKey ? parseFloat(row[userViewKey]?.toString() || '0') : undefined
          }
        };

        // If no budget data was found, use reasonable defaults based on the data available
        if (Object.values(updateData.data).every(val => val === undefined)) {
          // Find any numerical values in the row that might be budget-related
          const numericKeys = Object.keys(row).filter(key => 
            !isNaN(parseFloat(row[key]?.toString() || 'NaN')) && 
            key !== misKey && 
            key !== na853Key
          );

          if (numericKeys.length > 0) {
            // Assign values based on column order (making assumptions)
            const numericValues = numericKeys.map(key => parseFloat(row[key]?.toString() || '0'));
            
            // Assuming the first numeric value might be ethsia_pistosi
            updateData.data.ethsia_pistosi = numericValues[0] || 0;
            
            // If we have at least 4 values, they might be quarters
            if (numericValues.length >= 4) {
              updateData.data.q1 = numericValues[0] || 0;
              updateData.data.q2 = numericValues[1] || 0;
              updateData.data.q3 = numericValues[2] || 0;
              updateData.data.q4 = numericValues[3] || 0;
              
              // Sum of quarters for katanomes_etous
              updateData.data.katanomes_etous = (
                updateData.data.q1 + 
                updateData.data.q2 + 
                updateData.data.q3 + 
                updateData.data.q4
              );
              
              // Same as katanomes_etous for user_view
              updateData.data.user_view = updateData.data.katanomes_etous;
            } else if (numericValues.length > 0) {
              // If we only have one value, use it for everything
              updateData.data.q1 = updateData.data.ethsia_pistosi / 4;
              updateData.data.q2 = updateData.data.ethsia_pistosi / 4;
              updateData.data.q3 = updateData.data.ethsia_pistosi / 4;
              updateData.data.q4 = updateData.data.ethsia_pistosi / 4;
              updateData.data.katanomes_etous = updateData.data.ethsia_pistosi;
              updateData.data.user_view = updateData.data.ethsia_pistosi;
            }
          } else {
            throw new Error(`No budget data found for MIS ${mis}`);
          }
        }

        updates.push(updateData);
      } catch (error) {
        failures.push({
          row: rawRow,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[BudgetUpload] Prepared ${updates.length} updates, encountered ${failures.length} failures`);

    // Process each update sequentially with detailed error tracking
    const results: {
      success: number;
      failures: number;
      errors: string[];
      failedRecords: {
        row: number | any;
        mis?: string;
        na853?: string;
        error: string;
      }[];
    } = {
      success: 0,
      failures: failures.length,
      errors: failures.map(f => f.error).concat([]),
      failedRecords: failures.map(f => {
        let misValue = 'unknown';
        let rowData: any = {};
        
        if (f.row && typeof f.row === 'object') {
          rowData = { ...f.row };
          
          // Try to extract MIS value using different possible keys
          const possibleMisKeys = ['MIS', 'mis', 'Mis', 'κωδικός', 'id', 'ID'];
          for (const key of possibleMisKeys) {
            if (key in f.row && f.row[key]) {
              misValue = String(f.row[key]);
              break;
            }
          }
        }
        
        return {
          row: rowData,
          mis: misValue,
          error: f.error
        };
      })
    };

    // Process updates
    for (const update of updates) {
      try {
        const { mis, na853, data } = update;

        // Check if the record exists
        const { data: existingRecord, error: fetchError } = await supabase
          .from('budget_na853_split')
          .select('*')
          .eq('mis', mis)
          .eq('na853', na853)
          .single();

        // If record doesn't exist, create it
        if (fetchError || !existingRecord) {
          // For new records, ensure user_view is at least equal to katanomes_etous if both are provided
          let initialUserView = data.user_view || 0;
          const initialKatanomesEtous = data.katanomes_etous || 0;
          
          // If user_view is not explicitly set but katanomes_etous is, use katanomes_etous as the user_view
          if (data.user_view === undefined && data.katanomes_etous !== undefined) {
            initialUserView = initialKatanomesEtous;
            console.log(`[BudgetUpload] Setting initial user_view for MIS ${mis} (NA853: ${na853}) to match katanomes_etous: ${initialKatanomesEtous}`);
          }
          
          const { error: insertError } = await supabase
            .from('budget_na853_split')
            .insert({
              mis,
              na853,
              ethsia_pistosi: data.ethsia_pistosi || 0,
              q1: data.q1 || 0,
              q2: data.q2 || 0,
              q3: data.q3 || 0,
              q4: data.q4 || 0,
              katanomes_etous: initialKatanomesEtous,
              user_view: initialUserView,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            throw new Error(`Failed to insert budget split for MIS ${mis}: ${insertError.message}`);
          }

          // Create a budget history entry for the new record
          await storage.createBudgetHistoryEntry({
            mis,
            previous_amount: "0",
            new_amount: initialUserView.toString(),
            change_type: 'import',
            change_reason: `Initial import from Excel for MIS ${mis} (NA853: ${na853}) - Values: ${
              JSON.stringify({
                ethsia_pistosi: data.ethsia_pistosi || 0,
                q1: data.q1 || 0,
                q2: data.q2 || 0,
                q3: data.q3 || 0,
                q4: data.q4 || 0,
                katanomes_etous: initialKatanomesEtous,
                user_view: initialUserView
              })
            }`,
            created_by: req.user?.id?.toString() || undefined
            // Removed metadata field since it's causing schema issues
          });
        } else {
          // Record exists, update it
          // Calculate new values
          const newEthsiaPistosi = data.ethsia_pistosi !== undefined ? data.ethsia_pistosi : existingRecord.ethsia_pistosi;
          const newQ1 = data.q1 !== undefined ? data.q1 : existingRecord.q1;
          const newQ2 = data.q2 !== undefined ? data.q2 : existingRecord.q2;
          const newQ3 = data.q3 !== undefined ? data.q3 : existingRecord.q3;
          const newQ4 = data.q4 !== undefined ? data.q4 : existingRecord.q4;
          const newKatanomesEtous = data.katanomes_etous !== undefined ? data.katanomes_etous : existingRecord.katanomes_etous;
          
          // Special handling for user_view: if katanomes_etous changed, adjust user_view accordingly
          let newUserView = data.user_view !== undefined ? data.user_view : existingRecord.user_view;
          
          // If katanomes_etous has changed, add the difference to user_view
          if (data.katanomes_etous !== undefined && existingRecord.katanomes_etous !== data.katanomes_etous) {
            const katanomesDifference = data.katanomes_etous - existingRecord.katanomes_etous;
            // Add the difference to the current user_view
            newUserView = (existingRecord.user_view || 0) + katanomesDifference;
            console.log(`[BudgetUpload] Adjusting user_view for MIS ${mis} (NA853: ${na853}): katanomes_etous changed by ${katanomesDifference}, new user_view: ${newUserView}`);
          }
          
          const { error: updateError } = await supabase
            .from('budget_na853_split')
            .update({
              ethsia_pistosi: newEthsiaPistosi,
              q1: newQ1,
              q2: newQ2,
              q3: newQ3,
              q4: newQ4,
              katanomes_etous: newKatanomesEtous,
              user_view: newUserView,
              updated_at: new Date().toISOString()
            })
            .eq('mis', mis)
            .eq('na853', na853);

          if (updateError) {
            throw new Error(`Failed to update budget split for MIS ${mis}: ${updateError.message}`);
          }

          // Create a budget history entry for the update
          await storage.createBudgetHistoryEntry({
            mis,
            previous_amount: existingRecord.user_view?.toString() || '0',
            new_amount: newUserView.toString(),
            change_type: 'import',
            change_reason: `Updated from Excel import for MIS ${mis} (NA853: ${na853}) - Updated values: ${
              JSON.stringify({
                ethsia_pistosi: newEthsiaPistosi,
                q1: newQ1,
                q2: newQ2,
                q3: newQ3,
                q4: newQ4,
                katanomes_etous: newKatanomesEtous,
                user_view: newUserView,
                katanomes_adjustment: data.katanomes_etous !== undefined && existingRecord.katanomes_etous !== data.katanomes_etous ? 
                  `Changed by ${data.katanomes_etous - existingRecord.katanomes_etous}` : 'No change'
              })
            }`,
            created_by: req.user?.id?.toString() || undefined
            // Removed metadata field since it's causing schema issues
          });
        }

        results.success++;
      } catch (error) {
        results.failures++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(errorMessage);
        
        // Add detailed error information
        results.failedRecords = results.failedRecords || [];
        results.failedRecords.push({
          row: results.success + results.failures, // Row number in processing sequence
          mis: update?.mis || 'unknown',
          na853: update?.na853 || 'unknown',
          error: errorMessage
        });
        
        // Log the failure for easier debugging
        console.error(`[BudgetUpload] Failed to process MIS ${update?.mis}, NA853 ${update?.na853}: ${errorMessage}`);
      }
    }

    // Return summary of results
    const message = `Processed ${results.success + results.failures} records: ${results.success} succeeded, ${results.failures} failed`;
    console.log(`[BudgetUpload] ${message}`);
    
    return res.json({
      status: results.success > 0,
      message,
      stats: results
    });

  } catch (error) {
    console.error('[BudgetUpload] Error processing file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process the Excel file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;