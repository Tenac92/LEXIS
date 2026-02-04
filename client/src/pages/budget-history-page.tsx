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
  Search,
  User as UserIcon,
  Calendar,
  Filter,
  DollarSign,
  GitBranch
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Download, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { ProjectDetailsDialog } from "@/components/projects/ProjectDetailsDialog";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import type { GeneratedDocument } from "@shared/schema";
import { useExpenditureTypesForFilter } from "@/hooks/useExpenditureTypes";
import { useWebSocketUpdates } from "@/hooks/use-websocket-updates";

// Hook to fetch users from the same unit for the creator filter
const useUnitUsers = (userUnits: (string | number)[] | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['unitUsers', userUnits],
    queryFn: async () => {
      if (!userUnits || userUnits.length === 0) return [];
      try {
        const response = await fetch('/api/users/matching-units');
        if (!response.ok) return [];
        const data = await response.json();
        // Convert userUnits to numbers for comparison since unit_id is numeric
        const unitIds = userUnits.map(u => Number(u)).filter(Number.isFinite);
        return data.filter((user: any) => 
          user.unit_id && Array.isArray(user.unit_id) && 
          user.unit_id.some((unitId: number) => unitIds.includes(unitId))
        );
      } catch (error) {
        console.error('Error fetching unit users:', error);
        return [];
      }
    },
    enabled: !!userUnits && userUnits.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { unitUsers: data || [], isLoadingUsers: isLoading };
};

// Hook για να ελέγχει αν ένα έγγραφο έχει protocol_number_input
const useDocumentProtocolNumber = (documentId: number | null) => {
  const { data, isLoading } = useQuery({
    queryKey: ['documentProtocolNumber', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        console.error('Error fetching document:', error);
        return null;
      }
    },
    enabled: !!documentId, // Μόνο αν υπάρχει documentId
    staleTime: 5 * 60 * 1000, // 5 λεπτά
    gcTime: 10 * 60 * 1000, // Χρησιμοποιούμε gcTime αντί για cacheTime στην τελευταία έκδοση του TanStack Query
  });

  const protocolNumberInput = data && typeof data === 'object' && 'protocol_number_input' in data
    ? data.protocol_number_input
    : null;

  return {
    protocolNumberInput,
    isLoading,
  };
};

// Helper function to get status label and styling
const getDocumentStatusDetails = (status: string | undefined) => {
  switch (status) {
    case "draft":
      return {
        label: "Προσχέδιο",
        className: "bg-gray-100 text-gray-800",
      };
    case "pending":
      return {
        label: "Εκκρεμεί",
        className: "bg-yellow-100 text-yellow-800",
      };
    case "approved":
      return {
        label: "Εγκεκριμένο",
        className: "bg-green-100 text-green-800",
      };
    case "rejected":
      return {
        label: "Απορρίφθηκε",
        className: "bg-red-100 text-red-800",
      };
    case "completed":
      return {
        label: "Ολοκληρώθηκε",
        className: "bg-blue-100 text-blue-800",
      };
    // Legacy status support
    case "ready":
      return {
        label: "Έτοιμο",
        className: "bg-green-100 text-green-800",
      };
    case "sent":
      return {
        label: "Απεσταλμένο",
        className: "bg-blue-100 text-blue-800",
      };
    default:
      return {
        label: "Εκκρεμεί",
        className: "bg-yellow-100 text-yellow-800",
      };
  }
};

// Component που εμφανίζει το document_id ή το protocol_number_input αν υπάρχει
const BudgetHistoryDocument = ({ documentId, status }: { documentId: number, status?: string }) => {
  const { protocolNumberInput, isLoading } = useDocumentProtocolNumber(documentId);
  const statusDetails = getDocumentStatusDetails(status);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={statusDetails.className}>
            <FileText className="h-3 w-3 mr-1" />
            {protocolNumberInput ? `Αρ. Πρωτ.: ${protocolNumberInput}` : statusDetails.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            {isLoading ? (
              <div>Φόρτωση στοιχείων εγγράφου...</div>
            ) : (
              <>
                {protocolNumberInput ? (
                  <div>Αρ. Πρωτ.: {protocolNumberInput}</div>
                ) : (
                  <div>ID Εγγράφου: {documentId}</div>
                )}
                <div className="mt-1">Κλικ για προβολή εγγράφου</div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


interface BudgetHistoryEntry {
  id: number;
  project_id?: number;
  mis: string;
  na853?: string;
  previous_amount: string;
  new_amount: string;
  change_type: string;
  change_reason: string;
  document_id?: number;
  document_status?: string;
  protocol_number_input?: string; // Add protocol number from backend
  created_by?: string;  // This now contains the actual user name
  created_by_id?: string; // This contains the numeric user ID
  created_at: string;
  batch_id?: string; // UUID for grouping related entries
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
  // Enable real-time updates via WebSocket
  useWebSocketUpdates();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [changeType, setChangeType] = useState<string>('all');
  const [na853Filter, setNa853Filter] = useState<string>('');
  const [expenditureTypeFilter, setExpenditureTypeFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  
  // State for modals
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [entryDetailsOpen, setEntryDetailsOpen] = useState(false);

  // Used to submit filters
  const [appliedNa853Filter, setAppliedNa853Filter] = useState<string>('');
  const [appliedExpenditureTypeFilter, setAppliedExpenditureTypeFilter] = useState<string>('');
  const [appliedDateFilter, setAppliedDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [appliedCreatorFilter, setAppliedCreatorFilter] = useState<string>('');
  const [appliedUnitFilter, setAppliedUnitFilter] = useState<string>('');

  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  // Fetch users from the same unit for the creator dropdown
  const { unitUsers, isLoadingUsers } = useUnitUsers(user?.unit_id);
  
  // Fetch expenditure types for the filter
  const { data: expenditureTypes } = useExpenditureTypesForFilter();

  // Admin-only: fetch Monada units list for Unit filter
  const { data: monadaUnits } = useQuery({
    queryKey: ['monada-units'],
    queryFn: async () => {
      const res = await fetch('/api/public/monada');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const unitOptions = useMemo(() => {
    const list = Array.isArray(monadaUnits) ? monadaUnits : [];
    return list.map((u: any) => ({ id: String(u.id), name: u.unit || u.name || `Μονάδα ${u.id}` }));
  }, [monadaUnits]);

  // Reset to page 1 when filters change
  const applyNa853Filter = () => {
    setPage(1);
    setAppliedNa853Filter(na853Filter);
  };

  // Apply all filters
  const applyAllFilters = () => {
    setPage(1);
    setAppliedNa853Filter(na853Filter);
    setAppliedExpenditureTypeFilter(expenditureTypeFilter === 'all' ? '' : expenditureTypeFilter);
    setAppliedDateFilter(dateFilter);
    setAppliedCreatorFilter(creatorFilter === 'all' ? '' : creatorFilter);
    setAppliedUnitFilter(isAdmin && unitFilter !== 'all' ? unitFilter : '');
  };

  // Clear all filters
  const clearAllFilters = () => {
    setPage(1);
    setNa853Filter('');
    setExpenditureTypeFilter('all');
    setDateFilter({ from: '', to: '' });
    setCreatorFilter('all');
    setAppliedNa853Filter('');
    setAppliedExpenditureTypeFilter('');
    setAppliedDateFilter({ from: '', to: '' });
    setAppliedCreatorFilter('');
    setUnitFilter('all');
    setAppliedUnitFilter('');
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

  // Component to render a batch group of entries
  const BatchGroup = ({ entries, batchId }: { entries: BudgetHistoryEntry[]; batchId: string }) => {
    const [isGroupExpanded, setIsGroupExpanded] = useState(false);
    const firstEntry = entries[0];
    const totalChange = entries.reduce((sum, e) => {
      const change = parseFloat(e.new_amount) - parseFloat(e.previous_amount);
      return sum + change;
    }, 0);

    return (
      <>
        <TableRow 
          className="cursor-pointer hover:bg-blue-50/50 bg-blue-50/30 border-l-4 border-l-blue-500"
          onClick={() => setIsGroupExpanded(!isGroupExpanded)}
        >
          <TableCell>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronDown className={`h-4 w-4 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </TableCell>
          <TableCell>
            {firstEntry.created_at 
              ? format(new Date(firstEntry.created_at), 'dd/MM/yyyy HH:mm')
              : 'N/A'}
          </TableCell>
          <TableCell colSpan={2}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                Μαζική Εισαγωγή Excel
              </Badge>
              <span className="text-sm text-muted-foreground">
                {entries.length} εγγραφές
              </span>
            </div>
          </TableCell>
          <TableCell colSpan={2}>
            <div className={`font-medium ${totalChange < 0 ? "text-red-500" : totalChange > 0 ? "text-green-500" : ""}`}>
              Συνολική Αλλαγή: {formatCurrency(totalChange)}
            </div>
          </TableCell>
          <TableCell>
            {getChangeTypeBadge('import')}
          </TableCell>
          <TableCell colSpan={3}>
            <div className="text-sm text-muted-foreground">
              Κλικ για προβολή όλων των εγγραφών
            </div>
          </TableCell>
        </TableRow>
        {isGroupExpanded && entries.map((entry) => {
          const previousAmount = parseFloat(entry.previous_amount);
          const newAmount = parseFloat(entry.new_amount);
          const change = newAmount - previousAmount;
          const isExpanded = expandedRows[entry.id] || false;
          
          return (
            <React.Fragment key={entry.id}>
              <TableRow 
                className="cursor-pointer hover:bg-muted/50 bg-blue-50/10 border-l-4 border-l-blue-300"
                onClick={() => toggleRowExpanded(entry.id)}
              >
                <TableCell className="pl-8">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </TableCell>
                <TableCell>
                  {entry.created_at 
                    ? format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')
                    : 'N/A'}
                </TableCell>
                <TableCell 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (entry.project_id) {
                      setSelectedProject({ id: entry.project_id, mis: entry.mis, na853: entry.na853 });
                      setProjectDialogOpen(true);
                    }
                  }}
                  className={entry.project_id ? "cursor-pointer hover:underline text-blue-600" : ""}
                  data-testid={`link-project-${entry.id}`}
                >
                  {entry.na853 || entry.mis || 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(previousAmount)}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(newAmount)}</div>
                </TableCell>
                <TableCell>
                  <div className={`font-medium ${change < 0 ? "text-red-500" : change > 0 ? "text-green-500" : ""}`}>
                    {change === 0 ? '-' : (
                      <>
                        {change > 0 ? '+' : ''}
                        {formatCurrency(change)}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {entry.change_type ? getChangeTypeBadge(entry.change_type) : '-'}
                </TableCell>
                <TableCell>
                  {entry.change_reason ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[200px] truncate hover:cursor-help">
                            {entry.change_reason.replace('Updated from Excel import for', 'Εισαγωγή από Excel για')}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-[400px] p-3">
                          <div className="text-xs whitespace-pre-wrap">
                            {entry.change_reason.replace('Updated from Excel import for', 'Εισαγωγή από Excel για')}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getOperationTypeBadge(entry.change_reason, entry.created_by)}
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{entry.created_by || 'Σύστημα'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">Κανένα</span>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={10} className="p-4">
                    <div className="space-y-2 text-sm">
                      <div><strong>Μέρος Μαζικής Εισαγωγής:</strong> {batchId.substring(0, 8)}...</div>
                      <div><strong>Λεπτομέρειες:</strong> {entry.change_reason}</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/budget/history', page, limit, changeType, appliedNa853Filter, appliedExpenditureTypeFilter, appliedDateFilter, appliedCreatorFilter, appliedUnitFilter],
    staleTime: 2 * 60 * 1000, // 2 minutes cache for better performance
    gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let url = `/api/budget/history?page=${page}&limit=${limit}`;
      
      if (changeType !== 'all') {
        url += `&change_type=${changeType}`;
      }
      
      if (appliedNa853Filter) {
        url += `&na853=${appliedNa853Filter}`;
      }
      
      if (appliedExpenditureTypeFilter) {
        url += `&expenditure_type=${appliedExpenditureTypeFilter}`;
      }
      
      if (appliedDateFilter.from) {
        url += `&date_from=${appliedDateFilter.from}`;
      }
      
      if (appliedDateFilter.to) {
        url += `&date_to=${appliedDateFilter.to}`;
      }
      
      if (appliedCreatorFilter) {
        url += `&creator=${appliedCreatorFilter}`;
      }

      if (isAdmin && appliedUnitFilter) {
        url += `&unit_id=${appliedUnitFilter}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch budget history');
      const jsonData = await res.json();
      
      return jsonData;
    }
  });

  // Ensure proper data structure and validation
  const history: BudgetHistoryEntry[] = data?.data && Array.isArray(data.data) 
    ? data.data.map((entry: any) => ({
        id: entry.id,
        project_id: entry.project_id,
        mis: entry.mis || 'Unknown',
        na853: entry.na853,
        previous_amount: entry.previous_amount || '0',
        new_amount: entry.new_amount || '0',
        change_type: entry.change_type || '',
        change_reason: entry.change_reason || '',
        document_id: entry.document_id,
        document_status: entry.document_status,
        protocol_number_input: entry.protocol_number_input, // Include protocol number from backend
        created_by: entry.created_by || 'Σύστημα',
        created_by_id: entry.created_by_id || '',
        created_at: entry.created_at || new Date().toISOString(),
        batch_id: entry.batch_id,
        metadata: entry.metadata || {}
      }))
    : [];
  
  // Group entries by batch_id for imports
  const groupedHistory = useMemo(() => {
    const groups: Array<{ isBatch: boolean; entries: BudgetHistoryEntry[]; batchId?: string }> = [];
    const seenBatchIds = new Set<string>();
    
    history.forEach(entry => {
      if (entry.batch_id && !seenBatchIds.has(entry.batch_id)) {
        // Find all entries with this batch_id
        const batchEntries = history.filter(e => e.batch_id === entry.batch_id);
        if (batchEntries.length > 1) {
          groups.push({
            isBatch: true,
            entries: batchEntries,
            batchId: entry.batch_id
          });
          seenBatchIds.add(entry.batch_id);
        } else {
          // Single entry with batch_id (shouldn't happen, but handle gracefully)
          groups.push({
            isBatch: false,
            entries: [entry]
          });
        }
      } else if (!entry.batch_id || !seenBatchIds.has(entry.batch_id)) {
        // Entry without batch_id or not yet processed
        if (!entry.batch_id) {
          groups.push({
            isBatch: false,
            entries: [entry]
          });
        }
      }
    });
    
    return groups;
  }, [history]);
  
  // Fetch document details for selected document
  const { data: selectedDocument } = useQuery<GeneratedDocument>({
    queryKey: [`/api/documents/${selectedDocumentId}`],
    enabled: !!selectedDocumentId && documentModalOpen,
    staleTime: 5 * 60 * 1000,
  });
    
  const pagination: PaginationData = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };
  const statistics = data?.statistics;

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, pagination.pages)));
  };

  // Excel export function with proper authentication handling
  const handleExcelExport = async () => {
    try {
      // Build export URL with current filters
      const params = new URLSearchParams();
      
      if (appliedNa853Filter) {
        params.append('na853', appliedNa853Filter);
      }
      
      if (appliedExpenditureTypeFilter) {
        params.append('expenditure_type', appliedExpenditureTypeFilter);
      }
      
      if (changeType !== 'all') {
        params.append('change_type', changeType);
      }
      
      if (appliedDateFilter.from) {
        params.append('date_from', appliedDateFilter.from);
      }
      
      if (appliedDateFilter.to) {
        params.append('date_to', appliedDateFilter.to);
      }
      
      if (appliedCreatorFilter) {
        params.append('creator', appliedCreatorFilter);
      }

      if (isAdmin && appliedUnitFilter) {
        params.append('unit_id', appliedUnitFilter);
      }
      
      const url = `/api/budget/history/export?${params.toString()}`;
      
      // IMPORTANT #3: Enhanced filename with timestamp and filter context
      const getExportFilename = () => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, -5); // YYYYMMDDTHHMMSS
        let filename = `Istoriko-Proypologismou-${timestamp}`;
        
        if (appliedNa853Filter) filename += `-NA853_${appliedNa853Filter}`;
        if (appliedDateFilter.from) filename += `-from_${appliedDateFilter.from}`;
        if (appliedDateFilter.to) filename += `-to_${appliedDateFilter.to}`;
        
        filename += '.xlsx';
        return filename;
      };
      
      // Use fetch with credentials to ensure session cookie is sent
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Create object URL and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Use enhanced filename with filter context
      const filename = getExportFilename();
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting Excel file:', error);
    }
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
      case 'spending':
        return <Badge variant="destructive">Δαπάνη</Badge>;
      case 'refund':
        return <Badge className="bg-green-100 text-green-800">Επιστροφή</Badge>;
      case 'document_created':
        return <Badge variant="destructive">Δημιουργία Εγγράφου</Badge>;
      case 'import':
        return <Badge>Εισαγωγή</Badge>;
      case 'quarter_change':
        return <Badge className="bg-blue-100 text-blue-800">Αλλαγή Τριμήνου</Badge>;
      case 'year_end_closure':
        return <Badge className="bg-purple-100 text-purple-800">Κλείσιμο Έτους</Badge>;
      case 'manual_adjustment':
        return <Badge variant="outline">Χειροκίνητη Προσαρμογή</Badge>;
      case 'notification_created':
        return <Badge variant="secondary">Δημιουργία Ειδοποίησης</Badge>;
      default:
        return <Badge>{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  // IMPORTANT #1: Operation type badge to distinguish system/auto/manual operations
  const getOperationTypeBadge = (changeReason: string | undefined, createdBy: string | undefined) => {
    if (!changeReason) return null;
    
    const reason = String(changeReason).toUpperCase();
    
    if (reason.includes('[AUTO]')) {
      return <Badge className="bg-amber-100 text-amber-900 text-xs">🤖 Αυτόματη</Badge>;
    }
    if (reason.includes('[IMPORT]')) {
      return <Badge className="bg-cyan-100 text-cyan-900 text-xs">📤 Εισαγωγή</Badge>;
    }
    if (reason.includes('[ROLLBACK]')) {
      return <Badge className="bg-red-100 text-red-900 text-xs">⟲ Αναστροφή</Badge>;
    }
    
    if (createdBy === 'Σύστημα') {
      return <Badge className="bg-gray-100 text-gray-900 text-xs">⚙️ Σύστημα</Badge>;
    }
    
    return <Badge className="bg-green-100 text-green-900 text-xs">✏️ Χειροκίνητα</Badge>;
  };

  // Function to get metadata display
  const renderMetadata = (metadata: Record<string, any>, entryChangeType?: string) => {
    if (!metadata) return null;

    const { previous_version, updated_version, changes, change_date, previous_amount, new_amount, change_reason } = metadata;
    
    // Try to parse budget values from change_reason which contains the actual data
    let parsedBudgetValues: Record<string, any> = {};
    
    if (change_reason) {
      // Extract JSON-like data from the change_reason
      try {
        // Look for the part after "Updated values: " which contains the JSON object
        const valuesMatch = change_reason.match(/Updated values: (\{.*\})/);
        if (valuesMatch && valuesMatch[1]) {
          // Parse the JSON string 
          parsedBudgetValues = JSON.parse(valuesMatch[1]);
          
          // Debug
          console.log('Successfully parsed budget values:', parsedBudgetValues);
        }
      } catch (error) {
        console.error('Error parsing change_reason JSON:', error);
        
        // Try alternative approach for malformed JSON
        try {
          // Sometimes the JSON might be malformed but still parseable with regex
          const matches = change_reason.match(/\"([^\"]+)\":([^,}]+)/g);
          if (matches) {
            matches.forEach((match: string) => {
              const [key, value] = match.split(':');
              const cleanKey = key.replace(/"/g, '');
              const cleanValue = value.trim();
              
              // Check if it's a numeric string
              const isNumeric = !isNaN(Number(cleanValue));
              
              parsedBudgetValues[cleanKey] = cleanValue;
            });
            
            console.log('Parsed budget values using regex fallback:', parsedBudgetValues);
          }
        } catch (fallbackError) {
          console.error('Fallback parsing also failed:', fallbackError);
        }
      }
    }

    // Get project info from the change_reason
    const projectInfo = {
      mis: '',
      na853: ''
    };

    if (change_reason) {
      const misMatch = change_reason.match(/MIS (\d+)/);
      const na853Match = change_reason.match(/NA853: ([^\)]+)/);
      
      if (misMatch && misMatch[1]) projectInfo.mis = misMatch[1];
      if (na853Match && na853Match[1]) projectInfo.na853 = na853Match[1];
    }

    // Create a section for project information
    const projectInfoSection = (projectInfo.mis || projectInfo.na853) ? (
      <div className="mt-3 bg-muted p-3 rounded-md">
        <h4 className="text-sm font-medium mb-2">Στοιχεία Έργου</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {projectInfo.mis && (
            <div className="flex items-center">
              <span className="font-medium mr-2">MIS:</span> {projectInfo.mis}
            </div>
          )}
          {projectInfo.na853 && (
            <div className="flex items-center">
              <span className="font-medium mr-2">Κωδικός NA853:</span> {projectInfo.na853}
            </div>
          )}
        </div>
      </div>
    ) : null;

    // Display budget values parsed from change_reason
    const budgetValuesSection = Object.keys(parsedBudgetValues).length > 0 ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">Τιμές Προϋπολογισμού</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {Object.entries(parsedBudgetValues).map(([key, value]) => {
            // Skip non-numeric values or create a special display for them
            const isNumeric = typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value as string)));
            
            // Get Greek UI label for the database field
            const getGreekLabel = (dbField: string) => {
              const fieldMappings: Record<string, string> = {
                'ethsia_pistosi': 'Ετήσια Πίστωση',
                'katanomes_etous': 'Κατανομές Έτους',
                'user_view': 'Ποσό Διαβιβάσεων',
                'q1': 'Τρίμηνο 1',
                'q2': 'Τρίμηνο 2',
                'q3': 'Τρίμηνο 3',
                'q4': 'Τρίμηνο 4',
                'katanomes_adjustment': 'Προσαρμογή Κατανομών',
                'sum': 'Σύνολο'
              };
              
              return fieldMappings[dbField] || dbField.replace(/_/g, ' ');
            };
            
            // Get Greek translation for string values if needed
            const getGreekValueTranslation = (fieldKey: string, fieldValue: any) => {
              if (typeof fieldValue !== 'string') return fieldValue;
              
              const valueTranslations: Record<string, Record<string, string>> = {
                'katanomes_adjustment': {
                  'No change': 'Χωρίς αλλαγή',
                  'Increased': 'Αυξήθηκε',
                  'Decreased': 'Μειώθηκε'
                }
              };
              
              if (valueTranslations[fieldKey] && valueTranslations[fieldKey][fieldValue]) {
                return valueTranslations[fieldKey][fieldValue];
              }
              
              return fieldValue;
            };
            
            const uiLabel = getGreekLabel(key);
            const translatedValue = getGreekValueTranslation(key, value);
            
            return (
              <div key={key} className={`p-2 border rounded ${isNumeric ? 'bg-blue-50' : ''}`}>
                <div className="font-medium">
                  {uiLabel}
                </div>
                <div>
                  {isNumeric
                    ? formatCurrency(translatedValue) 
                    : typeof translatedValue === 'object' && translatedValue !== null
                      ? JSON.stringify(translatedValue)
                      : translatedValue?.toString() || '-'
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

    // Display change reason in a more readable format
    const changeReasonSection = change_reason ? (
      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">Αιτία Αλλαγής</h4>
        <div className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">
          {(() => {
            // First do basic formatting
            let formattedReason = change_reason
              .replace('Updated from Excel import for', 'Ενημέρωση από αρχείο Excel για')
              .replace(/\{/g, '{\n  ')
              .replace(/\}/g, '\n}')
              .replace(/,/g, ',\n  ');
            
            // Then replace database field names with Greek UI labels
            const fieldMappings: Record<string, string> = {
              'ethsia_pistosi': 'Ετήσια Πίστωση',
              'katanomes_etous': 'Κατανομές Έτους',
              'user_view': 'Ποσό Διαβιβάσεων',
              'q1': 'Τρίμηνο 1',
              'q2': 'Τρίμηνο 2',
              'q3': 'Τρίμηνο 3',
              'q4': 'Τρίμηνο 4',
              'katanomes_adjustment': 'Προσαρμογή Κατανομών',
              'sum': 'Σύνολο'
            };
            
            // Replace field names in formatted JSON
            Object.entries(fieldMappings).forEach(([dbField, greekLabel]) => {
              const fieldRegex = new RegExp(`"${dbField}"`, 'g');
              formattedReason = formattedReason.replace(fieldRegex, `"${greekLabel}"`);
            });
            
            // Replace value translations
            formattedReason = formattedReason.replace(/"No change"/g, '"Χωρίς αλλαγή"');
            formattedReason = formattedReason.replace(/"Increased"/g, '"Αυξήθηκε"');
            formattedReason = formattedReason.replace(/"Decreased"/g, '"Μειώθηκε"');
            
            return formattedReason;
          })()}
        </div>
      </div>
    ) : null;

    // Display budget amounts change
    const amountChangeSection = (previous_amount !== undefined || new_amount !== undefined) ? (
      <div className="mt-3 p-3 border rounded">
        <h4 className="text-sm font-medium mb-2">
          {entryChangeType === 'spending' || entryChangeType === 'refund'
            ? 'Μεταβολή Διαθέσιμου Προϋπολογισμού' 
            : 'Αλλαγή Ποσού'}
        </h4>
        {(entryChangeType === 'spending' || entryChangeType === 'refund') && (
          <div className="text-xs mb-2 text-muted-foreground bg-yellow-50 p-2 rounded border border-yellow-200">
            <strong>📌 Σημαντικό:</strong> Τα ποσά "Προηγούμενο" και "Νέο" δείχνουν το <strong>διαθέσιμο υπόλοιπο</strong> 
            (Κατανομή - Δαπάνες), <strong>ΟΧΙ</strong> τα ποσά των εγγράφων.
            {entryChangeType === 'spending' && 
              <div className="mt-1">Το διαθέσιμο μειώνεται κατά το ποσό του εγγράφου που δημιουργήθηκε.</div>
            }
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Προηγούμενο Διαθέσιμο</span>
            <div className="font-medium">{formatCurrency(previous_amount || 0)}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Νέο Διαθέσιμο</span>
            <div className="font-medium">{formatCurrency(new_amount || 0)}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Διαφορά</span>
            <div className={
              // For spending/refund entries: decrease is expected (neutral/red for spending, green for refund)
              // Show red for spending decrease (budget reduced), green for refund increase (budget restored)
              (entryChangeType === 'spending' || entryChangeType === 'refund')
                ? ((new_amount || 0) > (previous_amount || 0) 
                    ? "font-medium text-green-600"  // Available increased (refund) = good
                    : (new_amount || 0) < (previous_amount || 0) 
                      ? "font-medium text-red-600"  // Available decreased (spending) = expected but show in red
                      : "font-medium")
                : ((new_amount || 0) > (previous_amount || 0) 
                    ? "font-medium text-green-600"  // Other types: increase = good
                    : (new_amount || 0) < (previous_amount || 0) 
                      ? "font-medium text-red-600"  // Other types: decrease = bad
                      : "font-medium")
            }>
              {formatCurrency((new_amount || 0) - (previous_amount || 0))}
            </div>
          </div>
        </div>
      </div>
    ) : null;

    // Display actual document amount for spending/refund
    const documentAmountSection = (entryChangeType === 'spending' || entryChangeType === 'refund') ? (
      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
        <div className="text-xs font-medium text-blue-900">Πραγματικό Ποσό Εγγράφου</div>
        <div className="text-sm font-semibold text-blue-700">
          {formatCurrency(Math.abs((new_amount || 0) - (previous_amount || 0)))}
        </div>
        <div className="text-xs text-blue-600 mt-1">
          (Αυτό είναι το ποσό του εγγράφου που αλλάζει το διαθέσιμο)
        </div>
      </div>
    ) : null;

    // Fallback: Display previous_version if available
    const previousVersionSection = Object.keys(previous_version || {}).length > 0 ? (
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

    // Fallback: Display updated_version if available
    const updatedVersionSection = Object.keys(updated_version || {}).length > 0 ? (
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

    // Display changes info if available
    const changesSection = Object.keys(changes || {}).length > 0 ? (
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
        {metadata.sequence_in_batch && (
          <div className="mb-1">
            <span className="font-medium">Σειρά στο Batch:</span> {metadata.sequence_in_batch}
          </div>
        )}
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
        {metadata.retroactive_flag && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-300 rounded">
            <Badge className="bg-orange-100 text-orange-900 text-xs">
              ⏮️ Εισαγωγή στο Παρελθόν
            </Badge>
            {metadata.prior_newest_timestamp && (
              <div className="text-xs text-orange-700 mt-1">
                Προσθέθηκε μετά από την {format(new Date(metadata.prior_newest_timestamp), 'dd/MM/yyyy HH:mm:ss')}
              </div>
            )}
          </div>
        )}
      </div>
    );

    return (
      <div className="border-t mt-2 pt-2">
        {projectInfoSection}
        {amountChangeSection}
        {documentAmountSection}
        {budgetValuesSection}
        {changeReasonSection}
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
            <div className="flex flex-col gap-6 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Ιστορικό Προϋπολογισμού</h1>
                  <p className="text-muted-foreground">
                    Παρακολούθηση όλων των αλλαγών προϋπολογισμού με λεπτομερείς πληροφορίες
                    {(isManager || isAdmin) && (
                      <span className="ml-2 text-blue-600 font-medium">
                        • Διαχειριστικό περιβάλλον
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => refetch()} size="sm" title="Ανανέωση">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Ανανέωση
                  </Button>
                  {(isManager || isAdmin) && (
                    <Button variant="outline" onClick={clearAllFilters} size="sm">
                      Καθαρισμός Φίλτρων
                    </Button>
                  )}
                  {(isManager || isAdmin) && (
                    <Button variant="outline" onClick={handleExcelExport} size="sm" title="Εξαγωγή σε Excel">
                      <Download className="h-4 w-4 mr-2" />
                      Εξαγωγή Excel
                    </Button>
                  )}
                </div>
              </div>

              {/* Compact Horizontal Filters Section */}
              {(isManager || isAdmin) && (
                <Card className="p-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter Label */}
                    <div className="flex items-center gap-2 px-2 py-1 bg-blue-100 rounded-md border border-blue-300">
                      <Filter className="h-4 w-4 text-blue-700" />
                      <span className="text-sm font-semibold text-blue-900">Φίλτρα</span>
                    </div>
                    
                    {/* Divider */}
                    <div className="h-8 w-px bg-blue-300" />
                    
                    {/* NA853 Filter with Icon */}
                    <div className="relative">
                      <FileText className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        placeholder="ΝΑ853"
                        value={na853Filter}
                        onChange={(e) => setNa853Filter(e.target.value)}
                        className="h-9 w-[130px] pl-8 bg-white"
                      />
                    </div>
                    
                    {/* Expenditure Type */}
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                      <Select value={expenditureTypeFilter} onValueChange={setExpenditureTypeFilter}>
                        <SelectTrigger className="h-9 w-[150px] pl-8 bg-white">
                          <SelectValue placeholder="Τύπος Δαπάνης" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλοι οι τύποι</SelectItem>
                          {expenditureTypes?.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.expenditure_types}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Change Type */}
                    <div className="relative">
                      <GitBranch className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                      <Select value={changeType} onValueChange={handleChangeTypeChange}>
                        <SelectTrigger className="h-9 w-[140px] pl-8 bg-white">
                          <SelectValue placeholder="Τύπος Αλλαγής" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλες</SelectItem>
                          <SelectItem value="spending">Δαπάνη</SelectItem>
                          <SelectItem value="refund">Επιστροφή</SelectItem>
                          <SelectItem value="document_created">Δημιουργία</SelectItem>
                          <SelectItem value="import">Εισαγωγή</SelectItem>
                          <SelectItem value="quarter_change">Αλλαγή Τριμ.</SelectItem>
                          <SelectItem value="year_end_closure">Κλείσιμο</SelectItem>
                          <SelectItem value="manual_adjustment">Χειροκίνητη</SelectItem>
                          <SelectItem value="notification_created">Ειδοποίηση</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Creator Filter */}
                    <div className="relative">
                      <UserIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                      <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                        <SelectTrigger className="h-9 w-[140px] pl-8 bg-white">
                          <SelectValue placeholder="Δημιουργός" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλοι</SelectItem>
                          {unitUsers.map((user: any) => (
                            <SelectItem key={user.id} value={user.name}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Divider */}
                    <div className="h-8 w-px bg-blue-300" />
                    
                    {/* Date Filters with Icons */}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <Input
                        type="date"
                        value={dateFilter.from}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                        className="h-9 w-[140px] bg-white text-sm"
                        title="Από (00:00:00)"
                      />
                      <span className="text-gray-400 font-medium">→</span>
                      <Input
                        type="date"
                        value={dateFilter.to}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                        className="h-9 w-[140px] bg-white text-sm"
                        title="Έως (23:59:59)"
                      />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-auto">
                      <Button onClick={applyAllFilters} size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">
                        <Search className="h-3 w-3 mr-1" />
                        Αναζήτηση
                      </Button>
                      <Button onClick={clearAllFilters} variant="outline" size="sm" className="h-9 border-blue-300 hover:bg-blue-100">
                        Καθαρισμός
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Simple filters for regular users */}
              {!isManager && !isAdmin && (
                <div className="flex flex-wrap gap-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Φίλτρο με NA853..."
                      value={na853Filter}
                      onChange={(e) => setNa853Filter(e.target.value)}
                      className="w-[180px]"
                    />
                    <Button onClick={applyNa853Filter} size="icon" variant="outline">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={expenditureTypeFilter} onValueChange={setExpenditureTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Τύπος δαπάνης" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Όλοι οι τύποι</SelectItem>
                      {expenditureTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.expenditure_types}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={changeType} onValueChange={handleChangeTypeChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Φίλτρο ανά τύπο" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Όλες οι αλλαγές</SelectItem>
                      <SelectItem value="spending">Δαπάνη</SelectItem>
                      <SelectItem value="refund">Επιστροφή</SelectItem>
                      <SelectItem value="document_created">Δημιουργία Εγγράφου</SelectItem>
                      <SelectItem value="import">Εισαγωγή δεδομένων</SelectItem>
                      <SelectItem value="quarter_change">Αλλαγή Τριμήνου</SelectItem>
                      <SelectItem value="year_end_closure">Κλείσιμο Έτους</SelectItem>
                      <SelectItem value="manual_adjustment">Χειροκίνητη Προσαρμογή</SelectItem>
                      <SelectItem value="notification_created">Δημιουργία Ειδοποίησης</SelectItem>
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
                </div>
              )}

              {/* Statistics Section - Στατιστικά Περιόδου */}
              {statistics && (isManager || isAdmin) && (
                <Card className="p-3 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    <h3 className="font-medium text-green-900">Στατιστικά Περιόδου</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="bg-white text-xs cursor-help">
                            ℹ️ Όλες τις σειρές
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            Στατιστικά υπολογίζονται για όλες τις σειρές που ταιριάζουν με τα φίλτρα,
                            όχι μόνο για τις σειρές που εμφανίζονται σε αυτήν τη σελίδα.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* Total Entries */}
                    <div className="bg-white px-3 py-2 rounded border border-green-100 flex items-center gap-2">
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Εγγραφές</p>
                        <p className="text-lg font-bold text-green-700">{statistics.totalEntries}</p>
                      </div>
                    </div>

                    {/* Total Amount Change */}
                    <div className="bg-white px-3 py-2 rounded border border-blue-100 flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        statistics.totalAmountChange >= 0 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {statistics.totalAmountChange >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Μεταβολή</p>
                        <p className={`text-lg font-bold ${statistics.totalAmountChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(statistics.totalAmountChange)}
                        </p>
                      </div>
                    </div>

                    {/* Period Range */}
                    <div className="bg-white px-3 py-2 rounded border border-purple-100 flex items-center gap-2">
                      <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Info className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Περίοδος</p>
                        {statistics.periodRange.start && statistics.periodRange.end ? (
                          <p className="text-sm font-medium text-purple-700">
                            {format(new Date(statistics.periodRange.start), 'dd/MM/yy')} - {format(new Date(statistics.periodRange.end), 'dd/MM/yy')}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">N/A</p>
                        )}
                      </div>
                    </div>

                    {/* Change Types Distribution */}
                    {Object.keys(statistics.changeTypes).length > 0 && Object.entries(statistics.changeTypes).length > 0 && (
                      <div className="bg-white px-3 py-2 rounded border border-gray-100">
                        <p className="text-sm text-gray-600 mb-1">Αλλαγές ανά Τύπο</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(statistics.changeTypes).map(([type, count]) => (
                            <div key={type} className="text-xs font-medium px-2 py-1 bg-gray-50 rounded flex items-center gap-1">
                              {getChangeTypeBadge(type)}
                              <span>{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
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
                <div className="flex flex-col items-center justify-center h-48 p-4">
                  <Info className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Δεν βρέθηκαν εγγραφές</h3>
                  
                  {appliedNa853Filter || appliedDateFilter.from || appliedDateFilter.to || changeType !== 'all' ? (
                    <div className="text-sm text-muted-foreground max-w-sm text-center">
                      <p className="mb-3">Δεν υπάρχουν αποτελέσματα που να ταιριάζουν με τα ενεργά φίλτρα:</p>
                      <ul className="text-xs bg-gray-50 p-2 rounded mb-3 text-left">
                        {appliedNa853Filter && <li>• <strong>NA853:</strong> {appliedNa853Filter}</li>}
                        {appliedDateFilter.from && <li>• <strong>Από:</strong> {appliedDateFilter.from}</li>}
                        {appliedDateFilter.to && <li>• <strong>Έως:</strong> {appliedDateFilter.to}</li>}
                        {changeType !== 'all' && <li>• <strong>Τύπος:</strong> {changeType}</li>}
                      </ul>
                      <Button onClick={clearAllFilters} variant="link" size="sm" className="text-blue-600 hover:text-blue-800">
                        Καθαρίστε τα φίλτρα και δοκιμάστε ξανά →
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Δεν υπάρχουν αρχεία ιστορίας προϋπολογισμού σε αυτή τη στιγμή.
                      Τα δεδομένα θα εμφανιστούν εδώ όταν δημιουργηθούν νέα ιστορικά.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Ημερομηνία</TableHead>
                          <TableHead>Κωδικός ΝΑ853</TableHead>
                          <TableHead>
                            Προηγούμενο
                            <span className="text-xs text-muted-foreground block font-normal">(Διαθέσιμο)</span>
                          </TableHead>
                          <TableHead>
                            Νέο
                            <span className="text-xs text-muted-foreground block font-normal">(Διαθέσιμο)</span>
                          </TableHead>
                          <TableHead>
                            Αλλαγή
                            <span className="text-xs text-muted-foreground block font-normal">(Δαπάνη Εγγράφου)</span>
                          </TableHead>
                          <TableHead>Τύπος</TableHead>
                          <TableHead>Αιτιολογία</TableHead>
                          <TableHead>Δημιουργήθηκε από</TableHead>
                          <TableHead>Έγγραφο</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedHistory.map((group, groupIndex) => {
                          if (group.isBatch && group.batchId) {
                            return <BatchGroup key={group.batchId} entries={group.entries} batchId={group.batchId} />;
                          }
                          
                          // Single entry (not part of a batch)
                          const entry = group.entries[0];
                          const previousAmount = parseFloat(entry.previous_amount);
                          const newAmount = parseFloat(entry.new_amount);
                          const change = newAmount - previousAmount;
                          const isExpanded = expandedRows[entry.id] || false;
                          
                          // Use two separate table rows instead of nesting the Collapsible in wrong DOM structure
                          return (
                            <React.Fragment key={entry.id}>
                              <TableRow 
                                className="cursor-pointer hover:bg-muted/50 transition-colors" 
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setEntryDetailsOpen(true);
                                }}
                              >
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  {entry.created_at 
                                    ? format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')
                                    : 'N/A'}
                                </TableCell>
                                <TableCell 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (entry.project_id) {
                                      setSelectedProject({ id: entry.project_id, mis: entry.mis, na853: entry.na853 });
                                      setProjectDialogOpen(true);
                                    }
                                  }}
                                  className={entry.project_id ? "cursor-pointer hover:underline text-blue-600" : ""}
                                  data-testid={`link-project-${entry.id}`}
                                >
                                  {entry.na853 || entry.mis || 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{formatCurrency(previousAmount)}</div>
                                  {previousAmount > 0 && <div className="text-xs text-muted-foreground">Προηγούμενη τιμή</div>}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{formatCurrency(newAmount)}</div>
                                  {newAmount > 0 && <div className="text-xs text-muted-foreground">Νέα τιμή</div>}
                                </TableCell>
                                <TableCell>
                                  <div className={`font-medium ${change < 0 ? "text-red-500" : change > 0 ? "text-green-500" : ""}`}>
                                    {change === 0 ? '-' : (
                                      <>
                                        {change > 0 ? '+' : ''}
                                        {formatCurrency(change)}
                                      </>
                                    )}
                                  </div>
                                  {change !== 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {change > 0 ? 'Αύξηση' : 'Μείωση'} {Math.abs(Math.round((change / (previousAmount || 1)) * 100))}%
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {entry.change_type ? getChangeTypeBadge(entry.change_type) : '-'}
                                </TableCell>
                                <TableCell>
                                  {entry.change_reason ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="max-w-[200px] truncate hover:cursor-help">
                                            {entry.change_reason.replace('Updated from Excel import for', 'Εισαγωγή από Excel για')}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="start" className="max-w-[400px] p-3">
                                          <div className="text-xs whitespace-pre-wrap">
                                            {entry.change_reason.replace('Updated from Excel import for', 'Εισαγωγή από Excel για')}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center">
                                    <UserIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="hover:cursor-help">{entry.created_by || 'Σύστημα'}</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className="text-xs">
                                            ID: {entry.created_by_id || 'N/A'}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {entry.document_id ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge 
                                            className={`${
                                              entry.document_status 
                                                ? `cursor-pointer hover:opacity-80 ${getDocumentStatusDetails(entry.document_status).className}` 
                                                : 'bg-gray-400 text-white cursor-not-allowed'
                                            }`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (entry.document_status) {
                                                setSelectedDocumentId(entry.document_id!);
                                                setDocumentModalOpen(true);
                                              }
                                            }}
                                            data-testid={`link-document-${entry.id}`}
                                          >
                                            <FileText className="h-3 w-3 mr-1" />
                                            {entry.protocol_number_input 
                                              ? `Αρ. Πρωτ.: ${entry.protocol_number_input}` 
                                              : entry.document_status 
                                                ? getDocumentStatusDetails(entry.document_status).label
                                                : 'Έγγραφο Διαγραμμένο'}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            {entry.document_status ? (
                                              <>
                                                {entry.protocol_number_input ? (
                                                  <div>Αρ. Πρωτ.: {entry.protocol_number_input}</div>
                                                ) : (
                                                  <div>ID Εγγράφου: {entry.document_id}</div>
                                                )}
                                                <div className="mt-1">Κλικ για λεπτομέρειες</div>
                                              </>
                                            ) : (
                                              <div>Το έγγραφο έχει διαγραφεί.<br/>Η εγγραφή διατηρείται για λόγους ελέγχου.</div>
                                            )}
                                          </div>
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
                                    <div className="space-y-4">
                                      {entry.document_id && (
                                        <div className="bg-blue-50/30 border border-blue-200 rounded-lg p-4">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <FileText className="h-4 w-4 text-blue-600" />
                                              <span className="text-sm font-medium text-blue-900">Συνδεδεμένο έγγραφο</span>
                                            </div>
                                            <Button 
                                              size="sm" 
                                              onClick={() => {
                                                setSelectedDocumentId(entry.document_id!);
                                                setDocumentModalOpen(true);
                                              }}
                                              data-testid={`button-view-document-${entry.id}`}
                                            >
                                              <FileText className="h-4 w-4 mr-2" />
                                              Προβολή Πλήρων Στοιχείων
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      {entry.metadata ? renderMetadata(entry.metadata, entry.change_type) : (
                                        <div className="text-muted-foreground text-sm italic">
                                          Δεν υπάρχουν διαθέσιμα επιπρόσθετα μεταδεδομένα
                                        </div>
                                      )}
                                    </div>
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
                      Εμφάνιση {((page - 1) * limit) + 1} έως {Math.min(page * limit, pagination.total)} 
                      από <strong>{pagination.total} εγγραφές που ταιριάζουν με τα φίλτρα</strong>
                      {appliedNa853Filter || appliedDateFilter.from || changeType !== 'all' ? ' (φιλτραρισμένες)' : ' (όλες)'}
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
      
      {/* Project Details Modal */}
      {selectedProject && (
        <ProjectDetailsDialog
          project={selectedProject}
          open={projectDialogOpen}
          onOpenChange={setProjectDialogOpen}
        />
      )}
      
      {/* Document Details Modal */}
      {selectedDocument && (
        <DocumentDetailsModal
          document={selectedDocument}
          open={documentModalOpen}
          onOpenChange={setDocumentModalOpen}
        />
      )}
      
      {/* Entry Details Dialog */}
      <Dialog open={entryDetailsOpen} onOpenChange={setEntryDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Λεπτομέρειες Εγγραφής Ιστορικού</DialogTitle>
            <DialogDescription>
              Πλήρεις πληροφορίες για την επιλεγμένη αλλαγή προϋπολογισμού
            </DialogDescription>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4 mt-4">
              {/* Basic Info Card */}
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Βασικές Πληροφορίες
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Ημερομηνία:</span>
                    <div className="text-gray-900">
                      {selectedEntry.created_at 
                        ? format(new Date(selectedEntry.created_at), 'dd/MM/yyyy HH:mm:ss')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Κωδικός ΝΑ853:</span>
                    <div className="text-gray-900">{selectedEntry.na853 || selectedEntry.mis || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Τύπος Αλλαγής:</span>
                    <div>{selectedEntry.change_type ? getChangeTypeBadge(selectedEntry.change_type) : '-'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Δημιουργήθηκε από:</span>
                    <div className="flex items-center gap-1">
                      {getOperationTypeBadge(selectedEntry.change_reason, selectedEntry.created_by)}
                      <span className="ml-1">{selectedEntry.created_by || 'Σύστημα'}</span>
                    </div>
                  </div>
                </div>
              </Card>
              
              {/* Budget Changes Card */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Μεταβολές Προϋπολογισμού</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Προηγούμενο (Διαθέσιμο)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(parseFloat(selectedEntry.previous_amount))}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-2xl font-bold text-gray-400">→</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Νέο (Διαθέσιμο)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(parseFloat(selectedEntry.new_amount))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center border border-blue-200">
                  <div className="text-xs text-blue-700 mb-1">Αλλαγή</div>
                  <div className={`text-xl font-bold ${
                    parseFloat(selectedEntry.new_amount) - parseFloat(selectedEntry.previous_amount) < 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {parseFloat(selectedEntry.new_amount) - parseFloat(selectedEntry.previous_amount) > 0 ? '+' : ''}
                    {formatCurrency(parseFloat(selectedEntry.new_amount) - parseFloat(selectedEntry.previous_amount))}
                  </div>
                </div>
              </Card>
              
              {/* Change Reason Card */}
              {selectedEntry.change_reason && (
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Αιτιολογία</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedEntry.change_reason.replace('Updated from Excel import for', 'Εισαγωγή από Excel για')}
                  </p>
                </Card>
              )}
              
              {/* Document Info Card */}
              {selectedEntry.document_id && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-blue-600" />
                      <div>
                        <div className="font-semibold text-blue-900">Έγγραφο #{selectedEntry.document_id}</div>
                        <div className="text-sm text-blue-700">
                          {selectedEntry.document_protocol_number 
                            ? `Αρ. Πρωτ: ${selectedEntry.document_protocol_number}`
                            : 'Χωρίς αριθμό πρωτοκόλλου'}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedDocumentId(selectedEntry.document_id);
                        setDocumentModalOpen(true);
                        setEntryDetailsOpen(false);
                      }}
                      size="sm"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Προβολή Εγγράφου
                    </Button>
                  </div>
                </Card>
              )}
              
              {/* Metadata Card */}
              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Επιπρόσθετα Μεταδεδομένα</h3>
                  <div className="space-y-2">
                    {renderMetadata(selectedEntry.metadata, selectedEntry.change_type)}
                  </div>
                </Card>
              )}
              
              {/* Project Link */}
              {selectedEntry.project_id && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedProject({ 
                        id: selectedEntry.project_id, 
                        mis: selectedEntry.mis, 
                        na853: selectedEntry.na853 
                      });
                      setProjectDialogOpen(true);
                      setEntryDetailsOpen(false);
                    }}
                  >
                    Προβολή Πλήρων Στοιχείων Έργου
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}