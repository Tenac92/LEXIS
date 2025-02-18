import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Loader2, FileText, FolderKanban, LogOut } from "lucide-react";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const { user, logoutMutation, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-r from-background via-muted to-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-foreground bg-clip-text text-transparent">
                Welcome, {user?.email}
              </h1>
              <p className="text-muted-foreground mt-1">Document Management System</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-card rounded-lg p-1 shadow-sm">
                <Link href="/documents">
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors">
                    <FileText className="h-4 w-4" />
                    Generated Documents
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-8 mx-2" />
                <Link href="/projects">
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors">
                    <FolderKanban className="h-4 w-4" />
                    Projects
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-8 mx-2" />
                <Button 
                  variant="ghost" 
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Dashboard />
      </main>
    </div>
  );
}