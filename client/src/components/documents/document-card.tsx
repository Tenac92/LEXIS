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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't flip if clicking on buttons or dropdown
    if (!(e.target as HTMLElement).closest('button')) {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <div className="document-card flip-card" onClick={handleCardClick}>
      <div className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
        <div className="flip-card-front">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {document.title || `Document #${document.id}`}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>ID: {document.generated_by}</span>
              </div>
            </div>
            <Badge variant={document.status === 'completed' ? 'default' : 'secondary'}>
              {document.status === 'completed' ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <Clock className="h-3 w-3 mr-1" />
              )}
              {document.status === 'completed' ? 'Completed' : 'Pending'}
            </Badge>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white/60 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {document.total_amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'EUR'
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">Recipients</p>
                <p className="text-lg font-semibold text-gray-900">{document.recipients?.length || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600">Unit</p>
                <p className="text-base font-semibold text-gray-900 truncate" title={document.unit || 'N/A'}>
                  {document.unit || 'N/A'}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600">NA853</p>
                <p className="text-base font-semibold text-gray-900 truncate" title={document.project_na853 || 'N/A'}>
                  {document.project_na853 || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(document.id)}>
              <FileEdit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport(document.id)}>
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            {document.status !== 'completed' && (
              <Button variant="outline" size="sm" onClick={() => onView(document.id)}>
                <ClipboardCheck className="h-3 w-3 mr-1" />
                Add Protocol
              </Button>
            )}
          </div>
        </div>

        <div className="flip-card-back">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900">Recipients List</h4>
              <span className="text-sm text-gray-600 border border-gray-300 px-3 py-1 rounded-full">
                {document.recipients?.length || 0} Recipients
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
                      {recipient.amount.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="inline-block bg-gray-100 px-2 py-1 rounded">
                      AFM: {recipient.afm}
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-500 mt-4">No recipients added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}