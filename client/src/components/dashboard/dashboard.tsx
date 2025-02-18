import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Define the stats type
type DashboardStats = {
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
};

export function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        Failed to load dashboard data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Documents</h3>
          <p className="text-2xl font-bold mt-2">{stats?.totalDocuments || 0}</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Pending Documents</h3>
          <p className="text-2xl font-bold mt-2">{stats?.pendingDocuments || 0}</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Completed Documents</h3>
          <p className="text-2xl font-bold mt-2">{stats?.completedDocuments || 0}</p>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;