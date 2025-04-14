import React from "react";
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
  metadata?: {
    previous_version?: Record<string, any>;
    updated_version?: Record<string, any>;
    changes?: Record<string, any>;
    change_date?: string;
  };
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
      const jsonData = await res.json();
      
      // Log the response to see its structure
      console.log('Budget history API response:', jsonData);
      
      return jsonData;
    }
  });

  // Ensure proper data structure and validation
  const history: BudgetHistoryEntry[] = data?.data && Array.isArray(data.data) 
    ? data.data.map((entry: any) => ({
        id: entry.id,
        mis: entry.mis || 'Unknown',
        previous_amount: entry.previous_amount || '0',
        new_amount: entry.new_amount || '0',
        change_type: entry.change_type || '',
        change_reason: entry.change_reason || '',
        document_id: entry.document_id,
        document_status: entry.document_status,
        created_by: entry.created_by || 'System',
        created_at: entry.created_at || new Date().toISOString(),
        metadata: entry.metadata || {}
      }))
    : [];
    
  const pagination: PaginationData = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, pagination.pages)));
  };

  // Function to format monetary values
  const formatCurrency = (amount: string | number | undefined | null) => {
    if (amount === undefined || amount === null) {
      return '€0.00';
    }
    
    // Convert to number safely
    const numAmount = typeof amount === 'string' 
      ? parseFloat(amount || '0') 
      : typeof amount === 'number' ? amount : 0;
    
    // Handle NaN case
    if (isNaN(numAmount)) {
      console.warn('Invalid amount value detected:', amount);
      return '€0.00';
    }
    
    return `€${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Function to get badge styling based on change type
  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'document_creation':
        return <Badge variant="destructive">Δημιουργία Εγγράφου</Badge>;
      case 'manual_adjustment':
        return <Badge variant="outline">Χειροκίνητη Προσαρμογή</Badge>;
      case 'notification_created':
        return <Badge variant="secondary">Δημιουργία Ειδοποίησης</Badge>;
      case 'error':
        return <Badge variant="destructive">Σφάλμα</Badge>;
      case 'import':
        return <Badge>Εισαγωγή</Badge>;
      default:
        return <Badge>{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  // Function to get metadata display
  const renderMetadata = (metadata: Record<string, any>) => {
    if (!metadata) return null;

    const { previous_version, updated_version, changes, change_date } = metadata;

    // Display budget data from previous version
    const previousVersionSection = previous_version ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">Προηγούμενες Τιμές Προϋπολογισμού</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(previous_version).map(([key, value]) => {
            if (key === '__typename') return null; // Skip internal fields
            return (
              <div key={key} className="p-2 border rounded">
                <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                <div>
                  {typeof value === 'number' 
                    ? formatCurrency(value) 
                    : Array.isArray(value)
                      ? value.join(', ')
                      : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : value?.toString() || '0'
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

    // Display budget data from updated version
    const updatedVersionSection = updated_version ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">Νέες Τιμές Προϋπολογισμού</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(updated_version).map(([key, value]) => {
            if (key === '__typename') return null; // Skip internal fields
            return (
              <div key={key} className="p-2 border rounded">
                <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                <div>
                  {typeof value === 'number' 
                    ? formatCurrency(value) 
                    : Array.isArray(value)
                      ? value.join(', ')
                      : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : value?.toString() || '0'
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

    // Display detailed changes information
    const changesSection = changes ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">Λεπτομέρειες Αλλαγών</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {Object.entries(changes).map(([key, value]) => {
            if (key === '__typename') return null; // Skip internal fields
            return (
              <div key={key} className="p-2 border rounded">
                <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                <div>
                  {typeof value === 'number' 
                    ? formatCurrency(value) 
                    : Array.isArray(value)
                      ? value.join(', ')
                      : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : value?.toString() || '-'
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

    // Other important metadata like change date
    const otherFields = (
      <div className="mt-3 text-xs">
        {change_date && (
          <div className="mb-1">
            <span className="font-medium">Ημερομηνία Αλλαγής:</span> {
              typeof change_date === 'string' 
                ? format(new Date(change_date), 'dd/MM/yyyy HH:mm:ss')
                : change_date
            }
          </div>
        )}
        {previous_version?.na853 && (
          <div className="mb-1">
            <span className="font-medium">Κωδικός NA853:</span> {previous_version.na853}
          </div>
        )}
        {changes?.reason && (
          <div className="mb-1">
            <span className="font-medium">Αιτιολογία:</span> {changes.reason}
          </div>
        )}
        {previous_version?.quarter || updated_version?.quarter && (
          <div className="mb-1">
            <span className="font-medium">Τρίμηνο:</span> {(previous_version?.quarter || updated_version?.quarter)?.toUpperCase()}
          </div>
        )}
      </div>
    );

    return (
      <div className="border-t mt-2 pt-2">
        {previousVersionSection}
        {updatedVersionSection}
        {changesSection}
        {otherFields}
        {/* Fallback for old metadata format */}
        {metadata.quarters && (
          <div className="mt-2">
            <h4 className="text-sm font-medium mb-1">Αλλαγές Τριμήνου (Legacy)</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {Object.entries(metadata.quarters || {}).map(([quarter, values]: [string, any]) => (
                <div key={quarter} className="p-2 border rounded">
                  <div className="font-medium uppercase">{quarter}</div>
                  <div className="text-muted-foreground">
                    Προηγούμενο: {formatCurrency(values.previous || 0)}
                  </div>
                  <div className="text-muted-foreground">
                    Νέο: {formatCurrency(values.new || 0)}
                  </div>
                  <div className={values.new < values.previous ? "text-red-500" : "text-green-500"}>
                    Διαφορά: {formatCurrency((values.new || 0) - (values.previous || 0))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
                <h1 className="text-2xl font-bold">Ιστορικό Προϋπολογισμού</h1>
                <p className="text-muted-foreground">Παρακολούθηση όλων των αλλαγών προϋπολογισμού με λεπτομερείς πληροφορίες</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Φίλτρο με MIS..."
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
                    <SelectValue placeholder="Φίλτρο ανά τύπο" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Όλες οι αλλαγές</SelectItem>
                    <SelectItem value="document_creation">Δημιουργία Εγγράφου</SelectItem>
                    <SelectItem value="manual_adjustment">Χειροκίνητη Προσαρμογή</SelectItem>
                    <SelectItem value="notification_created">Δημιουργία Ειδοποίησης</SelectItem>
                    <SelectItem value="import">Εισαγωγή</SelectItem>
                    <SelectItem value="error">Σφάλμα</SelectItem>
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
                    <SelectValue placeholder="Εγγραφές ανά σελίδα" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 ανά σελίδα</SelectItem>
                    <SelectItem value="10">10 ανά σελίδα</SelectItem>
                    <SelectItem value="20">20 ανά σελίδα</SelectItem>
                    <SelectItem value="50">50 ανά σελίδα</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()} size="icon" title="Ανανέωση">
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
                  {error instanceof Error ? error.message : 'Προέκυψε σφάλμα'}
                </div>
              ) : history.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  Δεν βρέθηκαν εγγραφές ιστορικού προϋπολογισμού
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Ημερομηνία</TableHead>
                          <TableHead>MIS</TableHead>
                          <TableHead>Προηγούμενο</TableHead>
                          <TableHead>Νέο</TableHead>
                          <TableHead>Αλλαγή</TableHead>
                          <TableHead>Τύπος</TableHead>
                          <TableHead>Αιτιολογία</TableHead>
                          <TableHead>Δημιουργήθηκε από</TableHead>
                          <TableHead>Έγγραφο</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((entry) => {
                          const previousAmount = parseFloat(entry.previous_amount);
                          const newAmount = parseFloat(entry.new_amount);
                          const change = newAmount - previousAmount;
                          const isExpanded = expandedRows[entry.id] || false;
                          
                          // Use two separate table rows instead of nesting the Collapsible in wrong DOM structure
                          return (
                            <React.Fragment key={entry.id}>
                              <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpanded(entry.id)}>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  {entry.created_at 
                                    ? format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')
                                    : 'N/A'}
                                </TableCell>
                                <TableCell>{entry.mis}</TableCell>
                                <TableCell>{formatCurrency(previousAmount)}</TableCell>
                                <TableCell>{formatCurrency(newAmount)}</TableCell>
                                <TableCell className={change < 0 ? "text-red-500" : "text-green-500"}>
                                  {change < 0 ? '' : '+'}
                                  {formatCurrency(change)}
                                </TableCell>
                                <TableCell>
                                  {entry.change_type ? getChangeTypeBadge(entry.change_type) : '-'}
                                </TableCell>
                                <TableCell>
                                  {entry.change_reason ? (
                                    <div className="max-w-[200px] truncate" title={entry.change_reason}>
                                      {entry.change_reason}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell>{entry.created_by || 'Σύστημα'}</TableCell>
                                <TableCell>
                                  {entry.document_id ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant={entry.document_status === 'completed' ? "default" : "outline"}>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {entry.document_status === 'completed' ? 'Ολοκληρωμένο' : 
                                             entry.document_status === 'pending' ? 'Σε εκκρεμότητα' : 
                                             entry.document_status || 'Σε εκκρεμότητα'}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          ID Εγγράφου: {entry.document_id}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Κανένα</span>
                                  )}
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={10} className="p-4">
                                    {entry.metadata ? renderMetadata(entry.metadata) : (
                                      <div className="text-muted-foreground text-sm italic">
                                        Δεν υπάρχουν διαθέσιμα επιπρόσθετα μεταδεδομένα
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Εμφάνιση {((page - 1) * limit) + 1} έως {Math.min(page * limit, pagination.total)} από {pagination.total} εγγραφές
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