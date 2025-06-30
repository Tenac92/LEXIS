/**
 * CSV Structure Validation Script
 * 
 * This script validates the CSV structure and provides insights about the data
 * before running the full import process.
 */

import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

/**
 * Analyze CSV structure and content
 */
async function validateCSVStructure() {
  console.log('🔍 Analyzing CSV structure...\n');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'Στοιχεία κατάρτισης έργων - Στοιχεία έργων_1751262084262.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    return;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  return new Promise((resolve, reject) => {
    const results = [];
    const columnStats = {};
    
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      quote: '"',
      escape: '"'
    })
    .on('data', (row) => {
      results.push(row);
      
      // Collect column statistics
      Object.keys(row).forEach(col => {
        if (!columnStats[col]) {
          columnStats[col] = {
            name: col,
            nonEmptyCount: 0,
            uniqueValues: new Set(),
            sampleValues: []
          };
        }
        
        const value = row[col];
        if (value && value.trim()) {
          columnStats[col].nonEmptyCount++;
          columnStats[col].uniqueValues.add(value);
          
          if (columnStats[col].sampleValues.length < 5) {
            columnStats[col].sampleValues.push(value);
          }
        }
      });
    })
    .on('end', () => {
      console.log(`📊 CSV Analysis Results:`);
      console.log(`Total rows: ${results.length}\n`);
      
      console.log('📋 Column Analysis:');
      console.log('='.repeat(80));
      
      Object.values(columnStats).forEach(stat => {
        console.log(`\n${stat.name}:`);
        console.log(`  - Non-empty values: ${stat.nonEmptyCount}/${results.length} (${((stat.nonEmptyCount/results.length)*100).toFixed(1)}%)`);
        console.log(`  - Unique values: ${stat.uniqueValues.size}`);
        console.log(`  - Sample values:`);
        stat.sampleValues.forEach((val, i) => {
          const truncated = val.length > 100 ? val.substring(0, 100) + '...' : val;
          console.log(`    ${i+1}. ${truncated}`);
        });
      });
      
      console.log('\n🔍 Data Quality Analysis:');
      console.log('='.repeat(80));
      
      // Check for required fields
      const requiredFields = ['MIS', 'NA853', 'Περιγραφή Συμβάντος', 'Τίτλος έργου'];
      requiredFields.forEach(field => {
        const stat = columnStats[field];
        if (stat) {
          const completeness = (stat.nonEmptyCount / results.length) * 100;
          console.log(`✓ ${field}: ${completeness.toFixed(1)}% complete`);
        } else {
          console.log(`❌ ${field}: Column not found`);
        }
      });
      
      // Check for data patterns
      console.log('\n📈 Data Patterns:');
      console.log('='.repeat(80));
      
      // MIS codes
      if (columnStats['MIS']) {
        const misValues = Array.from(columnStats['MIS'].uniqueValues);
        console.log(`MIS codes: ${misValues.length} unique values`);
        console.log(`  - Range: ${Math.min(...misValues.map(v => parseInt(v)))} to ${Math.max(...misValues.map(v => parseInt(v)))}`);
      }
      
      // Budget amounts
      const budgetFields = ['Προϋπολογισμός έργου στο ΠΔΕ Ε069 (τελευταία κατάρτιση)',
                           'Προϋπολογισμός έργου στο ΠΔΕ ΝΑ271 (τελευταία κατάρτιση)',
                           'Προϋπολογισμός έργου στο ΠΔΕ ΝΑ853 (τελευταία κατάρτιση)'];
      
      budgetFields.forEach(field => {
        const stat = columnStats[field];
        if (stat) {
          console.log(`${field}: ${stat.nonEmptyCount} values`);
        }
      });
      
      // Geographic data
      const geoFields = ['Περιφέρεια', 'Περιφερειακή ενότητα', 'Δήμος'];
      geoFields.forEach(field => {
        const stat = columnStats[field];
        if (stat) {
          console.log(`${field}: ${stat.uniqueValues.size} unique values`);
        }
      });
      
      // Implementing agencies
      if (columnStats['Φορέας υλοποίησης']) {
        const agencies = Array.from(columnStats['Φορέας υλοποίησης'].uniqueValues);
        console.log(`\nImplementing Agencies (${agencies.length} unique):`);
        agencies.slice(0, 10).forEach(agency => {
          console.log(`  - ${agency}`);
        });
        if (agencies.length > 10) {
          console.log(`  ... and ${agencies.length - 10} more`);
        }
      }
      
      // Expenditure types
      if (columnStats['Είδος δαπάνης που προκαλείται']) {
        const expTypes = Array.from(columnStats['Είδος δαπάνης που προκαλείται'].uniqueValues);
        console.log(`\nExpenditure Types (${expTypes.length} unique):`);
        expTypes.slice(0, 10).forEach(type => {
          console.log(`  - ${type}`);
        });
        if (expTypes.length > 10) {
          console.log(`  ... and ${expTypes.length - 10} more`);
        }
      }
      
      console.log('\n✅ CSV validation completed');
      resolve();
    })
    .on('error', (error) => {
      console.error('❌ CSV parsing error:', error);
      reject(error);
    });
  });
}

// Run the validation
validateCSVStructure().catch(console.error);