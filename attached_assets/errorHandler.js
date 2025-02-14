import React, { createContext, useContext, useState, useCallback } from 'react';

const ErrorContext = createContext(null);

export const ErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg">
          {error}
        </div>
      )}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export class ErrorHandler {
  static showError(error, context = '') {
    const errorMessage = error?.message || error;
    console.error(`Error${context ? ` in ${context}` : ''}: `, errorMessage);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-error', {
        detail: {
          message: errorMessage,
          context,
          timestamp: new Date().toISOString(),
          severity: error?.severity || 'error',
          code: error?.code || 'UNKNOWN_ERROR'
        }
      }));
    }
  }

  static handleApiError(error, fallbackMessage = 'An error occurred') {
    const message = error?.response?.data?.message || error?.message || fallbackMessage;
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      return { error: 'Session expired. Please login again.' };
    }

    if (status === 403) {
      return { error: 'You do not have permission to perform this action.' };
    }

    this.showError(message, 'API');
    return {
      error: message,
      status,
      code: error?.code,
      details: error?.details
    };
  }
}


export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export const handleError = (error) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Handle unauthorized
      window.location.href = '/login';
      return;
    }
    return {
      message: error.message,
      status: error.status
    };
  }

  // Handle generic errors
  return {
    message: 'An unexpected error occurred',
    status: 500
  };
};

export const ErrorBoundary = ({ children }) => {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (error) {
      // Log error to service
      console.error('Error boundary caught error:', error);
    }
  }, [error]);

  if (error) {
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return children;
};