import { useEffect } from 'react';
import { useWebSocketUpdates } from '@/hooks/use-websocket-updates';
import { useQuery } from '@tanstack/react-query';
import { DocumentCard } from '@/components/documents/document-card';

export default function DocumentsPage() {
  // Set up WebSocket connection
  useWebSocketUpdates();

  // Fetch documents using React Query
  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['/api/documents/generated'],
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading documents</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {documents?.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onView={() => {/* implement view handler */}}
          onEdit={() => {/* implement edit handler */}}
          onDelete={() => {/* implement delete handler */}}
        />
      ))}
    </div>
  );
}
