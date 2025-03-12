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
  History
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
  afm: string;
  amount: number;
  installment: number;
}

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
      console.log('[DocumentCard] Starting document export for ID:', doc.id);

      const response = await fetch(`/api/documents/generated/${doc.id}/export`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
      });

      console.log('[DocumentCard] Export response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DocumentCard] Export failed:', errorText);
        throw new Error(`Failed to export document: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('[DocumentCard] Response content type:', contentType);

      const blob = await response.blob();
      console.log('[DocumentCard] Blob size:', blob.size);

      if (blob.size === 0) {
        throw new Error('Received empty document');
      }

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `document-${doc.id}.docx`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('[DocumentCard] Document exported successfully');
      toast({
        description: "Το έγγραφο εξήχθη επιτυχώς",
        variant: "default"
      });
    } catch (error) {
      console.error('[DocumentCard] Export error:', error);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία εξαγωγής εγγράφου",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const recipients = doc.recipients as Recipient[];

  return (
    <>
      <div className="document-card" onClick={handleCardClick}>
        <div className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
          {/* Front of the card */}
          <div className="flip-card-front">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">
                  {doc.protocol_number_input && doc.protocol_date ? (
                    `${doc.protocol_number_input}/${new Date(doc.protocol_date).toLocaleDateString('el-GR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit'
                    }).replace(/\//g, '.')}`
                  ) : (
                    `Έγγραφο #${doc.id}`
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Μονάδα: {doc.unit}
                </p>
              </div>
              <Badge variant={doc.status === 'approved' ? 'default' : 'secondary'}>
                {doc.status === 'approved' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                {doc.status === 'approved' ? 'Εγκεκριμένο' : 'Σε εκκρεμότητα'}
              </Badge>
            </div>

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
              {doc.protocol_number_input ? (
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
          </div>

          {/* Back of the card */}
          <div className="flip-card-back">
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
                  Επιστροφή στις Λεπτομέρειες
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
                        {recipient.firstname} {recipient.lastname}
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
          </div>
        </div>
      </div>

      <OrthiEpanalipsiModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        document={doc}
      />
    </>
  );
}