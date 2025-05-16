import { z } from "zod";

export const statsSchema = z.object({
  totalDocuments: z.number(),
  pendingDocuments: z.number(),
  completedDocuments: z.number(),
  projectStats: z.object({
    active: z.number(),
    pending: z.number(),
    completed: z.number(),
    pending_reallocation: z.number()
  }),
  budgetTotals: z.record(z.string(), z.number()).optional(),
  recentActivity: z.array(z.object({
    id: z.number(),
    type: z.string(),
    description: z.string(),
    date: z.string(),
    createdBy: z.string().optional(),
    documentId: z.number().optional(),
    mis: z.string().optional(),
    previousAmount: z.number().optional(),
    newAmount: z.number().optional(),
    changeAmount: z.number().optional()
  })).optional()
});

export type DashboardStats = z.infer<typeof statsSchema>;

const chartColors = {
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#6b7280'
} as const;

const baseConfig = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        padding: 20,
        usePointStyle: true,
        font: {
          size: 13,
          family: "'Inter', sans-serif",
          weight: '500'
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      titleFont: {
        size: 14,
        weight: 'bold'
      },
      bodyFont: {
        size: 13
      }
    }
  }
} as const;

export const getDashboardChartConfig = (stats: DashboardStats) => {
  const chartData = Object.entries(stats.projectStats).map(([status, count]) => ({
    name: status.replace('_', ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    count,
    budget: stats.budgetTotals?.[status] || 0
  }));

  return {
    id: 'projectsChart',
    type: 'bar' as const,
    data: {
      labels: chartData.map(d => d.name),
      datasets: [
        {
          label: 'Projects Count',
          data: chartData.map(d => d.count),
          backgroundColor: [
            chartColors.blue,
            chartColors.yellow,
            chartColors.purple,
            chartColors.green
          ],
          yAxisID: 'count'
        },
        {
          label: 'Budget Amount',
          data: chartData.map(d => d.budget),
          backgroundColor: chartColors.gray,
          yAxisID: 'budget'
        }
      ]
    },
    options: {
      ...baseConfig,
      scales: {
        count: {
          type: 'linear' as const,
          position: 'left' as const,
          title: {
            display: true,
            text: 'Number of Projects'
          }
        },
        budget: {
          type: 'linear' as const,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Budget Amount (€)'
          }
        }
      }
    }
  };
};

export { chartColors, baseConfig };