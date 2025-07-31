import { useAuth } from "@/hooks/use-auth";
import { UserDashboard } from "@/components/dashboard/user-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { Loader2 } from "lucide-react";
import { FAB } from "@/components/ui/fab";
import { Header } from "@/components/header";

export default function HomePage() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Render appropriate dashboard based on user role
  const renderDashboard = () => {
    switch (user?.role?.toLowerCase()) {
      case 'admin':
        return <AdminDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'user':
      default:
        return <UserDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {renderDashboard()}
      </main>
      {/* FAB only for regular users who create documents */}
      {user?.role?.toLowerCase() === 'user' && <FAB />}
    </div>
  );
}