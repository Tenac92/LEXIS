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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

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

export function ViewDocumentModal({ isOpen, onClose, document }: ViewModalProps) {
  if (!document) return null;

  const { toast } = useToast();
  const [protocolNumber, setProtocolNumber] = useState(document.protocol_number_input || '');
  const [protocolDate, setProtocolDate] = useState(document.protocol_date ? 
    new Date(document.protocol_date).toISOString().split('T')[0] : 
    new Date().toISOString().split('T')[0]
  );

  const handleProtocolSave = async () => {
    try {
      if (!protocolNumber || !protocolDate) {
        throw new Error('Protocol number and date are required');
      }

      await apiRequest(`/api/documents/generated/${document.id}/protocol`, {
        method: 'PATCH',
        body: {
          protocol_number: protocolNumber,
          protocol_date: protocolDate
        }
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
  const [comments, setComments] = useState(document?.comments || '');
  const [recipients, setRecipients] = useState(document?.recipients || []);

  const handleRecipientChange = (index: number, field: string, value: string) => {
    const updatedRecipients = [...recipients];
    updatedRecipients[index] = {
      ...updatedRecipients[index],
      [field]: value,
    };
    setRecipients(updatedRecipients);
  };

  const handleEdit = async () => {
    try {
      setLoading(true);
      await apiRequest(`/api/documents/generated/${document.id}`, {
        method: 'PATCH',
        body: {
          ...document,
          comments,
          recipients,
        }
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
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Make changes to the document here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Recipients Section */}
            <div>
              <Label>Recipients</Label>
              <div className="space-y-2 mt-2">
                {recipients.map((recipient: any, index: number) => (
                  <div key={index} className="grid grid-cols-3 gap-2 p-2 bg-muted rounded-lg">
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
                      value={recipient.amount}
                      type="number"
                      onChange={(e) => handleRecipientChange(index, 'amount', e.target.value)}
                      placeholder="Amount"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Comments Section */}
            <div>
              <Label>Comments</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your comments here..."
                className="mt-2"
              />
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