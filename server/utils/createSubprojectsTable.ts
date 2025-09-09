import { supabase } from '../config/db';

export async function createSubprojectsTable() {
  try {
    console.log('[CreateSubprojects] Creating project_subprojects table if it does not exist...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS project_subprojects (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subproject_code VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        yearly_budgets JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, subproject_code)
      );
    `;

    const { error } = await supabase.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });

    if (error) {
      console.error('[CreateSubprojects] Error creating table:', error);
      // Try alternative method using direct SQL execution
      const { error: directError } = await supabase
        .from('project_subprojects')
        .select('id')
        .limit(1);
        
      if (directError && directError.code === '42P01') {
        // Table doesn't exist, but we can't create it with exec_sql
        console.warn('[CreateSubprojects] Table does not exist and exec_sql failed. Manual table creation needed.');
        return false;
      }
    } else {
      console.log('[CreateSubprojects] Table created successfully or already exists');
    }

    // Insert sample data if table is empty
    const { data: existingData, error: checkError } = await supabase
      .from('project_subprojects')
      .select('id')
      .limit(1);

    if (!checkError && (!existingData || existingData.length === 0)) {
      console.log('[CreateSubprojects] Inserting sample subproject data...');
      
      const sampleSubprojects = [
        {
          project_id: 124,
          title: 'Υποέργο Α: Μελέτες Περιβάλλοντος',
          description: 'Περιβαλλοντικές μελέτες και αξιολογήσεις για το έργο',
          subproject_code: 'ENV-2024-01',
          status: 'active',
          yearly_budgets: {
            '2024': { sdd: 25000, edd: 15000 },
            '2025': { sdd: 30000, edd: 20000 }
          }
        },
        {
          project_id: 124,
          title: 'Υποέργο Β: Τεχνικές Μελέτες',
          description: 'Τεχνικές μελέτες και σχεδιασμός έργου',
          subproject_code: 'TECH-2024-01',
          status: 'active',
          yearly_budgets: {
            '2024': { sdd: 50000, edd: 30000 },
            '2025': { sdd: 45000, edd: 35000 }
          }
        },
        {
          project_id: 124,
          title: 'Υποέργο Γ: Κατασκευή Φάση 1',
          description: 'Πρώτη φάση κατασκευής του έργου',
          subproject_code: 'CONST-2024-01',
          status: 'planning',
          yearly_budgets: {
            '2024': { sdd: 75000, edd: 45000 },
            '2025': { sdd: 100000, edd: 80000 }
          }
        }
      ];

      const { error: insertError } = await supabase
        .from('project_subprojects')
        .insert(sampleSubprojects);

      if (insertError) {
        console.error('[CreateSubprojects] Error inserting sample data:', insertError);
      } else {
        console.log('[CreateSubprojects] Sample data inserted successfully');
      }
    }

    return true;
  } catch (error) {
    console.error('[CreateSubprojects] Unexpected error:', error);
    return false;
  }
}