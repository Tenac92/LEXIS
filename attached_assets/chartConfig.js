
const chartColors = {
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#6b7280'
};

const baseConfig = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
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
};

const adminCharts = {
  users: {
    id: 'usersChart',
    type: 'line',
    data: (stats) => ({
      labels: stats.userTrend?.map(d => d.date) || [],
      datasets: [{
        label: 'Active Users',
        data: stats.userTrend?.map(d => d.count) || [],
        borderColor: chartColors.blue,
        tension: 0.4,
        fill: false
      }]
    }),
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
    type: 'doughnut',
    data: (stats) => ({
      labels: ['Completed', 'Pending'],
      datasets: [{
        data: [stats.completedDocs || 0, stats.pendingDocs || 0],
        backgroundColor: [chartColors.green, chartColors.yellow],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    }),
    options: {
      ...baseConfig,
      cutout: '70%'
    }
  },
  projects: {
    id: 'projectsChart',
    type: 'bar',
    data: (stats) => ({
      labels: ['Active', 'Completed'],
      datasets: [{
        data: [stats.activeProjects || 0, stats.completedProjects || 0],
        backgroundColor: [chartColors.blue, chartColors.green],
        borderRadius: 4
      }]
    }),
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
  performance: {
    id: 'performanceChart',
    type: 'line',
    data: (stats) => ({
      labels: stats.performanceTrend?.map(d => d.date) || [],
      datasets: [{
        label: 'Performance Score',
        data: stats.performanceTrend?.map(d => d.value) || [],
        borderColor: chartColors.purple,
        tension: 0.4,
        fill: false,
        pointRadius: 4
      }]
    }),
    options: {
      ...baseConfig,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100
        }
      }
    }
  }
};

const userCharts = {
  documents: {
    id: 'documentsChart',
    type: 'doughnut',
    data: (stats) => ({
      labels: ['Ολοκληρωμένα', 'Εκκρεμή'],
      datasets: [{
        data: [stats.completedDocs || 0, stats.pendingDocs || 0],
        backgroundColor: [chartColors.green, chartColors.yellow],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    }),
    options: {
      ...baseConfig,
      cutout: '70%'
    }
  }
};

const getChartConfig = (userRole) => userRole === 'admin' ? adminCharts : userCharts;

export { getChartConfig, chartColors, baseConfig };
