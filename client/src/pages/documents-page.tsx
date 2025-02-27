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
import { supabase } from "@/lib/supabase";
import type { GeneratedDocument } from "@shared/schema";

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

export default function DocumentsPage() {
  const { user } = useAuth();
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

  // Initialize filters
  const [filters, setFilters] = useState<Filters>({
    unit: user?.unit || 'all',
    status: 'all',
    user: 'all',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    recipient: '',
    afm: ''
  });

  // Query for documents with debugging
  const { data: documents, isLoading, error, refetch } = useQuery<GeneratedDocument[]>({
    queryKey: ['/api/documents', filters],
    queryFn: async () => {
      try {
        console.log('[Documents] Starting document fetch with filters:', filters);

        // Build query with explicit column selection
        let query = supabase
          .from('generated_documents')
          .select(`
            id,
            unit,
            status,
            project_id,
            project_na853,
            total_amount,
            recipients,
            protocol_number_input,
            protocol_date,
            created_at,
            department,
            attachments,
            expenditure_type,
            generated_by
          `)
          .order('created_at', { ascending: false });

        // Apply unit filter
        if (filters.unit && filters.unit !== 'all') {
          console.log('[Documents] Applying unit filter:', filters.unit);
          query = query.eq('unit', filters.unit);
        }

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          console.log('[Documents] Applying status filter:', filters.status);
          query = query.eq('status', filters.status);
        }

        // Apply user filter
        if (filters.user && filters.user !== 'all') {
          console.log('[Documents] Applying user filter:', filters.user);
          query = query.eq('generated_by', filters.user);
        }

        // Apply date range filters
        if (filters.dateFrom) {
          console.log('[Documents] Applying date from filter:', filters.dateFrom);
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          console.log('[Documents] Applying date to filter:', filters.dateTo);
          query = query.lte('created_at', filters.dateTo);
        }

        // Apply amount range filters
        if (filters.amountFrom) {
          console.log('[Documents] Applying amount from filter:', filters.amountFrom);
          query = query.gte('total_amount', parseFloat(filters.amountFrom));
        }
        if (filters.amountTo) {
          console.log('[Documents] Applying amount to filter:', filters.amountTo);
          query = query.lte('total_amount', parseFloat(filters.amountTo));
        }

        // Execute query with error handling
        console.log('[Documents] Executing Supabase query...');
        const { data, error } = await query;

        if (error) {
          console.error('[Documents] Supabase query error:', error);
          throw error;
        }

        // Log success with sample data
        console.log('[Documents] Query successful:', {
          count: data?.length || 0,
          sample: data?.[0] ? { id: data[0].id, unit: data[0].unit } : null
        });

        return data || [];
      } catch (error) {
        console.error('[Documents] Error in document fetch:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch documents",
          variant: "destructive",
        });
        throw error;
      }
    }
  });

  // Handle document refresh
  const handleRefresh = () => {
    console.log('[Documents] Manually refreshing documents...');
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
                <label className="text-sm font-medium text-foreground">Unit</label>
                <Select
                  value={filters.unit}
                  onValueChange={(value) => {
                    console.log('[Documents] Changing unit filter to:', value);
                    setFilters(prev => ({ ...prev, unit: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    <SelectItem value="ΔΑΕΦΚ-ΚΕ">ΔΑΕΦΚ-ΚΕ</SelectItem>
                    <SelectItem value="ΓΔΑΕΦΚ">ΓΔΑΕΦΚ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => {
                    console.log('[Documents] Changing status filter to:', value);
                    setFilters(prev => ({ ...prev, status: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">User</label>
                <Select
                  value={filters.user}
                  onValueChange={(value) => {
                    console.log('[Documents] Changing user filter to:', value);
                    setFilters(prev => ({ ...prev, user: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="current">My Documents</SelectItem>
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
                    Advanced Filters
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Advanced Filters</SheetTitle>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">From</label>
                        <Input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">To</label>
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">From</label>
                        <Input
                          type="number"
                          placeholder="Min amount"
                          value={filters.amountFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, amountFrom: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">To</label>
                        <Input
                          type="number"
                          placeholder="Max amount"
                          value={filters.amountTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, amountTo: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient Search</label>
                    <Input
                      placeholder="Search by recipient name"
                      value={filters.recipient}
                      onChange={(e) => setFilters(prev => ({ ...prev, recipient: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">AFM</label>
                    <Input
                      placeholder="Search by AFM"
                      value={filters.afm}
                      onChange={(e) => setFilters(prev => ({ ...prev, afm: e.target.value }))}
                    />
                  </div>
                </div>
                <SheetClose asChild>
                  <Button className="w-full mt-4">Apply Filters</Button>
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
                Refresh
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
                <p>No documents found</p>
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
        document={selectedDocument}
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