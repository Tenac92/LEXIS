import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketUpdates } from './use-websocket-updates';
import type { BudgetData, BudgetValidationResponse } from '@/lib/types';

/**
 * Custom hook for real-time budget data management
 * Combines React Query for data fetching with WebSocket for real-time updates
 */
export function useBudgetUpdates(
  projectId: string | null | undefined,
  currentAmount: number
) {
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocketUpdates();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Ensure we have a session ID for WebSocket message filtering
  useEffect(() => {
    const storedSessionId = sessionStorage.getItem('clientSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem('clientSessionId', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  // Fetch basic budget data
  const budgetQuery = useQuery<BudgetData>({
    queryKey: ["budget", projectId],
    queryFn: async () => {
      if (!projectId) {
        // Return empty but valid budget data structure
        return {
          user_view: 0,
          total_budget: 0,
          annual_budget: 0,
          katanomes_etous: 0,
          ethsia_pistosi: 0,
          current_budget: 0,
          q1: 0,
          q2: 0,
          q3: 0,
          q4: 0,
          total_spent: 0,
          available_budget: 0,
          quarter_available: 0,
          yearly_available: 0
        };
      }

      try {
        console.log('[Budget] Fetching budget data for project:', { id: projectId });
        
        // Find the project to get its MIS
        const projectData = await queryClient.fetchQuery({
          queryKey: ["project", projectId]
        });
        
        // Type checking
        const project = projectData as { mis?: string } | null | undefined;
        
        if (!project || !project.mis) {
          console.error(`[Budget] Project or MIS not found for ID: ${projectId}`, project);
          // Return empty budget instead of throwing - allow UI to still function
          return {
            user_view: 0,
            total_budget: 0,
            annual_budget: 0,
            katanomes_etous: 0,
            ethsia_pistosi: 0,
            current_budget: 0,
            q1: 0,
            q2: 0,
            q3: 0,
            q4: 0,
            total_spent: 0,
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0
          };
        }

        // Fetch budget data from API - no need to convert to numeric MIS anymore
        // The server-side has been updated to handle both numeric and alphanumeric MIS values
        const misValue = project.mis;
        
        console.log(`[Budget] Fetching budget data for MIS: ${misValue}`);
        
        // For MIS values with special characters or Greek letters, encode the URI component
        const encodedMisValue = encodeURIComponent(misValue);
        console.log(`[Budget] Encoded MIS value: ${encodedMisValue}`);
        
        // Use the correct endpoint path - this public endpoint doesn't require authentication
        const response = await fetch(`/api/budget/${encodedMisValue}`);
        
        // Parse the response data, even if not 200 OK (we'll handle error status below)
        const responseData = await response.json();
        console.log('[Budget] Raw budget response:', responseData);
        
        // Extract data based on response structure
        let budgetData: Record<string, any> = {}; 
        
        if (responseData?.status === 'success' && responseData.data) {
          budgetData = responseData.data;
          console.log('[Budget] Successfully extracted budget data from success response', budgetData);
        } else if (responseData?.status === 'error') {
          console.error('[Budget] Budget API returned error:', responseData.message || 'Unknown error');
          // Check if the error response includes fallback data (server might return zeros to prevent UI breaking)
          if (responseData.data && typeof responseData.data === 'object') {
            console.log('[Budget] Using fallback data from error response', responseData.data);
            budgetData = responseData.data;
          } else {
            // Return empty budget on API error - allow UI to still function
            console.log('[Budget] No fallback data in error response, using zeros');
            return {
              user_view: 0,
              total_budget: 0,
              annual_budget: 0,
              katanomes_etous: 0,
              ethsia_pistosi: 0,
              current_budget: 0,
              q1: 0,
              q2: 0,
              q3: 0,
              q4: 0,
              total_spent: 0,
              available_budget: 0,
              quarter_available: 0,
              yearly_available: 0
            };
          }
        } else {
          // Direct response data (not wrapped in status/data structure)
          console.log('[Budget] Direct response data:', responseData);
          budgetData = responseData;
        }
        
        console.log('[Budget] Extracted budget data:', budgetData);
        
        // Return normalized budget data with original string/number values
        return {
          user_view: budgetData.user_view || 0,
          total_budget: budgetData.total_budget || 0,
          katanomes_etous: budgetData.katanomes_etous || 0,
          ethsia_pistosi: budgetData.ethsia_pistosi || 0,
          current_budget: budgetData.current_budget || 0,
          annual_budget: budgetData.annual_budget || 0,
          quarter_view: budgetData.quarter_view || 0,
          current_quarter: budgetData.current_quarter?.toString() || 'q1',
          last_quarter_check: budgetData.last_quarter_check?.toString() || 'q1',
          q1: budgetData.q1 || 0,
          q2: budgetData.q2 || 0,
          q3: budgetData.q3 || 0,
          q4: budgetData.q4 || 0,
          total_spent: budgetData.total_spent || 0,
          available_budget: budgetData.available_budget || 0,
          quarter_available: budgetData.quarter_available || 0,
          yearly_available: budgetData.yearly_available || 0,
          // Include the sum field if available
          sum: budgetData.sum || undefined
        };
      } catch (error) {
        console.error('[Budget] Budget data fetch error:', error);
        // Instead of throwing, return empty but valid budget data
        return {
          user_view: 0,
          total_budget: 0,
          annual_budget: 0,
          katanomes_etous: 0,
          ethsia_pistosi: 0,
          current_budget: 0,
          q1: 0,
          q2: 0,
          q3: 0,
          q4: 0,
          total_spent: 0,
          available_budget: 0,
          quarter_available: 0,
          yearly_available: 0
        };
      }
    },
    enabled: Boolean(projectId)
  });

  // Fetch validation data - this will also trigger real-time updates via WebSocket
  const validationQuery = useQuery<BudgetValidationResponse>({
    queryKey: ["budget-validation", projectId, currentAmount],
    queryFn: async () => {
      if (!projectId || currentAmount <= 0) {
        return { 
          status: 'warning',
          canCreate: false,
          allowDocx: true,
          message: 'Συμπληρώστε έργο και δικαιούχους για έλεγχο προϋπολογισμού'
        };
      }

      try {
        // Get the project MIS from the selected project
        const projectData = await queryClient.fetchQuery({
          queryKey: ["project", projectId]
        });
        
        // Type checking
        const project = projectData as { mis?: string } | null | undefined;
        
        if (!project || !project.mis) {
          console.error('[Budget] Project or MIS not found', { projectId });
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Δεν βρέθηκε το MIS του έργου. Επιλέξτε έγκυρο έργο.'
          };
        }

        // Use the MIS directly for validation (can be numeric or alphanumeric)
        const misValue = project.mis;
        
        console.log(`[Budget] Validating budget for MIS: ${misValue}, amount: ${currentAmount}`);
        
        // For MIS values with special characters or Greek letters, encode for transport in JSON
        // Note: JSON.stringify handles this for us, but we should be consistent with our debug logs
        console.log(`[Budget] Encoded MIS for validation: ${encodeURIComponent(misValue)}`);
        
        // Using fetch directly instead of apiRequest to avoid auto-redirect on 401
        const response = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          },
          credentials: 'include',
          body: JSON.stringify({
            mis: misValue, // Send the MIS as-is (can be numeric or alphanumeric)
            amount: currentAmount,
            sessionId: sessionId
          })
        });
        
        if (response.status === 401) {
          console.warn('[Budget] Authentication required for budget validation');
          // Return authentication error response
          return { 
            status: 'warning', 
            canCreate: false,
            allowDocx: false,
            message: 'Απαιτείται σύνδεση για έλεγχο προϋπολογισμού. Παρακαλώ συνδεθείτε ξανά.'
          };
        }
        
        if (!response.ok) {
          console.error('[Budget] Validation request failed:', response.status);
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Σφάλμα επικοινωνίας κατά τον έλεγχο προϋπολογισμού. Δοκιμάστε ξανά.'
          };
        }
        
        // Process successful response
        const data = await response.json();
        console.log('[Budget] Validation response:', data);
        
        // If we have budget indicators in the validation response metadata,
        // update the budget data with these values to ensure real-time updates
        if (data.metadata?.budget_indicators) {
          // Get the current budget data
          const currentBudgetData = budgetQuery.data;
          
          if (currentBudgetData) {
            // Create updated budget data with new indicator values
            const updatedBudgetData = {
              ...currentBudgetData,
              available_budget: data.metadata.budget_indicators.available_budget?.toString() || currentBudgetData.available_budget,
              quarter_available: data.metadata.budget_indicators.quarter_available?.toString() || currentBudgetData.quarter_available,
              yearly_available: data.metadata.budget_indicators.yearly_available?.toString() || currentBudgetData.yearly_available
            };
            
            // Manually update the query cache with the new budget data
            queryClient.setQueryData(["budget", projectId], updatedBudgetData);
          }
        }
        
        return data;
      } catch (error) {
        console.error('[Budget] Budget validation error:', error);
        return {
          status: 'error',
          canCreate: false,
          allowDocx: false,
          message: 'Αποτυχία επικύρωσης προϋπολογισμού. Δοκιμάστε ξανά αργότερα.',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        };
      }
    },
    enabled: Boolean(projectId) && currentAmount > 0
  });

  // Enhanced debug logging for the hook's return values
  console.log('[Budget Hook Debug] Returning state:', {
    hasBudgetData: !!budgetQuery.data,
    hasValidationResult: !!validationQuery.data,
    isBudgetLoading: budgetQuery.isLoading,
    isValidationLoading: validationQuery.isLoading,
    hasBudgetError: !!budgetQuery.error,
    hasValidationError: !!validationQuery.error,
    isWebsocketConnected: isConnected,
    projectId,
    // Include first few budget values if available (for debugging)
    budgetDataSample: budgetQuery.data ? {
      user_view: budgetQuery.data.user_view,
      katanomes_etous: budgetQuery.data.katanomes_etous,
      available_budget: budgetQuery.data.available_budget
    } : 'No budget data'
  });

  return {
    budgetData: budgetQuery.data,
    validationResult: validationQuery.data,
    isBudgetLoading: budgetQuery.isLoading,
    isValidationLoading: validationQuery.isLoading,
    budgetError: budgetQuery.error,
    validationError: validationQuery.error,
    websocketConnected: isConnected
  };
}