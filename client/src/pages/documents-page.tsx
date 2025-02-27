import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { FileText, Filter, RefreshCcw, LayoutGrid, List } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DocumentCard } from "@/components/documents/document-card";
import { useQuery } from "@tanstack/react-query";
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
  const [filters, setFilters] = useState<Filters>({
    unit: user?.units?.[0] || 'all',
    status: 'all',
    user: 'all',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    recipient: '',
    afm: ''
  });

  const { data: documents, isLoading, error } = useQuery<GeneratedDocument[]>({
    queryKey: ['/api/documents', filters],
    queryFn: async () => {
      try {
        console.log('[Documents] Fetching documents with filters:', filters);

        // Create query
        let query = supabase
          .from('generated_documents')
          .select()
          .order('created_at', { ascending: false });

        // Apply filters
        if (user?.role === 'user' && user?.units?.length) {
          console.log('[Documents] Applying user unit filter:', user.units[0]);
          query = query.eq('unit', user.units[0]);
        } else if (filters.unit && filters.unit !== 'all') {
          console.log('[Documents] Applying unit filter:', filters.unit);
          query = query.eq('unit', filters.unit);
        }

        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        console.log('[Documents] Executing Supabase query...');
        const { data, error } = await query;

        if (error) {
          console.error('[Documents] Supabase query error:', error);
          throw error;
        }

        console.log('[Documents] Documents fetched successfully:', {
          count: data?.length || 0,
          sample: data?.[0] ? { id: data[0].id, unit: data[0].unit } : null
        });

        return data || [];
      } catch (error) {
        console.error('[Documents] Error fetching documents:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch documents",
          variant: "destructive",
        });
        throw error;
      }
    }
  });

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
              {user?.role !== 'user' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Unit</label>
                  <Select
                    value={filters.unit}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Units</SelectItem>
                      {user?.units?.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
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
            </Sheet>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                variant="default"
                className="flex items-center gap-2"
                onClick={() => {}}
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
        onEdit={() => {}}
      />

      <DeleteDocumentModal
        isOpen={modalState.delete}
        onClose={() => setModalState(prev => ({ ...prev, delete: false }))}
        documentId={selectedDocument?.id}
        onDelete={() => {}}
      />

      {user?.role === 'user' && <FAB />}
    </div>
  );
}