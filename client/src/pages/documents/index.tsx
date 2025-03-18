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

  // State for filters
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useState({
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
    // Your search logic here using searchParams
    console.log('Searching with params:', searchParams);
  }, [searchParams]);

  // Filter documents based on search parameters
  const filteredDocuments = documents.filter(doc => {
    const matchesQuery = !searchParams.query || 
      doc.protocol_number_input?.toLowerCase().includes(searchParams.query.toLowerCase()) ||
      doc.recipients?.some(r => 
        r.firstname.toLowerCase().includes(searchParams.query.toLowerCase()) ||
        r.lastname.toLowerCase().includes(searchParams.query.toLowerCase()) ||
        r.afm.includes(searchParams.query)
      );

    const matchesUnit = !searchParams.unit || doc.unit === searchParams.unit;
    const matchesStatus = !searchParams.status || doc.status === searchParams.status;
    const matchesDateFrom = !searchParams.dateFrom || new Date(doc.created_at) >= searchParams.dateFrom;
    const matchesDateTo = !searchParams.dateTo || new Date(doc.created_at) <= searchParams.dateTo;

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
            value={searchParams.query}
            onChange={e => setSearchParams(prev => ({ ...prev, query: e.target.value }))}
            className="max-w-sm"
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
                    value={searchParams.unit}
                    onValueChange={value => setSearchParams(prev => ({ ...prev, unit: value }))}
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
                    value={searchParams.status}
                    onValueChange={value => setSearchParams(prev => ({ ...prev, status: value }))}
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
                    selected={searchParams.dateFrom}
                    onSelect={date => setSearchParams(prev => ({ ...prev, dateFrom: date }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Έως ημερομηνία</label>
                  <DatePicker
                    selected={searchParams.dateTo}
                    onSelect={date => setSearchParams(prev => ({ ...prev, dateTo: date }))}
                  />
                </div>

                <Button className="w-full" onClick={handleSearch}>
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