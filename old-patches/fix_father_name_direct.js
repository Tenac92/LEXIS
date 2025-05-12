import fs from 'fs';

// Read the original file
const filePath = 'server/utils/DocumentFormatter.ts';
const content = fs.readFileSync(filePath, 'utf8').split('\n');

// Create a backup if it doesn't exist
if (!fs.existsSync(filePath + '.bak')) {
  fs.writeFileSync(filePath + '.bak', content.join('\n'));
  console.log('Created backup at', filePath + '.bak');
}

// First location - Line 1045-1046
content[1044] = '      // Only add ΤΟΥ if fathername exists and is not empty';
content[1045] = '      const fullName = recipient.fathername && recipient.fathername.trim() !== ""';
content[1046] = '        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()';
content[1047] = '        : `${recipient.lastname} ${recipient.firstname}`.trim();';
// Restore these two lines that define needed variables for later use
content[1048] = '      const afm = recipient.afm;';
content[1049] = '      const rowNumber = (index + 1).toString() + ".";';

// Second location - Line 1276-1277
content[1275] = '      // Only add ΤΟΥ if fathername exists and is not empty';
content[1276] = '      const fullName = recipient.fathername && recipient.fathername.trim() !== ""';
content[1277] = '        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()';
content[1278] = '        : `${recipient.lastname} ${recipient.firstname}`.trim();';
// Restore these two lines that define needed variables
content[1279] = '      const afm = recipient.afm;';
content[1280] = '      const rowNumber = (index + 1).toString() + ".";';

// Write the modified content back
fs.writeFileSync(filePath, content.join('\n'));

console.log('Fixed father\'s name handling in both locations with rowNumber properly defined');