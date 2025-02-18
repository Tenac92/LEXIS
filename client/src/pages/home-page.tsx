import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Loader2, FileText, FolderKanban } from "lucide-react";
import { Link } from "wouter";

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
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Welcome, {user?.email}</h1>
              <p className="text-muted-foreground">Document Management System</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/documents">
                <Button variant="ghost" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Generated Documents
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="ghost" className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Projects
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                Logout
              </Button>
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