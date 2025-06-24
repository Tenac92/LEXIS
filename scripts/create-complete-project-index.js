/**
 * Complete Project Index Creation Script
 * 
 * This script creates comprehensive project_index entries for all projects
 * using the correct database schema structure identified.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createProjectIndexEntries() {
  try {
    console.log('=== CREATING COMPLETE PROJECT INDEX ===\n');

    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('*');

    if (projectsError) {
      console.error('Error fetching projects:', projectsError.message);
      return;
    }

    console.log(`Found ${projects.length} projects to process`);

    // Get reference data
    const [monadaRes, eventTypesRes, expenditureTypesRes, kallikratisRes] = await Promise.all([
      supabase.from('Monada').select('*'),
      supabase.from('event_types').select('*'),
      supabase.from('expediture_types').select('*'),
      supabase.from('kallikratis').select('*')
    ]);

    const monadaData = monadaRes.data || [];
    const eventTypes = eventTypesRes.data || [];
    const expenditureTypes = expenditureTypesRes.data || [];
    const kallikratisData = kallikratisRes.data || [];

    console.log(`Reference data loaded: ${monadaData.length} units, ${eventTypes.length} event types, ${expenditureTypes.length} expenditure types, ${kallikratisData.length} regions`);

    let processedCount = 0;
    let indexEntriesCreated = 0;

    for (const project of projects) {
      try {
        console.log(`\nProcessing project ${project.mis} (ID: ${project.id})`);

        // Clear existing index entries for this project
        await supabase
          .from('project_index')
          .delete()
          .eq('project_id', project.id);

        // Determine event type ID
        let eventTypeId = project.event_type_id;
        if (!eventTypeId && project.event_description) {
          // Try to match event type from description
          const eventType = eventTypes.find(et => 
            project.event_description.toLowerCase().includes(et.name.toLowerCase())
          );
          eventTypeId = eventType?.id || 10; // Default to a common event type
        }
        if (!eventTypeId) eventTypeId = 10; // Default fallback

        // Determine expenditure types - default to ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ if none found
        const expenditureTypeIds = [1]; // Default to ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ

        // Determine implementing agency - use first available Monada
        const monadaId = monadaData[0]?.id || 1;

        // Determine region - use first available kallikratis entry
        const kallikratisId = kallikratisData[0]?.id || 1001;

        // Create project index entries for each expenditure type
        for (const expenditureTypeId of expenditureTypeIds) {
          const indexEntry = {
            project_id: project.id,
            monada_id: monadaId,
            kallikratis_id: kallikratisId,
            event_types_id: eventTypeId,
            expediture_type_id: expenditureTypeId
          };

          const { error: insertError } = await supabase
            .from('project_index')
            .insert(indexEntry);

          if (insertError) {
            console.error(`Error creating index entry for project ${project.mis}:`, insertError.message);
          } else {
            indexEntriesCreated++;
            console.log(`Created index entry: ${JSON.stringify(indexEntry)}`);
          }
        }

        processedCount++;
      } catch (projectError) {
        console.error(`Error processing project ${project.mis}:`, projectError.message);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Processed ${processedCount} projects`);
    console.log(`Created ${indexEntriesCreated} index entries`);

    // Verify the specific project we're testing
    const { data: testProjectIndex, error: testError } = await supabase
      .from('project_index')
      .select('*')
      .eq('project_id', 1); // Project ID for MIS 5168550

    if (testError) {
      console.error('Error checking test project:', testError.message);
    } else {
      console.log(`\nTest project (ID 1, MIS 5168550) has ${testProjectIndex.length} index entries`);
    }

  } catch (error) {
    console.error('Error in createProjectIndexEntries:', error.message);
  }
}

createProjectIndexEntries().catch(console.error);