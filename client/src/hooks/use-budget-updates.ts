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
        // Fetching budget data for project
        
        // Find the project to get its MIS
        let projectData;
        try {
          // First, get all projects
          const allProjects = await queryClient.fetchQuery({
            queryKey: ["/api/projects"]
          });
          
          // Project data fetched successfully
          
          // Find the specific project that matches either the ID or na853
          if (Array.isArray(allProjects)) {
            projectData = allProjects.find(
              (p: any) => 
                String(p?.na853).toLowerCase() === String(projectId).toLowerCase() ||
                String(p?.mis) === String(projectId)
            );
            // Found matching project for budget data
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
        
        // Fetching budget data for project's MIS
        
        // For MIS values with special characters or Greek letters, encode the URI component
        const encodedMisValue = encodeURIComponent(misValue);
        
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
          // Received raw budget response from API
        } catch (jsonError) {
          console.error('[Budget] Failed to parse JSON response:', jsonError);
          throw new Error('Invalid JSON response from server');
        }
      
        // Extract data based on response structure
        let budgetData: Record<string, any> = {}; 
        
        if (responseData?.status === 'success' && responseData.data) {
          budgetData = responseData.data;
          // Successfully extracted budget data from response
        } else if (responseData?.status === 'error') {
          console.error('[Budget] Budget API returned error:', responseData.message || 'Unknown error');
          // Check if the error response includes fallback data (server might return zeros to prevent UI breaking)
          if (responseData.data && typeof responseData.data === 'object') {
            // Using fallback data provided in error response
            budgetData = responseData.data;
          } else {
            // Return empty budget on API error - allow UI to still function
            // No fallback data available, using zeros for budget values
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
          // Processing direct API response data
          budgetData = responseData;
        }
      
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
          // Found matching project for budget validation
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
        
        // Validating budget for project MIS and requested amount
        
        // For MIS values with special characters or Greek letters, encode for transport in JSON
        // Note: JSON.stringify handles this for us, but we encode it for consistency
        
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
          // Validation request failed with HTTP status code
          // Try to get error details if possible
          try {
            const errorText = await response.text();
            // Error details received from server
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
          // Received non-JSON content type in response
          try {
            const text = await response.text();
            // Non-JSON response received, response might be HTML or plain text error
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
          // Successfully parsed validation response data
        } catch (jsonError) {
          // Failed to parse JSON response from validation endpoint
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
          
        // Runtime error occurred during budget validation process
        // Captured detailed error message for troubleshooting
        
        // Create a debug info object to help with troubleshooting
        const debugInfo = {
          projectId,
          mis: projectId,
          amount: currentAmount,
          error: errorMessage,
          timestamp: new Date().toISOString()
        };
        // Created debug info object with validation context details
        
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
        // Get the MIS from projects data
        const allProjects = await queryClient.getQueryData(["/api/projects"]);
        
        let misValue = projectId;
        
        // Try to find the actual MIS if we have project data
        if (Array.isArray(allProjects)) {
          const projectData = allProjects.find(
            (p: any) => 
              String(p?.na853).toLowerCase() === String(projectId).toLowerCase() ||
              String(p?.mis) === String(projectId)
          );
          
          if (projectData) {
            misValue = projectData.mis || projectData.na853 || projectId;
          }
        }
        
        // Broadcasting real-time budget update via WebSocket
        
        // Use the broadcast endpoint for real-time updates
        const response = await fetch('/api/budget/broadcast-update', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Include credentials for authentication
          body: JSON.stringify({
            mis: misValue,
            amount: currentAmount,
            sessionId
          })
        });
        
        if (!response.ok) {
          // Failed to broadcast real-time budget update
        } else {
          // Real-time budget update broadcast successful
        }
      } catch (error) {
        // Error occurred during WebSocket budget update broadcast
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
      // Get the MIS from projects data
      const allProjects = await queryClient.getQueryData(["/api/projects"]);
      
      let misValue = projectId;
      
      // Try to find the actual MIS if we have project data
      if (Array.isArray(allProjects)) {
        const projectData = allProjects.find(
          (p: any) => 
            String(p?.na853).toLowerCase() === String(projectId).toLowerCase() ||
            String(p?.mis) === String(projectId)
        );
        
        if (projectData) {
          misValue = projectData.mis || projectData.na853 || projectId;
        }
      }
      
      // IMPROVEMENT: Calculate budget changes directly here for simplicity
      // This implements the simple subtraction logic the user requested
      let simpleBudgetData = null;
      if (budgetQuery.data) {
        // Get the original values as numbers
        const availableBudget = Number(budgetQuery.data.available_budget || 0);
        const yearlyAvailable = Number(budgetQuery.data.yearly_available || 0);
        const quarterAvailable = Number(budgetQuery.data.quarter_available || 0);
        
        // Subtract the current amount directly and ensure we have integers
        simpleBudgetData = {
          available_budget: Math.round(availableBudget - amount),
          yearly_available: Math.round(yearlyAvailable - amount),
          quarter_available: Math.round(quarterAvailable - amount)
        };
        
        // Calculated remaining budget amounts by subtracting requested amount
      }
      
      // Manually broadcasting budget update to all connected clients
      
      // Send budget update via broadcast endpoint
      // Note: We need to include credentials as the endpoint still requires authentication
      const response = await fetch('/api/budget/broadcast-update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Needed for authentication
        body: JSON.stringify({
          mis: misValue,
          amount,
          // IMPROVEMENT: Send to ALL connected clients by setting sessionId to null
          // This ensures everyone (including the current user) gets the update
          sessionId: null,
          // Include our simple budget calculation
          simpleBudgetData
        })
      });
      
      if (!response.ok) {
        // Failed to broadcast manual budget update
        // Try to get error details
        const errorText = await response.text();
        // Retrieved detailed error response from server
      } else {
        // Manual budget update successfully broadcast to all clients
      }
    } catch (error) {
      // Error occurred while attempting to broadcast manual budget update
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