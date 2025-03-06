import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/header";
import { format } from "date-fns";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BudgetHistoryEntry {
  id: number;
  mis: string;
  previous_amount: string;
  new_amount: string;
  change_type: string;
  change_reason: string;
  document_id?: number;
  document_status?: string;
  created_by?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function BudgetHistoryPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [changeType, setChangeType] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/budget/history', page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/budget/history?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch budget history');
      return res.json();
    }
  });

  const history: BudgetHistoryEntry[] = data?.data || [];
  const pagination: PaginationData = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };

  const filteredHistory = changeType === 'all' 
    ? history 
    : history.filter(entry => entry.change_type === changeType);

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, pagination.pages)));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Budget History</h1>
              <div className="flex gap-4">
                <Select
                  value={changeType}
                  onValueChange={(value) => setChangeType(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Changes</SelectItem>
                    <SelectItem value="document_creation">Document Creation</SelectItem>
                    <SelectItem value="manual_adjustment">Manual Adjustment</SelectItem>
                    <SelectItem value="notification_created">Notification Created</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => setLimit(parseInt(value))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Entries per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 per page</SelectItem>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-48 text-destructive">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  No budget history entries found
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>MIS</TableHead>
                        <TableHead>Previous Amount</TableHead>
                        <TableHead>New Amount</TableHead>
                        <TableHead>Change Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Document Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell>{entry.mis}</TableCell>
                          <TableCell>€{parseFloat(entry.previous_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>€{parseFloat(entry.new_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="capitalize">
                            {entry.change_type.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>{entry.change_reason}</TableCell>
                          <TableCell>{entry.created_by || 'System'}</TableCell>
                          <TableCell className="capitalize">
                            {entry.document_status || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {[...Array(pagination.pages)].map((_, i) => (
                        <Button
                          key={i + 1}
                          variant={page === i + 1 ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(i + 1)}
                        >
                          {i + 1}
                        </Button>
                      )).slice(Math.max(0, page - 3), Math.min(pagination.pages, page + 2))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === pagination.pages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}