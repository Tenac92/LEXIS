import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">Document Information</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Protocol Number</p>
                  <p className="font-medium">{document.protocol_number_input || 'N/A'}</p>
                </div>
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

  const handleEdit = async () => {
    try {
      setLoading(true);
      await apiRequest(`/api/documents/${document.id}`, {
        method: 'PATCH',
        body: document
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Make changes to the document here.
          </DialogDescription>
        </DialogHeader>
        {/* Add form fields here */}
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
      await apiRequest(`/api/documents/${documentId}`, {
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
