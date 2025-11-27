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

const signatureSchema = z.object({
  name: z.string().optional().default(""),
  order: z.string().optional().default(""),
  title: z.string().optional().default(""),
  degree: z.string().optional().default(""),
  prepose: z.string().optional().default(""),
});

export const documentFormSchema = z.object({
  unit: z.string().optional().default(""),
  project_id: z.string().optional().default(""),
  subproject_id: z.string().optional().default(""),
  region: z.string().optional().default(""),
  for_yl_id: z.number().optional().nullable().default(null),
  expenditure_type: z.string().optional().default(""),
  recipients: z.array(recipientSchema).optional().default([]),
  status: z.string().optional().default("draft"),
  selectedAttachments: z.array(z.string()).optional().default([]),
  esdian_fields: z.array(z.string()).optional().default([""]),
  // Keep old fields for backward compatibility during transition
  esdian_field1: z.string().optional().default(""),
  esdian_field2: z.string().optional().default(""),
  director_signature: signatureSchema.optional(),
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
  subproject_id: "",
  region: "",
  for_yl_id: null,
  expenditure_type: "",
  recipients: [],
  status: "draft",
  selectedAttachments: [],
  esdian_fields: [""],
  esdian_field1: "",
  esdian_field2: "",
  director_signature: undefined,
};

const DocumentFormContext = createContext<DocumentFormContextType | undefined>(undefined);

export const DocumentFormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formData, setFormData] = useState<DocumentFormData>(defaultFormData);
  const [currentStep, setCurrentStep] = useState(0);

  // References for handling rate limiting and batching
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = React.useRef<boolean>(false);
  const updateQueueRef = React.useRef<Partial<DocumentFormData>[]>([]);
  const lastDataRef = React.useRef<Partial<DocumentFormData> | null>(null);
  const lastUpdateTimeRef = React.useRef<number>(0);
  
  // MAJOR OPTIMIZATION: Advanced updateFormData with rate limiting and deep equal checks
  // This significantly reduces flickering by minimizing state updates
  const updateFormData = (newData: Partial<DocumentFormData>) => {
    // CRITICAL FIX: Check if update is in progress but always allow unit/project updates
  // This ensures select dropdowns always work correctly
  if (isUpdatingRef.current && 
      JSON.stringify(newData) === JSON.stringify(lastDataRef.current) &&
      !newData.unit && // Always allow unit changes through
      !newData.project_id) { // Always allow project changes through
    return; // Only prevent circular updates for non-critical fields
  }
    
    // Store for deep comparison
    lastDataRef.current = {...newData};
    
    // Rate limiting for rapid-fire updates
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const isCritical = newData.status === "submitted";
    
    // Accumulate updates instead of applying immediately
    updateQueueRef.current.push({...newData});
    
    // If we already have a scheduled update, just queue this one
    if (updateTimeoutRef.current) {
      return;
    }
    
    // CRITICAL FIX: Use immediate updates for dropdowns and forms, delay only for recipients
    // This dramatically improves the responsiveness of UI controls
    const hasUnitOrProject = newData.unit !== undefined || newData.project_id !== undefined;
    const delay = isCritical || hasUnitOrProject ? 0 : (timeSinceLastUpdate < 300 ? 250 : 150);
    
    // Schedule a single update that will process all queued changes
    updateTimeoutRef.current = setTimeout(() => {
      // Signal that we're in the middle of an update to prevent circular calls
      isUpdatingRef.current = true;
      
      try {
        // Get all queued updates and clear the queue
        const updates = [...updateQueueRef.current];
        updateQueueRef.current = [];
        
        // Merge all queued updates into a single update
        const mergedUpdate = updates.reduce((acc, update) => ({...acc, ...update}), {});
        
        // Apply the merged update with our optimized logic
        setFormData(prev => {
          let result = {...prev};
          
          // CRITICAL FIX: Prioritize UI control updates
          if (mergedUpdate.unit !== undefined || mergedUpdate.project_id !== undefined || 
              mergedUpdate.region !== undefined || mergedUpdate.expenditure_type !== undefined) {
            // For form controls, always apply updates immediately without optimization
            result = {
              ...result,
              ...mergedUpdate
            };
          }
          // OPTIMIZATION: Only apply recipient-specific optimizations to avoid unnecessary re-renders
          else if (mergedUpdate.recipients) {
            // Empty recipients special case
            if (mergedUpdate.recipients.length === 0 && prev.recipients.length === 0) {
              // Skip - don't update empty arrays
            } 
            // Different length arrays - replace entirely
            else if (mergedUpdate.recipients.length !== prev.recipients.length) {
              result = {
                ...result,
                recipients: mergedUpdate.recipients
              };
            } 
            // Same length arrays - compare carefully
            else {
              const updatedRecipients = [...prev.recipients];
              let hasAnyRecipientChanged = false;
              
              mergedUpdate.recipients.forEach((newRecipient, index) => {
                const prevRecipient = prev.recipients[index];
                
                // Deep comparison for each field that matters for rendering
                const hasChanged = 
                  newRecipient.firstname !== prevRecipient.firstname ||
                  newRecipient.lastname !== prevRecipient.lastname ||
                  newRecipient.fathername !== prevRecipient.fathername ||
                  newRecipient.afm !== prevRecipient.afm ||
                  newRecipient.amount !== prevRecipient.amount ||
                  newRecipient.secondary_text !== prevRecipient.secondary_text ||
                  newRecipient.installment !== prevRecipient.installment ||
                  // Compare installments arrays
                  JSON.stringify(newRecipient.installments) !== JSON.stringify(prevRecipient.installments) ||
                  // Compare installment amounts
                  JSON.stringify(newRecipient.installmentAmounts) !== JSON.stringify(prevRecipient.installmentAmounts);
                
                if (hasChanged) {
                  updatedRecipients[index] = {
                    ...prevRecipient,
                    ...newRecipient
                  };
                  hasAnyRecipientChanged = true;
                }
              });
              
              // Only update the recipients array if something actually changed
              if (hasAnyRecipientChanged) {
                result = {
                  ...result,
                  recipients: updatedRecipients
                };
              }
            }
            
            // Remove recipients from mergedUpdate to avoid double-application
            const { recipients, ...restOfUpdate } = mergedUpdate;
            
            // Apply all other updates
            result = {
              ...result,
              ...restOfUpdate
            };
          } else {
            // Simple case - just apply all updates
            result = {
              ...result,
              ...mergedUpdate
            };
          }
          
          return result;
        });
        
        // Update timestamp for rate limiting
        lastUpdateTimeRef.current = Date.now();
        
      } finally {
        // Reset update flag after state change is applied
        isUpdatingRef.current = false;
        updateTimeoutRef.current = null;
      }
    }, delay);
  };

  const resetFormData = () => {
    setFormData(defaultFormData);
    setCurrentStep(0);
  };

  // CRITICAL DEBUG: Απαραίτητη αποσφαλμάτωση για το project_id στα βήματα
  React.useEffect(() => {
    // Καταγράφουμε μόνο όταν υπάρχει project ID για να μειώσουμε τη συχνότητα καταγραφής
    if (formData.project_id) {
      console.log('[DocumentForm Context] Current state:', {
        step: currentStep,
        projectId: formData.project_id,
        unit: formData.unit,
        hasRecipients: formData.recipients && formData.recipients.length > 0,
        recipientsCount: formData.recipients?.length || 0
      });
    }
  }, [formData.project_id, currentStep, formData.unit, formData.recipients]);

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