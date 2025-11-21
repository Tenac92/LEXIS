import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Euro,
  Info,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Users,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  ClipboardCheck
} from "lucide-react";
import React, { useState, useMemo } from 'react';
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import { ViewDocumentModal } from "@/components/documents/document-modals";

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
  protocol_number_input?: string;
  protocol_date?: string;
}

export function UserDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // State for user's documents filtered by unit - should be number since unit_id is number
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  
  // State for document details modal
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  
  // State for protocol modal
  const [showProtocolModal, setShowProtocolModal] = useState(false);

  // Get unit-specific dashboard stats with proper caching
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user?.unit_id && user.unit_id.length > 0 // Only fetch when user has units
  });
  
  // Query for user's recent documents with safe fallback
  const { data: userDocs = [], isLoading: isLoadingUserDocs } = useQuery<DocumentItem[]>({
    queryKey: ["/api/documents/user", "recent"],
    queryFn: async () => {
      try {
        if (!user?.unit_id || user.unit_id.length === 0) return [];
        
        const response = await fetch('/api/documents/user', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch documents: ${response.status}`);
        }
        
        const data = await response.json();
        const documents = Array.isArray(data) ? data : [];
        
        // Process documents to create meaningful titles and ensure proper structure
        // Limit to 5 most recent documents
        return documents.slice(0, 5).map(doc => ({
          ...doc,
          title: doc.title || doc.document_type || `Έγγραφο ${doc.protocol_number || doc.id}`,
          status: doc.status || 'pending'
        }));
      } catch (error) {
        console.error('[UserDashboard] Error fetching recent documents:', error);
        return [];
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
    enabled: !!user?.unit_id && user.unit_id.length > 0
  });

  // Query for unit names to display proper unit information
  const { data: units = [] } = useQuery({
    queryKey: ["/api/public/units"],
    staleTime: 10 * 60 * 1000, // 10 minutes - units don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false
  });

  // Calculate completion percentage and trends - MOVED TO TOP TO FIX HOOKS ORDER
  const completionRate = useMemo(() => {
    if (!stats?.totalDocuments) return 0;
    return Math.round((stats.completedDocuments / stats.totalDocuments) * 100);
  }, [stats?.totalDocuments, stats?.completedDocuments]);

  const budgetUtilization = useMemo(() => {
    const totalBudget = Object.values(stats?.budgetTotals || {}).reduce((sum, val) => sum + val, 0);
    const activeBudget = stats?.budgetTotals?.completed || 0;
    if (!totalBudget) return 0;
    return Math.round((activeBudget / totalBudget) * 100);
  }, [stats?.budgetTotals]);

  const projectsTotal = useMemo(() => {
    return Object.values(stats?.projectStats || {}).reduce((sum, val) => sum + val, 0);
  }, [stats?.projectStats]);

  // Enhanced skeleton loader component
  const DashboardSkeleton = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="p-4 rounded-lg border">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return <DashboardSkeleton />;
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

  // Calculate user's activity stats - units are numbers, not strings
  const userUnits = user?.unit_id || [];
  const userDocuments = Array.isArray(userDocs) ? userDocs : [];
  
  // Helper function to get unit name by ID
  const getUnitName = (unitId: number): string => {
    const unit = Array.isArray(units) ? units.find((u: any) => u.id === unitId) : null;
    return unit?.unit || `Μονάδα ${unitId}`;
  };

  // Helper function to get pending documents count for a specific unit
  const getPendingDocsForUnit = (unitId: number): number => {
    return userDocuments.filter((doc: any) => doc.unit_id === unitId && doc.status === 'pending').length;
  };

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
            </>
          )}
        </div>
      </div>

      {/* Enhanced Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Documents Overview */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Έγγραφα</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{stats.totalDocuments}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {completionRate}% ολοκληρώθηκε
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Πρόοδος</span>
                <span className="font-medium">{stats.completedDocuments}/{stats.totalDocuments}</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Documents */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-yellow-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Εκκρεμή</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{stats.pendingDocuments}</p>
                </div>
              </div>
              {stats.pendingDocuments > 0 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Χρειάζεται ενέργεια</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              {stats.pendingDocuments === 0 ? 
                "Όλα τα έγγραφα ολοκληρώθηκαν" : 
                `${stats.pendingDocuments} έγγραφα περιμένουν επεξεργασία`
              }
            </div>
          </CardContent>
        </Card>

        {/* Projects Overview */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Έργα</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{projectsTotal}</p>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-green-600 font-medium">{stats.projectStats?.completed || 0} ολοκληρώθηκαν</div>
                <div className="text-yellow-600">{stats.projectStats?.pending_reallocation || 0} αναδιανομή</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ενεργά:</span>
                <span className="font-medium">{stats.projectStats?.active || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Εκκρεμή:</span>
                <span className="font-medium">{stats.projectStats?.pending || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Overview */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Euro className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Προϋπολογισμός</CardTitle>
                  <p className="text-2xl font-bold text-foreground">
                    {(() => {
                      const values = Object.values(stats.budgetTotals || {});
                      const total = values.reduce((sum: number, val: any) => {
                        const num = typeof val === 'number' ? val : 0;
                        return sum + num;
                      }, 0);
                      return formatLargeNumber(total);
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {budgetUtilization > 50 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs font-medium">{budgetUtilization}% χρήση</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Αξιοποίηση</span>
                <span className="font-medium">{formatLargeNumber(stats.budgetTotals?.completed || 0)}</span>
              </div>
              <Progress value={budgetUtilization} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced User Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Units - Enhanced */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Οι Μονάδες μου</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userUnits.length > 0 ? (
                userUnits.map((unit, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 ${
                      selectedUnit === unit 
                        ? 'bg-primary/10 border-primary shadow-sm' 
                        : 'bg-card hover:bg-muted/50 border-border hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedUnit(selectedUnit === unit ? null : unit)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{getUnitName(unit)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Εκκρεμή έγγραφα</span>
                      <span className="text-sm font-semibold text-primary">{getPendingDocsForUnit(unit)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Δεν βρέθηκαν μονάδες</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Documents - Enhanced */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Πρόσφατα Έγγραφά μου</CardTitle>
              </div>
              <Badge variant="outline">
                {userDocuments.length} συνολικά
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoadingUserDocs ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : userDocuments.length > 0 ? (
                userDocuments.map((doc) => {
                  const documentTitle = (doc.status === 'completed' && doc.protocol_number_input) 
                    ? doc.protocol_number_input 
                    : (doc.protocol_number || `Έγγραφο #${doc.id}`);

                  return (
                    <div key={doc.id} className="p-3 border rounded-lg hover:shadow-sm transition-all duration-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">{documentTitle}</p>
                            <Badge 
                              variant={doc.status === 'completed' ? 'default' : 
                                     doc.status === 'pending' ? 'secondary' : 'outline'}
                              className="text-xs shrink-0"
                            >
                              {doc.status === 'pending' ? 'Εκκρεμεί' : 
                               doc.status === 'completed' ? 'Ολοκληρώθηκε' : 
                               doc.status === 'approved' ? 'Εγκεκριμένο' : 'Σε επεξεργασία'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {doc.created_at && new Date(doc.created_at).toLocaleDateString('el-GR')}
                            {(doc as any).project_na853 && (
                              <>
                                <span>•</span>
                                <span>NA853: {(doc as any).project_na853}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocument(doc);
                              setShowDocumentModal(true);
                            }}
                            className="hover:bg-orange-50 hover:text-orange-600 transition-colors"
                            title="Λεπτομέρειες"
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                          {(!doc.protocol_number_input || doc.status !== 'completed') && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocument(doc);
                                setShowProtocolModal(true);
                              }}
                              className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="Προσθήκη Πρωτοκόλλου"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-3">Δεν βρέθηκαν πρόσφατα έγγραφα</p>
                  <Button size="sm" asChild>
                    <Link href="/documents">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Δημιουργία Εγγράφου
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            {userDocuments.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <Button variant="link" size="sm" asChild className="w-full">
                  <Link href="/documents">
                    Προβολή όλων των εγγράφων
                    <ArrowUpRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Recent Activity Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Πρόσφατη Δραστηριότητα</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.recentActivity?.length || 0} εγγραφές
              </Badge>
              <Button variant="outline" size="sm" asChild>
                <Link href="/budget/history">
                  Προβολή όλων
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="relative p-4 rounded-lg border hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-card to-card/50"
                >
                  {/* Timeline indicator */}
                  <div className="absolute left-0 top-4 w-1 h-8 bg-primary/20 rounded-r-full"></div>
                  
                  <div className="pl-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-relaxed mb-2">{activity.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {activity.documentId && (
                            <Link href={`/documents?highlight=${activity.documentId}`}>
                              <Badge variant="outline" className="text-xs hover:bg-gray-50 cursor-pointer transition-colors">
                                <FileText className="w-3 h-3 mr-1" />
                                {(activity as any).protocolNumber || `Έγγραφο #${activity.documentId}`}
                              </Badge>
                            </Link>
                          )}
                          
                          {activity.changeAmount !== undefined && (
                            <Badge 
                              variant={activity.changeAmount > 0 ? "default" : "destructive"} 
                              className="text-xs font-medium"
                            >
                              {activity.changeAmount > 0 ? (
                                <TrendingUp className="w-3 h-3 mr-1" />
                              ) : (
                                <TrendingDown className="w-3 h-3 mr-1" />
                              )}
                              {activity.changeAmount > 0 ? '+' : ''}
                              {formatLargeNumber(Math.abs(activity.changeAmount))}
                            </Badge>
                          )}
                          
                          {(activity as any).na853 && (
                            <Badge variant="secondary" className="text-xs">
                              <Target className="w-3 h-3 mr-1" />
                              NA853: {(activity as any).na853}
                            </Badge>
                          )}
                          
                          {activity.createdBy && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {activity.createdBy}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(activity.date).toLocaleDateString('el-GR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Δεν υπάρχει καταγεγραμμένη πρόσφατη δραστηριότητα</p>
                <p className="text-xs mt-1">Η δραστηριότητα θα εμφανιστεί εδώ όταν γίνουν αλλαγές στον προϋπολογισμό</p>
              </div>
            )}
          </div>
          
          {/* Summary bar at bottom */}
          {stats.recentActivity && stats.recentActivity.length > 0 && (
            <div className="mt-6 pt-4 border-t bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Συνολική δραστηριότητα σήμερα</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-600">
                      {stats.recentActivity.filter(a => (a.changeAmount || 0) > 0).length} αυξήσεις
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-600">
                      {stats.recentActivity.filter(a => (a.changeAmount || 0) < 0).length} μειώσεις
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Details Modal */}
      {selectedDocument && (
        <DocumentDetailsModal
          open={showDocumentModal}
          onOpenChange={(open) => {
            setShowDocumentModal(open);
            if (!open) setSelectedDocument(null);
          }}
          document={selectedDocument as any}
        />
      )}

      {/* Protocol Modal */}
      {selectedDocument && (
        <ViewDocumentModal
          isOpen={showProtocolModal}
          onClose={() => {
            setShowProtocolModal(false);
            setSelectedDocument(null);
          }}
          document={selectedDocument}
        />
      )}
    </div>
  );
}

export default UserDashboard;