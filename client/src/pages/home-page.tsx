import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Loader2, FileText, FolderKanban, LogOut } from "lucide-react";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import { FAB } from "@/components/ui/fab";

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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome, {user?.username || user?.name || 'User'}
              </h1>
              <p className="text-muted-foreground">Document Management System</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-background rounded-lg p-1 shadow-sm">
                <Link href="/documents">
                  <Button variant="ghost" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Generated Documents
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-8 mx-2" />
                <Link href="/projects">
                  <Button variant="ghost" className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    Projects
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-8 mx-2" />
                <Button 
                  variant="ghost" 
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="flex items-center gap-2"
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

      <FAB />
    </div>
  );
}