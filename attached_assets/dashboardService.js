import { API_ENDPOINTS } from '../../utils/constants.js';

class DashboardService {
  async fetchDashboardData() {
    try {
      const response = await fetch(API_ENDPOINTS.DASHBOARD_STATS, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      return await response.json();
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      throw error;
    }
  }

  async refreshStats() {
    try {
      const response = await fetch(API_ENDPOINTS.REFRESH_STATS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Stats refresh error:', error);
      throw error;
    }
  }
  async fetchPendingDocuments(units) {
    if (!Array.isArray(units) || !units.length) {
      throw new Error('Invalid units parameter');
    }

    const response = await fetch(
      `${API_ENDPOINTS.DASHBOARD_BASE}/documents/pending?units=${encodeURIComponent(units.join(','))}`
    );
    return response.json();
  }

  formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '€0,00';
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatDate(dateString) {
    if (!dateString) return 'Μη διαθέσιμο';
    return new Date(dateString).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
}

export default new DashboardService();