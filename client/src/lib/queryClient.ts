import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Function for making API requests with improved error handling
 * This is used for mutations (POST, PUT, DELETE) via React Query
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Ensure URL starts with / but not // (avoiding protocol-relative URLs)
    let formattedUrl = url;
    if (!url.startsWith('/')) {
      formattedUrl = `/${url}`;
    }

    // Default headers with Content-Type
    const headers = new Headers({
      "Content-Type": "application/json",
      ...options.headers,
    });

    // Add request ID for tracking through logs
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    headers.set('X-Request-ID', requestId);

    // Make the fetch request
    const response = await fetch(formattedUrl, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for session handling
    });

    // Handle non-OK responses
    if (!response.ok) {
      // Handle unauthorized responses
      if (response.status === 401) {
        window.location.href = '/auth'; // Redirect to auth page on 401
        throw new Error("Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.");
      }

      let errorMessage: string;
      try {
        // Try to read the response text
        const errorText = await response.text();
        
        // Check if this appears to be HTML
        if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
          console.error('[API] Received HTML error response:', 
                       errorText.substring(0, 200) + (errorText.length > 200 ? '...' : ''));
          errorMessage = `Λάβαμε μη αναμενόμενη απόκριση από τον διακομιστή. Κωδικός: ${response.status}`;
          // Create enriched error even for HTML responses
          const enrichedError = new Error(errorMessage) as Error & {
            status?: number;
            code?: string;
            details?: string;
            constraint?: string;
          };
          enrichedError.status = response.status;
          throw enrichedError;
        } else {
          // Try to parse as JSON
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData?.message || errorData?.error?.message || 
                         `Σφάλμα HTTP! κατάσταση: ${response.status}`;
            
            // Create enriched error with structured data
            const enrichedError = new Error(errorMessage) as Error & {
              status?: number;
              code?: string;
              details?: string;
              constraint?: string;
              raw?: any;
            };
            enrichedError.status = response.status;
            enrichedError.code = errorData?.code;
            enrichedError.details = errorData?.details || errorData?.detail;
            enrichedError.constraint = errorData?.constraint;
            enrichedError.raw = errorData;
            throw enrichedError;
          } catch (parseError) {
            // If not valid JSON, use the raw text but still create enriched error with status
            errorMessage = errorText.length > 100 ? 
                         `${errorText.substring(0, 100)}...` : 
                         errorText || `Σφάλμα HTTP! κατάσταση: ${response.status}`;
            const enrichedError = new Error(errorMessage) as Error & {
              status?: number;
              code?: string;
              details?: string;
              constraint?: string;
            };
            enrichedError.status = response.status;
            throw enrichedError;
          }
        }
      } catch (textReadError) {
        // If we can't read the text at all, still create enriched error with status
        errorMessage = `Σφάλμα HTTP! κατάσταση: ${response.status}`;
        const enrichedError = new Error(errorMessage) as Error & {
          status?: number;
          code?: string;
          details?: string;
          constraint?: string;
        };
        enrichedError.status = response.status;
        throw enrichedError;
      }
    }

    // Check the content type for non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Special case for DELETE requests which might return no content
      if (options.method === 'DELETE' && response.status === 204) {
        return {} as T;
      }
      
      console.error(`[API] Received non-JSON response: ${contentType}`);
      try {
        const text = await response.text();
        console.error('[API] Non-JSON response body:', 
                    text.substring(0, 300) + (text.length > 300 ? '...' : ''));
      } catch (textError) {
        // Ignore read errors for logging
      }
      
      throw new Error(`Ο διακομιστής επέστρεψε μη έγκυρη απόκριση τύπου: ${contentType || 'άγνωστος τύπος'}`);
    }

    // Try to parse the JSON response
    try {
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.error("[API] JSON parsing error:", jsonError);
      throw new Error("Λήφθηκε μη έγκυρο JSON από τον διακομιστή");
    }
  } catch (error) {
    // Let aborted requests bubble up so callers can ignore cancellations cleanly
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    // If error is already an enriched error with structured fields, preserve them
    if (error instanceof Error && (error as any).status !== undefined) {
      // Error already has structured fields, just add our debugging info
      Object.assign(error, {
        requestInfo: {
          url: url,
          method: options.method || 'GET',
          timestamp: new Date().toISOString()
        },
        originalError: error, // Keep reference to self for compatibility
        isApiError: true
      });
      
      console.error("[API] Request failed:", error);
      console.error("[API] Error details:", {
        message: error.message,
        requestInfo: (error as any).requestInfo,
        stack: error.stack
      });
      
      throw error; // Preserve the enriched error with structured fields
    } else {
      // Create a new error for unexpected errors
      const enhancedError = new Error(
        error instanceof Error ? error.message : 'Unknown error during API request'
      );
      
      // Add extra properties and copy any structured fields from original error
      Object.assign(enhancedError, {
        requestInfo: {
          url: url,
          method: options.method || 'GET',
          timestamp: new Date().toISOString()
        },
        originalError: error,
        isApiError: true
      });
      
      // Copy structured fields if they exist on the original error
      if (error && typeof error === 'object') {
        const originalTyped = error as any;
        if (originalTyped.status !== undefined) (enhancedError as any).status = originalTyped.status;
        if (originalTyped.code !== undefined) (enhancedError as any).code = originalTyped.code;
        if (originalTyped.details !== undefined) (enhancedError as any).details = originalTyped.details;
        if (originalTyped.constraint !== undefined) (enhancedError as any).constraint = originalTyped.constraint;
        if (originalTyped.raw !== undefined) (enhancedError as any).raw = originalTyped.raw;
      }
      
      console.error("[API] Request failed:", enhancedError);
      console.error("[API] Error details:", {
        message: enhancedError.message,
        requestInfo: (enhancedError as any).requestInfo,
        stack: enhancedError.stack
      });
      
      throw enhancedError;
    }
  }
}

/**
 * QueryFunction for use with React Query's useQuery
 * Handles GET requests with improved error handling for HTML responses
 */
export const getQueryFn = (
  { on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}
): QueryFunction => {
  return async ({ queryKey, signal }) => {
    try {
      const url = queryKey[0] as string;
      
      // Ensure URL starts with / but not // (avoiding protocol-relative URLs)
      let formattedUrl = url;
      if (!url.startsWith('/')) {
        formattedUrl = `/${url}`;
      }
      
      // Add request ID for tracking through logs
      const requestId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const headers = new Headers({
        'X-Request-ID': requestId
      });
      
      // Make the fetch request
      const response = await fetch(formattedUrl, { 
        credentials: 'include', // Include cookies for authentication
        headers,
        signal,
      });

      // Handle non-OK responses
      if (!response.ok) {
        // Handle unauthorized responses
        if (response.status === 401) {
          if (on401 === "returnNull") {
            return null;
          }
          window.location.href = '/auth'; // Redirect to auth page on 401
          throw new Error("Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.");
        }

        let errorMessage: string;
        try {
          // Try to read the response text
          const errorText = await response.text();
          
          // Check if this appears to be HTML
          if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
            console.error('[Query] Received HTML error response:', 
                         errorText.substring(0, 200) + (errorText.length > 200 ? '...' : ''));
            errorMessage = `Λάβαμε μη αναμενόμενη απόκριση από τον διακομιστή. Κωδικός: ${response.status}`;
          } else {
            // Try to parse as JSON
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData?.message || errorData?.error?.message || 
                           `Σφάλμα HTTP! κατάσταση: ${response.status}`;
            } catch (parseError) {
              // If not valid JSON, use the raw text (but limited length)
              errorMessage = errorText.length > 100 ? 
                           `${errorText.substring(0, 100)}...` : 
                           errorText || `Σφάλμα HTTP! κατάσταση: ${response.status}`;
            }
          }
        } catch (textReadError) {
          // If we can't read the text at all
          errorMessage = `Σφάλμα HTTP! κατάσταση: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }

      // Check the content type for non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[Query] Received non-JSON response: ${contentType}`);
        try {
          const text = await response.text();
          console.error('[Query] Non-JSON response body:', 
                      text.substring(0, 300) + (text.length > 300 ? '...' : ''));
        } catch (textError) {
          // Ignore read errors for logging
        }
        
        throw new Error(`Ο διακομιστής επέστρεψε μη έγκυρη απόκριση τύπου: ${contentType || 'άγνωστος τύπος'}`);
      }

      // Try to parse the JSON response
      try {
        const data = await response.json();
        return data;
      } catch (jsonError) {
        console.error("[Query] JSON parsing error:", jsonError);
        throw new Error("Λήφθηκε μη έγκυρο JSON από τον διακομιστή");
      }
    } catch (error) {
      // Create a more detailed error object with better debugging info
      const enhancedError = new Error(
        error instanceof Error ? error.message : 'Unknown error during Query execution'
      );
      
      // Add extra properties to provide context about the error
      // Access only variables that we know are in scope
      Object.assign(enhancedError, {
        queryInfo: {
          url: queryKey[0],
          timestamp: new Date().toISOString()
        },
        originalError: error,
        isQueryError: true
      });
      
      console.error("[Query] Request failed:", enhancedError);
      console.error("[Query] Error details:", {
        message: enhancedError.message,
        queryInfo: (enhancedError as any).queryInfo,
        stack: enhancedError.stack
      });
      
      throw enhancedError; // Throw the enhanced error for better debugging
    }
  };
};

// Create the React Query client with performance-optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes cache for better performance
      gcTime: 30 * 60 * 1000, // 30 minutes cache retention (v5 renamed from cacheTime)
      retry: 1, // Single retry for better resilience
      retryDelay: 1000, // 1 second retry delay
      networkMode: 'online',
    },
    mutations: {
      retry: 1, // Single retry for mutations
      retryDelay: 1000,
      networkMode: 'online',
    },
  },
});
