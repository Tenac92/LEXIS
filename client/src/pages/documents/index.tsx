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

export default function DocumentsPage() {
  // Set up WebSocket connection
  useWebSocketUpdates();

  // State for filter popover visibility
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // State for filter inputs (doesn't trigger search)
  const [filterInputs, setFilterInputs] = useState({
    query: '',
    unit: '',
    status: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // State for applied filters (triggers search)
  const [activeFilters, setActiveFilters] = useState({
    query: '',
    unit: '',
    status: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // Fetch documents using React Query
  const { data: documents = [], isLoading } = useQuery<GeneratedDocument[]>({
    queryKey: ['/api/documents/generated'],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Handle applying filters
  const handleApplyFilters = useCallback(() => {
    setActiveFilters(filterInputs);
  }, [filterInputs]);

  // Filter documents based on active filters only
  const filteredDocuments = documents.filter(doc => {
    const matchesQuery = !activeFilters.query || 
      doc.protocol_number_input?.toLowerCase().includes(activeFilters.query.toLowerCase()) ||
      doc.recipients?.some(r => 
        r.firstname.toLowerCase().includes(activeFilters.query.toLowerCase()) ||
        r.lastname.toLowerCase().includes(activeFilters.query.toLowerCase()) ||
        r.afm.includes(activeFilters.query)
      );

    const matchesUnit = !activeFilters.unit || doc.unit === activeFilters.unit;
    const matchesStatus = !activeFilters.status || doc.status === activeFilters.status;

    const matchesDateFrom = !activeFilters.dateFrom || 
      new Date(doc.created_at) >= activeFilters.dateFrom;

    const matchesDateTo = !activeFilters.dateTo || 
      new Date(doc.created_at) <= activeFilters.dateTo;

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
                  onClick={() => {
                    handleApplyFilters();
                  }}
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