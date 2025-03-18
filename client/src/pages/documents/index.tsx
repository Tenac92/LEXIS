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

  // Separate state for current and applied filters
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentParams, setCurrentParams] = useState({
    query: '',
    unit: '',
    status: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // State for actually applied filters
  const [appliedFilters, setAppliedFilters] = useState({
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

  // Handle search button click
  const handleSearch = useCallback(() => {
    setAppliedFilters(currentParams);
  }, [currentParams]);

  // Filter documents based on applied filters
  const filteredDocuments = documents.filter(doc => {
    const matchesQuery = !appliedFilters.query || 
      doc.protocol_number_input?.toLowerCase().includes(appliedFilters.query.toLowerCase()) ||
      doc.recipients?.some(r => 
        r.firstname.toLowerCase().includes(appliedFilters.query.toLowerCase()) ||
        r.lastname.toLowerCase().includes(appliedFilters.query.toLowerCase()) ||
        r.afm.includes(appliedFilters.query)
      );

    const matchesUnit = !appliedFilters.unit || doc.unit === appliedFilters.unit;
    const matchesStatus = !appliedFilters.status || doc.status === appliedFilters.status;
    const matchesDateFrom = !appliedFilters.dateFrom || new Date(doc.created_at) >= appliedFilters.dateFrom;
    const matchesDateTo = !appliedFilters.dateTo || new Date(doc.created_at) <= appliedFilters.dateTo;

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
            value={currentParams.query}
            onChange={e => setCurrentParams(prev => ({ ...prev, query: e.target.value }))}
            className="max-w-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Φίλτρα
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Μονάδα</label>
                  <Select
                    value={currentParams.unit}
                    onValueChange={value => setCurrentParams(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλέξτε μονάδα" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Όλες</SelectItem>
                      {/* Add your unit options here */}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Κατάσταση</label>
                  <Select
                    value={currentParams.status}
                    onValueChange={value => setCurrentParams(prev => ({ ...prev, status: value }))}
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
                    selected={currentParams.dateFrom}
                    onSelect={date => setCurrentParams(prev => ({ ...prev, dateFrom: date }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Έως ημερομηνία</label>
                  <DatePicker
                    selected={currentParams.dateTo}
                    onSelect={date => setCurrentParams(prev => ({ ...prev, dateTo: date }))}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => {
                    handleSearch();
                  }}
                >
                  Εφαρμογή φίλτρων
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={handleSearch}>
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