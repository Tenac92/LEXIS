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
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Info, 
  FileText, 
  RefreshCw,
  Search 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [changeType, setChangeType] = useState<string>('all');
  const [misFilter, setMisFilter] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Used to submit MIS filter
  const [appliedMisFilter, setAppliedMisFilter] = useState<string>('');

  // Reset to page 1 when filters change
  const applyMisFilter = () => {
    setPage(1);
    setAppliedMisFilter(misFilter);
  };

  // Reset page when change type changes
  const handleChangeTypeChange = (value: string) => {
    setPage(1);
    setChangeType(value);
  };

  const toggleRowExpanded = (id: number) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/budget/history', page, limit, changeType, appliedMisFilter],
    queryFn: async () => {
      let url = `/api/budget/history?page=${page}&limit=${limit}`;
      
      if (changeType !== 'all') {
        url += `&change_type=${changeType}`;
      }
      
      if (appliedMisFilter) {
        url += `&mis=${appliedMisFilter}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch budget history');
      return res.json();
    }
  });

  const history: BudgetHistoryEntry[] = data?.data || [];
  const pagination: PaginationData = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, pagination.pages)));
  };

  // Function to format monetary values
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `€${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Function to get badge styling based on change type
  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'document_creation':
        return <Badge variant="destructive">{type.replace(/_/g, ' ')}</Badge>;
      case 'manual_adjustment':
        return <Badge variant="outline">{type.replace(/_/g, ' ')}</Badge>;
      case 'notification_created':
        return <Badge variant="secondary">{type.replace(/_/g, ' ')}</Badge>;
      case 'error':
        return <Badge variant="destructive">{type.replace(/_/g, ' ')}</Badge>;
      default:
        return <Badge>{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  // Function to get metadata display
  const renderMetadata = (metadata: Record<string, any>) => {
    if (!metadata) return null;

    const quarterChanges = metadata.quarters ? (
      <div className="mt-2">
        <h4 className="text-sm font-medium mb-1">Quarter Changes</h4>
        <div className="grid grid-cols-4 gap-2 text-xs">
          {Object.entries(metadata.quarters || {}).map(([quarter, values]: [string, any]) => (
            <div key={quarter} className="p-2 border rounded">
              <div className="font-medium uppercase">{quarter}</div>
              <div className="text-muted-foreground">
                Previous: {formatCurrency(values.previous || 0)}
              </div>
              <div className="text-muted-foreground">
                New: {formatCurrency(values.new || 0)}
              </div>
              <div className={values.new < values.previous ? "text-red-500" : "text-green-500"}>
                Diff: {formatCurrency((values.new || 0) - (values.previous || 0))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

    const previousValues = metadata.previous ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">Previous Budget Values</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(metadata.previous || {}).map(([key, value]) => (
            <div key={key} className="p-2 border rounded">
              <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
              <div>{typeof value === 'number' ? formatCurrency(value) : value?.toString() || '0'}</div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

    const newValues = metadata.new ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">New Budget Values</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(metadata.new || {}).map(([key, value]) => (
            <div key={key} className="p-2 border rounded">
              <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
              <div>{typeof value === 'number' ? formatCurrency(value) : value?.toString() || '0'}</div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

    // Other metadata fields that are important to display
    const otherFields = (
      <div className="mt-3 text-xs">
        {metadata.na853 && (
          <div className="mb-1">
            <span className="font-medium">NA853 Code:</span> {metadata.na853}
          </div>
        )}
        {metadata.operation_type && (
          <div className="mb-1">
            <span className="font-medium">Operation Type:</span> {metadata.operation_type.replace(/_/g, ' ')}
          </div>
        )}
        {metadata.active_quarter && (
          <div className="mb-1">
            <span className="font-medium">Active Quarter:</span> {metadata.active_quarter.toUpperCase()}
          </div>
        )}
        {metadata.amount_deducted !== undefined && (
          <div className="mb-1">
            <span className="font-medium">Amount Deducted:</span> {formatCurrency(metadata.amount_deducted)}
          </div>
        )}
        {metadata.timestamp && (
          <div className="mb-1">
            <span className="font-medium">Timestamp:</span> {format(new Date(metadata.timestamp), 'dd/MM/yyyy HH:mm:ss')}
          </div>
        )}
      </div>
    );

    return (
      <div className="border-t mt-2 pt-2">
        {quarterChanges}
        {previousValues}
        {newValues}
        {otherFields}
      </div>
    );
  };

  // Allow all users to view budget history
  // Role-based access removed to ensure all users can access the data

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold">Budget History</h1>
                <p className="text-muted-foreground">Track all budget changes with detailed information</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Filter by MIS..."
                    value={misFilter}
                    onChange={(e) => setMisFilter(e.target.value)}
                    className="w-[180px]"
                  />
                  <Button onClick={applyMisFilter} size="icon" variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Select
                  value={changeType}
                  onValueChange={handleChangeTypeChange}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Changes</SelectItem>
                    <SelectItem value="document_creation">Document Creation</SelectItem>
                    <SelectItem value="manual_adjustment">Manual Adjustment</SelectItem>
                    <SelectItem value="notification_created">Notification Created</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setPage(1);
                    setLimit(parseInt(value));
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Entries per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 per page</SelectItem>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()} size="icon">
                  <RefreshCw className="h-4 w-4" />
                </Button>
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
              ) : history.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  No budget history entries found
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>MIS</TableHead>
                          <TableHead>Previous</TableHead>
                          <TableHead>New</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Created By</TableHead>
                          <TableHead>Document</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((entry) => {
                          const previousAmount = parseFloat(entry.previous_amount);
                          const newAmount = parseFloat(entry.new_amount);
                          const change = newAmount - previousAmount;
                          const isExpanded = expandedRows[entry.id] || false;
                          
                          return (
                            <Collapsible key={entry.id} open={isExpanded} onOpenChange={() => toggleRowExpanded(entry.id)}>
                              <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpanded(entry.id)}>
                                <TableCell>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </Button>
                                  </CollapsibleTrigger>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                                </TableCell>
                                <TableCell>{entry.mis}</TableCell>
                                <TableCell>{formatCurrency(previousAmount)}</TableCell>
                                <TableCell>{formatCurrency(newAmount)}</TableCell>
                                <TableCell className={change < 0 ? "text-red-500" : "text-green-500"}>
                                  {change < 0 ? '' : '+'}
                                  {formatCurrency(change)}
                                </TableCell>
                                <TableCell>
                                  {getChangeTypeBadge(entry.change_type)}
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[200px] truncate" title={entry.change_reason}>
                                    {entry.change_reason}
                                  </div>
                                </TableCell>
                                <TableCell>{entry.created_by || 'System'}</TableCell>
                                <TableCell>
                                  {entry.document_id ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant={entry.document_status === 'completed' ? "default" : "outline"}>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {entry.document_status || 'Pending'}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Document ID: {entry.document_id}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">None</span>
                                  )}
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={10} className="p-4">
                                    {entry.metadata ? renderMetadata(entry.metadata) : (
                                      <div className="text-muted-foreground text-sm italic">
                                        No additional metadata available
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

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
                      {pagination.pages <= 7 ? (
                        [...Array(pagination.pages)].map((_, i) => (
                          <Button
                            key={i + 1}
                            variant={page === i + 1 ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(i + 1)}
                          >
                            {i + 1}
                          </Button>
                        ))
                      ) : (
                        <>
                          {/* First page always shows */}
                          <Button
                            variant={page === 1 ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(1)}
                          >
                            1
                          </Button>
                          
                          {/* Ellipsis if not on the first few pages */}
                          {page > 3 && <span>...</span>}
                          
                          {/* Pages around current page */}
                          {[...Array(pagination.pages)]
                            .map((_, i) => i + 1)
                            .filter(p => p !== 1 && p !== pagination.pages && Math.abs(p - page) < 2)
                            .map(p => (
                              <Button
                                key={p}
                                variant={page === p ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(p)}
                              >
                                {p}
                              </Button>
                            ))
                          }
                          
                          {/* Ellipsis if not on the last few pages */}
                          {page < pagination.pages - 2 && <span>...</span>}
                          
                          {/* Last page always shows */}
                          {pagination.pages > 1 && (
                            <Button
                              variant={page === pagination.pages ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pagination.pages)}
                            >
                              {pagination.pages}
                            </Button>
                          )}
                        </>
                      )}
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