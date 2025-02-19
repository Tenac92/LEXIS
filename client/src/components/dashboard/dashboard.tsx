import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Loader2, 
  FileText, 
  Users, 
  AlertCircle, 
  CheckCircle2,
  PlusCircle,
  Download,
  Upload,
  BarChart3
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// Define the stats type
type DashboardStats = {
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
  projectStats: {
    active: number;
    pending: number;
    completed: number;
    pending_reallocation: number;
  };
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    date: string;
  }>;
};

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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

  // Format data for the chart
  const chartData = stats?.projectStats ? [
    { name: 'Active', value: stats.projectStats.active },
    { name: 'Pending', value: stats.projectStats.pending },
    { name: 'Pending Reallocation', value: stats.projectStats.pending_reallocation },
    { name: 'Completed', value: stats.projectStats.completed },
  ] : [];

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
      {/* Header with quick actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/projects/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
            <Link href="/projects/bulk-update">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Bulk Update
              </Button>
            </Link>
            <Button variant="secondary">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </div>
        )}
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Documents</h3>
              <p className="text-2xl font-bold mt-1">{stats?.totalDocuments || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Pending Documents</h3>
              <p className="text-2xl font-bold mt-1">{stats?.pendingDocuments || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Completed Documents</h3>
              <p className="text-2xl font-bold mt-1">{stats?.completedDocuments || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Active Projects</h3>
              <p className="text-2xl font-bold mt-1">{stats?.projectStats?.active || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Project Status Distribution Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Project Status Distribution
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent Activity */}
      {stats?.recentActivity && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{activity.description}</p>
                  <p className="text-sm text-muted-foreground">{activity.type}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(activity.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default Dashboard;