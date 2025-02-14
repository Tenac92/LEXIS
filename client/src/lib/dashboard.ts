import { z } from "zod";

export const statsSchema = z.object({
  userTrend: z.array(z.object({
    date: z.string(),
    count: z.number()
  })).optional(),
  completedDocs: z.number().optional(),
  pendingDocs: z.number().optional(),
  activeProjects: z.number().optional(),
  completedProjects: z.number().optional(),
  performanceTrend: z.array(z.object({
    date: z.string(),
    value: z.number()
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

export const getDashboardChartConfig = (stats: DashboardStats, isAdmin: boolean) => {
  const adminCharts = {
    users: {
      id: 'usersChart',
      type: 'line' as const,
      data: {
        labels: stats.userTrend?.map(d => d.date) || [],
        datasets: [{
          label: 'Active Users',
          data: stats.userTrend?.map(d => d.count) || [],
          borderColor: chartColors.blue,
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        ...baseConfig,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    },
    documents: {
      id: 'documentsChart',
      type: 'doughnut' as const,
      data: {
        labels: ['Completed', 'Pending'],
        datasets: [{
          data: [stats.completedDocs || 0, stats.pendingDocs || 0],
          backgroundColor: [chartColors.green, chartColors.yellow],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        ...baseConfig,
        cutout: '70%'
      }
    }
  };

  const userCharts = {
    documents: {
      id: 'documentsChart',
      type: 'doughnut' as const,
      data: {
        labels: ['Completed', 'Pending'],
        datasets: [{
          data: [stats.completedDocs || 0, stats.pendingDocs || 0],
          backgroundColor: [chartColors.green, chartColors.yellow],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        ...baseConfig,
        cutout: '70%'
      }
    }
  };

  return isAdmin ? adminCharts : userCharts;
};

export { chartColors, baseConfig };
