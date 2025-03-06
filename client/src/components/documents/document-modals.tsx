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

export function EditDocumentModal({ isOpen, onClose, document, onEdit }: EditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expenditureType, setExpenditureType] = useState('');
  const [recipients, setRecipients] = useState<any[]>([]);

  useEffect(() => {
    if (document) {
      setProtocolNumber(document.protocol_number_input || '');
      setProtocolDate(document.protocol_date ?
        new Date(document.protocol_date).toISOString().split('T')[0] :
        ''
      );
      setProjectId(document.project_id || '');
      setExpenditureType(document.expenditure_type || '');
      setRecipients(document.recipients || []);
    }
  }, [document]);

  const handleRecipientChange = (index: number, field: string, value: string | number) => {
    const updatedRecipients = [...recipients];
    updatedRecipients[index] = {
      ...updatedRecipients[index],
      [field]: field === 'amount' ? parseFloat(value as string) || 0 : value,
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
    return recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  };

  const handleEdit = async () => {
    try {
      if (!protocolNumber || !protocolDate) {
        toast({
          title: "Error",
          description: "Protocol number and date are required",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append('protocol_number_input', protocolNumber);
      formData.append('protocol_date', protocolDate);
      formData.append('project_id', projectId);
      formData.append('expenditure_type', expenditureType);
      formData.append('recipients', JSON.stringify(recipients.map(r => ({
        ...r,
        amount: parseFloat(r.amount) || 0,
        installment: parseInt(r.installment) || 1
      }))));
      formData.append('total_amount', calculateTotalAmount().toString());

      await apiRequest(`/api/documents/generated/${document.id}`, {
        method: 'PATCH',
        body: formData
      });

      toast({
        title: "Success",
        description: "Document updated successfully",
      });
      onEdit(document.id);
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update document",
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
                />
              </div>
              <div className="space-y-2">
                <Label>Τύπος Δαπάνης</Label>
                <Input
                  value={expenditureType}
                  onChange={(e) => setExpenditureType(e.target.value)}
                  placeholder="Εισάγετε τύπο δαπάνης"
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
                      />
                      <Input
                        value={recipient.lastname}
                        onChange={(e) => handleRecipientChange(index, 'lastname', e.target.value)}
                        placeholder="Επίθετο"
                      />
                      <Input
                        value={recipient.afm}
                        onChange={(e) => handleRecipientChange(index, 'afm', e.target.value)}
                        placeholder="ΑΦΜ"
                        maxLength={9}
                      />
                      <Input
                        value={recipient.amount}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'amount', e.target.value)}
                        placeholder="Ποσό"
                        step="0.01"
                      />
                      <Input
                        value={recipient.installment}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'installment', e.target.value)}
                        placeholder="Δόση"
                        min="1"
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

      const downloadUrl = `/api/documents/generated/${document.id}/export`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `document-${document.id}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

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

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onEdit: (id: string) => void;
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
  document: any;
}