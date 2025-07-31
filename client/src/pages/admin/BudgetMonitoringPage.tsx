import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  PieChart,
  Calendar,
  Euro,
  AlertTriangle,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Clock,
  Building2,
  DollarSign,
  Percent,
  Filter
} from 'lucide-react';
import { formatDistanceToNow, parseISO, startOfMonth, endOfMonth, format } from 'date-fns';
import { el } from 'date-fns/locale';

// Types for budget monitoring data
interface BudgetTrendData {
  month: string;
  allocated: number;
  spent: number;
  remaining: number;
  projects_active: number;
}

interface ProjectPerformance {
  mis: string;
  name: string;
  allocated_budget: number;
  spent_budget: number;
  utilization_rate: number;
  completion_rate: number;
  variance: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface QuarterlyAnalysis {
  quarter: string;
  total_allocated: number;
  total_spent: number;
  efficiency_score: number;
  project_count: number;
  completion_rate: number;
}

// Mock data for demonstration - in production this would come from API
const generateMockTrendData = (): BudgetTrendData[] => {
  const months = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν'];
  return months.map((month, index) => ({
    month,
    allocated: 8000000 + (index * 500000) + Math.random() * 1000000,
    spent: 6000000 + (index * 400000) + Math.random() * 800000,
    remaining: 2000000 - (index * 100000) + Math.random() * 500000,
    projects_active: 45 + Math.floor(Math.random() * 15)
  }));
};

const generateMockProjectPerformance = (): ProjectPerformance[] => {
  return [
    {
      mis: '2024ΝΑ85300001',
      name: 'Ψηφιακός Μετασχηματισμός',
      allocated_budget: 2500000,
      spent_budget: 1800000,
      utilization_rate: 72,
      completion_rate: 65,
      variance: -300000,
      status: 'healthy',
      trend: 'up'
    },
    {
      mis: '2024ΝΑ85300015',
      name: 'Υπηρεσίες Πολιτών',
      allocated_budget: 1800000,
      spent_budget: 1950000,
      utilization_rate: 108,
      completion_rate: 85,
      variance: 150000,
      status: 'warning',
      trend: 'up'
    },
    {
      mis: '2024ΝΑ85300008',
      name: 'Ενεργειακή Αναβάθμιση',
      allocated_budget: 3200000,
      spent_budget: 2100000,
      utilization_rate: 66,
      completion_rate: 45,
      variance: -1100000,
      status: 'critical',
      trend: 'down'
    }
  ];
};

const generateQuarterlyAnalysis = (): QuarterlyAnalysis[] => {
  return [
    {
      quarter: 'Q1 2024',
      total_allocated: 12500000,
      total_spent: 9800000,
      efficiency_score: 84,
      project_count: 47,
      completion_rate: 73
    },
    {
      quarter: 'Q2 2024',
      total_allocated: 15200000,
      total_spent: 13100000,
      efficiency_score: 88,
      project_count: 52,
      completion_rate: 79
    },
    {
      quarter: 'Q3 2024',
      total_allocated: 18600000,
      total_spent: 16400000,
      efficiency_score: 91,
      project_count: 58,
      completion_rate: 82
    }
  ];
};

export default function BudgetMonitoringPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [selectedMetric, setSelectedMetric] = useState('utilization');

  // Fetch budget overview data
  const { data: budgetOverview, isLoading: budgetLoading } = useQuery({
    queryKey: ['/api/budget/overview'],
    staleTime: 2 * 60 * 1000,
  });

  // Fetch projects data for performance analysis
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects'],
    staleTime: 5 * 60 * 1000,
  });

  // Generate mock data for now - replace with real API calls
  const trendData = useMemo(() => generateMockTrendData(), [selectedPeriod]);
  const projectPerformance = useMemo(() => generateMockProjectPerformance(), []);
  const quarterlyData = useMemo(() => generateQuarterlyAnalysis(), []);

  // Calculate key metrics
  const totalAllocated = (budgetOverview as any)?.totalBudget || 47974285;
  const totalSpent = (budgetOverview as any)?.allocatedBudget || 28272462;
  const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
  const remainingBudget = totalAllocated - totalSpent;

  // Calculate trends
  const currentMonthData = trendData[trendData.length - 1];
  const previousMonthData = trendData[trendData.length - 2];
  const spendingTrend = currentMonthData && previousMonthData 
    ? ((currentMonthData.spent - previousMonthData.spent) / previousMonthData.spent) * 100 
    : 0;

  const isLoading = budgetLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Παρακολούθηση Τάσεων Προϋπολογισμού</h1>
              <p className="text-muted-foreground mt-1">
                Ανάλυση και παρακολούθηση οικονομικών τάσεων και απόδοσης έργων
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">3 Μήνες</SelectItem>
                  <SelectItem value="6months">6 Μήνες</SelectItem>
                  <SelectItem value="12months">12 Μήνες</SelectItem>
                  <SelectItem value="ytd">Από αρχή έτους</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Φίλτρα
              </Button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Συνολικός Προϋπολογισμός
                  </CardTitle>
                  <Euro className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{totalAllocated.toLocaleString('el-GR')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Σύνολο κατανεμημένου προϋπολογισμού
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Αξιοποίηση
                  </CardTitle>
                  <Percent className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {utilizationRate.toFixed(1)}%
                </div>
                <Progress value={utilizationRate} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  Ποσοστό χρησιμοποίησης προϋπολογισμού
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Τάση Δαπανών
                  </CardTitle>
                  {spendingTrend >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {spendingTrend >= 0 ? '+' : ''}{spendingTrend.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Μεταβολή σε σχέση με τον προηγούμενο μήνα
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Διαθέσιμο
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{remainingBudget.toLocaleString('el-GR')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Υπόλοιπο προϋπολογισμού
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <Tabs defaultValue="trends" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="trends">Τάσεις Χρόνου</TabsTrigger>
              <TabsTrigger value="projects">Απόδοση Έργων</TabsTrigger>
              <TabsTrigger value="quarterly">Τριμηνιαία Ανάλυση</TabsTrigger>
              <TabsTrigger value="forecasting">Προβλέψεις</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Χρονικές Τάσεις Προϋπολογισμού</CardTitle>
                    <Badge variant="outline">
                      <LineChart className="w-3 h-3 mr-1" />
                      Τελευταίοι 6 μήνες
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Γράφημα χρονικών τάσεων προϋπολογισμού</p>
                      <p className="text-sm">Δεδομένα: Κατανομές, Δαπάνες, Διαθέσιμο υπόλοιπο</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ρυθμός Δαπανών</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {trendData.slice(-3).map((month, index) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{month.month}</div>
                            <div className="text-sm text-muted-foreground">
                              €{month.spent.toLocaleString('el-GR')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {((month.spent / month.allocated) * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">αξιοποίηση</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ενεργά Έργα</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {trendData.slice(-3).map((month, index) => (
                      <div key={month.month} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">{month.month}</div>
                            <div className="text-sm text-muted-foreground">
                              {month.projects_active} έργα
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            €{(month.allocated / month.projects_active).toLocaleString('el-GR')}
                          </div>
                          <div className="text-xs text-muted-foreground">μέσος προϋπολογισμός</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="projects" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Απόδοση Έργων</CardTitle>
                    <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utilization">Αξιοποίηση</SelectItem>
                        <SelectItem value="completion">Ολοκλήρωση</SelectItem>
                        <SelectItem value="variance">Απόκλιση</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectPerformance.map((project) => (
                      <div key={project.mis} className="p-4 border rounded-lg hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              project.status === 'healthy' ? 'bg-green-500' :
                              project.status === 'warning' ? 'bg-orange-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <div className="font-medium">{project.name}</div>
                              <div className="text-sm text-muted-foreground">{project.mis}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {project.trend === 'up' ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : project.trend === 'down' ? (
                              <ArrowDownRight className="w-4 h-4 text-red-500" />
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                            <Badge variant={
                              project.status === 'healthy' ? 'default' :
                              project.status === 'warning' ? 'destructive' : 'destructive'
                            }>
                              {project.utilization_rate}% αξιοποίηση
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Κατανομή</div>
                            <div className="font-medium">
                              €{project.allocated_budget.toLocaleString('el-GR')}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Δαπάνη</div>
                            <div className="font-medium">
                              €{project.spent_budget.toLocaleString('el-GR')}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Ολοκλήρωση</div>
                            <div className="font-medium">{project.completion_rate}%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Απόκλιση</div>
                            <div className={`font-medium ${project.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {project.variance >= 0 ? '+' : ''}€{project.variance.toLocaleString('el-GR')}
                            </div>
                          </div>
                        </div>
                        
                        <Progress 
                          value={project.utilization_rate} 
                          className="mt-3"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quarterly" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {quarterlyData.map((quarter) => (
                  <Card key={quarter.quarter}>
                    <CardHeader>
                      <CardTitle className="text-base">{quarter.quarter}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary">
                          {quarter.efficiency_score}
                        </div>
                        <div className="text-sm text-muted-foreground">Βαθμός Αποδοτικότητας</div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Κατανομή</span>
                          <span className="text-sm font-medium">
                            €{quarter.total_allocated.toLocaleString('el-GR')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Δαπάνη</span>
                          <span className="text-sm font-medium">
                            €{quarter.total_spent.toLocaleString('el-GR')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Έργα</span>
                          <span className="text-sm font-medium">{quarter.project_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Ολοκλήρωση</span>
                          <span className="text-sm font-medium">{quarter.completion_rate}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="forecasting" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Προβλέψεις & Συστάσεις</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-medium text-foreground">Προβλέψεις Δαπανών</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <div>
                              <div className="text-sm font-medium">Αναμενόμενη δαπάνη Q4</div>
                              <div className="text-xs text-muted-foreground">€18.5M βάσει τρέχουσας τάσης</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            <div>
                              <div className="text-sm font-medium">Προειδοποίηση υπέρβασης</div>
                              <div className="text-xs text-muted-foreground">3 έργα ενδέχεται να υπερβούν τον προϋπολογισμό</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="font-medium text-foreground">Συστάσεις Βελτιστοποίησης</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                            <Target className="w-5 h-5 text-green-600" />
                            <div>
                              <div className="text-sm font-medium">Ανακατανομή πόρων</div>
                              <div className="text-xs text-muted-foreground">Μεταφορά €2.1M από χαμηλής απόδοσης έργα</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                            <Zap className="w-5 h-5 text-purple-600" />
                            <div>
                              <div className="text-sm font-medium">Επιτάχυνση εκτέλεσης</div>
                              <div className="text-xs text-muted-foreground">5 έργα μπορούν να επιταχυνθούν</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                      <div className="flex items-center gap-3 mb-3">
                        <Activity className="w-5 h-5 text-primary" />
                        <h4 className="font-medium">Συνολική Αξιολόγηση</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Βάσει της τρέχουσας ανάλυσης, η αξιοποίηση του προϋπολογισμού βρίσκεται σε υγιή επίπεδα με 
                        ποσοστό {utilizationRate.toFixed(1)}%. Συνιστάται προσοχή στα έργα με υψηλή απόκλιση και 
                        επανεξέταση της κατανομής για βελτιστοποίηση της απόδοσης.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}