/**
 * Fix document modals syntax errors
 */
import fs from 'fs';

const filePath = 'client/src/components/documents/document-modals.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// Fix syntax error in handleEdit function
let fixedContent = content.replace(
  `        if (isNaN(installment) || installment < 1 || installment > 12) {
        return {`,
  `        if (isNaN(installment) || installment < 1 || installment > 12) {
          throw new Error(\`Invalid installment for recipient \${index + 1}\`);
        }
        return {`
);

// Update recipient object to include fathername
fixedContent = fixedContent.replace(
  `      { firstname: '', lastname: '', afm: '', amount: 0, installment: 1 }`,
  `      { firstname: '', lastname: '', fathername: '', afm: '', amount: 0, installment: 1 }`
);

// Fix empty string quotes
fixedContent = fixedContent.replace(/: '"',/g, `: '',`);

// Fix error handling in handleEdit function
const processedDataFix = fixedContent.replace(
  `      // Only include protocol_date if it's not empty
      if (!processedData.protocol_date || processedData.protocol_date === '') {
        delete processedData.protocol_date;
      }

      // Only include protocol_number_input if it's not empty
      if (!processedData.protocol_number_input || processedData.protocol_number_input === '') {
        delete processedData.protocol_number_input;
      }`,
  `      // Handle optional fields
      const finalData = {
        ...processedData
      };
      
      // Only include protocol_date if it's not empty
      if (!finalData.protocol_date || finalData.protocol_date === '') {
        delete finalData.protocol_date;
      }

      // Only include protocol_number_input if it's not empty
      if (!finalData.protocol_number_input || finalData.protocol_number_input === '') {
        delete finalData.protocol_number_input;
      }`
);

// Fix the API request
const apiRequestFix = processedDataFix.replace(
  `      console.log('[EditDocument] Sending update with data:', processedData);

      const response = await apiRequest(\`/api/documents/generated/\${document.id}\`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedData)`,
  `      console.log('[EditDocument] Sending update with data:', finalData);

      const response = await apiRequest(\`/api/documents/generated/\${document.id}\`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData)`
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, apiRequestFix);
console.log('Fixed document-modals.tsx syntax errors');