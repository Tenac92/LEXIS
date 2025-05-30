import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Calendar, 
  User,
  Euro,
  Hash,
  CheckCircle,
  Clock,
  AlertCircle,
  FileEdit,
  X
} from "lucide-react";
import type { GeneratedDocument } from "@shared/schema";

interface DocumentDetailsModalProps {
  document: GeneratedDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Recipient {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
  amount: number;
  installment: string;
  installments?: string[];
  installmentAmounts?: Record<string, number>;
}

const getStatusDetails = (status: string, is_correction: boolean | null) => {
  if (is_correction) {
    return {
      label: "Ορθή Επανάληψη",
      variant: "secondary" as const,
      icon: FileEdit,
      color: "text-purple-600"
    };
  }

  switch (status) {
    case "draft":
      return {
        label: "Προσχέδιο",
        variant: "secondary" as const,
        icon: Clock,
        color: "text-yellow-600"
      };
    case "ready":
      return {
        label: "Έτοιμο",
        variant: "default" as const,
        icon: CheckCircle,
        color: "text-green-600"
      };
    case "sent":
      return {
        label: "Αποσταλμένο",
        variant: "default" as const,
        icon: CheckCircle,
        color: "text-blue-600"
      };
    default:
      return {
        label: "Άγνωστη Κατάσταση",
        variant: "destructive" as const,
        icon: AlertCircle,
        color: "text-red-600"
      };
  }
};

export function DocumentDetailsModal({ 
  document, 
  open, 
  onOpenChange 
}: DocumentDetailsModalProps) {
  if (!document) return null;

  const statusDetails = getStatusDetails(document.status, null);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '€0,00';
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Parse recipients data
  let recipients: Recipient[] = [];
  try {
    if (document.recipients && typeof document.recipients === 'string') {
      recipients = JSON.parse(document.recipients);
    } else if (document.recipients && typeof document.recipients === 'object') {
      recipients = document.recipients as Recipient[];
    }
  } catch (error) {
    console.error('Error parsing recipients data:', error);
  }

  const totalAmount = recipients.reduce((sum, recipient) => sum + (recipient.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Λεπτομέρειες Εγγράφου
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Information */}
          <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Στοιχεία Εγγράφου
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-orange-800">Αριθμός Εγγράφου:</label>
                <p className="text-orange-900 font-medium">
                  {document.protocol_number_input ? (
                    `${document.protocol_number_input}/${document.protocol_date ? new Date(document.protocol_date).toLocaleDateString('el-GR') : ''}`
                  ) : (
                    `Έγγραφο #${document.id}`
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-orange-800">Κατάσταση:</label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={statusDetails.variant}>
                    <statusDetails.icon className="h-3 w-3 mr-1" />
                    {statusDetails.label}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-orange-800">Ημερομηνία Δημιουργίας:</label>
                <p className="text-orange-900">
                  {document.created_at ? new Date(document.created_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-orange-800">Τελευταία Ενημέρωση:</label>
                <p className="text-orange-900">
                  {document.updated_at ? new Date(document.updated_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
                </p>
              </div>
              {document.project_na853 && (
                <div>
                  <label className="text-sm font-medium text-orange-800">ΝΑ853:</label>
                  <p className="text-orange-900 font-mono">{document.project_na853}</p>
                </div>
              )}
              {document.unit && (
                <div>
                  <label className="text-sm font-medium text-orange-800">Μονάδα:</label>
                  <p className="text-orange-900">{document.unit}</p>
                </div>
              )}
            </div>
          </div>

          {/* Correction Information */}
          {document.is_correction && (
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                <FileEdit className="w-5 h-5" />
                Στοιχεία Ορθής Επανάληψης
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {document.original_protocol_number && (
                  <div>
                    <label className="text-sm font-medium text-purple-800">Αρχικό Πρωτόκολλο:</label>
                    <p className="text-purple-900 font-mono">{document.original_protocol_number}</p>
                  </div>
                )}
                {document.original_protocol_date && (
                  <div>
                    <label className="text-sm font-medium text-purple-800">Αρχική Ημερομηνία:</label>
                    <p className="text-purple-900">
                      {new Date(document.original_protocol_date).toLocaleDateString('el-GR')}
                    </p>
                  </div>
                )}
                {document.comments && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-purple-800">Σχόλια:</label>
                    <p className="text-purple-900 bg-purple-100 p-2 rounded border">
                      {document.comments}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recipients Information */}
          {recipients.length > 0 && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Δικαιούχοι ({recipients.length})
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-100 rounded border">
                  <span className="text-green-800 font-medium">Συνολικό Ποσό:</span>
                  <span className="text-green-900 font-bold text-lg">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="grid gap-3">
                  {recipients.map((recipient, index) => (
                    <div key={index} className="bg-white p-4 rounded border border-green-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-green-700 font-medium">Όνομα: </span>
                          <span className="text-green-900">
                            {recipient.lastname} {recipient.firstname}
                            {recipient.fathername && ` του ${recipient.fathername}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-green-700 font-medium">ΑΦΜ: </span>
                          <span className="text-green-900 font-mono">{recipient.afm}</span>
                        </div>
                        <div>
                          <span className="text-green-700 font-medium">Ποσό: </span>
                          <span className="text-green-900 font-mono">
                            {formatCurrency(recipient.amount)}
                          </span>
                        </div>
                        {recipient.installment && (
                          <div>
                            <span className="text-green-700 font-medium">Δόση: </span>
                            <span className="text-green-900">{recipient.installment}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}