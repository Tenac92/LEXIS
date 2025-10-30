/**
 * Quarter Management Page
 * 
 * Administrative interface for managing quarter transitions.
 * Includes status information, manual checks, and forced transitions.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { 
  Calendar, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Hourglass 
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  getQuarterTransitionStatus,
  checkQuarterTransition,
  forceQuarterTransition 
} from '@/lib/services/adminService';
import { Header } from '@/components/header';

const QuarterManagementPage: React.FC = () => {
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);
  const [isForceDialogOpen, setIsForceDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Get the current quarter status
  const { 
    data: quarterStatus, 
    isLoading: isStatusLoading,
    isError: isStatusError,
    error: statusError,
    refetch: refetchStatus 
  } = useQuery({
    queryKey: ['/api/admin/quarter-transition/status'],
    queryFn: () => getQuarterTransitionStatus(),
  });
  
  // Mutation for checking quarter transitions
  const checkQuarterMutation = useMutation({
    mutationFn: checkQuarterTransition,
    onSuccess: () => {
      setIsCheckDialogOpen(false);
      // Wait a bit then refetch status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/quarter-transition/status'] });
      }, 1000);
    }
  });
  
  // Mutation for forcing quarter transitions
  const forceQuarterMutation = useMutation({
    mutationFn: forceQuarterTransition,
    onSuccess: () => {
      setIsForceDialogOpen(false);
      // Wait a bit then refetch status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/quarter-transition/status'] });
      }, 1000);
    }
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP', { locale: el });
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Get formatted quarter name
  const getQuarterName = (quarter: string) => {
    switch (quarter) {
      case 'q1': return 'Q1 (Ιαν-Μαρ)';
      case 'q2': return 'Q2 (Απρ-Ιουν)';
      case 'q3': return 'Q3 (Ιουλ-Σεπ)';
      case 'q4': return 'Q4 (Οκτ-Δεκ)';
      default: return quarter.toUpperCase();
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Διαχείριση Τριμήνων</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Current Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Τρέχον Τρίμηνο
            </CardTitle>
            <CardDescription>Πληροφορίες για το τρέχον τρίμηνο του συστήματος</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatusLoading ? (
              <div className="flex items-center justify-center py-4">
                <Hourglass className="mr-2 h-5 w-5 animate-spin" />
                <span>Φόρτωση...</span>
              </div>
            ) : isStatusError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Σφάλμα</AlertTitle>
                <AlertDescription>
                  Δεν ήταν δυνατή η ανάκτηση των πληροφοριών.
                  {statusError instanceof Error && (
                    <div className="mt-2 text-xs">{statusError.message}</div>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium">Τρέχον Τρίμηνο:</span>
                  <span className="font-bold">{getQuarterName(quarterStatus?.current_quarter || 'unknown')}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium">Ημερομηνία:</span>
                  <span>{formatDate(quarterStatus?.current_date || new Date().toISOString())}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Προγραμματισμένος Έλεγχος:</span>
                  <span>{formatDate(quarterStatus?.next_scheduled_check || '')}</span>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => refetchStatus()}
              disabled={isStatusLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isStatusLoading ? 'animate-spin' : ''}`} />
              Ανανέωση
            </Button>
          </CardFooter>
        </Card>
        
        {/* Quarter Check Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="mr-2 h-5 w-5" />
              Έλεγχος Τριμήνου
            </CardTitle>
            <CardDescription>Έλεγχος για ενημερώσεις τριμήνου στα έργα</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">
              Ο έλεγχος τριμήνου θα εντοπίσει έργα που χρειάζονται ενημέρωση τριμήνου και θα 
              τα ενημερώσει αυτόματα. Αυτή η διαδικασία εκτελείται αυτόματα στην αρχή κάθε τριμήνου.
            </p>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Μη Καταστροφική Λειτουργία</AlertTitle>
              <AlertDescription>
                Αυτή η λειτουργία είναι ασφαλής και θα ενημερώσει μόνο τα έργα που χρειάζονται αλλαγή τριμήνου.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => setIsCheckDialogOpen(true)}
              disabled={checkQuarterMutation.isPending}
            >
              {checkQuarterMutation.isPending ? (
                <>
                  <Hourglass className="mr-2 h-4 w-4 animate-spin" />
                  Επεξεργασία...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Εκτέλεση Ελέγχου Τριμήνου
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        {/* Force Quarter Update Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-amber-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Εξαναγκασμένη Αλλαγή
            </CardTitle>
            <CardDescription>Εξαναγκασμένη αλλαγή τριμήνου για όλα τα έργα</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">
              Αυτή η λειτουργία θα επεξεργαστεί εξαναγκαστικά μια αλλαγή τριμήνου για όλα τα έργα, 
              ανεξάρτητα από την τρέχουσα κατάστασή τους.
            </p>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Προσοχή</AlertTitle>
              <AlertDescription>
                Χρησιμοποιήστε αυτή τη λειτουργία μόνο εάν είστε βέβαιοι ότι όλα τα έργα πρέπει να 
                αλλάξουν τρίμηνο. Αυτή είναι μια προχωρημένη λειτουργία.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => setIsForceDialogOpen(true)}
              disabled={forceQuarterMutation.isPending}
            >
              {forceQuarterMutation.isPending ? (
                <>
                  <Hourglass className="mr-2 h-4 w-4 animate-spin" />
                  Επεξεργασία...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Εξαναγκασμένη Αλλαγή Τριμήνου
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Check Quarter Transition Dialog */}
      <Dialog open={isCheckDialogOpen} onOpenChange={setIsCheckDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Επιβεβαίωση Ελέγχου Τριμήνου</DialogTitle>
            <DialogDescription>
              Είστε βέβαιοι ότι θέλετε να εκτελέσετε έναν έλεγχο αλλαγής τριμήνου;
              Αυτό θα ενημερώσει όλα τα έργα που χρειάζονται ενημέρωση τριμήνου.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckDialogOpen(false)}>
              Ακύρωση
            </Button>
            <Button
              variant="default"
              onClick={() => checkQuarterMutation.mutate()}
              disabled={checkQuarterMutation.isPending}
            >
              {checkQuarterMutation.isPending ? 'Επεξεργασία...' : 'Επιβεβαίωση'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Force Quarter Transition Dialog */}
      <Dialog open={isForceDialogOpen} onOpenChange={setIsForceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Εξαναγκασμένη Αλλαγή Τριμήνου</DialogTitle>
            <DialogDescription>
              ΠΡΟΣΟΧΗ: Αυτή η ενέργεια θα επεξεργαστεί αναγκαστικά μια αλλαγή τριμήνου για όλα τα έργα.
              Είστε βέβαιοι ότι θέλετε να συνεχίσετε;
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Μη Αναστρέψιμη Ενέργεια</AlertTitle>
              <AlertDescription>
                Αυτή η ενέργεια δεν μπορεί να αναιρεθεί και θα επηρεάσει όλα τα έργα στο σύστημα.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsForceDialogOpen(false)}>
              Ακύρωση
            </Button>
            <Button
              variant="destructive"
              onClick={() => forceQuarterMutation.mutate(undefined)}
              disabled={forceQuarterMutation.isPending}
            >
              {forceQuarterMutation.isPending ? 'Επεξεργασία...' : 'Εκτέλεση Εξαναγκασμένης Αλλαγής'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default QuarterManagementPage;