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
  User as UserIcon
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

// Hook to fetch users from the same unit for the creator filter
const useUnitUsers = (userUnits: string[] | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['unitUsers', userUnits],
    queryFn: async () => {
      if (!userUnits || userUnits.length === 0) return [];
      try {
        const response = await fetch('/api/users/matching-units');
        if (!response.ok) return [];
        const data = await response.json();
        return data.filter((user: any) => 
          user.units && user.units.some((unit: string) => userUnits.includes(unit))
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

// Component που εμφανίζει το document_id ή το protocol_number_input αν υπάρχει
const BudgetHistoryDocument = ({ documentId, status }: { documentId: number, status?: string }) => {
  const { protocolNumberInput, isLoading } = useDocumentProtocolNumber(documentId);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={status === 'completed' ? "default" : "outline"}>
            <FileText className="h-3 w-3 mr-1" />
            {status === 'completed' ? 'Ολοκληρωμένο' : 
              protocolNumberInput ? `Αρ. Πρωτ.: ${protocolNumberInput}` :
              status === 'pending' ? 'Σε εκκρεμότητα' : 
              status || 'Σε εκκρεμότητα'}
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
  mis: string;
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
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [creatorFilter, setCreatorFilter] = useState<string>('');

  // Used to submit filters
  const [appliedMisFilter, setAppliedMisFilter] = useState<string>('');
  const [appliedDateFilter, setAppliedDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [appliedCreatorFilter, setAppliedCreatorFilter] = useState<string>('');

  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  // Fetch users from the same unit for the creator dropdown
  const { unitUsers, isLoadingUsers } = useUnitUsers(user?.units);

  // Reset to page 1 when filters change
  const applyMisFilter = () => {
    setPage(1);
    setAppliedMisFilter(misFilter);
  };

  // Apply all filters
  const applyAllFilters = () => {
    setPage(1);
    setAppliedMisFilter(misFilter);
    setAppliedDateFilter(dateFilter);
    setAppliedCreatorFilter(creatorFilter === 'all' ? '' : creatorFilter);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setPage(1);
    setMisFilter('');
    setDateFilter({ from: '', to: '' });
    setCreatorFilter('all');
    setAppliedMisFilter('');
    setAppliedDateFilter({ from: '', to: '' });
    setAppliedCreatorFilter('');
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
    queryKey: ['/api/budget/history', page, limit, changeType, appliedMisFilter, appliedDateFilter, appliedCreatorFilter],
    queryFn: async () => {
      let url = `/api/budget/history?page=${page}&limit=${limit}`;
      
      if (changeType !== 'all') {
        url += `&change_type=${changeType}`;
      }
      
      if (appliedMisFilter) {
        url += `&mis=${appliedMisFilter}`;
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
        protocol_number_input: entry.protocol_number_input, // Include protocol number from backend
        created_by: entry.created_by || 'Σύστημα',
        created_by_id: entry.created_by_id || '',
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
      case 'document_created':
        return <Badge variant="destructive">Δημιουργία Εγγράφου</Badge>;
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
              let cleanValue = value.trim();
              
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
    let projectInfo = {
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
          {entryChangeType === 'document_created' 
            ? 'Μεταβολή Διαθέσιμου Προϋπολογισμού' 
            : 'Αλλαγή Ποσού'}
        </h4>
        {entryChangeType === 'document_created' && (
          <div className="text-xs mb-2 text-muted-foreground">
            Η δημιουργία εγγράφου μειώνει το διαθέσιμο προϋπολογισμό (διαφορά κατανομών έτους και ποσού διαβιβάσεων)
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Προηγούμενο</span>
            <div className="font-medium">{formatCurrency(previous_amount || 0)}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Νέο</span>
            <div className="font-medium">{formatCurrency(new_amount || 0)}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Διαφορά</span>
            <div className={
              (new_amount || 0) > (previous_amount || 0) 
                ? "font-medium text-green-600" 
                : (new_amount || 0) < (previous_amount || 0) 
                  ? "font-medium text-red-600" 
                  : "font-medium"
            }>
              {formatCurrency((new_amount || 0) - (previous_amount || 0))}
            </div>
          </div>
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
        {projectInfoSection}
        {amountChangeSection}
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
                </div>
              </div>

              {/* Enhanced Filters Section for Managers */}
              {(isManager || isAdmin) && (
                <Card className="p-4 bg-blue-50/50 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Προηγμένα Φίλτρα Αναζήτησης</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">MIS Έργου</label>
                      <Input
                        placeholder="π.χ. 5174085"
                        value={misFilter}
                        onChange={(e) => setMisFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Τύπος Αλλαγής</label>
                      <Select value={changeType} onValueChange={handleChangeTypeChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε τύπο" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλες οι αλλαγές</SelectItem>
                          <SelectItem value="document_created">Δημιουργία Εγγράφου</SelectItem>
                          <SelectItem value="manual_adjustment">Χειροκίνητη Προσαρμογή</SelectItem>
                          <SelectItem value="notification_created">Δημιουργία Ειδοποίησης</SelectItem>
                          <SelectItem value="import">Εισαγωγή δεδομένων</SelectItem>
                          <SelectItem value="error">Σφάλματα</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Από Ημερομηνία</label>
                      <Input
                        type="date"
                        value={dateFilter.from}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Έως Ημερομηνία</label>
                      <Input
                        type="date"
                        value={dateFilter.to}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Δημιουργήθηκε από</label>
                      <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingUsers ? "Φόρτωση χρηστών..." : "Επιλέξτε χρήστη"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλοι οι χρήστες</SelectItem>
                          {unitUsers.map((user: any) => (
                            <SelectItem key={user.id} value={user.name}>
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-3 w-3 text-gray-500" />
                                {user.name}
                                {user.role === 'manager' && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    Διαχειριστής
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Αποτελέσματα ανά σελίδα</label>
                      <Select
                        value={limit.toString()}
                        onValueChange={(value) => {
                          setPage(1);
                          setLimit(parseInt(value));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 εγγραφές</SelectItem>
                          <SelectItem value="10">10 εγγραφές</SelectItem>
                          <SelectItem value="20">20 εγγραφές</SelectItem>
                          <SelectItem value="50">50 εγγραφές</SelectItem>
                          <SelectItem value="100">100 εγγραφές</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={applyAllFilters} className="flex-1">
                        <Search className="h-4 w-4 mr-2" />
                        Εφαρμογή Φίλτρων
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
                      placeholder="Φίλτρο με MIS..."
                      value={misFilter}
                      onChange={(e) => setMisFilter(e.target.value)}
                      className="w-[180px]"
                    />
                    <Button onClick={applyMisFilter} size="icon" variant="outline">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={changeType} onValueChange={handleChangeTypeChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Φίλτρο ανά τύπο" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Όλες οι αλλαγές</SelectItem>
                      <SelectItem value="document_created">Δημιουργία Εγγράφου</SelectItem>
                      <SelectItem value="manual_adjustment">Χειροκίνητη Προσαρμογή</SelectItem>
                      <SelectItem value="import">Εισαγωγή</SelectItem>
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
                  {/* Summary Statistics for Managers */}
                  {(isManager || isAdmin) && (
                    <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4">Στατιστικά Περιόδου</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {(() => {
                            const totalEntries = history.length;
                            const documentCreations = history.filter(h => h.change_type === 'document_created').length;
                            const manualAdjustments = history.filter(h => h.change_type === 'manual_adjustment').length;
                            const imports = history.filter(h => h.change_type === 'import').length;
                            
                            const totalBudgetChange = history.reduce((sum, entry) => {
                              const prev = parseFloat(entry.previous_amount || '0');
                              const curr = parseFloat(entry.new_amount || '0');
                              return sum + (curr - prev);
                            }, 0);

                            return (
                              <>
                                <div className="text-center p-3 bg-white rounded-lg border">
                                  <div className="text-2xl font-bold text-blue-600">{totalEntries}</div>
                                  <div className="text-sm text-gray-600">Συνολικές Αλλαγές</div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg border">
                                  <div className="text-2xl font-bold text-green-600">{documentCreations}</div>
                                  <div className="text-sm text-gray-600">Δημιουργίες Εγγράφων</div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg border">
                                  <div className="text-2xl font-bold text-orange-600">{manualAdjustments}</div>
                                  <div className="text-sm text-gray-600">Χειροκίνητες Προσαρμογές</div>
                                </div>
                                <div className="text-center p-3 bg-white rounded-lg border">
                                  <div className={`text-2xl font-bold ${totalBudgetChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(totalBudgetChange)}
                                  </div>
                                  <div className="text-sm text-gray-600">Συνολική Μεταβολή</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Recent Activity Summary for Managers */}
                  {(isManager || isAdmin) && history.length > 0 && (
                    <Card className="mb-6 bg-yellow-50/50 border-yellow-200">
                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-yellow-900 mb-3">Πρόσφατη Δραστηριότητα</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {history.slice(0, 5).map((entry) => {
                            const change = parseFloat(entry.new_amount || '0') - parseFloat(entry.previous_amount || '0');
                            return (
                              <div key={entry.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500">
                                    {entry.created_at ? format(new Date(entry.created_at), 'dd/MM HH:mm') : 'N/A'}
                                  </span>
                                  <span className="font-medium">MIS {entry.mis}</span>
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    change > 0 ? 'bg-green-100 text-green-700' : 
                                    change < 0 ? 'bg-red-100 text-red-700' : 
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {change > 0 ? '+' : ''}{formatCurrency(change)}
                                  </span>
                                </div>
                                <div className="text-gray-600">
                                  {entry.created_by || 'Σύστημα'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card>
                  )}
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
                                          <Badge variant={entry.document_status === 'completed' ? "default" : "outline"}>
                                            <FileText className="h-3 w-3 mr-1" />
                                            {entry.document_status === 'completed' ? 'Ολοκληρωμένο' : 
                                             entry.protocol_number_input ? `Αρ. Πρωτ.: ${entry.protocol_number_input}` :
                                             entry.document_status === 'pending' ? 'Σε εκκρεμότητα' : 
                                             entry.document_status || 'Σε εκκρεμότητα'}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            {entry.protocol_number_input ? (
                                              <div>Αρ. Πρωτ.: {entry.protocol_number_input}</div>
                                            ) : (
                                              <div>ID Εγγράφου: {entry.document_id}</div>
                                            )}
                                            <div className="mt-1">Κλικ για προβολή εγγράφου</div>
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
                                    {entry.metadata ? renderMetadata(entry.metadata, entry.change_type) : (
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