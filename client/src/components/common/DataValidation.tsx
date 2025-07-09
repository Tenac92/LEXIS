/**
 * Data Validation Component
 * Provides validation states and error handling for data components
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Database, Wifi } from 'lucide-react';

interface DataValidationProps {
  isLoading: boolean;
  error: Error | null;
  data: any;
  onRetry?: () => void;
  emptyMessage?: string;
  loadingMessage?: string;
  children: React.ReactNode;
}

const DataValidation: React.FC<DataValidationProps> = ({
  isLoading,
  error,
  data,
  onRetry,
  emptyMessage = "Δεν βρέθηκαν δεδομένα",
  loadingMessage = "Φόρτωση...",
  children
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Database className="h-4 w-4 animate-pulse" />
          <span>{loadingMessage}</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <div>
            Σφάλμα φόρτωσης δεδομένων: {error.message}
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="mt-2"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Δοκιμάστε ξανά
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Empty data state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          {emptyMessage}
        </AlertDescription>
      </Alert>
    );
  }

  // Success state - render children
  return <>{children}</>;
};

interface NetworkStatusProps {
  isConnected: boolean;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ isConnected }) => {
  if (isConnected) {
    return null;
  }

  return (
    <Alert variant="destructive" className="fixed top-4 right-4 w-auto z-50">
      <Wifi className="h-4 w-4" />
      <AlertDescription>
        Η σύνδεση με τον διακομιστή διακόπηκε
      </AlertDescription>
    </Alert>
  );
};

interface DatabaseHealthProps {
  isHealthy: boolean;
  lastChecked?: Date;
  onReconnect?: () => void;
}

export const DatabaseHealth: React.FC<DatabaseHealthProps> = ({ 
  isHealthy, 
  lastChecked, 
  onReconnect 
}) => {
  if (isHealthy) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <Database className="h-4 w-4" />
      <AlertDescription className="space-y-2">
        <div>
          Η βάση δεδομένων δεν είναι διαθέσιμη
        </div>
        {lastChecked && (
          <div className="text-sm text-gray-600">
            Τελευταίος έλεγχος: {lastChecked.toLocaleTimeString('el-GR')}
          </div>
        )}
        {onReconnect && (
          <Button
            onClick={onReconnect}
            size="sm"
            variant="outline"
            className="mt-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Δοκιμάστε ξανά
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default DataValidation;