import fs from 'fs';

// Read the original file
const filePath = 'server/utils/DocumentFormatter.ts';
const content = fs.readFileSync(filePath, 'utf8').split('\n');

// Create a backup if it doesn't exist
if (!fs.existsSync(filePath + '.bak')) {
  fs.writeFileSync(filePath + '.bak', content.join('\n'));
  console.log('Created backup at', filePath + '.bak');
}

// Function to replace each occurrence with the updated code
function updateReceipientNameFormat(startLineIndex) {
  // Look for the pattern in the file starting from the given line
  let found = false;
  for (let i = startLineIndex; i < startLineIndex + 15; i++) {
    if (content[i]?.includes('// Only add ΤΟΥ if fathername exists and is not empty')) {
      // This is the start of the pattern, update the next few lines
      content[i] = '      // Check for hideTouPrefix flag, otherwise check if fathername exists and is not empty';
      content[i+1] = '      const fullName = recipient.hideTouPrefix || !recipient.fathername || recipient.fathername.trim() === ""';
      content[i+2] = '        ? `${recipient.lastname} ${recipient.firstname}${recipient.fathername && recipient.fathername.trim() !== "" ? ` ${recipient.fathername}` : ""}`.trim()';
      content[i+3] = '        : `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();';
      
      // Ensure we have the required variables defined
      if (!content[i+4]?.includes('const afm')) {
        content.splice(i+4, 0, '      const afm = recipient.afm;');
      }
      if (!content[i+5]?.includes('const rowNumber')) {
        content.splice(i+5, 0, '      const rowNumber = (index + 1).toString() + ".";');
      }
      
      found = true;
      break;
    }
  }
  return found;
}

// Find and update both occurrences
let found1 = updateReceipientNameFormat(1040);
let found2 = updateReceipientNameFormat(1270);

if (found1 && found2) {
  console.log('Successfully updated both recipient name formatting sections with hideTouPrefix flag support');
} else {
  console.log('Warning: Could not find all sections to update', { found1, found2 });
}

// Write the modified content back
fs.writeFileSync(filePath, content.join('\n'));

console.log('Updated DocumentFormatter.ts to use hideTouPrefix flag');