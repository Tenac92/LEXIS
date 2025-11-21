import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Euro,
  BarChart3,
  Calendar,
  Users,
  Building,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Eye,
  Filter,
  PieChart,
  Activity
} from "lucide-react";
import React, { useMemo } from 'react';

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

export function ManagerDashboard() {
  const { user } = useAuth();
  
  // Get manager dashboard stats
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get budget overview for manager view
  const { data: budgetOverview } = useQuery({
    queryKey: ["/api/budget/overview"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Compute budget totals for display
  const budgetTotals = useMemo(() => {
    if (!stats?.budgetTotals) return { total: 0, allocated: 0, remaining: 0 };
    
    const total = Object.values(stats.budgetTotals).reduce((sum, value) => sum + value, 0);
    const allocated = stats.budgetTotals.allocated || 0;
    const remaining = total - allocated;
    
    return { total, allocated, remaining };
  }, [stats?.budgetTotals]);

  // Enhanced skeleton loader for manager dashboard
  const ManagerDashboardSkeleton = () => (
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
    return <ManagerDashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">Σφάλμα φόρτωσης δεδομένων</h3>
        <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των στατιστικών διαχείρισης.</p>
      </div>
    );
  }

  const completionRate = stats?.totalDocuments ? 
    Math.round((stats.completedDocuments / stats.totalDocuments) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Manager Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Πίνακας Διαχείρισης</h1>
          <p className="text-muted-foreground mt-1">
            Καλώς ήρθες, {user?.name}. Παρακολούθηση και εποπτεία της συνολικής δραστηριότητας.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/budget/history">
              <BarChart3 className="w-4 h-4 mr-2" />
              Ιστορικό Προϋπολογισμού
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/documents">
              <Eye className="w-4 h-4 mr-2" />
              Επισκόπηση Εγγράφων
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Documents Oversight */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Συνολικά Έγγραφα</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{stats?.totalDocuments || 0}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              <Progress value={completionRate} className="h-2 mb-1" />
              {completionRate}% ολοκληρώθηκε
            </div>
          </CardContent>
        </Card>

        {/* Pending Reviews */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Προς Επισκόπηση</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{stats?.pendingDocuments || 0}</p>
                </div>
              </div>
              {(stats?.pendingDocuments || 0) > 0 && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Χρειάζεται επισκόπηση</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Έγγραφα που περιμένουν επισκόπηση
            </div>
          </CardContent>
        </Card>

        {/* Budget Overview */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Euro className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Συνολικός Προϋπολογισμός</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{formatLargeNumber(budgetTotals.total)}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Κατανεμημένα: {formatLargeNumber(budgetTotals.allocated)}
            </div>
          </CardContent>
        </Card>

        {/* Project Status */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ενεργά Έργα</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{stats?.projectStats?.active || 0}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Σε εκκρεμότητα: {stats?.projectStats?.pending || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Analysis */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Ανάλυση Προϋπολογισμού</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/budget/history">
                  <Filter className="w-4 h-4 mr-2" />
                  Λεπτομέρειες
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Συνολικός Προϋπολογισμός</span>
                  <span className="text-sm font-bold">{formatLargeNumber(budgetTotals.total)}</span>
                </div>
                <Progress value={budgetTotals.total > 0 ? (budgetTotals.allocated / budgetTotals.total) * 100 : 0} className="h-2" />
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{formatLargeNumber(budgetTotals.allocated)}</div>
                    <div className="text-xs text-green-700">Κατανεμημένα</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{formatLargeNumber(budgetTotals.remaining)}</div>
                    <div className="text-xs text-blue-700">Διαθέσιμα</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Επισκόπηση Ομάδας</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/documents">
                  <Eye className="w-4 h-4 mr-2" />
                  Προβολή Όλων
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats?.totalDocuments || 0}</div>
                  <div className="text-sm text-blue-700">Συνολικά Έγγραφα</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats?.pendingDocuments || 0}</div>
                  <div className="text-sm text-orange-700">Σε επεξεργασία</div>
                </div>
              </div>
              
              <div className="pt-3 border-t">
                <div className="text-sm text-muted-foreground mb-2">Πρόοδος Ολοκλήρωσης</div>
                <Progress value={completionRate} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span className="font-medium">{completionRate}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Monitoring */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Παρακολούθηση Δραστηριότητας</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats?.recentActivity?.length || 0} εγγραφές
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
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 8).map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="relative p-4 rounded-lg border hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-card to-card/50"
                >
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
                          {activity.na853 && (
                            <Badge variant="outline" className="text-xs hover:bg-gray-50 cursor-pointer transition-colors">
                              <FileText className="w-3 h-3 mr-1" />
                              NA853: {activity.na853}
                            </Badge>
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
                              {Math.abs(activity.changeAmount).toLocaleString("el-GR", {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {new Date(activity.date).toLocaleDateString('el-GR')}
                        </div>
                        {activity.createdBy && (
                          <div className="text-xs text-muted-foreground font-medium">
                            {activity.createdBy}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-6 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Δεν υπάρχει πρόσφατη δραστηριότητα</p>
              </div>
            )}
          </div>
          
          {/* Summary bar at bottom */}
          {stats?.recentActivity && stats.recentActivity.length > 0 && (
            <div className="mt-6 pt-4 border-t bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Συνολική δραστηριότητα</span>
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
    </div>
  );
}

export default ManagerDashboard;