import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketUpdates } from './use-websocket-updates';
import type { BudgetData, BudgetValidationResponse, BudgetHookResult } from '@/lib/types';

/**
 * Custom hook for real-time budget data management
 * Combines React Query for data fetching with WebSocket for real-time updates
 */
export function useBudgetUpdates(
  projectId: string | null | undefined,
  currentAmount: number
) {
  // State values that will be returned by the hook, initialized here
  // and updated later with actual values from queries
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocketUpdates();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

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
        console.log(`[Budget] Fetching budget for project: ${projectId}`);
        
        const budgetResponse = await fetch(`/api/budget/data/${projectId}`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (!budgetResponse.ok) {
          console.warn(`[Budget] API request failed for project ${projectId} - status: ${budgetResponse.status}`);
          throw new Error(`Budget API returned ${budgetResponse.status}`);
        }
        
        const responseData = await budgetResponse.json();
        
        // Simplified response handling - expect consistent structure from backend
        const budgetData = responseData?.status === 'success' && responseData.data 
          ? responseData.data 
          : responseData;
      
        // Final budget data extracted and ready to use
        
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
        console.error('[Budget] Failed to fetch budget data:', error);
        // Return empty budget structure for graceful degradation
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
    // Reduced stale time for real-time feel on amount changes
    staleTime: 2000, // 2 seconds - balance between real-time and network load
    // Disable automatic refetching on window focus to prevent flickering during typing
    refetchOnWindowFocus: false,
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
        // Simplified project lookup - use projectId directly as MIS
        // The backend will handle the lookup logic
        const misValue = projectId;

        // Use the MIS directly for validation
        
        const response = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mis: misValue,
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
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Σφάλμα επικοινωνίας κατά τον έλεγχο προϋπολογισμού. Δοκιμάστε ξανά.'
          };
        }
        
        const data = await response.json();
        
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
        console.error('[Budget] Budget validation failed:', error);
        return {
          status: 'error',
          canCreate: false,
          allowDocx: false,
          message: 'Αποτυχία επικύρωσης προϋπολογισμού. Δοκιμάστε ξανά αργότερα.'
        };
      }
    },
    enabled: Boolean(projectId) && currentAmount > 0
  });

  // Effect to broadcast amount changes in real-time with debouncing
  useEffect(() => {
    // Skip if we don't have a valid project or amount
    if (!projectId || currentAmount <= 0 || !sessionId || !isConnected) {
      return;
    }

    // Clear any existing timeout to implement debouncing
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set a new timeout to delay the update broadcast (debouncing)
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch('/api/budget/broadcast-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mis: projectId,
            amount: currentAmount,
            sessionId
          })
        });
        
        if (!response.ok) {
          console.warn('[Budget] Failed to broadcast real-time update');
        }
      } catch (error) {
        console.warn('[Budget] Error broadcasting update:', error);
      }
    }, 300); // 300ms debounce delay - quick enough for real-time feel, but not too chatty
    
    setTypingTimeout(timeout);
    
    // Clean up timeout on unmount or when dependencies change
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [projectId, currentAmount, sessionId, isConnected, typingTimeout, queryClient]);

  // Prepare hook return values with current state

  // Function to manually broadcast an update immediately 
  const broadcastUpdate = async (amount: number) => {
    if (!projectId || (amount < 0) || !sessionId) {
      // Cannot broadcast update - missing required parameters
      return;
    }

    try {
      // Calculate simple budget preview (subtract requested amount)
      let simpleBudgetData = null;
      if (budgetQuery.data) {
        const availableBudget = Number(budgetQuery.data.available_budget || 0);
        const yearlyAvailable = Number(budgetQuery.data.yearly_available || 0);
        const quarterAvailable = Number(budgetQuery.data.quarter_available || 0);
        
        simpleBudgetData = {
          available_budget: Math.round(availableBudget - amount),
          yearly_available: Math.round(yearlyAvailable - amount),
          quarter_available: Math.round(quarterAvailable - amount)
        };
      }
      
      const response = await fetch('/api/budget/broadcast-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mis: projectId,
          amount,
          sessionId: null, // Broadcast to all clients
          simpleBudgetData
        })
      });
      
      if (!response.ok) {
        console.warn('[Budget] Failed to broadcast manual update');
      }
    } catch (error) {
      console.warn('[Budget] Error broadcasting manual update:', error);
    }
  };

  return {
    budgetData: budgetQuery.data,
    validationResult: validationQuery.data,
    isBudgetLoading: budgetQuery.isLoading,
    isValidationLoading: validationQuery.isLoading,
    budgetError: budgetQuery.error,
    validationError: validationQuery.error,
    websocketConnected: isConnected,
    broadcastUpdate // Export the method for manual broadcasting
  };
}