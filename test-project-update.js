/**
 * Test Project Update
 * Test the project update endpoint with the exact data from the form
 */

import { createClient } from '@supabase/supabase-js';

async function testProjectUpdate() {
  console.log('Testing project update with current form data...');
  
  const testData = {
    project_title: "Δωρεάν κρατική αρωγή για την αποκατάσταση των ζημιών σε κτίρια από την πλημμύρα της 07/07/2020 σε περιοχές του Δ. Τρικκαίων της Π.Ε. Τρικάλων της Π. Θεσσαλίας καθώς και δαπ. μετακ. μηχανικών",
    event_description: "2020 πλημμύρα Τρίκαλα",
    event_year: "2020",
    status: "Συμπληρωμένο",
    budget_e069: 0,
    budget_na271: 0,
    budget_na853: 0
  };

  try {
    const response = await fetch('http://localhost:3000/api/projects/5168550', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Update successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Update failed!');
      console.log('Status:', response.status);
      console.log('Error:', error);
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testProjectUpdate();