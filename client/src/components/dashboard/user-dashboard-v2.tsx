/**
 * Enhanced User Dashboard
 * Refactored to use shared components and improved UX
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import {
  FileText,
  Euro,
  Target,
  Clock,
  AlertCircle,
  PlusCircle,
  Building,
  Users,
  Calendar,
  Info,
  ClipboardCheck,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import {
  DashboardShell,
  KpiCard,
  RecentActivityPanel,
  DashboardSkeleton,
  EmptyState,
} from "./shared";
import type { DashboardStats } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  formatLargeNumber,
  calculateCompletionRate,
  calculateBudgetUtilization,
  sumObjectValues,
} from "@/lib/dashboard-utils";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import { ViewDocumentModal } from "@/components/documents/document-modals";

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
  unit_id?: number;
}

export function UserDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(
    null,
  );
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showProtocolModal, setShowProtocolModal] = useState(false);

  // Dashboard stats
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

  // User's recent documents
  const { data: userDocs = [], isLoading: isLoadingUserDocs } = useQuery<
    DocumentItem[]
  >({
    queryKey: ["/api/documents/user", "recent"],
    queryFn: async () => {
      try {
        if (!user?.unit_id || user.unit_id.length === 0) return [];
        const response = await fetch("/api/documents/user", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok)
          throw new Error(`Failed to fetch documents: ${response.status}`);
        const data = await response.json();
        const documents = Array.isArray(data) ? data : [];
        return documents.slice(0, 5).map((doc) => ({
          ...doc,
          title:
            doc.title ||
            doc.document_type ||
            `Έγγραφο ${doc.protocol_number || doc.id}`,
          status: doc.status || "pending",
        }));
      } catch (error) {
        console.error(
          "[UserDashboard] Error fetching recent documents:",
          error,
        );
        return [];
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
    enabled: !!user?.unit_id && user.unit_id.length > 0,
  });

  // Units
  const { data: units = [] } = useQuery({
    queryKey: ["/api/public/units"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Calculations
  const completionRate = calculateCompletionRate(
    stats?.completedDocuments || 0,
    stats?.totalDocuments || 0,
  );

  const budgetUtilization = useMemo(() => {
    const total = sumObjectValues(stats?.budgetTotals || {});
    const used = stats?.budgetTotals?.completed || 0;
    return calculateBudgetUtilization(used, total);
  }, [stats?.budgetTotals]);

  const projectsTotal = sumObjectValues(stats?.projectStats || {});

  const userUnits = user?.unit_id || [];
  const userDocuments = Array.isArray(userDocs) ? userDocs : [];

  const getUnitName = (unitId: number): string => {
    const unit = Array.isArray(units)
      ? units.find((u: any) => u.id === unitId)
      : null;
    return unit?.unit || `Μονάδα ${unitId}`;
  };

  const getPendingDocsForUnit = (unitId: number): number => {
    return userDocuments.filter(
      (doc: any) => doc.unit_id === unitId && doc.status === "pending",
    ).length;
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">Σφάλμα Φόρτωσης</h3>
        <p className="text-muted-foreground">
          Αποτυχία φόρτωσης δεδομένων. Παρακαλώ ανανεώστε τη σελίδα.
        </p>
        {error instanceof Error && (
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        )}
      </div>
    );
  }

  return (
    <DashboardShell
      title="Πίνακας Ελέγχου"
      subtitle={`Καλώς ήρθες, ${user?.name}. Διαχείριση των εγγράφων και έργων σου.`}
      roleBadge="USER"
      actions={[
        {
          label: "Όλα τα Έγγραφα",
          icon: FileText,
          href: "/documents",
          variant: "outline",
        },
        ...(isAdmin
          ? [
              {
                label: "Νέο Έργο",
                icon: PlusCircle,
                href: "/projects/new",
              },
            ]
          : []),
      ]}
    >
      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          label="Έγγραφα"
          value={stats.totalDocuments}
          icon={FileText}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-50"
          borderColor="border-l-blue-500"
          detail={`${completionRate}% ολοκληρώθηκε`}
          badge={
            <Badge variant="secondary" className="text-xs">
              {completionRate}%
            </Badge>
          }
          href="/documents"
        />

        <KpiCard
          label="Εκκρεμή"
          value={stats.pendingDocuments}
          icon={Clock}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-50"
          borderColor="border-l-yellow-500"
          detail={
            stats.pendingDocuments === 0
              ? "Όλα τα έγγραφα ολοκληρώθηκαν"
              : `${stats.pendingDocuments} έγγραφα περιμένουν επεξεργασία`
          }
          badge={
            stats.pendingDocuments > 0 ? (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            ) : undefined
          }
          href="/documents?status=pending"
        />

        <KpiCard
          label="Έργα"
          value={projectsTotal}
          icon={Target}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
          borderColor="border-l-green-500"
          detail={`Ενεργά: ${stats.projectStats?.active || 0} | Εκκρεμή: ${stats.projectStats?.pending || 0}`}
          href="/projects"
        />

        <KpiCard
          label="Προϋπολογισμός"
          value={formatLargeNumber(sumObjectValues(stats.budgetTotals || {}))}
          icon={Euro}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-50"
          borderColor="border-l-purple-500"
          detail={`${budgetUtilization}% χρήση`}
          trend={budgetUtilization > 50 ? "up" : "down"}
          badge={
            budgetUtilization > 50 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )
          }
          href="/budget/history"
        />
      </div>

      {/* User Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Units */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Οι Μονάδες μου</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {userUnits.length > 0 ? (
              <div className="space-y-3">
                {userUnits.map((unit, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 ${
                      selectedUnit === unit
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-card hover:bg-muted/50 border-border hover:shadow-sm"
                    }`}
                    onClick={() =>
                      setSelectedUnit(selectedUnit === unit ? null : unit)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">
                          {getUnitName(unit)}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Εκκρεμή έγγραφα
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {getPendingDocsForUnit(unit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="Δεν βρέθηκαν μονάδες"
                className="py-6"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Πρόσφατα Έγγραφά μου</CardTitle>
              </div>
              <Badge variant="outline">{userDocuments.length} συνολικά</Badge>
            </div>
          </CardHeader>
          <CardContent>
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
              <>
                <div className="space-y-3">
                  {userDocuments.map((doc) => {
                    const documentTitle =
                      doc.status === "completed" && doc.protocol_number_input
                        ? doc.protocol_number_input
                        : doc.protocol_number || `Έγγραφο #${doc.id}`;

                    return (
                      <div
                        key={doc.id}
                        className="p-3 border rounded-lg hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {documentTitle}
                              </p>
                              <Badge
                                variant={
                                  doc.status === "completed"
                                    ? "default"
                                    : doc.status === "pending"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="text-xs shrink-0"
                              >
                                {doc.status === "pending"
                                  ? "Εκκρεμεί"
                                  : doc.status === "completed"
                                    ? "Ολοκληρώθηκε"
                                    : doc.status === "approved"
                                      ? "Εγκεκριμένο"
                                      : "Σε επεξεργασία"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {doc.created_at &&
                                new Date(doc.created_at).toLocaleDateString(
                                  "el-GR",
                                )}
                              {(doc as any).project_na853 && (
                                <>
                                  <span>•</span>
                                  <span>
                                    NA853: {(doc as any).project_na853}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setShowDocumentModal(true);
                              }}
                              className="hover:bg-orange-50 hover:text-orange-600 transition-colors"
                              title="Λεπτομέρειες"
                            >
                              <Info className="w-4 h-4" />
                            </Button>
                            {(!doc.protocol_number_input ||
                              doc.status !== "completed") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
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
                  })}
                </div>
                <div className="mt-4 pt-3 border-t">
                  <Button variant="link" size="sm" asChild className="w-full">
                    <Link href="/documents">
                      Προβολή όλων των εγγράφων
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState
                icon={FileText}
                title="Δεν βρέθηκαν πρόσφατα έγγραφα"
                action={{
                  label: "Δημιουργία Εγγράφου",
                  href: "/documents",
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {stats?.recentActivity && (
        <RecentActivityPanel
          title="Πρόσφατη Δραστηριότητα"
          activities={stats.recentActivity}
          maxItems={8}
          viewAllHref="/budget/history"
          emptyMessage="Δεν υπάρχει πρόσφατη δραστηριότητα"
        />
      )}

      {/* Modals */}
      {selectedDocument && (
        <>
          <DocumentDetailsModal
            open={showDocumentModal}
            onOpenChange={(open) => {
              setShowDocumentModal(open);
              if (!open) setSelectedDocument(null);
            }}
            document={selectedDocument as any}
          />
          <ViewDocumentModal
            isOpen={showProtocolModal}
            onClose={() => {
              setShowProtocolModal(false);
              setSelectedDocument(null);
            }}
            document={selectedDocument}
          />
        </>
      )}
    </DashboardShell>
  );
}

export default UserDashboard;
