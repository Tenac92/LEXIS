/**
 * Test script to verify the public units API
 */
import postgres from 'postgres';

// Use the DATABASE_URL environment variable
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL environment variable not set');
  process.exit(1);
}

const sql = postgres(url, { ssl: { rejectUnauthorized: false }});

async function getUnits() {
  try {
    console.log('Connecting to database to fetch units directly...');
    
    // Query Monada table for units (similar to the /api/public/units endpoint)
    const unitsData = await sql`SELECT unit, unit_name FROM "Monada"`;
    
    console.log('Raw units data from database:');
    console.log(unitsData.slice(0, 5));
    
    // Transform data to match client expectations (like in the API)
    const transformedUnits = unitsData.map(unit => {
      // Handle the case where unit_name might be an object or a string
      let unitName = "";
      if (typeof unit.unit_name === "object" && unit.unit_name !== null) {
        // Extract name property if it's an object
        unitName = unit.unit_name.name || "";
      } else {
        // Use directly if it's a string
        unitName = unit.unit_name || "";
      }
      
      return {
        id: unit.unit,
        name: unitName
      };
    });
    
    console.log('\nTransformed units data (first 5):');
    console.log(transformedUnits.slice(0, 5));
    console.log(`\nTotal units: ${transformedUnits.length}`);
    
  } catch (error) {
    console.error('Error fetching units:', error);
  } finally {
    // Close the connection
    await sql.end();
  }
}

getUnits();