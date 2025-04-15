import React, { createContext, useContext, useState } from 'react';
import { z } from 'zod';

// Schemas aligned with create-document-dialog.tsx
const recipientSchema = z.object({
  firstname: z.string().optional().default(""),
  lastname: z.string().optional().default(""),
  fathername: z.string().optional().default(""),
  afm: z.string().optional().default(""),
  amount: z.number().optional().default(0),
  secondary_text: z.string().optional().default(""),
  installment: z.string().optional().default("ΕΦΑΠΑΞ"),
  installments: z.array(z.string()).optional().default(["ΕΦΑΠΑΞ"]),
  installmentAmounts: z.record(z.string(), z.number()).optional().default({}),
});

export const documentFormSchema = z.object({
  unit: z.string().optional().default(""),
  project_id: z.string().optional().default(""),
  region: z.string().optional().default(""),
  expenditure_type: z.string().optional().default(""),
  recipients: z.array(recipientSchema).optional().default([]),
  status: z.string().optional().default("draft"),
  selectedAttachments: z.array(z.string()).optional().default([]),
});

export type DocumentFormData = z.infer<typeof documentFormSchema>;
export type Recipient = z.infer<typeof recipientSchema>;

interface DocumentFormContextType {
  formData: DocumentFormData;
  updateFormData: (data: Partial<DocumentFormData>) => void;
  resetFormData: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const defaultFormData: DocumentFormData = {
  unit: "",
  project_id: "",
  region: "",
  expenditure_type: "",
  recipients: [],
  status: "draft",
  selectedAttachments: [],
};

const DocumentFormContext = createContext<DocumentFormContextType | undefined>(undefined);

export const DocumentFormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formData, setFormData] = useState<DocumentFormData>(defaultFormData);
  const [currentStep, setCurrentStep] = useState(0);

  // Enhanced updateFormData that performs deep merging with special handling for recipients
  const updateFormData = (newData: Partial<DocumentFormData>) => {
    setFormData(prev => {
      // Handle empty recipients array case specifically to prevent issues
      if (newData.recipients && newData.recipients.length === 0 && prev.recipients && prev.recipients.length === 0) {
        // Skip update if both are empty arrays to prevent unnecessary re-renders
        const updatedData = { ...prev, ...newData };
        // Create a new object without recipients key to avoid TypeScript error
        const { recipients, ...dataWithoutRecipients } = updatedData;
        // Then add back the original recipients array to maintain reference
        return { ...dataWithoutRecipients, recipients: prev.recipients };
      }

      // Special handling for recipients to preserve internal state during partial updates
      if (newData.recipients && prev.recipients) {
        // Create a copy of the previous recipients
        const updatedRecipients = [...prev.recipients];
        
        // If the arrays are different lengths, use the new one entirely
        if (newData.recipients.length !== prev.recipients.length) {
          return {
            ...prev,
            ...newData
          };
        }
        
        // For same length arrays, perform a careful merge, preserving references
        // when the objects haven't actually changed
        newData.recipients.forEach((recipient, index) => {
          if (index < updatedRecipients.length) {
            // Create a new recipient only if the data has actually changed
            const prevRecipient = updatedRecipients[index];
            
            // Perform deep comparison of object properties to detect actual changes
            let hasChanged = false;
            
            // Check if any field has changed
            if (recipient.firstname !== prevRecipient.firstname ||
                recipient.lastname !== prevRecipient.lastname ||
                recipient.fathername !== prevRecipient.fathername ||
                recipient.afm !== prevRecipient.afm ||
                recipient.amount !== prevRecipient.amount ||
                recipient.secondary_text !== prevRecipient.secondary_text ||
                recipient.installment !== prevRecipient.installment) {
              hasChanged = true;
            }
            
            // Only update if something actually changed
            if (hasChanged) {
              updatedRecipients[index] = {
                ...prevRecipient,
                ...recipient
              };
            }
          }
        });
        
        // Return the updated data with carefully merged recipients
        return {
          ...prev,
          ...newData,
          recipients: updatedRecipients
        };
      }
      
      // Default case: use standard object spreading for flat merge
      return {
        ...prev,
        ...newData,
      };
    });
  };

  const resetFormData = () => {
    setFormData(defaultFormData);
    setCurrentStep(0);
  };

  return (
    <DocumentFormContext.Provider value={{ 
      formData, 
      updateFormData, 
      resetFormData, 
      currentStep, 
      setCurrentStep 
    }}>
      {children}
    </DocumentFormContext.Provider>
  );
};

export const useDocumentForm = () => {
  const context = useContext(DocumentFormContext);
  if (context === undefined) {
    throw new Error('useDocumentForm must be used within a DocumentFormProvider');
  }
  return context;
};