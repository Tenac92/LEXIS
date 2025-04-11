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
        console.log('[Budget] Fetching budget data for project:', { id: projectId });
        
        // Find the project to get its MIS
        let projectData;
        try {
          // First, get all projects
          const allProjects = await queryClient.fetchQuery({
            queryKey: ["/api/projects"]
          });
          
          console.log('[Budget] Project data fetched:', allProjects);
          
          // Find the specific project that matches either the ID or na853
          if (Array.isArray(allProjects)) {
            projectData = allProjects.find(
              (p: any) => 
                String(p?.na853).toLowerCase() === String(projectId).toLowerCase() ||
                String(p?.mis) === String(projectId)
            );
            console.log('[Budget] Found matching project:', projectData);
          } else {
            projectData = allProjects;
          }
        } catch (projectError) {
          console.error(`[Budget] Error fetching project data for ID: ${projectId}`, projectError);
          
          // Store debug info about the error
          const errorInfo = {
            projectId: projectId,
            error: projectError instanceof Error ? projectError.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
          console.error('[Budget] Project fetch error info:', errorInfo);
          
          // Return empty budget data with error flag when we can't fetch project
          return {
            user_view: 0,
            total_budget: 0,
            annual_budget: 0,
            katanomes_etous: 0,
            ethsia_pistosi: 0,
            current_budget: 0,
            q1: 0, q2: 0, q3: 0, q4: 0,
            total_spent: 0,
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0,
            _error: 'Σφάλμα κατά τη λήψη δεδομένων έργου. Δοκιμάστε ξανά αργότερα.'
          };
        }
        
        // Type checking and field extraction
        const project = projectData as { mis?: string, na853?: string } | null | undefined;
        
        // Get the MIS from either the mis field or na853 field (for backward compatibility)
        const misValue = project?.mis || project?.na853;
        
        if (!project || !misValue) {
          console.error(`[Budget] Project or MIS not found for ID: ${projectId}`, project);
          // Return empty budget instead of throwing - allow UI to still function
          return {
            user_view: 0,
            total_budget: 0,
            annual_budget: 0,
            katanomes_etous: 0,
            ethsia_pistosi: 0,
            current_budget: 0,
            q1: 0, q2: 0, q3: 0, q4: 0,
            total_spent: 0,
            available_budget: 0,
            quarter_available: 0,
            yearly_available: 0,
            _error: 'Δεν βρέθηκε το MIS του έργου. Επιλέξτε έγκυρο έργο.'
          };
        }

        // Fetch budget data from API - no need to convert to numeric MIS anymore
        // The server-side has been updated to handle both numeric and alphanumeric MIS values
        
        console.log(`[Budget] Fetching budget data for MIS: ${misValue}`);
        
        // For MIS values with special characters or Greek letters, encode the URI component
        const encodedMisValue = encodeURIComponent(misValue);
        console.log(`[Budget] Encoded MIS value: ${encodedMisValue}`);
        
        // Use the correct endpoint path - this public endpoint doesn't require authentication
        const response = await fetch(`/api/budget/${encodedMisValue}`);
        
        // Check if the response is ok before trying to parse JSON
        if (!response.ok) {
          console.error(`[Budget] API error: ${response.status} ${response.statusText}`);
          // Try to get error details if possible
          try {
            const errorText = await response.text();
            console.error('[Budget] Error response:', errorText);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          } catch (textError) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }
        }
        
        // Check if the response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`[Budget] Received non-JSON response: ${contentType}`, response);
          try {
            const text = await response.text();
            console.error('[Budget] Non-JSON response body:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
            throw new Error(`Expected JSON response but received ${contentType || 'unknown content-type'}`);
          } catch (textError) {
            throw new Error(`Expected JSON response but received ${contentType || 'unknown content-type'}`);
          }
        }
        
        // Parse the response data
        let responseData;
        try {
          responseData = await response.json();
          console.log('[Budget] Raw budget response:', responseData);
        } catch (jsonError) {
          console.error('[Budget] Failed to parse JSON response:', jsonError);
          throw new Error('Invalid JSON response from server');
        }
      
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
        // Extract the error message or add a detailed one for debugging
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown error fetching budget data';
          
        console.error('[Budget] Budget data fetch error:', error);
        console.error('[Budget] Error message:', errorMessage);
        
        // Create a debug info object to help with troubleshooting
        const debugInfo = {
          projectId,
          error: errorMessage,
          timestamp: new Date().toISOString()
        };
        console.error('[Budget] Debug info:', debugInfo);
        
        // Instead of throwing, return empty but valid budget data with error flag
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
          yearly_available: 0,
          _error: errorMessage // Add an error flag that can be detected by UI
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
        // Get all projects first
        const allProjects = await queryClient.fetchQuery({
          queryKey: ["/api/projects"]
        });
        
        // Find the specific project that matches either the ID or na853
        let projectData;
        if (Array.isArray(allProjects)) {
          projectData = allProjects.find(
            (p: any) => 
              String(p?.na853).toLowerCase() === String(projectId).toLowerCase() ||
              String(p?.mis) === String(projectId)
          );
          console.log('[Budget] Found matching project for validation:', projectData);
        } else {
          projectData = allProjects;
        }
        
        // Type checking and field extraction
        const project = projectData as { mis?: string, na853?: string } | null | undefined;
        
        // Get the MIS from either the mis field or na853 field (for backward compatibility)
        const misValue = project?.mis || project?.na853;
        
        if (!project || !misValue) {
          console.error('[Budget] Project or MIS not found', { projectId });
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Δεν βρέθηκε το MIS του έργου. Επιλέξτε έγκυρο έργο.'
          };
        }

        // Use the MIS directly for validation (can be numeric or alphanumeric)
        
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
          // Try to get error details if possible
          try {
            const errorText = await response.text();
            console.error('[Budget] Validation error response:', errorText);
          } catch (textError) {
            // Ignore text error, we already have the status code
          }
          
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Σφάλμα επικοινωνίας κατά τον έλεγχο προϋπολογισμού. Δοκιμάστε ξανά.'
          };
        }
        
        // Check if the response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`[Budget] Validation received non-JSON response: ${contentType}`);
          try {
            const text = await response.text();
            console.error('[Budget] Validation non-JSON response body:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
          } catch (textError) {
            // Ignore text error, we already identified the content type issue
          }
          
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: `Μη αναμενόμενη απόκριση από τον διακομιστή (${contentType || 'άγνωστος τύπος περιεχομένου'})`
          };
        }
        
        // Process successful response
        let data;
        try {
          data = await response.json();
          console.log('[Budget] Validation response:', data);
        } catch (jsonError) {
          console.error('[Budget] Failed to parse validation JSON response:', jsonError);
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Μη έγκυρη απόκριση του διακομιστή. Δοκιμάστε ξανά αργότερα.'
          };
        }
        
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
        // Extract the error message or add a detailed one for debugging
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown error validating budget';
          
        console.error('[Budget] Budget validation error:', error);
        console.error('[Budget] Validation error message:', errorMessage);
        
        // Create a debug info object to help with troubleshooting
        const debugInfo = {
          projectId,
          mis: projectId,
          amount: currentAmount,
          error: errorMessage,
          timestamp: new Date().toISOString()
        };
        console.error('[Budget] Validation debug info:', debugInfo);
        
        return {
          status: 'error',
          canCreate: false,
          allowDocx: false,
          message: 'Αποτυχία επικύρωσης προϋπολογισμού. Δοκιμάστε ξανά αργότερα.',
          metadata: {
            error: errorMessage,
            debugInfo: debugInfo
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