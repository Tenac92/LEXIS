import { Router, Request, Response } from 'express';
import { authenticateSession, AuthenticatedRequest } from '../authentication';
import { User } from '@shared/schema';
import { supabase } from '../config/db';
import { storage } from '../storage';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import { BudgetService } from '../services/budgetService';

// Helper function to parse numerical values with European number formatting (e.g., 22.000,00 -> 22000.00)
function parseEuropeanNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  
  // Convert to string if it's not already
  let strValue = value.toString().trim();
  
  // Return 0 for empty strings
  if (!strValue) return 0;
  
  // Log the original value for debugging
  console.log(`[parseEuropeanNumber] Original value: "${strValue}"`);
  
  // Check if the string has European number formatting (period as thousands separator, comma as decimal separator)
  // Example: "22.000,00" should be converted to 22000.00
  if (strValue.includes('.') && strValue.includes(',')) {
    // Remove all dots (thousands separators) and replace comma with decimal point
    strValue = strValue.replace(/\./g, '').replace(',', '.');
    const result = parseFloat(strValue);
    console.log(`[parseEuropeanNumber] Parsed European format (dots and commas): "${strValue}" -> ${result}`);
    return result;
  }
  
  // If it's just a comma as decimal separator (e.g., "22,50")
  if (strValue.includes(',') && !strValue.includes('.')) {
    strValue = strValue.replace(',', '.');
    const result = parseFloat(strValue);
    console.log(`[parseEuropeanNumber] Parsed European format (comma only): "${strValue}" -> ${result}`);
    return result;
  }
  
  // For values that might have thousand separators but no decimal part (e.g., "22.000")
  if (strValue.includes('.') && !/\d+\.\d+/.test(strValue)) {
    strValue = strValue.replace(/\./g, '');
    const result = parseFloat(strValue);
    console.log(`[parseEuropeanNumber] Parsed European format (dots only): "${strValue}" -> ${result}`);
    return result;
  }
  
  // Default case: try regular parseFloat
  const result = parseFloat(strValue);
  console.log(`[parseEuropeanNumber] Parsed standard format: "${strValue}" -> ${result}`);
  return result;
}

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
router.post('/', authenticateSession, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
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
    let rawData: any[] = [];
    const fileName = req.file.originalname.toLowerCase();
    
    // Check if the file is CSV or Excel based on extension
    if (fileName.endsWith('.csv')) {
      console.log('[BudgetUpload] Processing CSV file upload');
      
      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      rawData = parse(csvContent, {
        columns: true, // Use first row as headers
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow rows with different number of columns
      });
      console.log(`[BudgetUpload] Extracted ${rawData.length} rows from CSV`);
    } else {
      console.log('[BudgetUpload] Processing Excel file upload');
      
      // Process the Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      
      // Assume the first sheet contains the data
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert worksheet to JSON (array of objects)
      rawData = xlsx.utils.sheet_to_json(worksheet);
      console.log(`[BudgetUpload] Extracted ${rawData.length} rows from Excel`);
    }

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
            ethsia_pistosi: ethsiaPistosiKey ? parseEuropeanNumber(row[ethsiaPistosiKey]) : undefined,
            q1: q1Key ? parseEuropeanNumber(row[q1Key]) : undefined,
            q2: q2Key ? parseEuropeanNumber(row[q2Key]) : undefined,
            q3: q3Key ? parseEuropeanNumber(row[q3Key]) : undefined,
            q4: q4Key ? parseEuropeanNumber(row[q4Key]) : undefined,
            katanomes_etous: katanomesEtousKey ? parseEuropeanNumber(row[katanomesEtousKey]) : undefined,
            user_view: userViewKey ? parseEuropeanNumber(row[userViewKey]) : undefined
          }
        };

        // If no budget data was found, use reasonable defaults based on the data available
        if (Object.values(updateData.data).every(val => val === undefined)) {
          // Find any numerical values in the row that might be budget-related
          // Use parseEuropeanNumber to properly handle EU number format (e.g., "22.000,00")
          const numericKeys = Object.keys(row).filter(key => {
            // Attempt to parse the value as a European number format
            const value = parseEuropeanNumber(row[key]);
            // Check if the parsing resulted in a valid number
            return !isNaN(value) && key !== misKey && key !== na853Key;
          });

          if (numericKeys.length > 0) {
            // Assign values based on column order (making assumptions)
            // Use parseEuropeanNumber to properly handle EU number format (e.g., "22.000,00")
            const numericValues = numericKeys.map(key => parseEuropeanNumber(row[key]));
            
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
              
              // DO NOT SET user_view during admin uploads - it should only be changed by document creation
              // updateData.data.user_view = updateData.data.katanomes_etous; -- REMOVED
            } else if (numericValues.length > 0) {
              // If we only have one value, use it for everything
              updateData.data.q1 = updateData.data.ethsia_pistosi / 4;
              updateData.data.q2 = updateData.data.ethsia_pistosi / 4;
              updateData.data.q3 = updateData.data.ethsia_pistosi / 4;
              updateData.data.q4 = updateData.data.ethsia_pistosi / 4;
              updateData.data.katanomes_etous = updateData.data.ethsia_pistosi;
              // DO NOT SET user_view during admin uploads - it should only be changed by document creation
              // updateData.data.user_view = updateData.data.ethsia_pistosi; -- REMOVED
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
            if (key in f.row && (f.row as any)[key]) {
              misValue = String((f.row as any)[key]);
              break;
            }
          }
        }
        
        return {
          row: rowData,
          mis: misValue,
          na853: 'unknown',
          error: f.error
        };
      })
    };

    // Process updates
    for (const update of updates) {
      try {
        const { mis, na853, data } = update;

        // Try to find the project_id by mis or na853
        let projectId = null;
        
        // Try to find project by MIS first
        const { data: projectByMis, error: misError } = await supabase
          .from('projects')
          .select('id')
          .eq('mis', parseInt(mis))
          .single();
          
        if (!misError && projectByMis) {
          projectId = projectByMis.id;
        } else {
          // Try to find project by NA853
          const { data: projectByNa853, error: na853Error } = await supabase
            .from('projects')
            .select('id')
            .eq('na853', na853)
            .single();
            
          if (!na853Error && projectByNa853) {
            projectId = projectByNa853.id;
          }
        }
        
        // Log whether we found a project or not
        if (projectId) {
          console.log(`[BudgetUpload] Found project ID ${projectId} for MIS ${mis} (NA853: ${na853})`);
        } else {
          console.log(`[BudgetUpload] No project found for MIS ${mis} (NA853: ${na853}), creating budget record without project_id`);
        }

        // Check if the record exists - use different lookup depending on whether we have project_id
        let existingRecord = null;
        let fetchError = null;
        
        if (projectId) {
          // If we have a project_id, look up by project_id
          const { data, error } = await supabase
            .from('project_budget')
            .select('*')
            .eq('project_id', projectId)
            .single();
          existingRecord = data;
          fetchError = error;
        } else {
          // If no project_id, look up by mis and na853
          const { data, error } = await supabase
            .from('project_budget')
            .select('*')
            .eq('mis', parseInt(mis))
            .eq('na853', na853)
            .single();
          existingRecord = data;
          fetchError = error;
        }

        // If record doesn't exist, create it
        if (fetchError || !existingRecord) {
          // For new records, initialize user_view to 0 (not to katanomes_etous as before)
          // user_view should start at 0 and only be increased by document creation
          let initialUserView = 0;
          const initialKatanomesEtous = data.katanomes_etous || 0;
          
          // DO NOT set user_view to match katanomes_etous - this was the previous incorrect behavior
          console.log(`[BudgetUpload] Setting initial user_view for new MIS ${mis} (NA853: ${na853}, Project ID: ${projectId}) to 0 (not matching katanomes_etous)`);
          
          
          // Prepare insert data with optional project_id
          // NOTE: last_quarter_check is NOT set during import - let the application handle quarter transitions naturally
          const insertData: any = {
            mis: parseInt(mis),
            na853,
            ethsia_pistosi: data.ethsia_pistosi || 0,
            q1: data.q1 || 0,
            q2: data.q2 || 0,
            q3: data.q3 || 0,
            q4: data.q4 || 0,
            katanomes_etous: initialKatanomesEtous,
            user_view: initialUserView,
            created_at: new Date().toISOString()
          };
          
          console.log(`[BudgetUpload] Creating new budget record MIS ${mis} without last_quarter_check - application will handle quarter transitions automatically`);
          
          // Only include project_id if we found a matching project
          if (projectId) {
            insertData.project_id = projectId;
          }

          const { error: insertError } = await supabase
            .from('project_budget')
            .insert(insertData);

          if (insertError) {
            throw new Error(`Failed to insert budget split for MIS ${mis}: ${insertError.message}`);
          }

          // Create a budget history entry for the new record only if we have a project_id
          if (projectId) {
            await storage.createBudgetHistoryEntry({
              project_id: projectId,
              previous_amount: '0',
              new_amount: String(initialKatanomesEtous),
              change_type: 'import',
              change_reason: `Initial import from Excel for MIS ${mis} (NA853: ${na853})`,
              document_id: null
            });
          }
        } else {
          // Record exists, update it
          
          // First, calculate budget indicators before update to save in sum JSONB field
          // Formula: available_budget = katanomes_etous - user_view
          // Formula: quarter_available = current_q - user_view
          // Formula: yearly_available = ethsia_pistosi - user_view
          
          // Get current quarter
          const currentDate = new Date();
          const currentMonth = currentDate.getMonth() + 1;
          const currentQuarterNumber = Math.ceil(currentMonth / 3);
          const quarterKey = `q${currentQuarterNumber}` as 'q1' | 'q2' | 'q3' | 'q4';
          
          // Get current quarter value
          let currentQuarterValue;
          switch(quarterKey) {
            case 'q1': currentQuarterValue = existingRecord.q1 || 0; break;
            case 'q2': currentQuarterValue = existingRecord.q2 || 0; break;
            case 'q3': currentQuarterValue = existingRecord.q3 || 0; break;
            case 'q4': currentQuarterValue = existingRecord.q4 || 0; break;
            default: currentQuarterValue = 0;
          }
          
          // Calculate budget indicators before update
          const userViewBeforeUpdate = existingRecord.user_view || 0;
          const katanomesEtousBeforeUpdate = existingRecord.katanomes_etous || 0;
          const ethsiaPistosiBeforeUpdate = existingRecord.ethsia_pistosi || 0;
          
          const availableBudgetBeforeUpdate = Math.max(0, katanomesEtousBeforeUpdate - userViewBeforeUpdate);
          const quarterAvailableBeforeUpdate = Math.max(0, currentQuarterValue - userViewBeforeUpdate);
          const yearlyAvailableBeforeUpdate = Math.max(0, ethsiaPistosiBeforeUpdate - userViewBeforeUpdate);
          
          // Prepare sum JSONB to store pre-update values
          const budgetSumBeforeUpdate = {
            available_budget: availableBudgetBeforeUpdate,
            quarter_available: quarterAvailableBeforeUpdate,
            yearly_available: yearlyAvailableBeforeUpdate,
            katanomes_etous: katanomesEtousBeforeUpdate,
            ethsia_pistosi: ethsiaPistosiBeforeUpdate,
            user_view: userViewBeforeUpdate,
            current_quarter: currentQuarterNumber,
            updated_at: new Date().toISOString()
          };
          
          // Now calculate new values for the update
          const newEthsiaPistosi = data.ethsia_pistosi !== undefined ? data.ethsia_pistosi : existingRecord.ethsia_pistosi;
          const newQ1 = data.q1 !== undefined ? data.q1 : existingRecord.q1;
          const newQ2 = data.q2 !== undefined ? data.q2 : existingRecord.q2;
          const newQ3 = data.q3 !== undefined ? data.q3 : existingRecord.q3;
          const newQ4 = data.q4 !== undefined ? data.q4 : existingRecord.q4;
          const newKatanomesEtous = data.katanomes_etous !== undefined ? data.katanomes_etous : existingRecord.katanomes_etous;
          
          // Special handling for user_view: DO NOT change user_view from admin uploads
          // user_view is only increased by document creation, not by admin uploads
          let newUserView = existingRecord.user_view;
          
          // Calculate katanomes_etous difference for notification resolution, but DON'T change user_view
          let katanomesDifference = 0;
          if (data.katanomes_etous !== undefined && existingRecord.katanomes_etous !== data.katanomes_etous) {
            katanomesDifference = data.katanomes_etous - existingRecord.katanomes_etous;
            console.log(`[BudgetUpload] katanomes_etous changed by ${katanomesDifference} for MIS ${mis} (NA853: ${na853}), user_view remains unchanged at: ${newUserView}`);
          }
          
          // NOTE: last_quarter_check is NOT updated during import - let the application handle quarter transitions
          // The Excel import only updates the actual budget allocation data
          console.log(`[BudgetUpload] Updating budget allocation data for MIS ${mis} - application will handle quarter transitions based on spending patterns`);
          
          // Prepare the update with the sum field to store budget indicators
          let updateQuery = supabase
            .from('project_budget')
            .update({
              ethsia_pistosi: newEthsiaPistosi,
              q1: newQ1,
              q2: newQ2,
              q3: newQ3,
              q4: newQ4,
              katanomes_etous: newKatanomesEtous,
              user_view: newUserView,
              // NOTE: last_quarter_check is intentionally NOT updated - preserve existing application state
              sum: budgetSumBeforeUpdate, // Store the pre-update state
              updated_at: new Date().toISOString()
            });

          // Use different where clause depending on whether we have project_id
          if (projectId) {
            updateQuery = updateQuery.eq('project_id', projectId);
          } else {
            updateQuery = updateQuery.eq('mis', parseInt(mis)).eq('na853', na853);
          }

          const { error: updateError } = await updateQuery;

          if (updateError) {
            throw new Error(`Failed to update budget split for MIS ${mis}: ${updateError.message}`);
          }

          // Create a budget history entry for the update only if we have a project_id
          if (projectId) {
            await storage.createBudgetHistoryEntry({
              project_id: projectId,
              previous_amount: String(katanomesEtousBeforeUpdate),
              new_amount: String(newKatanomesEtous),
              change_type: 'import',
              change_reason: `Updated from Excel import for MIS ${mis} (NA853: ${na853})`,
              document_id: null
            });
          }
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
          mis: String(update?.mis || 'unknown'),
          na853: String(update?.na853 || 'unknown'),
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