/**
 * Enhanced Manager Dashboard
 * Refactored to use shared components for consistency
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useState } from "react";
import {
  FileText,
  Euro,
  Target,
  Clock,
  Eye,
  BarChart3,
  Users,
  AlertTriangle,
  PieChart,
} from "lucide-react";

import {
  DashboardShell,
  KpiCard,
  RecentActivityPanel,
  DashboardSkeleton,
} from "./shared";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  formatLargeNumber,
  calculateCompletionRate,
  sumObjectValues,
} from "@/lib/dashboard-utils";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import { apiRequest } from "@/lib/queryClient";

export function ManagerDashboard() {
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

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: createDashboardQueryKey(user?.id, user?.unit_id),
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.unit_id && user.unit_id.length > 0,
  });

  // Compute budget totals
  const budgetTotals = useMemo(() => {
    if (!stats?.budgetTotals) return { total: 0, allocated: 0, remaining: 0 };
    const total = sumObjectValues(stats.budgetTotals);
    const allocated = stats.budgetTotals.allocated || 0;
    const remaining = total - allocated;
    return { total, allocated, remaining };
  }, [stats?.budgetTotals]);

  const completionRate = calculateCompletionRate(
    stats?.completedDocuments || 0,
    stats?.totalDocuments || 0,
  );

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
          Δεν ήταν δυνατή η φόρτωση των στατιστικών διαχείρισης.
        </p>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Πίνακας Διαχείρισης"
      subtitle={`Καλώς ήρθες, ${user?.name}. Παρακολούθηση και εποπτεία της συνολικής δραστηριότητας.`}
      roleBadge="MANAGER"
      actions={[
        {
          label: "Ιστορικό Προϋπολογισμού",
          icon: BarChart3,
          href: "/budget/history",
        },
        {
          label: "Επισκόπηση Εγγράφων",
          icon: Eye,
          href: "/documents",
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
          detail={`${completionRate}% ολοκληρώθηκε`}
          href="/documents"
        />

        <KpiCard
          label="Προς Επισκόπηση"
          value={stats?.pendingDocuments || 0}
          icon={Clock}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-50"
          borderColor="border-l-orange-500"
          detail="Έγγραφα που περιμένουν επισκόπηση"
          badge={
            (stats?.pendingDocuments || 0) > 0 ? (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            ) : undefined
          }
          href="/documents?status=pending"
        />

        <KpiCard
          label="Συνολικός Προϋπολογισμός"
          value={formatLargeNumber(budgetTotals.total)}
          icon={Euro}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
          borderColor="border-l-green-500"
          detail={`Κατανεμημένα: ${formatLargeNumber(budgetTotals.allocated)}`}
          href="/budget/history"
        />

        <KpiCard
          label="Ενεργά Έργα"
          value={stats?.projectStats?.active || 0}
          icon={Target}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-50"
          borderColor="border-l-purple-500"
          detail={`Σε εκκρεμότητα: ${stats?.projectStats?.pending || 0}`}
          href="/projects?status=active"
        />
      </div>

      {/* Budget and Team Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Analysis */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">
                  Ανάλυση Προϋπολογισμού
                </CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/budget/history">Λεπτομέρειες</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Συνολικός Προϋπολογισμός
                  </span>
                  <span className="text-sm font-bold">
                    {formatLargeNumber(budgetTotals.total)}
                  </span>
                </div>
                <Progress
                  value={
                    budgetTotals.total > 0
                      ? (budgetTotals.allocated / budgetTotals.total) * 100
                      : 0
                  }
                  className="h-2"
                />

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {formatLargeNumber(budgetTotals.allocated)}
                    </div>
                    <div className="text-xs text-green-700">Κατανεμημένα</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {formatLargeNumber(budgetTotals.remaining)}
                    </div>
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
                <Link href="/documents">Προβολή Όλων</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats?.totalDocuments || 0}
                  </div>
                  <div className="text-sm text-blue-700">Συνολικά Έγγραφα</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats?.pendingDocuments || 0}
                  </div>
                  <div className="text-sm text-orange-700">Σε επεξεργασία</div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="text-sm text-muted-foreground mb-2">
                  Πρόοδος Ολοκλήρωσης
                </div>
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

      {/* Recent Activity */}
      {stats?.recentActivity && (
        <RecentActivityPanel
          title="Παρακολούθηση Δραστηριότητας"
          activities={stats.recentActivity}
          maxItems={8}
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

export default ManagerDashboard;
