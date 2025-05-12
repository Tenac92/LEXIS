import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
}

export function ViewDocumentModal({ isOpen, onClose, document }: ViewModalProps) {
  const { toast } = useToast();
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (document) {
      setProtocolNumber(document.protocol_number_input || '');
      setProtocolDate(document.protocol_date ?
        new Date(document.protocol_date).toISOString().split('T')[0] :
        new Date().toISOString().split('T')[0]
      );
    }
  }, [document]);

  if (!document) return null;

  const handleProtocolSave = async () => {
    try {
      setLoading(true);

      if (!protocolNumber.trim()) {
        throw new Error('Απαιτείται αριθμός πρωτοκόλλου');
      }

      if (!protocolDate) {
        throw new Error('Απαιτείται ημερομηνία πρωτοκόλλου');
      }

      const formattedDate = new Date(protocolDate).toISOString().split('T')[0];

      console.log('Αποθήκευση πρωτοκόλλου:', {
        protocolNumber,
        protocolDate: formattedDate
      });

      const response = await apiRequest<{ success: boolean; message: string; data?: any }>(`/api/documents/generated/${document.id}/protocol`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          protocol_number: protocolNumber.trim(),
          protocol_date: formattedDate
        })
      });

      if (!response || response.success === false) {
        throw new Error(response?.message || 'Αποτυχία ενημέρωσης πρωτοκόλλου');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/documents/generated'] });

      toast({
        title: "Επιτυχία",
        description: response.message || "Το πρωτόκολλο ενημερώθηκε επιτυχώς",
      });
      onClose();

    } catch (error) {
      console.error('Σφάλμα αποθήκευσης πρωτοκόλλου:', error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία ενημέρωσης πρωτοκόλλου",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Λεπτομέρειες Εγγράφου</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Protocol Section */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-lg mb-4">Στοιχεία Πρωτοκόλλου</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Αριθμός Πρωτοκόλλου</Label>
                  <Input
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                    placeholder="Εισάγετε αριθμό πρωτοκόλλου"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ημερομηνία Πρωτοκόλλου</Label>
                  <Input
                    type="date"
                    value={protocolDate}
                    onChange={(e) => setProtocolDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={handleProtocolSave}
                disabled={loading}
              >
                {loading ? "Αποθήκευση..." : "Αποθήκευση Πρωτοκόλλου"}
              </Button>
            </div>

            {/* Document Information */}
            <div>
              <h3 className="font-medium text-lg">Πληροφορίες Εγγράφου</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Κατάσταση</p>
                  <p className="font-medium capitalize">{document.status === 'approved' ? 'Εγκεκριμένο' : 'Σε εκκρεμότητα'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ημερομηνία Δημιουργίας</p>
                  <p className="font-medium">
                    {new Date(document.created_at).toLocaleDateString('el-GR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Συνολικό Ποσό</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat('el-GR', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(document.total_amount || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Recipients Section */}
            {document.recipients && document.recipients.length > 0 && (
              <div>
                <h3 className="font-medium text-lg mb-2">Δικαιούχοι</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {document.recipients.map((recipient: any, index: number) => (
                    <div
                      key={index}
                      className="p-3 bg-muted rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {recipient.lastname} {recipient.firstname}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ΑΦΜ: {recipient.afm}
                          </p>
                        </div>
                        <p className="font-medium">
                          {new Intl.NumberFormat('el-GR', {
                            style: 'currency',
                            currency: 'EUR'
                          }).format(recipient.amount || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Κλείσιμο
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GeneratedDocument {
  id: string;
  protocol_number_input?: string;
  protocol_date?: string;
  project_id?: string;
  expenditure_type?: string;
  recipients?: Array<{
    firstname: string;
    lastname: string;
    fathername?: string;
    afm: string;
    amount: number | string;
    installment?: number | string;
    // New format fields
    installments?: string[];
    installmentAmounts?: Record<string, number>;
  }>;
  created_at: string;
  status: string;
  total_amount: number;
}


interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: GeneratedDocument;
  onEdit: (id: string) => void;
}

// Define a proper Recipient interface with both formats
interface Recipient {
  firstname: string;
  lastname: string;
  fathername?: string;
  afm: string;
  amount: number;
  installment: number;
  // New format fields - can't be undefined with spread operators
  installments?: string[];
  installmentAmounts?: Record<string, number>;
}

export function EditDocumentModal({ isOpen, onClose, document, onEdit }: EditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expenditureType, setExpenditureType] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  
  // Use this ref to avoid repeated updates of the same document
  const processedDocumentId = useRef<string | null>(null);

  // Function to load NA853 code (project ID) from MIS
  const loadProjectIdFromMis = async (mis: string) => {
    if (!mis) return;
    
    try {
      console.log(`[EditDocument] Fetching NA853 code for MIS: ${mis}`);
      setLoading(true); // Show loading indicator while fetching
      
      const response = await fetch(`/api/document-na853/${mis}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.na853) {
          console.log(`[EditDocument] Found NA853 code: ${data.na853} for MIS: ${mis}`);
          setProjectId(data.na853);
          toast({
            title: "Επιτυχία",
            description: `Βρέθηκε ο κωδικός NA853: ${data.na853} για το MIS: ${mis}`,
          });
          return data.na853;
        } else {
          console.log(`[EditDocument] No NA853 code found for MIS: ${mis}`);
          toast({
            title: "Προσοχή",
            description: `Δε βρέθηκε κωδικός NA853 για το MIS: ${mis}`,
            variant: "destructive",
          });
        }
      } else {
        console.error(`[EditDocument] Failed to fetch NA853 for MIS: ${mis}`);
        toast({
          title: "Σφάλμα",
          description: `Αποτυχία αναζήτησης κωδικού NA853 για το MIS: ${mis}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`[EditDocument] Error fetching NA853 for MIS ${mis}:`, error);
      toast({
        title: "Σφάλμα",
        description: `Σφάλμα κατά την αναζήτηση κωδικού NA853: ${error instanceof Error ? error.message : 'Άγνωστο σφάλμα'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false); // Hide loading indicator
    }
    
    return null;
  };

  // Use effect with a proper cleanup to prevent memory leaks and infinite loops
  useEffect(() => {
    // Skip processing if document is undefined or dialog is not open
    if (!document || !isOpen) return;
    
    // To prevent infinite update loops, we'll check if this document has already been processed
    // Only process it if it's a new document or dialog just opened
    if (processedDocumentId.current === document.id) {
      console.log(`[EditDocument] Document ${document.id} already processed, skipping state updates`);
      return;
    }
    
    console.log(`[EditDocument] Processing document ${document.id} for the first time`);
    processedDocumentId.current = document.id;
    
    // Process the document data - simple string fields first
    setProtocolNumber(document.protocol_number_input || '');
    setProtocolDate(document.protocol_date ?
      new Date(document.protocol_date).toISOString().split('T')[0] :
      ''
    );
    
    // Initialize with document.project_id and then check if we need to load from MIS
    const currentProjectId = document.project_id || '';
    setProjectId(currentProjectId);
    
    // If project_id contains a MIS number (digits only), try to load the NA853 code
    if (currentProjectId && /^\d+$/.test(currentProjectId)) {
      console.log(`[EditDocument] Project ID appears to be a MIS number: ${currentProjectId}`);
      loadProjectIdFromMis(currentProjectId);
    }
    
    setExpenditureType(document.expenditure_type || '');

    // Safely parse recipients array with proper error handling
    try {
      // Skip if recipients is not an array
      if (!document.recipients || !Array.isArray(document.recipients)) {
        console.log('[EditDocument] No recipients found or not an array');
        setRecipients([]);
        return;
      }
      
      // Debug information
      console.log(`[EditDocument] Processing ${document.recipients.length} recipients`, 
        document.recipients.map(r => ({
          afm: r.afm,
          hasNewFormat: !!(r.installments && r.installmentAmounts)
        }))
      );

      // Map recipients to our internal format
      const safeRecipients = document.recipients.map(r => {
        // Detect if using the new format with installments array
        const hasInstallments = r.installments && Array.isArray(r.installments) && r.installments.length > 0;
        const hasInstallmentAmounts = r.installmentAmounts && 
                                   typeof r.installmentAmounts === 'object' && 
                                   Object.keys(r.installmentAmounts).length > 0;
        const isNewFormat = hasInstallments && hasInstallmentAmounts;
        
        // Create a properly typed recipient with basic fields
        const recipient: Recipient = {
          firstname: String(r.firstname || ''),
          lastname: String(r.lastname || ''),
          afm: String(r.afm || ''),
          amount: typeof r.amount === 'string' ? parseFloat(r.amount) || 0 : Number(r.amount) || 0,
          installment: typeof r.installment === 'string' ? parseInt(r.installment) || 1 : Number(r.installment) || 1
        };
        
        // Add fathername if it exists in the original data
        if ('fathername' in r && r.fathername) {
          recipient.fathername = String(r.fathername);
        }
        
        // Only handle new format if both fields are present
        if (isNewFormat) {
          console.log(`[EditDocument] Recipient ${r.afm} uses new installment format:`, {
            installments: r.installments,
            installmentAmounts: r.installmentAmounts
          });
          
          // Copy installments array if it exists and is an array
          if (hasInstallments && Array.isArray(r.installments)) {
            recipient.installments = [...r.installments];
          }
          
          // Copy installmentAmounts object if it exists
          if (hasInstallmentAmounts) {
            recipient.installmentAmounts = { ...r.installmentAmounts };
          }
          
          // Set consistent installment number based on installments array
          if (hasInstallments && Array.isArray(r.installments)) {
            if (r.installments.includes('ΕΦΑΠΑΞ')) {
              recipient.installment = 1;
            } else if (r.installments.includes('Α')) {
              recipient.installment = 1;
            } else if (r.installments.includes('Β')) {
              recipient.installment = 2;
            } else if (r.installments.includes('Γ')) {
              recipient.installment = 3;
            }
          }
        }
        
        return recipient;
      });

      console.log('[EditDocument] Processed recipients:', safeRecipients);
      setRecipients(safeRecipients);
    } catch (error) {
      console.error('[EditDocument] Error parsing recipients:', error);
      setRecipients([]);
    }
    
    // Return a cleanup function to reset state when dialog closes
    return () => {
      if (!isOpen) {
        // Reset the processed document ID when the dialog closes
        processedDocumentId.current = null;
      }
    };
  }, [document, isOpen]);

  const handleRecipientChange = (index: number, field: string, value: string | number) => {
    const updatedRecipients = [...recipients];
    updatedRecipients[index] = {
      ...updatedRecipients[index],
      [field]: field === 'amount'
        ? parseFloat(String(value)) || 0
        : field === 'installment'
        ? parseInt(String(value)) || 1
        : String(value)
    };
    setRecipients(updatedRecipients);
  };

  const addRecipient = () => {
    if (recipients.length >= 15) {
      toast({
        title: "Error",
        description: "Maximum 10 recipients allowed",
        variant: "destructive",
      });
      return;
    }
    setRecipients([
      ...recipients,
      { firstname: '', lastname: '', fathername: '', afm: '', amount: 0, installment: 1 }
    ]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const calculateTotalAmount = () => {
    return recipients.reduce((sum, r) => sum + (typeof r.amount === 'number' ? r.amount : 0), 0);
  };

  const handleEdit = async () => {
    if (loading) return; // Prevent multiple submissions
    
    try {
      if (!document) {
        throw new Error('Δεν επιλέχθηκε έγγραφο για επεξεργασία');
      }
      
      console.log('[EditDocument] Starting document edit process...');
      setLoading(true);
      
      // Form validation - collect all errors at once
      const errors = [];
      if (!String(projectId).trim()) errors.push('Απαιτείται το ID έργου');
      if (!String(expenditureType).trim()) errors.push('Απαιτείται ο τύπος δαπάνης');
      if (!recipients.length) errors.push('Απαιτείται τουλάχιστον ένας δικαιούχος');

      // Validate individual recipients
      recipients.forEach((recipient, index) => {
        const firstName = String(recipient.firstname || '').trim();
        const lastName = String(recipient.lastname || '').trim();
        const afm = String(recipient.afm || '').trim();
        
        if (!firstName) {
          errors.push(`Λείπει το όνομα για τον δικαιούχο #${index + 1}`);
        }
        
        if (!lastName) {
          errors.push(`Λείπει το επώνυμο για τον δικαιούχο #${index + 1}`);
        }
        
        if (!afm) {
          errors.push(`Λείπει το ΑΦΜ για τον δικαιούχο #${index + 1}`);
        } else if (afm.length !== 9 || !/^\d+$/.test(afm)) {
          errors.push(`Μη έγκυρο ΑΦΜ για τον δικαιούχο #${index + 1} (πρέπει να είναι 9 ψηφία)`);
        }
      });

      // Early validation failure
      if (errors.length > 0) {
        throw new Error(errors.join('<br>'));
      }

      // Process all recipients in one go with a more robust approach
      const validatedRecipients = [];
      let preserveNewFormat = false; // Flag to check if we need to preserve the new format
      
      console.log(`[EditDocument] Starting validation of ${recipients.length} recipients`);
      
      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        const recipientNumber = i + 1;
        
        // Safe conversion - avoid repetitive code
        const safeString = (value: string | undefined | null): string => value ? String(value).trim() : '';
        const safeNumber = (value: any, defaultValue: number): number => {
          const num = typeof value === 'string' ? parseFloat(value) : Number(value);
          return isNaN(num) ? defaultValue : num;
        };
        
        // Specific validations
        const amount = safeNumber(r.amount, 0);
        const installment = safeNumber(r.installment, 1);
        
        if (amount <= 0) {
          throw new Error(`Μη έγκυρο ποσό για τον δικαιούχο #${recipientNumber}`);
        }
        
        if (installment < 1 || installment > 12) {
          throw new Error(`Μη έγκυρη δόση για τον δικαιούχο #${recipientNumber} (πρέπει να είναι μεταξύ 1-12)`);
        }
        
        // Check if this recipient has the new format fields - use of defensive checks
        const hasInstallments = r.installments && Array.isArray(r.installments) && r.installments.length > 0;
        const hasInstallmentAmounts = r.installmentAmounts && 
                                     typeof r.installmentAmounts === 'object' && 
                                     Object.keys(r.installmentAmounts || {}).length > 0;
        const isNewFormat = hasInstallments && hasInstallmentAmounts;
        
        if (isNewFormat) {
          preserveNewFormat = true; // We've detected new format data, so let's preserve it
        }
        
        // Create validated recipient object with basic fields
        const validatedRecipient: Record<string, any> = {
          firstname: safeString(r.firstname),
          lastname: safeString(r.lastname),
          fathername: safeString(r.fathername),
          afm: safeString(r.afm),
          amount: amount
        };
        
        // Handle the installment formats
        if (isNewFormat) {
          // For new format, include both the installments array and installmentAmounts object
          console.log(`[EditDocument] Recipient #${recipientNumber} using new installment format:`, {
            installments: r.installments,
            installmentAmounts: r.installmentAmounts
          });
          
          // Make defensive copies to avoid mutations
          if (hasInstallments && Array.isArray(r.installments) && r.installments.length > 0) {
            // TypeScript knows r.installments is a non-empty array here
            validatedRecipient.installments = [...r.installments];
          }
          
          if (hasInstallmentAmounts) {
            validatedRecipient.installmentAmounts = {...r.installmentAmounts};
          }
          
          // Also include the legacy installment field for backward compatibility
          validatedRecipient.installment = installment;
        } else {
          // For legacy format, just include the installment number
          console.log(`[EditDocument] Recipient #${recipientNumber} using legacy installment format: ${installment}`);
          validatedRecipient.installment = installment;
        }
        
        // Add validated recipient to array
        validatedRecipients.push(validatedRecipient);
      }

      // Build data object with proper optional fields handling
      const formData: Record<string, any> = {
        project_id: String(projectId).trim(),
        expenditure_type: String(expenditureType).trim(),
        recipients: validatedRecipients,
        total_amount: calculateTotalAmount()
      };
      
      // Only add protocol fields if they're not empty
      const trimmedProtocolNumber = String(protocolNumber).trim();
      if (trimmedProtocolNumber) {
        formData.protocol_number_input = trimmedProtocolNumber;
      }
      
      if (protocolDate) {
        formData.protocol_date = protocolDate;
      }

      // Send optimized API request
      const response = await apiRequest(`/api/documents/generated/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      // Check if response is valid and doesn't contain errors
      if (!response || typeof response === 'object' && 'error' in response) {
        const errorMessage = response && typeof response === 'object' && 'error' in response 
          ? String(response.error) 
          : 'Αποτυχία ενημέρωσης εγγράφου';
        throw new Error(errorMessage);
      }

      // Invalidate cache to refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      // Success message and cleanup
      toast({
        title: "Επιτυχία",
        description: "Το έγγραφο ενημερώθηκε επιτυχώς",
      });

      // Call callbacks and close modal
      onEdit(document.id.toString());
      onClose();

    } catch (error) {
      console.error('[EditDocument] Error:', error);
      
      // Format error message for better readability in toasts
      const errorMessage = error instanceof Error ? error.message : "Αποτυχία ενημέρωσης εγγράφου";
      
      // Check if error message contains HTML-like formatting (<br>)
      if (errorMessage.includes('<br>')) {
        const errorPoints = errorMessage.split('<br>').map(msg => msg.trim()).filter(Boolean);
        
        // Show a summary toast
        toast({
          title: "Σφάλμα επικύρωσης",
          description: `Βρέθηκαν ${errorPoints.length} σφάλματα. Παρακαλώ διορθώστε τα πεδία με πρόβλημα.`,
          variant: "destructive",
        });
        
        // Show individual error messages
        errorPoints.forEach((point, index) => {
          setTimeout(() => {
            toast({
              title: `Σφάλμα #${index + 1}`,
              description: point,
              variant: "destructive",
            });
          }, index * 300); // Show errors with a small delay between them
        });
      } else {
        // Show a single error toast for simple errors
        toast({
          title: "Σφάλμα",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">Επεξεργασία Εγγράφου</DialogTitle>
          <DialogDescription className="text-base">
            Συμπληρώστε τα πεδία παρακάτω για να τροποποιήσετε το έγγραφο. Πατήστε αποθήκευση όταν τελειώσετε.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Project Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <h3 className="font-medium">Στοιχεία Πρωτοκόλλου</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Αριθμός Πρωτοκόλλου</Label>
                    <Input
                      value={protocolNumber}
                      onChange={(e) => setProtocolNumber(e.target.value)}
                      placeholder="Εισάγετε αριθμό πρωτοκόλλου"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ημερομηνία Πρωτοκόλλου</Label>
                    <Input
                      type="date"
                      value={protocolDate}
                      onChange={(e) => setProtocolDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Στοιχεία Έργου</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID Έργου (ΝΑ853)</Label>
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          placeholder="Εισάγετε ID έργου ή MIS"
                          required
                          className={projectId && /^\d+$/.test(projectId) ? "border-blue-300 focus:border-blue-500 bg-blue-50" : ""}
                        />
                        {projectId && /^\d+$/.test(projectId) && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            <span>Αναγνωρίστηκε πιθανός κωδικός MIS</span>
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap min-w-[115px] h-10"
                        onClick={() => {
                          const mis = projectId.trim();
                          if (mis && /^\d+$/.test(mis)) {
                            loadProjectIdFromMis(mis);
                          } else {
                            toast({
                              title: "Προσοχή",
                              description: "Εισάγετε έναν έγκυρο κωδικό MIS (μόνο αριθμοί)",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Αναζήτηση...
                          </>
                        ) : (
                          <>Εύρεση ΝΑ853</>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Καταχωρίστε κωδικό MIS και πατήστε το κουμπί</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Τύπος Δαπάνης</Label>
                    <Input
                      value={expenditureType}
                      onChange={(e) => setExpenditureType(e.target.value)}
                      placeholder="Εισάγετε τύπο δαπάνης"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recipients Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium">Δικαιούχοι</h3>
                  <p className="text-sm text-muted-foreground">
                    Προσθήκη έως 10 δικαιούχων
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addRecipient}
                  disabled={recipients.length >= 10 || loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Προσθήκη Δικαιούχου
                </Button>
              </div>
              <div className="space-y-3 max-h-[calc(70vh-150px)] overflow-y-auto pr-2">
                {recipients.map((recipient, index) => (
                  <Card key={index} className="p-4 relative">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 w-full">
                      {/* Όνομα */}
                      <Input
                        value={recipient.firstname}
                        onChange={(e) => handleRecipientChange(index, 'firstname', e.target.value)}
                        placeholder="Όνομα"
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                        required
                      />

                      {/* Επώνυμο */}
                      <Input
                        value={recipient.lastname}
                        onChange={(e) => handleRecipientChange(index, 'lastname', e.target.value)}
                        placeholder="Επίθετο"
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                        required
                      />

                      {/* Πατρώνυμο */}
                      <Input
                        value={recipient.fathername || ''}
                        onChange={(e) => handleRecipientChange(index, 'fathername', e.target.value)}
                        placeholder="Πατρώνυμο"
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                      />

                      {/* ΑΦΜ */}
                      <Input
                        value={recipient.afm}
                        onChange={(e) => handleRecipientChange(index, 'afm', e.target.value)}
                        placeholder="ΑΦΜ"
                        maxLength={9}
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                        required
                      />

                      {/* Ποσό */}
                      <Input
                        value={recipient.amount}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'amount', e.target.value)}
                        placeholder="Ποσό"
                        step="0.01"
                        className="md:col-span-2 md:row-span-1"
                        required
                      />

                      {/* Delete Button - same row as the inputs */}
                      <div className="md:col-span-1 md:col-start-12 md:row-start-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecipient(index)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      {/* Second row - installment and secondary text */}
                      <Input
                        value={recipient.installment}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'installment', e.target.value)}
                        placeholder="Δόση"
                        min="1"
                        max="12"
                        className="md:col-span-2 md:row-start-2"
                        required
                      />

                      {/* Secondary text placeholder - empty for backward compatibility */}
                      <div className="md:col-span-8 md:row-start-2">
                        {/* For installment type info */}
                        <div className="text-xs text-muted-foreground">
                          {recipient.installment === 1 ? 'ΕΦΑΠΑΞ / Α' : 
                           recipient.installment === 2 ? 'Β' : 
                           recipient.installment === 3 ? 'Γ' : `Δόση #${recipient.installment}`}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium text-primary-foreground">Συνολικό Ποσό:</span>
                <span className="text-lg font-bold text-primary">
                  {new Intl.NumberFormat('el-GR', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(calculateTotalAmount())}
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ακύρωση
          </Button>
          <Button onClick={handleEdit} disabled={loading}>
            {loading ? "Αποθήκευση..." : "Αποθήκευση Αλλαγών"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocumentModal({ isOpen, onClose, documentId, onDelete }: DeleteModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    try {
      setLoading(true);
      await apiRequest(`/api/documents/generated/${documentId}`, {
        method: 'DELETE'
      });
      toast({
        title: "Επιτυχία",
        description: "Το έγγραφο διαγράφηκε επιτυχώς",
      });
      onDelete();
      onClose();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία διαγραφής εγγράφου",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Διαγραφή Εγγράφου</DialogTitle>
          <DialogDescription>
            Είστε βέβαιοι ότι θέλετε να διαγράψετε αυτό το έγγραφο; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ακύρωση
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Διαγραφή..." : "Διαγραφή"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExportDocumentModal({ isOpen, onClose, document }: ExportModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!document) return null;

  const handleExport = async () => {
    try {
      setLoading(true);
      console.log('Έναρξη διαδικασίας εξαγωγής εγγράφων...');

      const testResponse = await fetch(`/api/documents/generated/${document.id}/test`);
      const testResult = await testResponse.json();

      if (!testResult.success) {
        throw new Error(testResult.message || 'Αποτυχία επικύρωσης εγγράφου');
      }

      console.log('Επικύρωση εγγράφου επιτυχής:', testResult);

      // Create and trigger download using fetch and blob approach for better handling
      const downloadUrl = `/api/documents/generated/${document.id}/export?format=both`;
      console.log('Fetching document data from URL:', downloadUrl);
      
      // Use fetch with blob response type for binary data
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Log content-type and other important headers to help debug
      console.log('Response content-type:', response.headers.get('content-type'));
      console.log('Response content-disposition:', response.headers.get('content-disposition'));
      console.log('Response content-length:', response.headers.get('content-length'));
      
      // Get the response as blob (binary data)
      const blob = await response.blob();
      console.log('Downloaded blob size:', blob.size, 'bytes, type:', blob.type);
      
      // Create object URL from blob and trigger download
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', `documents-${document.id}.zip`);
      window.document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast({
        title: "Επιτυχία",
        description: "Η λήψη των εγγράφων ξεκίνησε",
      });

      setTimeout(() => setLoading(false), 1000);
      onClose();

    } catch (error) {
      console.error('Σφάλμα εξαγωγής:', error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία λήψης εγγράφων",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Εξαγωγή Εγγράφων</DialogTitle>
          <DialogDescription>
            Πατήστε το κουμπί παρακάτω για να κατεβάσετε τα έγγραφα (κύριο έγγραφο και ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΟΡΙΖΟΝΤΙΟΣ) σε μορφή ZIP.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          <div className="font-semibold mb-1">Πληροφορίες:</div>
          <p>Το αρχείο ZIP περιέχει δύο έγγραφα DOCX:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Το κύριο έγγραφο με όλα τα στοιχεία</li>
            <li>Το συμπληρωματικό έγγραφο "ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΟΡΙΖΟΝΤΙΟΣ" με τα στοιχεία παραληπτών και τύπο Πράξης</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ακύρωση
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading}
            className="min-w-[100px]"
          >
            {loading ? "Επεξεργασία..." : "Λήψη"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  onDelete: () => void;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedDocument;
}