
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import Header from './components/Header.js';
import LoadingSpinner from './components/LoadingSpinner.js';
import ErrorBoundary from './components/ErrorBoundary.js';

// Lazy load routes
const Dashboard = React.lazy(() => import('./components/Dashboard.js'));
const Login = React.lazy(() => import('./components/Login.js'));
const Profile = React.lazy(() => import('./components/Profile.js'));
const Settings = React.lazy(() => import('./components/Settings.js'));

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <div className="app">
        <Header />
        <main className="app-container">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/dashboard" 
                element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/profile" 
                element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/settings" 
                element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </ErrorBoundary>
  );
}
