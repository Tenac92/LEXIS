/**
 * Fix the EditDocumentModal component in document-modals.tsx
 */
import fs from 'fs';

const filePath = 'client/src/components/documents/document-modals.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Modify the handleEdit function
const fixedHandleEdit = `  const handleEdit = async () => {
    try {
      if (!document) {
        throw new Error('No document selected for editing');
      }
      
      setLoading(true);
      console.log('[EditDocument] Starting edit for document:', document.id);

      // Form validation
      const errors = [];
      if (!String(projectId).trim()) errors.push('Project ID is required');
      if (!String(expenditureType).trim()) errors.push('Expenditure type is required');
      if (!recipients.length) errors.push('At least one recipient is required');

      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }

      // Validate and transform recipients data
      const validatedRecipients = recipients.map((r, index) => {
        const amount = typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount;
        const installment = typeof r.installment === 'string' ? parseInt(r.installment) : r.installment;

        if (isNaN(amount) || amount <= 0) {
          throw new Error(\`Invalid amount for recipient \${index + 1}\`);
        }
        if (isNaN(installment) || installment < 1 || installment > 12) {
          throw new Error(\`Invalid installment for recipient \${index + 1}\`);
        }
        return {
          // Handle potentially undefined values safely
          firstname: r.firstname ? String(r.firstname).trim() : '',
          lastname: r.lastname ? String(r.lastname).trim() : '',
          fathername: r.fathername ? String(r.fathername).trim() : '',
          afm: r.afm ? String(r.afm).trim() : '',
          // Convert amounts properly
          amount: parseFloat(String(amount)),
          // Ensure installment is a number
          installment
        };
      });

      const formData = {
        protocol_number_input: String(protocolNumber).trim(),
        protocol_date: protocolDate,
        project_id: String(projectId).trim(),
        expenditure_type: String(expenditureType).trim(),
        recipients: validatedRecipients,
        total_amount: calculateTotalAmount(),
      };

      // Handle optional fields
      const finalData = {
        ...formData
      };
      
      // Only include protocol_date if it's not empty
      if (!finalData.protocol_date || finalData.protocol_date === '') {
        delete finalData.protocol_date;
      }

      // Only include protocol_number_input if it's not empty
      if (!finalData.protocol_number_input || finalData.protocol_number_input === '') {
        delete finalData.protocol_number_input;
      }

      console.log('[EditDocument] Sending update with data:', finalData);

      const response = await apiRequest(\`/api/documents/generated/\${document.id}\`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData)
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to update document');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });

      toast({
        title: "Success",
        description: "Document updated successfully",
      });

      onEdit(document.id.toString());
      onClose();

    } catch (error) {
      console.error('[EditDocument] Error updating document:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };`;

// Replace the entire handleEdit function
const handleEditRegex = /const handleEdit = async \(\) => \{[\s\S]*?setLoading\(false\);\s*\}\s*\};/;
content = content.replace(handleEditRegex, fixedHandleEdit);

// Fix the addRecipient function to include fathername
content = content.replace(
  `      { firstname: '', lastname: '', afm: '', amount: 0, installment: 1 }`,
  `      { firstname: '', lastname: '', fathername: '', afm: '', amount: 0, installment: 1 }`
);

// Update the recipient interface
content = content.replace(
  `interface Recipient {
  firstname: string;
  lastname: string;
  afm: string;
  amount: number;
  installment: number;
}`,
  `interface Recipient {
  firstname: string;
  lastname: string;
  fathername?: string;
  afm: string;
  amount: number;
  installment: number;
}`
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content);
console.log('Fixed document-modals.tsx');