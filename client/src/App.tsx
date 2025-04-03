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
import BudgetHistoryPage from "@/pages/budget-history-page";
import NotificationsPage from "@/pages/NotificationsPage";
import AdminNotificationsPage from "@/pages/AdminNotificationsPage";
import AdminBudgetUploadPage from "@/pages/AdminBudgetUploadPage";
import BulkUpdatePage from "@/pages/projects/bulk-update";
import TemplatesPage from "@/pages/templates";
import { ProtectedRoute } from "./lib/protected-route";
import { PageTransition } from "@/components/ui/page-transition";
import { SessionKeeper } from "@/components/auth/SessionKeeper";
import { SessionWarning } from "@/components/auth/SessionWarning";
import { SessionInit } from "@/components/auth/SessionInit";

function Router() {
  return (
    <PageTransition>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/templates" component={TemplatesPage} />
        <ProtectedRoute path="/projects/bulk-update" component={BulkUpdatePage} />
        {/* Order matters: more specific routes should come first */}
        <ProtectedRoute path="/projects/:mis/edit" component={EditProjectPage} />
        <ProtectedRoute path="/projects/:mis" component={ProjectDetailsPage} />
        <ProtectedRoute path="/projects" component={ProjectsPage} />
        <ProtectedRoute path="/users" component={UsersPage} />
        <ProtectedRoute path="/budget-history" component={BudgetHistoryPage} />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/admin/notifications" component={AdminNotificationsPage} />
        <ProtectedRoute path="/admin/budget-upload" component={AdminBudgetUploadPage} />
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
        <Router />
        <SessionKeeper />
        <SessionInit />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;