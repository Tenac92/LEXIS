import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DocumentsPage from "@/pages/documents-page";
import ProjectsPage from "@/pages/projects";
import ProjectDetailsPage from "@/pages/projects/[mis]";
import EditProjectPage from "@/pages/projects/[mis]/edit";
import UsersPage from "@/pages/users";
import EmployeesPage from "@/pages/employees";
import BeneficiariesPage from "@/pages/beneficiaries-page";
import BudgetHistoryPage from "@/pages/budget-history-page";
import NotificationsPage from "@/pages/NotificationsPage";
import AdminNotificationsPage from "@/pages/AdminNotificationsPage";
import AdminBudgetUploadPage from "@/pages/AdminBudgetUploadPage";
// Fix type issue by explicitly defining component return type
import QuarterManagementPage from "@/pages/admin/QuarterManagementPage";
import { FC } from "react";
import BulkUpdatePage from "@/pages/projects/bulk-update";
import TemplatesPage from "@/pages/templates";
import TestSecondaryText from "@/pages/test-secondary-text";
import { ProtectedRoute } from "./lib/protected-route";
import { PageTransition } from "@/components/ui/page-transition";
import { SessionKeeper } from "@/components/auth/SessionKeeper";
import { SessionWarning } from "@/components/auth/SessionWarning";
import SessionInit from "@/components/auth/SessionInit";
import { DocumentFormProvider } from "@/contexts/document-form-context";

function Router(): JSX.Element {
  return (
    <PageTransition>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/documents/new" component={DocumentsPage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/templates" component={TemplatesPage} />
        <ProtectedRoute path="/projects/bulk-update" component={BulkUpdatePage} />
        {/* Order matters: more specific routes should come first */}
        <ProtectedRoute path="/projects/:mis/edit" component={EditProjectPage} />
        <ProtectedRoute path="/projects/:mis" component={ProjectDetailsPage} />
        <ProtectedRoute path="/projects" component={ProjectsPage} />
        <ProtectedRoute path="/users" component={UsersPage} />
        <ProtectedRoute path="/employees" component={EmployeesPage} />
        <ProtectedRoute path="/beneficiaries" component={BeneficiariesPage} />
        <ProtectedRoute path="/budget-history" component={BudgetHistoryPage} />
        <ProtectedRoute path="/budget/history" component={BudgetHistoryPage} />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/admin/notifications" component={AdminNotificationsPage} />
        <ProtectedRoute path="/admin/budget-upload" component={AdminBudgetUploadPage} />
        <ProtectedRoute path="/admin/quarter-management" component={() => <QuarterManagementPage />} />
        <Route path="/test/secondary-text" component={TestSecondaryText} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </PageTransition>
  );
}

function App() {
  return (
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
  );
}

export default App;