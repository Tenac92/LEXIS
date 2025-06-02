import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { FileText, Filter, RefreshCcw, LayoutGrid, List } from "lucide-react";
import { DocumentCard } from "@/components/documents/document-card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ViewDocumentModal, EditDocumentModal, DeleteDocumentModal } from "@/components/documents/document-modals";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { FAB } from "@/components/ui/fab";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
// Removed direct Supabase import
import type { GeneratedDocument } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface Filters {
  unit: string;
  status: string;
  user: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  recipient: string;
  afm: string;
}

interface User {
  id: number;
  role: string;
  units?: string[];
  name?: string;
}

export default function DocumentsPage() {
  const { user } = useAuth() as { user: User };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [modalState, setModalState] = useState<{
    view: boolean;
    edit: boolean;
    delete: boolean;
  }>({
    view: false,
    edit: false,
    delete: false,
  });

  // Check if URL is /documents/new and open create dialog
  useEffect(() => {
    if (location === '/documents/new') {
      setShowCreateDialog(true);
      // Change URL to /documents without triggering a reload
      setLocation('/documents', { replace: true });
    }
  }, [location, setLocation]);

  // Initialize both main filters and advanced filters states
  const [filters, setFilters] = useState<Filters>({
    unit: user?.units?.[0] || '',
    status: 'pending',
    user: 'all',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    recipient: '',
    afm: ''
  });

  // Ensure unit filter defaults to user's unit when authentication completes
  useEffect(() => {
    if (user?.units?.[0] && !filters.unit) {
      setFilters(prev => ({
        ...prev,
        unit: user.units[0]
      }));
    }
  }, [user?.units, filters.unit]);
  
  // For advanced filters, we'll keep a separate state that doesn't trigger refresh
  const [advancedFilters, setAdvancedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    recipient: '',
    afm: ''
  });

  // For main category filters (unit, status, user) - apply immediately
  const setMainFilters = (newFilters: Partial<Filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    // Always refresh for main filters
    refetch();
  };
  
  // For advanced filters - only store the values, don't refresh
  const setAdvancedFilterValues = (newValues: Partial<typeof advancedFilters>) => {
    setAdvancedFilters(prev => ({ ...prev, ...newValues }));
  };
  
  // Apply advanced filters only when button is clicked
  const applyAdvancedFilters = () => {
    // Update the main filters with advanced filter values
    setFilters(prev => ({
      ...prev,
      ...advancedFilters
    }));
    // Then trigger a refresh
    refetch();
  };

  // Fetch users with same units
  const { data: matchingUsers = [] } = useQuery({
    queryKey: ['/api/users/matching-units'],
    queryFn: async () => {
      const response = await apiRequest('/api/users/matching-units');
      return response || [];
    },
    enabled: !!user?.units
  });

  // Query for documents using the server API endpoint
  const { data: documents = [], isLoading, error, refetch } = useQuery<GeneratedDocument[]>({
    queryKey: ['/api/documents', filters],
    queryFn: async () => {
      try {
        // Fetching documents with current filters
        console.log('[DocumentsPage] Fetching documents with filters:', JSON.stringify(filters));
        
        // Build query parameters for the API request
        const queryParams = new URLSearchParams();
        
        // Always enforce unit filter - users can only see their assigned units
        if (filters.unit) {
          // Verify the selected unit is in user's authorized units
          if (user?.units?.includes(filters.unit)) {
            queryParams.append('unit', filters.unit);
          } else {
            // If unauthorized unit, default to first authorized unit
            if (user?.units?.[0]) {
              queryParams.append('unit', user.units[0]);
            }
          }
        } else {
          // If no unit selected, default to first authorized unit
          if (user?.units?.[0]) {
            queryParams.append('unit', user.units[0]);
          }
        }
        
        if (filters.status !== 'all') {
          queryParams.append('status', filters.status);
        }
        
        if (filters.user === 'current' && user?.id) {
          queryParams.append('generated_by', user.id.toString());
        } else if (filters.user !== 'all') {
          queryParams.append('generated_by', filters.user);
        }
        
        if (filters.dateFrom) {
          queryParams.append('dateFrom', filters.dateFrom);
        }
        
        if (filters.dateTo) {
          queryParams.append('dateTo', filters.dateTo);
        }
        
        if (filters.amountFrom) {
          queryParams.append('amountFrom', filters.amountFrom);
        }
        
        if (filters.amountTo) {
          queryParams.append('amountTo', filters.amountTo);
        }
        
        if (filters.recipient) {
          queryParams.append('recipient', filters.recipient);
        }
        
        if (filters.afm) {
          queryParams.append('afm', filters.afm);
        }
        
        const url = `/api/documents?${queryParams.toString()}`;
        console.log('[DocumentsPage] Requesting documents from:', url);
        
        const data = await apiRequest<GeneratedDocument[]>(url);
        
        // Ensure we always return an array, even if API returns null or undefined
        const documentsArray = Array.isArray(data) ? data : [];
        console.log(`[DocumentsPage] Received ${documentsArray.length} documents`);
        
        return documentsArray;
      } catch (error) {
        // Log error and notify user about document fetch failure
        console.error('[DocumentsPage] Error fetching documents:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch documents",
          variant: "destructive",
        });
        // Return empty array in case of error
        return [];
      }
    }
  });

  // Handle document refresh
  const handleRefresh = () => {
    // Manual refresh triggered by user
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FileText className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-destructive">
        <FileText className="h-12 w-12 mb-4" />
        <p>Failed to load documents</p>
        {error instanceof Error && <p className="text-sm mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            {/* Header with Actions */}
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
              <h1 className="text-2xl font-bold text-foreground">Έγγραφα</h1>
              <div className="flex flex-wrap gap-2">
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-none"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Νέο Έγγραφο
                </Button>
              </div>
            </div>

            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Μονάδα</label>
                <Select
                  value={filters.unit}
                  onValueChange={(value: string) => setMainFilters({ unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε μονάδα" />
                  </SelectTrigger>
                  <SelectContent>
                    {user?.units?.map((unit: string) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Κατάσταση</label>
                <Select
                  value={filters.status}
                  onValueChange={(value: string) => setMainFilters({ status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε κατάσταση" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all" value="all">Όλες οι Καταστάσεις</SelectItem>
                    <SelectItem key="pending" value="pending">Σε Εκκρεμότητα</SelectItem>
                    <SelectItem key="completed" value="completed">Ολοκληρωμένο</SelectItem>
                    <SelectItem key="orthi_epanalipsi" value="orthi_epanalipsi">Ορθή Επανάληψη</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Χρήστης</label>
                <Select
                  value={filters.user}
                  onValueChange={(value: string) => setMainFilters({ user: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε χρήστη" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all-users" value="all">Όλοι οι Χρήστες</SelectItem>
                    <SelectItem key="current-user" value="current">Τα Έγγραφά μου</SelectItem>
                    {Array.isArray(matchingUsers) && matchingUsers.map((u: { id: number; name?: string; email?: string }) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Προχωρημένα Φίλτρα
                  </span>
                  {(advancedFilters.dateFrom || advancedFilters.dateTo || 
                    advancedFilters.amountFrom || advancedFilters.amountTo || 
                    advancedFilters.recipient || advancedFilters.afm) && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                      Ενεργά
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Προχωρημένα Φίλτρα</SheetTitle>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Εύρος Ημερομηνιών</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Από</label>
                        <Input
                          type="date"
                          value={advancedFilters.dateFrom}
                          onChange={(e) => setAdvancedFilterValues({ dateFrom: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Έως</label>
                        <Input
                          type="date"
                          value={advancedFilters.dateTo}
                          onChange={(e) => setAdvancedFilterValues({ dateTo: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Εύρος Ποσού</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Από</label>
                        <Input
                          type="number"
                          placeholder="Ελάχιστο ποσό"
                          value={advancedFilters.amountFrom}
                          onChange={(e) => setAdvancedFilterValues({ amountFrom: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Έως</label>
                        <Input
                          type="number"
                          placeholder="Μέγιστο ποσό"
                          value={advancedFilters.amountTo}
                          onChange={(e) => setAdvancedFilterValues({ amountTo: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Αναζήτηση Παραλήπτη</label>
                    <Input
                      placeholder="Αναζήτηση με όνομα παραλήπτη"
                      value={advancedFilters.recipient}
                      onChange={(e) => setAdvancedFilterValues({ recipient: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ΑΦΜ</label>
                    <Input
                      placeholder="Αναζήτηση με ΑΦΜ"
                      value={advancedFilters.afm}
                      onChange={(e) => setAdvancedFilterValues({ afm: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => {
                      setAdvancedFilterValues({
                        dateFrom: '',
                        dateTo: '',
                        amountFrom: '',
                        amountTo: '',
                        recipient: '',
                        afm: ''
                      });
                    }}
                  >
                    Καθαρισμός
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1" onClick={applyAdvancedFilters}>Εφαρμογή</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                variant="default"
                className="flex items-center gap-2"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Ανανέωση
              </Button>
            </div>
          </div>

          {/* Documents */}
          <div className="p-6">
            {isLoading ? (
              <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {[...Array(6)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="h-48 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : documents?.length ? (
              <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    view={viewMode}
                    onView={() => {
                      setSelectedDocument(doc);
                      setModalState(prev => ({ ...prev, view: true }));
                    }}
                    onEdit={() => {
                      setSelectedDocument(doc);
                      setModalState(prev => ({ ...prev, edit: true }));
                    }}
                    onDelete={() => {
                      setSelectedDocument(doc);
                      setModalState(prev => ({ ...prev, delete: true }));
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p>Δεν βρέθηκαν έγγραφα</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modals */}
      <ViewDocumentModal
        isOpen={modalState.view}
        onClose={() => setModalState(prev => ({ ...prev, view: false }))}
        document={selectedDocument}
      />

      <EditDocumentModal
        isOpen={modalState.edit}
        onClose={() => setModalState(prev => ({ ...prev, edit: false }))}
        document={selectedDocument || undefined}
        onEdit={(id: string) => {
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
        }}
      />

      <DeleteDocumentModal
        isOpen={modalState.delete}
        onClose={() => setModalState(prev => ({ ...prev, delete: false }))}
        documentId={selectedDocument?.id.toString() || ''}
        onDelete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
        }}
      />

      <CreateDocumentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {user && <FAB />}
    </div>
  );
}