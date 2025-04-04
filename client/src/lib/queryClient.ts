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
    console.error("[API] Request failed:", error);
    throw error;
  }
}

/**
 * QueryFunction for use with React Query's useQuery
 * Handles GET requests with improved error handling for HTML responses
 */
export const getQueryFn = (
  { on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}
): QueryFunction => {
  return async ({ queryKey }) => {
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
        headers
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
      console.error("[Query] Request failed:", error);
      throw error;
    }
  };
};

// Create the React Query client with optimal defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});