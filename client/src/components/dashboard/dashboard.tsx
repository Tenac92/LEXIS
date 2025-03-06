import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Loader2,
  FileText,
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
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import type { DashboardStats } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/services/dashboard";

// Define chart colors
const CHART_COLORS = {
  active: '#22c55e',      // Green
  pending: '#f59e0b',     // Amber
  pending_reallocation: '#8b5cf6', // Purple
  completed: '#3b82f6'    // Blue
};

// Status translation mapping
const STATUS_TRANSLATIONS: Record<string, string> = {
  active: 'Ενεργό',
  pending: 'Σε Εκκρεμότητα',
  pending_reallocation: 'Σε Αναμονή Ανακατανομής',
  completed: 'Ολοκληρωμένο'
};

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: 2,
    refetchOnWindowFocus: false
  });

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
        <h3 className="text-lg font-semibold mb-2">Σφάλμα Φόρτωσης</h3>
        <p>Αποτυχία φόρτωσης δεδομένων. Παρακαλώ ανανεώστε τη σελίδα.</p>
        {error instanceof Error && (
          <p className="mt-2 text-sm">{error.message}</p>
        )}
      </div>
    );
  }

  // Prepare chart data with Greek translations
  const chartData = Object.entries(stats.projectStats).map(([status, count]) => ({
    name: STATUS_TRANSLATIONS[status] || status,
    count,
    budget: stats.budgetTotals?.[status] || 0
  }));

  return (
    <div className="space-y-6">
      {/* Header with quick actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Επισκόπηση Πίνακα Ελέγχου</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/projects/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Νέο Έργο
              </Button>
            </Link>
            <Link href="/projects/bulk-update">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Μαζική Ενημέρωση
              </Button>
            </Link>
            <Button variant="secondary">
              <Download className="mr-2 h-4 w-4" />
              Εξαγωγή Δεδομένων
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
              <h3 className="text-sm font-medium text-muted-foreground">Σύνολο Εγγράφων</h3>
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
              <h3 className="text-sm font-medium text-muted-foreground">Εκκρεμή Έγγραφα</h3>
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
              <h3 className="text-sm font-medium text-muted-foreground">Ολοκληρωμένα Έγγραφα</h3>
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
              <h3 className="text-sm font-medium text-muted-foreground">Συνολικός Προϋπολογισμός</h3>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(Object.values(stats.budgetTotals || {}).reduce((a, b) => a + b, 0))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Project Status and Budget Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Κατανομή Κατάστασης Έργων</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => 
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={true}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={CHART_COLORS[entry.name.toLowerCase().replace(' ', '_') as keyof typeof CHART_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} Έργα`, ``]}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Budget Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Κατανομή Προϋπολογισμού</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), "Προϋπολογισμός"]}
                />
                <Bar
                  dataKey="budget"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={CHART_COLORS[entry.name.toLowerCase().replace(' ', '_') as keyof typeof CHART_COLORS]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      {stats.recentActivity && stats.recentActivity.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Πρόσφατη Δραστηριότητα</h3>
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{activity.description}</p>
                  <p className="text-sm text-muted-foreground">{activity.type}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(activity.date).toLocaleDateString('el-GR')}
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