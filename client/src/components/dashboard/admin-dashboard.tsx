/**
 * Enhanced Admin Dashboard
 * Refactored to use shared components and improved UX
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Euro,
  Building,
  Clock,
  Database,
  Target,
  Upload,
  Plus,
  Eye,
  BarChart3,
  Calendar,
  Shield,
  AlertCircle,
  Settings,
} from "lucide-react";

import {
  DashboardShell,
  KpiCard,
  WorkQueuePanel,
  RecentActivityPanel,
  DashboardSkeleton,
  EmptyState,
} from "./shared";
import type { DashboardStats } from "@/lib/dashboard";
import type { WorkQueueItem } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { formatCurrency, formatLargeNumber } from "@/lib/dashboard-utils";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import { apiRequest } from "@/lib/queryClient";

export function AdminDashboard() {
  const { user } = useAuth();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Handler for clicking on documents in recent activity
  const handleDocumentClick = async (documentId: number) => {
    try {
      const document = await apiRequest<any>(`/api/documents/${documentId}`);
      setSelectedDocument(document);
      setShowDocumentModal(true);
    } catch (error) {
      console.error("Error fetching document:", error);
    }
  };

  // Primary stats query
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.unit_id && user.unit_id.length > 0,
  });

  // Prefetch secondary queries after primary loads
  const queryClient = useQueryClient();
  useEffect(() => {
    if (stats && !isLoading) {
      void queryClient.prefetchQuery({
        queryKey: ["/api/admin/system-stats"],
        staleTime: 5 * 60 * 1000,
      });
      void queryClient.prefetchQuery({
        queryKey: ["/api/projects"],
        staleTime: 5 * 60 * 1000,
      });
      void queryClient.prefetchQuery({
        queryKey: ["/api/budget/overview"],
        staleTime: 5 * 60 * 1000,
      });
      void queryClient.prefetchQuery({
        queryKey: ["/api/budget/notifications"],
        staleTime: 1 * 60 * 1000,
      });
    }
  }, [stats, isLoading, queryClient]);

  // Secondary queries (loaded progressively)
  const { data: systemStats } = useQuery({
    queryKey: ["/api/admin/system-stats"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!stats,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["/api/projects"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!stats,
  });

  const { data: budgetOverview } = useQuery({
    queryKey: ["/api/budget/overview"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!stats,
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/budget/notifications"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1 * 60 * 1000,
    enabled: !!stats,
  });

  // Compute attention required items
  const attentionItems = useMemo<WorkQueueItem[]>(() => {
    const items: WorkQueueItem[] = [];

    // Pending approvals
    if (stats?.pendingDocuments && stats.pendingDocuments > 0) {
      items.push({
        id: "pending-approvals",
        title: `${stats.pendingDocuments} έγγραφα χρειάζονται έγκριση`,
        description: "Έγγραφα που περιμένουν έγκριση",
        severity: "high",
        icon: Clock,
        href: "/documents?status=pending",
      });
    }

    // Budget alerts
    if (alerts && Array.isArray(alerts) && alerts.length > 0) {
      alerts.slice(0, 3).forEach((alert) => {
        items.push({
          id: `alert-${alert.id || Math.random()}`,
          title: alert.message || "Ειδοποίηση προϋπολογισμού",
          severity: alert.severity === "critical" ? "high" : "medium",
          icon: AlertTriangle,
          href: alert.href || "/budget/history",
        });
      });
    }

    // System health issues (if available)
    if (systemStats && (systemStats as any).healthPercentage < 95) {
      items.push({
        id: "system-health",
        title: "Η υγεία του συστήματος χρειάζεται προσοχή",
        description: `Διαθεσιμότητα: ${(systemStats as any).healthPercentage}%`,
        severity: "medium",
        icon: Database,
        href: "/admin/system-health",
      });
    }

    return items;
  }, [stats, alerts, systemStats]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">
          Σφάλμα φόρτωσης δεδομένων
        </h3>
        <p className="text-muted-foreground">
          Δεν ήταν δυνατή η φόρτωση των στατιστικών του συστήματος.
        </p>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Διαχειριστικός Πίνακας"
      subtitle={`Καλώς ήρθες, ${user?.name}. Διαχείριση έργων, προϋπολογισμών και συστημάτων.`}
      roleBadge="ADMIN"
      actions={[
        {
          label: "Έργα",
          icon: Building,
          href: "/projects",
        },
        {
          label: "Προϋπολογισμός",
          icon: Euro,
          href: "/budget/history",
          variant: "outline",
        },
        {
          label: "Χρήστες",
          icon: Users,
          href: "/users",
          variant: "outline",
        },
      ]}
    >
      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard
          label="Συνολικά Έγγραφα"
          value={stats?.totalDocuments || 0}
          icon={FileText}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-50"
          borderColor="border-l-blue-500"
          detail="Όλα τα έγγραφα στο σύστημα"
          href="/documents"
        />

        <KpiCard
          label="Εκκρεμείς Εγκρίσεις"
          value={stats?.pendingDocuments || 0}
          icon={Clock}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-50"
          borderColor="border-l-orange-500"
          detail="Έγγραφα που χρειάζονται έγκριση"
          badge={
            (stats?.pendingDocuments || 0) > 0 ? (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            ) : undefined
          }
          href="/documents?status=pending"
        />

        <KpiCard
          label="Ενεργά Έργα"
          value={stats?.projectStats?.active || 0}
          icon={Target}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
          borderColor="border-l-green-500"
          detail="Έργα σε εξέλιξη"
          href="/projects?status=active"
        />

        <KpiCard
          label="Υγεία Συστήματος"
          value="98%"
          icon={Database}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-50"
          borderColor="border-l-purple-500"
          detail="Διαθεσιμότητα συστήματος"
          badge={<CheckCircle2 className="h-4 w-4 text-green-600" />}
        />
      </div>

      {/* Attention Required */}
      {attentionItems.length > 0 && (
        <WorkQueuePanel
          title="Χρειάζεται Προσοχή"
          items={attentionItems}
          icon={AlertCircle}
          emptyMessage="Όλα τα συστήματα λειτουργούν κανονικά"
          maxItems={5}
          viewAllHref="/admin/notifications"
        />
      )}

      {/* Admin Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Διαχείριση Έργων</CardTitle>
              </div>
              <Button size="sm" asChild>
                <Link href="/projects/new">
                  <Plus className="w-4 h-4 mr-1" />
                  Νέο
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats?.projectStats?.active || 0}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">
                    Ενεργά
                  </div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats?.projectStats?.pending || 0}
                  </div>
                  <div className="text-xs text-orange-600 font-medium">
                    Εκκρεμή
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start"
                >
                  <Link href="/projects">
                    <Eye className="w-4 h-4 mr-2" />
                    Προβολή όλων των έργων
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start"
                >
                  <Link href="/admin/project-analysis">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Ανάλυση απόδοσης
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">
                  Διαχείριση Προϋπολογισμού
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Συνολικός Προϋπολογισμός
                  </span>
                  <span className="font-medium">
                    {stats?.budgetTotals?.total
                      ? formatCurrency(stats.budgetTotals.total)
                      : "Δεν διατίθεται"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Κατανομή</span>
                  <span className="font-medium text-green-600">
                    {stats?.budgetTotals?.allocated
                      ? formatCurrency(stats.budgetTotals.allocated)
                      : "Δεν διατίθεται"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Διαθέσιμο</span>
                  <span className="font-medium text-blue-600">
                    {stats?.budgetTotals?.remaining
                      ? formatCurrency(stats.budgetTotals.remaining)
                      : "Δεν διατίθεται"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start"
                >
                  <Link href="/admin/budget-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Φόρτωση προϋπολογισμού
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start"
                >
                  <Link href="/admin/payments-import">
                    <Upload className="w-4 h-4 mr-2" />
                    Εισαγωγή πληρωμών
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start"
                >
                  <Link href="/budget/history">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Ιστορικό προϋπολογισμού
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Διαχείριση Συστήματος</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start"
              >
                <Link href="/users">
                  <Users className="w-4 h-4 mr-2" />
                  Διαχείριση χρηστών
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start"
              >
                <Link href="/admin/notifications">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Ειδοποιήσεις συστήματος
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start"
              >
                <Link href="/admin/quarter-management">
                  <Calendar className="w-4 h-4 mr-2" />
                  Διαχείριση τριμήνων
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start"
              >
                <Link href="/templates">
                  <FileText className="w-4 h-4 mr-2" />
                  Πρότυπα εγγράφων
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start"
              >
                <Link href="/admin/system-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Ρυθμίσεις συστήματος
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {stats?.recentActivity && (
        <RecentActivityPanel
          title="Πρόσφατη Δραστηριότητα Συστήματος"
          activities={stats.recentActivity}
          maxItems={10}
          viewAllHref="/budget/history"
          emptyMessage="Δεν υπάρχει πρόσφατη δραστηριότητα"
          onDocumentClick={handleDocumentClick}
        />
      )}

      {/* Document Details Modal */}
      {selectedDocument && (
        <DocumentDetailsModal
          open={showDocumentModal}
          onOpenChange={(open) => {
            setShowDocumentModal(open);
            if (!open) setSelectedDocument(null);
          }}
          document={selectedDocument}
        />
      )}
    </DashboardShell>
  );
}

export default AdminDashboard;
