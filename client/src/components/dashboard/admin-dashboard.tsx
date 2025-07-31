import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Euro,
  BarChart3,
  Calendar,
  Building,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Database,
  Shield,
  Activity,
  Target
} from "lucide-react";
import React, { useMemo } from 'react';

import type { DashboardStats } from "@/lib/dashboard";

export function AdminDashboard() {
  const { user } = useAuth();
  
  // Get admin dashboard stats
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get system-wide statistics for admin view
  const { data: systemStats } = useQuery({
    queryKey: ["/api/admin/system-stats"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Get recent notifications/alerts for admin
  const { data: alerts } = useQuery({
    queryKey: ["/api/budget/notifications"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1 * 60 * 1000,
  });

  // Enhanced skeleton loader for admin dashboard
  const AdminDashboardSkeleton = () => (
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
    return <AdminDashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">Σφάλμα φόρτωσης δεδομένων</h3>
        <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των στατιστικών του συστήματος.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Διαχειριστικός Πίνακας</h1>
          <p className="text-muted-foreground mt-1">
            Καλώς ήρθες, {user?.name}. Εδώ μπορείς να παρακολουθείς το σύστημα και να διαχειρίζεσαι τους χρήστες.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/users">
              <Users className="w-4 h-4 mr-2" />
              Διαχείριση Χρηστών
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/notifications">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Ειδοποιήσεις
            </Link>
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Documents */}
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
              Όλα τα έγγραφα στο σύστημα
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Εκκρεμείς Εγκρίσεις</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{stats?.pendingDocuments || 0}</p>
                </div>
              </div>
              {(stats?.pendingDocuments || 0) > 0 && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Έγγραφα που χρειάζονται έγκριση
            </div>
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
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
              Έργα σε εξέλιξη
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Database className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Υγεία Συστήματος</CardTitle>
                  <p className="text-2xl font-bold text-foreground">98%</p>
                </div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground">
              Διαθεσιμότητα συστήματος
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Alerts & Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Ειδοποιήσεις Συστήματος</CardTitle>
              </div>
              <Badge variant="outline">
                {alerts?.length || 0} ενεργές
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert: any, index: number) => (
                  <div key={index} className="p-3 border rounded-lg hover:shadow-sm transition-all duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{alert.message || 'Ειδοποίηση συστήματος'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {alert.created_at ? new Date(alert.created_at).toLocaleDateString('el-GR') : 'Σήμερα'}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {alert.severity || 'Info'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Δεν υπάρχουν ενεργές ειδοποιήσεις</p>
                </div>
              )}
              {alerts && alerts.length > 0 && (
                <div className="pt-3 border-t">
                  <Button variant="link" size="sm" asChild className="w-full">
                    <Link href="/notifications">
                      Προβολή όλων των ειδοποιήσεων
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Admin Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Γρήγορες Ενέργειες</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
                <Link href="/users">
                  <Users className="h-5 w-5" />
                  <span className="text-sm">Χρήστες</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
                <Link href="/budget/history">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-sm">Ιστορικό</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
                <Link href="/documents">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm">Έγγραφα</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
                <Link href="/projects">
                  <Building className="h-5 w-5" />
                  <span className="text-sm">Έργα</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent System Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Πρόσφατη Δραστηριότητα Συστήματος</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {stats?.recentActivity?.length || 0} εγγραφές
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 10).map((activity, index) => (
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
                            <Badge variant="outline" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              Έγγραφο #{activity.documentId}
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
          
          {stats?.recentActivity && stats.recentActivity.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <Button variant="outline" asChild className="w-full">
                <Link href="/budget/history">
                  Προβολή πλήρους ιστορικού
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminDashboard;