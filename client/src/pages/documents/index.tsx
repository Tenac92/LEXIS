import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DocumentCard } from '@/components/documents/document-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover';
import { Filter } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import type { GeneratedDocument } from '@shared/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWebSocketUpdates } from '@/hooks/use-websocket-updates';

// Filter types
type FilterParams = {
  query: string;
  unit: string;
  status: string;
  dateFrom: Date | null;
  dateTo: Date | null;
};

export default function DocumentsPage() {
  useWebSocketUpdates();

  // Filter states
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState<FilterParams>({
    query: '',
    unit: '',
    status: '',
    dateFrom: null,
    dateTo: null
  });

  // Query parameters - only updated when search is triggered
  const [queryParams, setQueryParams] = useState<FilterParams>({
    query: '',
    unit: '',
    status: '',
    dateFrom: null,
    dateTo: null
  });

  // Fetch documents using React Query
  const { data: documents = [], isLoading } = useQuery<GeneratedDocument[]>({
    queryKey: ['/api/documents/generated', queryParams],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Handle applying filters
  const handleApplyFilters = useCallback(() => {
    setQueryParams(filterInputs);
    setIsFiltersOpen(false); // Close popover after applying filters
  }, [filterInputs]);

  // Filter documents based on query parameters
  const filteredDocuments = documents.filter(doc => {
    const matchesQuery = !queryParams.query || 
      doc.protocol_number_input?.toLowerCase().includes(queryParams.query.toLowerCase()) ||
      doc.recipients?.some(r => 
        r.firstname.toLowerCase().includes(queryParams.query.toLowerCase()) ||
        r.lastname.toLowerCase().includes(queryParams.query.toLowerCase()) ||
        r.afm.includes(queryParams.query)
      );

    const matchesUnit = !queryParams.unit || doc.unit === queryParams.unit;
    const matchesStatus = !queryParams.status || doc.status === queryParams.status;

    const docDate = new Date(doc.created_at);
    const matchesDateFrom = !queryParams.dateFrom || docDate >= queryParams.dateFrom;
    const matchesDateTo = !queryParams.dateTo || docDate <= queryParams.dateTo;

    return matchesQuery && matchesUnit && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Αναζήτηση..."
            value={filterInputs.query}
            onChange={e => setFilterInputs(prev => ({ ...prev, query: e.target.value }))}
            className="max-w-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
          />
          <Popover 
            open={isFiltersOpen} 
            onOpenChange={setIsFiltersOpen}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Φίλτρα
                {(filterInputs.unit || filterInputs.status || filterInputs.dateFrom || filterInputs.dateTo) && 
                  <span className="ml-2 h-2 w-2 rounded-full bg-primary"></span>
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80" 
              align="start" 
              side="bottom"
              aria-label="Φίλτρα εγγράφων"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Μονάδα</label>
                  <Select
                    value={filterInputs.unit}
                    onValueChange={value => setFilterInputs(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλέξτε μονάδα" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Όλες</SelectItem>
                      <SelectItem value="ΔΑΕΦΚ-ΚΕ">ΔΑΕΦΚ-ΚΕ</SelectItem>
                      <SelectItem value="ΔΑΕΦΚ-ΘΕΣΣ">ΔΑΕΦΚ-ΘΕΣΣ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Κατάσταση</label>
                  <Select
                    value={filterInputs.status}
                    onValueChange={value => setFilterInputs(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλέξτε κατάσταση" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Όλες</SelectItem>
                      <SelectItem value="draft">Πρόχειρο</SelectItem>
                      <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
                      <SelectItem value="pending">Σε εξέλιξη</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Από ημερομηνία</label>
                  <DatePicker
                    selected={filterInputs.dateFrom}
                    onSelect={date => setFilterInputs(prev => ({ ...prev, dateFrom: date }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Έως ημερομηνία</label>
                  <DatePicker
                    selected={filterInputs.dateTo}
                    onSelect={date => setFilterInputs(prev => ({ ...prev, dateTo: date }))}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleApplyFilters}
                >
                  Εφαρμογή φίλτρων
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={handleApplyFilters}>
            Αναζήτηση
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onView={() => {/* implement view handler */}}
            onEdit={() => {/* implement edit handler */}}
            onDelete={() => {/* implement delete handler */}}
          />
        ))}
      </div>
    </div>
  );
}