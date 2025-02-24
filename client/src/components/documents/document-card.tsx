import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  MoreVertical,
  FileEdit,
  Download,
  ClipboardCheck
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface DocumentCardProps {
  document: {
    id: string;
    title: string;
    status: 'pending' | 'completed';
    created_at: string;
    total_amount: number;
    recipients: Array<{
      lastname: string;
      firstname: string;
      amount: number;
      afm: string;
    }>;
    generated_by: string;
    unit?: string;
    project_na853?: string;
  };
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}

export function DocumentCard({ document, onView, onEdit, onDelete, onExport }: DocumentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCardClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleButtonClick = async (
    action: () => Promise<void>,
    successMessage: string
  ) => {
    try {
      setIsLoading(true);
      await action();
      toast({
        description: successMessage,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Παρουσιάστηκε ένα σφάλμα",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="document-card flip-card" onClick={handleCardClick}>
      <div className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
        <div className="flip-card-front">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {document.title || `Έγγραφο #${document.id}`}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Κωδικός: {document.generated_by}</span>
              </div>
            </div>
            <Badge variant={document.status === 'completed' ? 'default' : 'secondary'}>
              {document.status === 'completed' ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <Clock className="h-3 w-3 mr-1" />
              )}
              {document.status === 'completed' ? 'Ολοκληρώθηκε' : 'Σε Εκκρεμότητα'}
            </Badge>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white/60 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Συνολικό Ποσό</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {document.total_amount.toLocaleString('el-GR', {
                      style: 'currency',
                      currency: 'EUR'
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">Παραλήπτες</p>
                <p className="text-lg font-semibold text-gray-900">{document.recipients?.length || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600">Μονάδα</p>
                <p className="text-base font-semibold text-gray-900 truncate" title={document.unit || 'Μη διαθέσιμο'}>
                  {document.unit || 'Μη διαθέσιμο'}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600">ΝΑ853</p>
                <p className="text-base font-semibold text-gray-900 truncate" title={document.project_na853 || 'Μη διαθέσιμο'}>
                  {document.project_na853 || 'Μη διαθέσιμο'}
                </p>
              </div>
            </div>
          </div>

          {/* Fixed button layout */
          <div className="mt-6 grid grid-cols-2 sm:flex sm:justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                handleButtonClick(
                  async () => await onEdit(document.id),
                  "Το έγγραφο άνοιξε για επεξεργασία"
                );
              }}
              disabled={isLoading}
            >
              <FileEdit className="h-3 w-3 mr-1" />
              Επεξεργασία
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                handleButtonClick(
                  async () => await onExport(document.id),
                  "Το έγγραφο εξήχθη επιτυχώς"
                );
              }}
              disabled={isLoading}
            >
              <Download className="h-3 w-3 mr-1" />
              Εξαγωγή
            </Button>
          </div>
          {document.status !== 'completed' && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                handleButtonClick(
                  async () => await onView(document.id),
                  "Η φόρμα πρωτοκόλλου άνοιξε"
                );
              }}
              disabled={isLoading}
            >
              <ClipboardCheck className="h-3 w-3 mr-1" />
              Προσθήκη Πρωτοκόλλου
            </Button>
          </div>
            )}
          </div>
        </div>

        <div className="flip-card-back">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900">Λίστα Παραληπτών</h4>
              <span className="text-sm text-gray-600 border border-gray-300 px-3 py-1 rounded-full">
                {document.recipients?.length || 0} Παραλήπτες
              </span>
            </div>
            <div className="flex-grow overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {document.recipients?.length ? document.recipients.map((recipient, index) => (
                <div key={index} className="mb-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-gray-900">
                      {recipient.lastname} {recipient.firstname}
                    </div>
                    <div className="text-sm font-medium text-blue-600">
                      {recipient.amount.toLocaleString('el-GR', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="inline-block bg-gray-100 px-2 py-1 rounded">
                      ΑΦΜ: {recipient.afm}
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-500 mt-4">Δεν έχουν προστεθεί παραλήπτες</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}