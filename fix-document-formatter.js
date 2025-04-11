/**
 * Fix DocumentFormatter.ts to handle undefined/null recipient properties
 */
import fs from 'fs';

// Read the file
const filePath = 'server/utils/DocumentFormatter.ts';
let content = fs.readFileSync(filePath, 'utf8');

// First fix: Check if recipient.firstname is undefined before using it
content = content.replace(
  `const fullName = !recipient.fathername || recipient.fathername.trim() === ""
        ? \`\${recipient.lastname} \${recipient.firstname}\`.trim()
        : \`\${recipient.lastname} \${recipient.firstname} ΤΟΥ \${recipient.fathername}\`.trim();
      const afm = recipient.afm;`,
  `const firstname = recipient.firstname || '';
      const lastname = recipient.lastname || '';
      const fathername = recipient.fathername || '';
      
      // Check if fathername exists and is not empty
      const fullName = !fathername || fathername.trim() === ""
        ? \`\${lastname} \${firstname}\`.trim()
        : \`\${lastname} \${firstname} ΤΟΥ \${fathername}\`.trim();
      const afm = recipient.afm || '';`
);

// Write the file
fs.writeFileSync(filePath, content);
console.log('DocumentFormatter.ts updated successfully');