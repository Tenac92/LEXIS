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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

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
    afm: string;
    amount: number | string;
    installment: number | string;
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

export function EditDocumentModal({ isOpen, onClose, document, onEdit }: EditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expenditureType, setExpenditureType] = useState('');
  const [recipients, setRecipients] = useState<Array<{
    firstname: string;
    lastname: string;
    afm: string;
    amount: number;
    installment: number;
  }>>([]);

  useEffect(() => {
    if (document) {
      setProtocolNumber(document.protocol_number_input || '');
      setProtocolDate(document.protocol_date ?
        new Date(document.protocol_date).toISOString().split('T')[0] :
        ''
      );
      setProjectId(document.project_id || '');
      setExpenditureType(document.expenditure_type || '');

      // Safely parse recipients array
      const safeRecipients = Array.isArray(document.recipients)
        ? document.recipients.map(r => ({
            firstname: String(r.firstname || ''),
            lastname: String(r.lastname || ''),
            afm: String(r.afm || ''),
            amount: typeof r.amount === 'string' ? parseFloat(r.amount) : Number(r.amount) || 0,
            installment: typeof r.installment === 'string' ? parseInt(r.installment) : Number(r.installment) || 1
          }))
        : [];

      setRecipients(safeRecipients);
    }
  }, [document]);

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
    if (recipients.length >= 10) {
      toast({
        title: "Error",
        description: "Maximum 10 recipients allowed",
        variant: "destructive",
      });
      return;
    }
    setRecipients([
      ...recipients,
      { firstname: '', lastname: '', afm: '', amount: 0, installment: 1 }
    ]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const calculateTotalAmount = () => {
    return recipients.reduce((sum, r) => sum + (typeof r.amount === 'number' ? r.amount : 0), 0);
  };

  const handleEdit = async () => {
    try {
      if (!document) {
        throw new Error('No document selected for editing');
      }
      
      setLoading(true);
      console.log('[EditDocument] Starting edit for document:', document.id);

      // Form validation
      const errors: string[] = [];
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
          throw new Error(`Invalid amount for recipient ${index + 1}`);
        }
        if (isNaN(installment) || installment < 1 || installment > 12) {
          throw new Error(`Invalid installment for recipient ${index + 1}`);
        }

        return {
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          afm: String(r.afm).trim(),
          amount,
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

      // Pre-process form data to handle empty protocol values
      const processedData = { ...formData };

      // Only include protocol_date if it's not empty
      if (!processedData.protocol_date || processedData.protocol_date === '') {
        delete processedData.protocol_date;
      }

      // Only include protocol_number_input if it's not empty
      if (!processedData.protocol_number_input || processedData.protocol_number_input === '') {
        delete processedData.protocol_number_input;
      }


      console.log('[EditDocument] Sending update with data:', processedData);

      const response = await apiRequest(`/api/documents/generated/${document.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedData)
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Επεξεργασία Εγγράφου</DialogTitle>
          <DialogDescription>
            Κάντε αλλαγές στο έγγραφο εδώ. Πατήστε αποθήκευση όταν τελειώσετε.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Project Information */}
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>ID Έργου</Label>
                <Input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Εισάγετε ID έργου"
                  required
                />
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

            {/* Recipients Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Δικαιούχοι</Label>
                <Button
                  onClick={addRecipient}
                  variant="outline"
                  size="sm"
                >
                  Προσθήκη Δικαιούχου
                </Button>
              </div>
              <div className="space-y-4">
                {recipients.map((recipient, index) => (
                  <div key={index} className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Δικαιούχος #{index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecipient(index)}
                        className="text-destructive"
                      >
                        Αφαίρεση
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        value={recipient.firstname}
                        onChange={(e) => handleRecipientChange(index, 'firstname', e.target.value)}
                        placeholder="Όνομα"
                        required
                      />
                      <Input
                        value={recipient.lastname}
                        onChange={(e) => handleRecipientChange(index, 'lastname', e.target.value)}
                        placeholder="Επίθετο"
                        required
                      />
                      <Input
                        value={recipient.afm}
                        onChange={(e) => handleRecipientChange(index, 'afm', e.target.value)}
                        placeholder="ΑΦΜ"
                        maxLength={9}
                        required
                      />
                      <Input
                        value={recipient.amount}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'amount', e.target.value)}
                        placeholder="Ποσό"
                        step="0.01"
                        required
                      />
                      <Input
                        value={recipient.installment}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'installment', e.target.value)}
                        placeholder="Δόση"
                        min="1"
                        max="12"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Συνολικό Ποσό:</span>
                <span className="text-lg font-bold">
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
      console.log('Έναρξη διαδικασίας εξαγωγής εγγράφου...');

      const testResponse = await fetch(`/api/documents/generated/${document.id}/test`);
      const testResult = await testResponse.json();

      if (!testResult.success) {
        throw new Error(testResult.message || 'Αποτυχία επικύρωσης εγγράφου');
      }

      console.log('Επικύρωση εγγράφου επιτυχής:', testResult);

      // Create and trigger download using window.document
      const downloadUrl = `/api/documents/generated/${document.id}/export`;
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `document-${document.id}.docx`);
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);

      toast({
        title: "Επιτυχία",
        description: "Η λήψη του εγγράφου ξεκίνησε",
      });

      setTimeout(() => setLoading(false), 1000);
      onClose();

    } catch (error) {
      console.error('Σφάλμα εξαγωγής:', error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία λήψης εγγράφου",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Εξαγωγή Εγγράφου</DialogTitle>
          <DialogDescription>
            Πατήστε το κουμπί παρακάτω για να κατεβάσετε το έγγραφο.
          </DialogDescription>
        </DialogHeader>
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