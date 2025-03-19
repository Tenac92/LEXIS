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
import UsersPage from "@/pages/users";
import BudgetHistoryPage from "@/pages/budget-history-page";
import NotificationsPage from "@/pages/NotificationsPage";
import BulkUpdatePage from "@/pages/projects/bulk-update";
import TemplatesPage from "@/pages/templates";
import { ProtectedRoute } from "./lib/protected-route";
import { PageTransition } from "@/components/ui/page-transition";

function Router() {
  return (
    <PageTransition>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/documents" component={DocumentsPage} />
        <ProtectedRoute path="/templates" component={TemplatesPage} />
        <ProtectedRoute path="/projects" component={ProjectsPage} />
        <ProtectedRoute path="/projects/:mis" component={ProjectDetailsPage} />
        <ProtectedRoute path="/projects/bulk-update" component={BulkUpdatePage} />
        <ProtectedRoute path="/users" component={UsersPage} />
        <ProtectedRoute path="/budget-history" component={BudgetHistoryPage} />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
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
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;