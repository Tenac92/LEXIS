
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import dashboardService from '../dashboard/services/dashboardService.js';
import { useAuth } from '../contexts/AuthContext.js';
import DataCard from './DataCard.js';
import LoadingSpinner from './LoadingSpinner.js';
import ErrorHandler from './ErrorHandler.js';
import '../assets/styles/dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.fetchDashboardData();
      
      if (!data || !Object.keys(data).length) {
        throw new Error('No dashboard data available');
      }
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchStats();
    
    // Optional: Set up refresh interval
    const refreshInterval = setInterval(fetchStats, 300000); // 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, [fetchStats]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorHandler error={error} />;
  }

  return (
    <div className="dashboard-container">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="stats-grid">
        {stats && Object.entries(stats).map(([key, value]) => (
          <DataCard 
            key={key} 
            title={key} 
            value={value}
            onRefresh={fetchStats}
          />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
