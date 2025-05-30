import {
  Dialog,
  DialogContent,
  DialogDescription,
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
          <DialogDescription className="text-gray-600">
            Πλήρη στοιχεία και πληροφορίες για το επιλεγμένο έγγραφο
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Information */}
          <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Στοιχεία Εγγράφου
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">Αριθμός Εγγράφου</label>
                <p className="text-orange-900 font-semibold bg-white px-3 py-2 rounded border">
                  {document.protocol_number_input ? (
                    `${document.protocol_number_input}/${document.protocol_date ? new Date(document.protocol_date).toLocaleDateString('el-GR') : ''}`
                  ) : (
                    `Έγγραφο #${document.id}`
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">Κατάσταση</label>
                <div className="flex items-center">
                  <Badge variant={statusDetails.variant} className="text-sm">
                    <statusDetails.icon className="h-3 w-3 mr-1" />
                    {statusDetails.label}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">Τύπος Δαπάνης</label>
                <p className="text-orange-900 bg-white px-3 py-2 rounded border">
                  {document.expenditure_type || 'Δ/Υ'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">Ημερομηνία Δημιουργίας</label>
                <p className="text-orange-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  {document.created_at ? new Date(document.created_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">Τελευταία Ενημέρωση</label>
                <p className="text-orange-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  {document.updated_at ? new Date(document.updated_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
                </p>
              </div>
              {document.project_na853 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">ΝΑ853</label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border font-mono">
                    {document.project_na853}
                  </p>
                </div>
              )}
              {document.unit && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">Μονάδα</label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border">
                    {document.unit}
                  </p>
                </div>
              )}
              {document.total_amount && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">Συνολικό Ποσό</label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border font-semibold flex items-center gap-2">
                    <Euro className="w-4 h-4 text-orange-600" />
                    {formatCurrency(parseFloat(document.total_amount))}
                  </p>
                </div>
              )}
              {document.project_id && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">ID Έργου</label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border font-mono flex items-center gap-2">
                    <Hash className="w-4 h-4 text-orange-600" />
                    {document.project_id}
                  </p>
                </div>
              )}
            </div>
          </div>



          {/* Recipients Information */}
          {recipients.length > 0 && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Δικαιούχοι ({recipients.length})
                </h3>
                <div className="bg-green-100 px-4 py-2 rounded-lg border border-green-300">
                  <span className="text-green-700 text-sm font-medium">Συνολικό Ποσό: </span>
                  <span className="text-green-900 font-bold text-lg">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                {recipients.map((recipient, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-green-600 uppercase tracking-wide">Δικαιούχος</label>
                        <p className="text-green-900 font-medium">
                          {recipient.lastname} {recipient.firstname}
                          {recipient.fathername && (
                            <span className="text-green-700 text-sm block">
                              του {recipient.fathername}
                            </span>
                          )}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-green-600 uppercase tracking-wide">ΑΦΜ</label>
                        <p className="text-green-900 font-mono font-medium bg-green-50 px-2 py-1 rounded">
                          {recipient.afm}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-green-600 uppercase tracking-wide">Ποσό</label>
                        <p className="text-green-900 font-bold text-lg bg-green-50 px-2 py-1 rounded">
                          {formatCurrency(recipient.amount)}
                        </p>
                      </div>
                      
                      {recipient.installment && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-green-600 uppercase tracking-wide">Δόση</label>
                          <p className="text-green-900 font-medium bg-green-50 px-2 py-1 rounded">
                            {recipient.installment}
                          </p>
                        </div>
                      )}
                      
                      {recipient.installments && recipient.installments.length > 1 && (
                        <div className="md:col-span-2 lg:col-span-4 space-y-1">
                          <label className="text-xs font-medium text-green-600 uppercase tracking-wide">Όλες οι Δόσεις</label>
                          <div className="flex flex-wrap gap-2">
                            {recipient.installments.map((inst, instIndex) => (
                              <span key={instIndex} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                {inst}: {recipient.installmentAmounts && formatCurrency(recipient.installmentAmounts[inst] || 0)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}