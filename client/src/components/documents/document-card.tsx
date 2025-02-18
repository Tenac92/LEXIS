import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  User, 
  Calendar, 
  DollarSign, 
  CheckCircle,
  Clock,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface DocumentCardProps {
  document: {
    id: string;
    title: string;
    status: 'pending' | 'completed';
    created_at: string;
    amount: number;
    recipients: Array<{
      name: string;
      amount: number;
    }>;
    creator: {
      name: string;
    };
  };
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocumentCard({ document, onView, onEdit, onDelete }: DocumentCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{document.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{document.creator.name}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(document.id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(document.id)}>
                Edit Document
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(document.id)}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
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

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{document.recipients.length} Recipients</span>
            </div>
            <div className="flex items-center gap-1 font-medium">
              <DollarSign className="h-3 w-3" />
              {document.amount.toLocaleString('en-US', {
                style: 'currency',
                currency: 'EUR'
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
