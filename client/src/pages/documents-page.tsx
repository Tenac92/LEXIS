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
import { useState } from "react";
import { FileText, Filter, RefreshCcw, LayoutGrid, List } from "lucide-react";
import { DocumentCard } from "@/components/documents/document-card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ViewDocumentModal, EditDocumentModal, DeleteDocumentModal } from "@/components/documents/document-modals";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { FAB } from "@/components/ui/fab";
import { useAuth } from "@/hooks/use-auth";
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [modalState, setModalState] = useState<{
    view: boolean;
    edit: boolean;
    delete: boolean;
  }>({
    view: false,
    edit: false,
    delete: false,
  });

  // Initialize filters and active filters state
  const [filters, setFilters] = useState<Filters>({
    unit: user?.units?.[0] || 'all',
    status: 'pending',
    user: 'all',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    recipient: '',
    afm: ''
  });

  const [activeFilters, setActiveFilters] = useState<Filters>(filters);

  const setFiltersWithRefresh = (newFilters: Filters, shouldRefresh = false) => {
    setFilters(newFilters);
    if (shouldRefresh) {
      handleApplyFilters();
    }
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
    queryKey: ['/api/documents', activeFilters],
    queryFn: async () => {
      try {
        // Fetching documents with current filters
        console.log('[DocumentsPage] Fetching documents with filters:', JSON.stringify(activeFilters));
        
        // Build query parameters for the API request
        const queryParams = new URLSearchParams();
        
        if (activeFilters.unit && activeFilters.unit !== 'all') {
          queryParams.append('unit', activeFilters.unit);
        }
        
        if (activeFilters.status !== 'all') {
          queryParams.append('status', activeFilters.status);
        }
        
        if (activeFilters.user === 'current' && user?.id) {
          queryParams.append('generated_by', user.id.toString());
        } else if (activeFilters.user !== 'all') {
          queryParams.append('generated_by', activeFilters.user);
        }
        
        if (activeFilters.dateFrom) {
          queryParams.append('dateFrom', activeFilters.dateFrom);
        }
        
        if (activeFilters.dateTo) {
          queryParams.append('dateTo', activeFilters.dateTo);
        }
        
        if (activeFilters.amountFrom) {
          queryParams.append('amountFrom', activeFilters.amountFrom);
        }
        
        if (activeFilters.amountTo) {
          queryParams.append('amountTo', activeFilters.amountTo);
        }
        
        if (activeFilters.recipient) {
          queryParams.append('recipient', activeFilters.recipient);
        }
        
        if (activeFilters.afm) {
          queryParams.append('afm', activeFilters.afm);
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

  // Query parameters - only updated when search is triggered
  const handleApplyFilters = () => {
    setActiveFilters(filters);
    refetch();
  };

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
            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Μονάδα</label>
                <Select
                  value={filters.unit}
                  onValueChange={(value: string) => setFiltersWithRefresh({ ...filters, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε μονάδα" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all-units" value="all">Όλες οι Μονάδες</SelectItem>
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
                  onValueChange={(value: string) => setFiltersWithRefresh({ ...filters, status: value })}
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
                  onValueChange={(value: string) => setFiltersWithRefresh({ ...filters, user: value })}
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
                          value={filters.dateFrom}
                          onChange={(e) => setFiltersWithRefresh({ ...filters, dateFrom: e.target.value }, false)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Έως</label>
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFiltersWithRefresh({ ...filters, dateTo: e.target.value }, false)}
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
                          value={filters.amountFrom}
                          onChange={(e) => setFiltersWithRefresh({ ...filters, amountFrom: e.target.value }, false)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Έως</label>
                        <Input
                          type="number"
                          placeholder="Μέγιστο ποσό"
                          value={filters.amountTo}
                          onChange={(e) => setFiltersWithRefresh({ ...filters, amountTo: e.target.value }, false)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Αναζήτηση Παραλήπτη</label>
                    <Input
                      placeholder="Αναζήτηση με όνομα παραλήπτη"
                      value={filters.recipient}
                      onChange={(e) => setFiltersWithRefresh({ ...filters, recipient: e.target.value }, false)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ΑΦΜ</label>
                    <Input
                      placeholder="Αναζήτηση με ΑΦΜ"
                      value={filters.afm}
                      onChange={(e) => setFiltersWithRefresh({ ...filters, afm: e.target.value }, false)}
                    />
                  </div>
                </div>
                <SheetClose asChild>
                  <Button className="w-full mt-4" onClick={handleApplyFilters}>Εφαρμογή Φίλτρων</Button>
                </SheetClose>
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
              <Button
                variant="outline"
                onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
                className="flex items-center gap-2"
              >
                {viewMode === 'grid' ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <List className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Documents Grid */}
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1'} gap-6 p-6`}>
            {documents?.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
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
            {(!documents || documents.length === 0) && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4" />
                <p>Δεν βρέθηκαν έγγραφα</p>
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

      {user?.role === 'user' && <FAB />}
    </div>
  );
}