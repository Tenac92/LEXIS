#!/bin/bash

# Script to apply document modal fixes
echo "Applying document modal and export fixes..."

# Fix the Document Formatter first - make backup
cp server/utils/DocumentFormatter.ts server/utils/DocumentFormatter.ts.bak

# Apply the patch manually for DocumentFormatter.ts for the first occurrence (createPaymentTable)
echo "Fixing recipient handling in createPaymentTable..."
sed -i '1044,1050c\
    recipients.forEach((recipient, index) => {\
      // Ensure all recipient properties exist and handle undefined/null values safely\
      const firstname = recipient.firstname || '"'"'"'"'"';\
      const lastname = recipient.lastname || '"'"'"'"'"';\
      const fathername = recipient.fathername || '"'"'"'"'"';\
      \
      // Check if fathername exists and is not empty\
      const fullName = !fathername || fathername.trim() === ""\
        ? `${lastname} ${firstname}`.trim()\
        : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();\
      const afm = recipient.afm || '"'"'"'"'"';\
      const rowNumber = (index + 1).toString() + ".";' server/utils/DocumentFormatter.ts

# Apply the patch manually for DocumentFormatter.ts for the second occurrence (createRecipientsTableWithAction)
echo "Fixing recipient handling in createRecipientsTableWithAction..."
sed -i '1275,1281c\
    recipients.forEach((recipient, index) => {\
      // Ensure all recipient properties exist and handle undefined/null values safely\
      const firstname = recipient.firstname || '"'"'"'"'"';\
      const lastname = recipient.lastname || '"'"'"'"'"';\
      const fathername = recipient.fathername || '"'"'"'"'"';\
      \
      // Check if fathername exists and is not empty\
      const fullName = !fathername || fathername.trim() === ""\
        ? `${lastname} ${firstname}`.trim()\
        : `${lastname} ${firstname} ΤΟΥ ${fathername}`.trim();\
      const afm = recipient.afm || '"'"'"'"'"';\
      const rowNumber = (index + 1).toString() + ".";' server/utils/DocumentFormatter.ts

# Make backup of the orthi-epanalipsi-modal.tsx file
cp client/src/components/documents/orthi-epanalipsi-modal.tsx client/src/components/documents/orthi-epanalipsi-modal.tsx.bak

# Update the orthi-epanalipsi-modal.tsx file - initialize correctionReason and add extra validation
echo "Updating orthi-epanalipsi-modal.tsx..."
sed -i '164,171c\
      form.reset({\
        correctionReason: "",\
        project_id: String(document.project_id),\
        project_na853: document.project_na853,\
        unit: document.unit,\
        expenditure_type: document.expenditure_type,\
        recipients: Array.isArray(document.recipients) ? document.recipients : [],\
        total_amount: document.total_amount,\
      });' client/src/components/documents/orthi-epanalipsi-modal.tsx

# Update addRecipient function in orthi-epanalipsi-modal.tsx
sed -i '176,184c\
  const addRecipient = () => {\
    const currentRecipients = form.getValues("recipients") || [];\
    \
    if (currentRecipients.length >= 15) {\
      toast({\
        title: "Προσοχή",\
        description: "Μέγιστος αριθμός δικαιούχων: 15",\
        variant: "destructive",\
      });\
      return;\
    }\
    form.setValue("recipients", [\
      ...currentRecipients,\
      { firstname: "", lastname: "", fathername: "", afm: "", amount: 0, installment: 1 }\
    ]);\
  };' client/src/components/documents/orthi-epanalipsi-modal.tsx

# Make backup of document-modals.tsx
cp client/src/components/documents/document-modals.tsx client/src/components/documents/document-modals.tsx.bak

# Update recipients handling in document-modals.tsx
echo "Updating document-modals.tsx..."
sed -i '254s/document.recipients/document.recipients \&\& Array.isArray(document.recipients)/' client/src/components/documents/document-modals.tsx

# Update recipient limit
sed -i '285s/10/15/' client/src/components/documents/document-modals.tsx

# Update recipient validation in handleEdit function
sed -i '335,347c\
        return {\
          // Handle potentially undefined values safely\
          firstname: r.firstname ? String(r.firstname).trim() : '"'"'"'"'"',\
          lastname: r.lastname ? String(r.lastname).trim() : '"'"'"'"'"',\
          fathername: r.fathername ? String(r.fathername).trim() : '"'"'"'"'"',\
          afm: r.afm ? String(r.afm).trim() : '"'"'"'"'"',\
          // Convert amounts properly\
          amount: parseFloat(String(amount)),\
          // Ensure installment is a number\
          installment\
        };' client/src/components/documents/document-modals.tsx

echo "All patches applied successfully!"
echo "The following files were updated:"
echo "- server/utils/DocumentFormatter.ts"
echo "- client/src/components/documents/orthi-epanalipsi-modal.tsx"
echo "- client/src/components/documents/document-modals.tsx"
echo ""
echo "Backups were created with .bak extension"