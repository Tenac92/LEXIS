import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useState } from "react";

interface APIResponse {
  ok: boolean;
  json: () => Promise<any>;
  blob: () => Promise<Blob>;
}

// Document types
interface DocumentProtocol {
  protocol_number: string;
  protocol_date: string;
}

interface DocumentUpdate extends DocumentProtocol {
  project_id: string;
  expenditure_type: string;
  recipients: Array<{
    firstname: string;
    lastname: string;
    afm: string;
    amount: number;
    installment: number;
  }>;
  total_amount: number;
}

interface ExportConfig {
  format: string;
  document_id: string;
  unit_details: {
    unit_name: string;
    email: string;
    parts: any[];
  };
  contact_info: {
    address: string;
    postal_code: string;
    city: string;
    contact_person: string;
  };
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  include_attachments: boolean;
  include_signatures: boolean;
}

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ViewModalProps extends BaseModalProps {
  document: any;
}

interface EditModalProps extends BaseModalProps {
  document: any;
  onEdit: (id: string) => void;
}

interface DeleteModalProps extends BaseModalProps {
  documentId: string;
  onDelete: () => void;
}

interface ExportModalProps extends BaseModalProps {
  document: any;
}

export function ViewDocumentModal({ isOpen, onClose, document }: ViewModalProps) {
  const { toast } = useToast();
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');

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
      if (!protocolNumber || !protocolDate) {
        throw new Error('Protocol number and date are required');
      }

      const formData = new FormData();
      formData.append('protocol_number', protocolNumber);
      formData.append('protocol_date', protocolDate);

      const response = await apiRequest(`/api/documents/generated/${document.id}/protocol`, {
        method: 'PATCH',
        body: formData
      });

      toast({
        title: "Success",
        description: "Protocol updated successfully",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update protocol",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Protocol Section */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-lg mb-4">Protocol Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocol Number</Label>
                  <Input
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                    placeholder="Enter protocol number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Protocol Date</Label>
                  <Input
                    type="date"
                    value={protocolDate}
                    onChange={(e) => setProtocolDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={handleProtocolSave}
              >
                Save Protocol
              </Button>
            </div>

            {/* Document Information */}
            <div>
              <h3 className="font-medium text-lg">Document Information</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{document.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">
                    {new Date(document.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat('en-US', {
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
                <h3 className="font-medium text-lg mb-2">Recipients</h3>
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
                            AFM: {recipient.afm}
                          </p>
                        </div>
                        <p className="font-medium">
                          {new Intl.NumberFormat('en-US', {
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
            Close
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

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Make changes to the document here. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Protocol Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocol Number</Label>
                <Input
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                  placeholder="Enter protocol number"
                />
              </div>
              <div className="space-y-2">
                <Label>Protocol Date</Label>
                <Input
                  type="date"
                  value={protocolDate}
                  onChange={(e) => setProtocolDate(e.target.value)}
                />
              </div>
            </div>

            {/* Project Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project ID</Label>
                <Input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Enter project ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Expenditure Type</Label>
                <Input
                  value={expenditureType}
                  onChange={(e) => setExpenditureType(e.target.value)}
                  placeholder="Enter expenditure type"
                />
              </div>
            </div>

            {/* Recipients Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Recipients</Label>
                <Button
                  onClick={addRecipient}
                  variant="outline"
                  size="sm"
                >
                  Add Recipient
                </Button>
              </div>
              <div className="space-y-4">
                {recipients.map((recipient, index) => (
                  <div key={index} className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Recipient #{index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecipient(index)}
                        className="text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        value={recipient.firstname}
                        onChange={(e) => handleRecipientChange(index, 'firstname', e.target.value)}
                        placeholder="First Name"
                      />
                      <Input
                        value={recipient.lastname}
                        onChange={(e) => handleRecipientChange(index, 'lastname', e.target.value)}
                        placeholder="Last Name"
                      />
                      <Input
                        value={recipient.afm}
                        onChange={(e) => handleRecipientChange(index, 'afm', e.target.value)}
                        placeholder="AFM"
                        maxLength={9}
                      />
                      <Input
                        value={recipient.amount}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'amount', e.target.value)}
                        placeholder="Amount"
                        step="0.01"
                      />
                      <Input
                        value={recipient.installment}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'installment', e.target.value)}
                        placeholder="Installment"
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
                <span className="font-medium">Total Amount:</span>
                <span className="text-lg font-bold">
                  {new Intl.NumberFormat('en-US', {
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
            Cancel
          </Button>
          <Button onClick={handleEdit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
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
        title: "Success",
        description: "Document deleted successfully",
      });
      onDelete();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
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
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this document? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExportDocumentModal({ isOpen, onClose, document }: ExportModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState('docx');
  const [unitDetails, setUnitDetails] = useState({
    unit_name: '',
    email: 'daefkke@civilprotection.gr',
    parts: []
  });
  const [contactInfo, setContactInfo] = useState({
    address: 'Κηφισίας 124 & Ιατρίδου 2',
    postal_code: '11526',
    city: 'Αθήνα',
    contact_person: ''
  });

  useEffect(() => {
    if (document) {
      // Initialize with document data if available
      setUnitDetails(prev => ({
        ...prev,
        unit_name: document.unit || '',
        parts: document.unit_parts || []
      }));
      setContactInfo(prev => ({
        ...prev,
        contact_person: document.contact_person || ''
      }));
    }
  }, [document]);

  if (!document) return null;

  const handleExport = async () => {
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('format', format);
      formData.append('document_id', document.id);
      formData.append('unit_details', JSON.stringify(unitDetails));
      formData.append('contact_info', JSON.stringify(contactInfo));
      formData.append('margins', JSON.stringify({
        top: 850,
        right: 1000,
        bottom: 850,
        left: 1000
      }));
      formData.append('include_attachments', format === 'docx' ? 'true' : 'false');
      formData.append('include_signatures', 'true');

      const response = await apiRequest(`/api/documents/generated/${document.id}/export`, {
        method: 'POST',
        body: formData
      }) as APIResponse;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${document.document_number || document.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Document exported successfully",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export document",
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
          <DialogTitle>Export Document</DialogTitle>
          <DialogDescription>
            Configure document export settings and choose format.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Unit Details Section */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-lg">Unit Details</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Unit Name</Label>
                <Input
                  value={unitDetails.unit_name}
                  onChange={(e) => setUnitDetails(prev => ({
                    ...prev,
                    unit_name: e.target.value
                  }))}
                  placeholder="Enter unit name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={unitDetails.email}
                  onChange={(e) => setUnitDetails(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                  placeholder="Enter email"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-lg">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={contactInfo.address}
                  onChange={(e) => setContactInfo(prev => ({
                    ...prev,
                    address: e.target.value
                  }))}
                  placeholder="Enter address"
                />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input
                  value={contactInfo.postal_code}
                  onChange={(e) => setContactInfo(prev => ({
                    ...prev,
                    postal_code: e.target.value
                  }))}
                  placeholder="Enter postal code"
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={contactInfo.city}
                  onChange={(e) => setContactInfo(prev => ({
                    ...prev,
                    city: e.target.value
                  }))}
                  placeholder="Enter city"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={contactInfo.contact_person}
                  onChange={(e) => setContactInfo(prev => ({
                    ...prev,
                    contact_person: e.target.value
                  }))}
                  placeholder="Enter contact person"
                />
              </div>
            </div>
          </div>

          {/* Export Format Section */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="docx">DOCX (with formatting)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            {format === 'docx' && (
              <p className="text-sm text-muted-foreground mt-2">
                DOCX format includes full document formatting with headers, footers, and proper layout.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}