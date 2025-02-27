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
  ClipboardCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedDocument } from "@shared/schema"; // Assuming this import is correct

interface DocumentCardProps {
  document: GeneratedDocument;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DocumentCard({ document, onView, onEdit, onDelete }: DocumentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCardClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/documents/generated/${document.id}/export`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to export document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${document.id}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        description: "Document exported successfully",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export document",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">
            Document #{document.id}
          </h3>
          <p className="text-sm text-muted-foreground">
            Unit: {document.unit}
          </p>
        </div>
        <Badge variant={document.status === 'approved' ? 'default' : 'secondary'}>
          {document.status === 'approved' ? (
            <CheckCircle className="h-3 w-3 mr-1" />
          ) : (
            <Clock className="h-3 w-3 mr-1" />
          )}
          {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">Project</span>
          <p className="font-medium">{document.project_id}</p>
        </div>
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">Total Amount</span>
          <p className="font-medium">
            {parseFloat(document.total_amount).toLocaleString('en-US', {
              style: 'currency',
              currency: 'EUR'
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-col space-y-2">
        <div className="text-sm text-muted-foreground">Recipients</div>
        <div className="space-y-2">
          {document.recipients.slice(0, 2).map((recipient, index) => (
            <div key={index} className="text-sm">
              {recipient.firstname} {recipient.lastname} ({recipient.afm})
            </div>
          ))}
          {document.recipients.length > 2 && (
            <div className="text-sm text-muted-foreground">
              +{document.recipients.length - 2} more recipients
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
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
            Edit
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
            Export
          </Button>
        </div>
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          disabled={isLoading || document.status === 'approved'}
        >
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Add Protocol
        </Button>
      </div>
    </Card>
  );
}