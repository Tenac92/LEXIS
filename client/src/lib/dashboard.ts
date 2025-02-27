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
  recentActivity: z.array(z.object({
    id: z.number(),
    type: z.string(),
    description: z.string(),
    date: z.string()
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
    projects: {
      id: 'projectsChart',
      type: 'doughnut' as const,
      data: {
        labels: ['Active', 'Pending', 'Completed', 'Pending Reallocation'],
        datasets: [{
          data: [stats.projectStats.active, stats.projectStats.pending, stats.projectStats.completed, stats.projectStats.pending_reallocation],
          backgroundColor: [chartColors.blue, chartColors.yellow, chartColors.green, chartColors.purple],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        ...baseConfig,
        cutout: '70%'
      }
    },
    documents: {
      id: 'documentsChart',
      type: 'doughnut' as const,
      data: {
        labels: ['Completed', 'Pending'],
        datasets: [{
          data: [stats.completedDocuments, stats.pendingDocuments],
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
          data: [stats.completedDocuments, stats.pendingDocuments],
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