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
  BarChart3,
  Euro
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

import type { DashboardStats } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/services/dashboard";

const STATUS_COLORS = {
  active: '#22c55e',
  pending: '#f59e0b',
  pending_reallocation: '#8b5cf6',
  completed: '#3b82f6',
  pending_funding: '#f59e0b'
};

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false
  });

  // Format data for the chart - include budget information
  const chartData = stats ? Object.entries(stats.projectStats).map(([status, count]) => ({
    name: status.replace('_', ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    count: count,
    budget: stats.budgetTotals?.[status] || 0
  })) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
        <p>Failed to load dashboard data. Please try refreshing the page.</p>
        {error instanceof Error && (
          <p className="mt-2 text-sm">{error.message}</p>
        )}
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
              <p className="text-2xl font-bold mt-1">{stats.totalDocuments}</p>
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
              <p className="text-2xl font-bold mt-1">{stats.pendingDocuments}</p>
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
              <p className="text-2xl font-bold mt-1">{stats.completedDocuments}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Euro className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Budget</h3>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(Object.values(stats.budgetTotals || {}).reduce((a, b) => a + b, 0))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Project Status Distribution Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Project Status Distribution
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                barSize={60}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                  interval={0}
                />
                <YAxis yAxisId="left" orientation="left" stroke="#666" />
                <YAxis yAxisId="right" orientation="right" stroke="#666" />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'budget') return formatCurrency(value);
                    return value;
                  }}
                />
                <Bar 
                  yAxisId="left" 
                  dataKey="count" 
                  name="Projects"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={STATUS_COLORS[entry.name.toLowerCase().replace(' ', '_') as keyof typeof STATUS_COLORS] || '#666'} 
                    />
                  ))}
                </Bar>
                <Bar 
                  yAxisId="right" 
                  dataKey="budget" 
                  name="Budget" 
                  fill="#8884d8" 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      {stats.recentActivity && stats.recentActivity.length > 0 && (
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