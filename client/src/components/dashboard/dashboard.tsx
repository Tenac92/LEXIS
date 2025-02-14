import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getDashboardStats, refreshDashboardStats } from "@/lib/services/dashboard";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getDashboardChartConfig } from "@/lib/dashboard";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, PieChart, Pie, ResponsiveContainer, Cell } from "recharts";

export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: getDashboardStats
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        Failed to load dashboard data
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const chartConfig = getDashboardChartConfig(stats, user?.role === "admin");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {user?.role === "admin" && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">User Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartConfig.users?.data.datasets[0].data || []}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={chartConfig.users?.data.datasets[0].borderColor} 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Documents Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: stats.completedDocs || 0 },
                    { name: 'Pending', value: stats.pendingDocs || 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;