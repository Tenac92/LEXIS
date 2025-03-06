import { useEffect } from 'react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export const NotificationsPage = () => {
  const [, setLocation] = useLocation();

  // Check if user is admin
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/user'],
    retry: false
  });

  useEffect(() => {
    if (!userLoading && (!user || user.role !== 'admin')) {
      toast({
        title: "Απαγορευμένη Πρόσβαση",
        description: "Χρειάζεστε δικαιώματα διαχειριστή για πρόσβαση σε αυτή τη σελίδα.",
        variant: "destructive"
      });
      setLocation('/');
    }
  }, [user, userLoading, setLocation]);

  if (userLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Φόρτωση...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ειδοποιήσεις Προϋπολογισμού</h1>
        <Button 
          variant="outline"
          onClick={() => {
            // Force refresh notifications
            window.location.reload();
          }}
        >
          Ανανέωση Ειδοποιήσεων
        </Button>
      </div>
      <NotificationCenter 
        onNotificationClick={(notification) => {
          // Handle notification click - e.g., show details modal
          console.log('Επιλεγμένη ειδοποίηση:', notification);
        }}
      />
    </div>
  );
};

export default NotificationsPage;