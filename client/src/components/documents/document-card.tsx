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
  installment: string;
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
      // Use the both format parameter to generate both documents in a ZIP file
      const response = await fetch(`/api/documents/generated/${doc.id}/export?format=both`, {
        method: 'GET',
        headers: {
          'Accept': 'application/zip, application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export failed:', errorText);
        throw new Error('Failed to export document');
      }

      // Get the content type to determine if it's a ZIP or single document
      const contentType = response.headers.get('Content-Type');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Set appropriate filename based on content type
      if (contentType && contentType.includes('application/zip')) {
        link.download = `documents-${doc.id}.zip`;
      } else {
        link.download = `document-${doc.id}.docx`;
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        description: "Τα έγγραφα εξήχθησαν επιτυχώς",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία εξαγωγής εγγράφων",
        variant: "destructive"
      });
      console.error('Export error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const recipients = doc.recipients as Recipient[];
  const docAny = doc as any; // Use type assertion to access potentially missing properties
  const statusDetails = getStatusDetails(doc.status, docAny.is_correction, doc.protocol_number_input);

  // Debug log to check values
  console.log('Document data:', {
    id: doc.id,
    is_correction: docAny.is_correction,
    original_protocol_number: docAny.original_protocol_number,
    original_protocol_date: docAny.original_protocol_date,
    comments: doc.comments
  });

  // Show orthi epanalipsi info when either condition is met
  const showOrthiEpanalipsiInfo = Boolean(docAny.is_correction) || Boolean(docAny.original_protocol_number);

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
                Ορθή Επανάληψη του εγγράφου με αρ. πρωτ. {docAny.original_protocol_number}
                {docAny.original_protocol_date && ` (${new Date(docAny.original_protocol_date).toLocaleDateString('el-GR')})`}
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
              <p className="font-medium">{doc.project_id || (doc as any).mis || ''}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">ΝΑ853</span>
              <p className="font-medium">{doc.project_na853 || ''}</p>
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
                Εξαγωγή (ZIP)
              </Button>
            </div>
            {!docAny.is_correction && doc.protocol_number_input ? (
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
              {/* Group recipients by AFM (unique identifier for a person) */}
              {(() => {
                // Group recipients by AFM
                const recipientsByAfm: Record<string, Recipient[]> = {};
                recipients?.forEach(recipient => {
                  if (!recipientsByAfm[recipient.afm]) {
                    recipientsByAfm[recipient.afm] = [];
                  }
                  recipientsByAfm[recipient.afm].push(recipient);
                });
                
                // Render each recipient group
                return Object.entries(recipientsByAfm).map(([afm, recs], groupIndex) => {
                  // Sort by installment number/letter to ensure consistent order
                  const sortedRecs = [...recs].sort((a, b) => {
                    // Convert Α, Β, Γ to numbers if possible for sorting
                    const getInstallmentValue = (inst: string) => {
                      if (inst === 'Α') return 1;
                      if (inst === 'Β') return 2;
                      if (inst === 'Γ') return 3;
                      return isNaN(parseInt(inst)) ? 0 : parseInt(inst);
                    };
                    
                    return getInstallmentValue(a.installment || 'Α') - getInstallmentValue(b.installment || 'Α');
                  });
                  
                  // Use first recipient for common information (name, afm)
                  const firstRec = sortedRecs[0];
                  
                  // Calculate total amount for this recipient across all installments
                  const totalAmount = sortedRecs.reduce((sum, r) => sum + r.amount, 0);
                  
                  return (
                    <div
                      key={groupIndex}
                      className="mb-4 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">
                          {`${firstRec.firstname} του ${firstRec.fathername} ${firstRec.lastname}`}
                        </div>
                        {sortedRecs.length > 1 ? (
                          <Badge variant="outline" className="text-xs">
                            {`${sortedRecs.length} Δόσεις`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {`Δόση ${firstRec.installment || 'Α'}`}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ΑΦΜ: {firstRec.afm}
                      </div>
                      
                      {/* Show installment details if more than one */}
                      {sortedRecs.length > 1 && (
                        <div className="text-xs mt-1 space-y-1">
                          {sortedRecs.map((rec, idx) => (
                            <div key={idx} className="flex justify-between py-1 px-2 bg-background/50 rounded">
                              <span>Δόση {rec.installment || 'Α'}</span>
                              <span>{rec.amount.toLocaleString('el-GR', {
                                style: 'currency',
                                currency: 'EUR'
                              })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="text-sm font-medium mt-1">
                        Σύνολο: {totalAmount.toLocaleString('el-GR', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </div>
                    </div>
                  );
                });
              })()}

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