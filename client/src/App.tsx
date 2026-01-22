import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { lazy, Suspense, FC } from "react";

const HomePage = lazy(() => import("@/pages/home-page"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const DocumentsPage = lazy(() => import("@/pages/documents-page"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const NewProjectPage = lazy(() => import("@/pages/projects/new"));
const ProjectDetailsPage = lazy(() => import("@/pages/projects/[mis]"));
const ComprehensiveEditProjectPage = lazy(
  () => import("@/pages/projects/[mis]/ComprehensiveEditFixed"),
);
const UsersPage = lazy(() => import("@/pages/users"));
const EmployeesPage = lazy(() => import("@/pages/employees"));
const BeneficiariesPage = lazy(() => import("@/pages/beneficiaries-page"));
const BudgetHistoryPage = lazy(() => import("@/pages/budget-history-page"));
const AdminNotificationsPage = lazy(
  () => import("@/pages/AdminNotificationsPage"),
);
const AdminBudgetUploadPage = lazy(
  () => import("@/pages/AdminBudgetUploadPage"),
);
const AdminPaymentsImportPage = lazy(
  () => import("@/pages/AdminPaymentsImportPage"),
);
const QuarterManagementPage = lazy(
  () => import("@/pages/admin/QuarterManagementPage"),
);
const BudgetMonitoringPage = lazy(
  () => import("@/pages/admin/BudgetMonitoringPage"),
);
const TemplatesPage = lazy(() => import("@/pages/templates"));

import { ProtectedRoute } from "./lib/protected-route";
import { PageTransition } from "@/components/ui/page-transition";
import { SessionKeeper } from "@/components/auth/SessionKeeper";
import { SessionWarning } from "@/components/auth/SessionWarning";
import SessionInit from "@/components/auth/SessionInit";
import { DocumentFormProvider } from "@/contexts/document-form-context";
import ErrorBoundary from "@/components/common/ErrorBoundary";

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">Loading...</div>
);

function Router(): JSX.Element {
  return (
    <PageTransition>
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <ProtectedRoute path="/" component={HomePage} />
          <ProtectedRoute path="/documents/new" component={DocumentsPage} />
          <ProtectedRoute path="/documents" component={DocumentsPage} />
          <ProtectedRoute path="/templates" component={TemplatesPage} />
          {/* Order matters: more specific routes should come first */}
          <ProtectedRoute path="/projects/new" component={NewProjectPage} />
          <ProtectedRoute
            path="/projects/:id/comprehensive-edit-fixed"
            component={ComprehensiveEditProjectPage}
          />
          <ProtectedRoute
            path="/projects/:id/comprehensive-edit-new"
            component={ComprehensiveEditProjectPage}
          />
          <ProtectedRoute
            path="/projects/:id/comprehensive-edit"
            component={ComprehensiveEditProjectPage}
          />
          <ProtectedRoute
            path="/projects/:id/edit"
            component={ComprehensiveEditProjectPage}
          />
          <ProtectedRoute path="/projects/:id" component={ProjectDetailsPage} />
          <ProtectedRoute path="/projects" component={ProjectsPage} />
          <ProtectedRoute path="/users" component={UsersPage} />
          <ProtectedRoute path="/employees" component={EmployeesPage} />
          <ProtectedRoute path="/beneficiaries" component={BeneficiariesPage} />
          <ProtectedRoute
            path="/budget-history"
            component={BudgetHistoryPage}
          />
          <ProtectedRoute
            path="/budget/history"
            component={BudgetHistoryPage}
          />
          <ProtectedRoute
            path="/notifications"
            component={AdminNotificationsPage}
          />
          <ProtectedRoute
            path="/admin/notifications"
            component={AdminNotificationsPage}
          />
          <ProtectedRoute
            path="/admin/budget-upload"
            component={AdminBudgetUploadPage}
          />
          <ProtectedRoute
            path="/admin/payments-import"
            component={AdminPaymentsImportPage}
          />
          <ProtectedRoute
            path="/admin/budget-monitoring"
            component={BudgetMonitoringPage}
          />
          <ProtectedRoute
            path="/admin/quarter-management"
            component={() => <QuarterManagementPage />}
          />

          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </PageTransition>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DocumentFormProvider>
            <Router />
            <SessionKeeper />
            <SessionInit />
            <Toaster />
          </DocumentFormProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
