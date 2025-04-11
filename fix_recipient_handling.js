/**
 * Fix recipient handling in DocumentFormatter.ts
 * This script updates the handling of recipient data in both locations to properly handle empty values
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(process.cwd(), 'server/utils/DocumentFormatter.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// The replacement pattern
const oldPattern = `    recipients.forEach((recipient, index) => {
      // Check if fathername exists and is not empty
      const fullName = !recipient.fathername || recipient.fathername.trim() === ""
        ? \`\${recipient.lastname} \${recipient.firstname}\`.trim()
        : \`\${recipient.lastname} \${recipient.firstname} ΤΟΥ \${recipient.fathername}\`.trim();
      const afm = recipient.afm;
      const rowNumber = (index + 1).toString() + ".";`;

const newPattern = `    recipients.forEach((recipient, index) => {
      // Ensure all recipient properties exist and handle undefined/null values safely
      const firstname = recipient.firstname || '';
      const lastname = recipient.lastname || '';
      const fathername = recipient.fathername || '';
      
      // Check if fathername exists and is not empty
      const fullName = !fathername || fathername.trim() === ""
        ? \`\${lastname} \${firstname}\`.trim()
        : \`\${lastname} \${firstname} ΤΟΥ \${fathername}\`.trim();
      const afm = recipient.afm || '';
      const rowNumber = (index + 1).toString() + ".";`;

// Count replacements
let replacementCount = 0;

// Replace all occurrences
content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => {
  replacementCount++;
  return newPattern;
});

// Make sure we found and replaced the pattern
if (replacementCount > 0) {
  fs.writeFileSync(filePath, content);
  console.log(`Made ${replacementCount} replacements in DocumentFormatter.ts`);
} else {
  console.error('No replacements were made. Pattern not found.');
}