import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Upload,
  Euro
} from "lucide-react";
import React, { useState } from 'react';

import type { DashboardStats } from "@/lib/dashboard";

// Custom number formatting function
const formatLargeNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M €`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K €`;
  }
  return `${value.toFixed(0)} €`;
};

// For type safety with user documents
interface DocumentItem {
  id: number;
  title?: string;
  status?: string;
  document_type?: string;
  protocol_number?: string;
  created_at?: string;
  mis?: string;
  unit?: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // State for user's documents filtered by unit
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false
  });
  
  // Query for recent documents using the user endpoint for better data
  const { data: userDocs = [], isLoading: isLoadingUserDocs } = useQuery<DocumentItem[]>({
    queryKey: ["/api/documents/user", "recent"],
    queryFn: async () => {
      try {
        if (!user?.units || user.units.length === 0) return [];
        
        const response = await fetch('/api/documents/user', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.warn('[Dashboard] Failed to fetch recent documents');
          return [];
        }
        
        const data = await response.json();
        const documents = Array.isArray(data) ? data : [];
        
        // Process documents to create meaningful titles and ensure proper structure
        return documents.slice(0, 5).map(doc => ({
          ...doc,
          title: doc.title || doc.document_type || `Έγγραφο ${doc.protocol_number || doc.id}`,
          status: doc.status || 'pending'
        }));
      } catch (error) {
        console.warn('[Dashboard] Error fetching recent documents:', error);
        return [];
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!user?.units && user.units.length > 0
  });

  // Make sure userDocs is always an array
  const userDocuments = Array.isArray(userDocs) ? userDocs : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Σφάλμα Φόρτωσης</h3>
        <p>Αποτυχία φόρτωσης δεδομένων. Παρακαλώ ανανεώστε τη σελίδα.</p>
        {error instanceof Error && (
          <p className="mt-2 text-sm">{error.message}</p>
        )}
      </div>
    );
  }

  // Calculate user's activity stats
  const userUnits = user?.units || [];
  const userUnitCounts = userUnits.reduce((acc: Record<string, number>, unit: string) => {
    acc[unit] = stats.pendingDocuments; // We're simplifying here - ideally we'd have per-unit data
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header with quick actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Πίνακας Ελέγχου</h2>
        <div className="flex gap-2">
          <Link href="/documents">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Όλα τα Έγγραφα
            </Button>
          </Link>
          {isAdmin && (
            <>
              <Link href="/projects/new">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Νέο Έργο
                </Button>
              </Link>
              <Link href="/projects/bulk-update">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Μαζική Ενημέρωση
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Σύνολο Εγγράφων</h3>
              <p className="text-2xl font-bold mt-1">{stats.totalDocuments}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Εκκρεμή Έγγραφα</h3>
              <p className="text-2xl font-bold mt-1">{stats.pendingDocuments}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Ολοκληρωμένα Έγγραφα</h3>
              <p className="text-2xl font-bold mt-1">{stats.completedDocuments}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Euro className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Συνολικός Προϋπολογισμός</h3>
              <p className="text-2xl font-bold mt-1">
                {(() => {
                  const values = Object.values(stats.budgetTotals || {});
                  const total = values.reduce((sum, val) => {
                    const num = typeof val === 'number' ? val : 0;
                    return sum + num;
                  }, 0);
                  return formatLargeNumber(total);
                })()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* User's activity and documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Units */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Οι Μονάδες μου</h3>
          <div className="space-y-4">
            {userUnits.length > 0 ? (
              userUnits.map((unit, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg cursor-pointer border transition-colors ${
                    selectedUnit === unit ? 'bg-primary/10 border-primary' : 'bg-card hover:bg-muted/50 border-border'
                  }`}
                  onClick={() => setSelectedUnit(selectedUnit === unit ? null : unit)}
                >
                  <p className="font-medium">{unit}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">Εκκρεμή έγγραφα</span>
                    <span className="font-semibold text-primary">{stats.pendingDocuments}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Δεν βρέθηκαν μονάδες
              </div>
            )}
          </div>
        </Card>

        {/* Recent Documents */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Πρόσφατα Έγγραφά μου</h3>
          <div className="space-y-4">
            {isLoadingUserDocs ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : userDocuments.length > 0 ? (
              userDocuments.slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{doc.title || "Έγγραφο χωρίς τίτλο"}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.status === 'pending' ? 'Εκκρεμεί' : 
                       doc.status === 'completed' ? 'Ολοκληρώθηκε' : 'Σε επεξεργασία'}
                    </p>
                  </div>
                  <Link href={`/documents/${doc.id}`}>
                    <Button size="sm" variant="ghost">Προβολή</Button>
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-center p-4 text-muted-foreground">
                <p>Δεν βρέθηκαν πρόσφατα έγγραφα</p>
                <Button className="mt-4" size="sm" asChild>
                  <Link href="/documents/new">Δημιουργία Εγγράφου</Link>
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 text-right">
            <Button variant="link" size="sm" asChild>
              <Link href="/documents">Προβολή όλων</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Recent Activity - Expanded section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Πρόσφατη Δραστηριότητα</h3>
          <Button variant="outline" size="sm" asChild>
            <Link href="/budget/history">Προβολή όλων</Link>
          </Button>
        </div>
        
        <div className="space-y-4">
          {stats.recentActivity && stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((activity: any) => (
              <div 
                key={activity.id} 
                className="p-4 rounded-lg border hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <div className="flex items-center mt-1">
                      <span className="text-sm text-muted-foreground mr-2">{activity.type}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {new Date(activity.date).toLocaleDateString('el-GR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-6 text-muted-foreground">
              Δεν υπάρχει καταγεγραμμένη πρόσφατη δραστηριότητα
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default Dashboard;