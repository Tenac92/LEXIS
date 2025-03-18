import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  FileEdit,
  Download,
  ClipboardCheck,
  Users,
  History,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedDocument } from "@shared/schema";
import { OrthiEpanalipsiModal } from "./orthi-epanalipsi-modal";

interface DocumentCardProps {
  document: GeneratedDocument;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

interface Recipient {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
  amount: number;
  installment: number;
}

const getStatusDetails = (status: string, is_correction: boolean | null, protocol_number_input: string | null) => {
  // First check if this is an orthi epanalipsi and doesn't have a protocol number yet
  if (protocol_number_input) {
    return {
      label: "Ολοκληρωμένο",
      variant: "default" as const,
      icon: CheckCircle
    };
  }
  if (is_correction && !protocol_number_input) {
    return {
      label: "Ορθή Επανάληψη",
      variant: "destructive" as const,
      icon: AlertCircle
    };
  }

  // Then check other statuses
  switch (status) {
    case 'completed':
      return {
        label: "Ολοκληρωμένο",
        variant: "default" as const,
        icon: CheckCircle
      };
    case 'pending':
      return {
        label: "Σε εκκρεμότητα",
        variant: "secondary" as const,
        icon: Clock
      };
    default:
      return {
        label: "Σε εκκρεμότητα",
        variant: "secondary" as const,
        icon: Clock
      };
  }
};

export function DocumentCard({ document: doc, onView, onEdit, onDelete }: DocumentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const { toast } = useToast();

  const handleCardClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/documents/generated/${doc.id}/export`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export failed:', errorText);
        throw new Error('Failed to export document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `document-${doc.id}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        description: "Το έγγραφο εξήχθη επιτυχώς",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία εξαγωγής εγγράφου",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const recipients = doc.recipients as Recipient[];
  const statusDetails = getStatusDetails(doc.status, doc.is_correction, doc.protocol_number_input);

  // Debug log to check values
  console.log('Document data:', {
    id: doc.id,
    is_correction: doc.is_correction,
    original_protocol_number: doc.original_protocol_number,
    original_protocol_date: doc.original_protocol_date,
    comments: doc.comments
  });

  // Show orthi epanalipsi info when either condition is met
  const showOrthiEpanalipsiInfo = Boolean(doc.is_correction) || Boolean(doc.original_protocol_number);

  return (
    <div className="flip-card" onClick={handleCardClick}>
      <div className={`flip-card-inner ${isFlipped ? 'rotate-y-180' : ''}`}>
        {/* Front of card */}
        <Card className="flip-card-front p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">
                {doc.protocol_number_input && doc.protocol_date ? (
                  `${doc.protocol_number_input}/${new Date(doc.protocol_date).toLocaleDateString('el-GR')}`
                ) : (
                  `Έγγραφο #${doc.id}`
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                Μονάδα: {doc.unit}
              </p>
            </div>
            <Badge variant={statusDetails.variant}>
              <statusDetails.icon className="h-3 w-3 mr-1" />
              {statusDetails.label}
            </Badge>
          </div>

          {/* Orthi Epanalipsi Information */}
          {showOrthiEpanalipsiInfo && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Ορθή Επανάληψη του εγγράφου με αρ. πρωτ. {doc.original_protocol_number}
                {doc.original_protocol_date && ` (${new Date(doc.original_protocol_date).toLocaleDateString('el-GR')})`}
              </p>
              {doc.comments && (
                <p className="text-sm mt-1 text-red-700 dark:text-red-300">
                  Λόγος διόρθωσης: {doc.comments}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Κωδικός Έργου</span>
              <p className="font-medium">{doc.project_id}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">ΝΑ853</span>
              <p className="font-medium">{doc.project_na853 || '-'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Συνολικό Ποσό</span>
              <p className="font-medium">
                {parseFloat(doc.total_amount?.toString() || '0').toLocaleString('el-GR', {
                  style: 'currency',
                  currency: 'EUR'
                })}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Τύπος</span>
              <p className="font-medium">{doc.expenditure_type || '-'}</p>
            </div>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mx-auto mb-1" />
            Πατήστε για να δείτε {recipients?.length || 0} δικαιούχους
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                disabled={isLoading}
              >
                <FileEdit className="h-4 w-4 mr-2" />
                Επεξεργασία
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport();
                }}
                disabled={isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Εξαγωγή
              </Button>
            </div>
            {!doc.is_correction && doc.protocol_number_input ? (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCorrectionModal(true);
                }}
                disabled={isLoading}
              >
                <History className="h-4 w-4 mr-2" />
                Ορθή Επανάληψη
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                disabled={isLoading || doc.status === 'approved'}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Προσθήκη Πρωτοκόλλου
              </Button>
            )}
          </div>
        </Card>

        {/* Back of card */}
        <Card className="flip-card-back p-6">
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Δικαιούχοι</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
              >
                Επιστροφή
              </Button>
            </div>

            <div className="flex-1 overflow-auto">
              {recipients?.map((recipient, index) => (
                <div
                  key={index}
                  className="mb-4 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">
                      {recipient.firstname} {recipient.fathername} {recipient.lastname}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Δόση {recipient.installment}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ΑΦΜ: {recipient.afm}
                  </div>
                  <div className="text-sm font-medium mt-1">
                    Ποσό: {recipient.amount.toLocaleString('el-GR', {
                      style: 'currency',
                      currency: 'EUR'
                    })}
                  </div>
                </div>
              ))}

              {(!recipients || recipients.length === 0) && (
                <div className="text-center text-muted-foreground">
                  Δεν βρέθηκαν δικαιούχοι
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <OrthiEpanalipsiModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        document={doc}
      />
    </div>
  );
}