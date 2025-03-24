import { useAuth } from "@/hooks/use-auth";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Loader2 } from "lucide-react";
import { FAB } from "@/components/ui/fab";
import { Header } from "@/components/header";

export default function HomePage() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Dashboard />
      </main>
      <FAB />
    </div>
  );
}