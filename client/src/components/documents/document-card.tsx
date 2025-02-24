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
              {document.status === 'completed' ? 'Ολοκληρώθηκε' : 'Εκκρεμεί'}
            </Badge>
          </div>
          <div>
            {document.status === 'pending' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleButtonClick(async () => onEdit(document.id), "Επιτυχής ενημέρωση")}
                disabled={isLoading}
              >
                <ClipboardCheck className="h-4 w-4" />
                Προσθήκη Πρωτοκόλλου
              </Button>
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
                </div>
              )) : (
                <p className="text-center text-gray-500">Δεν υπάρχουν παραλήπτες</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}