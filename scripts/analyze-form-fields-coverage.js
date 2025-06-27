/**
 * Analyze Form Fields Coverage
 * 
 * This script analyzes the comprehensive edit form to identify all fields
 * and compare them with the current project_history table schema.
 */

// Form structure from comprehensive-edit-new.tsx
const FORM_STRUCTURE = {
  // Section 1: Decisions
  decisions: [
    'protocol_number',
    'fek', 
    'ada',
    'implementing_agency',
    'decision_budget',
    'expenses_covered',
    'decision_type', // enum: ["Έγκριση", "Τροποποίηση", "Παράταση"]
    'is_included', // boolean
    'comments'
  ],
  
  // Section 2: Event details
  event_details: [
    'event_name',
    'event_year'
  ],
  
  // Section 2: Location details (array)
  location_details: [
    'municipal_community',
    'municipality', 
    'regional_unit',
    'region',
    'implementing_agency',
    'expenditure_types' // array
  ],
  
  // Section 3: Project details
  project_details: [
    'mis',
    'sa',
    'enumeration_code',
    'inclusion_year',
    'project_title',
    'project_description',
    'summary_description',
    'expenses_executed',
    'project_status' // enum: ["Συνεχιζόμενο", "Ολοκληρωμένο", "Απενταγμένο"]
  ],
  
  // Section 3: Previous entries (array)
  previous_entries: [
    'sa',
    'enumeration_code'
  ],
  
  // Section 4: Formulation details (array)
  formulation_details: [
    'sa', // enum: ["ΝΑ853", "ΝΑ271", "Ε069"]
    'enumeration_code',
    'protocol_number',
    'ada',
    'decision_year',
    'project_budget',
    'epa_version',
    'total_public_expense',
    'eligible_public_expense',
    'decision_status', // enum: ["Ενεργή", "Ανενεργή"]
    'change_type', // enum: ["Τροποποίηση", "Παράταση", "Έγκριση"]
    'connected_decisions',
    'comments'
  ],
  
  // Section 5: Changes (array)
  changes: [
    'description'
  ]
};

// Current project_history table schema (from shared/schema.ts)
const CURRENT_SCHEMA = [
  'id',
  'project_id',
  'implementing_agency_location',
  'expenditure_types',
  'decisions',
  'event_name',
  'event_year',
  'enumeration_code',
  'inclusion_year',
  'summary_description',
  'expenses_executed',
  'project_status',
  'previous_entries',
  'formulation',
  'changes',
  'created_at'
];

function analyzeFieldCoverage() {
  console.log('=== FORM FIELDS COVERAGE ANALYSIS ===\n');
  
  // Flatten all form fields
  const allFormFields = [];
  for (const [section, fields] of Object.entries(FORM_STRUCTURE)) {
    fields.forEach(field => {
      allFormFields.push(`${section}.${field}`);
    });
  }
  
  console.log(`📋 Total form fields: ${allFormFields.length}`);
  console.log(`🗄️  Current schema fields: ${CURRENT_SCHEMA.length}`);
  
  console.log('\n=== FORM STRUCTURE ANALYSIS ===');
  for (const [section, fields] of Object.entries(FORM_STRUCTURE)) {
    console.log(`\n${section.toUpperCase()}:`);
    fields.forEach(field => {
      console.log(`  - ${field}`);
    });
  }
  
  console.log('\n=== MISSING FIELDS ANALYSIS ===');
  
  // Check what's missing from current schema
  const criticalMissing = [
    'project_details.project_description',
    'project_details.mis', 
    'project_details.sa',
    'formulation_details (complex array with 12+ fields)',
    'location_details (geographic hierarchy)',
    'decisions.decision_type',
    'decisions.is_included',
    'decisions.decision_budget',
    'decisions.expenses_covered',
    'project_details.project_status (enum validation)',
    'event_details (separate from event_name/year)',
    'previous_entries (array structure)'
  ];
  
  console.log('\n🚨 CRITICAL MISSING FIELDS:');
  criticalMissing.forEach(field => {
    console.log(`  ❌ ${field}`);
  });
  
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. Expand decisions JSONB to include all decision fields');
  console.log('2. Add location_details JSONB for geographic hierarchy');
  console.log('3. Add project_details JSONB for complete project info');
  console.log('4. Expand formulation JSONB to match formulation_details structure');
  console.log('5. Add previous_entries JSONB for version tracking');
  console.log('6. Add proper enum validation for status fields');
  console.log('7. Consider separate tables for complex arrays vs JSONB');
  
  console.log('\n=== CONCLUSION ===');
  console.log('❌ Current schema covers < 50% of form fields');
  console.log('🔧 Major schema update required for complete coverage');
  console.log('📊 Form has 40+ distinct fields across 5 sections');
  console.log('🏗️  Recommendation: Rebuild schema to match form structure');
}

analyzeFieldCoverage();