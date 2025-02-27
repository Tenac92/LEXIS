import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ViewDocumentModal, EditDocumentModal, DeleteDocumentModal } from "@/components/documents/document-modals";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { FAB } from "@/components/ui/fab";
import { useAuth } from "@/hooks/use-auth";
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
  const [isAdvancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const { data: documents, refetch, isLoading } = useQuery<GeneratedDocument[]>({
    queryKey: ['/api/documents', filters],
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== 'all') {
            searchParams.append(key, value);
          }
        });

        // Always include user's unit if they are a regular user
        if (user?.role === 'user' && user?.units?.length) {
          searchParams.set('unit', user.units[0]);
        }

        const response = await fetch(`/api/documents?${searchParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch documents');
        return response.json();
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch documents",
          variant: "destructive",
        });
        return [];
      }
    }
  });

  const handleExport = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/generated/${docId}/export`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Failed to export document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${docId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Document exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export document",
        variant: "destructive",
      });
    }
  };

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
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">User</label>
                <Select 
                  value={filters.user}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, user: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters Sheet */}
            <Sheet open={isAdvancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Advanced Filters
                  </span>
                  <span className="text-muted-foreground">⌘K</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Advanced Filters</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="date" 
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        placeholder="From" 
                      />
                      <Input 
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        placeholder="To" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="number"
                        value={filters.amountFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, amountFrom: e.target.value }))}
                        placeholder="Min Amount" 
                      />
                      <Input 
                        type="number"
                        value={filters.amountTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, amountTo: e.target.value }))}
                        placeholder="Max Amount" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient</label>
                    <Input 
                      value={filters.recipient}
                      onChange={(e) => setFilters(prev => ({ ...prev, recipient: e.target.value }))}
                      placeholder="Search recipient" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">AFM</label>
                    <Input 
                      value={filters.afm}
                      onChange={(e) => setFilters(prev => ({ ...prev, afm: e.target.value }))}
                      placeholder="Search AFM" 
                      maxLength={9} 
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button 
                variant="default" 
                className="flex items-center gap-2"
                onClick={() => refetch()}
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
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="h-[200px] animate-pulse bg-muted" />
              ))
            ) : documents?.length > 0 ? (
              documents.map((doc) => (
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
                  onExport={handleExport}
                />
              ))
            ) : (
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
        onEdit={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
          setModalState(prev => ({ ...prev, edit: false }));
        }}
      />

      <DeleteDocumentModal
        isOpen={modalState.delete}
        onClose={() => setModalState(prev => ({ ...prev, delete: false }))}
        documentId={selectedDocument?.id}
        onDelete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
          setModalState(prev => ({ ...prev, delete: false }));
        }}
      />

      {user?.role === 'user' && <FAB />}
    </div>
  );
}