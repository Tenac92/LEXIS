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
          available_budget: '0',
          quarter_available: '0',
          yearly_available: '0'
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
          throw new Error(`[Budget] Project MIS not found for ID: ${projectId}`);
        }

        // Fetch budget data from API - we need to use the numeric MIS number
        const misNumber = parseInt(project.mis);
        
        if (isNaN(misNumber)) {
          console.error('[Budget] Invalid MIS format. Expected numeric MIS:', project.mis);
          throw new Error(`[Budget] Invalid MIS format: ${project.mis}`);
        }

        console.log(`[Budget] Fetching budget data for MIS number: ${misNumber}`);
        const response = await fetch(`/api/budget/data/${misNumber}`);
        
        if (!response.ok) {
          console.error('[Budget] Budget API error:', response.status, response.statusText);
          throw new Error(`[Budget] Budget API error: ${response.status} ${response.statusText}`);
        }
        
        // Parse the response data
        const responseData = await response.json();
        console.log('[Budget] Raw budget response:', responseData);
        
        // Extract data based on response structure
        let budgetData: Record<string, any> = {}; 
        
        if (responseData?.status === 'success') {
          budgetData = responseData.data;
        } else {
          budgetData = responseData;
        }
        
        console.log('[Budget] Extracted budget data:', budgetData);
        
        // Return normalized budget data
        return {
          user_view: parseFloat(budgetData.user_view?.toString() || '0'),
          total_budget: parseFloat(budgetData.total_budget?.toString() || '0'),
          katanomes_etous: parseFloat(budgetData.katanomes_etous?.toString() || '0'),
          ethsia_pistosi: parseFloat(budgetData.ethsia_pistosi?.toString() || '0'),
          current_budget: parseFloat(budgetData.current_budget?.toString() || '0'),
          annual_budget: parseFloat(budgetData.annual_budget?.toString() || '0'),
          quarter_view: parseFloat(budgetData.quarter_view?.toString() || '0'),
          current_quarter: budgetData.current_quarter?.toString() || 'q1',
          last_quarter_check: budgetData.last_quarter_check?.toString() || 'q1',
          q1: parseFloat(budgetData.q1?.toString() || '0'),
          q2: parseFloat(budgetData.q2?.toString() || '0'),
          q3: parseFloat(budgetData.q3?.toString() || '0'),
          q4: parseFloat(budgetData.q4?.toString() || '0'),
          available_budget: budgetData.available_budget?.toString() || '',
          quarter_available: budgetData.quarter_available?.toString() || '',
          yearly_available: budgetData.yearly_available?.toString() || ''
        };
      } catch (error) {
        console.error('[Budget] Budget data fetch error:', error);
        throw error;
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

        // Get the numeric MIS for validation
        const misNumber = parseInt(project.mis);
        if (isNaN(misNumber)) {
          console.error('[Budget] Invalid MIS format for validation. Expected numeric MIS:', project.mis);
          return { 
            status: 'error', 
            canCreate: false,
            allowDocx: false,
            message: 'Μη έγκυρη μορφή MIS για επικύρωση προϋπολογισμού.'
          };
        }
        
        console.log(`[Budget] Validating budget for MIS: ${misNumber}, amount: ${currentAmount}`);
        
        // Using fetch directly instead of apiRequest to avoid auto-redirect on 401
        const response = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          },
          credentials: 'include',
          body: JSON.stringify({
            mis: misNumber.toString(), // Send the MIS as a string
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